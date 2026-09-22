require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('../backend/config/db');

async function seedAdmin() {
    console.log('--- Initializing Admin User Seed ---');

    const adminName = process.env.ADMIN_NAME || 'System Administrator';
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@attendance.local').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2026!';

    if (!adminPassword || adminPassword.length < 6) {
        console.error('❌ Error: ADMIN_PASSWORD in .env must be at least 6 characters long.');
        process.exit(1);
    }

    try {
        await initDatabase();

        const client = await pool.connect();
        try {
            // Check if admin already exists
            const check = await client.query('SELECT id, email, role FROM users WHERE email = $1', [adminEmail]);

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(adminPassword, salt);

            if (check.rows.length > 0) {
                // Update existing user to admin with new password
                await client.query(
                    `UPDATE users 
                     SET name = $1, password_hash = $2, role = 'admin', account_status = 'active', updated_at = CURRENT_TIMESTAMP
                     WHERE email = $3`,
                    [adminName, passwordHash, adminEmail]
                );
                console.log(`✅ Existing account (${adminEmail}) updated to Administrator.`);
            } else {
                // Create new admin user
                const insertRes = await client.query(
                    `INSERT INTO users (name, email, password_hash, role, account_status)
                     VALUES ($1, $2, $3, 'admin', 'active')
                     RETURNING id, name, email, role`,
                    [adminName, adminEmail, passwordHash]
                );

                const newAdmin = insertRes.rows[0];

                // Initialize settings
                await client.query(
                    `INSERT INTO user_settings (user_id, start_date, classes_weeks_visible, labs_weeks_visible)
                     VALUES ($1, CURRENT_DATE, 1, 1)
                     ON CONFLICT (user_id) DO NOTHING`,
                    [newAdmin.id]
                );

                console.log(`✅ Administrator account created successfully!`);
                console.log(`   Email: ${newAdmin.email}`);
                console.log(`   Role:  ${newAdmin.role}`);
            }

            console.log('   Security: Password has been securely hashed with bcrypt.');
            console.log('   You can now log in through the application login page.');
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('❌ Failed to seed administrator:', err.message);
    } finally {
        await pool.end();
    }
}

seedAdmin();

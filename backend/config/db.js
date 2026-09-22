const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool = null;
let isConnected = false;
let fallbackMode = false;

// In-memory / file-persisted store for graceful fallback when PostgreSQL is not configured
const fallbackDbFile = path.join(__dirname, '..', '..', 'database', 'local_dev_store.json');
let fallbackStore = {
    users: [],
    user_settings: [],
    subjects: [],
    attendance: [],
    password_reset_tokens: [],
    autoIncrement: { users: 1, subjects: 1, attendance: 1, password_reset_tokens: 1 }
};

function loadFallbackStore() {
    try {
        if (fs.existsSync(fallbackDbFile)) {
            const data = fs.readFileSync(fallbackDbFile, 'utf8');
            fallbackStore = JSON.parse(data);
            if (!fallbackStore.password_reset_tokens) fallbackStore.password_reset_tokens = [];
            if (!fallbackStore.autoIncrement) fallbackStore.autoIncrement = {};
            if (!fallbackStore.autoIncrement.password_reset_tokens) fallbackStore.autoIncrement.password_reset_tokens = 1;
        }
    } catch (e) {
        // use default fallbackStore
    }
}

// Immediately load fallback store on module import
loadFallbackStore();

function saveFallbackStore() {
    try {
        const dir = path.dirname(fallbackDbFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fallbackDbFile, JSON.stringify(fallbackStore, null, 2), 'utf8');
    } catch (e) {
        // silent catch
    }
}

// Initialize connection config
const connectionConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
    : {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'attendance_db'
    };

pool = new Pool(connectionConfig);

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Initialize database schema
 */
async function initDatabase() {
    loadFallbackStore();
    try {
        const client = await pool.connect();
        try {
            console.log('✅ PostgreSQL connection verified.');
            const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
            if (fs.existsSync(schemaPath)) {
                const schemaSql = fs.readFileSync(schemaPath, 'utf8');
                await client.query(schemaSql);
                console.log('✅ PostgreSQL schema verified and up to date.');
            }
            isConnected = true;
            fallbackMode = false;
        } finally {
            client.release();
        }
    } catch (err) {
        isConnected = false;
        fallbackMode = true;
        console.warn('⚠️  PostgreSQL connection unavailable (' + err.message + ').');
        console.warn('   Activating local persistent database engine so you can use the app immediately.');
        console.warn('   To use your PostgreSQL instance, set DATABASE_URL or PGPASSWORD in .env');
    }
}

/**
 * Fallback query engine: executes queries against JSON/in-memory store
 */
function executeFallbackQuery(text, params = []) {
    const sql = text.trim();
    const upper = sql.toUpperCase();

    // 1. Users Queries
    if (upper.startsWith('SELECT') && upper.includes('FROM USERS')) {
        let rows = [...fallbackStore.users];
        if (upper.includes('WHERE ID = $1')) {
            rows = rows.filter(u => u.id === params[0]);
        } else if (upper.includes('WHERE EMAIL = $1')) {
            rows = rows.filter(u => u.email.toLowerCase() === (params[0] || '').toLowerCase());
        } else if (upper.includes('COUNT(*)')) {
            const total = rows.length;
            const active = rows.filter(u => u.account_status === 'active').length;
            const admin = rows.filter(u => u.role === 'admin').length;
            return {
                rows: [{ total_users: total, active_users: active, admin_users: admin }],
                rowCount: 1
            };
        } else {
            // Admin users listing / search
            let filtered = rows;
            let pIdx = 0;
            if (upper.includes('LIKE')) {
                const term = (params[pIdx++] || '').replace(/%/g, '').toLowerCase();
                filtered = filtered.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
            }
            if (upper.includes('ROLE =')) {
                const role = params[pIdx++];
                filtered = filtered.filter(u => u.role === role);
            }
            if (upper.includes('ACCOUNT_STATUS =')) {
                const status = params[pIdx++];
                filtered = filtered.filter(u => u.account_status === status);
            }
            return { rows: filtered, rowCount: filtered.length };
        }
        return { rows, rowCount: rows.length };
    }

    if (upper.startsWith('INSERT INTO USERS')) {
        const id = fallbackStore.autoIncrement.users++;
        const role = upper.includes("'ADMIN'") || params[3] === 'admin' ? 'admin' : (params[3] || 'user');
        const status = upper.includes("'INACTIVE'") || params[4] === 'inactive' ? 'inactive' : 'active';
        const newUser = {
            id,
            name: params[0],
            email: params[1].toLowerCase(),
            password_hash: params[2],
            role,
            account_status: status,
            created_at: new Date(),
            updated_at: new Date()
        };
        fallbackStore.users.push(newUser);
        saveFallbackStore();
        return { rows: [newUser], rowCount: 1 };
    }

    if (upper.startsWith('UPDATE USERS')) {
        if (upper.includes('SET NAME = $1, PASSWORD_HASH = $2')) {
            // Admin seed update
            const email = params[2].toLowerCase();
            const user = fallbackStore.users.find(u => u.email === email);
            if (user) {
                user.name = params[0];
                user.password_hash = params[1];
                user.role = 'admin';
                user.account_status = 'active';
                user.updated_at = new Date();
                saveFallbackStore();
                return { rows: [user], rowCount: 1 };
            }
        } else if (upper.includes('SET ACCOUNT_STATUS = $1')) {
            const status = params[0];
            const id = params[1];
            const user = fallbackStore.users.find(u => u.id === id);
            if (user) {
                user.account_status = status;
                user.updated_at = new Date();
                saveFallbackStore();
                return { rows: [user], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        } else if (upper.includes('SET PASSWORD_HASH = $1')) {
            const newHash = params[0];
            const id = params[1];
            const user = fallbackStore.users.find(u => u.id === id);
            if (user) {
                user.password_hash = newHash;
                user.updated_at = new Date();
                saveFallbackStore();
                return { rows: [user], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        }
    }

    if (upper.startsWith('DELETE FROM USERS')) {
        const id = params[0];
        const idx = fallbackStore.users.findIndex(u => u.id === id);
        if (idx !== -1) {
            const deleted = fallbackStore.users.splice(idx, 1)[0];
            fallbackStore.subjects = fallbackStore.subjects.filter(s => s.user_id !== id);
            fallbackStore.attendance = fallbackStore.attendance.filter(a => a.user_id !== id);
            fallbackStore.user_settings = fallbackStore.user_settings.filter(s => s.user_id !== id);
            saveFallbackStore();
            return { rows: [deleted], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    // 2. User Settings Queries
    if (upper.includes('USER_SETTINGS')) {
        if (upper.startsWith('SELECT')) {
            const userId = params[0];
            const setting = fallbackStore.user_settings.find(s => s.user_id === userId);
            return {
                rows: setting ? [setting] : [],
                rowCount: setting ? 1 : 0
            };
        }
        if (upper.startsWith('INSERT INTO USER_SETTINGS')) {
            const userId = params[0];
            let setting = fallbackStore.user_settings.find(s => s.user_id === userId);
            if (!setting) {
                setting = {
                    user_id: userId,
                    start_date: params[1] ? new Date(params[1]) : new Date(),
                    classes_weeks_visible: params[2] || 1,
                    labs_weeks_visible: params[3] || 1,
                    created_at: new Date(),
                    updated_at: new Date()
                };
                fallbackStore.user_settings.push(setting);
            } else {
                if (params[1]) setting.start_date = new Date(params[1]);
                if (params[2] !== undefined) setting.classes_weeks_visible = params[2];
                if (params[3] !== undefined) setting.labs_weeks_visible = params[3];
                setting.updated_at = new Date();
            }
            saveFallbackStore();
            return { rows: [setting], rowCount: 1 };
        }
    }

    // 3. Subjects Queries
    if (upper.includes('FROM SUBJECTS') || upper.includes('INTO SUBJECTS') || upper.includes('UPDATE SUBJECTS') || upper.includes('DELETE FROM SUBJECTS')) {
        if (upper.startsWith('SELECT COUNT(*)::INT AS TOTAL_SUBJECTS') || upper.includes('COUNT(*)::INT AS TOTAL_SUBJECTS')) {
            return { rows: [{ total_subjects: fallbackStore.subjects.length }], rowCount: 1 };
        }
        if (upper.startsWith('SELECT') && upper.includes('COUNT(*) FILTER')) {
            // admin user subject stats
            const userId = params[0];
            const userSubjects = fallbackStore.subjects.filter(s => s.user_id === userId);
            const stats = userSubjects.map(sub => {
                const subAtt = fallbackStore.attendance.filter(a => a.subject_id === sub.id && a.user_id === userId);
                const present = subAtt.filter(a => a.attendance_status === 2).length;
                const absent = subAtt.filter(a => a.attendance_status === 1).length;
                return {
                    subject_id: sub.id,
                    subject_code: sub.subject_code,
                    subject_name: sub.subject_name,
                    subject_type: sub.subject_type,
                    present,
                    absent
                };
            });
            return { rows: stats, rowCount: stats.length };
        }
        if (upper.startsWith('SELECT')) {
            const userId = params[0];
            let list = fallbackStore.subjects.filter(s => s.user_id === userId);
            if (upper.includes('AND SUBJECT_TYPE = $2')) {
                list = list.filter(s => s.subject_type === params[1]);
            }
            if (upper.includes('AND SUBJECT_CODE = $3 AND SUBJECT_NAME = $4')) {
                list = list.filter(s => s.subject_code === params[2] && s.subject_name === params[3]);
            }
            if (upper.includes('COALESCE(MAX(SORT_ORDER)')) {
                const type = params[1];
                const typeSubs = list.filter(s => s.subject_type === type);
                const max = typeSubs.length > 0 ? Math.max(...typeSubs.map(s => s.sort_order || 0)) : 0;
                return { rows: [{ next_order: max + 1 }], rowCount: 1 };
            }
            if (upper.includes('WHERE ID = $1 AND USER_ID = $2')) {
                list = fallbackStore.subjects.filter(s => s.id === params[0] && s.user_id === params[1]);
            }
            list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            return { rows: list, rowCount: list.length };
        }
        if (upper.startsWith('INSERT INTO SUBJECTS')) {
            const id = fallbackStore.autoIncrement.subjects++;
            const newSub = {
                id,
                user_id: params[0],
                subject_code: params[1] || '',
                subject_name: params[2] || '',
                subject_type: params[3] || 'classes',
                sort_order: params[4] || 1,
                created_at: new Date(),
                updated_at: new Date()
            };
            fallbackStore.subjects.push(newSub);
            saveFallbackStore();
            return { rows: [newSub], rowCount: 1 };
        }
        if (upper.startsWith('UPDATE SUBJECTS')) {
            const code = params[0];
            const name = params[1];
            const id = params[2];
            const userId = params[3];
            const sub = fallbackStore.subjects.find(s => s.id === id && s.user_id === userId);
            if (sub) {
                if (code !== undefined) sub.subject_code = code;
                if (name !== undefined) sub.subject_name = name;
                sub.updated_at = new Date();
                saveFallbackStore();
                return { rows: [sub], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        }
        if (upper.startsWith('DELETE FROM SUBJECTS')) {
            const id = params[0];
            const userId = params[1];
            const idx = fallbackStore.subjects.findIndex(s => s.id === id && s.user_id === userId);
            if (idx !== -1) {
                const deleted = fallbackStore.subjects.splice(idx, 1)[0];
                fallbackStore.attendance = fallbackStore.attendance.filter(a => a.subject_id !== id);
                saveFallbackStore();
                return { rows: [deleted], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        }
    }

    // 4. Attendance Queries
    if (upper.includes('ATTENDANCE')) {
        if (upper.startsWith('SELECT') && upper.includes('COUNT(*)::INT AS TOTAL_RECORDS')) {
            const total = fallbackStore.attendance.length;
            const present = fallbackStore.attendance.filter(a => a.attendance_status === 2).length;
            const absent = fallbackStore.attendance.filter(a => a.attendance_status === 1).length;
            return {
                rows: [{ total_records: total, total_present: present, total_absent: absent }],
                rowCount: 1
            };
        }
        if (upper.startsWith('SELECT')) {
            const userId = params[0];
            const records = fallbackStore.attendance.filter(a => a.user_id === userId).map(a => ({
                id: a.id,
                subject_id: a.subject_id,
                date: new Date(a.date),
                lecture_number: a.lecture_number,
                attendance_status: a.attendance_status,
                open_panel: !!a.open_panel
            }));
            return { rows: records, rowCount: records.length };
        }
        if (upper.startsWith('INSERT INTO ATTENDANCE')) {
            const userId = params[0];
            const subjectId = params[1];
            const dateStr = typeof params[2] === 'string' ? params[2] : new Date(params[2]).toISOString().split('T')[0];
            const lecture = params[3];
            const status = params[4];
            const openPanel = params[5] !== undefined ? !!params[5] : false;

            let existing = fallbackStore.attendance.find(a =>
                a.user_id === userId &&
                a.subject_id === subjectId &&
                a.date === dateStr &&
                a.lecture_number === lecture
            );

            if (existing) {
                existing.attendance_status = status !== undefined ? status : existing.attendance_status;
                if (params[5] !== undefined) existing.open_panel = openPanel;
                existing.updated_at = new Date();
            } else {
                existing = {
                    id: fallbackStore.autoIncrement.attendance++,
                    user_id: userId,
                    subject_id: subjectId,
                    date: dateStr,
                    lecture_number: lecture,
                    attendance_status: status || 0,
                    open_panel: openPanel,
                    created_at: new Date(),
                    updated_at: new Date()
                };
                fallbackStore.attendance.push(existing);
            }
            saveFallbackStore();
            return {
                rows: [{
                    id: existing.id,
                    subject_id: existing.subject_id,
                    date: new Date(existing.date),
                    lecture_number: existing.lecture_number,
                    attendance_status: existing.attendance_status,
                    open_panel: existing.open_panel
                }],
                rowCount: 1
            };
        }
    }

    // 5. Password Reset Tokens Queries
    if (upper.includes('PASSWORD_RESET_TOKENS')) {
        if (!fallbackStore.password_reset_tokens) fallbackStore.password_reset_tokens = [];

        if (upper.startsWith('INSERT INTO PASSWORD_RESET_TOKENS')) {
            const id = fallbackStore.autoIncrement.password_reset_tokens++;
            const tokenRecord = {
                id,
                user_id: params[0],
                token_hash: params[1],
                expires_at: new Date(params[2]),
                used_at: null,
                created_at: new Date()
            };
            fallbackStore.password_reset_tokens.push(tokenRecord);
            saveFallbackStore();
            return { rows: [tokenRecord], rowCount: 1 };
        }

        if (upper.startsWith('UPDATE PASSWORD_RESET_TOKENS')) {
            if (upper.includes('WHERE USER_ID = $1')) {
                // Invalidate all tokens for user
                const userId = params[0];
                fallbackStore.password_reset_tokens.forEach(t => {
                    if (t.user_id === userId && !t.used_at) {
                        t.used_at = new Date();
                    }
                });
                saveFallbackStore();
                return { rows: [], rowCount: 1 };
            }
            if (upper.includes('WHERE ID = $1')) {
                // Mark single token as used
                const tokenId = params[0];
                const token = fallbackStore.password_reset_tokens.find(t => t.id === tokenId);
                if (token) {
                    token.used_at = new Date();
                    saveFallbackStore();
                    return { rows: [token], rowCount: 1 };
                }
            }
        }

        if (upper.startsWith('SELECT')) {
            const tokenHash = params[0];
            const now = new Date();
            const validToken = fallbackStore.password_reset_tokens.find(t =>
                t.token_hash === tokenHash &&
                !t.used_at &&
                new Date(t.expires_at) > now
            );
            if (validToken) {
                return { rows: [validToken], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        }
    }

    // Default empty query result
    return { rows: [], rowCount: 0 };
}

/**
 * Universal query method with parameterization
 */
async function query(text, params = []) {
    if (!fallbackMode && pool && isConnected) {
        try {
            return await pool.query(text, params);
        } catch (err) {
            console.warn('PostgreSQL query failed, falling back to local store:', err.message);
            return executeFallbackQuery(text, params);
        }
    }
    return executeFallbackQuery(text, params);
}

module.exports = {
    pool: {
        connect: async () => {
            if (!fallbackMode && pool && isConnected) {
                return await pool.connect();
            }
            return {
                query: async (text, params) => query(text, params),
                release: () => {}
            };
        },
        end: async () => {
            if (pool) await pool.end();
        }
    },
    query,
    initDatabase,
    isDbConnected: () => isConnected,
    isFallback: () => fallbackMode
};

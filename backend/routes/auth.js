const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Helper: Generate JWT token for user
 */
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        // 1. Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required (name, email, password).'
            });
        }

        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();

        // Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address.'
            });
        }

        // Password confirmation check
        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match.'
            });
        }

        // Password strength check
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        // 2. Check for duplicate account
        const existing = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [trimmedEmail]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email address already exists.'
            });
        }

        // 3. Hash password using bcrypt
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 4. Insert user
        const newUserResult = await db.query(
            `INSERT INTO users (name, email, password_hash, role, account_status)
             VALUES ($1, $2, $3, 'user', 'active')
             RETURNING id, name, email, role, account_status, created_at`,
            [trimmedName, trimmedEmail, passwordHash]
        );

        const newUser = newUserResult.rows[0];

        // 5. Initialize user settings
        await db.query(
            `INSERT INTO user_settings (user_id, start_date, classes_weeks_visible, labs_weeks_visible)
             VALUES ($1, CURRENT_DATE, 1, 1)
             ON CONFLICT (user_id) DO NOTHING`,
            [newUser.id]
        );

        // 6. Generate token
        const token = generateToken(newUser);

        return res.status(201).json({
            success: true,
            message: 'Registration successful!',
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during registration. Please try again later.'
        });
    }
});

/**
 * POST /api/auth/login
 * User & Admin login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please enter both email and password.'
            });
        }

        const trimmedEmail = email.trim().toLowerCase();

        // 1. Fetch user by email
        const result = await db.query(
            'SELECT id, name, email, password_hash, role, account_status FROM users WHERE email = $1',
            [trimmedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const user = result.rows[0];

        // 2. Check if account is active
        if (user.account_status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact an administrator.'
            });
        }

        // 3. Compare password hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // 4. Generate token
        const token = generateToken(user);

        return res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during login. Please try again later.'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userResult = await db.query(
            'SELECT id, name, email, role, account_status, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        return res.json({
            success: true,
            user: userResult.rows[0]
        });
    } catch (err) {
        console.error('Get profile error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve user profile.'
        });
    }
});

/**
 * POST /api/auth/logout
 * Client-side logout acknowledgment
 */
router.post('/logout', (req, res) => {
    return res.json({
        success: true,
        message: 'Logged out successfully.'
    });
});

/**
 * POST /api/auth/forgot-password
 * Request a single-use, time-limited password reset link
 * Security: Hashed tokens, generic response (no user enumeration), token invalidation
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide your email address.'
            });
        }

        const trimmedEmail = email.trim().toLowerCase();
        const genericMessage = 'If an account exists with this email address, a password reset link has been dispatched.';

        // 1. Look up user
        const result = await db.query(
            'SELECT id, name, email, account_status FROM users WHERE email = $1',
            [trimmedEmail]
        );

        if (result.rows.length === 0) {
            // Anti-enumeration: Return generic message even if user does not exist
            return res.json({
                success: true,
                message: genericMessage
            });
        }

        const user = result.rows[0];

        // If user account is deactivated, do not send reset link but return generic message
        if (user.account_status !== 'active') {
            return res.json({
                success: true,
                message: genericMessage
            });
        }

        // 2. Invalidate any existing unused reset tokens for this user
        await db.query(
            'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL',
            [user.id]
        );

        // 3. Generate cryptographically secure random token (64 hex characters)
        const rawToken = crypto.randomBytes(32).toString('hex');

        // 4. Store only SHA-256 hash in database
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        // 5. Expiration: 15 minutes from now
        const expiresInMinutes = 15;
        const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

        await db.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, tokenHash, expiresAt]
        );

        // 6. Build reset URL (using APP_URL if defined, else host header)
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5000';
        const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : `${protocol}://${host}`;
        const resetUrl = `${baseUrl}/reset-password.html?token=${rawToken}`;

        // 7. Dispatch email (or print to console in development fallback mode)
        await sendPasswordResetEmail({
            toEmail: user.email,
            userName: user.name,
            resetUrl,
            expiresInMinutes
        });

        // 8. Return generic message (never return the token in API responses)
        return res.json({
            success: true,
            message: genericMessage
        });
    } catch (err) {
        console.error('Forgot password error:', err);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while processing your request. Please try again later.'
        });
    }
});

/**
 * POST /api/auth/reset-password
 * Complete password reset using token
 * Security: Validates token hash, checks expiration, single-use, enforces min 6 chars
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Password reset token is required.'
            });
        }

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a new password.'
            });
        }

        // Consistent password policy: minimum 6 characters
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match.'
            });
        }

        // 1. Hash incoming raw token to compare against stored hash
        const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

        // 2. Query token record
        const tokenResult = await db.query(
            `SELECT id, user_id, expires_at, used_at
             FROM password_reset_tokens
             WHERE token_hash = $1`,
            [tokenHash]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired password reset link. Please request a new one.'
            });
        }

        const tokenRecord = tokenResult.rows[0];

        // Check if already used
        if (tokenRecord.used_at) {
            return res.status(400).json({
                success: false,
                message: 'This reset link has already been used. Please request a new one.'
            });
        }

        // Check expiration
        if (new Date(tokenRecord.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'This reset link has expired. Please request a new one.'
            });
        }

        // 3. Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // 4. Update user's password
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [passwordHash, tokenRecord.user_id]
        );

        // 5. Mark this token as used
        await db.query(
            'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1',
            [tokenRecord.id]
        );

        // 6. Invalidate any other outstanding reset tokens for this user
        await db.query(
            'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL',
            [tokenRecord.user_id]
        );

        return res.json({
            success: true,
            message: 'Your password has been reset successfully. You may now sign in with your new password.'
        });
    } catch (err) {
        console.error('Reset password error:', err);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while resetting your password. Please try again later.'
        });
    }
});

/**
 * POST /api/auth/change-password
 * Change password for authenticated active user
 */
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please enter both current and new passwords.'
            });
        }

        // Consistent password policy: minimum 6 characters
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long.'
            });
        }

        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match.'
            });
        }

        // 1. Get user record
        const userResult = await db.query(
            'SELECT id, password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const user = userResult.rows[0];

        // 2. Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect.'
            });
        }

        // 3. Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // 4. Update user password
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [passwordHash, user.id]
        );

        // 5. Invalidate outstanding reset tokens for this user
        await db.query(
            'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL',
            [user.id]
        );

        return res.json({
            success: true,
            message: 'Password changed successfully!'
        });
    } catch (err) {
        console.error('Change password error:', err);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while changing your password.'
        });
    }
});

module.exports = router;

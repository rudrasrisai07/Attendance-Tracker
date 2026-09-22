const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'attendance_secret_fallback_key_2026';

/**
 * Middleware to authenticate requests via JWT Bearer token
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : (req.cookies && req.cookies.token) || null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please log in.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verify user still exists and account is active
        const result = await db.query(
            'SELECT id, name, email, role, account_status FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User account no longer exists.'
            });
        }

        const user = result.rows[0];

        if (user.account_status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact an administrator.'
            });
        }

        // Attach user info to request object
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please log in again.',
                expired: true
            });
        }
        return res.status(403).json({
            success: false,
            message: 'Invalid or corrupted authentication token.'
        });
    }
}

/**
 * Middleware to enforce Admin role
 */
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied: Administrator privileges required.'
        });
    }
    next();
}

module.exports = {
    authenticateToken,
    requireAdmin,
    JWT_SECRET
};

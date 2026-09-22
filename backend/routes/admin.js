const express = require('express');
const db = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Strict authorization: authenticate + requireAdmin
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Summary statistics for the administrator dashboard
 */
router.get('/stats', async (req, res) => {
    try {
        // Total & Active Users
        const usersCountRes = await db.query(
            `SELECT 
                COUNT(*)::int AS total_users,
                COUNT(*) FILTER (WHERE account_status = 'active')::int AS active_users,
                COUNT(*) FILTER (WHERE role = 'admin')::int AS admin_users
             FROM users`
        );

        // Total Subjects
        const subjectsCountRes = await db.query(
            'SELECT COUNT(*)::int AS total_subjects FROM subjects'
        );

        // Attendance stats
        const attStatsRes = await db.query(
            `SELECT 
                COUNT(*)::int AS total_records,
                COUNT(*) FILTER (WHERE attendance_status = 2)::int AS total_present,
                COUNT(*) FILTER (WHERE attendance_status = 1)::int AS total_absent
             FROM attendance`
        );

        const totalUsers = usersCountRes.rows[0].total_users;
        const activeUsers = usersCountRes.rows[0].active_users;
        const adminUsers = usersCountRes.rows[0].admin_users;
        const totalSubjects = subjectsCountRes.rows[0].total_subjects;
        const { total_records, total_present, total_absent } = attStatsRes.rows[0];

        const validAttendanceTotal = total_present + total_absent;
        const overallPercentage = validAttendanceTotal > 0
            ? Number(((total_present * 100) / validAttendanceTotal).toFixed(1))
            : 0;

        return res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                adminUsers,
                totalSubjects,
                totalRecords: total_records,
                totalPresent: total_present,
                totalAbsent: total_absent,
                overallPercentage
            }
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve admin stats.' });
    }
});

/**
 * GET /api/admin/users
 * Search and list registered users (WITHOUT password hashes)
 */
router.get('/users', async (req, res) => {
    try {
        const { search, role, status, limit = 50, offset = 0 } = req.query;

        let queryText = `
            SELECT id, name, email, role, account_status, created_at, updated_at
            FROM users
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            params.push(`%${search.trim().toLowerCase()}%`);
            queryText += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`;
        }

        if (role && ['user', 'admin'].includes(role)) {
            params.push(role);
            queryText += ` AND role = $${params.length}`;
        }

        if (status && ['active', 'inactive'].includes(status)) {
            params.push(status);
            queryText += ` AND account_status = $${params.length}`;
        }

        queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const result = await db.query(queryText, params);

        return res.json({
            success: true,
            users: result.rows
        });
    } catch (err) {
        console.error('Admin users error:', err);
        return res.status(500).json({ success: false, message: 'Failed to list users.' });
    }
});

/**
 * PUT /api/admin/users/:id/status
 * Toggle user account status (active / inactive)
 */
router.put('/users/:id/status', async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id, 10);
        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status. Must be active or inactive.' });
        }

        if (targetUserId === req.user.id && status === 'inactive') {
            return res.status(400).json({ success: false, message: 'You cannot deactivate your own admin account.' });
        }

        const result = await db.query(
            `UPDATE users 
             SET account_status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING id, name, email, role, account_status`,
            [status, targetUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        return res.json({
            success: true,
            message: `User status changed to ${status}.`,
            user: result.rows[0]
        });
    } catch (err) {
        console.error('Admin change status error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update user status.' });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user account (cannot delete own account)
 */
router.delete('/users/:id', async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id, 10);

        if (targetUserId === req.user.id) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own admin account.' });
        }

        const result = await db.query(
            'DELETE FROM users WHERE id = $1 RETURNING id, name, email',
            [targetUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        return res.json({
            success: true,
            message: `User ${result.rows[0].email} deleted successfully.`
        });
    } catch (err) {
        console.error('Admin delete user error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete user.' });
    }
});

/**
 * GET /api/admin/users/:id/attendance
 * View a specific user's subjects, attendance records, and statistics
 */
router.get('/users/:id/attendance', async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id, 10);

        // Fetch user profile
        const userRes = await db.query(
            'SELECT id, name, email, role, account_status, created_at FROM users WHERE id = $1',
            [targetUserId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Fetch subjects
        const subjectsRes = await db.query(
            'SELECT id, subject_code, subject_name, subject_type FROM subjects WHERE user_id = $1 ORDER BY subject_type, sort_order',
            [targetUserId]
        );

        // Fetch attendance stats per subject
        const statsRes = await db.query(
            `SELECT 
                s.id AS subject_id,
                s.subject_code,
                s.subject_name,
                s.subject_type,
                COUNT(*) FILTER (WHERE a.attendance_status = 2)::int AS present,
                COUNT(*) FILTER (WHERE a.attendance_status = 1)::int AS absent
             FROM subjects s
             LEFT JOIN attendance a ON s.id = a.subject_id
             WHERE s.user_id = $1
             GROUP BY s.id, s.subject_code, s.subject_name, s.subject_type
             ORDER BY s.subject_type, s.sort_order`,
            [targetUserId]
        );

        const subjectStats = statsRes.rows.map(row => {
            const total = row.present + row.absent;
            const percentage = total > 0 ? Number(((row.present * 100) / total).toFixed(1)) : 0;
            return {
                ...row,
                total,
                percentage
            };
        });

        return res.json({
            success: true,
            user: userRes.rows[0],
            subjects: subjectsRes.rows,
            subjectStats
        });
    } catch (err) {
        console.error('Admin user attendance error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve user attendance.' });
    }
});

module.exports = router;

const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all subject routes
router.use(authenticateToken);

/**
 * GET /api/subjects
 * Fetch subjects belonging to the authenticated user.
 * Optional query param: ?type=classes|labs
 */
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        let queryText = 'SELECT id, subject_code, subject_name, subject_type, sort_order, created_at FROM subjects WHERE user_id = $1';
        const params = [req.user.id];

        if (type && ['classes', 'labs'].includes(type)) {
            queryText += ' AND subject_type = $2';
            params.push(type);
        }

        queryText += ' ORDER BY sort_order ASC, id ASC';

        const result = await db.query(queryText, params);

        return res.json({
            success: true,
            subjects: result.rows
        });
    } catch (err) {
        console.error('Fetch subjects error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve subjects.'
        });
    }
});

/**
 * POST /api/subjects
 * Create a new subject for the authenticated user
 */
router.post('/', async (req, res) => {
    try {
        const { subject_code, subject_name, subject_type } = req.body;

        const type = subject_type === 'labs' ? 'labs' : 'classes';
        const code = (subject_code || '').trim();
        const name = (subject_name || '').trim();

        // Determine next sort order
        const orderResult = await db.query(
            'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM subjects WHERE user_id = $1 AND subject_type = $2',
            [req.user.id, type]
        );
        const sortOrder = orderResult.rows[0].next_order;

        const insertResult = await db.query(
            `INSERT INTO subjects (user_id, subject_code, subject_name, subject_type, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, subject_code, subject_name, subject_type, sort_order, created_at`,
            [req.user.id, code, name, type, sortOrder]
        );

        return res.status(201).json({
            success: true,
            message: 'Subject added successfully.',
            subject: insertResult.rows[0]
        });
    } catch (err) {
        console.error('Create subject error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to create subject.'
        });
    }
});

/**
 * PUT /api/subjects/:id
 * Update subject code or name (ensures user owns the subject)
 */
router.put('/:id', async (req, res) => {
    try {
        const subjectId = parseInt(req.params.id, 10);
        const { subject_code, subject_name } = req.body;

        // Check ownership
        const existing = await db.query(
            'SELECT id FROM subjects WHERE id = $1 AND user_id = $2',
            [subjectId, req.user.id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found or you do not have permission to modify it.'
            });
        }

        const updateResult = await db.query(
            `UPDATE subjects 
             SET subject_code = COALESCE($1, subject_code),
                 subject_name = COALESCE($2, subject_name),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND user_id = $4
             RETURNING id, subject_code, subject_name, subject_type, sort_order, updated_at`,
            [subject_code, subject_name, subjectId, req.user.id]
        );

        return res.json({
            success: true,
            message: 'Subject updated successfully.',
            subject: updateResult.rows[0]
        });
    } catch (err) {
        console.error('Update subject error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update subject.'
        });
    }
});

/**
 * DELETE /api/subjects/:id
 * Delete subject and associated attendance (ensures user owns the subject)
 */
router.delete('/:id', async (req, res) => {
    try {
        const subjectId = parseInt(req.params.id, 10);

        // Delete subject only if user owns it
        const result = await db.query(
            'DELETE FROM subjects WHERE id = $1 AND user_id = $2 RETURNING id',
            [subjectId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found or permission denied.'
            });
        }

        return res.json({
            success: true,
            message: 'Subject and associated attendance removed.'
        });
    } catch (err) {
        console.error('Delete subject error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete subject.'
        });
    }
});

module.exports = router;

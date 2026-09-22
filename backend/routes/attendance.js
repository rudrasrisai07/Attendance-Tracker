const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function formatDateKey(d) {
    if (!d) return new Date().toISOString().split('T')[0];
    if (d instanceof Date) return d.toISOString().split('T')[0];
    if (typeof d === 'string') return d.split('T')[0];
    return String(d);
}

/**
 * GET /api/attendance/settings
 * Fetch user settings (startDate, classes_weeks_visible, labs_weeks_visible)
 */
router.get('/settings', async (req, res) => {
    try {
        let result = await db.query(
            'SELECT start_date, classes_weeks_visible, labs_weeks_visible FROM user_settings WHERE user_id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            await db.query(
                `INSERT INTO user_settings (user_id, start_date, classes_weeks_visible, labs_weeks_visible)
                 VALUES ($1, CURRENT_DATE, 1, 1)
                 ON CONFLICT (user_id) DO NOTHING`,
                [req.user.id]
            );
            result = await db.query(
                'SELECT start_date, classes_weeks_visible, labs_weeks_visible FROM user_settings WHERE user_id = $1',
                [req.user.id]
            );
        }

        const settings = result.rows[0];
        return res.json({
            success: true,
            settings: {
                startDate: formatDateKey(settings.start_date),
                classesWeeksVisible: settings.classes_weeks_visible,
                labsWeeksVisible: settings.labs_weeks_visible
            }
        });
    } catch (err) {
        console.error('Fetch settings error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch settings.' });
    }
});

/**
 * PUT /api/attendance/settings
 * Update user settings
 */
router.put('/settings', async (req, res) => {
    try {
        const { startDate, classesWeeksVisible, labsWeeksVisible } = req.body;

        const updateResult = await db.query(
            `INSERT INTO user_settings (user_id, start_date, classes_weeks_visible, labs_weeks_visible)
             VALUES ($1, COALESCE($2, CURRENT_DATE), COALESCE($3, 1), COALESCE($4, 1))
             ON CONFLICT (user_id) DO UPDATE SET
                 start_date = COALESCE($2, user_settings.start_date),
                 classes_weeks_visible = COALESCE($3, user_settings.classes_weeks_visible),
                 labs_weeks_visible = COALESCE($4, user_settings.labs_weeks_visible),
                 updated_at = CURRENT_TIMESTAMP
             RETURNING start_date, classes_weeks_visible, labs_weeks_visible`,
            [req.user.id, startDate, classesWeeksVisible, labsWeeksVisible]
        );

        const settings = updateResult.rows[0];
        return res.json({
            success: true,
            settings: {
                startDate: formatDateKey(settings.start_date),
                classesWeeksVisible: settings.classes_weeks_visible,
                labsWeeksVisible: settings.labs_weeks_visible
            }
        });
    } catch (err) {
        console.error('Update settings error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update settings.' });
    }
});

/**
 * GET /api/attendance
 * Retrieve full attendance map for the authenticated user
 */
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT a.id, a.subject_id, a.date, a.lecture_number, a.attendance_status, a.open_panel
             FROM attendance a
             JOIN subjects s ON a.subject_id = s.id
             WHERE a.user_id = $1`,
            [req.user.id]
        );

        // Format dates as YYYY-MM-DD
        const attendance = result.rows.map(row => ({
            id: row.id,
            subjectId: row.subject_id,
            date: formatDateKey(row.date),
            lecture: row.lecture_number,
            status: row.attendance_status,
            open: row.open_panel
        }));

        return res.json({
            success: true,
            attendance
        });
    } catch (err) {
        console.error('Fetch attendance error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve attendance.' });
    }
});

/**
 * POST /api/attendance/mark
 * Mark or update attendance for a single lecture slot
 */
router.post('/mark', async (req, res) => {
    try {
        const { subject_id, date, lecture_number, attendance_status } = req.body;

        if (!subject_id || !date || !lecture_number || attendance_status === undefined) {
            return res.status(400).json({
                success: false,
                message: 'subject_id, date, lecture_number, and attendance_status are required.'
            });
        }

        // Validate subject ownership
        const subjectCheck = await db.query(
            'SELECT id FROM subjects WHERE id = $1 AND user_id = $2',
            [subject_id, req.user.id]
        );

        if (subjectCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied: subject does not belong to user.'
            });
        }

        const validLectures = ['l1', 'l2', 'l3', 'l4'];
        if (!validLectures.includes(lecture_number)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid lecture slot. Allowed: l1, l2, l3, l4.'
            });
        }

        const statusVal = parseInt(attendance_status, 10);
        if (![0, 1, 2].includes(statusVal)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid attendance status. 0=unmarked, 1=absent, 2=present.'
            });
        }

        // Upsert attendance record
        const result = await db.query(
            `INSERT INTO attendance (user_id, subject_id, date, lecture_number, attendance_status)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, subject_id, date, lecture_number)
             DO UPDATE SET attendance_status = EXCLUDED.attendance_status,
                           updated_at = CURRENT_TIMESTAMP
             RETURNING id, subject_id, date, lecture_number, attendance_status`,
            [req.user.id, subject_id, date, lecture_number, statusVal]
        );

        return res.json({
            success: true,
            record: {
                ...result.rows[0],
                date: formatDateKey(result.rows[0].date)
            }
        });
    } catch (err) {
        console.error('Mark attendance error:', err);
        return res.status(500).json({ success: false, message: 'Failed to record attendance.' });
    }
});

/**
 * POST /api/attendance/panel-state
 * Save the expansion state of the lecture panel for a date
 */
router.post('/panel-state', async (req, res) => {
    try {
        const { subject_id, date, open } = req.body;

        if (!subject_id || !date) {
            return res.status(400).json({ success: false, message: 'subject_id and date required.' });
        }

        // Update panel state on existing records or insert placeholder
        await db.query(
            `INSERT INTO attendance (user_id, subject_id, date, lecture_number, attendance_status, open_panel)
             VALUES ($1, $2, $3, 'l1', 0, $4)
             ON CONFLICT (user_id, subject_id, date, lecture_number)
             DO UPDATE SET open_panel = EXCLUDED.open_panel,
                           updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, subject_id, date, !!open]
        );

        return res.json({ success: true });
    } catch (err) {
        console.error('Panel state error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update panel state.' });
    }
});

/**
 * POST /api/attendance/migrate
 * Import complete LocalStorage data payload into PostgreSQL for this user
 */
router.post('/migrate', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const data = req.body;
        if (!data || (!data.classes && !data.labs)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Local Storage data structure.'
            });
        }

        await client.query('BEGIN');

        // 1. Update settings
        const startDate = data.startDate || new Date().toISOString().split('T')[0];
        const classesWeeks = data.classes && data.classes.weeksVisible ? data.classes.weeksVisible : 1;
        const labsWeeks = data.labs && data.labs.weeksVisible ? data.labs.weeksVisible : 1;

        await client.query(
            `INSERT INTO user_settings (user_id, start_date, classes_weeks_visible, labs_weeks_visible)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id) DO UPDATE SET
                 start_date = EXCLUDED.start_date,
                 classes_weeks_visible = EXCLUDED.classes_weeks_visible,
                 labs_weeks_visible = EXCLUDED.labs_weeks_visible,
                 updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, startDate, classesWeeks, labsWeeks]
        );

        let importedSubjectsCount = 0;
        let importedAttendanceCount = 0;

        // 2. Import Classes and Labs
        for (const type of ['classes', 'labs']) {
            if (data[type] && Array.isArray(data[type].subjects)) {
                let sortOrder = 1;
                for (const sub of data[type].subjects) {
                    const code = (sub.code || '').trim();
                    const name = (sub.name || '').trim();

                    // Check if identical subject exists for user
                    let subjectResult = await client.query(
                        'SELECT id FROM subjects WHERE user_id = $1 AND subject_type = $2 AND subject_code = $3 AND subject_name = $4',
                        [req.user.id, type, code, name]
                    );

                    let subjectId;
                    if (subjectResult.rows.length > 0) {
                        subjectId = subjectResult.rows[0].id;
                    } else {
                        const insertSub = await client.query(
                            `INSERT INTO subjects (user_id, subject_code, subject_name, subject_type, sort_order)
                             VALUES ($1, $2, $3, $4, $5)
                             RETURNING id`,
                            [req.user.id, code, name, type, sortOrder++]
                        );
                        subjectId = insertSub.rows[0].id;
                        importedSubjectsCount++;
                    }

                    // Import attendance records for this subject
                    if (sub.attendance && typeof sub.attendance === 'object') {
                        for (const [dateStr, dayData] of Object.entries(sub.attendance)) {
                            // Validate date format YYYY-MM-DD
                            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

                            let l1 = 0, l2 = 0, l3 = 0, l4 = 0, open = false;
                            if (typeof dayData === 'number') {
                                l1 = dayData;
                            } else if (typeof dayData === 'object' && dayData !== null) {
                                l1 = dayData.l1 || 0;
                                l2 = dayData.l2 || 0;
                                l3 = dayData.l3 || 0;
                                l4 = dayData.l4 || 0;
                                open = !!dayData.open;
                            }

                            const lectures = [
                                { lec: 'l1', status: l1, open },
                                { lec: 'l2', status: l2, open: false },
                                { lec: 'l3', status: l3, open: false },
                                { lec: 'l4', status: l4, open: false }
                            ];

                            for (const item of lectures) {
                                if (item.status > 0 || item.open) {
                                    await client.query(
                                        `INSERT INTO attendance (user_id, subject_id, date, lecture_number, attendance_status, open_panel)
                                         VALUES ($1, $2, $3, $4, $5, $6)
                                         ON CONFLICT (user_id, subject_id, date, lecture_number)
                                         DO UPDATE SET attendance_status = EXCLUDED.attendance_status,
                                                       open_panel = EXCLUDED.open_panel,
                                                       updated_at = CURRENT_TIMESTAMP`,
                                        [req.user.id, subjectId, dateStr, item.lec, item.status, item.open]
                                    );
                                    importedAttendanceCount++;
                                }
                            }
                        }
                    }
                }
            }
        }

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: `Migration complete! Imported ${importedSubjectsCount} subjects and ${importedAttendanceCount} attendance entries.`,
            importedSubjectsCount,
            importedAttendanceCount
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration error:', err);
        return res.status(500).json({ success: false, message: 'Data migration failed.' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/attendance/export
 * Export complete attendance store in JSON format for the user
 */
router.get('/export', async (req, res) => {
    try {
        // 1. Settings
        const settingsRes = await db.query(
            'SELECT start_date, classes_weeks_visible, labs_weeks_visible FROM user_settings WHERE user_id = $1',
            [req.user.id]
        );
        const settings = settingsRes.rows[0] || {
            start_date: new Date(),
            classes_weeks_visible: 1,
            labs_weeks_visible: 1
        };

        const exportData = {
            startDate: formatDateKey(settings.start_date),
            classes: {
                weeksVisible: settings.classes_weeks_visible,
                subjects: []
            },
            labs: {
                weeksVisible: settings.labs_weeks_visible,
                subjects: []
            }
        };

        // 2. Subjects
        const subjectsRes = await db.query(
            'SELECT id, subject_code, subject_name, subject_type FROM subjects WHERE user_id = $1 ORDER BY sort_order ASC, id ASC',
            [req.user.id]
        );

        // 3. Attendance
        const attRes = await db.query(
            'SELECT subject_id, date, lecture_number, attendance_status, open_panel FROM attendance WHERE user_id = $1',
            [req.user.id]
        );

        const attendanceBySubject = {};
        attRes.rows.forEach(row => {
            const dateKey = formatDateKey(row.date);
            if (!attendanceBySubject[row.subject_id]) {
                attendanceBySubject[row.subject_id] = {};
            }
            if (!attendanceBySubject[row.subject_id][dateKey]) {
                attendanceBySubject[row.subject_id][dateKey] = {
                    l1: 0, l2: 0, l3: 0, l4: 0, open: false
                };
            }
            attendanceBySubject[row.subject_id][dateKey][row.lecture_number] = row.attendance_status;
            if (row.open_panel) {
                attendanceBySubject[row.subject_id][dateKey].open = true;
            }
        });

        subjectsRes.rows.forEach(sub => {
            const type = sub.subject_type === 'labs' ? 'labs' : 'classes';
            exportData[type].subjects.push({
                code: sub.subject_code,
                name: sub.subject_name,
                attendance: attendanceBySubject[sub.id] || {}
            });
        });

        return res.json({
            success: true,
            data: exportData
        });
    } catch (err) {
        console.error('Export error:', err);
        return res.status(500).json({ success: false, message: 'Failed to export attendance data.' });
    }
});

module.exports = router;

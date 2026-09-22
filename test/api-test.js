/**
 * Full Suite Automated Integration Tests
 * Attendance Manager 2.0
 */

require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = require('../backend/server');
const db = require('../backend/config/db');

let server;
let port = 5099;
let baseUrl = `http://localhost:${port}`;

async function ensureAdminUser() {
    await db.initDatabase();
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@attendance.local').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!';
    const adminName = process.env.ADMIN_NAME || 'System Administrator';

    const check = await db.query('SELECT id, email, role FROM users WHERE email = $1', [adminEmail]);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    if (check.rows.length === 0) {
        await db.query(
            `INSERT INTO users (name, email, password_hash, role, account_status)
             VALUES ($1, $2, $3, 'admin', 'active')`,
            [adminName, adminEmail, passwordHash]
        );
    } else {
        await db.query(
            `UPDATE users SET password_hash = $1, role = 'admin', account_status = 'active' WHERE email = $2`,
            [passwordHash, adminEmail]
        );
    }
}

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(baseUrl + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ Assertion Failed: ${message}`);
        throw new Error(message);
    }
    console.log(`  ✔ ${message}`);
}

async function runTests() {
    console.log('\n=============================================');
    console.log('  RUNNING INTEGRATION TESTS FOR ATTENDANCE 2.0');
    console.log('=============================================\n');

    server = app.listen(port);
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        // Ensure Admin user exists in the database
        await ensureAdminUser();

        // Test 1: Health Check
        console.log('--- 1. Testing Health Check ---');
        const health = await request('GET', '/api/health');
        assert(health.status === 200, 'Health endpoint responds with 200');
        assert(health.body.status === 'healthy', 'Health status is healthy');

        // Test 2: User A Registration
        console.log('\n--- 2. Testing User Registration ---');
        const userAEmail = `alice_${Date.now()}@college.edu`;
        const regA = await request('POST', '/api/auth/register', {
            name: 'Alice Student',
            email: userAEmail,
            password: 'Password123!',
            confirmPassword: 'Password123!'
        });
        assert(regA.status === 201, 'User A registered successfully (201)');
        assert(regA.body.token, 'Token returned on registration');
        assert(regA.body.user.email === userAEmail, 'User email matches');
        const tokenA = regA.body.token;

        // Test 3: Duplicate Registration Prevention
        console.log('\n--- 3. Testing Duplicate Account Prevention ---');
        const dupReg = await request('POST', '/api/auth/register', {
            name: 'Alice Duplicate',
            email: userAEmail,
            password: 'Password123!',
            confirmPassword: 'Password123!'
        });
        assert(dupReg.status === 409, 'Duplicate registration correctly rejected (409)');

        // Test 4: Authentication & Incorrect Password Rejection
        console.log('\n--- 4. Testing Password Security & Login ---');
        const badLogin = await request('POST', '/api/auth/login', {
            email: userAEmail,
            password: 'WrongPassword999'
        });
        assert(badLogin.status === 401, 'Bad credentials correctly rejected (401)');

        const goodLogin = await request('POST', '/api/auth/login', {
            email: userAEmail,
            password: 'Password123!'
        });
        assert(goodLogin.status === 200, 'Login succeeded with correct password (200)');
        assert(goodLogin.body.token, 'Token returned upon valid login');

        // Test 5: Register User B (for Data Isolation tests)
        console.log('\n--- 5. Testing Multi-User Data Isolation ---');
        const userBEmail = `bob_${Date.now()}@college.edu`;
        const regB = await request('POST', '/api/auth/register', {
            name: 'Bob Student',
            email: userBEmail,
            password: 'Password123!',
            confirmPassword: 'Password123!'
        });
        assert(regB.status === 201, 'User B registered successfully');
        const tokenB = regB.body.token;

        // User A creates a Subject
        const subARes = await request('POST', '/api/subjects', {
            subject_code: 'CS101',
            subject_name: 'Computer Networks',
            subject_type: 'classes'
        }, tokenA);
        assert(subARes.status === 201, 'User A created CS101 subject');
        const subAId = subARes.body.subject.id;

        // User B creates a different Subject
        const subBRes = await request('POST', '/api/subjects', {
            subject_code: 'EE201',
            subject_name: 'Electrical Circuits',
            subject_type: 'classes'
        }, tokenB);
        assert(subBRes.status === 201, 'User B created EE201 subject');
        const subBId = subBRes.body.subject.id;

        // Verify User A only sees their subject
        const listA = await request('GET', '/api/subjects', null, tokenA);
        const aSubjectCodes = listA.body.subjects.map(s => s.subject_code);
        assert(aSubjectCodes.includes('CS101'), 'User A sees CS101');
        assert(!aSubjectCodes.includes('EE201'), 'User A cannot see User B\'s EE201 (Isolation verified)');

        // Verify User B only sees their subject
        const listB = await request('GET', '/api/subjects', null, tokenB);
        const bSubjectCodes = listB.body.subjects.map(s => s.subject_code);
        assert(bSubjectCodes.includes('EE201'), 'User B sees EE201');
        assert(!bSubjectCodes.includes('CS101'), 'User B cannot see User A\'s CS101 (Isolation verified)');

        // User B cannot modify or delete User A's subject
        const unauthorizedDelete = await request('DELETE', `/api/subjects/${subAId}`, null, tokenB);
        assert(unauthorizedDelete.status === 404, 'User B cannot delete User A\'s subject (404/Denied)');

        // Test 6: Attendance Operations
        console.log('\n--- 6. Testing Attendance Operations (Single & Double Click) ---');
        const todayStr = new Date().toISOString().split('T')[0];

        // Mark Absent (1) - corresponds to single click
        const markAbsent = await request('POST', '/api/attendance/mark', {
            subject_id: subAId,
            date: todayStr,
            lecture_number: 'l1',
            attendance_status: 1
        }, tokenA);
        assert(markAbsent.status === 200, 'User A recorded Absent (1) for L1');

        // Mark Present (2) - corresponds to double click
        const markPresent = await request('POST', '/api/attendance/mark', {
            subject_id: subAId,
            date: todayStr,
            lecture_number: 'l2',
            attendance_status: 2
        }, tokenA);
        assert(markPresent.status === 200, 'User A recorded Present (2) for L2');

        // User B cannot mark attendance on User A's subject
        const crossAtt = await request('POST', '/api/attendance/mark', {
            subject_id: subAId,
            date: todayStr,
            lecture_number: 'l1',
            attendance_status: 2
        }, tokenB);
        assert(crossAtt.status === 403, 'Cross-user attendance marking rejected (403)');

        // Verify User A attendance retrieve
        const getAtt = await request('GET', '/api/attendance', null, tokenA);
        assert(getAtt.body.attendance.length >= 2, 'User A retrieves recorded attendance');

        // Test 7: Role-Based Access Control (Admin routes)
        console.log('\n--- 7. Testing Admin Access & RBAC ---');
        // Normal user A attempts to access admin route
        const unauthorizedAdmin = await request('GET', '/api/admin/stats', null, tokenA);
        assert(unauthorizedAdmin.status === 403, 'Normal user blocked from Admin stats (403)');

        // Admin login
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@attendance.local').toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!';
        const adminLogin = await request('POST', '/api/auth/login', {
            email: adminEmail,
            password: adminPassword
        });
        assert(adminLogin.status === 200, 'Admin logged in successfully');
        const adminToken = adminLogin.body.token;

        // Admin accesses stats
        const adminStats = await request('GET', '/api/admin/stats', null, adminToken);
        assert(adminStats.status === 200, 'Admin can view system stats (200)');
        assert(adminStats.body.stats.totalUsers >= 2, 'Admin stats report correct user count');

        // Admin lists users
        const adminUsers = await request('GET', '/api/admin/users', null, adminToken);
        assert(adminUsers.status === 200, 'Admin can list users (200)');
        assert(Array.isArray(adminUsers.body.users), 'Admin users is an array');

        // Admin inspects User A attendance
        const inspectRes = await request('GET', `/api/admin/users/${regA.body.user.id}/attendance`, null, adminToken);
        assert(inspectRes.status === 200, 'Admin can inspect student attendance');

        // Admin deactivates User B
        const deactivateRes = await request('PUT', `/api/admin/users/${regB.body.user.id}/status`, { status: 'inactive' }, adminToken);
        assert(deactivateRes.status === 200, 'Admin deactivated User B');

        // Deactivated user B should now be blocked from API
        const blockedUserB = await request('GET', '/api/subjects', null, tokenB);
        assert(blockedUserB.status === 403, 'Deactivated User B correctly blocked with 403');

        // Admin reactivates User B
        const reactivateRes = await request('PUT', `/api/admin/users/${regB.body.user.id}/status`, { status: 'active' }, adminToken);
        assert(reactivateRes.status === 200, 'Admin reactivated User B');

        const activeUserB = await request('GET', '/api/subjects', null, tokenB);
        assert(activeUserB.status === 200, 'Reactivated User B can access API again (200)');

        // Test 8: Local Storage Migration
        console.log('\n--- 8. Testing LocalStorage Migration API ---');
        const mockLegacyData = {
            startDate: '2026-09-01',
            classes: {
                weeksVisible: 2,
                subjects: [
                    {
                        code: 'MIG101',
                        name: 'Migrated Data Structures',
                        attendance: {
                            '2026-09-02': { l1: 2, l2: 1, l3: 0, l4: 0, open: true }
                        }
                    }
                ]
            },
            labs: {
                weeksVisible: 1,
                subjects: []
            }
        };

        const migRes = await request('POST', '/api/attendance/migrate', mockLegacyData, tokenA);
        assert(migRes.status === 200, 'Legacy data migration endpoint succeeded (200)');
        assert(migRes.body.success === true, 'Migration reported success');

        // Test 9: Data Export
        console.log('\n--- 9. Testing Data Export API ---');
        const exportRes = await request('GET', '/api/attendance/export', null, tokenA);
        assert(exportRes.status === 200, 'Export endpoint succeeded (200)');
        assert(exportRes.body.data.classes.subjects.some(s => s.code === 'MIG101'), 'Exported data includes migrated subject');

        // Test 10: Forgot Password & Anti-Enumeration
        console.log('\n--- 10. Testing Forgot Password & Anti-Enumeration ---');
        const forgotNonExistent = await request('POST', '/api/auth/forgot-password', {
            email: 'nonexistent_user_9999@college.edu'
        });
        assert(forgotNonExistent.status === 200, 'Non-existent email returns 200 generic message');
        assert(forgotNonExistent.body.success === true, 'Forgot password reports generic success');
        assert(!forgotNonExistent.body.token, 'Token is never returned through API');

        const forgotValid = await request('POST', '/api/auth/forgot-password', {
            email: userAEmail
        });
        assert(forgotValid.status === 200, 'Valid user returns 200 generic response');
        assert(forgotValid.body.success === true, 'Forgot password reports generic success');
        assert(!forgotValid.body.token, 'Token is never returned through API for valid user');

        // Test 11: Reset Password (Invalid, Expired, Single-Use, Policy)
        console.log('\n--- 11. Testing Reset Password Workflow ---');
        const fakeTokenRes = await request('POST', '/api/auth/reset-password', {
            token: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            newPassword: 'BrandNewPassword123!',
            confirmPassword: 'BrandNewPassword123!'
        });
        assert(fakeTokenRes.status === 400, 'Invalid token rejected with 400');

        // Generate expired test token in DB
        const expiredRaw = crypto.randomBytes(32).toString('hex');
        const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');
        const pastDate = new Date(Date.now() - 5 * 60 * 1000);
        await db.query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [regA.body.user.id, expiredHash, pastDate]
        );

        const expiredResetRes = await request('POST', '/api/auth/reset-password', {
            token: expiredRaw,
            newPassword: 'BrandNewPassword123!',
            confirmPassword: 'BrandNewPassword123!'
        });
        assert(expiredResetRes.status === 400, 'Expired token rejected with 400');

        // Generate valid test token in DB
        const validRaw = crypto.randomBytes(32).toString('hex');
        const validHash = crypto.createHash('sha256').update(validRaw).digest('hex');
        const futureDate = new Date(Date.now() + 15 * 60 * 1000);
        await db.query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [regA.body.user.id, validHash, futureDate]
        );

        // Short password rejected
        const shortPasswordRes = await request('POST', '/api/auth/reset-password', {
            token: validRaw,
            newPassword: '123',
            confirmPassword: '123'
        });
        assert(shortPasswordRes.status === 400, 'Password shorter than 6 characters rejected (400)');

        // Password mismatch rejected
        const mismatchRes = await request('POST', '/api/auth/reset-password', {
            token: validRaw,
            newPassword: 'BrandNewPassword123!',
            confirmPassword: 'MismatchPassword!'
        });
        assert(mismatchRes.status === 400, 'Mismatched passwords rejected (400)');

        // Valid password reset
        const validResetRes = await request('POST', '/api/auth/reset-password', {
            token: validRaw,
            newPassword: 'BrandNewPassword123!',
            confirmPassword: 'BrandNewPassword123!'
        });
        assert(validResetRes.status === 200, 'Password reset succeeded with valid token (200)');

        // Single-use check: reusing same token must fail
        const reuseResetRes = await request('POST', '/api/auth/reset-password', {
            token: validRaw,
            newPassword: 'AnotherPassword123!',
            confirmPassword: 'AnotherPassword123!'
        });
        assert(reuseResetRes.status === 400, 'Re-using consumed token rejected (single-use enforced)');

        // Verify old password fails login
        const oldLogin = await request('POST', '/api/auth/login', {
            email: userAEmail,
            password: 'Password123!'
        });
        assert(oldLogin.status === 401, 'Old password fails login after reset (401)');

        // Verify new password succeeds login
        const newLogin = await request('POST', '/api/auth/login', {
            email: userAEmail,
            password: 'BrandNewPassword123!'
        });
        assert(newLogin.status === 200, 'New password logs in successfully (200)');
        const updatedTokenA = newLogin.body.token;

        // Test 12: In-App Change Password (Authenticated)
        console.log('\n--- 12. Testing Authenticated Change Password ---');
        const unauthChange = await request('POST', '/api/auth/change-password', {
            currentPassword: 'BrandNewPassword123!',
            newPassword: 'FinalPassword456!',
            confirmPassword: 'FinalPassword456!'
        });
        assert(unauthChange.status === 401, 'Unauthenticated change password rejected (401)');

        const wrongCurrentPass = await request('POST', '/api/auth/change-password', {
            currentPassword: 'IncorrectOldPassword!',
            newPassword: 'FinalPassword456!',
            confirmPassword: 'FinalPassword456!'
        }, updatedTokenA);
        assert(wrongCurrentPass.status === 400, 'Incorrect current password rejected (400)');

        const shortNewPass = await request('POST', '/api/auth/change-password', {
            currentPassword: 'BrandNewPassword123!',
            newPassword: '12',
            confirmPassword: '12'
        }, updatedTokenA);
        assert(shortNewPass.status === 400, 'Short new password rejected (400)');

        const validChange = await request('POST', '/api/auth/change-password', {
            currentPassword: 'BrandNewPassword123!',
            newPassword: 'FinalPassword456!',
            confirmPassword: 'FinalPassword456!'
        }, updatedTokenA);
        assert(validChange.status === 200, 'Authenticated password changed successfully (200)');

        // Verify login with latest changed password
        const finalLogin = await request('POST', '/api/auth/login', {
            email: userAEmail,
            password: 'FinalPassword456!'
        });
        assert(finalLogin.status === 200, 'Login with changed password succeeded (200)');

        console.log('\n=============================================');
        console.log('  🎉 ALL INTEGRATION TESTS PASSED CLEANLY!   ');
        console.log('=============================================\n');
    } catch (err) {
        console.error('❌ Test suite encountered failure:', err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
    }
}

runTests();

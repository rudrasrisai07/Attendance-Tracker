/**
 * Administrator Module - Attendance Manager 2.0
 * Handles user management, attendance inspection, and analytics
 */

let currentAdmin = null;
let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Authenticate and enforce admin role
    if (!API.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const profile = await API.get('/api/auth/me');
        if (!profile.success || !profile.user || profile.user.role !== 'admin') {
            alert('Access denied: Administrator privileges required.');
            window.location.href = 'index.html';
            return;
        }
        currentAdmin = profile.user;
        document.getElementById('admin-name').textContent = currentAdmin.name;
    } catch (e) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Initialize tabs and load initial data
    setupTabs();
    await loadAdminStats();
    await loadUsers();
});

function setupTabs() {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));

            this.classList.add('active');
            const target = this.getAttribute('data-tab');
            const targetEl = document.getElementById(`tab-${target}`);
            if (targetEl) targetEl.classList.remove('hidden');

            if (target === 'users') loadUsers();
            else if (target === 'overview') loadAdminStats();
            else if (target === 'attendance') populateUserDropdown();
            else if (target === 'reports') loadReports();
        });
    });

    // Search and filter listeners
    document.getElementById('user-search-input')?.addEventListener('input', debounce(loadUsers, 300));
    document.getElementById('user-status-filter')?.addEventListener('change', loadUsers);
    document.getElementById('user-role-filter')?.addEventListener('change', loadUsers);
    document.getElementById('inspect-user-select')?.addEventListener('change', e => inspectUser(e.target.value));
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Load System Overview Statistics
 */
async function loadAdminStats() {
    try {
        const res = await API.get('/api/admin/stats');
        if (res.success && res.stats) {
            const s = res.stats;
            document.getElementById('stat-total-users').textContent = s.totalUsers;
            document.getElementById('stat-active-users').textContent = s.activeUsers;
            document.getElementById('stat-total-subjects').textContent = s.totalSubjects;
            document.getElementById('stat-avg-attendance').textContent = `${s.overallPercentage}%`;
            document.getElementById('stat-total-records').textContent = s.totalRecords;
            document.getElementById('stat-present-count').textContent = s.totalPresent;
            document.getElementById('stat-absent-count').textContent = s.totalAbsent;
        }
    } catch (err) {
        console.error('Error loading admin stats:', err);
    }
}

/**
 * Load and filter users table
 */
async function loadUsers() {
    const search = document.getElementById('user-search-input')?.value || '';
    const status = document.getElementById('user-status-filter')?.value || '';
    const role = document.getElementById('user-role-filter')?.value || '';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (role) params.append('role', role);

    try {
        const res = await API.get(`/api/admin/users?${params.toString()}`);
        if (res.success) {
            allUsers = res.users;
            renderUsersTable(allUsers);
        }
    } catch (err) {
        console.error('Error loading users:', err);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 25px;">No users found matching query.</td></tr>`;
        return;
    }

    users.forEach(u => {
        const tr = document.createElement('tr');
        const joinDate = new Date(u.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });

        tr.innerHTML = `
            <td>#${u.id}</td>
            <td><strong>${escapeHtml(u.name)}</strong></td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="role-pill ${u.role === 'admin' ? 'admin' : ''}">${u.role.toUpperCase()}</span></td>
            <td><span class="status-badge ${u.account_status}">${u.account_status}</span></td>
            <td>${joinDate}</td>
            <td>
                ${
                    u.id !== currentAdmin.id
                    ? `<button class="action-btn" onclick="toggleUserStatus(${u.id}, '${u.account_status}')">
                        ${u.account_status === 'active' ? 'Deactivate' : 'Activate'}
                       </button>
                       <button class="action-btn delete" onclick="deleteUser(${u.id}, '${escapeHtml(u.name)}')">
                        Delete
                       </button>`
                    : `<span style="font-size: 11px; opacity: 0.6;">(You)</span>`
                }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Toggle user account status
 */
async function toggleUserStatus(userId, currentStatus) {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    if (!confirm(`Are you sure you want to ${nextStatus === 'active' ? 'activate' : 'deactivate'} this user account?`)) {
        return;
    }

    try {
        const res = await API.put(`/api/admin/users/${userId}/status`, { status: nextStatus });
        if (res.success) {
            alert(res.message);
            await loadUsers();
            await loadAdminStats();
        } else {
            alert(res.message || 'Failed to update status.');
        }
    } catch (err) {
        alert(err.message || 'Error updating status.');
    }
}

/**
 * Delete a user
 */
async function deleteUser(userId, name) {
    if (!confirm(`Are you sure you want to permanently delete user "${name}" and all their attendance records? This cannot be undone.`)) {
        return;
    }

    try {
        const res = await API.delete(`/api/admin/users/${userId}`);
        if (res.success) {
            alert(res.message);
            await loadUsers();
            await loadAdminStats();
        } else {
            alert(res.message || 'Failed to delete user.');
        }
    } catch (err) {
        alert(err.message || 'Error deleting user.');
    }
}

/**
 * Populate user dropdown for Attendance Inspector
 */
async function populateUserDropdown() {
    const select = document.getElementById('inspect-user-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Choose a student --</option>';
    allUsers.forEach(u => {
        select.innerHTML += `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`;
    });
}

/**
 * Inspect Attendance of a selected student
 */
async function inspectUser(userId) {
    const container = document.getElementById('inspect-results-container');
    if (!container) return;

    if (!userId) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">Select a user to view attendance.</div>`;
        return;
    }

    container.innerHTML = `<div style="text-align: center; padding: 25px;">Loading attendance records...</div>`;

    try {
        const res = await API.get(`/api/admin/users/${userId}/attendance`);
        if (res.success && res.user) {
            const { user, subjectStats } = res;

            let statsHtml = '';
            if (subjectStats.length === 0) {
                statsHtml = `<p style="color: var(--text-muted); margin-top: 10px;">This user has not registered any subjects yet.</p>`;
            } else {
                statsHtml = `
                    <div class="admin-table-container" style="margin-top: 15px;">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Subject Code</th>
                                    <th>Subject Name</th>
                                    <th>Type</th>
                                    <th>Present</th>
                                    <th>Absent</th>
                                    <th>Total</th>
                                    <th>Attendance %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${subjectStats.map(s => `
                                    <tr>
                                        <td><strong>${escapeHtml(s.subject_code || '—')}</strong></td>
                                        <td>${escapeHtml(s.subject_name || 'Untitled')}</td>
                                        <td><span class="role-pill">${s.subject_type.toUpperCase()}</span></td>
                                        <td style="color: var(--present); font-weight: 600;">${s.present}</td>
                                        <td style="color: var(--absent); font-weight: 600;">${s.absent}</td>
                                        <td>${s.total}</td>
                                        <td>
                                            <strong style="color: ${s.percentage >= 75 ? 'var(--accent)' : 'var(--absent)'};">${s.percentage}%</strong>
                                            <div class="progress-bar-container">
                                                <div class="progress-bar-fill" style="width: ${s.percentage}%; background: ${s.percentage >= 75 ? 'var(--present)' : 'var(--absent)'};"></div>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="inspector-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h3 style="font-size: 18px; margin-bottom: 4px;">${escapeHtml(user.name)}</h3>
                            <p style="font-size: 13px; color: var(--text-muted);">${escapeHtml(user.email)} | Joined: ${new Date(user.created_at).toLocaleDateString()}</p>
                        </div>
                        <span class="status-badge ${user.account_status}">${user.account_status}</span>
                    </div>
                    ${statsHtml}
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = `<div style="color: var(--absent); padding: 20px;">Failed to load user attendance: ${err.message}</div>`;
    }
}

/**
 * Load Reports
 */
async function loadReports() {
    await loadAdminStats();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.inspectUser = inspectUser;

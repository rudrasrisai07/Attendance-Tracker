/**
 * Local Storage Migration Module - Attendance Manager 2.0
 * Facilitates safe migration of existing browser data to the PostgreSQL cloud backend
 */

const MigrationManager = (function () {
    const LEGACY_KEY = 'attendanceManagerData';
    const MIGRATION_DONE_KEY = 'attendance_migrated_to_cloud';

    function hasLegacyData() {
        try {
            const raw = localStorage.getItem(LEGACY_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            const hasClasses = data.classes && Array.isArray(data.classes.subjects) && data.classes.subjects.length > 0;
            const hasLabs = data.labs && Array.isArray(data.labs.subjects) && data.labs.subjects.length > 0;
            return (hasClasses || hasLabs) && !localStorage.getItem(MIGRATION_DONE_KEY);
        } catch (e) {
            return false;
        }
    }

    function checkAndShowBanner() {
        if (!hasLegacyData()) return;

        const bannerContainer = document.getElementById('migration-banner-container');
        if (!bannerContainer) return;

        bannerContainer.innerHTML = `
            <div class="migration-banner glass-card">
                <div class="migration-info">
                    <span style="font-size: 24px;">📦</span>
                    <div>
                        <strong>Existing Local Storage Attendance Found</strong>
                        <p style="font-size: 12px; opacity: 0.85; margin-top: 2px;">
                            We found attendance records saved on this computer. Would you like to sync them to your cloud account?
                        </p>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="glow-btn accent-btn" onclick="MigrationManager.performMigration()">
                        ☁️ Migrate to Cloud
                    </button>
                    <button class="glow-btn" style="padding: 8px 12px; font-size: 12px;" onclick="MigrationManager.dismissBanner()">
                        Dismiss
                    </button>
                </div>
            </div>
        `;
    }

    async function performMigration() {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (!raw) {
            alert('No local attendance data found.');
            return;
        }

        try {
            const data = JSON.parse(raw);
            if (!confirm('This will upload and merge your local attendance data into your account. Continue?')) {
                return;
            }

            const res = await API.post('/api/attendance/migrate', data);
            if (res.success) {
                localStorage.setItem(MIGRATION_DONE_KEY, 'true');
                dismissBanner();
                if (typeof showMessage === 'function') {
                    showMessage(res.message || 'Data successfully migrated to your cloud database!');
                } else {
                    alert(res.message || 'Data migrated successfully!');
                }
                // Reload dashboard data
                if (typeof window.loadUserData === 'function') {
                    await window.loadUserData();
                }
            } else {
                alert(res.message || 'Migration failed.');
            }
        } catch (err) {
            alert('Failed to migrate data: ' + err.message);
        }
    }

    function dismissBanner() {
        const bannerContainer = document.getElementById('migration-banner-container');
        if (bannerContainer) {
            bannerContainer.innerHTML = '';
        }
        localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    }

    return {
        checkAndShowBanner,
        performMigration,
        dismissBanner,
        hasLegacyData
    };
})();

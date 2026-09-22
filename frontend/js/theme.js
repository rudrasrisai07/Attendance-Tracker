/**
 * Theme Management Module - Attendance Manager 2.0
 * Default: Dark Mode
 * Supports persistent Light Mode toggle
 */

(function () {
    const THEME_STORAGE_KEY = 'attendance_theme_mode';

    // Get stored preference, default to 'dark'
    function getStoredTheme() {
        return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    }

    // Apply theme class to document body
    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        // Update theme toggle buttons if they exist
        const themeBtn = document.getElementById('btn-theme-toggle');
        if (themeBtn) {
            if (theme === 'light') {
                themeBtn.innerHTML = '☀️ Light Mode';
                themeBtn.setAttribute('title', 'Switch to Dark Mode');
            } else {
                themeBtn.innerHTML = '🌙 Dark Mode';
                themeBtn.setAttribute('title', 'Switch to Light Mode');
            }
        }
    }

    // Toggle between light and dark
    function toggleTheme() {
        const current = getStoredTheme();
        const nextTheme = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        applyTheme(nextTheme);

        // Notify charts or other components if needed
        if (typeof window.onThemeChanged === 'function') {
            window.onThemeChanged(nextTheme);
        }
    }

    // Expose helpers globally
    window.ThemeManager = {
        applyTheme,
        toggleTheme,
        getCurrentTheme: getStoredTheme
    };

    // Apply immediately to prevent flash
    const initialTheme = getStoredTheme();
    if (document.body) {
        applyTheme(initialTheme);
    } else {
        document.addEventListener('DOMContentLoaded', () => applyTheme(initialTheme));
    }
})();

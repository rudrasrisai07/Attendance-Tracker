/**
 * Central API Client - Attendance Manager 2.0
 * Handles JWT injection, common requests, and automatic session handling
 */

const API = (function () {
    const TOKEN_KEY = 'attendance_jwt_token';
    const USER_KEY = 'attendance_user_info';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setSession(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    function getUser() {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function isAuthenticated() {
        return !!getToken();
    }

    async function request(endpoint, options = {}) {
        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(endpoint, config);
            const data = await response.json().catch(() => ({}));

            if (response.status === 401) {
                // Unauthorized or token expired
                clearSession();
                const path = window.location.pathname;
                if (!path.endsWith('login.html') && !path.endsWith('register.html') && !path.includes('reset-password')) {
                    window.location.href = 'login.html?expired=1';
                }
                throw new Error(data.message || 'Session expired. Please log in.');
            }

            if (!response.ok) {
                const error = new Error(data.message || 'An error occurred.');
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (err) {
            throw err;
        }
    }

    return {
        getToken,
        getUser,
        setSession,
        clearSession,
        isAuthenticated,
        get: (endpoint) => request(endpoint, { method: 'GET' }),
        post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
        put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
        delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
        // Authentication & Password Management Helpers
        forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
        resetPassword: (token, newPassword, confirmPassword) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword, confirmPassword }) }),
        changePassword: (currentPassword, newPassword, confirmPassword) => request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) })
    };
})();

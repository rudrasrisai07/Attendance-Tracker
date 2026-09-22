/**
 * Authentication Module - Attendance Manager 2.0
 * Handles user registration, login, logout, and role redirection
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already authenticated
    const currentUser = API.getUser();
    const currentPath = window.location.pathname;

    if (API.isAuthenticated() && currentUser) {
        if (currentPath.endsWith('login.html') || currentPath.endsWith('register.html')) {
            if (currentUser.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }
            return;
        }
    }

    // Check for query parameters like ?expired=1 or ?registered=1 or ?reset=1
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('expired') === '1') {
        showAlert('Your session has expired. Please log in again.', 'error');
    } else if (urlParams.get('registered') === '1') {
        showAlert('Registration successful! Please log in with your credentials.', 'success');
    } else if (urlParams.get('reset') === '1') {
        showAlert('Password reset successfully! Please sign in with your new password.', 'success');
    }

    // Forgot password toggle buttons on login.html
    const linkShowForgot = document.getElementById('link-show-forgot');
    const linkBackToLogin = document.getElementById('link-back-to-login');
    const loginForm = document.getElementById('login-form');
    const forgotForm = document.getElementById('forgot-form');

    if (linkShowForgot && forgotForm && loginForm) {
        linkShowForgot.addEventListener('click', () => {
            clearAlert();
            loginForm.style.display = 'none';
            forgotForm.style.display = 'flex';
        });
    }

    if (linkBackToLogin && forgotForm && loginForm) {
        linkBackToLogin.addEventListener('click', () => {
            clearAlert();
            forgotForm.style.display = 'none';
            loginForm.style.display = 'flex';
        });
    }

    if (urlParams.get('action') === 'forgot' && linkShowForgot) {
        linkShowForgot.click();
    }

    // Attach password toggle listeners
    document.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const inputId = this.getAttribute('data-target');
            const input = document.getElementById(inputId);
            if (input) {
                const isPassword = input.getAttribute('type') === 'password';
                input.setAttribute('type', isPassword ? 'text' : 'password');
                this.textContent = isPassword ? '🙈' : '👁️';
            }
        });
    });

    // Login Form Handler
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Forgot Password Form Handler
    if (forgotForm) {
        forgotForm.addEventListener('submit', handleForgotPassword);
    }

    // Register Form Handler
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        const passwordInput = document.getElementById('register-password');
        if (passwordInput) {
            passwordInput.addEventListener('input', () => updatePasswordStrength('register-password', 'strength-bar'));
        }
        registerForm.addEventListener('submit', handleRegister);
    }

    // Reset Password Form Handler (reset-password.html)
    const resetForm = document.getElementById('reset-password-form');
    if (resetForm) {
        const token = urlParams.get('token');
        const tokenField = document.getElementById('reset-token');
        const missingBox = document.getElementById('token-missing-box');

        if (!token) {
            resetForm.style.display = 'none';
            if (missingBox) missingBox.style.display = 'block';
            showAlert('No valid reset token found in this link.', 'error');
        } else {
            if (tokenField) tokenField.value = token;
            const newPassInput = document.getElementById('reset-new-password');
            if (newPassInput) {
                newPassInput.addEventListener('input', () => updatePasswordStrength('reset-new-password', 'strength-bar'));
            }
            resetForm.addEventListener('submit', handleResetPassword);
        }
    }

    // Change Password Form Handler (modal in dashboard/admin)
    const changePassForm = document.getElementById('change-password-form');
    if (changePassForm) {
        changePassForm.addEventListener('submit', handleChangePassword);
    }
});

function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('auth-alert');
    if (!alertBox) return;

    alertBox.textContent = message;
    alertBox.className = `alert-box ${type}`;
    alertBox.style.display = 'block';
}

function clearAlert() {
    const alertBox = document.getElementById('auth-alert');
    if (alertBox) {
        alertBox.textContent = '';
        alertBox.style.display = 'none';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    clearAlert();

    const submitBtn = document.getElementById('login-submit-btn');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showAlert('Please enter both email and password.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
        }

        const data = await API.post('/api/auth/login', { email, password });

        if (data.success && data.token) {
            API.setSession(data.token, data.user);
            showAlert('Login successful! Redirecting...', 'success');

            setTimeout(() => {
                if (data.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'index.html';
                }
            }, 600);
        } else {
            showAlert(data.message || 'Login failed.', 'error');
        }
    } catch (err) {
        showAlert(err.message || 'Unable to connect to the server. Please check your network.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    }
}

function updatePasswordStrength(inputId = 'register-password', barId = 'strength-bar') {
    const input = document.getElementById(inputId);
    const bar = document.getElementById(barId);
    if (!input || !bar) return;

    const password = input.value;
    let score = 0;
    if (password.length >= 6) score += 25;
    if (password.length >= 10) score += 25;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 25;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 25;

    bar.style.width = score + '%';
    if (score <= 25) {
        bar.style.backgroundColor = 'var(--absent, #EF4444)';
    } else if (score <= 50) {
        bar.style.backgroundColor = 'var(--warning, #F59E0B)';
    } else if (score <= 75) {
        bar.style.backgroundColor = 'var(--accent, #3B82F6)';
    } else {
        bar.style.backgroundColor = 'var(--present, #10B981)';
    }
}

/**
 * Handle Forgot Password Request
 */
async function handleForgotPassword(e) {
    e.preventDefault();
    clearAlert();

    const submitBtn = document.getElementById('forgot-submit-btn');
    const email = document.getElementById('forgot-email').value.trim();

    if (!email) {
        showAlert('Please enter your account email address.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending reset link...';
        }

        const data = await API.forgotPassword(email);

        // Always show the generic safe message regardless of user existence
        showAlert(data.message || 'If an account exists with this email address, a password reset link has been dispatched.', 'success');
        const emailInput = document.getElementById('forgot-email');
        if (emailInput) emailInput.value = '';
    } catch (err) {
        showAlert(err.message || 'Unable to process your request. Please try again later.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';
        }
    }
}

/**
 * Handle Reset Password with Token (reset-password.html)
 */
async function handleResetPassword(e) {
    e.preventDefault();
    clearAlert();

    const submitBtn = document.getElementById('reset-submit-btn');
    const token = document.getElementById('reset-token').value.trim();
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    if (!token) {
        showAlert('Reset token is missing. Please use the link sent to your email.', 'error');
        return;
    }

    if (!newPassword || !confirmPassword) {
        showAlert('Please fill in both password fields.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showAlert('Password must be at least 6 characters long.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showAlert('Passwords do not match.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating password...';
        }

        const data = await API.resetPassword(token, newPassword, confirmPassword);

        if (data.success) {
            showAlert('Password reset successfully! Redirecting to login...', 'success');
            const form = document.getElementById('reset-password-form');
            if (form) form.reset();

            setTimeout(() => {
                window.location.href = 'login.html?reset=1';
            }, 1200);
        } else {
            showAlert(data.message || 'Password reset failed.', 'error');
        }
    } catch (err) {
        showAlert(err.message || 'Invalid or expired password reset link.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Set New Password';
        }
    }
}

/**
 * Handle In-App Change Password (Authenticated Settings Modal)
 */
async function handleChangePassword(e) {
    e.preventDefault();
    const alertBox = document.getElementById('change-password-alert');
    const submitBtn = document.getElementById('btn-save-password');

    const showModalAlert = (msg, type = 'error') => {
        if (alertBox) {
            alertBox.textContent = msg;
            alertBox.className = `alert-box ${type}`;
            alertBox.style.display = 'block';
        } else if (typeof showToast === 'function') {
            showToast(msg);
        } else {
            alert(msg);
        }
    };

    if (alertBox) alertBox.style.display = 'none';

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showModalAlert('Please fill in all password fields.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showModalAlert('New password must be at least 6 characters long.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showModalAlert('New passwords do not match.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';
        }

        const data = await API.changePassword(currentPassword, newPassword, confirmPassword);

        if (data.success) {
            showModalAlert('Password changed successfully!', 'success');
            const form = document.getElementById('change-password-form');
            if (form) form.reset();
            setTimeout(() => {
                const modal = document.getElementById('settings-modal');
                if (modal) modal.style.display = 'none';
            }, 1500);
        } else {
            showModalAlert(data.message || 'Failed to change password.', 'error');
        }
    } catch (err) {
        showModalAlert(err.message || 'Failed to change password. Verify your current password.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Password';
        }
    }
}

async function handleRegister(e) {
    e.preventDefault();
    clearAlert();

    const submitBtn = document.getElementById('register-submit-btn');
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (!name || !email || !password || !confirmPassword) {
        showAlert('Please fill in all fields.', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showAlert('Passwords do not match.', 'error');
        return;
    }

    if (password.length < 6) {
        showAlert('Password must be at least 6 characters long.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating account...';
        }

        const data = await API.post('/api/auth/register', {
            name,
            email,
            password,
            confirmPassword
        });

        if (data.success && data.token) {
            API.setSession(data.token, data.user);
            showAlert('Account created successfully! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 600);
        } else {
            showAlert(data.message || 'Registration failed.', 'error');
        }
    } catch (err) {
        showAlert(err.message || 'Registration failed. Email might already exist.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
        }
    }
}

/**
 * Global Logout handler
 */
async function logoutUser() {
    try {
        await API.post('/api/auth/logout', {});
    } catch (e) {
        // ignore network error on logout
    }
    API.clearSession();
    window.location.href = 'login.html';
}

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const user = API.getUser();
    if (user) {
        const nameEl = document.getElementById('modal-user-name');
        const emailEl = document.getElementById('modal-user-email');
        const roleEl = document.getElementById('modal-user-role');
        if (nameEl) nameEl.textContent = user.name || 'Student';
        if (emailEl) emailEl.textContent = user.email || '';
        if (roleEl) {
            roleEl.textContent = (user.role || 'user').toUpperCase();
            if (user.role === 'admin') {
                roleEl.classList.add('admin');
            } else {
                roleEl.classList.remove('admin');
            }
        }
    }
    const alertBox = document.getElementById('change-password-alert');
    if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
    }
    const form = document.getElementById('change-password-form');
    if (form) form.reset();
    const bar = document.getElementById('modal-strength-bar');
    if (bar) bar.style.width = '0';
    modal.style.display = 'flex';
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

window.logoutUser = logoutUser;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;

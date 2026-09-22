const nodemailer = require('nodemailer');

/**
 * Attendance Tracker 2.0 - Email Delivery Service
 * Uses Nodemailer for production SMTP delivery.
 * Defaults to EMAIL_ENABLED=false where reset URLs are printed to the server terminal.
 */

let transporter = null;

function getTransporter() {
    if (!transporter && process.env.EMAIL_ENABLED === 'true') {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return transporter;
}

/**
 * Send password reset email
 * @param {Object} params
 * @param {string} params.toEmail
 * @param {string} params.userName
 * @param {string} params.resetUrl
 * @param {number} params.expiresInMinutes
 */
async function sendPasswordResetEmail({ toEmail, userName, resetUrl, expiresInMinutes = 15 }) {
    const isEmailEnabled = process.env.EMAIL_ENABLED === 'true';

    // Development fallback: Print to server terminal
    if (!isEmailEnabled) {
        console.log('\n================================================================');
        console.log('  📧 [LOCAL DEV - PASSWORD RESET DISPATCH]');
        console.log(`  To:           ${userName || 'User'} <${toEmail}>`);
        console.log(`  Reset Link:   ${resetUrl}`);
        console.log(`  Expires in:   ${expiresInMinutes} minutes (single-use)`);
        console.log('  Notice:       EMAIL_ENABLED=false. Configure SMTP in .env for production.');
        console.log('================================================================\n');
        return { success: true, mode: 'console' };
    }

    // Production SMTP delivery
    const mailClient = getTransporter();
    if (!mailClient) {
        throw new Error('SMTP transporter is not configured. Check your .env file.');
    }

    const sender = process.env.SMTP_FROM || `"Attendance Tracker" <${process.env.SMTP_USER}>`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0A0718; color: #E2E8F0; margin: 0; padding: 30px 15px; }
            .container { max-width: 540px; margin: 0 auto; background: #130E29; border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 20px; padding: 35px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
            .header { text-align: center; margin-bottom: 25px; }
            .title { font-size: 22px; font-weight: 800; background: linear-gradient(135deg, #C4B5FD, #F472B6, #67E8F9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 8px 0; }
            .subtitle { font-size: 13px; color: #94A3B8; margin: 0; }
            .greeting { font-size: 15px; margin: 20px 0 12px; color: #F1F5F9; }
            .content { font-size: 14px; line-height: 1.6; color: #CBD5E1; }
            .btn-wrapper { text-align: center; margin: 30px 0; }
            .btn { display: inline-block; background: linear-gradient(135deg, #7C3AED, #DB2777); color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 10px 20px rgba(124, 58, 237, 0.35); }
            .link-box { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; word-break: break-all; font-size: 11px; color: #67E8F9; font-family: monospace; }
            .footer { font-size: 12px; color: #64748B; margin-top: 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.08); pt-4; padding-top: 20px; }
            .warning { font-size: 12px; color: #F59E0B; margin-top: 20px; background: rgba(245, 158, 11, 0.1); padding: 10px 14px; border-radius: 8px; border-left: 3px solid #F59E0B; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="title">Attendance Tracker 2.0</div>
                <p class="subtitle">Secure Password Reset Request</p>
            </div>
            <p class="greeting">Hello ${userName || 'Student'},</p>
            <p class="content">
                We received a request to reset your password for your Attendance Tracker account. Click the button below to establish a new password:
            </p>
            <div class="btn-wrapper">
                <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
            </div>
            <div class="warning">
                ⏱️ <strong>Security notice:</strong> This link is single-use and will expire in <strong>${expiresInMinutes} minutes</strong>.
            </div>
            <p class="content" style="margin-top: 25px; font-size: 12px; color: #94A3B8;">
                If the button above does not work, copy and paste this link into your browser:
            </p>
            <div class="link-box">${resetUrl}</div>
            <div class="footer">
                If you did not request this password reset, please ignore this email. Your account remains secure.<br>
                Attendance Tracker 2.0 • Academic Productivity
            </div>
        </div>
    </body>
    </html>
    `;

    const textContent = `Attendance Tracker 2.0 - Password Reset\n\n` +
        `Hello ${userName || 'Student'},\n\n` +
        `We received a request to reset your password. Use the following secure link to reset it:\n` +
        `${resetUrl}\n\n` +
        `This link is single-use and will expire in ${expiresInMinutes} minutes.\n\n` +
        `If you did not request this password reset, please ignore this email.`;

    const info = await mailClient.sendMail({
        from: sender,
        to: toEmail,
        subject: 'Password Reset — Attendance Tracker 2.0',
        text: textContent,
        html: htmlContent
    });

    return { success: true, mode: 'smtp', messageId: info.messageId };
}

module.exports = {
    sendPasswordResetEmail
};

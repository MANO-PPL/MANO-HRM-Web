import nodemailer from 'nodemailer';

/**
 * Sends an email using Zoho / Custom SMTP or Gmail OAuth2 fallback with credentials from .env
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML body
 * @param {Array} [options.attachments] - Optional attachments
 */
export const sendEmail = async ({ to, subject, text, html, attachments }) => {
    // 1. Check for standard SMTP configuration (Zoho Mail, etc.)
    const smtpUser = (process.env.SMTP_USER || process.env.EMAIL_USER)?.trim();
    const smtpPass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS)?.trim();
    const smtpHost = (process.env.SMTP_HOST || 'smtppro.zoho.in').trim();
    const smtpPort = parseInt(process.env.SMTP_PORT?.trim() || '465', 10);
    const smtpSecure = process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE.trim().toLowerCase() === 'true'
        : smtpPort === 465;

    // 2. Fallback: Gmail OAuth2 configuration
    const gmailUser = process.env.GMAIL_USER?.trim();
    const clientId = process.env.GMAIL_CLIENT_ID?.trim();
    const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();

    let transporter;
    let senderEmail;

    if (smtpUser && smtpPass) {
        // Zoho SMTP transport
        senderEmail = smtpUser;
        transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });
    } else if (gmailUser && clientId && clientSecret && refreshToken) {
        // Legacy Gmail OAuth2 transport
        senderEmail = gmailUser;
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: gmailUser,
                clientId,
                clientSecret,
                refreshToken,
            }
        });
    } else {
        console.error('[EMAIL ERROR] Missing email credentials in .env (Neither SMTP nor Gmail OAuth2 configured)');
        return { ok: false, error: 'Missing email configuration' };
    }

    try {
        const fromName = process.env.EMAIL_FROM_NAME?.trim() || "Mano Attendance System";
        const mailOptions = {
            // Zoho requires the 'from' address to match the authenticated SMTP user
            from: `"${fromName}" <${senderEmail}>`,
            to,
            subject,
            text,
            html,
            attachments,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully: %s', info.messageId);
        return { ok: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { ok: false, error: error.message };
    }
};

export default { sendEmail };
import catchAsync from '../../utils/catchAsync.js';
import * as authService from '../../services/auth/authService.js';
import AppError from '../../utils/AppError.js';
import { attendanceDB } from '../../config/database.js';
import bcrypt from 'bcrypt';

const REFRESH_TOKEN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 Days
const IS_PROD = process.env.NODE_ENV === 'production';

export const login = catchAsync(async (req, res, next) => {
    const { user_input, user_password, captchaToken, rememberMe } = req.body;

    if (!user_input || !user_password) {
        throw new AppError("Username and password are required.", 400);
    }

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown'
    };

    const { accessToken, refreshToken, user } = await authService.authenticateUser(user_input, user_password, reqInfo, rememberMe === true);

    const cookieOptions = {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'Lax',
        path: '/'
    };

    if (rememberMe === true) {
        cookieOptions.maxAge = REFRESH_TOKEN_COOKIE_MAX_AGE;
    }

    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.status(200).json({ accessToken, user });
});

export const superAdminLogin = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new AppError("Email and password are required.", 400);
    }

    const reqInfo = { ip: req.clientIp || req.ip, userAgent: req.get('User-Agent') || 'Unknown' };
    const { accessToken, refreshToken, user } = await authService.authenticateSuperAdmin(email, password, reqInfo);

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'Lax',
        maxAge: 12 * 60 * 60 * 1000,
        path: '/'
    });

    res.status(200).json({ accessToken, user });
});

export const requestPasswordReset = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    if (!email) throw new AppError("Email is required", 400);

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown'
    };

    await authService.validatePasswordResetRequest(email, reqInfo);
    res.json({ message: "OTP sent to your email" });
});

export const verifyOtp = catchAsync(async (req, res, next) => {
    const { email, otp } = req.body;
    if (!email || !otp) throw new AppError("Email and OTP are required", 400);

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown'
    };

    const resetToken = await authService.verifyPasswordResetOtp(email, otp, reqInfo);
    res.json({ message: "OTP verified", resetToken });
});

export const resetPassword = catchAsync(async (req, res, next) => {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) throw new AppError("Token and new password are required", 400);

    await authService.executePasswordReset(resetToken, newPassword);
    res.json({ message: "Password reset successfully. You can now login." });
});

export const refreshToken = catchAsync(async (req, res, next) => {
    const currentRefreshToken = req.cookies.refreshToken;

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown'
    };

    try {
        const { accessToken, refreshToken: newRefreshToken, rememberMe } = await authService.refreshAuthTokens(currentRefreshToken, reqInfo);

        const cookieOptions = {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: 'Lax',
            path: '/'
        };

        if (rememberMe === true) {
            cookieOptions.maxAge = REFRESH_TOKEN_COOKIE_MAX_AGE;
        }

        res.cookie('refreshToken', newRefreshToken, cookieOptions);

        res.json({ accessToken });
    } catch (err) {
        res.clearCookie('refreshToken', { path: '/' });
        throw err; // Passed to the global error handler which will send the AppError
    }
});

export const getCurrentUser = catchAsync(async (req, res, next) => {
    // `req.user` comes from authenticateJWT middleware
    const user = await authService.getCurrentUser(req.user.user_id, req.user.user_type);
    res.json(user);
});

export const logout = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;
    await authService.logoutUser(refreshToken);

    res.clearCookie("refreshToken", { path: '/' });
    res.json({ message: "Logged out successfully" });
});

export const onboardOrganization = catchAsync(async (req, res, next) => {
    const {
        org_name, org_code, contact_name, contact_email, contact_phone,
        admin_name, admin_email, admin_phone, admin_password,
        address, industry, tax_identity, tax_code, max_users
    } = req.body;

    if (!org_name || !org_code) {
        throw new AppError("Organization name and code are required.", 400);
    }

    const cleanOrgCode = org_code.trim().toUpperCase();
    if (cleanOrgCode.length < 3 || cleanOrgCode.length > 10 || !/^[A-Z0-9]+$/.test(cleanOrgCode)) {
        throw new AppError("Organization code must be 3-10 alphanumeric characters with no spaces.", 400);
    }

    if (!contact_name || !contact_email || !contact_phone) {
        throw new AppError("Primary contact details (name, email, phone) are required.", 400);
    }

    const finalAdminEmail = admin_email || contact_email;
    const finalAdminPassword = admin_password;
    if (!finalAdminEmail || !finalAdminPassword) {
        throw new AppError("Admin email and password are required.", 400);
    }
    if (finalAdminPassword.length < 6) {
        throw new AppError("Admin password must be at least 6 characters.", 400);
    }

    // Check uniqueness
    const existingOrg = await attendanceDB('organizations').where('org_code', cleanOrgCode).first();
    if (existingOrg) {
        throw new AppError("Organization code is already registered.", 400);
    }

    const existingUser = await attendanceDB('users').where('email', finalAdminEmail).first();
    if (existingUser) {
        throw new AppError("Administrator email is already registered.", 400);
    }

    const subscription_expiry = new Date();
    subscription_expiry.setDate(subscription_expiry.getDate() + 30); // 30-day trial

    const notesObj = {
        address: address || null,
        industry: industry || null,
        tax_identity: tax_identity || null,
        tax_code: tax_code || null,
        onboarded_via: 'showcase_self_onboarding',
        onboarded_at: new Date().toISOString()
    };

    const insertedId = await attendanceDB.transaction(async (trx) => {
        const [orgId] = await trx('organizations').insert({
            org_name: org_name.trim(),
            org_code: cleanOrgCode,
            contact_name: contact_name.trim(),
            contact_email: contact_email.trim().toLowerCase(),
            contact_phone: contact_phone.trim(),
            subscription_plan: 'Trial',
            subscription_expiry,
            is_trial: 1,
            status: 'active',
            max_users: max_users || 50,
            last_user_number: 1,
            notes: JSON.stringify(notesObj)
        });

        const hashedPassword = await bcrypt.hash(finalAdminPassword, 10);
        const userCode = `${cleanOrgCode}001`;

        await trx('users').insert({
            org_id: orgId,
            user_code: userCode,
            user_name: (admin_name || contact_name).trim(),
            email: finalAdminEmail.trim().toLowerCase(),
            phone_no: admin_phone || contact_phone || null,
            user_password: hashedPassword,
            user_type: 'admin',
            is_active: true,
            is_deleted: false
        });

        return orgId;
    });

    res.status(201).json({
        success: true,
        message: "Organization self-onboarded successfully.",
        org_id: insertedId,
        user_code: `${cleanOrgCode}001`,
        email: finalAdminEmail.trim().toLowerCase()
    });
});

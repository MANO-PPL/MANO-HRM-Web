import catchAsync from '../../utils/catchAsync.js';
import * as authService from './authService.js';
import AppError from '../../utils/AppError.js';
import { attendanceDB } from '../../config/database.js';
import bcrypt from 'bcrypt';
import { extractDeviceInfo } from '../../utils/deviceParser.js';

// ==========================================
// CONFIGURATION & HELPERS
// ==========================================

const REFRESH_TOKEN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 Days (Standard User)
const SUPER_ADMIN_COOKIE_MAX_AGE = 30 * 60 * 1000;             // 30 Minutes (SuperAdmin AFK / Inactivity timeout)
const IS_PROD = process.env.NODE_ENV === 'production';

// The mobile apps send the refresh token in the body or X-Refresh-Token header,
// the web app as an httpOnly cookie. A token sent explicitly wins: an app's
// cookie store may still hold a cookie from an earlier login.
const readRefreshToken = (req) =>
    req.body?.refreshToken || req.headers['x-refresh-token'] || req.cookies.refreshToken || null;


// ==========================================
// 1. STANDARD USER AUTHENTICATION
// ==========================================

export const login = catchAsync(async (req, res, next) => {
    const { user_input, user_password, captchaToken, rememberMe } = req.body;

    if (!user_input || !user_password) {
        throw new AppError("Username and password are required.", 400);
    }

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown',
        deviceInfo: extractDeviceInfo(req)
    };

    const isRememberMe = rememberMe === undefined ? true : (rememberMe === true || rememberMe === 'true');

    const { accessToken, refreshToken, user } = await authService.authenticateUser(user_input, user_password, reqInfo, isRememberMe);

    const cookieOptions = {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'Lax',
        path: '/'
    };

    if (isRememberMe) {
        cookieOptions.maxAge = REFRESH_TOKEN_COOKIE_MAX_AGE;
    }

    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.status(200).json({ accessToken, refreshToken, user });
});

export const getCurrentUser = catchAsync(async (req, res, next) => {
    // req.user comes from authenticateJWT middleware
    const user = await authService.getCurrentUser(req.user.user_id, req.user.user_type);
    res.json(user);
});

export const logout = catchAsync(async (req, res, next) => {
    const refreshToken = readRefreshToken(req);
    await authService.logoutUser(refreshToken);

    res.clearCookie("refreshToken", { path: '/' });
    res.json({ message: "Logged out successfully" });
});


// ==========================================
// 2. SUPER ADMIN AUTHENTICATION
// ==========================================

export const superAdminLogin = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new AppError("Email and password are required.", 400);
    }

    const reqInfo = { ip: req.clientIp || req.ip, userAgent: req.get('User-Agent') || 'Unknown' };
    const { accessToken, refreshToken, user } = await authService.authenticateSuperAdmin(email, password, reqInfo);

    // SuperAdmin uses a short-lived 30-minute session cookie that slides if active
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'Lax',
        maxAge: SUPER_ADMIN_COOKIE_MAX_AGE,
        path: '/'
    });

    res.status(200).json({ accessToken, refreshToken, user });
});


// ==========================================
// 3. TOKEN REFRESH & SESSION LIFECYCLE
// ==========================================

export const refreshToken = catchAsync(async (req, res, next) => {
    const currentRefreshToken = readRefreshToken(req);

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown',
        deviceInfo: extractDeviceInfo(req)
    };

    try {
        const { accessToken, refreshToken: newRefreshToken, rememberMe, isSuperAdmin } = await authService.refreshAuthTokens(currentRefreshToken, reqInfo);

        const cookieOptions = {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: 'Lax',
            path: '/'
        };

        if (isSuperAdmin) {
            cookieOptions.maxAge = SUPER_ADMIN_COOKIE_MAX_AGE;
        } else if (rememberMe === true || rememberMe === 'true') {
            cookieOptions.maxAge = REFRESH_TOKEN_COOKIE_MAX_AGE;
        }

        res.cookie('refreshToken', newRefreshToken, cookieOptions);
        res.json({ accessToken, refreshToken: newRefreshToken });
    } catch (err) {
        if (err.statusCode === 401 || err.statusCode === 403) {
            res.clearCookie('refreshToken', { path: '/' });
        }
        throw err;
    }
});


// ==========================================
// 4. PASSWORD RECOVERY & MANAGEMENT
// ==========================================

export const requestPasswordReset = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    if (!email) throw new AppError("Email is required", 400);

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown'
    };

    await authService.validatePasswordResetRequest(email, reqInfo);
    res.json({ message: "If an account exists for this email, a verification code has been sent to it" });
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

export const changePassword = catchAsync(async (req, res, next) => {
    const { newPassword } = req.body;
    const userId = req.user.user_id || req.user.id;

    if (!newPassword) {
        throw new AppError("New password is required", 400);
    }

    const currentRefreshToken = readRefreshToken(req);
    await authService.changePassword(userId, newPassword, currentRefreshToken, req.user.sid);

    res.status(200).json({
        success: true,
        message: "Password changed successfully."
    });
});


// ==========================================
// 5. USER ACTIVE SESSIONS (SELF-SERVICE)
// ==========================================

export const getUserSessions = catchAsync(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const userId = req.user.user_id || req.user.id;
    const currentRefreshToken = req.cookies.refreshToken || req.headers['x-refresh-token'];
    const currentSessionId = req.user?.sid;
    const sessions = await authService.getUserActiveSessions(userId, currentRefreshToken, currentSessionId);
    res.status(200).json({
        status: 'success',
        data: sessions
    });
});

export const revokeUserSession = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id || req.user.id;
    const { id } = req.params;
    const result = await authService.revokeUserSession(userId, Number(id));
    res.status(200).json({
        status: 'success',
        message: result.message
    });
});

export const revokeOtherUserSessions = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id || req.user.id;
    const currentRefreshToken = req.cookies.refreshToken || req.headers['x-refresh-token'];
    const currentSessionId = req.user?.sid;
    const result = await authService.revokeOtherUserSessions(userId, currentRefreshToken, currentSessionId);
    res.status(200).json({
        status: 'success',
        count: result.count,
        message: result.message
    });
});


// ==========================================
// 6. ORGANIZATION SELF-ONBOARDING
// ==========================================

export const onboardOrganization = catchAsync(async (req, res, next) => {
    const {
        org_name, org_code, contact_name, contact_email, contact_phone,
        admin_name, admin_email, admin_phone, admin_password,
        gst_number, pan_number, max_users,
        country, state, city
    } = req.body;

    if (!org_name || !org_code) {
        throw new AppError("Organization name and code are required.", 400);
    }

    const cleanOrgCode = org_code.trim().toUpperCase();
    if (cleanOrgCode.length < 3 || cleanOrgCode.length > 10 || !/^[A-Z]+$/.test(cleanOrgCode)) {
        throw new AppError("Organization code must be 3-10 alphabetical characters (letters only) with no spaces.", 400);
    }

    if (!contact_name || !contact_email || !contact_phone) {
        throw new AppError("Primary contact details (name, email, phone) are required.", 400);
    }

    if (!country || typeof country !== 'string' || country.trim().length !== 2) {
        throw new AppError("A valid 2-character country code is required.", 400);
    }
    if (!state || typeof state !== 'string' || state.trim().length === 0) {
        throw new AppError("State code is required.", 400);
    }
    if (!city || typeof city !== 'string' || city.trim().length === 0) {
        throw new AppError("City name is required.", 400);
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
    const existingOrg = await attendanceDB('core_organizations').where('org_code', cleanOrgCode).first();
    if (existingOrg) {
        throw new AppError("Organization code is already registered.", 400);
    }

    const existingUser = await attendanceDB('core_users').where('email', finalAdminEmail).first();
    if (existingUser) {
        throw new AppError("Administrator email is already registered.", 400);
    }

    const finalPhone = admin_phone || contact_phone;
    if (finalPhone) {
        const existingPhone = await attendanceDB('core_users').where('phone_no', finalPhone.trim()).first();
        if (existingPhone) {
            throw new AppError("Administrator phone number is already registered.", 400);
        }
    }

    const subscription_expiry = new Date();
    subscription_expiry.setDate(subscription_expiry.getDate() + 30); // 30-day trial

    const insertedId = await attendanceDB.transaction(async (trx) => {
        const [orgId] = await trx('core_organizations').insert({
            org_name: org_name.trim(),
            org_code: cleanOrgCode,
            contact_name: contact_name.trim(),
            contact_email: contact_email.trim().toLowerCase(),
            contact_phone: contact_phone.trim(),
            subscription_plan: 'Trial',
            subscription_expiry,
            is_trial: 1,
            status: 'pending_approval',
            max_users: max_users || 50,
            last_user_number: 1,
            gst_number: gst_number || null,
            pan_number: pan_number || null,
            country: country || null,
            state: state || null,
            city: city || null
        });

        const hashedPassword = await bcrypt.hash(finalAdminPassword, 10);
        const userCode = `${cleanOrgCode}-001`;

        await trx('core_users').insert({
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
        user_code: `${cleanOrgCode}-001`,
        email: finalAdminEmail.trim().toLowerCase()
    });
});

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { attendanceDB } from '../../config/database.js';
import EventBus from '../../utils/EventBus.js';
import AppError from '../../utils/AppError.js';
import * as TokenService from './tokenService.js';
import { evaluateOrgStatus } from '../organisations/orgAccessPolicy.js';
import OtpService from './OtpService.js';
import { sendEmail } from './emailService.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

// Reset tokens are signed with their own key so they can never be accepted as
// access tokens. JWT_RESET_SECRET is optional; by default a key is derived
// from JWT_SECRET, which avoids a new required env var on deploy.
const getResetTokenSecret = () =>
    process.env.JWT_RESET_SECRET ||
    crypto.createHmac('sha256', process.env.JWT_SECRET).update('password-reset').digest('hex');

// Reset tokens are single-use: the jti is remembered until the token expires.
// In-memory is enough for the single PM2 instance this system runs on.
const usedResetTokenIds = new Map(); // jti -> expiry (ms)

function consumeResetTokenId(jti, expSeconds) {
    const now = Date.now();
    for (const [id, expiry] of usedResetTokenIds) {
        if (expiry < now) usedResetTokenIds.delete(id);
    }
    if (!jti || usedResetTokenIds.has(jti)) return false;
    usedResetTokenIds.set(jti, expSeconds * 1000);
    return true;
}

export const authenticateUser = async (userInput, password, reqInfo, rememberMe = false) => {
    const user = await attendanceDB('core_users')
        .leftJoin('org_departments', 'core_users.dept_id', 'org_departments.dept_id')
        .leftJoin('org_designations', 'core_users.desg_id', 'org_designations.desg_id')
        .leftJoin('org_shifts', 'core_users.shift_id', 'org_shifts.shift_id')
        .leftJoin('core_organizations', 'core_users.org_id', 'core_organizations.org_id')
        .select(
            'core_users.user_id', 'core_users.user_code', 'core_users.user_name', 'core_users.user_password', 'core_users.email', 'core_users.phone_no', 'core_users.org_id', 'core_users.user_type',
            'core_users.profile_image_url', 'core_users.is_active', 'core_users.is_deleted', 'core_users.force_password_change',
            'org_departments.dept_name', 'org_designations.desg_name', 'org_shifts.shift_name', 'org_shifts.shift_id',
            'core_organizations.status as org_status', 'core_organizations.max_users as org_max_users',
            'core_organizations.subscription_expiry as org_subscription_expiry',
            'core_organizations.grace_period_days as org_grace_period_days'
        )
        .where('core_users.email', userInput)
        .orWhere('core_users.phone_no', userInput)
        .first();

    if (!user) throw new AppError('User not found', 401);

    // Check Organization Status (Bypass for admin users so they can renew subs, unless pending_deletion/deleted)
    let isOrgExpired = false;
    let orgStatus = 'active';
    if (user.org_id) {
        if (!user.org_status || user.org_status === 'pending_deletion') {
            throw new AppError('Access Denied: Your organization has been deleted or is scheduled for deletion.', 403);
        }
        
        const evaluated = evaluateOrgStatus({
            status: user.org_status,
            subscription_expiry: user.org_subscription_expiry,
            grace_period_days: user.org_grace_period_days,
        });
        isOrgExpired = evaluated.isExpired;
        orgStatus = evaluated.status;

        if (orgStatus !== 'active' && user.user_type !== 'admin') {
            throw new AppError(`Login blocked: Your organization account is currently ${orgStatus}. Please contact support.`, 403);
        }
    }

    if (user.is_deleted) throw new AppError('Your account has been deleted. Please contact support.', 403);
    if (!user.is_active) throw new AppError('Your account is inactive. Please contact HR.', 403);

    const isMatch = await bcrypt.compare(password, user.user_password);
    if (!isMatch) throw new AppError('Incorrect Password', 401);

    const isForcePasswordChange = user.force_password_change === 1 || user.force_password_change === '1' || user.force_password_change === true || user.force_password_change === 'true';

    const tokenPayload = {
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        user_type: user.user_type,
        org_id: user.org_id,
        profile_image_url: user.profile_image_url,
        force_password_change: isForcePasswordChange
    };

    const refreshToken = TokenService.generateRefreshToken();
    const sessionId = await TokenService.saveRefreshToken(user.user_id, refreshToken, reqInfo.ip, reqInfo.userAgent, rememberMe);

    // sid identifies this login session (see changePassword)
    const accessToken = jwt.sign({ ...tokenPayload, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    try {
        EventBus.emitActivityLog({
            user_id: user.user_id,
            org_id: user.org_id,
            event_type: "LOGIN",
            event_source: "API",
            object_type: "USER",
            object_id: user.user_id,
            description: "User logged in successfully",
            request_ip: reqInfo.ip,
            user_agent: reqInfo.userAgent
        });
    } catch (err) {
        console.error("Failed to log login activity:", err);
    }

    return {
        accessToken,
        refreshToken, // To be set in cookie by Controller
        user: {
            id: user.user_id,
            user_code: user.user_code,
            user_name: user.user_name,
            email: user.email,
            phone: user.phone_no,
            user_type: user.user_type,
            designation: user.desg_name,
            department: user.dept_name,
            org_id: user.org_id,
            profile_image_url: user.profile_image_url,
            org_max_users: user.org_max_users,
            force_password_change: isForcePasswordChange,
            isOrgExpired: isOrgExpired,
            org_status: orgStatus
        }
    };
};

export const authenticateSuperAdmin = async (email, password, reqInfo) => {
    const admin = await attendanceDB('core_super_admins').where('email', email).first();
    if (!admin) throw new AppError('Invalid credentials', 401);
    if (!admin.is_active) throw new AppError('Your account is inactive.', 403);

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) throw new AppError('Invalid credentials', 401);

    const tokenPayload = {
        user_id: admin.id,
        user_name: admin.name,
        email: admin.email,
        user_type: 'super_admin'
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshTokenPayload = { id: admin.id, user_type: 'super_admin_refresh' };
    const refreshToken = jwt.sign(refreshTokenPayload, process.env.JWT_REFRESH_SECRET, { expiresIn: '12h' });

    try {
        EventBus.emitActivityLog({
            user_id: admin.id,
            org_id: null,
            event_type: "LOGIN",
            event_source: "API",
            object_type: "ADMIN",
            object_id: admin.id,
            description: "Super Admin logged in",
            request_ip: reqInfo.ip,
            user_agent: reqInfo.userAgent
        });
    } catch (err) { }

    return {
        accessToken,
        refreshToken,
        user: {
            id: admin.id,
            user_name: admin.name,
            email: admin.email,
            user_type: 'super_admin',
        }
    };
};

export const refreshAuthTokens = async (refreshToken, reqInfo) => {
    if (!refreshToken) throw new AppError("No refresh token provided", 401, "NO_REFRESH_TOKEN");

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
        if (decoded.user_type === 'super_admin_refresh') {
            const admin = await attendanceDB('core_super_admins').where('id', decoded.id).first();
            if (!admin || !admin.is_active) throw new AppError('Admin inactive or deleted', 403, "ADMIN_INACTIVE");

            const tokenPayload = {
                user_id: admin.id,
                user_name: admin.name,
                email: admin.email,
                user_type: 'super_admin'
            };
            const newAccessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
            const newRefreshToken = jwt.sign({ id: admin.id, user_type: 'super_admin_refresh' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '12h' });
            return { accessToken: newAccessToken, refreshToken: newRefreshToken, rememberMe: false };
        }
    } catch (err) {
        if (err.name === 'TokenExpiredError') throw new AppError("Session expired. Please re-login.", 401, "SESSION_EXPIRED");
        // Important: if jwt.verify failed for other reasons (e.g standard user's non-jwt token), let it fall through
    }

    const result = await TokenService.verifyRefreshToken(refreshToken);

    if (!result) throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");

    // The user was deactivated or deleted; their sessions have been ended
    if (result.error) throw new AppError("Your account is inactive or has been deleted. Please contact HR.", 401, "ACCOUNT_INACTIVE");

    const { user, refreshTokenRecord } = result;

    if (user.org_id) {
        const org = await attendanceDB('core_organizations').where('org_id', user.org_id).first();
        if (!org || org.status === 'pending_deletion') {
            throw new AppError('Access Denied: Your organization has been deleted or is scheduled for deletion.', 403, "ORG_DELETED");
        }

        const { status: orgStatus } = evaluateOrgStatus(org);

        if (orgStatus !== 'active' && user.user_type !== 'admin') {
            throw new AppError(`Access Denied: Your organization account is currently ${orgStatus}.`, 403, "ORG_INACTIVE");
        }
    }

    // Sliding Session: Instead of rotating the token, just extend its expiry
    await TokenService.extendRefreshToken(refreshToken);
    const newRefreshToken = refreshToken;

    const tokenPayload = {
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        user_type: user.user_type,
        org_id: user.org_id,
        profile_image_url: user.profile_image_url,
        force_password_change: user.force_password_change === 1 || user.force_password_change === '1' || user.force_password_change === true || user.force_password_change === 'true'
    };

    const newAccessToken = jwt.sign({ ...tokenPayload, sid: refreshTokenRecord.id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        rememberMe: refreshTokenRecord?.remember_me == 1 || refreshTokenRecord?.remember_me === true
    };
};

export const getCurrentUser = async (userId, userType) => {
    if (userType === 'super_admin') {
        const admin = await attendanceDB('core_super_admins').where('id', userId).first();
        if (!admin) throw new AppError("Admin not found", 404);
        return {
            user_id: admin.id,
            user_name: admin.name,
            email: admin.email,
            user_type: 'super_admin',
            org_id: null,
            profile_image_url: null
        };
    }

    const user = await attendanceDB('core_users')
        .leftJoin('core_organizations', 'core_users.org_id', 'core_organizations.org_id')
        .where('core_users.user_id', userId)
        .select(
            'core_users.user_code', 'core_users.user_name', 'core_users.email', 'core_users.user_type', 'core_users.org_id', 'core_users.profile_image_url', 'core_users.force_password_change',
            'core_users.tour_dismissed', 'core_users.pages_tour_seen',
            'core_organizations.max_users as org_max_users',
            'core_organizations.status as org_status',
            'core_organizations.subscription_expiry as org_subscription_expiry',
            'core_organizations.grace_period_days as org_grace_period_days'
        )
        .first();

    if (!user) throw new AppError("User not found", 404);

    const { status: orgStatus, isExpired: isOrgExpired } = user.org_id
        ? evaluateOrgStatus({
            status: user.org_status,
            subscription_expiry: user.org_subscription_expiry,
            grace_period_days: user.org_grace_period_days,
        })
        : { status: user.org_status, isExpired: false };

    // Parse pages_tour_seen from JSON string to object (stored as JSON in DB)
    let pagesTourSeen = {};
    if (user.pages_tour_seen) {
        try {
            pagesTourSeen = typeof user.pages_tour_seen === 'string'
                ? JSON.parse(user.pages_tour_seen)
                : user.pages_tour_seen;
        } catch {
            pagesTourSeen = {};
        }
    }
    return {
        user_code: user.user_code,
        user_name: user.user_name,
        email: user.email,
        user_type: user.user_type,
        org_id: user.org_id,
        profile_image_url: user.profile_image_url,
        org_max_users: user.org_max_users,
        user_id: userId,
        force_password_change: user.force_password_change === 1 || user.force_password_change === '1' || user.force_password_change === true || user.force_password_change === 'true',
        isOrgExpired: isOrgExpired,
        org_status: orgStatus,
        tour_dismissed: user.tour_dismissed === 1 || user.tour_dismissed === '1' || user.tour_dismissed === true || user.tour_dismissed === 'true',
        pages_tour_seen: pagesTourSeen,
    };
};

export const logoutUser = async (refreshToken) => {
    if (refreshToken) {
        await TokenService.revokeRefreshToken(refreshToken);
    }
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Answers the same way whether or not the email belongs to an account, so the
// endpoint cannot be used to find out which emails are registered.
export const validatePasswordResetRequest = async (email, reqInfo) => {
    const user = await attendanceDB('core_users').where('email', email).first();
    if (!user) return;

    // Construct mock req object for backward compatibility with OtpService
    const mockReq = { headers: { "user-agent": reqInfo.userAgent }, clientIp: reqInfo.ip, ip: reqInfo.ip };
    const otp = OtpService.generateOtp(email, mockReq);

    const userName = user.user_name || 'there';
    const emailHtml = `
  <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
      <h2>Secure Your Account</h2>
      <p>Hi ${escapeHtml(userName)},</p>
      <p>We received a request to reset your password. Please use the following code to continue:</p>
      <h1 style="color: #4F46E5; letter-spacing: 5px;">${otp}</h1>
      <p>This code is valid for 5 minutes.</p>
  </div>`;

    const emailResult = await sendEmail({
        to: email,
        subject: "Secure your account - Mano Attendance System",
        text: `Hi ${userName}, your verification code is ${otp}. It remains valid for 5 minutes.`,
        html: emailHtml
    });

    if (!emailResult.ok) throw new AppError("Failed to send email. Please try again later.", 500);
};

export const verifyPasswordResetOtp = async (email, otp, reqInfo) => {
    const mockReq = { headers: { "user-agent": reqInfo.userAgent }, clientIp: reqInfo.ip, ip: reqInfo.ip };
    const isValid = OtpService.verifyOtp(email, otp, mockReq);

    if (!isValid) throw new AppError("Invalid or expired OTP", 400);

    const user = await attendanceDB('core_users').where('email', email).first();
    if (!user) throw new AppError("User not found", 400);

    const resetToken = jwt.sign(
        { user_id: user.user_id, email: user.email, type: "password_reset" },
        getResetTokenSecret(),
        { expiresIn: "5m", jwtid: crypto.randomUUID() }
    );

    return resetToken;
};

export const executePasswordReset = async (resetToken, newPassword) => {
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
        throw new AppError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`, 400);
    }

    let decoded;
    try {
        decoded = jwt.verify(resetToken, getResetTokenSecret(), { algorithms: ['HS256'] });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new AppError("Reset token has expired. Please request a new OTP.", 403);
        }
        throw new AppError("Invalid or expired reset token", 403);
    }

    if (decoded.type !== "password_reset") throw new AppError("Invalid token type", 403);
    if (!consumeResetTokenId(decoded.jti, decoded.exp)) {
        throw new AppError("This reset link has already been used. Please request a new OTP.", 403);
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await attendanceDB("core_users").where("user_id", decoded.user_id).update({ user_password: hashedPassword });

    // A reset means the old password may be compromised: end every session
    await TokenService.revokeAllTokensForUser(decoded.user_id);

    return true;
};

export const changePassword = async (userId, newPassword, currentRefreshToken = null, currentSessionId = null) => {
    if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
        throw new AppError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`, 400);
    }
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await attendanceDB("core_users").where({ user_id: userId }).update({
        user_password: hashedPassword,
        force_password_change: false
    });

    // Sign out all other devices; keep the session that made the change
    await TokenService.revokeAllTokensForUser(userId, { except: currentRefreshToken, exceptSessionId: currentSessionId });
    return true;
};

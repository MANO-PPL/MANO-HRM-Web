/**
 * TokenService - Backward-compatibility wrapper delegating to `sessionService.js`.
 * All session and refresh token operations are consolidated into `sessionService.js`.
 */
import * as sessionService from './sessionService.js';

export const hashRefreshToken = sessionService.hashRefreshToken;
export const generateRefreshToken = sessionService.generateToken;

export async function saveRefreshToken(userId, token, ipAddress, userAgent, rememberMe = false, deviceInfo = null) {
    return await sessionService.createSession({
        userId,
        token,
        ipAddress,
        userAgent,
        rememberMe,
        deviceInfo
    });
}

export async function verifyRefreshToken(token) {
    const result = await sessionService.validateSession(token);
    if (!result) return null;
    if (result.error) return result;
    return {
        user: result.user,
        refreshTokenRecord: result.session
    };
}

export async function extendRefreshToken(token, reqInfo = null) {
    return await sessionService.extendSession(token, reqInfo);
}

export async function revokeRefreshToken(token) {
    return await sessionService.revokeSession({ token, reason: 'logout' });
}

export async function revokeAllTokensForUser(userId, { except = null, exceptSessionId = null } = {}) {
    return await sessionService.revokeAllSessions(userId, {
        exceptToken: except,
        exceptSessionId,
        reason: 'password_change_or_reset'
    });
}

export async function getUserActiveSessions(userId, currentRefreshToken = null) {
    return await sessionService.listSessions({
        userId,
        currentToken: currentRefreshToken
    });
}

export async function revokeUserSession(userId, sessionId) {
    return await sessionService.revokeSession({
        sessionId,
        userId,
        reason: 'user_self_service'
    });
}

export async function revokeOtherUserSessions(userId, currentRefreshToken) {
    return await sessionService.revokeAllSessions(userId, {
        exceptToken: currentRefreshToken,
        reason: 'revoke_other_sessions'
    });
}

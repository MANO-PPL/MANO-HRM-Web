import crypto from 'crypto';
import { attendanceDB } from '../../config/database.js';
import { toMySQLDateTime } from '../../utils/dateUtils.js';

/**
 * Refresh tokens are stored as SHA-256 hashes, so a leaked database or backup
 * cannot be used to sign in. The client keeps the token itself; every lookup
 * hashes what the client sends.
 * @param {string} token
 * @returns {string}
 */
export const hashRefreshToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Finds the row for a token. Rows saved before tokens were hashed hold the
 * token itself; such a row is converted to the hash when first used (the
 * migration 20261001120000 converts the rest).
 */
async function findTokenRow(token) {
    const hashed = hashRefreshToken(token);
    const row = await attendanceDB('core_refresh_tokens').where({ token: hashed }).first();
    if (row) return row;

    const legacy = await attendanceDB('core_refresh_tokens').where({ token: String(token) }).first();
    if (!legacy) return null;
    await attendanceDB('core_refresh_tokens').where({ id: legacy.id }).update({ token: hashed });
    return { ...legacy, token: hashed };
}

/**
 * Generate a cryptographically strong random token
 * @returns {string}
 */
export function generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
}

/**
 * Save a refresh token to the database
 * @param {number} userId 
 * @param {string} token 
 * @param {string} ipAddress 
 * @param {string} userAgent 
 * @param {boolean} rememberMe
 * @returns {Promise<number>} the session (row) id, carried in access tokens as `sid`
 */
export async function saveRefreshToken(userId, token, ipAddress, userAgent, rememberMe = false) {
    const expiresAt = new Date();
    const validityDays = rememberMe ? 30 : 30;
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    const [sessionId] = await attendanceDB('core_refresh_tokens').insert({
        user_id: userId,
        token: hashRefreshToken(token),
        expires_at: toMySQLDateTime(expiresAt),
        ip_address: ipAddress,
        user_agent: userAgent,
        remember_me: rememberMe ? 1 : 0
    });
    return sessionId;
}

/**
 * Verify a refresh token and return the associated user
 * @param {string} token 
 * @returns {Promise<{user: any, refreshToken: any} | null>}
 */
export async function verifyRefreshToken(token) {
    const refreshTokenRecord = await findTokenRow(token);

    if (!refreshTokenRecord) {
        // Token not found
        return null;
    }

    if (refreshTokenRecord.revoked) {
        // Ended by logout or a password change. Only this session is refused:
        // tokens are not rotated, so a revoked token being sent again (e.g. by
        // a request still in flight at logout) is not a sign of theft, and
        // must not sign the user out of their other devices.
        return null;
    }

    if (new Date() > new Date(refreshTokenRecord.expires_at)) {
        // Token expired
        return null;
    }

    // Token is valid, return user details
    const user = await attendanceDB('core_users').where('user_id', refreshTokenRecord.user_id).first();

    if (!user || !user.is_active || user.is_deleted) {
        // Revoke if user is blocked
        await revokeAllTokensForUser(refreshTokenRecord.user_id);
        return { error: 'User Blocked or Deleted' };
    }

    return { user, refreshTokenRecord };
}

/**
 * Revoke a specific refresh token (used on logout)
 * @param {string} token 
 */
export async function revokeRefreshToken(token) {
    const row = await findTokenRow(token);
    if (!row) return;
    await attendanceDB('core_refresh_tokens')
        .where({ id: row.id })
        .update({ revoked: true });
}

/**
 * Revoke all tokens for a user (e.g. change password)
 * @param {number} userId
 * @param {{ except?: string|null, exceptSessionId?: number|null }} options the
 *   caller's own session, to keep active: by refresh token (web sends it as a
 *   cookie) or by session id (the `sid` claim of the access token, for apps
 *   that do not send the refresh token with every request)
 */
export async function revokeAllTokensForUser(userId, { except = null, exceptSessionId = null } = {}) {
    const query = attendanceDB('core_refresh_tokens').where('user_id', userId);
    // Both forms: the caller's row may not have been converted to the hash yet
    if (except) query.whereNotIn('token', [hashRefreshToken(except), String(except)]);
    if (exceptSessionId) query.whereNot('id', exceptSessionId);
    await query.update({ revoked: true });
}

/**
 * Extend a refresh token by 30 days from now (Sliding Session)
 * @param {string} token 
 */
export async function extendRefreshToken(token) {
    const record = await findTokenRow(token);
    if (!record) return;

    const isRememberMe = record?.remember_me === 1;
    const expiresAt = new Date();
    const validityDays = isRememberMe ? 30 : 30;
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    await attendanceDB('core_refresh_tokens')
        .where({ id: record.id })
        .update({ expires_at: toMySQLDateTime(expiresAt) });
}

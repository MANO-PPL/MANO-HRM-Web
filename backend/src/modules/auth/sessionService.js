import crypto from 'crypto';
import { attendanceDB } from '../../config/database.js';
import { toMySQLDateTime } from '../../utils/dateUtils.js';
import AppError from '../../utils/AppError.js';
import { extractDeviceInfo, parseUserAgent, getDeterministicDeviceId } from '../../utils/deviceParser.js';

/**
 * SHA-256 token hashing. Raw tokens are never stored in the database.
 * The client holds the raw token and transmits it; the backend hashes on lookup.
 * @param {string} token
 * @returns {string} 64-hex-character SHA-256 hash
 */
export const hashRefreshToken = (token) =>
    crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Generates a cryptographically strong 80-character hex token for client sessions.
 * @returns {string}
 */
export function generateToken() {
    return crypto.randomBytes(40).toString('hex');
}

/**
 * Looks up a session row by token hash, with graceful fallback to legacy plaintext
 * tokens (upgrading the row in place to the SHA-256 hash).
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function findSessionRowByToken(token) {
    if (!token) return null;
    const hashed = hashRefreshToken(token);
    const row = await attendanceDB('sessions').where({ token_hash: hashed }).first();
    if (row) return row;

    // Backward-compatibility: if an unhashed legacy row exists
    const legacy = await attendanceDB('sessions').where({ token_hash: String(token) }).first();
    if (!legacy) return null;

    await attendanceDB('sessions').where({ id: legacy.id }).update({ token_hash: hashed });
    return { ...legacy, token_hash: hashed };
}

/**
 * 1. Create a session row in the consolidated `sessions` table.
 * Preserves per-device deduplication on login:
 * Repeat logins on the same device_id replace that device's row (updating in-place),
 * with NO rotation semantics attached.
 *
 * @param {object} params
 * @param {number} params.userId
 * @param {string} params.token - Raw refresh token (will be SHA-256 hashed)
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {boolean} [params.rememberMe]
 * @param {object} [params.deviceInfo] - Extracted device metadata
 * @returns {Promise<number>} Inserted/updated session ID (carried in access token as `sid`)
 */
export async function createSession({
    userId,
    token,
    ipAddress = '',
    userAgent = '',
    rememberMe = false,
    deviceInfo = null
}) {
    const now = new Date();
    const expiresAt = new Date(now);
    const validityDays = 30; // 30-day sliding session
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    const hashedToken = hashRefreshToken(token);

    // Extract & normalize device info
    let devId = deviceInfo?.deviceId;
    let devName = deviceInfo?.deviceName;
    let metadata = deviceInfo?.metadata;

    if (!devId) {
        devId = getDeterministicDeviceId(userId, userAgent);
    }

    let devType = 'desktop';
    let osName = 'Unknown OS';
    let browserName = 'Unknown Browser';

    if (metadata) {
        devType = metadata.device_type || 'desktop';
        osName = metadata.os || 'Unknown OS';
        browserName = metadata.browser || 'Unknown Browser';
        devName = devName || metadata.device_name || 'Unknown Device';
    } else {
        const parsed = parseUserAgent(userAgent);
        devType = parsed.device_type || 'desktop';
        osName = parsed.os || 'Unknown OS';
        browserName = parsed.browser || 'Unknown Browser';
        devName = devName || parsed.device_label || 'Unknown Device';
    }

    const cleanDeviceId = String(devId).substring(0, 128);
    const cleanDeviceName = String(devName || 'Unknown Device').substring(0, 255);
    const cleanDeviceType = String(devType || 'desktop').substring(0, 50);
    const cleanOs = String(osName || 'Unknown').substring(0, 100);
    const cleanBrowser = String(browserName || 'Browser').substring(0, 100);
    const cleanIp = ipAddress ? String(ipAddress).substring(0, 45) : null;
    const cleanUa = userAgent ? String(userAgent).substring(0, 2000) : null;

    // Per-device dedup on login:
    // If the user already has an active session on this exact device_id,
    // replace that device's row — treat this purely as extending/replacing
    // that one session, with no rotation semantics attached to it.
    try {
        const existingSession = await attendanceDB('sessions')
            .where({ user_id: userId, device_id: cleanDeviceId, revoked: 0 })
            .where('expires_at', '>', now)
            .orderBy('created_at', 'desc')
            .first();

        if (existingSession) {
            await attendanceDB('sessions')
                .where({ id: existingSession.id })
                .update({
                    token_hash: hashedToken,
                    device_name: cleanDeviceName,
                    device_type: cleanDeviceType,
                    os: cleanOs,
                    browser: cleanBrowser,
                    ip_address: cleanIp || existingSession.ip_address,
                    expires_at: toMySQLDateTime(expiresAt),
                    last_used_at: toMySQLDateTime(now),
                    remember_me: rememberMe ? 1 : 0,
                    user_agent: cleanUa,
                    revoked: 0,
                    revoked_at: null,
                    revoked_reason: null
                });
            return existingSession.id;
        }
    } catch (e) {
        console.warn('[sessionService] Device deduplication check warning:', e.message);
    }

    // Insert new session row
    const [sessionId] = await attendanceDB('sessions').insert({
        user_id: userId,
        token_hash: hashedToken,
        device_id: cleanDeviceId,
        device_name: cleanDeviceName,
        device_type: cleanDeviceType,
        os: cleanOs,
        browser: cleanBrowser,
        ip_address: cleanIp,
        created_at: toMySQLDateTime(now),
        last_used_at: toMySQLDateTime(now),
        expires_at: toMySQLDateTime(expiresAt),
        revoked: 0,
        revoked_at: null,
        revoked_reason: null,
        remember_me: rememberMe ? 1 : 0,
        user_agent: cleanUa
    });

    return sessionId;
}

/**
 * 2. Validate a session by refresh token.
 * Scope restriction: Never cascades or revokes other sessions on revoked tokens.
 *
 * @param {string} token - Raw refresh token
 * @returns {Promise<{user: object, session: object}|{error: string}|null>}
 */
export async function validateSession(token) {
    if (!token) return null;

    const session = await findSessionRowByToken(token);
    if (!session) return null;

    // Ended by logout, single-device revoke, or password change.
    // Must NOT cascade or revoke any other session.
    if (session.revoked) {
        return null;
    }

    // Expiry check
    if (new Date() > new Date(session.expires_at)) {
        return null;
    }

    // Check account status
    const user = await attendanceDB('core_users').where('user_id', session.user_id).first();
    if (!user || !user.is_active || user.is_deleted) {
        return { error: 'User Blocked or Deleted' };
    }

    return { user, session };
}

/**
 * 3. Extend session expiry (Sliding Session) and update active IP & last_used_at.
 * Seamless network migration (Wi-Fi to LTE) without session drops.
 *
 * @param {string} token - Raw refresh token
 * @param {object} [reqInfo] - Optional request info (ip, userAgent)
 * @returns {Promise<boolean>}
 */
export async function extendSession(token, reqInfo = null) {
    if (!token) return false;

    const session = await findSessionRowByToken(token);
    if (!session || session.revoked) return false;

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day sliding extension

    const updateData = {
        expires_at: toMySQLDateTime(expiresAt),
        last_used_at: toMySQLDateTime(now)
    };

    if (reqInfo?.ip) {
        updateData.ip_address = String(reqInfo.ip).substring(0, 45);
    }

    if (reqInfo?.userAgent && !session.user_agent) {
        updateData.user_agent = String(reqInfo.userAgent).substring(0, 2000);
    }

    if ((!session.browser || session.browser === 'Unknown Browser') && (reqInfo?.userAgent || session.user_agent)) {
        const parsed = parseUserAgent(reqInfo?.userAgent || session.user_agent);
        if (parsed.browser && parsed.browser !== 'Unknown Browser') updateData.browser = parsed.browser;
        if (parsed.os && parsed.os !== 'Unknown OS') updateData.os = parsed.os;
        if (parsed.device_type) updateData.device_type = parsed.device_type;
        if (parsed.device_label && (!session.device_name || session.device_name === 'Migrated Device')) {
            updateData.device_name = parsed.device_label;
        }
    }

    await attendanceDB('sessions')
        .where({ id: session.id })
        .update(updateData);

    return true;
}

/**
 * 4. Revoke a single session.
 * Scope constraint: MUST ONLY ever terminate the ONE targeted session.
 *
 * @param {object} target
 * @param {number} [target.sessionId] - Session primary key
 * @param {string} [target.token] - Raw refresh token
 * @param {number} [target.userId] - Optional owner check for user self-service
 * @param {string} [target.reason='manual_revocation']
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function revokeSession({
    sessionId = null,
    token = null,
    userId = null,
    reason = 'manual_revocation'
} = {}) {
    const now = toMySQLDateTime(new Date());

    if (sessionId) {
        const query = attendanceDB('sessions').where({ id: sessionId });
        if (userId) query.where({ user_id: userId });

        const session = await query.first();
        if (!session) {
            throw new AppError('Session not found or already revoked', 404);
        }

        await attendanceDB('sessions')
            .where({ id: sessionId })
            .update({
                revoked: 1,
                revoked_at: now,
                revoked_reason: reason
            });

        return { success: true, message: 'Session revoked successfully' };
    }

    if (token) {
        const session = await findSessionRowByToken(token);
        if (!session) return { success: false, message: 'Session not found' };

        await attendanceDB('sessions')
            .where({ id: session.id })
            .update({
                revoked: 1,
                revoked_at: now,
                revoked_reason: reason
            });

        return { success: true, message: 'Session revoked successfully' };
    }

    throw new AppError('Neither sessionId nor token provided for revocation', 400);
}

/**
 * 5. Revoke all sessions for a user.
 * Scope constraint: The SOLE path that can end multiple sessions at once.
 * Only called explicitly on "sign out everywhere", "sign out all other devices",
 * password reset, or account deletion.
 *
 * @param {number} userId
 * @param {object} [options]
 * @param {string} [options.exceptToken] - Raw refresh token to preserve
 * @param {number} [options.exceptSessionId] - Session ID (`sid`) to preserve
 * @param {string} [options.reason='sign_out_everywhere']
 * @param {object} [options.trx] - Knex transaction object if part of a transaction
 * @returns {Promise<{success: boolean, count: number, message: string}>}
 */
export async function revokeAllSessions(userId, {
    exceptToken = null,
    exceptSessionId = null,
    reason = 'sign_out_everywhere',
    trx = null
} = {}) {
    const db = trx || attendanceDB;
    const now = toMySQLDateTime(new Date());

    let query = db('sessions')
        .where('user_id', userId)
        .where('revoked', 0);

    if (exceptToken) {
        const hashed = hashRefreshToken(exceptToken);
        query = query.whereNotIn('token_hash', [hashed, String(exceptToken)]);
    }

    if (exceptSessionId) {
        query = query.whereNot('id', exceptSessionId);
    }

    const count = await query.update({
        revoked: 1,
        revoked_at: now,
        revoked_reason: reason
    });

    return {
        success: true,
        count,
        message: `Revoked ${count} session(s) successfully`
    };
}

/**
 * Bulk revokes multiple explicit session IDs (used by SuperAdmin bulk action).
 * @param {Array<number>} sessionIds
 * @param {object} [options]
 * @param {string} [options.reason='superadmin_bulk_revoked']
 * @returns {Promise<{success: boolean, count: number, message: string}>}
 */
export async function revokeSessions(sessionIds = [], { reason = 'superadmin_bulk_revoked' } = {}) {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
        throw new AppError('No session IDs provided', 400);
    }

    const now = toMySQLDateTime(new Date());
    const updated = await attendanceDB('sessions')
        .whereIn('id', sessionIds)
        .where('revoked', 0)
        .update({
            revoked: 1,
            revoked_at: now,
            revoked_reason: reason
        });

    return {
        success: true,
        count: updated,
        message: `${updated} sessions revoked successfully`
    };
}

/**
 * 6. List sessions for both:
 *   - The user self-service "Active Devices" UI (`ActiveDevicesManager.jsx`)
 *   - The SuperAdmin session management dashboard (`SessionManagement.jsx`)
 *
 * @param {object} options
 * @returns {Promise<Array|object>}
 */
export async function listSessions(options = {}) {
    const now = new Date();

    // Mode A: User Self-Service Active Devices UI
    if (options.userId && !options.isAdmin) {
        const rows = await attendanceDB('sessions')
            .where('user_id', options.userId)
            .where('revoked', 0)
            .where('expires_at', '>', now)
            .orderBy('last_used_at', 'desc');

        const currentTokenHash = options.currentToken ? hashRefreshToken(options.currentToken) : null;
        const currentSid = options.currentSessionId ? Number(options.currentSessionId) : null;

        return rows.map((row) => {
            let browser = row.browser;
            let os = row.os;
            let devType = row.device_type || 'desktop';
            let devName = row.device_name;

            if ((!browser || browser === 'Unknown Browser' || !os || os === 'Unknown OS') && row.user_agent) {
                const parsed = parseUserAgent(row.user_agent);
                if (parsed.browser && parsed.browser !== 'Unknown Browser') browser = parsed.browser;
                if (parsed.os && parsed.os !== 'Unknown OS') os = parsed.os;
                if (parsed.device_type) devType = parsed.device_type;
                if (parsed.device_label && (!devName || devName === 'Migrated Device' || devName === 'Unknown Device')) {
                    devName = parsed.device_label;
                }
            }

            const isCurrent = Boolean(
                (currentSid && row.id === currentSid) ||
                (currentTokenHash && (row.token_hash === currentTokenHash || row.token_hash === options.currentToken))
            );

            return {
                id: row.id,
                device_id: row.device_id,
                device_name: devName || `${browser || 'Browser'} on ${os || 'Device'}`,
                device_type: devType,
                browser: browser || 'Browser',
                os: os || 'Unknown OS',
                ip_address: row.ip_address || 'Dynamic IP',
                last_active_at: row.last_used_at || row.created_at,
                created_at: row.created_at,
                expires_at: row.expires_at,
                remember_me: Boolean(row.remember_me),
                is_current: isCurrent
            };
        });
    }

    // Mode B: SuperAdmin Session Management Dashboard
    const {
        page = 1,
        limit = 20,
        search = '',
        status = 'all',
        device_type = 'all',
        browser = 'all',
        os = 'all',
        user_type = 'all',
        org_id = 'all',
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = options;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (parsedPage - 1) * parsedLimit;

    let query = attendanceDB('sessions as s')
        .leftJoin('core_users as u', 's.user_id', 'u.user_id')
        .leftJoin('core_organizations as o', 'u.org_id', 'o.org_id')
        .select(
            's.id',
            's.user_id',
            's.token_hash',
            's.device_id',
            's.device_name',
            's.device_type',
            's.os',
            's.browser',
            's.ip_address',
            's.created_at',
            's.last_used_at',
            's.expires_at',
            's.revoked',
            's.revoked_at',
            's.revoked_reason',
            's.remember_me',
            's.user_agent',
            'u.user_name',
            'u.user_code',
            'u.email',
            'u.phone_no',
            'u.user_type',
            'u.profile_image_url',
            'u.is_active as user_is_active',
            'o.org_id',
            'o.org_name',
            'o.org_code'
        );

    let countQuery = attendanceDB('sessions as s')
        .leftJoin('core_users as u', 's.user_id', 'u.user_id')
        .leftJoin('core_organizations as o', 'u.org_id', 'o.org_id');

    // 1. Status Filter
    if (status === 'active') {
        query = query.where('s.revoked', 0).where('s.expires_at', '>', now);
        countQuery = countQuery.where('s.revoked', 0).where('s.expires_at', '>', now);
    } else if (status === 'revoked') {
        query = query.where('s.revoked', 1);
        countQuery = countQuery.where('s.revoked', 1);
    } else if (status === 'expired') {
        query = query.where('s.revoked', 0).where('s.expires_at', '<=', now);
        countQuery = countQuery.where('s.revoked', 0).where('s.expires_at', '<=', now);
    }

    // 2. Device Type Filter
    if (device_type && device_type !== 'all') {
        query = query.where('s.device_type', device_type);
        countQuery = countQuery.where('s.device_type', device_type);
    }

    // 3. Browser Filter
    if (browser && browser !== 'all') {
        const b = browser.toLowerCase();
        if (b === 'mobile_app' || b === 'dart') {
            query = query.where(function() {
                this.where('s.browser', 'like', '%flutter%')
                    .orWhere('s.browser', 'like', '%dart%')
                    .orWhere('s.browser', 'like', '%mobile app%');
            });
            countQuery = countQuery.where(function() {
                this.where('s.browser', 'like', '%flutter%')
                    .orWhere('s.browser', 'like', '%dart%')
                    .orWhere('s.browser', 'like', '%mobile app%');
            });
        } else {
            query = query.where('s.browser', 'like', `%${browser}%`);
            countQuery = countQuery.where('s.browser', 'like', `%${browser}%`);
        }
    }

    // 4. OS Filter
    if (os && os !== 'all') {
        query = query.where('s.os', 'like', `%${os}%`);
        countQuery = countQuery.where('s.os', 'like', `%${os}%`);
    }

    // 5. User Type Filter
    if (user_type && user_type !== 'all') {
        query = query.where('u.user_type', user_type);
        countQuery = countQuery.where('u.user_type', user_type);
    }

    // 6. Organization Filter
    if (org_id && org_id !== 'all') {
        query = query.where('u.org_id', org_id);
        countQuery = countQuery.where('u.org_id', org_id);
    }

    // 7. Search Filter
    if (search && search.trim()) {
        const searchQuery = `%${search.trim()}%`;
        const searchFn = function() {
            this.where('u.user_name', 'like', searchQuery)
                .orWhere('u.email', 'like', searchQuery)
                .orWhere('u.user_code', 'like', searchQuery)
                .orWhere('o.org_name', 'like', searchQuery)
                .orWhere('s.ip_address', 'like', searchQuery)
                .orWhere('s.device_name', 'like', searchQuery)
                .orWhere('s.token_hash', 'like', searchQuery);
        };
        query = query.andWhere(searchFn);
        countQuery = countQuery.andWhere(searchFn);
    }

    // Sorting
    const allowedSortCols = {
        created_at: 's.created_at',
        last_used_at: 's.last_used_at',
        expires_at: 's.expires_at',
        user_name: 'u.user_name'
    };
    const sortCol = allowedSortCols[sortBy] || 's.created_at';
    const sortDir = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(sortCol, sortDir);

    const [rows, totalRes, stats, orgs] = await Promise.all([
        query.limit(parsedLimit).offset(offset),
        countQuery.count('s.id as count').first(),
        getSessionMetrics(),
        attendanceDB('core_organizations').select('org_id', 'org_name').orderBy('org_name', 'asc')
    ]);

    const total = totalRes ? parseInt(totalRes.count, 10) : 0;

    const sessions = rows.map((row) => {
        const isExpired = new Date(row.expires_at) <= now;
        const isRevoked = Boolean(row.revoked);
        const isActive = !isRevoked && !isExpired;

        let statusText = 'active';
        if (isRevoked) statusText = 'revoked';
        else if (isExpired) statusText = 'expired';

        const tokenStr = row.token_hash || '';
        const tokenPreview = tokenStr.length > 16
            ? `${tokenStr.substring(0, 8)}...${tokenStr.substring(tokenStr.length - 8)}`
            : tokenStr;

        let browser = row.browser;
        let os = row.os;
        let osVersion = '';
        let browserVersion = '';
        let devType = row.device_type || 'desktop';
        let devName = row.device_name;

        if ((!browser || browser === 'Unknown Browser' || !os || os === 'Unknown OS') && row.user_agent) {
            const parsed = parseUserAgent(row.user_agent);
            if (parsed.browser && parsed.browser !== 'Unknown Browser') browser = parsed.browser;
            if (parsed.browser_version) browserVersion = parsed.browser_version;
            if (parsed.os && parsed.os !== 'Unknown OS') os = parsed.os;
            if (parsed.os_version) osVersion = parsed.os_version;
            if (parsed.device_type) devType = parsed.device_type;
            if (parsed.device_label && (!devName || devName === 'Migrated Device' || devName === 'Unknown Device')) {
                devName = parsed.device_label;
            }
        }

        return {
            id: row.id,
            user_id: row.user_id,
            device_id: row.device_id,
            device_name: devName || `${browser || 'Browser'} on ${os || 'Device'}`,
            last_active_at: row.last_used_at || row.created_at,
            token_preview: tokenPreview,
            token: row.token_hash,
            status: statusText,
            is_active_session: isActive,
            revoked: isRevoked,
            expires_at: row.expires_at,
            created_at: row.created_at,
            replaced_by_token: null,
            ip_address: row.ip_address || 'Unknown',
            remember_me: Boolean(row.remember_me),
            user: {
                user_id: row.user_id,
                user_name: row.user_name || 'Unknown User',
                user_code: row.user_code || '-',
                email: row.email || '-',
                phone_no: row.phone_no || '-',
                user_type: row.user_type || 'employee',
                profile_image_url: row.profile_image_url,
                is_active: row.user_is_active
            },
            organization: {
                org_id: row.org_id,
                org_name: row.org_name || 'No Organization',
                org_code: row.org_code || '-'
            },
            device: {
                raw: row.user_agent || '',
                device_id: row.device_id,
                device_name: devName || `${browser || 'Browser'} on ${os || 'Device'}`,
                last_active_at: row.last_used_at,
                device_type: devType,
                os: os || 'Unknown OS',
                os_version: osVersion,
                browser: browser || 'Unknown Browser',
                browser_version: browserVersion,
                is_mobile: devType === 'mobile',
                is_tablet: devType === 'tablet',
                is_desktop: devType === 'desktop',
                is_api: devType === 'api_client'
            }
        };
    });

    return {
        sessions,
        pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            totalPages: Math.ceil(total / parsedLimit) || 1
        },
        stats,
        organizations: orgs
    };
}

/**
 * SuperAdmin Session Metrics Aggregation
 * @returns {Promise<object>}
 */
export async function getSessionMetrics() {
    const now = new Date();

    const [
        totalRes,
        activeRes,
        revokedRes,
        expiredRes,
        mobileRes,
        desktopRes,
        uniqueUsersRes
    ] = await Promise.all([
        attendanceDB('sessions').count('* as count').first(),
        attendanceDB('sessions').where('revoked', 0).where('expires_at', '>', now).count('* as count').first(),
        attendanceDB('sessions').where('revoked', 1).count('* as count').first(),
        attendanceDB('sessions').where('revoked', 0).where('expires_at', '<=', now).count('* as count').first(),
        attendanceDB('sessions').where('device_type', 'mobile').count('* as count').first(),
        attendanceDB('sessions').where('device_type', 'desktop').count('* as count').first(),
        attendanceDB('sessions').where('revoked', 0).where('expires_at', '>', now).countDistinct('user_id as count').first()
    ]);

    return {
        total: totalRes ? parseInt(totalRes.count, 10) : 0,
        active: activeRes ? parseInt(activeRes.count, 10) : 0,
        revoked: revokedRes ? parseInt(revokedRes.count, 10) : 0,
        expired: expiredRes ? parseInt(expiredRes.count, 10) : 0,
        mobile: mobileRes ? parseInt(mobileRes.count, 10) : 0,
        desktop: desktopRes ? parseInt(desktopRes.count, 10) : 0,
        unique_active_users: uniqueUsersRes ? parseInt(uniqueUsersRes.count, 10) : 0
    };
}

/**
 * SuperAdmin one-click cleanup of expired sessions: marks them revoked
 * @returns {Promise<{success: boolean, count: number, message: string}>}
 */
export async function cleanupExpiredSessions() {
    const now = new Date();
    const updated = await attendanceDB('sessions')
        .where('expires_at', '<', now)
        .where('revoked', 0)
        .update({
            revoked: 1,
            revoked_at: toMySQLDateTime(now),
            revoked_reason: 'expired_cleanup'
        });

    return {
        success: true,
        count: updated,
        message: `${updated} expired sessions cleaned up`
    };
}

/**
 * Cron Job: Hard delete sessions that expired or were revoked older than `cutoffDays`.
 * @param {object} [options]
 * @param {number} [options.cutoffDays=7]
 * @returns {Promise<{expiredCount: number, revokedCount: number}>}
 */
export async function cleanupOldSessions({ cutoffDays = 7 } = {}) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
    const cutoffStr = toMySQLDateTime(cutoffDate);

    const expiredCount = await attendanceDB('sessions')
        .where('expires_at', '<', cutoffStr)
        .del();

    const revokedCount = await attendanceDB('sessions')
        .where('revoked', 1)
        .where(function() {
            this.where('revoked_at', '<', cutoffStr)
                .orWhere(function() {
                    this.whereNull('revoked_at').andWhere('created_at', '<', cutoffStr);
                });
        })
        .del();

    return { expiredCount, revokedCount };
}

/**
 * Hard deletes all session records for a user (called during account hard deletion).
 * @param {number} userId
 * @param {object} [trx]
 */
export async function deleteUserSessions(userId, trx = null) {
    const db = trx || attendanceDB;
    await db('sessions').where('user_id', userId).del();
}

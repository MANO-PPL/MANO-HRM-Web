import { attendanceDB } from '../config/database.js';

// In-memory cache to avoid repeated DB/parsing calls: userId -> { timezone: string, cachedAt: number }
const userTimezoneCache = new Map();
const TIMEZONE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Calculates the next cron slot in minutes for a given interval.
 * 
 * @param {number} totalMinutes
 * @param {number} intervalMinutes (default 30)
 * @returns {number}
 */
export function getNextCronSlotMinutes(totalMinutes, intervalMinutes = 30) {
    return (Math.ceil(totalMinutes / intervalMinutes) * intervalMinutes) % (24 * 60);
}

/**
 * Resolve the user's effective IANA timezone following this priority:
 * 1. Timezone recorded in user's latest punch metadata (e.g. mobile GPS / device client TZ)
 * 2. Assigned work location timezone (org_work_locations.timezone)
 * 3. Organization default timezone (core_organizations.timezone)
 * 4. Fallback 'UTC'
 * 
 * @param {Object} user - User record (with org_timezone, location timezone, etc.)
 * @param {Object|string} punchMeta - Metadata from latest punch
 * @returns {string} Valid IANA timezone string
 */
export function resolveUserTimezone(user, punchMeta = null) {
    let rawTz = null;
    if (punchMeta) {
        try {
            const meta = typeof punchMeta === 'string' ? JSON.parse(punchMeta) : punchMeta;
            rawTz = meta?.timezone || meta?.time_in?.timezone;
        } catch (_) {}
    }

    if (!rawTz) {
        rawTz = user?.timezone || user?.org_timezone;
    }

    if (rawTz) {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: rawTz });
            return rawTz;
        } catch (_) {}
    }

    return 'UTC';
}

/**
 * Batch-loads the latest punch metadata for all users in a single query.
 * Returns a Map of userId -> punch metadata object/string.
 * 
 * @param {Object} db - Knex instance (defaults to attendanceDB)
 * @returns {Promise<Map<number, any>>}
 */
export async function getLatestPunchTimezones(db = attendanceDB) {
    try {
        const latestPunches = await db('attn_punches as ap')
            .join(
                db('attn_punches')
                    .select('user_id')
                    .max('id as max_id')
                    .whereNull('deleted_at')
                    .groupBy('user_id')
                    .as('latest'),
                'ap.id',
                'latest.max_id'
            )
            .select('ap.user_id', 'ap.metadata');

        const map = new Map();
        for (const p of latestPunches) {
            map.set(p.user_id, p.metadata);
        }
        return map;
    } catch (err) {
        console.warn('⚠️ [timezoneUtils] Failed to batch load latest punch timezones:', err.message);
        return new Map();
    }
}

/**
 * Retrieves the effective timezone for a user with in-memory caching.
 * 
 * @param {Object} user 
 * @param {Map<number, any>} [punchMetaMap] - Optional pre-loaded map of latest punches
 * @returns {string} Valid IANA timezone
 */
export function getEffectiveUserTimezone(user, punchMetaMap = null) {
    if (!user || !user.user_id) return 'UTC';

    const now = Date.now();
    const cached = userTimezoneCache.get(user.user_id);
    if (cached && (now - cached.cachedAt) < TIMEZONE_CACHE_TTL_MS) {
        return cached.timezone;
    }

    const punchMeta = punchMetaMap ? punchMetaMap.get(user.user_id) : null;
    const tz = resolveUserTimezone(user, punchMeta);
    userTimezoneCache.set(user.user_id, { timezone: tz, cachedAt: now });
    return tz;
}

/**
 * Invalidate the timezone cache for a specific user or completely.
 * 
 * @param {number} [userId]
 */
export function clearUserTimezoneCache(userId = null) {
    if (userId) {
        userTimezoneCache.delete(userId);
    } else {
        userTimezoneCache.clear();
    }
}

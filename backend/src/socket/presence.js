import { cacheService } from '../services/cache/cacheService.js';

// Redis key marking a user as online (60 s TTL, refreshed by 'heartbeat').
// Note: nothing in the backend or frontend reads this key yet.
const PRESENCE_TTL_SECONDS = 60;
const presenceKey = (orgId, userId) => `org:${orgId}:user:presence:${userId}`;

export function markOnline(orgId, userId) {
    return cacheService.set(presenceKey(orgId, userId), 'online', PRESENCE_TTL_SECONDS);
}

/**
 * Clears presence only when the user's last socket on this server has closed,
 * so closing one tab does not mark a user with other open tabs as offline.
 */
export async function markOfflineIfLastSocket(io, orgId, userId) {
    const remaining = await io.in(`user_${userId}`).fetchSockets();
    if (remaining.length === 0) {
        await cacheService.del(presenceKey(orgId, userId));
    }
}

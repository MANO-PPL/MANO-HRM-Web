import { clearApiCache } from '../services/api';
import { clearAttendanceCache, clearShiftPolicyCache } from '../services/attendanceService';
import { clearLeaveCache } from '../services/leaveService';
import { clearGeofenceCache } from '../services/userService';
import { clearCorrectionsCache } from '../services/correctionsService';
import { clearHolidayCache } from '../services/holidayService';
import { clearAdminCache } from '../services/adminService';

/**
 * Invalidate all client-side session and memory caches across all services
 * Dedicated to refreshing page data cleanly without full browser reloads
 */
export const invalidateAllCaches = (pageName = 'Page') => {
    // 1. Clear session-storage based API responses cache
    try {
        clearApiCache();
    } catch (e) {
        console.warn('[CacheManager] Error clearing API cache:', e);
    }

    // 2. Clear attendance & shift policies
    try {
        if (typeof clearAttendanceCache === 'function') clearAttendanceCache();
    } catch (_) {}

    try {
        if (typeof clearShiftPolicyCache === 'function') clearShiftPolicyCache();
    } catch (_) {}

    // 3. Clear leave requests & balance caches
    try {
        if (typeof clearLeaveCache === 'function') clearLeaveCache();
    } catch (_) {}

    // 4. Clear geofencing & locations
    try {
        if (typeof clearGeofenceCache === 'function') clearGeofenceCache();
    } catch (_) {}

    // 5. Clear corrections & approvals
    try {
        if (typeof clearCorrectionsCache === 'function') clearCorrectionsCache();
    } catch (_) {}

    // 6. Clear holidays
    try {
        if (typeof clearHolidayCache === 'function') clearHolidayCache();
    } catch (_) {}

    // 7. Clear administrative directory & users cache
    try {
        if (typeof clearAdminCache === 'function') clearAdminCache();
    } catch (_) {}

    // 8. Dispatch global event for any active page listening
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mano:page-refresh', {
            detail: {
                page: pageName,
                timestamp: Date.now()
            }
        }));
    }
};

export default invalidateAllCaches;

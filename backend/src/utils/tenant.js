import { attendanceDB } from '../config/database.js';
import AppError from './AppError.js';

const STAFF_ROLES = ['admin', 'hr'];

/**
 * Returns the caller's org_id, or throws 403 when the request has no
 * organization context. Never fall back to a default tenant.
 */
export function requireOrgId(req) {
    if (!req.user?.org_id) {
        throw new AppError('Organization context required', 403);
    }
    return req.user.org_id;
}

/**
 * Throws 404 unless the user belongs to the given org. 404 (not 403) so
 * callers cannot probe which IDs exist in other organizations.
 */
export async function assertUserInOrg(userId, orgId, db = attendanceDB) {
    const row = await db('core_users')
        .where({ user_id: Number(userId), org_id: orgId })
        .first('user_id');
    if (!row) {
        throw new AppError('Employee not found', 404);
    }
}

/**
 * Allows a user to act on their own record; admin/HR may act on any record
 * in their own organization. Everyone else gets 403.
 */
export async function assertSelfOrStaffInOrg(req, targetUserId, db = attendanceDB) {
    if (Number(targetUserId) === Number(req.user?.id)) return;
    if (!STAFF_ROLES.includes(req.user?.user_type)) {
        throw new AppError('You do not have permission to access this record', 403);
    }
    await assertUserInOrg(targetUserId, requireOrgId(req), db);
}

import { attendanceDB } from '../../config/database.js';
import { cacheService } from '../cache/cacheService.js';

/**
 * Get all shifts for an organization
 */
export async function getShiftsForOrg(org_id) {
    const cacheKey = `mano-cache:shifts:org:${org_id}`;
    
    // 1. Try cache read
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // 2. Fetch from DB on Cache Miss
    const shifts = await attendanceDB('org_shifts').where({ org_id });

    // Parse JSON rules for frontend compatibility
    const shiftsData = shifts.map(s => {
        const rules = typeof s.policy_rules === 'string' ? JSON.parse(s.policy_rules) : (s.policy_rules || {});
        return {
            shift_id: s.shift_id,
            shift_name: s.shift_name,
            org_id: s.org_id,
            // Map JSON back to legacy fields for frontend
            start_time: rules.shift_timing?.start_time || null,
            end_time: rules.shift_timing?.end_time || null,
            grace_period_mins: rules.grace_period?.minutes || 0,
            is_overtime_enabled: rules.overtime?.enabled ? 1 : 0,
            overtime_threshold_hours: rules.overtime?.threshold || 8.0,
            overtime_buffer_hours: rules.overtime?.buffer ?? 0.5,
            is_active: s.is_active !== undefined && s.is_active !== null ? (s.is_active === 1 || s.is_active === true || s.is_active === '1' ? 1 : 0) : (rules.is_active !== undefined ? (rules.is_active ? 1 : 0) : 1),
            policy_rules: rules
        };
    });

    // 3. Write cache for future hits (24 hours TTL)
    await cacheService.set(cacheKey, shiftsData);

    return shiftsData;
}

/**
 * Create a new shift
 */
export async function createShift({ org_id, shift_name, start_time, end_time, grace_period_mins, is_overtime_enabled, overtime_threshold_hours, is_active, policy_rules }) {
    const rules = policy_rules || {};

    const resolvedStart = start_time ?? rules.shift_timing?.start_time ?? null;
    const resolvedEnd = end_time ?? rules.shift_timing?.end_time ?? null;
    const resolvedGrace = grace_period_mins ?? rules.grace_period?.minutes ?? 0;

    const resolvedOtEnabled = (is_overtime_enabled ?? rules.overtime?.enabled) ? true : false;
    const resolvedOtThreshold = Number(overtime_threshold_hours ?? rules.overtime?.threshold ?? 8);
    const resolvedOtBuffer = rules.overtime?.buffer ?? 0.5;

    const isActiveVal = is_active !== undefined ? (is_active ? 1 : 0) : (rules.is_active !== undefined ? (rules.is_active ? 1 : 0) : 1);

    const finalRules = {
        ...rules,
        is_active: isActiveVal === 1,
        shift_timing: {
            ...(rules.shift_timing || {}),
            start_time: resolvedStart,
            end_time: resolvedEnd,
        },
        grace_period: {
            ...(rules.grace_period || {}),
            minutes: Number(resolvedGrace) || 0,
        },
        overtime: {
            ...(rules.overtime || {}),
            enabled: resolvedOtEnabled,
            threshold: Number.isFinite(resolvedOtThreshold) ? resolvedOtThreshold : 8,
            buffer: resolvedOtBuffer,
        },
        entry_requirements: rules.entry_requirements || { selfie: true, geofence: true },
    };

    const [id] = await attendanceDB('org_shifts').insert({
        org_id,
        shift_name,
        is_active: isActiveVal,
        policy_rules: JSON.stringify(finalRules)
    });

    // Invalidate Cache
    await cacheService.del(`mano-cache:shifts:org:${org_id}`);

    return id;
}

/**
 * Update an existing shift
 */
export async function updateShift({ shift_id, org_id, shift_name, is_active, policy_rules }) {
    const rules = policy_rules || {};
    const isActiveVal = is_active !== undefined ? (is_active ? 1 : 0) : (rules.is_active !== undefined ? (rules.is_active ? 1 : 0) : 1);

    const finalRules = {
        ...rules,
        is_active: isActiveVal === 1
    };

    const updates = {
        shift_name,
        is_active: isActiveVal,
        policy_rules: JSON.stringify(finalRules)
    };

    const affected = await attendanceDB('org_shifts')
        .where({ shift_id, org_id })
        .update(updates);

    // Invalidate Cache
    await cacheService.del(`mano-cache:shifts:org:${org_id}`);

    return affected;
}

/**
 * Delete a shift
 */
export async function deleteShift({ shift_id, org_id }) {
    // Check if shift is assigned to any user
    const usersCount = await attendanceDB('core_users')
        .where({ shift_id })
        .count('user_id as count')
        .first();

    if (usersCount.count > 0) {
        throw new Error(`Cannot delete shift. It is assigned to ${usersCount.count} users.`);
    }

    const affected = await attendanceDB('org_shifts')
        .where({ shift_id, org_id })
        .del();

    // Invalidate Cache
    await cacheService.del(`mano-cache:shifts:org:${org_id}`);

    return affected;
}

/**
 * Get all users with their shift assignments
 */
export async function getUsersWithShifts(org_id) {
    const users = await attendanceDB('core_users')
        .leftJoin('org_designations', 'core_users.desg_id', 'org_designations.desg_id')
        .where('core_users.org_id', org_id)
        .select(
            'core_users.user_id',
            'core_users.user_name',
            'core_users.shift_id',
            'core_users.profile_image_url',
            'org_designations.desg_name'
        )
        .orderBy('core_users.user_name', 'asc');

    return users;
}

/**
 * Assign or unassign a shift to a user
 */
export async function assignShiftToUser({ user_id, org_id, shift_id }) {
    const affected = await attendanceDB('core_users')
        .where({ user_id, org_id })
        .update({ shift_id: shift_id || null });

    return affected;
}

import { attendanceDB } from '../../config/database.js';
import { cacheService } from '../cache/cacheService.js';

export const DEFAULT_MAX_OVERTIME_HOURS = 3;

export function normalizeMaxOvertimeHours(value) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        return DEFAULT_MAX_OVERTIME_HOURS;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_OVERTIME_HOURS;
}

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
        const rawMaxOvertime = rules.overtime?.max_overtime !== undefined
            ? rules.overtime.max_overtime
            : rules.overtime?.maxOvertime;
        const normalizedRules = {
            ...rules,
            overtime: {
                ...(rules.overtime || {}),
                max_overtime: normalizeMaxOvertimeHours(rawMaxOvertime)
            },
            checkpoint_requirements: {
                enabled: rules.checkpoint_requirements?.enabled !== undefined ? Boolean(rules.checkpoint_requirements.enabled) : true,
                selfie: rules.checkpoint_requirements?.selfie !== undefined ? Boolean(rules.checkpoint_requirements.selfie) : false
            }
        };
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
            policy_rules: normalizedRules
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
    let rules = policy_rules || {};
    if (typeof rules === 'string') {
        try {
            rules = JSON.parse(rules);
        } catch (e) {
            rules = {};
        }
    }
    rules = rules || {};

    const resolvedStart = start_time ?? rules.shift_timing?.start_time ?? null;
    const resolvedEnd = end_time ?? rules.shift_timing?.end_time ?? null;
    const resolvedGrace = grace_period_mins ?? rules.grace_period?.minutes ?? 0;

    const resolvedOtEnabled = (is_overtime_enabled ?? rules.overtime?.enabled) ? true : false;
    const resolvedOtThreshold = Number(overtime_threshold_hours ?? rules.overtime?.threshold ?? 8);
    const resolvedOtBuffer = rules.overtime?.buffer ?? 0.5;
    const rawMaxOvertime = rules.overtime?.max_overtime !== undefined
        ? rules.overtime.max_overtime
        : rules.overtime?.maxOvertime;
    const resolvedMaxOvertime = normalizeMaxOvertimeHours(rawMaxOvertime);

    const isActiveVal = is_active !== undefined ? (is_active ? 1 : 0) : (rules.is_active !== undefined ? (rules.is_active ? 1 : 0) : 1);

    const checkpointReq = rules.checkpoint_requirements || {};

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
            max_overtime: resolvedMaxOvertime,
        },
        entry_requirements: rules.entry_requirements || { selfie: true, geofence: true },
        exit_requirements: rules.exit_requirements || { selfie: true, geofence: true },
        checkpoint_requirements: {
            enabled: checkpointReq.enabled !== undefined ? Boolean(checkpointReq.enabled) : true,
            selfie: checkpointReq.selfie !== undefined ? Boolean(checkpointReq.selfie) : false
        },
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
    const existing = await attendanceDB('org_shifts').where({ shift_id, org_id }).first();
    if (!existing) return 0;

    let existingRules = {};
    if (existing.policy_rules) {
        try {
            existingRules = typeof existing.policy_rules === 'string'
                ? JSON.parse(existing.policy_rules)
                : existing.policy_rules;
        } catch (e) {
            existingRules = {};
        }
    }
    existingRules = existingRules || {};

    let incomingRules = policy_rules;
    if (typeof incomingRules === 'string') {
        try {
            incomingRules = JSON.parse(incomingRules);
        } catch (e) {
            incomingRules = {};
        }
    }
    incomingRules = incomingRules || {};

    const checkpointReq = incomingRules.checkpoint_requirements !== undefined
        ? incomingRules.checkpoint_requirements
        : (existingRules.checkpoint_requirements || {});

    const isActiveVal = is_active !== undefined
        ? (is_active ? 1 : 0)
        : (incomingRules.is_active !== undefined
            ? (incomingRules.is_active ? 1 : 0)
            : (existing.is_active !== undefined ? (existing.is_active ? 1 : 0) : 1));

    const rawMaxOvertime = incomingRules.overtime?.max_overtime !== undefined
        ? incomingRules.overtime.max_overtime
        : (incomingRules.overtime?.maxOvertime !== undefined
            ? incomingRules.overtime.maxOvertime
            : (existingRules.overtime?.max_overtime !== undefined
                ? existingRules.overtime.max_overtime
                : existingRules.overtime?.maxOvertime));

    const finalRules = {
        ...existingRules,
        ...incomingRules,
        is_active: isActiveVal === 1,
        shift_timing: {
            ...(existingRules.shift_timing || {}),
            ...(incomingRules.shift_timing || {})
        },
        grace_period: {
            ...(existingRules.grace_period || {}),
            ...(incomingRules.grace_period || {})
        },
        overtime: {
            ...(existingRules.overtime || {}),
            ...(incomingRules.overtime || {}),
            max_overtime: normalizeMaxOvertimeHours(rawMaxOvertime)
        },
        entry_requirements: {
            ...(existingRules.entry_requirements || { selfie: true, geofence: true }),
            ...(incomingRules.entry_requirements || {})
        },
        exit_requirements: {
            ...(existingRules.exit_requirements || { selfie: true, geofence: true }),
            ...(incomingRules.exit_requirements || {})
        },
        checkpoint_requirements: {
            enabled: checkpointReq.enabled !== undefined ? Boolean(checkpointReq.enabled) : true,
            selfie: checkpointReq.selfie !== undefined ? Boolean(checkpointReq.selfie) : false
        }
    };

    const updates = {
        shift_name: shift_name !== undefined ? shift_name : existing.shift_name,
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

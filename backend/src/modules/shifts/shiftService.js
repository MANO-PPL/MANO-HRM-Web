import { attendanceDB } from '../../config/database.js';
import { cacheService } from '../../services/cache/cacheService.js';
import { verifyUserGeofence } from '../../services/attendance/geofencing.js';
import { parseBool, safeJsonParse } from '../../utils/dataUtils.js';
import { DAY_NAMES, getWeekdayOccurrence, diffTimesInMinutes } from '../../utils/dateUtils.js';

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
    // Check if shift is assigned to any active user
    const usersCount = await attendanceDB('core_users')
        .where({ shift_id })
        .where(function () {
            this.where('is_active', 1).orWhere('is_active', true);
        })
        .where(function () {
            this.where('is_deleted', 0).orWhere('is_deleted', false).orWhereNull('is_deleted');
        })
        .count('user_id as count')
        .first();

    if (usersCount && usersCount.count > 0) {
        throw new Error(`Cannot delete shift. It is assigned to ${usersCount.count} active users.`);
    }

    // Unassign shift from any inactive/deleted users before deletion
    await attendanceDB('core_users')
        .where({ shift_id, org_id })
        .update({ shift_id: null });

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
        .where(function () {
            this.where('core_users.is_active', 1).orWhere('core_users.is_active', true);
        })
        .where(function () {
            this.where('core_users.is_deleted', 0).orWhere('core_users.is_deleted', false).orWhereNull('core_users.is_deleted');
        })
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

// ─────────────────────────────────────────────────────────────
// Internal helpers for Policy & Shift Rules
// ─────────────────────────────────────────────────────────────

export { parseBool };

function normaliseFreq(frequency) {
    if (!frequency || frequency === 'every') return 'every';
    if (Array.isArray(frequency)) return frequency.map(Number);
    if (typeof frequency === 'number') return [frequency];
    return 'every';
}

function entryMatchesDate(entry, date) {
    if (entry.day !== DAY_NAMES[new Date(date).getDay()]) return false;
    const freq = normaliseFreq(entry.frequency);
    if (freq === 'every') return true;
    return freq.includes(getWeekdayOccurrence(date));
}

function normalisePolicyInput(raw) {
    if (!raw) return [];
    const parsed = safeJsonParse(raw, raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.rules)) return parsed.rules;
    return [];
}

function toSortedArray(weeks) {
    const src = weeks instanceof Set ? [...weeks] : [...(weeks || [])];
    return src.map(Number).sort((a, b) => a - b);
}

function mapToRules(map) {
    return [...map.entries()].map(([day, ruleData]) => ({ day, weeks: [...ruleData.weeks], timing: ruleData.timing }));
}

// ─────────────────────────────────────────────────────────────
// Week-Off Policy Engine (build, parse, evaluate)
// ─────────────────────────────────────────────────────────────

/**
 * Build a week_off_policy array from three UI configurator inputs.
 * @param {string[]} workingDays  Day names e.g. ['Mon', 'Tue']
 * @param {Array<{day:string,weeks:number[]}>} weekOffRules
 * @param {Array<{day:string,weeks:number[],timing?:Object}>} halfDayRules
 * @returns {Object[]}
 */
export function buildPolicy(workingDays = [], weekOffRules = [], halfDayRules = []) {
    const wdSet = new Set(workingDays.map(d => DAY_NAMES.indexOf(d)));

    const policy = [];

    // 1. Permanently-off days
    for (let d = 0; d < 7; d++) {
        if (!wdSet.has(d)) {
            policy.push({ day: DAY_NAMES[d], type: 'full', frequency: 'every' });
        }
    }

    // 2. Alternate full days off
    for (const rule of weekOffRules) {
        if (!DAY_NAMES.includes(rule.day)) continue;
        const weeks = toSortedArray(rule.weeks);
        if (!weeks.length) continue;
        policy.push({ day: rule.day, type: 'full', frequency: weeks.length >= 5 ? 'every' : weeks });
    }

    // 3. Half days
    for (const rule of halfDayRules) {
        if (!DAY_NAMES.includes(rule.day)) continue;
        const weeks = toSortedArray(rule.weeks);
        if (!weeks.length) continue;
        const entry = { day: rule.day, type: 'half', frequency: weeks.length >= 5 ? 'every' : weeks };
        if (rule.timing && rule.timing.start_time && rule.timing.end_time) {
            entry.timing = rule.timing;
        }
        policy.push(entry);
    }

    return policy;
}

/**
 * Reconstruct the three configurator inputs from a stored policy.
 * @param {Object[]|string} policy
 * @returns {{ workingDays: string[], weekOffRules: Array, halfDayRules: Array }}
 */
export function parsePolicy(policy) {
    const entries = normalisePolicyInput(policy);

    const workingDaysIndices = new Set([0, 1, 2, 3, 4, 5, 6]);
    const weekOffMap = new Map();
    const halfDayMap = new Map();

    for (const entry of entries) {
        const freq = normaliseFreq(entry.frequency);
        const type = (entry.type || 'full').toLowerCase();
        const dayIdx = DAY_NAMES.indexOf(entry.day);

        // Fallback for old data with integer days
        const resolvedDay = dayIdx !== -1 ? entry.day : (typeof entry.day === 'number' ? DAY_NAMES[entry.day] : null);
        if (!resolvedDay) continue;
        const resolvedDayIdx = DAY_NAMES.indexOf(resolvedDay);

        if (type === 'full' && freq === 'every') {
            workingDaysIndices.delete(resolvedDayIdx);
            continue;
        }

        const map = type === 'half' ? halfDayMap : weekOffMap;
        if (!map.has(resolvedDay)) map.set(resolvedDay, { weeks: new Set(), timing: null });

        const ruleData = map.get(resolvedDay);
        if (entry.timing) ruleData.timing = entry.timing;

        if (freq === 'every') {
            [1, 2, 3, 4, 5].forEach(w => ruleData.weeks.add(w));
        } else {
            freq.forEach(w => ruleData.weeks.add(w));
        }
    }

    const workingDays = [...workingDaysIndices].sort().map(d => DAY_NAMES[d]);

    return {
        workingDays,
        weekOffRules: mapToRules(weekOffMap),
        halfDayRules: mapToRules(halfDayMap),
    };
}

/**
 * Evaluate the day type for a single date.
 * Priority:  week_off > half_day > working
 * @param {Date|string} date
 * @param {Object[]|string} policy
 * @returns {"working"|"half_day"|"week_off"}
 */
export function getDayType(date, policy) {
    const entries = normalisePolicyInput(policy);
    let isHalfDay = false;

    for (const entry of entries) {
        if (!entryMatchesDate(entry, date)) continue;
        const type = (entry.type || 'full').toLowerCase();
        if (type === 'full') return 'week_off';
        if (type === 'half') isHalfDay = true;
    }

    return isHalfDay ? 'half_day' : 'working';
}

/**
 * Get expected work hours for a specific date.
 * If a custom half-day timing is provided in the policy, uses that duration.
 * @param {Date|string} date
 * @param {Object[]|string} policy
 * @param {Object} shiftRules
 * @returns {number}
 */
export function getExpectedHours(date, policy, shiftRules) {
    const entries = normalisePolicyInput(policy);
    let isHalfDay = false;
    let customTiming = null;

    for (const entry of entries) {
        if (!entryMatchesDate(entry, date)) continue;
        const type = (entry.type || 'full').toLowerCase();
        if (type === 'full') return 0;
        if (type === 'half') {
            isHalfDay = true;
            if (entry.timing) customTiming = entry.timing;
        }
    }

    const timingToUse = customTiming || shiftRules?.shift_timing || {};
    if (!timingToUse.start_time || !timingToUse.end_time) {
        return 0;
    }

    let fullHours = diffTimesInMinutes(timingToUse.start_time, timingToUse.end_time) / 60;

    if (isHalfDay && !customTiming) {
        fullHours = fullHours / 2;
    }

    return parseFloat(fullHours.toFixed(2));
}

/**
 * Expand a month into per-day type descriptors for calendar/report views.
 * @param {number} year
 * @param {number} month  1-indexed
 * @param {Object[]|string} policy
 * @returns {Array<{date:string, dayType:string}>}
 */
export function getMonthSchedule(year, month, policy) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d, 12, 0, 0);
        result.push({ date: date.toISOString().split('T')[0], dayType: getDayType(date, policy) });
    }
    return result;
}

/**
 * Count working, half-day, and week-off days in a month.
 * @param {number} year
 * @param {number} month  1-indexed
 * @param {Object[]|string} policy
 * @returns {{ working: number, half_day: number, week_off: number, total: number }}
 */
export function getMonthSummary(year, month, policy) {
    return getMonthSchedule(year, month, policy).reduce(
        (acc, { dayType }) => { acc[dayType] = (acc[dayType] || 0) + 1; acc.total++; return acc; },
        { working: 0, half_day: 0, week_off: 0, total: 0 }
    );
}

/**
 * Get shift rules from shift object
 * Combines direct shift columns with optional policy_rules JSON for backward compatibility.
 */
export function getShiftRules(shift) {
    if (!shift ||
        (shift.hasOwnProperty('shift_id') && !shift.shift_id) ||
        (!shift.shift_id && !shift.policy_rules && !shift.start_time)) {
        return getDefaultShiftConfig();
    }

    // Parse policy_rules if it's a string
    let rules = shift.policy_rules;
    if (typeof rules === 'string') {
        try {
            rules = JSON.parse(rules);
        } catch (e) {
            rules = {};
        }
    }

    rules = rules || {};

    // Merge direct shift columns into a unified rules object
    // Direct columns take priority if they exist
    const overtimeEnabled = parseBool(
        shift.is_overtime_enabled ?? rules.overtime?.enabled,
        true
    );

    const overtimeThreshold = Number(shift.overtime_threshold_hours || rules.overtime?.threshold || 8);
    // Buffer time (in hours) after shift ends before overtime starts counting
    // e.g. 0.5 = 30 minutes buffer - employee can stay 30min past shift without triggering OT
    const overtimeBuffer = Number(shift.overtime_buffer_hours ?? rules.overtime?.buffer ?? 0.5);
    const rawMaxOvertime = rules.overtime?.max_overtime !== undefined
        ? rules.overtime.max_overtime
        : rules.overtime?.maxOvertime;
    const maxOvertime = normalizeMaxOvertimeHours(rawMaxOvertime);

    return {
        shift_timing: {
            start_time: shift.start_time || rules.shift_timing?.start_time || "09:00:00",
            end_time: shift.end_time || rules.shift_timing?.end_time || "18:00:00"
        },
        grace_period: {
            minutes: Number(shift.grace_period_mins !== undefined && shift.grace_period_mins !== null ? shift.grace_period_mins : (rules.grace_period?.minutes || 10))
        },
        overtime: {
            enabled: overtimeEnabled,
            threshold: overtimeThreshold,
            buffer: overtimeBuffer,
            max_overtime: maxOvertime
        },
        entry_requirements: rules.entry_requirements || {
            selfie: true,
            geofence: true
        },
        exit_requirements: rules.exit_requirements || {
            selfie: true,
            geofence: true
        },
        checkpoint_requirements: {
            enabled: parseBool(rules.checkpoint_requirements?.enabled, true),
            selfie: parseBool(rules.checkpoint_requirements?.selfie, false)
        },
        correction_deadline: rules.correction_deadline ?? 2,
        week_off_policy: normalisePolicyInput(rules.week_off_policy)
    };
}

/**
 * Default shift configuration
 */
export function getDefaultShiftConfig() {
    return {
        shift_timing: {
            start_time: null,
            end_time: null
        },
        grace_period: {
            minutes: 0
        },
        overtime: {
            enabled: false,
            threshold: 0,
            buffer: 0,
            max_overtime: DEFAULT_MAX_OVERTIME_HOURS
        },
        entry_requirements: {
            selfie: false,
            geofence: false
        },
        exit_requirements: {
            selfie: false,
            geofence: false
        },
        checkpoint_requirements: {
            enabled: true,
            selfie: false
        },
        correction_deadline: 2,
        week_off_policy: [
            { day: "Sun", type: "full", frequency: "every" }
        ]
    };
}

/**
 * Check Location Compliance
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function checkLocationCompliance(user_id, lat, lng, accuracy, requirements) {
    const reqs = requirements || {};
    // Handle both old nested and new flat structures
    const geoPolicy = reqs.geolocation || reqs;

    // If not required, pass
    if (geoPolicy.geofence === false || geoPolicy.required === false) return { ok: true };

    // 1. Basic Validation
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return { ok: false, error: "Invalid or missing latitude/longitude" };
    }

    const MAX_ALLOWED_ACCURACY = 200;
    if (!accuracy || accuracy > MAX_ALLOWED_ACCURACY) {
        return { ok: false, error: `Location accuracy too poor (${Math.round(accuracy)}m). GPS/Wi-Fi required (< ${MAX_ALLOWED_ACCURACY}m).` };
    }

    // 2. Perform Geofence Check
    const isInLocation = await verifyUserGeofence(user_id, lat, lng);

    if (!isInLocation) {
        return { ok: false, error: "You are outside the allowed work location." };
    }

    return { ok: true };
}

/**
 * Check Biometric/Selfie Compliance
 * @returns {{ok: boolean, error?: string}}
 */
export function checkBiometricCompliance(file, requirements) {
    const reqs = requirements || {};
    const selfiePolicy = (reqs.selfie !== undefined && reqs.selfie !== null) ? reqs.selfie : {};

    // If not required, pass
    if (selfiePolicy === false || selfiePolicy.required === false) return { ok: true };

    // 2. Check if file exists
    if (!file) {
        return { ok: false, error: "Selfie is required for this check-in/out." };
    }

    return { ok: true };
}


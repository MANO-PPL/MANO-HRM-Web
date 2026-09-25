import { attendanceDB } from '../../config/database.js';
import { cacheService } from '../../services/cache/cacheService.js';
import { verifyUserGeofence } from './geofencing.js';
import { parseBool, safeJsonParse } from '../../utils/dataUtils.js';
import { DAY_NAMES, getWeekdayOccurrence, diffTimesInMinutes, timeToMinutes, minutesToTime, isTimeInShiftRange, getShiftDurationMinutes, toMySQLDateTime } from '../../utils/dateUtils.js';

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
            max_overtime: resolvedMaxOvertime,
        },
        entry_requirements: rules.entry_requirements || { selfie: true, geofence: true },
        exit_requirements: rules.exit_requirements || { selfie: true, geofence: true },
        checkpoint_requirements: {
            enabled: checkpointReq.enabled !== undefined ? Boolean(checkpointReq.enabled) : true,
            selfie: checkpointReq.selfie !== undefined ? Boolean(checkpointReq.selfie) : false
        },
    };

    if (finalRules.missed_punch_check_time && finalRules.shift_timing?.start_time && finalRules.shift_timing?.end_time) {
        if (isTimeInShiftRange(finalRules.missed_punch_check_time, finalRules.shift_timing.start_time, finalRules.shift_timing.end_time)) {
            throw new Error(`"Flag as Missed Punch After" (${finalRules.missed_punch_check_time}) cannot fall within shift working hours (${finalRules.shift_timing.start_time} - ${finalRules.shift_timing.end_time}).`);
        }
    }

    if (finalRules.overtime?.enabled && finalRules.shift_timing?.start_time && finalRules.shift_timing?.end_time) {
        const shiftDurationMins = getShiftDurationMinutes(finalRules.shift_timing.start_time, finalRules.shift_timing.end_time);
        const thresholdMins = Math.round((Number(finalRules.overtime.threshold) || 0) * 60);
        if (thresholdMins < shiftDurationMins) {
            throw new Error(`Overtime trigger cannot be set below the shift duration (${shiftDurationMins} minutes).`);
        }
    }

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

    const mergedShiftTiming = {
        ...(existingRules.shift_timing || {}),
        ...(incomingRules.shift_timing || {})
    };

    const finalRules = {
        ...existingRules,
        ...incomingRules,
        is_active: isActiveVal === 1,
        shift_timing: mergedShiftTiming,
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

    if (finalRules.missed_punch_check_time && finalRules.shift_timing?.start_time && finalRules.shift_timing?.end_time) {
        if (isTimeInShiftRange(finalRules.missed_punch_check_time, finalRules.shift_timing.start_time, finalRules.shift_timing.end_time)) {
            throw new Error(`"Flag as Missed Punch After" (${finalRules.missed_punch_check_time}) cannot fall within shift working hours (${finalRules.shift_timing.start_time} - ${finalRules.shift_timing.end_time}).`);
        }
    }

    if (finalRules.overtime?.enabled && finalRules.shift_timing?.start_time && finalRules.shift_timing?.end_time) {
        const shiftDurationMins = getShiftDurationMinutes(finalRules.shift_timing.start_time, finalRules.shift_timing.end_time);
        const thresholdMins = Math.round((Number(finalRules.overtime.threshold) || 0) * 60);
        if (thresholdMins < shiftDurationMins) {
            throw new Error(`Overtime trigger cannot be set below the shift duration (${shiftDurationMins} minutes).`);
        }
    }

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
 * Resolve the effective shift rules to use for LATE/OT evaluation on a specific date, accounting
 * for a per-shift half-day rule (Special Weekend & Alternate Rules). On a working day or week-off
 * day, returns `rules` unchanged. On a half-day:
 * - with an explicit custom timing window configured → late/OT are judged against that window.
 * - with no custom timing (just "half the hours", no defined start/end) → assumes the half-day
 *   runs from the shift's normal start time for half its normal duration (e.g. a 9-6 shift's
 *   half-day defaults to 9-1), so lateness/OT still have a well-defined window to compare against.
 * @param {Date|string} date
 * @param {Object} rules - Shift rules from getShiftRules()
 * @returns {Object} Effective rules (same object if no adjustment applies)
 */
export function getEffectiveRulesForDate(date, rules) {
    const dayType = getDayType(date, rules?.week_off_policy);
    if (dayType !== 'half_day') return rules;

    const entries = normalisePolicyInput(rules?.week_off_policy);
    let customTiming = null;
    for (const entry of entries) {
        if (!entryMatchesDate(entry, date)) continue;
        if ((entry.type || 'full').toLowerCase() === 'half' && entry.timing?.start_time && entry.timing?.end_time) {
            customTiming = entry.timing;
        }
    }

    if (customTiming) {
        return {
            ...rules,
            shift_timing: { start_time: customTiming.start_time, end_time: customTiming.end_time },
            crosses_midnight: timeToMinutes(customTiming.end_time) <= timeToMinutes(customTiming.start_time)
        };
    }

    const normalStart = rules?.shift_timing?.start_time;
    const normalEnd = rules?.shift_timing?.end_time;
    if (!normalStart || !normalEnd) return rules;

    const fullMinutes = diffTimesInMinutes(normalStart, normalEnd);
    const halfEndMinutes = (timeToMinutes(normalStart) + Math.round(fullMinutes / 2)) % 1440;

    return {
        ...rules,
        shift_timing: { start_time: normalStart, end_time: minutesToTime(halfEndMinutes) },
        crosses_midnight: false
    };
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
    const rawMaxOvertime = rules.overtime?.max_overtime !== undefined
        ? rules.overtime.max_overtime
        : rules.overtime?.maxOvertime;
    const maxOvertime = normalizeMaxOvertimeHours(rawMaxOvertime);

    const resolvedStartTime = shift.start_time || rules.shift_timing?.start_time || "09:00:00";
    const resolvedEndTime = shift.end_time || rules.shift_timing?.end_time || "18:00:00";

    // Always derived live from the shift's own start/end — never stored, never overridable.
    const crossesMidnight = timeToMinutes(resolvedEndTime) <= timeToMinutes(resolvedStartTime);

    return {
        shift_timing: {
            start_time: resolvedStartTime,
            end_time: resolvedEndTime
        },
        crosses_midnight: crossesMidnight,
        grace_period: {
            minutes: Number(shift.grace_period_mins !== undefined && shift.grace_period_mins !== null ? shift.grace_period_mins : (rules.grace_period?.minutes || 10))
        },
        overtime: {
            enabled: overtimeEnabled,
            threshold: overtimeThreshold,
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
        correction_deadline: rules.correction_deadline ?? 30,
        missed_punch_check_time: rules.missed_punch_check_time || null,
        // Per-shift "half day if arrival after X / leaves before Y" — replaces the old org-wide
        // threshold (which broke for orgs with more than one shift, since one flat clock time
        // can't fit a morning, evening, and night shift at once). Only ever applied by the caller
        // on a date this shift's own week_off_policy already classifies as 'working' — never
        // stacks with this shift's own Scheduled Half-Day or week-off.
        half_day_threshold: {
            enabled: Boolean(rules.half_day_threshold?.enabled),
            late_after_time: rules.half_day_threshold?.late_after_time || null,
            early_before_time: rules.half_day_threshold?.early_before_time || null
        },
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
        crosses_midnight: false,
        grace_period: {
            minutes: 0
        },
        overtime: {
            enabled: false,
            threshold: 0,
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
        correction_deadline: 30,
        missed_punch_check_time: null,
        half_day_threshold: {
            enabled: false,
            late_after_time: null,
            early_before_time: null
        },
        week_off_policy: [
            { day: "Sun", type: "full", frequency: "every" }
        ]
    };
}

/**
 * Look up one shift by id via the existing 24h-cached org shift list, instead of a fresh
 * DB query — used wherever a session's already-resolved shift needs to be re-fetched.
 */
export async function getShiftById(org_id, shift_id) {
    if (!shift_id) return null;
    const shifts = await getShiftsForOrg(org_id);
    return shifts.find(s => s.shift_id === shift_id) || null;
}

/**
 * The org's "Open Shift" template (active shift whose name contains "open"), used as a fallback
 * for users with no shift_id assigned. Returns null (never throws) if none exists or the lookup fails.
 */
export async function getOpenShiftFallback(org_id) {
    try {
        return await attendanceDB("org_shifts")
            .where({ org_id })
            .whereRaw("LOWER(shift_name) LIKE ?", ["%open%"])
            .where(function () { this.where('is_active', 1).orWhereNull('is_active'); })
            .first() || null;
    } catch (_) {
        return null;
    }
}

/**
 * Fetch assigned shift for a user, or fall back to the organization's open shift.
 */
export async function getUserShift(user_id) {
    const user = await attendanceDB("core_users")
        .where("user_id", user_id)
        .select("shift_id", "org_id")
        .first();

    if (!user) return null;

    if (user.shift_id) {
        const assignedShift = await attendanceDB("org_shifts")
            .where({ shift_id: user.shift_id, org_id: user.org_id })
            .first();
        if (assignedShift) return assignedShift;
    }

    const openShift = await getOpenShiftFallback(user.org_id);
    if (openShift) {
        return openShift;
    }

    return null;
}

// How close a punch-in must be to a shift's own start time (in either direction) to count as
// that shift, whether it's the employee's assigned shift or another org shift template.
export const SHIFT_PATTERN_MATCH_WINDOW_HOURS = 3;
// OT threshold used only when a punch matches no shift template at all (off-pattern fallback).
export const OFF_PATTERN_DEFAULT_OT_THRESHOLD_HOURS = 9;

function minutesFromShiftStart(punchLocalTimeStr, shiftStartTimeStr) {
    const timePart = String(punchLocalTimeStr).split('T')[1] || String(punchLocalTimeStr);
    const punchMinutes = timeToMinutes(timePart);
    const startMinutes = timeToMinutes(shiftStartTimeStr);
    if (punchMinutes === null || startMinutes === null) return Infinity;
    let diff = Math.abs(punchMinutes - startMinutes);
    if (diff > 12 * 60) diff = (24 * 60) - diff; // shortest distance on a 24h clock
    return diff;
}

/**
 * Synthetic rules for a punch that matches neither the assigned shift nor any other org shift
 * template: no late penalty, hours tracked as simple elapsed time, OT judged against a flat
 * default rather than a shift that doesn't actually apply to this session.
 */
export function getOffPatternFallbackRules() {
    return {
        ...getDefaultShiftConfig(),
        shift_timing: { start_time: null, end_time: null },
        overtime: { enabled: true, threshold: OFF_PATTERN_DEFAULT_OT_THRESHOLD_HOURS, max_overtime: DEFAULT_MAX_OVERTIME_HOURS },
        crosses_midnight: false
    };
}

/**
 * Resolve which shift's rules should govern one check-in session: the assigned shift if the
 * punch is close to its normal start time, another org shift template if the punch matches one
 * better, or a neutral off-pattern fallback if nothing matches. core_users.shift_id is never
 * modified — this is a per-session decision only. Only called for employees with a real
 * assigned shift; Open-Shift/no-shift users are intentionally excluded by the caller.
 */
export async function resolveShiftForPunch({ assignedShift, org_id, punchInTimestamp }) {
    const assignedRules = getShiftRules(assignedShift);
    if (!assignedShift || !assignedRules.shift_timing.start_time) {
        return { shift: assignedShift, rules: assignedRules, matchType: assignedShift ? 'assigned' : 'no_shift' };
    }

    const windowMinutes = SHIFT_PATTERN_MATCH_WINDOW_HOURS * 60;
    if (minutesFromShiftStart(punchInTimestamp, assignedRules.shift_timing.start_time) <= windowMinutes) {
        return { shift: assignedShift, rules: assignedRules, matchType: 'assigned' };
    }

    const allShifts = await getShiftsForOrg(org_id);
    let bestMatch = null;
    let bestDistance = Infinity;
    for (const candidate of allShifts) {
        if (!candidate || candidate.shift_id === assignedShift.shift_id) continue;
        if (candidate.is_active !== 1) continue;
        if (!candidate.start_time) continue;
        const dist = minutesFromShiftStart(punchInTimestamp, candidate.start_time);
        if (dist <= windowMinutes && dist < bestDistance) {
            bestMatch = candidate;
            bestDistance = dist;
        }
    }
    if (bestMatch) {
        return { shift: bestMatch, rules: getShiftRules(bestMatch), matchType: 'pattern_matched' };
    }

    return { shift: null, rules: getOffPatternFallbackRules(), matchType: 'off_pattern_fallback' };
}

/**
 * Resolve which shift's rules govern a specific check-in session — the assigned shift if the
 * punch is close to its normal start time, another org shift template if the punch matches one
 * better, or a neutral off-pattern fallback if nothing matches. core_users.shift_id is never
 * modified. Pattern-matching only applies for employees with a real assigned shift — Open-Shift
 * and no-shift users always just get their existing (single) shift, unchanged from today.
 */
export async function resolveUserShiftForSession(user_id, punchInTimestamp = null) {
    const assignedShift = await getUserShift(user_id);
    const assignedRules = getShiftRules(assignedShift);

    if (!punchInTimestamp) {
        return { shift: assignedShift, rules: assignedRules, matchType: assignedShift ? 'assigned' : 'no_shift' };
    }

    const userRow = await attendanceDB('core_users').where('user_id', user_id).select('shift_id', 'org_id').first();
    if (!userRow || !userRow.shift_id) {
        return { shift: assignedShift, rules: assignedRules, matchType: assignedShift ? 'assigned' : 'no_shift' };
    }

    return resolveShiftForPunch({ assignedShift, org_id: userRow.org_id, punchInTimestamp });
}

/**
 * Reconstruct which shift/rules governed an already-created in-punch, from the resolution it
 * recorded in its own metadata at check-in time — so checkout/aggregation agree with what
 * check-in decided rather than risking a different result from re-matching live. Falls back to
 * live resolution for punches created before this metadata existed.
 */
export async function resolveShiftFromPunchRecord(inPunchRow) {
    const meta = safeJsonParse(inPunchRow.metadata);
    if (meta && meta.match_type === 'off_pattern_fallback') {
        return { shift: null, rules: getOffPatternFallbackRules(), matchType: 'off_pattern_fallback' };
    }
    if (meta && meta.resolved_shift_id) {
        const userRow = await attendanceDB('core_users').where('user_id', inPunchRow.user_id).select('org_id').first();
        if (userRow) {
            const matchedShift = await getShiftById(userRow.org_id, meta.resolved_shift_id);
            if (matchedShift) {
                return { shift: matchedShift, rules: getShiftRules(matchedShift), matchType: meta.match_type || 'assigned' };
            }
        }
    }
    return resolveUserShiftForSession(inPunchRow.user_id, toMySQLDateTime(inPunchRow.punch_time));
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


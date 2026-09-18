import { attendanceDB } from '../../config/database.js';

/**
 * Org-wide threshold-based half-day policy: "half day if arrival after X" and/or "half day if
 * leaves before Y". Distinct from a per-shift half-day rule (Special Weekend & Alternate Rules,
 * shiftService.js) — the org-wide rule only ever applies on a date the employee's shift itself
 * classifies as a normal working day (see getDayType), never stacking with a shift's own
 * half-day/week-off rule for that date.
 */

const DEFAULTS = {
    half_day_threshold_enabled: false,
    half_day_late_after_time: null,
    half_day_early_before_time: null
};

/**
 * Fetch (lazily creating with defaults on first access) an org's attendance settings row.
 * @param {number} org_id
 * @returns {Promise<Object>}
 */
export async function getOrgAttendanceSettings(org_id) {
    let settings = await attendanceDB('org_attendance_settings').where({ org_id }).first();
    if (!settings) {
        await attendanceDB('org_attendance_settings').insert({ org_id, ...DEFAULTS });
        settings = await attendanceDB('org_attendance_settings').where({ org_id }).first();
    }
    return settings;
}

/**
 * Update an org's attendance settings (lazily creating the row first if needed).
 * @param {number} org_id
 * @param {{ half_day_threshold_enabled?: boolean, half_day_late_after_time?: string|null, half_day_early_before_time?: string|null }} updates
 * @returns {Promise<Object>} the updated settings row
 */
export async function updateOrgAttendanceSettings(org_id, updates) {
    await getOrgAttendanceSettings(org_id); // ensure the row exists before updating

    const patch = {};
    if (updates.half_day_threshold_enabled !== undefined) {
        patch.half_day_threshold_enabled = updates.half_day_threshold_enabled ? 1 : 0;
    }
    if (updates.half_day_late_after_time !== undefined) {
        patch.half_day_late_after_time = updates.half_day_late_after_time || null;
    }
    if (updates.half_day_early_before_time !== undefined) {
        patch.half_day_early_before_time = updates.half_day_early_before_time || null;
    }
    patch.updated_at = attendanceDB.fn.now();

    await attendanceDB('org_attendance_settings').where({ org_id }).update(patch);
    return attendanceDB('org_attendance_settings').where({ org_id }).first();
}

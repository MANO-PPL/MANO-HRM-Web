import catchAsync from '../../utils/catchAsync.js';
import * as OrgAttendanceSettingsService from './orgAttendanceSettingsService.js';

/**
 * GET /attendance/org-settings
 */
export const getSettings = catchAsync(async (req, res) => {
    const org_id = req.user.org_id;
    const settings = await OrgAttendanceSettingsService.getOrgAttendanceSettings(org_id);
    res.status(200).json({ ok: true, data: settings });
});

/**
 * PATCH /attendance/org-settings
 */
export const updateSettings = catchAsync(async (req, res) => {
    const org_id = req.user.org_id;
    const { half_day_threshold_enabled, half_day_late_after_time, half_day_early_before_time } = req.body;

    const settings = await OrgAttendanceSettingsService.updateOrgAttendanceSettings(org_id, {
        half_day_threshold_enabled,
        half_day_late_after_time,
        half_day_early_before_time
    });

    res.status(200).json({ ok: true, message: 'Attendance settings updated successfully.', data: settings });
});

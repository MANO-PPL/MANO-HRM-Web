import catchAsync from '../../utils/catchAsync.js';
import * as dailyScheduleService from './dailyScheduleService.js';

/**
 * GET /labour/schedule
 * Fetch scheduled sites for a worker on a date within user's organization
 */
export const getLabourSchedule = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { labour_id, date } = req.query;

    const result = await dailyScheduleService.getLabourSchedule({ org_id, labour_id, date });
    res.json({
        success: true,
        ...result
    });
});

/**
 * POST /labour/schedule
 * Save or update daily schedules for a worker on a date within user's organization
 */
export const saveLabourSchedule = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { labour_id, date, site_ids } = req.body;

    const result = await dailyScheduleService.saveLabourSchedule({ org_id, labour_id, date, site_ids });
    res.json(result);
});

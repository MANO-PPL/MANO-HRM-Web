import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';

/**
 * GET /labour/schedule
 * Fetch scheduled sites for a worker on a date
 */
export const getLabourSchedule = catchAsync(async (req, res) => {
    const { labour_id, date } = req.query;

    if (!labour_id || !date) {
        throw new AppError('labour_id and date parameters are required', 400);
    }

    const schedules = await attendanceDB('labour_daily_schedule')
        .where({
            labour_id: Number(labour_id),
            date: date
        })
        .select('site_id');

    const siteIds = schedules.map(s => s.site_id);

    res.json({
        success: true,
        labour_id: Number(labour_id),
        date,
        site_ids: siteIds
    });
});

/**
 * POST /labour/schedule
 * Save or update daily schedules for a worker on a date
 */
export const saveLabourSchedule = catchAsync(async (req, res) => {
    const { labour_id, date, site_ids } = req.body;

    if (!labour_id || !date || !Array.isArray(site_ids)) {
        throw new AppError('labour_id, date, and site_ids array are required', 400);
    }

    await attendanceDB.transaction(async (trx) => {
        // Delete existing daily schedule for this worker on this date
        await trx('labour_daily_schedule')
            .where({
                labour_id: Number(labour_id),
                date: date
            })
            .del();

        // Insert new daily schedule entries if any site_ids are provided
        if (site_ids.length > 0) {
            const insertData = site_ids.map(siteId => ({
                labour_id: Number(labour_id),
                site_id: Number(siteId),
                date: date
            }));

            await trx('labour_daily_schedule').insert(insertData);
        }
    });

    res.json({
        success: true,
        message: 'Daily schedule saved successfully'
    });
});

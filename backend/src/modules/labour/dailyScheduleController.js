import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';

/**
 * GET /labour/schedule
 * Fetch scheduled sites for a worker on a date within user's organization
 */
export const getLabourSchedule = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { labour_id, date } = req.query;

    if (!labour_id || !date) {
        throw new AppError('labour_id and date parameters are required', 400);
    }

    // Verify labour belongs to organization
    const labour = await attendanceDB('labours')
        .where({ labour_id: Number(labour_id), org_id })
        .first();

    if (!labour) {
        throw new AppError('Labour worker not found in your organization', 404);
    }

    const schedules = await attendanceDB('labour_daily_schedule')
        .where({
            org_id,
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
 * Save or update daily schedules for a worker on a date within user's organization
 */
export const saveLabourSchedule = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { labour_id, date, site_ids } = req.body;

    if (!labour_id || !date || !Array.isArray(site_ids)) {
        throw new AppError('labour_id, date, and site_ids array are required', 400);
    }

    // Verify labour belongs to organization
    const labour = await attendanceDB('labours')
        .where({ labour_id: Number(labour_id), org_id })
        .first();

    if (!labour) {
        throw new AppError('Labour worker not found in your organization', 404);
    }

    // Verify all site_ids belong to organization
    if (site_ids.length > 0) {
        const validSites = await attendanceDB('labour_sites')
            .where('org_id', org_id)
            .whereIn('site_id', site_ids.map(Number));

        if (validSites.length !== site_ids.length) {
            throw new AppError('One or more specified sites do not belong to your organization', 400);
        }
    }

    await attendanceDB.transaction(async (trx) => {
        // Delete existing daily schedule for this worker on this date and org
        await trx('labour_daily_schedule')
            .where({
                org_id,
                labour_id: Number(labour_id),
                date: date
            })
            .del();

        // Insert new daily schedule entries if any site_ids are provided
        if (site_ids.length > 0) {
            const insertData = site_ids.map(siteId => ({
                org_id,
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

import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

/**
 * Fetch scheduled sites for a worker on a date within organization
 * 
 * @param {Object} params
 * @param {number} params.org_id
 * @param {number} params.labour_id
 * @param {string} params.date
 * @returns {Promise<{labour_id: number, date: string, site_ids: number[]}>}
 */
export async function getLabourSchedule({ org_id, labour_id, date }) {
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

    return {
        labour_id: Number(labour_id),
        date,
        site_ids: siteIds
    };
}

/**
 * Save or update daily schedules for a worker on a date within organization
 * 
 * @param {Object} params
 * @param {number} params.org_id
 * @param {number} params.labour_id
 * @param {string} params.date
 * @param {number[]} params.site_ids
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function saveLabourSchedule({ org_id, labour_id, date, site_ids }) {
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

    return {
        success: true,
        message: 'Daily schedule saved successfully'
    };
}

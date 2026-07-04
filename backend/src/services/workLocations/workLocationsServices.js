import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { cacheService } from '../cache/cacheService.js';

export async function getAllLocations({ org_id }) {
    const cacheKey = `mano-cache:locations:org:${org_id}`;
    
    // 1. Try cache read
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // 2. Fetch from DB on Cache Miss
    const locations = await attendanceDB('org_work_locations').where({ org_id });

    // 3. Write cache for future hits
    await cacheService.set(cacheKey, locations);

    return locations;
}

export async function createLocation({ org_id, location_name, address, latitude, longitude, radius }) {
    const [id] = await attendanceDB('org_work_locations').insert({
        org_id,
        location_name,
        address,
        latitude,
        longitude,
        radius: radius || 100
    });

    // Invalidate Cache
    await cacheService.del(`mano-cache:locations:org:${org_id}`);

    return id;
}

export async function updateLocation({ id, org_id, updates }) {
    const count = await attendanceDB('org_work_locations')
        .where({ location_id: id, org_id })
        .update(updates);

    // Invalidate Cache
    await cacheService.del(`mano-cache:locations:org:${org_id}`);

    return count;
}

export async function softDeleteLocation({ id, org_id }) {
    await attendanceDB('org_work_locations')
        .where({ location_id: id, org_id })
        .update({ is_active: 0 });

    // Invalidate Cache
    await cacheService.del(`mano-cache:locations:org:${org_id}`);
}

export async function bulkAssign({ org_id, assignments }) {
    if (!assignments || !Array.isArray(assignments)) {
        throw new AppError("Invalid input. 'assignments' array is required.", 400);
    }

    // Validate ownership of all locations
    const requestedLocIds = [...new Set(assignments.map(a => a.work_location_id).filter(id => id))];

    if (requestedLocIds.length > 0) {
        const validLocations = await attendanceDB('org_work_locations')
            .whereIn('location_id', requestedLocIds)
            .where({ org_id })
            .select('location_id');

        const validLocIdSet = new Set(validLocations.map(l => l.location_id));

        for (const reqId of requestedLocIds) {
            if (!validLocIdSet.has(reqId)) {
                throw new AppError(`Access Denied: Work Location ID ${reqId} does not belong to your organization.`, 403);
            }
        }
    }

    await attendanceDB.transaction(async (trx) => {
        for (const item of assignments) {
            const { work_location_id, add, remove } = item;

            if (!work_location_id) continue;

            if (remove && Array.isArray(remove) && remove.length > 0) {
                await trx('org_user_work_locations')
                    .where('location_id', work_location_id)
                    .whereIn('user_id', remove)
                    .del();
            }

            if (add && Array.isArray(add) && add.length > 0) {
                const dataToInsert = add.map(uid => ({
                    user_id: uid,
                    location_id: work_location_id
                }));

                await trx('org_user_work_locations')
                    .insert(dataToInsert)
                    .onConflict(['user_id', 'location_id'])
                    .ignore();
            }
        }
    });

    // Invalidate Cache
    await cacheService.del(`mano-cache:locations:org:${org_id}`);
}
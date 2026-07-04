import { attendanceDB } from '../../config/database.js';
import { uploadCompressedImage, deleteFile } from '../s3/s3Service.js';

/**
 * Upload and update a user's profile picture.
 */
export async function uploadProfilePicture(user_id, fileBuffer) {
    const user = await attendanceDB('core_users').where({ user_id }).select('user_code').first();
    const userCode = user?.user_code || `user_${user_id}`;

    const uploadResult = await uploadCompressedImage({
        fileBuffer,
        key: userCode,
        directory: 'public/profile_pics',
        quality: 90
    });

    await attendanceDB('core_users')
        .where({ user_id })
        .update({
            profile_image_url: uploadResult.url,
            updated_at: attendanceDB.fn.now()
        });

    return uploadResult.url;
}

/**
 * Delete a user's profile picture from S3 and clear the DB field.
 */
export async function deleteProfilePicture(user_id) {
    const user = await attendanceDB('core_users').where({ user_id }).select('user_code', 'profile_image_url').first();

    if (!user) return false;

    if (user.profile_image_url) {
        const userCode = user.user_code || `user_${user_id}`;
        const key = `${userCode}.webp`;

        try {
            await deleteFile({ key, directory: 'public/profile_pics' });
        } catch (error) {
            console.error('Error deleting file from S3:', error);
        }
    }

    await attendanceDB('core_users')
        .where({ user_id })
        .update({
            profile_image_url: null,
            updated_at: attendanceDB.fn.now()
        });

    return true;
}

/**
 * Get the current user's profile info.
 */
export async function getMyProfile(user_id) {
    const row = await attendanceDB('core_users as u')
        .leftJoin('org_designations as d', 'u.desg_id', 'd.desg_id')
        .leftJoin('org_departments as dep', 'u.dept_id', 'dep.dept_id')
        .select(
            'u.user_id',
            'u.user_name',
            'u.email',
            'u.phone_no',
            'u.user_type',
            'u.profile_image_url',
            'u.tour_dismissed',
            'u.pages_tour_seen',
            'd.desg_name',
            'dep.dept_name'
        )
        .where('u.user_id', user_id)
        .first();

    if (!row) return null;

    // Parse pages_tour_seen from JSON string to object
    let pagesTourSeen = {};
    if (row.pages_tour_seen) {
        try {
            pagesTourSeen = typeof row.pages_tour_seen === 'string'
                ? JSON.parse(row.pages_tour_seen)
                : row.pages_tour_seen;
        } catch (e) {
            pagesTourSeen = {};
        }
    }

    const tourDismissed = row.tour_dismissed === 1 || row.tour_dismissed === '1' || row.tour_dismissed === true || row.tour_dismissed === 'true';
    return { ...row, tour_dismissed: tourDismissed, pages_tour_seen: pagesTourSeen };
}

/**
 * Update user preferences (tour_dismissed, pages_tour_seen).
 */
export async function updatePreferences(user_id, updates) {
    const allowedUpdates = {};

    if (updates.tour_dismissed !== undefined) {
        allowedUpdates.tour_dismissed = updates.tour_dismissed;
    }

    // Support partial page-seen updates: { pages_tour_seen: { dashboard: true } }
    // Pass an empty object {} to fully reset all seen states.
    if (updates.pages_tour_seen !== undefined) {
        if (Object.keys(updates.pages_tour_seen).length === 0) {
            // Explicit reset — wipe all seen states
            allowedUpdates.pages_tour_seen = JSON.stringify({});
        } else {
            // Fetch existing value and merge
            const existing = await attendanceDB('core_users')
                .where({ user_id })
                .select('pages_tour_seen')
                .first();

            let current = {};
            if (existing?.pages_tour_seen) {
                try {
                    current = typeof existing.pages_tour_seen === 'string'
                        ? JSON.parse(existing.pages_tour_seen)
                        : existing.pages_tour_seen;
                } catch (e) {
                    current = {};
                }
            }

            const merged = { ...current, ...updates.pages_tour_seen };
            allowedUpdates.pages_tour_seen = JSON.stringify(merged);
        }
    }

    if (Object.keys(allowedUpdates).length > 0) {
        allowedUpdates.updated_at = attendanceDB.fn.now();
        await attendanceDB('core_users')
            .where({ user_id })
            .update(allowedUpdates);
    }
    return true;
}

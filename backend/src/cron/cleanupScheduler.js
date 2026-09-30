import cron from 'node-cron';
import { cronOptions } from './options.js';
import { attendanceDB } from '../config/database.js';
import { deleteFile } from '../services/s3/s3Service.js';
import { permanentlyDeleteUser } from '../modules/users/userService.js';
import * as MapsService from '../services/google_api_services/maps.js';
import { safeJsonParse } from '../utils/dataUtils.js';
import { deleteOrganization } from '../modules/organisations/orgDeletionService.js';


/**
 * Cleanup Old Refresh Tokens
 * Removes tokens expired or revoked for more than 7 days.
 */
async function cleanupRefreshTokens() {
    try {
        console.log('🧹 Starting refresh token cleanup...');

        const gracePeriodDays = 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

        const expiredCount = await attendanceDB('core_refresh_tokens')
            .where('expires_at', '<', cutoffDate)
            .del();

        const revokedCount = await attendanceDB('core_refresh_tokens')
            .where('revoked', true)
            .where('created_at', '<', cutoffDate)
            .del();

        console.log(`✅ Cleanup complete: ${expiredCount} expired tokens, ${revokedCount} revoked tokens deleted.`);
    } catch (error) {
        console.error('❌ Error during refresh token cleanup:', error);
    }
}

/**
 * Cleanup Old Attendance Images
 * Removes images from S3 and database for attendance records older than 30 days.
 */
async function cleanupAttendanceImages() {
    try {
        console.log('🧹 Starting attendance image cleanup...');

        const retentionDays = 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const oldPunches = await attendanceDB('attn_punches')
            .where('punch_time', '<', cutoffDate)
            .whereNotNull('metadata')
            .select('id', 'metadata');

        let deletedCount = 0;

        for (const punch of oldPunches) {
            let meta = {};
            try { meta = typeof punch.metadata === 'string' ? JSON.parse(punch.metadata) : (punch.metadata || {}); } catch (_) { }
            if (meta.image_key) {
                try {
                    await deleteFile({ key: meta.image_key });
                    deletedCount++;
                    delete meta.image_key;
                    await attendanceDB('attn_punches')
                        .where('id', punch.id)
                        .update({ metadata: JSON.stringify(meta) });
                } catch (err) {
                    console.error(`Failed to delete image ${meta.image_key}:`, err.message);
                }
            }
        }

        console.log(`✅ Cleanup complete: ${deletedCount} images deleted from ${oldPunches.length} records.`);
    } catch (error) {
        console.error('❌ Error during attendance image cleanup:', error);
    }
}

/**
 * Cleanup Soft Deleted Users
 * Permanently deletes users who have been in trash for more than 30 days.
 */
async function cleanupDeletedUsers() {
    try {
        console.log('🧹 Running cleanupDeletedUsers...');

        const retentionDays = 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const usersToDelete = await attendanceDB('core_users')
            .where('is_deleted', true)
            .andWhere('deleted_at', '<', cutoffDate)
            .select('user_id');

        console.log(`Found ${usersToDelete.length} users to permanently delete.`);

        for (const user of usersToDelete) {
            await permanentlyDeleteUser(user.user_id);
        }

        if (usersToDelete.length > 0) {
            console.log('✅ Cleanup of deleted users completed.');
        }
    } catch (error) {
        console.error('❌ Error cleaning up deleted users:', error);
    }
}

/**
 * Cleanup Organizations Pending Deletion
 * Permanently deletes organizations (and all associated data) whose
 * deletion_scheduled_at date has passed.
 */
async function cleanupDeletedOrganizations() {
    try {
        console.log('🧹 Running cleanupDeletedOrganizations...');

        const now = new Date();

        const orgsToDelete = await attendanceDB('core_organizations')
            .where('status', 'pending_deletion')
            .andWhere('deletion_scheduled_at', '<=', now)
            .select('org_id', 'org_name', 'org_code');

        console.log(`Found ${orgsToDelete.length} organization(s) to permanently delete.`);

        // One org at a time; a failure leaves that org pending_deletion so the
        // next nightly run resumes it (see orgDeletionService)
        for (const org of orgsToDelete) {
            try {
                const result = await deleteOrganization(org.org_id);
                console.log(`🗑️  Permanently deleted organization: ${org.org_name} (${org.org_code}) — ${result.rowsDeleted} rows, ${result.filesDeleted} files${result.fileDeleteFailures ? `, ${result.fileDeleteFailures} file deletions failed` : ''}`);
            } catch (err) {
                console.error(`❌ Failed to delete organization ${org.org_name} (${org.org_code}); will retry on the next run:`, err);
            }
        }

        if (orgsToDelete.length > 0) {
            console.log('✅ Cleanup of pending-deletion organizations completed.');
        }
    } catch (error) {
        console.error('❌ Error cleaning up pending-deletion organizations:', error);
    }
}

/**
 * Deactivate Expired Organizations
 * Automatically switches the status of organizations whose subscription expiry
 * date plus grace period has passed to 'inactive'.
 */
export async function deactivateExpiredOrganizations() {
    try {
        console.log('🧹 Running deactivateExpiredOrganizations...');
        const now = new Date();

        // Find all active organizations with subscription_expiry in the past (including grace period)
        const expiredOrgs = await attendanceDB('core_organizations')
            .where('status', 'active')
            .whereNotNull('subscription_expiry')
            .andWhereRaw('DATE_ADD(subscription_expiry, INTERVAL COALESCE(grace_period_days, 0) DAY) < ?', [now]);

        console.log(`Found ${expiredOrgs.length} expired organization(s) to deactivate.`);

        for (const org of expiredOrgs) {
            await attendanceDB('core_organizations')
                .where('org_id', org.org_id)
                .update({
                    status: 'inactive',
                    updated_at: attendanceDB.fn.now()
                });
            console.log(`Deactivated expired organization: ${org.org_name} (expired on ${org.subscription_expiry})`);
        }
    } catch (error) {
        console.error('❌ Error deactivating expired organizations:', error);
    }
}

/**
 * Geocode Repair Job
 * Finds attn_punches with stale addresses ('Locating...' / 'Pending...') and resolves them via Google Maps.
 * Runs on a short interval to quickly fix recently-created punches.
 */
async function repairStalePunchAddresses() {
    try {
        // Find up to 20 stale in/out punches created in the last 24 hours
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - 24);

        const stalePunches = await attendanceDB('attn_punches')
            .whereNull('deleted_at')
            .where('created_at', '>=', cutoff)
            .whereRaw("JSON_EXTRACT(location, '$.address') IN ('Locating...', 'Pending...')")
            .select('id', 'location', 'punch_type', 'user_id')
            .limit(20);

        if (stalePunches.length === 0) return;

        console.log(`🔧 [GeoRepair] Found ${stalePunches.length} stale punch(es) to geocode.`);

        for (const punch of stalePunches) {
            try {
                const loc = safeJsonParse(punch.location);
                if (!loc.lat || !loc.lng || isNaN(loc.lat) || isNaN(loc.lng)) continue;

                const geoRes = await MapsService.coordsToAddress(loc.lat, loc.lng);
                const resolvedAddress = (geoRes && geoRes.address) ? geoRes.address : 'Unknown Location';

                loc.address = resolvedAddress;
                await attendanceDB('attn_punches').where({ id: punch.id }).update({
                    location: JSON.stringify(loc)
                });


                console.log(`✅ [GeoRepair] Resolved address for punch #${punch.id}: ${resolvedAddress}`);
            } catch (punchErr) {
                console.warn(`⚠️ [GeoRepair] Failed to geocode punch #${punch.id}:`, punchErr.message);
            }
        }
    } catch (error) {
        console.error('❌ [GeoRepair] Error in geocoding repair job:', error);
    }
}

/**
 * API Request Log Retention
 * sys_api_logs gets a row per HTTP request and was never pruned. Rows older
 * than API_LOG_RETENTION_DAYS (default 90; the analytics screen shows at most
 * 30 days) are deleted in chunks so the table is never locked for long.
 */
export async function cleanupApiLogs() {
    try {
        const retentionDays = Number(process.env.API_LOG_RETENTION_DAYS) || 90;
        let total = 0;
        for (;;) {
            const deleted = await attendanceDB('sys_api_logs')
                .where('occurred_at', '<', attendanceDB.raw('NOW() - INTERVAL ? DAY', [retentionDays]))
                .limit(10000)
                .del();
            total += deleted;
            if (deleted < 10000) break;
        }
        console.log(`✅ API log cleanup: ${total} rows older than ${retentionDays} days deleted.`);
    } catch (error) {
        console.error('❌ Error during API log cleanup:', error);
    }
}

/**
 * Run all cleanup tasks.
 */
export async function runCleanup() {
    console.log('🚀 Running scheduled cleanup tasks...');
    await cleanupRefreshTokens();
    // await cleanupAttendanceImages(); // Temporarily disabled
    await cleanupDeletedUsers();
    await cleanupDeletedOrganizations();
    await deactivateExpiredOrganizations();
    await cleanupApiLogs();
    console.log('✅ All cleanup tasks completed.');
}

/**
 * Initialize the cleanup scheduler.
 * Runs every day at 2:00 AM.
 */
export function initCleanupScheduler() {
    const tasks = [
        cron.schedule('0 2 * * *', async () => {
            try {
                await runCleanup();
            } catch (err) {
                console.error('Error during scheduled cleanup:', err);
            }
        }, cronOptions('daily-cleanup')),

        // Repair stale geocoding entries every 15 minutes
        cron.schedule('*/15 * * * *', async () => {
            try {
                await repairStalePunchAddresses();
            } catch (err) {
                console.warn('Notice during geocoding repair job:', err?.message || err);
            }
        }, cronOptions('geocode-repair')),
    ];

    // Run repair once immediately on startup to fix any existing stale addresses
    setImmediate(() => repairStalePunchAddresses().catch(err => console.warn('Notice during initial geocoding repair:', err?.message || err)));

    console.log('📅 Cleanup scheduler initialized: Daily at 2:00 AM | Geocoding repair: Every 15 minutes');
    return tasks;
}

export { repairStalePunchAddresses };

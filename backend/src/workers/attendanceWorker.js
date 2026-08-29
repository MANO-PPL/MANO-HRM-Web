import { Worker } from 'bullmq';
import fs from 'fs/promises';
import { redisConnection } from '../config/queues.js';
import { attendanceDB } from '../config/database.js';
import * as S3Service from '../services/s3/s3Service.js';
import * as MapsService from '../services/google_api_services/maps.js';
import EventBus from '../utils/EventBus.js';

function safeParseJSON(val) {
    if (!val) return {};
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return {}; }
}

export async function processAttendanceJob(jobData) {
    const {
        attendance_id,
        isTimeIn,
        tempFilePath,
        latitude,
        longitude,
        accuracy,
        ip,
        user_agent,
        event_source,
        org_id,
        user_id,
        session_number,
        status
    } = jobData;

    console.log(`👷 [AttendanceWorker] Processing check-${isTimeIn ? 'in' : 'out'} job #${attendance_id} for User ${user_id}...`);

    // 1. Fetch Geocoded Address from Google Maps (Slow API call)
    let address = 'Unknown Location';
    try {
        if (!isNaN(latitude) && !isNaN(longitude)) {
            const addrRes = await MapsService.coordsToAddress(latitude, longitude);
            if (addrRes && addrRes.address) {
                address = addrRes.address;
            }
        }
    } catch (e) {
        console.error(`Maps Geocoding API error for job #${attendance_id}:`, e);
    }

    // Update attn_punches (new schema)
    try {
        const punch = await attendanceDB('attn_punches').where({ id: attendance_id }).first();
        if (punch) {
            const loc = safeParseJSON(punch.location);
            loc.address = address;
            await attendanceDB('attn_punches').where({ id: attendance_id }).update({
                location: JSON.stringify(loc)
            });
        }
    } catch (err) {
        console.error(`Failed to update attn_punches address for #${attendance_id}:`, err);
    }

    // Update legacy DB record with the resolved address
    try {
        const addressField = isTimeIn ? 'time_in_address' : 'time_out_address';
        await attendanceDB('attn_records')
            .where({ attendance_id })
            .update({
                [addressField]: address,
                updated_at: attendanceDB.fn.now()
            });
    } catch (e) {}

    // 2. Compress Selfie Image and Upload to AWS S3 (Slow CPU & S3 Upload task)
    let imageKey = null;
    if (tempFilePath) {
        try {
            // Read temp file from disk
            const fileBuffer = await fs.readFile(tempFilePath);
            console.log(`[AttendanceWorker] Read temp file (${fileBuffer.length} bytes) for S3 upload.`);

            const uploadResult = await S3Service.uploadCompressedImage({
                fileBuffer,
                key: isTimeIn ? `${attendance_id}_in` : `${attendance_id}_out`,
                directory: 'attendance_images'
            });
            imageKey = uploadResult.key;

            // Update attn_punches metadata with the uploaded S3 image key
            try {
                const punch = await attendanceDB('attn_punches').where({ id: attendance_id }).first();
                if (punch) {
                    const meta = safeParseJSON(punch.metadata);
                    meta.image_key = imageKey;
                    await attendanceDB('attn_punches').where({ id: attendance_id }).update({
                        metadata: JSON.stringify(meta)
                    });
                }
            } catch (pErr) {
                console.error(`Failed to update attn_punches image_key for #${attendance_id}:`, pErr);
            }

            // Update legacy DB record with the uploaded S3 image key
            try {
                const imageKeyField = isTimeIn ? 'time_in_image_key' : 'time_out_image_key';
                await attendanceDB('attn_records')
                    .where({ attendance_id })
                    .update({
                        [imageKeyField]: imageKey,
                        updated_at: attendanceDB.fn.now()
                    });
            } catch (e) {}

            console.log(`✅ [AttendanceWorker] Successfully uploaded selfie to S3 with key: ${imageKey}`);
        } catch (err) {
            console.error(`❌ [AttendanceWorker] Failed S3 compression/upload for job #${attendance_id}:`, err);
        } finally {
            // Clean up the temp file from disk
            try {
                await fs.unlink(tempFilePath);
                console.log(`🧹 [AttendanceWorker] Cleaned up temp file: ${tempFilePath}`);
            } catch (unlinkErr) {
                console.error(`Failed to delete temp file ${tempFilePath}:`, unlinkErr);
            }
        }
    }

    // 3. Log EventBus Activity
    try {
        if (isTimeIn) {
            EventBus.emitActivityLog({
                user_id,
                org_id,
                event_type: 'CHECK_IN',
                event_source: event_source || 'WEB',
                object_type: 'ATTENDANCE',
                object_id: attendance_id,
                description: `User checked in at ${address} (Session #${session_number})`,
                location: `${latitude},${longitude}`,
                request_ip: ip,
                user_agent: user_agent
            });
        } else {
            EventBus.emitActivityLog({
                user_id,
                org_id,
                event_type: 'CHECK_OUT',
                event_source: event_source || 'WEB',
                object_type: 'ATTENDANCE',
                object_id: attendance_id,
                description: `User checked out at ${address} (Status: ${status})`,
                location: `${latitude},${longitude}`,
                request_ip: ip,
                user_agent: user_agent
            });
        }
    } catch (eventErr) {
        console.error(`[AttendanceWorker] Failed to emit EventBus log:`, eventErr);
    }

    console.log(`🏁 [AttendanceWorker] Completed background tasks for check-${isTimeIn ? 'in' : 'out'} job #${attendance_id}`);
}

const attendanceWorker = new Worker('{AttendanceQueue}', async (job) => {
    return processAttendanceJob(job.data);
}, {
    connection: redisConnection,
    concurrency: 4 // Max 4 concurrent check-ins/outs processed in parallel
});

attendanceWorker.on('completed', (job) => {
    console.log(`🏁 [AttendanceWorker] Job #${job.id} completed.`);
});

attendanceWorker.on('failed', (job, err) => {
    console.error(`💥 [AttendanceWorker] Job #${job.id} failed with error:`, err);
});

attendanceWorker.on('error', (err) => {
    // Suppressed or logged by connection error handler
});

export default attendanceWorker;

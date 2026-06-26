import cron from 'node-cron';
import { attendanceDB } from '../config/database.js';
import { syncDailyAttendance } from '../services/attendance/attendanceService.js';
import * as ShiftService from '../services/attendance/shiftManagementService.js';
import { resolveNoShowStatus } from '../services/attendance/statusEvaluationService.js';
import EventBus from '../utils/EventBus.js';

// Grace period (in days) before an uncorrected MISSED_PUNCH becomes ABSENT
const MISSED_PUNCH_GRACE_DAYS = 2;

/**
 * Hourly Attendance Processor
 * Runs every hour to check which users have completed their logical "Yesterday"
 * matching the processing window in their timezone.
 */
export async function processHourlyAttendance() {
    console.log('⏰ Hourly Attendance Check Started...');

    const users = await attendanceDB('users')
        .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
        .leftJoin('user_work_locations', 'users.user_id', 'user_work_locations.user_id')
        .leftJoin('work_locations', 'user_work_locations.location_id', 'work_locations.location_id')
        .leftJoin('organizations', 'users.org_id', 'organizations.org_id')
        .whereNotNull('users.org_id')
        .where('users.is_deleted', 0)
        .where('users.is_active', 1)
        .select(
            'users.user_id',
            'users.org_id',
            'users.shift_id',
            'shifts.*',
            'work_locations.timezone',
            'organizations.timezone as org_timezone'
        );

    for (const user of users) {
        try {
            // ... (timezone logic remains same)
            let timeZone = user.org_timezone || 'UTC';

            const lastRecord = await attendanceDB('attendance_records')
                .where({ user_id: user.user_id })
                .orderBy('created_at', 'desc')
                .limit(1)
                .first();

            if (lastRecord && lastRecord.metadata) {
                try {
                    let meta = lastRecord.metadata;
                    if (typeof meta === 'string') meta = JSON.parse(meta);
                    if (meta?.time_in?.timezone) {
                        timeZone = meta.time_in.timezone;
                    }
                } catch (e) {
                    console.warn(`Failed to parse metadata for user ${user.user_id}`, e);
                }
            }

            // Validate timezone
            try {
                Intl.DateTimeFormat(undefined, { timeZone });
            } catch (e) {
                timeZone = 'UTC';
            }

            const nowInUserTZ = new Date(new Date().toLocaleString('en-US', { timeZone }));
            const currentHour = nowInUserTZ.getHours();

            // Target Window: Shift's processing_time (default 02:00)
            let targetHour = 2;
            if (user.processing_time) {
                const [h] = user.processing_time.split(':');
                targetHour = parseInt(h, 10);
            }

            // Shift target processing hour to a daytime hour (10:00 AM) if it falls at midnight or late night (12 AM - 5 AM)
            if (targetHour >= 0 && targetHour <= 5) {
                targetHour = 10;
            }

            if (currentHour === targetHour) {
                const yesterday = new Date(nowInUserTZ);
                yesterday.setDate(yesterday.getDate() - 1);
                const yyyy = yesterday.getFullYear();
                const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
                const dd = String(yesterday.getDate()).padStart(2, '0');
                const targetDate = `${yyyy}-${mm}-${dd}`;

                await processUserAttendanceForDate(user, targetDate);
            }
        } catch (err) {
            console.error(`Failed to process user ${user.user_id}:`, err);
        }
    }

    // --- SECOND PASS: Escalate expired MISSED_PUNCH to ABSENT ---
    await escalateExpiredMissedPunches();

    console.log('✅ Hourly Attendance Check Completed.');
}

/**
 * Process a single user's attendance for a specific date.
 * - If they checked in but never checked out → flag as MISSED_PUNCH (NO auto-checkout)
 * - If they never showed up → mark ABSENT/WEEK_OFF/HOLIDAY/LEAVE
 */
async function processUserAttendanceForDate(user, dateStr) {
    const record = await attendanceDB('daily_attendance')
        .where({ user_id: user.user_id, date: dateStr })
        .first();

    // Parse Shift Rules using Service (now includes week_off_policy)
    const rules = ShiftService.getShiftRules(user);

    // 1. Check for any open sessions (forgot to checkout)
    const openSessions = await attendanceDB('attendance_records')
        .where({ user_id: user.user_id })
        .whereNull('time_out')
        .whereRaw('DATE(time_in) = ?', [dateStr]);

    if (openSessions.length > 0) {
        console.log(`⚠️ User ${user.user_id} has ${openSessions.length} open sessions on ${dateStr}. Marking as MISSED_PUNCH.`);

        for (const openSession of openSessions) {
            // Only flag sessions that haven't already been flagged
            if (openSession.status === 'MISSED_PUNCH') continue;

            let metadata = {};
            try {
                metadata = typeof openSession.metadata === 'string'
                    ? JSON.parse(openSession.metadata)
                    : (openSession.metadata || {});
            } catch (e) {
                console.warn(`Failed to parse metadata for session ${openSession.attendance_id}`);
            }

            metadata.missed_punch = {
                flagged_at: new Date().toISOString(),
                reason: "Employee did not check out"
            };

            // Flag the session as MISSED_PUNCH — DO NOT set time_out
            await attendanceDB('attendance_records')
                .where({ attendance_id: openSession.attendance_id })
                .update({
                    status: 'MISSED_PUNCH',
                    metadata: JSON.stringify(metadata),
                    updated_at: attendanceDB.fn.now()
                });
        }

        // Sync daily attendance as MISSED_PUNCH
        try {
            await syncDailyAttendance(user.user_id, dateStr, { status: 'MISSED_PUNCH' });
        } catch (err) {
            console.error(`Failed to sync daily attendance for user ${user.user_id}:`, err);
        }

        // Send notification to user
        EventBus.emitNotification({
            org_id: user.org_id,
            user_id: user.user_id,
            title: "Missed Time Out",
            message: `You forgot to check out on ${dateStr}. Please submit a correction request to fix your hours, otherwise it will be marked as absent.`,
            type: "WARNING",
            related_entity_type: "ATTENDANCE",
            related_entity_id: null
        });

        // Even if we found missed punches, we still check the record below 
        // to handle other fields (like holidays/leaves) if necessary, 
        // but MISSED_PUNCH status will now persist due to StatusService priority fix.
    }

    if (record) {
        // Daily record exists — if it wasn't a missed punch, it's already updated via syncDailyAttendance above 
        // or during the day. No further action needed here for existing records.
    } else if (openSessions.length === 0) {
        // Missing record: determine status using the centralized no-show resolver
        const holiday = await attendanceDB('holidays')
            .where({ org_id: user.org_id, holiday_date: dateStr })
            .first();

        const leave = await attendanceDB('leave_request as lr')
            .leftJoin('leave_policies_rules as lpr', 'lr.rule_id', 'lpr.rule_id')
            .select('lr.*', 'lpr.name as leave_type')
            .where({ 'lr.user_id': user.user_id, 'lr.status': 'Approved' })
            .where('lr.start_date', '<=', dateStr)
            .where('lr.end_date', '>=', dateStr)
            .first();

        const { status, remarks } = resolveNoShowStatus({ dateStr, rules, holiday, leave });

        await attendanceDB('daily_attendance').insert({
            user_id: user.user_id,
            org_id: user.org_id,
            date: dateStr,
            status,
            created_at: attendanceDB.fn.now(),
            updated_at: attendanceDB.fn.now()
        });

        console.log(`📝 Marked User ${user.user_id} as ${status} for ${dateStr}`);
    }
}

/**
 * Escalate MISSED_PUNCH sessions that have exceeded the grace period
 * without a correction request being submitted or approved.
 * After MISSED_PUNCH_GRACE_DAYS days, the daily record is changed to ABSENT.
 */
async function escalateExpiredMissedPunches() {
    // Find all MISSED_PUNCH daily records
    const records = await attendanceDB('daily_attendance')
        .where({ status: 'MISSED_PUNCH' });

    for (const record of records) {
        try {
            // Fetch user, shift rules, and timezone settings
            const user = await attendanceDB('users')
                .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
                .leftJoin('user_work_locations', 'users.user_id', 'user_work_locations.user_id')
                .leftJoin('work_locations', 'user_work_locations.location_id', 'work_locations.location_id')
                .leftJoin('organizations', 'users.org_id', 'organizations.org_id')
                .where('users.user_id', record.user_id)
                .select(
                    'shifts.*',
                    'work_locations.timezone',
                    'organizations.timezone as org_timezone'
                )
                .first();

            if (!user) continue;

            // Resolve timezone
            let timeZone = user.org_timezone || 'UTC';
            // Validate timezone
            try {
                Intl.DateTimeFormat(undefined, { timeZone });
            } catch (e) {
                timeZone = 'UTC';
            }

            const nowInUserTZ = new Date(new Date().toLocaleString('en-US', { timeZone }));
            const currentHour = nowInUserTZ.getHours();

            // Only run the escalation logic and send the "Attendance Marked Absent" notification at 10:00 AM in the user's local timezone
            if (currentHour !== 10) {
                continue;
            }

            const rules = ShiftService.getShiftRules(user);
            const graceDays = rules.correction_deadline || 2;

            // Calculate if the record is expired
            const recordDate = new Date(record.date);
            recordDate.setHours(0, 0, 0, 0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const diffTime = today - recordDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= graceDays) {
                // Still within grace period
                continue;
            }

            // Check if user has submitted an approved/pending correction for this date
            const correction = await attendanceDB('attendance_correction_requests')
                .where({ user_id: record.user_id, request_date: record.date })
                .whereIn('status', ['pending', 'approved'])
                .first();

            if (correction) {
                // Correction exists — skip escalation
                continue;
            }

            // No correction submitted — escalate to ABSENT
            await attendanceDB('daily_attendance')
                .where({ user_id: record.user_id, date: record.date })
                .update({
                    status: 'ABSENT',
                    updated_at: attendanceDB.fn.now()
                });

            // Also update the attendance_records status
            await attendanceDB('attendance_records')
                .where({ user_id: record.user_id })
                .whereRaw('DATE(time_in) = ?', [record.date])
                .where({ status: 'MISSED_PUNCH' })
                .update({
                    status: 'ABSENT',
                    updated_at: attendanceDB.fn.now()
                });

            // Notify the user
            EventBus.emitNotification({
                org_id: record.org_id,
                user_id: record.user_id,
                title: "Attendance Marked Absent",
                message: `Your attendance for ${record.date} has been marked as ABSENT because the missed checkout was not corrected within ${graceDays} days.`,
                type: "ERROR",
                related_entity_type: "ATTENDANCE",
                related_entity_id: null
            });

            console.log(`🚫 Escalated User ${record.user_id} from MISSED_PUNCH to ABSENT for ${record.date} (Grace: ${graceDays}d)`);
        } catch (err) {
            console.error(`Failed to escalate MISSED_PUNCH for user ${record.user_id} on ${record.date}:`, err);
        }
    }
}

/**
 * Check if users need a time-in or time-out reminder (10 minutes before shift start/end)
 */
export async function checkAndSendShiftReminders() {
    const users = await attendanceDB('users')
        .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
        .leftJoin('user_work_locations', 'users.user_id', 'user_work_locations.user_id')
        .leftJoin('work_locations', 'user_work_locations.location_id', 'work_locations.location_id')
        .leftJoin('organizations', 'users.org_id', 'organizations.org_id')
        .whereNotNull('users.org_id')
        .where('users.is_deleted', 0)
        .where('users.is_active', 1)
        .select(
            'users.user_id',
            'users.org_id',
            'users.shift_id',
            'shifts.*',
            'work_locations.timezone',
            'organizations.timezone as org_timezone'
        );

    for (const user of users) {
        if (!user.shift_id) continue;

        try {
            const rules = ShiftService.getShiftRules(user);
            const startTime = rules.shift_timing?.start_time; // e.g. "09:00:00"
            const endTime = rules.shift_timing?.end_time; // e.g. "18:00:00"

            if (!startTime || !endTime) continue;

            let timeZone = user.org_timezone || 'UTC';
            try {
                Intl.DateTimeFormat(undefined, { timeZone });
            } catch (e) {
                timeZone = 'UTC';
            }

            const nowInUserTZ = new Date(new Date().toLocaleString('en-US', { timeZone }));
            const currentHour = nowInUserTZ.getHours();
            const currentMinute = nowInUserTZ.getMinutes();
            const currentMinutes = currentHour * 60 + currentMinute;

            // 1. Time-In Reminder (10 mins before start)
            const [startH, startM] = startTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const timeInReminderMinutes = (startMinutes - 10 + 1440) % 1440;

            if (currentMinutes === timeInReminderMinutes) {
                const yyyy = nowInUserTZ.getFullYear();
                const mm = String(nowInUserTZ.getMonth() + 1).padStart(2, '0');
                const dd = String(nowInUserTZ.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;

                // Check if user has already timed in today
                const record = await attendanceDB('attendance_records')
                    .where({ user_id: user.user_id })
                    .whereRaw('DATE(time_in) = ?', [dateStr])
                    .first();

                if (!record) {
                    EventBus.emitNotification({
                        org_id: user.org_id,
                        user_id: user.user_id,
                        title: "Time In Reminder",
                        message: `Your shift starts in 10 minutes at ${startTime.substring(0, 5)}. Don't forget to time in!`,
                        type: "INFO",
                        related_entity_type: "ATTENDANCE",
                        related_entity_id: null
                    });
                }
            }

            // 2. Time-Out Reminder (10 mins before end)
            const [endH, endM] = endTime.split(':').map(Number);
            const endMinutes = endH * 60 + endM;
            const timeOutReminderMinutes = (endMinutes - 10 + 1440) % 1440;

            if (currentMinutes === timeOutReminderMinutes) {
                // Check if user has an active open session
                const openSession = await attendanceDB('attendance_records')
                    .where({ user_id: user.user_id })
                    .whereNull('time_out')
                    .first();

                if (openSession) {
                    EventBus.emitNotification({
                        org_id: user.org_id,
                        user_id: user.user_id,
                        title: "Time Out Reminder",
                        message: `Your shift ends in 10 minutes at ${endTime.substring(0, 5)}. Don't forget to time out!`,
                        type: "INFO",
                        related_entity_type: "ATTENDANCE",
                        related_entity_id: null
                    });
                }
            }
        } catch (err) {
            console.error(`Failed to process reminders for user ${user.user_id}:`, err);
        }
    }
}

/**
 * Initialize the hourly attendance processor cron job.
 */
export function initAttendanceProcessor() {
    cron.schedule('0 * * * *', processHourlyAttendance);
    cron.schedule('* * * * *', checkAndSendShiftReminders);
    console.log('🚀 Hourly Attendance Processor Scheduled');
}

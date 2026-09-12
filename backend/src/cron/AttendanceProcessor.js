import cron from 'node-cron';
import { attendanceDB } from '../config/database.js';
import { syncDailyAttendance } from '../services/attendance/attendanceService.js';
import * as ShiftService from '../services/attendance/shiftManagementService.js';
import { resolveNoShowStatus } from '../services/attendance/statusEvaluationService.js';
import EventBus from '../utils/EventBus.js';
import { PayrollCalculationService } from '../services/payroll/PayrollCalculationService.js';
import { DEFAULT_MAX_OVERTIME_HOURS, normalizeMaxOvertimeHours } from '../services/shifts/shiftService.js';
import { toMySQLDateTime, toMySQLDate } from '../utils/dateUtils.js';
import { reconcileUserDarForDate } from '../services/darServices/darReconciliationService.js';


// Grace period (in days) before an uncorrected MISSED_PUNCH becomes ABSENT
const MISSED_PUNCH_GRACE_DAYS = 2;
// Time allowed after the configured maximum overtime before an open checkout is flagged.
const MISSED_PUNCH_BUFFER_MINUTES = 30;
const CRON_INTERVAL_MINUTES = 30;

function getNextCronSlotMinutes(totalMinutes) {
    return (Math.ceil(totalMinutes / CRON_INTERVAL_MINUTES) * CRON_INTERVAL_MINUTES) % (24 * 60);
}

/**
 * Attendance Processor
 * Runs every 30 minutes to check which users have completed their logical "Yesterday"
 * matching the processing window in their timezone.
 */
export async function processHourlyAttendance() {
    try {
        console.log('⏰ Attendance Check Started...');

        const users = await attendanceDB('core_users')
        .leftJoin('org_shifts', 'core_users.shift_id', 'org_shifts.shift_id')
        .leftJoin('org_user_work_locations', 'core_users.user_id', 'org_user_work_locations.user_id')
        .leftJoin('org_work_locations', 'org_user_work_locations.location_id', 'org_work_locations.location_id')
        .leftJoin('core_organizations', 'core_users.org_id', 'core_organizations.org_id')
        .where('core_users.is_deleted', 0)
        .where('core_users.is_active', 1)
        .select(
            'core_users.user_id',
            'core_users.shift_id',
            'org_shifts.*',
            'core_users.org_id',
            'org_work_locations.timezone',
            'core_organizations.timezone as org_timezone'
        );

    for (const user of users) {
        try {
            // 1. Calculate target processing slot in-memory first (no DB queries)
            let endTime = '18:00:00';
            if (user.end_time) {
                endTime = user.end_time;
            } else {
                try {
                    let rules = user.policy_rules;
                    if (typeof rules === 'string') rules = JSON.parse(rules);
                    if (rules?.shift_timing?.end_time) {
                        endTime = rules.shift_timing.end_time;
                    }
                } catch (e) {}
            }

            let maxOvertime = DEFAULT_MAX_OVERTIME_HOURS;
            try {
                let rules = user.policy_rules;
                if (typeof rules === 'string') rules = JSON.parse(rules);
                if (rules?.overtime?.enabled === false) {
                    maxOvertime = 0;
                } else if (rules?.overtime?.max_overtime !== undefined) {
                    maxOvertime = normalizeMaxOvertimeHours(rules.overtime.max_overtime);
                } else if (rules?.overtime?.maxOvertime !== undefined) {
                    maxOvertime = normalizeMaxOvertimeHours(rules.overtime.maxOvertime);
                }
            } catch (e) {}

            const [endH, endM] = endTime.split(':').map(Number);
            const latestCheckoutMinutes = (endH * 60) + endM + (maxOvertime * 60) + MISSED_PUNCH_BUFFER_MINUTES;
            const calculatedSlotMinutes = getNextCronSlotMinutes(latestCheckoutMinutes);

            let targetSlotMinutes = calculatedSlotMinutes;
            if (user.processing_time && user.processing_time !== '02:00:00') {
                const [h, m] = user.processing_time.split(':').map(Number);
                targetSlotMinutes = getNextCronSlotMinutes((h * 60) + (m || 0));
            }

            // Quick timezone check with the default timezone (no DB query needed)
            let baseTimeZone = user.timezone || user.org_timezone || 'UTC';
            try {
                Intl.DateTimeFormat(undefined, { timeZone: baseTimeZone });
            } catch (e) {
                baseTimeZone = 'UTC';
            }

            const tempNow = new Date(new Date().toLocaleString('en-US', { timeZone: baseTimeZone }));
            const baseSlotMinutes = (tempNow.getHours() * 60) + (Math.floor(tempNow.getMinutes() / CRON_INTERVAL_MINUTES) * CRON_INTERVAL_MINUTES);

            // Skip database queries when it is not the user's processing slot
            if (baseSlotMinutes !== targetSlotMinutes) {
                continue;
            }

            // Only query DB to fetch custom timezone override when the base slot matches
            let timeZone = baseTimeZone;
            const lastPunch = await attendanceDB('attn_punches')
                .where({ user_id: user.user_id })
                .whereNull('deleted_at')
                .orderBy('punch_time', 'desc')
                .limit(1)
                .first();

            if (lastPunch && lastPunch.metadata) {
                try {
                    let meta = lastPunch.metadata;
                    if (typeof meta === 'string') meta = JSON.parse(meta);
                    if (meta?.timezone || meta?.time_in?.timezone) {
                        timeZone = meta.timezone || meta.time_in.timezone;
                        // Re-validate custom timezone
                        try {
                            Intl.DateTimeFormat(undefined, { timeZone });
                        } catch (e) {
                            timeZone = baseTimeZone;
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to parse metadata for user ${user.user_id}`, e);
                }
            }

            const nowInUserTZ = new Date(new Date().toLocaleString('en-US', { timeZone }));
            const currentSlotMinutes = (nowInUserTZ.getHours() * 60) + (Math.floor(nowInUserTZ.getMinutes() / CRON_INTERVAL_MINUTES) * CRON_INTERVAL_MINUTES);

            // Determine if the shift is a night shift
            let isNightShift = false;
            if (user.crosses_midnight === 1 || user.crosses_midnight === true) {
                isNightShift = true;
            } else {
                // Heuristic fallback if crosses_midnight column is null
                let startTime = '09:00:00';
                if (user.start_time) {
                    startTime = user.start_time;
                } else {
                    try {
                        let rules = user.policy_rules;
                        if (typeof rules === 'string') rules = JSON.parse(rules);
                        if (rules?.shift_timing?.start_time) {
                            startTime = rules.shift_timing.start_time;
                        }
                    } catch (e) {}
                }
                const [startH] = startTime.split(':').map(Number);
                isNightShift = (endH < startH) || (startH >= 17 || startH < 6);
            }

            const isNextDayCheck = isNightShift || latestCheckoutMinutes >= (24 * 60);

            if (currentSlotMinutes === targetSlotMinutes) {
                const targetDateObj = new Date(nowInUserTZ);
                if (isNextDayCheck) {
                    targetDateObj.setDate(targetDateObj.getDate() - 1);
                }
                const yyyy = targetDateObj.getFullYear();
                const mm = String(targetDateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(targetDateObj.getDate()).padStart(2, '0');
                const targetDate = `${yyyy}-${mm}-${dd}`;

                await processUserAttendanceForDate(user, targetDate);
            }
        } catch (err) {
            console.error(`Failed to process user ${user.user_id}:`, err);
        }
    }

    // --- SECOND PASS: Escalate expired MISSED_PUNCH to ABSENT (Bypassed / disabled since correction deadline is turned off) ---
    // await escalateExpiredMissedPunches();

    console.log('✅ Attendance Check Completed.');
    } catch (err) {
        if (err?.code === 'ECONNRESET' || err?.message?.includes('ECONNRESET')) {
            console.warn('⚠️ [AttendanceProcessor] Database connection reset during hourly attendance check. Will retry next cycle.');
            return;
        }
        console.error('Failed to complete processHourlyAttendance:', err);
    }
}

/**
 * Process a single user's attendance for a specific date.
 * - If they checked in but never checked out → flag as MISSED_PUNCH (NO auto-checkout)
 * - If they never showed up → mark ABSENT/WEEK_OFF/HOLIDAY/LEAVE
 */
async function processUserAttendanceForDate(user, dateStr) {
    const record = await attendanceDB('attn_daily_summary_v2')
        .where({ user_id: user.user_id, date: dateStr })
        .first();

    // Parse Shift Rules using Service (now includes week_off_policy)
    const rules = ShiftService.getShiftRules(user);

    // 1. Check for any open sessions (forgot to checkout)
    let hasPunchOpenSession = false;
    let latestInPunch = null;
    try {
        const punches = await attendanceDB("attn_punches")
            .where({ user_id: user.user_id })
            .whereNull("deleted_at")
            .whereIn("punch_type", ["in", "out"])
            .whereRaw("DATE(punch_time) = ?", [dateStr])
            .orderBy("punch_time", "asc")
            .orderBy("id", "asc");

        if (punches.length > 0) {
            const last = punches[punches.length - 1];
            if (last.punch_type === "in") {
                hasPunchOpenSession = true;
                latestInPunch = last;
            }
        }
    } catch (_) {}

    if (hasPunchOpenSession) {
        if (user.shift_id === null) {
            console.log(`ℹ️ User ${user.user_id} has open session on ${dateStr} (Open Shift). Auto-completing session.`);
            if (latestInPunch) {
                const checkInDate = new Date(latestInPunch.punch_time);
                const checkOutDate = new Date(checkInDate.getTime() + 9 * 60 * 60 * 1000);
                const now = new Date();
                const finalCheckOut = checkOutDate > now ? now : checkOutDate;

                await attendanceDB('attn_punches').insert({
                    user_id: user.user_id,
                    punch_time: toMySQLDateTime(finalCheckOut),
                    punch_type: 'out',
                    punch_nature: 'auto_system',
                    location: JSON.stringify({ address: 'Auto-completed Session' }),
                    metadata: JSON.stringify({ auto_completed: true, reason: 'Open shift auto checkout' }),
                    created_at: attendanceDB.fn.now()
                });
            }
            try {
                await syncDailyAttendance(user.user_id, dateStr, { status: 'PRESENT' });
            } catch (err) {
                console.error(`Failed to sync daily attendance for open shift user ${user.user_id}:`, err);
            }
        } else {
            console.log(`⚠️ User ${user.user_id} has open session on ${dateStr}. Marking as MISSED_PUNCH.`);

            if (latestInPunch) {
                try {
                    let meta = typeof latestInPunch.metadata === 'string' ? JSON.parse(latestInPunch.metadata) : (latestInPunch.metadata || {});
                    meta.missed_punch = true;
                    await attendanceDB('attn_punches').where({ id: latestInPunch.id }).update({ metadata: JSON.stringify(meta) });
                } catch (_) {}
            }

            try {
                await syncDailyAttendance(user.user_id, dateStr, { status: 'MISSED_PUNCH' });
            } catch (err) {
                console.error(`Failed to sync daily attendance for user ${user.user_id}:`, err);
            }

            EventBus.emitNotification({
                org_id: user.org_id,
                user_id: user.user_id,
                title: "Missed Time Out",
                message: `You forgot to check out on ${dateStr}. Please submit a correction request to fix your hours, otherwise it will be marked as absent.`,
                type: "WARNING",
                related_entity_type: "ATTENDANCE",
                related_entity_id: null
            });
        }
    }

    if (record) {
        // Daily record exists - if it wasn't a missed punch, it's already updated via syncDailyAttendance above 
        // or during the day. No further action needed here for existing records.
    } else if (!hasPunchOpenSession) {
        // Missing record: determine status using the centralized no-show resolver
        const holiday = await attendanceDB('org_holidays')
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

        await attendanceDB('attn_daily_summary_v2').insert({
            user_id: user.user_id,
            date: dateStr,
            session_count: 0,
            total_hours: 0,
            late_minutes: 0,
            overtime_hours: 0,
            status,
            remarks,
            created_at: attendanceDB.fn.now(),
            updated_at: attendanceDB.fn.now()
        });

        console.log(`📝 Marked User ${user.user_id} as ${status} for ${dateStr}`);

        // Trigger background payroll recalculation
        PayrollCalculationService.triggerRecalculation(user.user_id, dateStr).catch(err => {
            console.error("Failed to trigger background payroll calculation in processUserAttendanceForDate:", err);
        });
    }

    // Finalize DAR for the date (archives any remaining unworked planned tasks to UNATTENDED_DRAFT)
    try {
        await reconcileUserDarForDate(user.user_id, dateStr, { isEodFinalization: true });
    } catch (darErr) {
        console.warn(`Failed to finalize DAR for user ${user.user_id} on ${dateStr}:`, darErr);
    }
}


/**
 * Escalate MISSED_PUNCH sessions that have exceeded the grace period
 * without a correction request being submitted or approved.
 * After MISSED_PUNCH_GRACE_DAYS days, the daily record is changed to ABSENT.
 */
async function escalateExpiredMissedPunches() {
    // Escalation to ABSENT turned off since correction deadline is bypassed/unlimited
    return;
    /*
    // Find all MISSED_PUNCH daily records
    const records = await attendanceDB('attn_daily_summary_v2')
        .where({ status: 'MISSED_PUNCH' });

    for (const record of records) {
        try {
            // Fetch user, shift rules, and timezone settings
            const user = await attendanceDB('core_users')
                .leftJoin('org_shifts', 'core_users.shift_id', 'org_shifts.shift_id')
                .leftJoin('org_user_work_locations', 'core_users.user_id', 'org_user_work_locations.user_id')
                .leftJoin('org_work_locations', 'org_user_work_locations.location_id', 'org_work_locations.location_id')
                .leftJoin('core_organizations', 'core_users.org_id', 'core_organizations.org_id')
                .where('core_users.user_id', record.user_id)
                .select(
                    'org_shifts.*',
                    'org_work_locations.timezone',
                    'core_organizations.timezone as org_timezone'
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

            // Determine escalation slot (latest checkout + 30-minute buffer, rounded to a cron slot)
            let endTime = '18:00:00';
            if (user.end_time) {
                endTime = user.end_time;
            } else {
                try {
                    let rules = user.policy_rules;
                    if (typeof rules === 'string') rules = JSON.parse(rules);
                    if (rules?.shift_timing?.end_time) {
                        endTime = rules.shift_timing.end_time;
                    }
                } catch (e) {}
            }

            let maxOvertime = DEFAULT_MAX_OVERTIME_HOURS;
            try {
                let rules = user.policy_rules;
                if (typeof rules === 'string') rules = JSON.parse(rules);
                if (rules?.overtime?.enabled === false) {
                    maxOvertime = 0;
                } else if (rules?.overtime?.max_overtime !== undefined) {
                    maxOvertime = normalizeMaxOvertimeHours(rules.overtime.max_overtime);
                } else if (rules?.overtime?.maxOvertime !== undefined) {
                    maxOvertime = normalizeMaxOvertimeHours(rules.overtime.maxOvertime);
                }
            } catch (e) {}

            const [endH, endM] = endTime.split(':').map(Number);
            const latestCheckoutMinutes = (endH * 60) + endM + (maxOvertime * 60) + MISSED_PUNCH_BUFFER_MINUTES;
            const escalationSlotMinutes = getNextCronSlotMinutes(latestCheckoutMinutes);

            const rules = ShiftService.getShiftRules(user);
            const graceDays = rules.correction_deadline ?? 2;

            // Calculate if the record is expired
            const recordDate = new Date(record.date);
            recordDate.setHours(0, 0, 0, 0);

            const diffTime = nowInUserTZ.getTime() - recordDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const currentSlotMinutes = (nowInUserTZ.getHours() * 60) + (Math.floor(nowInUserTZ.getMinutes() / CRON_INTERVAL_MINUTES) * CRON_INTERVAL_MINUTES);

            const isFullyExpired = diffDays > graceDays;
            if (!isFullyExpired) {
                const isExpirationDay = diffDays === graceDays;
                if (!isExpirationDay || currentSlotMinutes !== escalationSlotMinutes) {
                    continue;
                }
            }

            // Check if user submitted a correction request that is pending or approved
            const correction = await attendanceDB('attn_corrections')
                .where({ user_id: record.user_id })
                .whereRaw('DATE(target_date) = ?', [record.date])
                .whereIn('status', ['pending', 'approved'])
                .first();

            if (correction) {
                // Correction exists - skip escalation
                continue;
            }

            // No correction submitted - escalate to ABSENT
            await attendanceDB('attn_daily_summary_v2')
                .where({ user_id: record.user_id, date: record.date })
                .update({
                    status: 'ABSENT',
                    updated_at: attendanceDB.fn.now()
                });

            // Trigger background payroll recalculation
            PayrollCalculationService.triggerRecalculation(record.user_id, record.date).catch(err => {
                console.error("Failed to trigger background payroll calculation in escalateMissedPunches:", err);
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
    */
}

/**
 * Check if users need a time-in or time-out reminder (10 minutes before shift start/end)
 */
export async function checkAndSendShiftReminders() {
    try {
        const users = await attendanceDB('core_users')
            .leftJoin('org_shifts', 'core_users.shift_id', 'org_shifts.shift_id')
            .leftJoin('org_user_work_locations', 'core_users.user_id', 'org_user_work_locations.user_id')
            .leftJoin('org_work_locations', 'org_user_work_locations.location_id', 'org_work_locations.location_id')
            .leftJoin('core_organizations', 'core_users.org_id', 'core_organizations.org_id')
            .whereNotNull('core_users.shift_id')
            .where('core_users.is_deleted', 0)
            .where('core_users.is_active', 1)
            .select(
                'core_users.user_id',
                'core_users.shift_id',
                'org_shifts.*',
                'core_users.org_id',
                'org_work_locations.timezone',
                'core_organizations.timezone as org_timezone'
            );

        if (!users || users.length === 0) return;

    for (const user of users) {
        if (!user.shift_id) continue;

        try {
            const rules = ShiftService.getShiftRules(user);
            const startTime = rules.shift_timing?.start_time || rules.start_time; // e.g. "09:00:00"
            const endTime = rules.shift_timing?.end_time || rules.end_time; // e.g. "18:00:00"

            if (!startTime || !endTime) continue;

            let timeZone = user.org_timezone || user.timezone || 'UTC';
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
                const inPunchToday = await attendanceDB('attn_punches')
                    .where({ user_id: user.user_id, punch_type: 'in' })
                    .whereNull('deleted_at')
                    .whereRaw('DATE(punch_time) = ?', [dateStr])
                    .first();

                if (!inPunchToday) {
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
                // Check if user has an active open session (latest punch is 'in')
                const latestPunch = await attendanceDB('attn_punches')
                    .where({ user_id: user.user_id })
                    .whereNull('deleted_at')
                    .whereIn('punch_type', ['in', 'out'])
                    .orderBy('punch_time', 'desc')
                    .first();

                if (latestPunch && latestPunch.punch_type === 'in') {
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
    } catch (err) {
        if (err?.code === 'ECONNRESET' || err?.message?.includes('ECONNRESET')) {
            console.warn('⚠️ [AttendanceProcessor] Database connection reset during shift reminders check. Will retry next minute.');
            return;
        }
        console.error('Failed to run checkAndSendShiftReminders:', err);
    }
}

/**
 * Initialize the attendance processor cron job.
 */
export function initAttendanceProcessor() {
    cron.schedule('*/30 * * * *', processHourlyAttendance);
    cron.schedule('* * * * *', checkAndSendShiftReminders);
    console.log('🚀 Attendance Processor Scheduled (every 30 minutes)');
}

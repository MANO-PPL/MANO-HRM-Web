import cron from 'node-cron';
import { attendanceDB } from '../config/database.js';
import { syncDailyAttendance } from '../modules/attendance/attendanceService.js';
import * as ShiftService from '../modules/shifts/shiftService.js';
import { resolveNoShowStatus } from '../services/statusEvalution/statusEvaluationService.js';
import EventBus from '../utils/EventBus.js';
import { PayrollCalculationService } from '../modules/payroll/PayrollCalculationService.js';
import { toMySQLDateTime, toMySQLDate } from '../utils/dateUtils.js';
import { reconcileUserDarForDate } from '../modules/DAR/darReconciliationService.js';
import {
    resolveUserTimezone,
    getLatestPunchTimezones,
    getEffectiveUserTimezone,
    getNextCronSlotMinutes
} from '../utils/timezoneUtils.js';
import { sendPushNotification } from '../modules/notifications/fcmService.js';

// Time allowed after the configured maximum overtime before an open checkout is flagged.
const MISSED_PUNCH_BUFFER_MINUTES = 30;
const CRON_INTERVAL_MINUTES = 30;
// Safety margin so an off-pattern (Phase 3) session isn't flagged as a possible missed punch
// just because the cron's assigned-shift-based schedule happened to check it very early
// relative to its own actual start — a session younger than this is left open and reconsidered
// on a later cron pass instead.
const MISSED_PUNCH_MIN_SESSION_AGE_HOURS = 4;


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

        if (!users || users.length === 0) return;

        // Batch fetch latest punch timezones for all users upfront
        const punchMetaMap = await getLatestPunchTimezones();

        for (const user of users) {
            try {
                // 1. Resolve shift rules, then calculate target processing slot in-memory first (no DB queries)
                const rules = ShiftService.getShiftRules(user);
                const startTimeStr = rules.shift_timing?.start_time || rules.start_time || "09:00:00";
                const endTimeStr = rules.shift_timing?.end_time || rules.end_time || "18:00:00";
                const [startH, startM] = startTimeStr.split(':').map(Number);
                const [endH, endM] = endTimeStr.split(':').map(Number);

                // "Possibly forgotten checkout" cutoff — deliberately independent of the OT cap, so an
                // employee legitimately still working past their overtime cap is never treated as a missed
                // punch. Per-shift configurable (policy_rules.missed_punch_check_time); defaults to shift end + 8h.
                let latestCheckoutMinutes;
                if (rules.missed_punch_check_time) {
                    const [checkH, checkM] = rules.missed_punch_check_time.split(':').map(Number);
                    latestCheckoutMinutes = checkH * 60 + checkM;
                    if (latestCheckoutMinutes < (startH * 60 + startM)) {
                        latestCheckoutMinutes += 24 * 60; // earlier than shift start => meant as "next day"
                    }
                } else {
                    latestCheckoutMinutes = (endH * 60) + endM + (8 * 60) + MISSED_PUNCH_BUFFER_MINUTES;
                }
                const calculatedSlotMinutes = getNextCronSlotMinutes(latestCheckoutMinutes);

                let targetSlotMinutes = calculatedSlotMinutes;
                if (user.processing_time && user.processing_time !== '02:00:00') {
                    const [h, m] = user.processing_time.split(':').map(Number);
                    targetSlotMinutes = getNextCronSlotMinutes((h * 60) + (m || 0));
                }

                // 2. Resolve user's true local timezone (punch metadata -> location -> org -> UTC)
                const timeZone = getEffectiveUserTimezone(user, punchMetaMap);

                // 3. Compute slot directly in the user's actual timezone
                const nowInUserTZ = new Date(new Date().toLocaleString('en-US', { timeZone }));
                const currentSlotMinutes = (nowInUserTZ.getHours() * 60) + (Math.floor(nowInUserTZ.getMinutes() / CRON_INTERVAL_MINUTES) * CRON_INTERVAL_MINUTES);

                // 4. Determine if shift is night shift / next day check — the shift's own
                // authoritative crosses_midnight flag (auto-computed, or admin-overridden),
                // resolved once via the same `rules` object as step 1.
                const isNightShift = rules.crosses_midnight === true;

                const isNextDayCheck = isNightShift || latestCheckoutMinutes >= (24 * 60);

                const targetDateObj = new Date(nowInUserTZ);
                if (isNextDayCheck) {
                    targetDateObj.setDate(targetDateObj.getDate() - 1);
                }
                const yyyy = targetDateObj.getFullYear();
                const mm = String(targetDateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(targetDateObj.getDate()).padStart(2, '0');
                const targetDate = `${yyyy}-${mm}-${dd}`;

                // Normally only the user's exact processing slot runs. If that exact tick was
                // missed (process down/redeploying at that moment), catch up on a later tick the
                // same local day instead of silently waiting a full 24h for the slot to recur —
                // guarded by an existence check so a normal on-time run is never reprocessed.
                // Deliberately bounded to the same local day: recovering a slot missed right
                // before local midnight is a known, accepted gap (falls back to today's 24h-wait
                // behavior) rather than reconstructing "yesterday"'s target date here.
                const isExactSlot = currentSlotMinutes === targetSlotMinutes;
                if (!isExactSlot) {
                    if (currentSlotMinutes < targetSlotMinutes) {
                        continue; // slot hasn't happened yet today
                    }
                    const alreadyProcessed = await attendanceDB('attn_daily_summary_v2')
                        .where({ user_id: user.user_id, date: targetDate })
                        .first('user_id');
                    if (alreadyProcessed) {
                        continue; // already handled at the normal slot or a prior catch-up tick
                    }
                    console.log(`⏱️ Catch-up: processing User ${user.user_id} for ${targetDate} (missed slot ${Math.floor(targetSlotMinutes / 60)}:${String(targetSlotMinutes % 60).padStart(2, '0')}).`);
                }

                await processUserAttendanceForDate(user, targetDate);
            } catch (err) {
                console.error(`Failed to process user ${user.user_id}:`, err);
            }
        }

        // --- SECOND PASS: Notify employees whose correction window has closed on expired MISSED_PUNCH records ---
        await notifyExpiredMissedPunches();

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
    } catch (_) { }

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
            const sessionAgeHours = latestInPunch
                ? (Date.now() - new Date(latestInPunch.punch_time).getTime()) / (1000 * 60 * 60)
                : Infinity;

            if (sessionAgeHours < MISSED_PUNCH_MIN_SESSION_AGE_HOURS) {
                // Too young to treat as forgotten — likely an off-pattern (Phase 3) session the
                // cron's assigned-shift-based schedule happened to check before it would
                // reasonably be expected to finish. Leave it open; a genuinely forgotten
                // checkout will still be caught on a later cron pass.
                console.log(`ℹ️ User ${user.user_id} has an open session on ${dateStr} that's only ~${sessionAgeHours.toFixed(1)}h old — skipping missed-punch flag for now.`);
            } else {
                console.log(`⚠️ User ${user.user_id} has open session on ${dateStr}. Marking as MISSED_PUNCH.`);

                if (latestInPunch) {
                    try {
                        let meta = typeof latestInPunch.metadata === 'string' ? JSON.parse(latestInPunch.metadata) : (latestInPunch.metadata || {});
                        meta.missed_punch = true;
                        await attendanceDB('attn_punches').where({ id: latestInPunch.id }).update({ metadata: JSON.stringify(meta) });
                    } catch (_) { }
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
 * Notify employees whose MISSED_PUNCH sessions have exceeded the shift's correction_deadline
 * without a correction request being submitted or approved.
 *
 * The status is deliberately NOT changed to ABSENT here. A missed punch means the employee was
 * actually present and simply didn't log a checkout — converting it to ABSENT would misrepresent
 * a real attendance day as a no-show, which is exactly backwards. Payroll already treats an
 * uncorrected MISSED_PUNCH the same as ABSENT for pay purposes (see PayrollCalculationService.js,
 * `status === 'ABSENT' || status === 'MISSED_PUNCH'`), so no payroll-relevant state changes here
 * either way — this only closes the employee's self-service correction window (already reflected
 * live via `is_correctable` on the daily-summary API) and lets them know admin/HR needs to step
 * in, since admin/HR corrections bypass the deadline entirely.
 */
async function notifyExpiredMissedPunches() {
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

            // Determine the notification slot using the same decoupled, per-shift-configurable
            // cutoff as the main hourly pass (Phase 1) — never derived from max_overtime.
            const rules = ShiftService.getShiftRules(user);
            const startTimeStr = rules.shift_timing?.start_time || rules.start_time || "09:00:00";
            const endTimeStr = rules.shift_timing?.end_time || rules.end_time || "18:00:00";
            const [startH, startM] = startTimeStr.split(':').map(Number);
            const [endH, endM] = endTimeStr.split(':').map(Number);
            let latestCheckoutMinutes;
            if (rules.missed_punch_check_time) {
                const [checkH, checkM] = rules.missed_punch_check_time.split(':').map(Number);
                latestCheckoutMinutes = checkH * 60 + checkM;
                if (latestCheckoutMinutes < (startH * 60 + startM)) {
                    latestCheckoutMinutes += 24 * 60;
                }
            } else {
                latestCheckoutMinutes = (endH * 60) + endM + (8 * 60) + MISSED_PUNCH_BUFFER_MINUTES;
            }
            const notificationSlotMinutes = getNextCronSlotMinutes(latestCheckoutMinutes);

            const graceDays = rules.correction_deadline ?? 2;

            const recordDate = new Date(record.date);
            recordDate.setHours(0, 0, 0, 0);

            const diffTime = nowInUserTZ.getTime() - recordDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const currentSlotMinutes = (nowInUserTZ.getHours() * 60) + (Math.floor(nowInUserTZ.getMinutes() / CRON_INTERVAL_MINUTES) * CRON_INTERVAL_MINUTES);

            // Only act exactly once, on the day the correction window closes — not on every
            // tick thereafter. Since the status never changes, nothing removes this record from
            // the query above on later runs, so there's no other guard against re-notifying.
            const isExpirationDay = diffDays === graceDays;
            if (!isExpirationDay || currentSlotMinutes !== notificationSlotMinutes) {
                continue;
            }

            // Check if user submitted a correction request that is pending or approved
            const correction = await attendanceDB('attn_corrections')
                .where({ user_id: record.user_id })
                .whereRaw('DATE(target_date) = ?', [record.date])
                .whereIn('status', ['pending', 'approved'])
                .first();

            if (correction) {
                // Correction exists - nothing to notify about
                continue;
            }

            // No correction submitted - the self-service window has closed. Status stays
            // MISSED_PUNCH (never overwritten); only admin/HR can resolve it now.

            // Notify the user (org_id comes from the user's shift row — attn_daily_summary_v2
            // itself has no org_id column)
            EventBus.emitNotification({
                org_id: user.org_id,
                user_id: record.user_id,
                title: "Correction Window Closed",
                message: `Your missed punch for ${record.date} was not corrected within ${graceDays} day(s) and can no longer be self-corrected. Please contact your admin/HR to have it resolved.`,
                type: "WARNING",
                related_entity_type: "ATTENDANCE",
                related_entity_id: null
            });

            console.log(`⌛ Correction window closed for User ${record.user_id}'s MISSED_PUNCH on ${record.date} (Grace: ${graceDays}d) — status left as MISSED_PUNCH, notified only.`);
        } catch (err) {
            console.error(`Failed to escalate MISSED_PUNCH for user ${record.user_id} on ${record.date}:`, err);
        }
    }
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

                const timeZone = getEffectiveUserTimezone(user);

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
                        // Send as ephemeral mobile push notification only - do not persist to in-app notification inbox
                        sendPushNotification(
                            user.user_id,
                            "Time In Reminder",
                            `Your shift starts in 10 minutes at ${startTime.substring(0, 5)}. Don't forget to time in!`,
                            {
                                type: "ATTENDANCE_REMINDER",
                                related_entity_type: "ATTENDANCE"
                            }
                        );
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
                        // Send as ephemeral mobile push notification only - do not persist to in-app notification inbox
                        sendPushNotification(
                            user.user_id,
                            "Time Out Reminder",
                            `Your shift ends in 10 minutes at ${endTime.substring(0, 5)}. Don't forget to time out!`,
                            {
                                type: "ATTENDANCE_REMINDER",
                                related_entity_type: "ATTENDANCE"
                            }
                        );
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

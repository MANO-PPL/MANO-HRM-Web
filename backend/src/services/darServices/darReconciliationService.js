import { attendanceDB } from '../../config/database.js';
import { toMySQLDate, toMySQLTime, getZonedNow } from '../../utils/dateUtils.js';

/**
 * Helper: Convert 'HH:mm' or 'HH:mm:ss' to integer minutes from midnight
 */
export function timeStrToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = String(timeStr).split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return (h * 60) + m;
}

/**
 * Helper: Convert integer minutes from midnight to 'HH:mm:ss'
 */
export function minutesToTimeStr(totalMinutes) {
    const clamped = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    const hh = String(Math.min(23, h)).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${hh}:${mm}:00`;
}

/**
 * Calculate the intersection of a task range [taskStart, taskEnd]
 * with a list of session intervals [{ start, end }].
 * All inputs in minutes.
 * Returns array of { start, end } representing active overlap slices.
 */
export function computeSessionOverlaps(taskStartMin, taskEndMin, sessionIntervals) {
    const overlaps = [];
    if (taskEndMin <= taskStartMin || !sessionIntervals || sessionIntervals.length === 0) {
        return overlaps;
    }

    for (const session of sessionIntervals) {
        const sStart = session.start;
        const sEnd = session.end;

        const overlapStart = Math.max(taskStartMin, sStart);
        const overlapEnd = Math.min(taskEndMin, sEnd);

        if (overlapEnd > overlapStart) {
            overlaps.push({
                startMin: overlapStart,
                endMin: overlapEnd,
                startTime: minutesToTimeStr(overlapStart),
                endTime: minutesToTimeStr(overlapEnd)
            });
        }
    }

    return overlaps;
}

/**
 * Reconciles DAR activities for a user on a given date against actual/approved attendance sessions.
 * 
 * @param {number} user_id 
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {object} options { isEodFinalization: boolean, timezone: string }
 */
export async function reconcileUserDarForDate(user_id, dateStr, options = {}) {
    if (!user_id || !dateStr) return { success: false, message: 'Missing user_id or dateStr' };

    const { isEodFinalization = false, timezone = 'Asia/Kolkata' } = options;
    const zonedNow = getZonedNow(timezone);
    const todayStr = zonedNow.dateStr;
    const nowMinutes = timeStrToMinutes(zonedNow.timeStr);
    const isToday = (dateStr === todayStr);
    const isPastDate = (dateStr < todayStr);

    // 1. Fetch attendance records for this user and date
    const records = await attendanceDB('attn_records')
        .where({ user_id })
        .whereRaw('DATE(time_in) = ?', [dateStr])
        .orderBy('time_in', 'asc');

    // 2. Build active session intervals (in minutes)
    const sessionIntervals = [];
    for (const rec of records) {
        if (rec.status === 'MISSED_PUNCH' && !rec.time_out) {
            // Uncorrected missed punch session — ignore until corrected
            continue;
        }

        const inTimeStr = toMySQLTime(rec.time_in);
        let outTimeStr = rec.time_out ? toMySQLTime(rec.time_out) : null;

        if (!outTimeStr && isToday) {
            // Open session today: valid for the entire day until checkout
            outTimeStr = '23:59:59';
        }

        if (inTimeStr && outTimeStr) {
            const startMin = timeStrToMinutes(inTimeStr);
            const endMin = timeStrToMinutes(outTimeStr);
            if (endMin > startMin) {
                sessionIntervals.push({
                    start: startMin,
                    end: endMin,
                    attendance_id: rec.attendance_id
                });
            }
        }
    }

    // Helper to determine whether a slice is elapsed (COMPLETED) or upcoming (PLANNED)
    const getSliceStatus = (sliceEndMin) => {
        if (isToday) {
            return (sliceEndMin <= nowMinutes) ? 'COMPLETED' : 'PLANNED';
        }
        return 'COMPLETED';
    };

    // 3. Fetch root activities for this user and date (parent_activity_id IS NULL)
    const rootActivities = await attendanceDB('attn_daily_activities')
        .where({ user_id })
        .whereRaw('DATE(activity_date) = ?', [dateStr])
        .whereNull('parent_activity_id')
        .orderBy('start_time', 'asc');

    const trx = await attendanceDB.transaction();
    try {
        for (const root of rootActivities) {
            const rawStart = root.raw_start_time || root.start_time;
            const rawEnd = root.raw_end_time || root.end_time;

            if (!rawStart || !rawEnd) continue;

            const rawStartMin = timeStrToMinutes(rawStart);
            const rawEndMin = timeStrToMinutes(rawEnd);

            if (sessionIntervals.length === 0) {
                // No valid attendance sessions for this date
                if (isPastDate || isEodFinalization) {
                    // Mark as unattended draft (preserved for future correction requests)
                    await trx('attn_daily_activities')
                        .where({ activity_id: root.activity_id })
                        .update({
                            start_time: rawStart,
                            end_time: rawEnd,
                            status: 'UNATTENDED_DRAFT',
                            updated_at: trx.fn.now()
                        });
                    // Remove any old child slices
                    await trx('attn_daily_activities')
                        .where({ parent_activity_id: root.activity_id })
                        .del();
                } else {
                    // Open/planned today
                    await trx('attn_daily_activities')
                        .where({ activity_id: root.activity_id })
                        .update({
                            start_time: rawStart,
                            end_time: rawEnd,
                            status: 'PLANNED',
                            updated_at: trx.fn.now()
                        });
                }
                continue;
            }

            // Compute overlaps between raw intent and active session intervals
            const overlaps = computeSessionOverlaps(rawStartMin, rawEndMin, sessionIntervals);

            if (overlaps.length === 0) {
                // Task is outside any session (e.g. scheduled 16:00-18:00 but left at 15:30)
                if (isPastDate || isEodFinalization) {
                    await trx('attn_daily_activities')
                        .where({ activity_id: root.activity_id })
                        .update({
                            start_time: rawStart,
                            end_time: rawEnd,
                            status: 'UNATTENDED_DRAFT',
                            updated_at: trx.fn.now()
                        });
                    await trx('attn_daily_activities')
                        .where({ parent_activity_id: root.activity_id })
                        .del();
                } else {
                    // Staged for today
                    await trx('attn_daily_activities')
                        .where({ activity_id: root.activity_id })
                        .update({
                            start_time: rawStart,
                            end_time: rawEnd,
                            status: 'PLANNED',
                            updated_at: trx.fn.now()
                        });
                }
            } else if (overlaps.length === 1) {
                // Single continuous slice (either full task or trimmed to session boundary)
                const single = overlaps[0];
                const status = getSliceStatus(single.endMin);
                await trx('attn_daily_activities')
                    .where({ activity_id: root.activity_id })
                    .update({
                        start_time: single.startTime,
                        end_time: single.endTime,
                        raw_start_time: rawStart,
                        raw_end_time: rawEnd,
                        status: status,
                        updated_at: trx.fn.now()
                    });

                // Clean up any obsolete child slices (e.g. after healing a previous break)
                await trx('attn_daily_activities')
                    .where({ parent_activity_id: root.activity_id, user_id: root.user_id })
                    .del();
            } else {
                // Multi-slice break (task was split across 2 or more sessions/breaks)
                // First slice updates the root activity
                const first = overlaps[0];
                const firstStatus = getSliceStatus(first.endMin);
                await trx('attn_daily_activities')
                    .where({ activity_id: root.activity_id, user_id: root.user_id })
                    .update({
                        start_time: first.startTime,
                        end_time: first.endTime,
                        raw_start_time: rawStart,
                        raw_end_time: rawEnd,
                        status: firstStatus,
                        updated_at: trx.fn.now()
                    });

                // Fetch existing child slices
                const existingChildren = await trx('attn_daily_activities')
                    .where({ parent_activity_id: root.activity_id, user_id: root.user_id })
                    .orderBy('activity_id', 'asc');

                // Update or create child slices for overlaps[1 ... N-1]
                for (let i = 1; i < overlaps.length; i++) {
                    const slice = overlaps[i];
                    const sliceStatus = getSliceStatus(slice.endMin);
                    if (existingChildren[i - 1]) {
                        // Update existing child slice
                        await trx('attn_daily_activities')
                            .where({ activity_id: existingChildren[i - 1].activity_id, user_id: root.user_id })
                            .update({
                                start_time: slice.startTime,
                                end_time: slice.endTime,
                                raw_start_time: rawStart,
                                raw_end_time: rawEnd,
                                status: sliceStatus,
                                updated_at: trx.fn.now()
                            });
                    } else {
                        // Create new child slice
                        await trx('attn_daily_activities').insert({
                            user_id: root.user_id,
                            activity_date: root.activity_date,
                            start_time: slice.startTime,
                            end_time: slice.endTime,
                            raw_start_time: rawStart,
                            raw_end_time: rawEnd,
                            parent_activity_id: root.activity_id,
                            title: root.title,
                            description: root.description,
                            activity_type: root.activity_type,
                            status: sliceStatus,
                            created_at: trx.fn.now(),
                            updated_at: trx.fn.now()
                        });
                    }
                }

                // If fewer slices now than previously, delete extra child slices
                if (existingChildren.length > (overlaps.length - 1)) {
                    const extraChildIds = existingChildren
                        .slice(overlaps.length - 1)
                        .map(c => c.activity_id);
                    await trx('attn_daily_activities')
                        .whereIn('activity_id', extraChildIds)
                        .andWhere({ user_id: root.user_id })
                        .del();
                }
            }
        }

        await trx.commit();

        return { success: true, message: `Reconciliation completed for user ${user_id} on ${dateStr}` };
    } catch (err) {
        await trx.rollback();
        console.error(`❌ Reconciliation error for user ${user_id} on ${dateStr}:`, err);
        return { success: false, error: err.message };
    }
}

/**
 * Hook: Invoked when an employee times in (punches in)
 */
export async function handleAttendanceCheckinHook(user_id, checkinTimeStr) {
    try {
        const dateStr = toMySQLDate(checkinTimeStr) || new Date().toISOString().split('T')[0];
        return await reconcileUserDarForDate(user_id, dateStr);
    } catch (err) {
        console.error(`Error in handleAttendanceCheckinHook for user ${user_id}:`, err);
        return { success: false, error: err.message };
    }
}

/**
 * Hook: Invoked when an employee times out (punches out)
 */
export async function handleAttendanceCheckoutHook(user_id, checkoutTimeStr) {
    try {
        const dateStr = toMySQLDate(checkoutTimeStr) || new Date().toISOString().split('T')[0];
        return await reconcileUserDarForDate(user_id, dateStr);
    } catch (err) {
        console.error(`Error in handleAttendanceCheckoutHook for user ${user_id}:`, err);
        return { success: false, error: err.message };
    }
}

/**
 * Hook: Invoked when Admin/HR approves an Attendance Correction Request
 */
export async function handleAttendanceCorrectionApprovedHook(user_id, dateStr) {
    try {
        const normalizedDate = toMySQLDate(dateStr);
        return await reconcileUserDarForDate(user_id, normalizedDate);
    } catch (err) {
        console.error(`Error in handleAttendanceCorrectionApprovedHook for user ${user_id}:`, err);
        return { success: false, error: err.message };
    }
}


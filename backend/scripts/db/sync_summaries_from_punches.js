/**
 * CLI Script: Backfill & Sync Daily Attendance Summaries from attn_punches into attn_daily_summary_v2 (v2 only)
 * 
 * Usage:
 *   node backend/scripts/db/sync_summaries_from_punches.js
 *   node backend/scripts/db/sync_summaries_from_punches.js --from=2026-01-01 --to=2026-03-09
 *   node backend/scripts/db/sync_summaries_from_punches.js --user=123
 */

import { attendanceDB } from "../../src/config/database.js";
import * as ShiftService from "../../src/services/attendance/shiftManagementService.js";
import * as StatusService from "../../src/services/attendance/statusEvaluationService.js";

// ==========================================
// Standalone Inlined Helpers (Zero dependency on attendanceService.js)
// ==========================================

function formatLocalDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return String(val).split('T')[0].split(' ')[0];
}

function formatLocalDatetime(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
  }
  return String(val).replace('T', ' ').replace('Z', '').split('.')[0];
}

function safeParseJSON(val) {
  if (!val) return {};
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return {}; }
}

function pairPunchesForDate(punches, dateStr) {
  const sessions = [];
  let i = 0;
  while (i < punches.length) {
    const p = punches[i];
    const punchDate = formatLocalDate(p.punch_time);

    if (p.punch_type === 'in' && punchDate === dateStr) {
      const inPunch = p;
      let outPunch = null;

      if (i + 1 < punches.length && punches[i + 1].punch_type === 'out') {
        outPunch = punches[i + 1];
        i += 2;
      } else {
        i += 1;
      }

      const duration = outPunch
        ? parseFloat(((new Date(outPunch.punch_time) - new Date(inPunch.punch_time)) / (1000 * 60 * 60)).toFixed(2))
        : 0;

      sessions.push({ in_punch: inPunch, out_punch: outPunch, duration_hours: duration });
    } else {
      i += 1;
    }
  }
  return sessions;
}

async function getUserShift(user_id) {
  const user = await attendanceDB("core_users")
    .where("user_id", user_id)
    .select("shift_id", "org_id")
    .first();

  if (!user) return null;

  if (user.shift_id) {
    const assignedShift = await attendanceDB("org_shifts")
      .where({ shift_id: user.shift_id, org_id: user.org_id })
      .first();
    if (assignedShift) return assignedShift;
  }

  const openShift = await attendanceDB("org_shifts")
    .where({ org_id: user.org_id })
    .whereRaw("LOWER(shift_name) LIKE ?", ["%open%"])
    .where(function () { this.where('is_active', 1).orWhereNull('is_active'); })
    .first();

  if (openShift) {
    return openShift;
  }

  return null;
}

/**
 * Pure V2 Sync: Computes daily metrics from raw punches and upserts strictly into attn_daily_summary_v2.
 * Ignores legacy attn_daily_summary completely.
 */
async function syncDailyAttendanceV2(user_id, dateStr) {
  const sanitizedDate = dateStr.split('T')[0];

  const nextDate = new Date(sanitizedDate + 'T12:00:00');
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = formatLocalDate(nextDate);

  // 1. Fetch punches: in/out on target date + overnight out punches
  const punches = await attendanceDB("attn_punches")
    .where({ user_id })
    .whereNull("deleted_at")
    .whereIn("punch_type", ["in", "out"])
    .where(function() {
      this.whereRaw("DATE(punch_time) = ?", [sanitizedDate])
        .orWhere(function() {
          this.where("punch_type", "out")
            .whereRaw("DATE(punch_time) = ?", [nextDateStr]);
        });
    })
    .orderBy("punch_time", "asc")
    .orderBy("id", "asc");

  // 2. Pair punches into sessions
  const sessions = pairPunchesForDate(punches, sanitizedDate);

  if (sessions.length === 0) {
    const approvedLeave = await attendanceDB("leave_request")
      .where("user_id", user_id)
      .whereRaw("LOWER(status) = 'approved'")
      .where("start_date", "<=", sanitizedDate)
      .where("end_date", ">=", sanitizedDate)
      .first()
      .catch(() => null);

    const defaultStatus = approvedLeave ? "ON_LEAVE" : "ABSENT";
    const defaultRemarks = approvedLeave ? (approvedLeave.reason || "Approved Leave") : null;

    const existingV2 = await attendanceDB("attn_daily_summary_v2")
      .where({ user_id, date: sanitizedDate })
      .first();

    const emptySummary = {
      session_count: 0,
      total_hours: 0,
      late_minutes: 0,
      overtime_hours: 0,
      status: defaultStatus,
      remarks: defaultRemarks,
      updated_at: attendanceDB.fn.now()
    };

    if (existingV2) {
      await attendanceDB("attn_daily_summary_v2")
        .where({ user_id, date: sanitizedDate })
        .update(emptySummary);
    } else {
      await attendanceDB("attn_daily_summary_v2").insert({
        user_id,
        date: sanitizedDate,
        ...emptySummary,
        created_at: attendanceDB.fn.now()
      });
    }
    return;
  }

  // 3. Compute aggregates
  let totalHours = 0;
  let sessionCount = 0;
  for (const s of sessions) {
    if (s.out_punch) {
      totalHours += s.duration_hours;
      sessionCount += 1;
    }
  }
  totalHours = parseFloat(totalHours.toFixed(2));

  // 4. Shift rules
  const shift = await getUserShift(user_id);
  const rules = ShiftService.getShiftRules(shift);

  // 5. Late calculation (first session only)
  let lateMinutes = 0;
  let lateReason = null;
  if (sessions.length > 0) {
    const firstIn = sessions[0].in_punch;
    const lateCheck = StatusService.calculateLateArrival(
      formatLocalDatetime(firstIn.punch_time), rules
    );
    lateMinutes = lateCheck.isLate ? lateCheck.minutesLate : 0;

    const firstMeta = safeParseJSON(firstIn.metadata);
    lateReason = firstMeta?.late_reason || null;
  }

  // 6. Overtime
  const overtimeHours = StatusService.calculateOvertime(totalHours, rules);

  // 7. Status determination
  let finalStatus;
  if (sessions.some(s => !s.out_punch)) {
    const todayDateStr = formatLocalDate(new Date());
    const isPastDate = sanitizedDate < todayDateStr;
    finalStatus = isPastDate ? "MISSED_PUNCH" : "PRESENT";
  } else if (sessionCount === 0) {
    finalStatus = "ABSENT";
  } else {
    finalStatus = StatusService.evaluateStatus(rules, {
      total_hours: totalHours,
      total_hours_today: totalHours,
      minutes_late: lateMinutes,
      event_type: "time_out"
    });
  }

  // 8. Remarks
  const remarks = [];
  if (sessions.some(s => !s.out_punch)) remarks.push("Open Session");
  if (punches.some(p => p.punch_nature === "fabricated")) remarks.push("Manual Entry");
  for (const s of sessions) {
    const inLoc = safeParseJSON(s.in_punch.location);
    if (inLoc.is_geofence_violation) { remarks.push("Geofence Violation"); break; }
    if (s.out_punch) {
      const outLoc = safeParseJSON(s.out_punch.location);
      if (outLoc.is_geofence_violation) { remarks.push("Geofence Violation"); break; }
    }
  }

  // 9. Upsert into attn_daily_summary_v2 ONLY
  const summaryDataV2 = {
    session_count: sessionCount,
    total_hours: totalHours,
    late_minutes: lateMinutes,
    late_reason: lateReason,
    overtime_hours: overtimeHours,
    status: (finalStatus === 'LATE' || finalStatus === 'OVERTIME') ? 'PRESENT' : finalStatus,
    shift_id: shift ? shift.shift_id : null,
    remarks: [...new Set(remarks)].join("; ") || null,
    updated_at: attendanceDB.fn.now()
  };

  const existingV2 = await attendanceDB("attn_daily_summary_v2")
    .where({ user_id, date: sanitizedDate })
    .first();

  if (existingV2) {
    await attendanceDB("attn_daily_summary_v2")
      .where({ user_id, date: sanitizedDate })
      .update(summaryDataV2);
  } else {
    await attendanceDB("attn_daily_summary_v2").insert({
      user_id,
      date: sanitizedDate,
      ...summaryDataV2,
      created_at: attendanceDB.fn.now()
    });
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (const arg of args) {
    if (arg.startsWith("--from=")) {
      options.from = arg.split("=")[1];
    } else if (arg.startsWith("--to=")) {
      options.to = arg.split("=")[1];
    } else if (arg.startsWith("--user=")) {
      options.user_id = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--missing-only" || arg === "--missing") {
      options.missingOnly = true;
    }
  }
  return options;
}

async function main() {
  console.log("===============================================================");
  console.log("🚀 Starting Daily Summary Sync (attn_daily_summary_v2 only)");
  console.log("===============================================================");

  const options = parseArgs();
  if (options.from) console.log(`   Filter From Date : ${options.from}`);
  if (options.to) console.log(`   Filter To Date   : ${options.to}`);
  if (options.user_id) console.log(`   Filter User ID   : ${options.user_id}`);
  if (options.missingOnly) console.log(`   Filter Mode      : Only missing records not yet in attn_daily_summary_v2`);

  try {
    // 1. Query distinct user_id and dates present in attn_punches
    let query = attendanceDB("attn_punches")
      .select("user_id")
      .select(attendanceDB.raw("DATE(punch_time) as punch_date"))
      .whereNull("deleted_at")
      .whereIn("punch_type", ["in", "out"]);

    if (options.from) {
      query = query.whereRaw("DATE(punch_time) >= ?", [options.from]);
    }
    if (options.to) {
      query = query.whereRaw("DATE(punch_time) <= ?", [options.to]);
    }
    if (options.user_id) {
      query = query.where("user_id", options.user_id);
    }

    let distinctPairs = [];
    if (options.missingOnly) {
      const existingSummaries = await attendanceDB("attn_daily_summary_v2")
        .select("user_id", "date");
      const summarySet = new Set(
        existingSummaries.map(s => `${s.user_id}_${typeof s.date === 'string' ? s.date.slice(0, 10) : new Date(s.date).toISOString().slice(0, 10)}`)
      );

      const allPunchPairs = await query
        .groupBy("user_id", attendanceDB.raw("DATE(punch_time)"))
        .orderBy("punch_date", "asc")
        .orderBy("user_id", "asc");

      distinctPairs = allPunchPairs.filter(p => {
        const dStr = typeof p.punch_date === "string"
          ? p.punch_date.split("T")[0]
          : new Date(p.punch_date).toISOString().split("T")[0];
        return !summarySet.has(`${p.user_id}_${dStr}`);
      });
    } else {
      distinctPairs = await query
        .groupBy("user_id", attendanceDB.raw("DATE(punch_time)"))
        .orderBy("punch_date", "asc")
        .orderBy("user_id", "asc");
    }

    const total = distinctPairs.length;
    console.log(`\n📋 Found ${total} distinct (user, date) day records to synchronize.`);

    if (total === 0) {
      console.log("ℹ️ No punches matched the criteria (or all records already synchronized). Exiting.");
      process.exit(0);
    }

    let successCount = 0;
    let failureCount = 0;
    const startTime = Date.now();

    // 2. Process in small concurrency batches with retry logic to preserve DB pool health
    const BATCH_SIZE = 3;

    async function syncWithRetry(userId, dateStr, maxRetries = 5) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await syncDailyAttendanceV2(userId, dateStr);
          return;
        } catch (err) {
          if (attempt === maxRetries) throw err;
          await new Promise(res => setTimeout(res, 500 * attempt));
        }
      }
    }

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = distinctPairs.slice(i, i + BATCH_SIZE);

      await Promise.all(
        chunk.map(async (row, chunkIdx) => {
          const currentIndex = i + chunkIdx + 1;
          const dateStr = typeof row.punch_date === "string"
            ? row.punch_date.split("T")[0]
            : new Date(row.punch_date).toISOString().split("T")[0];

          try {
            await syncWithRetry(row.user_id, dateStr);
            successCount++;
            if (currentIndex % 50 === 0 || currentIndex === total) {
              const pct = ((currentIndex / total) * 100).toFixed(1);
              console.log(`   [${currentIndex}/${total}] (${pct}%) Synced User ${row.user_id} on ${dateStr}`);
            }
          } catch (err) {
            failureCount++;
            console.error(`   ❌ [${currentIndex}/${total}] Failed User ${row.user_id} on ${dateStr}:`, err.message);
          }
        })
      );
    }

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n===============================================================");
    console.log("✅ Summary Synchronization Complete!");
    console.log(`   Total Processed : ${total}`);
    console.log(`   Successful      : ${successCount}`);
    console.log(`   Failed          : ${failureCount}`);
    console.log(`   Time Elapsed    : ${elapsedSec}s`);
    console.log("   Synced Table    : attn_daily_summary_v2 only");
    console.log("===============================================================");
  } catch (error) {
    console.error("\n💥 Critical error during synchronization:", error);
  } finally {
    try {
      await attendanceDB.destroy();
    } catch (_) { }
    process.exit(0);
  }
}

main();

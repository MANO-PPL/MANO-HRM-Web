/**
 * Historical Attendance Past Simulation Service
 * 
 * Description:
 * Simulates check-in and check-out attendance punches for a set of target users
 * over a past date range.
 * 
 * Safety:
 * Restricted strictly to local development environments. Will immediately crash
 * if run under PM2 or in a production setting.
 * 
 * How to Run:
 *      node backend/scripts/tools/simulate_past_attendance.js
 */

// ===================================================
// LOCAL DEV ENVIRONMENT SAFETY GUARD
// ===================================================
if (process.env.NODE_ENV === 'production' || process.env.pm_id || process.env.PM2_HOME) {
  console.error("❌ ERROR: This script is restricted to local development environments only. Cannot run under PM2 or in Production/Cloud.");
  process.exit(1);
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { attendanceDB } from '../../src/config/database.js';
import { syncDailyAttendance, getUserShift } from '../../src/services/attendance/attendanceService.js';
import { getShiftRules, getDayType } from '../../src/services/attendance/shiftManagementService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base location coordinate presets
const CITIES = [
  { name: "Bangalore, India", lat: 12.9716, lng: 77.5946, weight: 0.35 },
  { name: "Mumbai, India", lat: 19.0760, lng: 72.8777, weight: 0.15 },
  { name: "Delhi, India", lat: 28.6139, lng: 77.2090, weight: 0.15 },
  { name: "Chennai, India", lat: 13.0827, lng: 80.2707, weight: 0.10 },
  { name: "Hyderabad, India", lat: 17.3850, lng: 78.4867, weight: 0.10 },
  { name: "Pune, India", lat: 18.5204, lng: 73.8567, weight: 0.05 },
  { name: "Kolkata, India", lat: 22.5726, lng: 88.3639, weight: 0.03 },
  { name: "Dubai, UAE", lat: 25.2048, lng: 55.2708, weight: 0.03 },
  { name: "London, UK", lat: 51.5074, lng: -0.1278, weight: 0.02 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, weight: 0.01 },
  { name: "New York, USA", lat: 40.7128, lng: -74.0060, weight: 0.01 }
];

const PERSONALITY_PROFILES = {
  normal: {
    attendance_prob: 0.92,
    late_prob: 0.12,
    overtime_prob: 0.10,
    leave_prob: 0.04,
    missed_checkout_prob: 0.02,
    multi_session_prob: [0.90, 0.08, 0.02]
  },
  slacker: {
    attendance_prob: 0.75,
    late_prob: 0.40,
    overtime_prob: 0.02,
    leave_prob: 0.12,
    missed_checkout_prob: 0.08,
    multi_session_prob: [0.96, 0.04, 0.00]
  },
  overachiever: {
    attendance_prob: 0.98,
    late_prob: 0.02,
    overtime_prob: 0.35,
    leave_prob: 0.02,
    missed_checkout_prob: 0.00,
    multi_session_prob: [0.80, 0.16, 0.04]
  },
  early_bird: {
    attendance_prob: 0.96,
    late_prob: 0.00,
    overtime_prob: 0.15,
    leave_prob: 0.03,
    missed_checkout_prob: 0.01,
    multi_session_prob: [0.88, 0.10, 0.02]
  }
};

function getUserBaseCity(userId) {
  const hash = (userId * 17 + 31) % 100;
  let threshold = 0;
  for (const city of CITIES) {
    threshold += city.weight * 100;
    if (hash <= threshold) {
      return city;
    }
  }
  return CITIES[0];
}

function getRandomCoordinateOffset(baseCoord) {
  const offsetLat = (Math.random() - 0.5) * 0.002;
  const offsetLng = (Math.random() - 0.5) * 0.002;
  return {
    lat: parseFloat((baseCoord.lat + offsetLat).toFixed(6)),
    lng: parseFloat((baseCoord.lng + offsetLng).toFixed(6))
  };
}

function getDateTimeForDate(dateStr, timeStr, offsetMinutes = 0) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [h, m, s] = (timeStr || '09:00:00').split(':').map(Number);
  const d = new Date(year, month - 1, day, h, m, s || 0, 0);
  if (offsetMinutes !== 0) {
    d.setMinutes(d.getMinutes() + offsetMinutes);
  }
  return d;
}

function formatSqlDateTime(dateObj) {
  return dateObj.toISOString().slice(0, 19).replace('T', ' ');
}

function getDatesInRange(startStr, endStr) {
  const dates = [];
  let current = new Date(startStr);
  const end = new Date(endStr);
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

async function runSimulation() {
  const jsonPath = path.resolve(__dirname, './simulate_past_data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error("❌ CRITICAL: simulate_past_data.json configuration file not found!");
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    console.error(`❌ CRITICAL: Failed to parse simulate_past_data.json: ${err.message}`);
    process.exit(1);
  }

  const { target_user_ids, allowed_org_ids, start_date, end_date, shuffle_personalities } = config;

  console.log(`\n🚀 Starting Past Attendance Simulation...`);
  console.log(`📅 Date Range: ${start_date} to ${end_date}`);

  if (!target_user_ids || target_user_ids.length === 0) {
    console.error("❌ ERROR: target_user_ids is empty in simulate_past_data.json");
    process.exit(1);
  }

  let usersQuery = attendanceDB('core_users')
    .whereIn('user_id', target_user_ids)
    .where({ is_deleted: 0, is_active: 1 });

  if (allowed_org_ids && allowed_org_ids.length > 0) {
    usersQuery = usersQuery.whereIn('org_id', allowed_org_ids);
  }

  const users = await usersQuery;
  console.log(`👤 Found ${users.length} matching active users to simulate.`);

  if (users.length === 0) {
    console.log("⚠️ No matching active users found in the database. Exiting.");
    process.exit(0);
  }

  const dates = getDatesInRange(start_date, end_date);
  console.log(`📆 Days to simulate: ${dates.length}`);

  for (const dateStr of dates) {
    console.log(`\n📆 Simulating date: ${dateStr}`);
    const dateObj = new Date(dateStr);

    for (const user of users) {
      try {
        const shift = await getUserShift(user.user_id);
        const rules = getShiftRules(shift);
        const dayType = getDayType(dateObj, rules.week_off_policy);

        // 1. Skip week-offs
        if (dayType === 'week_off') {
          console.log(`   👤 User ${user.user_name} (ID: ${user.user_id}) - Week-off today. Skipping.`);
          continue;
        }

        // 2. Resolve personality
        let profile;
        if (shuffle_personalities) {
          const profileKeys = Object.keys(PERSONALITY_PROFILES);
          const randomKey = profileKeys[Math.floor(Math.random() * profileKeys.length)];
          profile = PERSONALITY_PROFILES[randomKey];
        } else {
          profile = PERSONALITY_PROFILES.normal;
        }

        const rand = Math.random();

        // 3. Leave Simulation
        if (rand < profile.leave_prob) {
          const existingLeave = await attendanceDB('leave_requests')
            .where({ user_id: user.user_id, start_date: dateStr })
            .first();

          if (!existingLeave) {
            await attendanceDB('leave_requests').insert({
              user_id: user.user_id,
              org_id: user.org_id,
              leave_type: 'Casual',
              start_date: dateStr,
              end_date: dateStr,
              reason: 'Simulated Past Leave (Historical)',
              pay_type: 'Paid',
              pay_percentage: 100,
              status: 'Approved',
              reviewed_by: 1,
              reviewed_at: attendanceDB.fn.now()
            });
            console.log(`   👤 User ${user.user_name} (ID: ${user.user_id}) - Simulated Approved Leave.`);
          }
          continue;
        }

        // 4. Absence Simulation
        if (rand >= profile.attendance_prob) {
          console.log(`   👤 User ${user.user_name} (ID: ${user.user_id}) - Simulated Absent.`);
          continue;
        }

        // 5. Present - Generate punches
        const startStr = rules.shift_timing.start_time;
        const endStr = rules.shift_timing.end_time;
        const gracePeriod = rules.grace_period.minutes;

        // Determine session counts
        let numSessions = 1;
        const sessionRand = Math.random();
        const accumProbs = profile.multi_session_prob || [0.90, 0.08, 0.02];
        if (sessionRand < accumProbs[0]) {
          numSessions = 1;
        } else if (sessionRand < accumProbs[0] + accumProbs[1]) {
          numSessions = 2;
        } else {
          numSessions = 3;
        }

        const sessions = [];
        const baseCity = getUserBaseCity(user.user_id);
        const isLate = Math.random() < profile.late_prob;
        const isOvertime = Math.random() < profile.overtime_prob;
        const willForgetCheckout = Math.random() < profile.missed_checkout_prob;

        if (numSessions === 1) {
          const inOffset = isLate ? (gracePeriod + 1 + Math.floor(Math.random() * 30)) : (-Math.floor(Math.random() * 15));
          const outOffset = isOvertime ? (120 + Math.floor(Math.random() * 60)) : (Math.floor(Math.random() * 10));

          sessions.push({
            checkInTarget: getDateTimeForDate(dateStr, startStr, inOffset),
            checkOutTarget: getDateTimeForDate(dateStr, endStr, outOffset),
            willForget: willForgetCheckout
          });
        } else if (numSessions === 2) {
          const inOffset1 = isLate ? (gracePeriod + 1 + Math.floor(Math.random() * 20)) : (-Math.floor(Math.random() * 10));
          const midTime = getDateTimeForDate(dateStr, startStr, 240); // 4 hours in
          const outOffset2 = isOvertime ? (120 + Math.floor(Math.random() * 60)) : (Math.floor(Math.random() * 10));

          sessions.push({
            checkInTarget: getDateTimeForDate(dateStr, startStr, inOffset1),
            checkOutTarget: new Date(midTime.getTime() - (Math.floor(Math.random() * 15) * 60000)),
            willForget: false
          });

          sessions.push({
            checkInTarget: new Date(midTime.getTime() + (Math.floor(Math.random() * 45 + 15) * 60000)),
            checkOutTarget: getDateTimeForDate(dateStr, endStr, outOffset2),
            willForget: willForgetCheckout
          });
        } else {
          // Triple sessions
          const t1 = getDateTimeForDate(dateStr, startStr);
          const tEnd = getDateTimeForDate(dateStr, endStr);
          const totalDuration = tEnd - t1;
          const segment = totalDuration / 3;

          for (let i = 0; i < 3; i++) {
            const sStart = new Date(t1.getTime() + (segment * i) + (Math.floor(Math.random() * 10 - 5) * 60000));
            const sEnd = new Date(t1.getTime() + (segment * (i + 1)) - (Math.floor(Math.random() * 15 + 5) * 60000));
            sessions.push({
              checkInTarget: sStart,
              checkOutTarget: sEnd,
              willForget: (i === 2) && willForgetCheckout
            });
          }
        }

        // Insert punches
        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i];
          const localCoords = getRandomCoordinateOffset(baseCity);
          
          const timeInStr = formatSqlDateTime(s.checkInTarget);
          const timeOutStr = s.willForget ? null : formatSqlDateTime(s.checkOutTarget);

          const metadata = {
            time_in: {
              accuracy: 10,
              ip_address: "127.0.0.1",
              user_agent: "Mozilla/5.0 (Simulated)",
              timestamp_utc: s.checkInTarget.toISOString(),
              timezone: "Asia/Kolkata"
            },
            session_context: { is_first_session: i === 0 }
          };

          if (timeOutStr) {
            metadata.time_out = {
              accuracy: 10,
              ip_address: "127.0.0.1",
              user_agent: "Mozilla/5.0 (Simulated)",
              timestamp_utc: s.checkOutTarget.toISOString(),
              timezone: "Asia/Kolkata"
            };
          }

          const insertData = {
            user_id: user.user_id,
            org_id: user.org_id,
            time_in: timeInStr,
            time_out: timeOutStr,
            time_in_lat: localCoords.lat,
            time_in_lng: localCoords.lng,
            time_in_address: `Office Building, ${baseCity.name}`,
            time_out_lat: timeOutStr ? localCoords.lat : null,
            time_out_lng: timeOutStr ? localCoords.lng : null,
            time_out_address: timeOutStr ? `Office Building, ${baseCity.name}` : null,
            status: "PRESENT",
            time_in_image_key: null,
            time_out_image_key: null,
            metadata: JSON.stringify(metadata),
            created_at: attendanceDB.fn.now(),
            updated_at: attendanceDB.fn.now()
          };

          await attendanceDB("attendance_records").insert(insertData);
        }

        // Sync daily calculations
        await syncDailyAttendance(user.user_id, dateStr, {
          late_reason: (isLate) ? "Simulated Traffic Delay" : null
        });

        console.log(`   👤 User ${user.user_name} - ${sessions.length} punch sessions simulated & synced.`);

      } catch (err) {
        console.error(`❌ Error simulating user ${user.user_name} on ${dateStr}: ${err.message}`);
      }
    }
  }

  console.log(`\n🎉 Historical Past Attendance Simulation completed successfully!`);
  process.exit(0);
}

runSimulation().catch(err => {
  console.error(`❌ CRITICAL: Uncaught failure in simulation: ${err.message}`);
  process.exit(1);
});

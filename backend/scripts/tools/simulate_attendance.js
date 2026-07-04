/**
 * Real-time Attendance Simulation Service (Multi-session & Regional Coordinates & Selfie Uploads)
 * 
 * Description:
 * Simulates check-in and check-out attendance punches for users in a target organization
 * in real-time, representing real-life scenarios.
 * 
 * Features:
 * - Load all targets, configuration, and custom personality profiles from simulate_data.json
 * - Support for multiple daily check-in sessions (90% single, 8% double, 2% triple sessions)
 * - Deterministic user base locations spread across India and global cities, with random punch offsets.
 * - Dynamic S3 upload of custom selfie images from user directory mapping (if provided).
 * - Robust state restoration on restart.
 * 
 * How to Run under PM2:
 * 
 *      pm2 start backend/scripts/tools/simulate_attendance.js --name "mano-attendance-simulator"
 * 
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { attendanceDB } from '../../src/config/database.js';
import { syncDailyAttendance, getUserShift } from '../../src/services/attendance/attendanceService.js';
import { getShiftRules, getDayType } from '../../src/services/attendance/shiftManagementService.js';
import * as S3Service from '../../src/services/s3/s3Service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURATION & SEED DATA (LOADED FROM JSON)
// ==========================================
let SIM_CONFIG = null;

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

// Fallback profile if JSON load fails
const DEFAULT_PROFILE = {
  attendance_prob: 0.92,
  late_prob: 0.12,
  overtime_prob: 0.10,
  leave_prob: 0.04,
  missed_checkout_prob: 0.02,
  multi_session_prob: [0.90, 0.08, 0.02]
};

// In-memory state tracking for today
let dailyState = {};

/**
 * Format a Date object to YYYY-MM-DD local date string.
 */
function getLocalDateStr(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

/**
 * Log message directly with timestamp.
 */
function log(message) {
  const timestamp = new Date().toLocaleString();
  console.log(`[🤖 Attendance Simulator] [${timestamp}] ${message}`);
}

/**
 * Loads simulation configuration JSON from disk dynamically.
 */
function loadSimulateConfig() {
  const jsonPath = path.resolve(__dirname, './simulate_data.json');
  if (!fs.existsSync(jsonPath)) {
    log("❌ CRITICAL: simulate_data.json file not found! Exiting to prevent accidental runs.");
    process.exit(1);
  }

  try {
    const data = fs.readFileSync(jsonPath, 'utf8');
    SIM_CONFIG = JSON.parse(data);
    log("✅ Loaded simulate_data.json configuration successfully.");
  } catch (e) {
    log(`❌ CRITICAL: Failed to parse simulate_data.json: ${e.message}. Exiting.`);
    process.exit(1);
  }
}

/**
 * Deterministically assigns a base city to a user using their userId.
 */
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

/**
 * Generates random coordinates offset by ~200 meters from a base coordinate.
 */
function getRandomCoordinateOffset(baseCoord) {
  const offsetLat = (Math.random() - 0.5) * 0.002;
  const offsetLng = (Math.random() - 0.5) * 0.002;
  return {
    lat: parseFloat((baseCoord.lat + offsetLat).toFixed(6)),
    lng: parseFloat((baseCoord.lng + offsetLng).toFixed(6))
  };
}

/**
 * Converts a time string (HH:MM:SS) to a Date object today, adding an offset in minutes.
 */
function getTodayDateTime(timeStr, offsetMinutes = 0) {
  const [h, m, s] = (timeStr || '09:00:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, s || 0, 0);
  if (offsetMinutes !== 0) {
    d.setMinutes(d.getMinutes() + offsetMinutes);
  }
  return d;
}

/**
 * Reads a random image from user's subdirectory, uploads to S3, and returns the S3 key.
 */
async function uploadSimulatedSelfie(userId, orgId, punchType) {
  const imagesDir = SIM_CONFIG?.config?.images_dir;
  if (!imagesDir) return null;

  try {
    const baseDir = path.isAbsolute(imagesDir) 
      ? imagesDir 
      : path.resolve(__dirname, imagesDir);

    // Support both "123" and "user_123" folder names
    let userDir = path.join(baseDir, String(userId));
    if (!fs.existsSync(userDir)) {
      userDir = path.join(baseDir, `user_${userId}`);
    }

    if (!fs.existsSync(userDir)) {
      return null; // No directory for this user
    }

    const files = fs.readdirSync(userDir)
      .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file));

    if (files.length === 0) {
      return null; // No images in directory
    }

    // Pick random image
    const randomFile = files[Math.floor(Math.random() * files.length)];
    const imgPath = path.join(userDir, randomFile);
    const fileBuffer = fs.readFileSync(imgPath);

    const s3Key = `${punchType}_${userId}_${Date.now()}.jpg`;
    const directory = `attendance/org_${orgId}/user_${userId}`;

    log(`📤 Uploading simulated selfie for user ${userId} (${randomFile})...`);
    const uploadResult = await S3Service.uploadCompressedImage({
      fileBuffer,
      key: s3Key,
      directory
    });

    if (uploadResult && uploadResult.key) {
      log(`✅ Selfie upload successful. S3 Key: ${uploadResult.key}`);
      return uploadResult.key;
    }
  } catch (err) {
    log(`⚠️ Failed to upload simulated selfie for user ${userId}: ${err.message}`);
  }
  return null;
}

/**
 * Fetches the active list of users to simulate.
 */
async function fetchTargetUsers() {
  const targetUserIds = SIM_CONFIG?.config?.target_user_ids || [];
  const targetOrgIds = SIM_CONFIG?.config?.target_org_ids || [];

  if (targetUserIds.length === 0) {
    log("⚠️ No target_user_ids provided in configuration. Skipping simulation to prevent accidental runs.");
    return [];
  }

  let query = attendanceDB('core_users')
    .whereIn('user_id', targetUserIds)
    .where({ is_deleted: 0, is_active: 1 });

  if (targetOrgIds.length > 0) {
    query = query.whereIn('org_id', targetOrgIds);
  }

  return await query;
}

/**
 * Initialize or reconstruct the daily simulation state for target users.
 */
async function initializeDailyState() {
  const todayStr = getLocalDateStr();
  log(`Initializing daily simulation state for date: ${todayStr}`);

  const users = await fetchTargetUsers();
  log(`Found ${users.length} users to simulate.`);

  const newDailyState = {};

  for (const user of users) {
    try {
      const shift = await getUserShift(user.user_id);
      const rules = getShiftRules(shift);
      const dayType = getDayType(new Date(), rules.week_off_policy);

      // 1. Check week-off rules
      if (dayType === 'week_off') {
        log(`👤 User ${user.user_name} (ID: ${user.user_id}) - Weekend/Week-off today. Skipping.`);
        continue;
      }

      // 2. Resolve user personality profile
      const mappedProfileName = SIM_CONFIG?.user_mappings?.[String(user.user_id)];
      const profile = SIM_CONFIG?.profiles?.[mappedProfileName] || DEFAULT_PROFILE;

      // 3. Look for existing attendance records today (resiliency on restart)
      const existingRecords = await attendanceDB('attn_records')
        .where({ user_id: user.user_id })
        .whereRaw('DATE(time_in) = ?', [todayStr])
        .orderBy('time_in', 'asc');

      // 4. Generate daily state
      const rand = Math.random();
      
      // A. Leave Simulation
      if (rand < profile.leave_prob && existingRecords.length === 0) {
        const existingLeave = await attendanceDB('leave_requests')
          .where({ user_id: user.user_id, start_date: todayStr })
          .first();

        if (!existingLeave) {
          await attendanceDB('leave_requests').insert({
            user_id: user.user_id,
            org_id: user.org_id,
            leave_type: 'Casual',
            start_date: todayStr,
            end_date: todayStr,
            reason: 'Simulated Personal Leave',
            pay_type: 'Paid',
            pay_percentage: 100,
            status: 'Approved',
            reviewed_by: 1,
            reviewed_at: attendanceDB.fn.now()
          });
          log(`👤 User ${user.user_name} - Scheduled Approved Leave for today.`);
        }
        
        newDailyState[user.user_id] = {
          dateStr: todayStr,
          isOnLeave: true,
          isAbsent: false,
          userName: user.user_name
        };
        continue;
      }

      // B. Absence Simulation
      if (rand >= profile.attendance_prob && existingRecords.length === 0) {
        log(`👤 User ${user.user_name} - Scheduled Absent for today.`);
        newDailyState[user.user_id] = {
          dateStr: todayStr,
          isOnLeave: false,
          isAbsent: true,
          userName: user.user_name
        };
        continue;
      }

      // C. Present (Calculate Target Sessions & Timings)
      const startStr = rules.shift_timing.start_time;
      const endStr = rules.shift_timing.end_time;
      const gracePeriod = rules.grace_period.minutes;

      // Determine number of sessions
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
        // Single session: shift start to shift end
        const inOffset = isLate ? (gracePeriod + 1 + Math.floor(Math.random() * 30)) : (-Math.floor(Math.random() * 15));
        const outOffset = isOvertime ? (120 + Math.floor(Math.random() * 60)) : (Math.floor(Math.random() * 10));

        sessions.push({
          checkInTarget: getTodayDateTime(startStr, inOffset),
          checkOutTarget: getTodayDateTime(endStr, outOffset),
          hasCheckedIn: false,
          hasCheckedOut: false,
          recordId: null
        });
      } else if (numSessions === 2) {
        // Double session (e.g. Split shift or Lunch break)
        // Session 1: Shift start to mid-day
        const inOffset1 = isLate ? (gracePeriod + 1 + Math.floor(Math.random() * 20)) : (-Math.floor(Math.random() * 10));
        const midTime = getTodayDateTime(startStr, 240); // 4 hours in

        sessions.push({
          checkInTarget: getTodayDateTime(startStr, inOffset1),
          checkOutTarget: new Date(midTime.getTime() - (Math.floor(Math.random() * 15) * 60000)),
          hasCheckedIn: false,
          hasCheckedOut: false,
          recordId: null
        });

        // Session 2: Mid-day to Shift end
        const outOffset2 = isOvertime ? (120 + Math.floor(Math.random() * 60)) : (Math.floor(Math.random() * 10));
        sessions.push({
          checkInTarget: new Date(midTime.getTime() + (Math.floor(Math.random() * 45 + 15) * 60000)), // lunch duration 15-60m
          checkOutTarget: getTodayDateTime(endStr, outOffset2),
          hasCheckedIn: false,
          hasCheckedOut: false,
          recordId: null
        });
      } else {
        // Triple session (e.g. multiple distinct client visits)
        const t1 = getTodayDateTime(startStr);
        const tEnd = getTodayDateTime(endStr);
        const totalDuration = tEnd - t1;
        const segment = totalDuration / 3;

        for (let i = 0; i < 3; i++) {
          const sStart = new Date(t1.getTime() + (segment * i) + (Math.floor(Math.random() * 10 - 5) * 60000));
          const sEnd = new Date(t1.getTime() + (segment * (i + 1)) - (Math.floor(Math.random() * 15 + 5) * 60000));
          
          sessions.push({
            checkInTarget: sStart,
            checkOutTarget: sEnd,
            hasCheckedIn: false,
            hasCheckedOut: false,
            recordId: null
          });
        }
      }

      // Restructure memory state if records exist (restart protection)
      if (existingRecords.length > 0) {
        for (let k = 0; k < existingRecords.length; k++) {
          const rec = existingRecords[k];
          if (sessions[k]) {
            sessions[k].hasCheckedIn = true;
            sessions[k].recordId = rec.attendance_id;
            sessions[k].checkInTarget = new Date(rec.time_in);
            if (rec.time_out) {
              sessions[k].hasCheckedOut = true;
              sessions[k].checkOutTarget = new Date(rec.time_out);
            }
          }
        }
        log(`👤 User ${user.user_name} - Restored existing state: [Completed sessions: ${existingRecords.filter(r => r.time_out).length}/${sessions.length}]`);
      }

      newDailyState[user.user_id] = {
        dateStr: todayStr,
        sessions,
        willForgetCheckout,
        isOnLeave: false,
        isAbsent: false,
        userName: user.user_name,
        orgId: user.org_id,
        baseCity,
        isLate,
        isOvertime
      };

      if (existingRecords.length === 0) {
        log(`👤 User ${user.user_name} (${mappedProfileName || 'default'}) - Scheduled Present: [${numSessions} sessions, Base: ${baseCity.name}]`);
      }
    } catch (userErr) {
      log(`❌ Failed to initialize simulation state for user ID ${user.user_id}: ${userErr.message}`);
    }
  }

  dailyState = newDailyState;
}

/**
 * Perform simulation checks for check-in and check-out timings.
 */
async function performSimulationStep() {
  const todayStr = getLocalDateStr();
  
  // If the date changes, re-initialize state for the new day
  const stateKeys = Object.keys(dailyState);
  if (stateKeys.length === 0 || dailyState[stateKeys[0]].dateStr !== todayStr) {
    await initializeDailyState();
    return;
  }

  const now = new Date();

  for (const userId of Object.keys(dailyState)) {
    const userState = dailyState[userId];
    
    if (userState.isOnLeave || userState.isAbsent) continue;

    for (let i = 0; i < userState.sessions.length; i++) {
      const session = userState.sessions[i];

      // 1. Session Check-In
      if (!session.hasCheckedIn) {
        const prevCompleted = i === 0 || userState.sessions[i - 1].hasCheckedOut;
        if (prevCompleted && now >= session.checkInTarget) {
          try {
            log(`⏰ Punching In user: ${userState.userName} (ID: ${userId}) for Session ${i + 1}/${userState.sessions.length}`);
            
            const userRow = await attendanceDB('core_users').where({ user_id: userId }).first();
            const formattedTimeStr = session.checkInTarget.toISOString().slice(0, 19).replace('T', ' ');
            const localCoords = getRandomCoordinateOffset(userState.baseCity);

            const rowImageKey = await uploadSimulatedSelfie(userId, userRow.org_id, "time_in");

            const metadata = {
              time_in: {
                accuracy: 10,
                ip_address: "127.0.0.1",
                user_agent: "Mozilla/5.0 (Simulated)",
                timestamp_utc: session.checkInTarget.toISOString(),
                timezone: "Asia/Kolkata"
              },
              session_context: { is_first_session: i === 0 }
            };

            const [recordId] = await attendanceDB("attn_records").insert({
              user_id: userId,
              org_id: userRow.org_id,
              time_in: formattedTimeStr,
              time_in_lat: localCoords.lat,
              time_in_lng: localCoords.lng,
              time_in_address: `Office Building, ${userState.baseCity.name}`,
              status: "PRESENT",
              time_in_image_key: rowImageKey || null,
              metadata: JSON.stringify(metadata)
            });

            session.recordId = recordId;
            session.hasCheckedIn = true;

            // Sync daily attendance calculations
            await syncDailyAttendance(userId, todayStr, {
              late_reason: (i === 0 && userState.isLate) ? "Simulated Traffic Delay" : null
            });
            
            log(`✅ Session ${i + 1} Punch-In successful for ${userState.userName}. Record ID: ${recordId}`);
          } catch (inErr) {
            log(`❌ Session ${i + 1} Punch-In failed for ${userState.userName}: ${inErr.message}`);
          }
        }
        break; // Only process one session event per user per tick
      }

      // 2. Session Check-Out
      if (session.hasCheckedIn && !session.hasCheckedOut) {
        if (now >= session.checkOutTarget) {
          const isLastSession = i === userState.sessions.length - 1;
          if (isLastSession && userState.willForgetCheckout) {
            log(`⚠️ User ${userState.userName} forgot to check out of their last session today. Leaving open session.`);
            session.hasCheckedOut = true; // Complete simulation loops
            break;
          }

          try {
            log(`⏰ Punching Out user: ${userState.userName} (ID: ${userId}) for Session ${i + 1}/${userState.sessions.length}`);
            const formattedTimeStr = session.checkOutTarget.toISOString().slice(0, 19).replace('T', ' ');

            const existingRecord = await attendanceDB("attn_records")
              .where({ attendance_id: session.recordId })
              .first();

            let meta = {};
            if (existingRecord && existingRecord.metadata) {
              meta = typeof existingRecord.metadata === 'string' ? JSON.parse(existingRecord.metadata) : existingRecord.metadata;
            }

            meta.time_out = {
              accuracy: 10,
              ip_address: "127.0.0.1",
              user_agent: "Mozilla/5.0 (Simulated)",
              timestamp_utc: session.checkOutTarget.toISOString(),
              timezone: "Asia/Kolkata"
            };

            const rowImageKey = await uploadSimulatedSelfie(userId, userState.orgId || 1, "time_out");

            await attendanceDB("attn_records")
              .where({ attendance_id: session.recordId })
              .update({
                time_out: formattedTimeStr,
                time_out_image_key: rowImageKey || null,
                metadata: JSON.stringify(meta)
              });

            session.hasCheckedOut = true;

            // Sync daily calculations
            await syncDailyAttendance(userId, todayStr);
            
            log(`✅ Session ${i + 1} Punch-Out successful for ${userState.userName}.`);
          } catch (outErr) {
            log(`❌ Session ${i + 1} Punch-Out failed for ${userState.userName}: ${outErr.message}`);
          }
        }
        break;
      }
    }
  }
}

/**
 * Start the simulation schedule loop.
 */
async function startSimulator() {
  log("Initializing Attendance Simulator Process (Multi-session & Regional)...");
  
  // Load configuration from JSON
  loadSimulateConfig();

  // Set up today's states on startup
  await initializeDailyState();

  // Run the check tick at interval
  const interval = SIM_CONFIG?.config?.check_interval_ms || 60000;
  setInterval(async () => {
    try {
      await performSimulationStep();
    } catch (err) {
      log(`❌ Error in simulation step loop: ${err.message}`);
    }
  }, interval);
}

startSimulator();

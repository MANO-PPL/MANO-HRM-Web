import catchAsync from "../../utils/catchAsync.js";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import * as MapsService from "../../services/google_api_services/maps.js";
import { getEventSource } from "../../utils/clientInfo.js";
import * as AttendanceService from "./attendanceService.js";
import * as ShiftService from "../shifts/shiftService.js";
import { attendanceDB } from "../../config/database.js";
import { notifyCorrectionApplied, notifyCorrectionStatusUpdated } from "../collaboration/chatAlertService.js";
import { getLocalNow } from "../../services/statusEvalution/statusEvaluationService.js";
import { attendanceQueue, redisConnection } from "../../config/queues.js";
import { processAttendanceJob } from "./attendanceJobProcessor.js";
import { uploadFile } from "../../services/s3/s3Service.js";

/**
 * Resolves the user's local timezone.
 * Prioritizes the user's actual local context:
 * 1. User/Client provided timezone (req.body.timezone or req.headers['x-timezone'])
 * 2. GPS coordinates lookup via Google Maps API (if valid coordinates available)
 * 3. User's assigned branch/work location timezone
 * 4. Fallback: Organization timezone (only when user cannot provide timezone / GPS is unavailable)
 * 5. Default fallback ('Asia/Kolkata' or 'UTC')
 */
async function resolveEffectiveTimezone({ req, org_id, userId, latitude, longitude }) {
  // 1. Client provided timezone
  const clientTz = req.body?.timezone || req.headers?.['x-timezone'];
  if (clientTz && typeof clientTz === 'string' && clientTz.trim() && clientTz !== 'null' && clientTz !== 'undefined' && clientTz.trim() !== 'UTC') {
    return clientTz.trim();
  }

  // 2. GPS coordinate timezone resolution (when client did not provide tz, but GPS is available)
  if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude) && Number(latitude) !== 0 && Number(longitude) !== 0) {
    try {
      const tzData = await MapsService.fetchTimeStamp(Number(latitude), Number(longitude), new Date());
      if (tzData?.timezone) {
        return tzData.timezone;
      }
    } catch (e) {
      // Maps timezone service failed or unavailable; proceed to location/org fallback
    }
  }

  // 3. User assigned work location timezone
  if (userId) {
    try {
      const userLoc = await attendanceDB('org_user_work_locations as uwl')
        .join('org_work_locations as wl', 'uwl.location_id', 'wl.location_id')
        .where('uwl.user_id', userId)
        .where('wl.is_active', true)
        .select('wl.timezone')
        .first();
      if (userLoc?.timezone) {
        return userLoc.timezone;
      }
    } catch (e) { }
  }

  // 4. Fallback: Organization timezone (only if user cannot fetch GPS / no timezone detected)
  if (org_id) {
    try {
      const org = await attendanceDB('core_organizations')
        .where({ org_id })
        .select('timezone')
        .first();
      if (org?.timezone) {
        return org.timezone;
      }
    } catch (err) {
      console.warn(`Failed to fetch organization ${org_id} fallback timezone:`, err);
    }
  }

  // 5. Ultimate fallback
  return (clientTz && clientTz !== 'null' && clientTz !== 'undefined') ? clientTz.trim() : 'Asia/Kolkata';
}

/**
 * Standardizes attendance punch request data extraction and resolves local timezone.
 */
async function extractPunchContext(req) {
  const userId = req.user.id || req.user.user_id;
  const { org_id } = req.user;
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const accuracy = req.body.accuracy !== undefined && req.body.accuracy !== null && !isNaN(req.body.accuracy)
    ? Number(req.body.accuracy)
    : null;
  const address = req.body.address || null;
  const file = req.file || null;
  const ip = req.clientIp || req.ip;
  const userAgent = req.get('User-Agent');
  const eventSource = getEventSource(req);

  const timezone = await resolveEffectiveTimezone({ req, org_id, userId, latitude, longitude });
  const nowVal = getLocalNow(timezone);
  const localTime = req.body.local_time || req.body.localTime || String(nowVal).replace('Z', '');

  return {
    userId,
    org_id,
    latitude,
    longitude,
    accuracy,
    address,
    file,
    ip,
    userAgent,
    eventSource,
    timezone,
    localTime
  };
}

/**
 * Saves an uploaded selfie buffer to a temporary disk location for asynchronous background processing.
 */
async function saveTempSelfieFile(file) {
  if (!file || !file.buffer) return null;
  try {
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const ext = path.extname(file.originalname || '') || '.jpg';
    const filename = `${crypto.randomUUID()}${ext}`;
    const tempFilePath = path.join(tempDir, filename);
    await fs.writeFile(tempFilePath, file.buffer);
    return tempFilePath;
  } catch (err) {
    console.error("Failed to write temp selfie file to disk:", err);
    return null;
  }
}

/**
 * Queues heavy attendance background tasks (S3 upload, face check, geocoding) to Redis BullMQ
 * with an automatic direct background fallback when Redis is offline or unavailable.
 */
function dispatchAttendanceJob(jobName, jobData) {
  if (redisConnection && redisConnection.status === 'ready') {
    attendanceQueue.add(jobName, jobData, {
      attempts: 3,
      backoff: 5000
    }).catch(queueErr => {
      console.warn(`attendanceQueue.add(${jobName}) failed, processing directly:`, queueErr.message);
      processAttendanceJob(jobData).catch(directErr => {
        console.error(`Direct attendance processing error (${jobName}):`, directErr);
      });
    });
  } else {
    // Redis is offline / disconnected: run in direct async background immediately
    processAttendanceJob(jobData).catch(directErr => {
      console.error(`Direct attendance processing error (${jobName}):`, directErr);
    });
  }
}

/**
 * POST /attendance/timein
 * Handle user check-in with location and optional image
 */
export const timeIn = catchAsync(async (req, res) => {
  const ctx = await extractPunchContext(req);
  const late_reason = req.body.late_reason || null;

  // 1. FAST SYNCHRONOUS PROCESS (Compliance checks & DB insertion)
  const result = await AttendanceService.processTimeInSync({
    user_id: ctx.userId,
    org_id: ctx.org_id,
    latitude: ctx.latitude,
    longitude: ctx.longitude,
    accuracy: ctx.accuracy,
    address: ctx.address,
    late_reason,
    file: ctx.file,
    localTime: ctx.localTime,
    timezone: ctx.timezone,
    ip: ctx.ip,
    user_agent: ctx.userAgent
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

  // 2. DISPATCH BACKGROUND HEAVY TASKS (S3 upload, geocoding, face match)
  const tempFilePath = await saveTempSelfieFile(ctx.file);
  const jobData = {
    attendance_id: result.attendance_id,
    isTimeIn: true,
    tempFilePath,
    fileBuffer: ctx.file ? ctx.file.buffer : null,
    latitude: ctx.latitude,
    longitude: ctx.longitude,
    accuracy: ctx.accuracy,
    address: ctx.address,
    ip: ctx.ip,
    user_agent: ctx.userAgent,
    event_source: ctx.eventSource,
    timezone: ctx.timezone,
    org_id: ctx.org_id,
    user_id: ctx.userId,
    session_number: result.session_number
  };

  dispatchAttendanceJob('attendance-checkin', jobData);

  return res.json(result);
});

/**
 * POST /attendance/timeout
 * Handle user check-out with location and optional image
 */
export const timeOut = catchAsync(async (req, res) => {
  const ctx = await extractPunchContext(req);

  // 1. FAST SYNCHRONOUS PROCESS (Compliance checks & DB checkout status/hours update)
  const result = await AttendanceService.processTimeOutSync({
    user_id: ctx.userId,
    org_id: ctx.org_id,
    latitude: ctx.latitude,
    longitude: ctx.longitude,
    accuracy: ctx.accuracy,
    address: ctx.address,
    file: ctx.file,
    localTime: ctx.localTime,
    timezone: ctx.timezone,
    ip: ctx.ip,
    user_agent: ctx.userAgent
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

  // 2. DISPATCH BACKGROUND HEAVY TASKS
  const tempFilePath = await saveTempSelfieFile(ctx.file);
  const jobData = {
    attendance_id: result.attendance_id,
    isTimeIn: false,
    tempFilePath,
    fileBuffer: ctx.file ? ctx.file.buffer : null,
    latitude: ctx.latitude,
    longitude: ctx.longitude,
    accuracy: ctx.accuracy,
    address: ctx.address,
    ip: ctx.ip,
    user_agent: ctx.userAgent,
    event_source: ctx.eventSource,
    timezone: ctx.timezone,
    org_id: ctx.org_id,
    user_id: ctx.userId,
    status: result.status
  };

  dispatchAttendanceJob('attendance-checkout', jobData);

  return res.json(result);
});

/**
 * POST /attendance/simulate/timein
 * DEVELOPMENT ONLY - Simulate check-in with custom timestamp
 */
export const simulateTimeIn = catchAsync(async (req, res) => {
  // DEVELOPMENT ONLY
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ ok: false, message: "Not Found" });
  }

  // Allow admin and hr to simulate for others
  let target_user_id = req.user.id || req.user.user_id;
  if (req.body.user_id && ["admin", "hr"].includes(req.user.user_type)) {
    target_user_id = req.body.user_id;
  }

  const {
    latitude = 0,
    longitude = 0,
    accuracy = 10,
    simulated_time,
    simulated_address = "Simulated Location",
    late_reason
  } = req.body;

  const file = req.file;

  if (!simulated_time) {
    return res.status(400).json({ ok: false, message: "simulated_time (ISO format) is required" });
  }

  // Resolve simulation timezone
  let simTimezone = req.body.timezone || null;
  if (!simTimezone && latitude && longitude && latitude !== 0 && longitude !== 0) {
    try {
      const tzData = await MapsService.fetchTimeStamp(latitude, longitude, new Date());
      if (tzData?.timezone) simTimezone = tzData.timezone;
    } catch (e) { }
  }
  if (!simTimezone) {
    try {
      const org = await attendanceDB('core_organizations')
        .where({ org_id: req.user.org_id })
        .select('timezone')
        .first();
      if (org?.timezone) simTimezone = org.timezone;
    } catch (e) { }
  }
  if (!simTimezone) simTimezone = 'Asia/Kolkata';

  let address = req.body.simulated_address || req.body.address || null;
  if (!address && latitude && longitude && latitude !== 0 && longitude !== 0) {
    try {
      const addrRes = await MapsService.coordsToAddress(latitude, longitude);
      if (addrRes?.address) address = addrRes.address;
    } catch (e) { }
  }
  if (!address) address = "Simulated Location";

  const result = await AttendanceService.processTimeIn({
    user_id: target_user_id,
    org_id: req.user.org_id,
    latitude,
    longitude,
    accuracy,
    late_reason,
    file: file,
    localTime: simulated_time,
    address: address,
    timezone: simTimezone,
    ip: req.clientIp || req.ip,
    user_agent: "Simulation/" + req.get('User-Agent'),
    event_source: "SIMULATION"
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

  res.json({ ...result, _simulation: true });
});

/**
 * POST /attendance/simulate/timeout
 * DEVELOPMENT ONLY - Simulate check-out with custom timestamp
 */
export const simulateTimeOut = catchAsync(async (req, res) => {
  // DEVELOPMENT ONLY
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ ok: false, message: "Not Found" });
  }

  // Allow admin and hr to simulate for others
  let target_user_id = req.user.id || req.user.user_id;
  if (req.body.user_id && ["admin", "hr"].includes(req.user.user_type)) {
    target_user_id = req.body.user_id;
  }

  const {
    latitude = 0,
    longitude = 0,
    accuracy = 10,
    simulated_time,
    simulated_address
  } = req.body;

  const file = req.file;

  if (!simulated_time) {
    return res.status(400).json({ ok: false, message: "simulated_time (ISO format) is required" });
  }

  // Resolve simulation timezone
  let simTimezone = req.body.timezone || null;
  if (!simTimezone && latitude && longitude && latitude !== 0 && longitude !== 0) {
    try {
      const tzData = await MapsService.fetchTimeStamp(latitude, longitude, new Date());
      if (tzData?.timezone) simTimezone = tzData.timezone;
    } catch (e) { }
  }
  if (!simTimezone) {
    try {
      const org = await attendanceDB('core_organizations')
        .where({ org_id: req.user.org_id })
        .select('timezone')
        .first();
      if (org?.timezone) simTimezone = org.timezone;
    } catch (e) { }
  }
  if (!simTimezone) simTimezone = 'Asia/Kolkata';

  let outAddress = req.body.simulated_address || req.body.address || null;
  if (!outAddress && latitude && longitude && latitude !== 0 && longitude !== 0) {
    try {
      const addrRes = await MapsService.coordsToAddress(latitude, longitude);
      if (addrRes?.address) outAddress = addrRes.address;
    } catch (e) { }
  }
  if (!outAddress) outAddress = "Simulated Location";

  const result = await AttendanceService.processTimeOut({
    user_id: target_user_id,
    org_id: req.user.org_id,
    latitude,
    longitude,
    accuracy,
    file: file,
    localTime: simulated_time,
    address: outAddress,
    timezone: simTimezone,
    ip: req.clientIp || req.ip,
    user_agent: "Simulation/" + req.get('User-Agent'),
    event_source: "SIMULATION"
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

  res.json({ ...result, _simulation: true });
});

/**
 * GET /attendance/records/admin
 * Admin endpoint to fetch attendance records with filters
 */
export const getAdminRecords = catchAsync(async (req, res) => {
  if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
    return res.status(403).json({ ok: false, message: "Access denied" });
  }

  const { user_id, date_from, date_to, limit = 50 } = req.query;
  const org_id = req.user.org_id;
  const current_user_id = req.user.id || req.user.user_id;

  const records = await AttendanceService.fetchAdminRecords({
    org_id,
    user_id,
    date_from,
    date_to,
    limit
  });

  res.json({ ok: true, data: records });
});

/**
 * GET /attendance/records
 * User endpoint to fetch their own attendance records
 */
export const getUserRecords = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user.user_id;
  const { date_from, date_to, limit = 50 } = req.query;

  const records = await AttendanceService.fetchUserRecords({
    user_id: userId,
    date_from,
    date_to,
    limit
  });

  res.json({ ok: true, data: records });
});

/**
 * GET /attendance/my-shift
 * Fetch the current logged-in user's shift and policy rules
 */
export async function getMyShift(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      console.error("getMyShift called without req.user.id", req.user);
      return res.status(401).json({ ok: false, message: "Unauthorized: missing authenticated user id" });
    }

    const shift = await ShiftService.getUserShift(userId);

    if (!shift) {
      const rules = ShiftService.getShiftRules(null);
      return res.json({
        ok: true,
        shift: {
          id: null,
          name: "Open Shift",
          start_time: null,
          end_time: null,
          rules
        }
      });
    }

    const rules = ShiftService.getShiftRules(shift);

    res.json({
      ok: true,
      shift: {
        id: shift.shift_id || null,
        name: shift.shift_name || "Open Shift",
        start_time: shift.start_time || rules.shift_timing?.start_time || null,
        end_time: shift.end_time || rules.shift_timing?.end_time || null,
        rules
      }
    });
  } catch (error) {
    console.error("Error fetching my shift:", error);
    res.status(500).json({ ok: false, message: "Failed to fetch shift details" });
  }
}

/**
 * GET /attendance/daily-summary
 * Get daily summary history with shift policies evaluated dynamically for the logged-in user.
 */
export const getUserDailySummary = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user.user_id;
  const { org_id } = req.user;
  const { date_from, date_to } = req.query;

  if (!date_from || !date_to) {
    return res.status(400).json({ ok: false, message: "date_from and date_to parameters are required." });
  }

  const summaries = await AttendanceService.getDailySummary({
    org_id,
    user_id: userId,
    date_from,
    date_to
  });

  const userSummary = summaries.find(s => s.user_id === userId) || { days: [] };

  return res.json({
    ok: true,
    data: userSummary.days
  });
});

/**
 * GET /attendance/daily-summary/admin
 * Admin dashboard endpoint to fetch dynamic daily summaries for all active staff on a given date.
 */
export const getAdminDailySummary = catchAsync(async (req, res) => {
  const { org_id } = req.user;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ ok: false, message: "date parameter is required." });
  }

  const summaries = await AttendanceService.getDailySummary({
    org_id,
    date_from: date,
    date_to: date
  });

  let timezone = req.query.timezone || req.headers['x-timezone'];
  if (!timezone) {
    try {
      const org = await attendanceDB("core_organizations")
        .where("org_id", org_id)
        .select("timezone")
        .first();
      if (org && org.timezone) {
        timezone = org.timezone;
      }
    } catch (err) {
      console.error("Failed to fetch organization timezone:", err);
    }
  }
  if (!timezone) timezone = "UTC";

  const staff = summaries.map(s => {
    const dayData = s.days[0] || {
      status: "ABSENT",
      total_hours: 0,
      first_in: null,
      last_out: null,
      late_minutes: 0,
      late_reason: "",
      overtime_hours: 0,
      overtime_minutes: 0,
      expected_hours: 0,
      sessions: []
    };

    return {
      user_id: s.user_id,
      user_name: s.user_name,
      desg_name: s.desg_name,
      dept_name: s.dept_name,
      profile_image_url: s.profile_image_url,
      shift_id: s.shift_id,
      status: dayData.status,
      total_hours: dayData.total_hours,
      first_in: dayData.first_in,
      last_out: dayData.last_out,
      late_minutes: dayData.late_minutes,
      late_reason: dayData.late_reason,
      overtime_hours: dayData.overtime_hours,
      overtime_minutes: dayData.overtime_minutes !== undefined ? dayData.overtime_minutes : Math.round((dayData.overtime_hours || 0) * 60),
      expected_hours: dayData.expected_hours,
      sessions: dayData.sessions
    };
  });

  return res.json({
    ok: true,
    timezone,
    data: staff
  });
});

function generateNodeAiSummaryFallback(body) {
  const date = body?.date || getLocalNow('Asia/Kolkata').split('T')[0];
  const employees = Array.isArray(body?.employees) ? body.employees : [];
  const analytics = body?.analytics || {};

  const presentEmployees = [];
  const absentEmployees = [];
  const onLeaveEmployees = [];

  employees.forEach(emp => {
    const status = String(emp.status || '').toLowerCase();
    const note = status.includes('late') ? 'Arrived late' : null;
    const item = {
      name: emp.name || 'Staff Member',
      department: emp.department || 'Unassigned',
      status: emp.status || 'absent',
      check_in: emp.check_in || null,
      check_out: emp.check_out || null,
      note
    };

    if (status.includes('present') || status.includes('late') || status.includes('active')) {
      presentEmployees.push(item);
    } else if (status.includes('leave')) {
      onLeaveEmployees.push(item);
    } else {
      absentEmployees.push(item);
    }
  });

  const presentRate = Number(analytics.present_rate ?? (employees.length ? Math.round((presentEmployees.length / employees.length) * 100) : 0));
  const lateRate = Number(analytics.late_rate ?? 0);
  const avgWorkHours = Number(analytics.avg_work_hours ?? 8.0);

  const highlights = [
    `Workplace attendance rate recorded at ${presentRate.toFixed(1)}% for ${date}.`,
    `Late arrival frequency logged at ${lateRate.toFixed(1)}% across departments.`,
    `Average daily working shift duration logged at ${avgWorkHours.toFixed(1)} hours.`
  ];

  const overallSummary = `Attendance summary for ${date}: ${presentEmployees.length} of ${employees.length || presentEmployees.length} personnel active or present (${presentRate.toFixed(1)}%). ${absentEmployees.length} marked absent, and ${onLeaveEmployees.length} on leave.`;

  return {
    overall_summary: overallSummary,
    present_employees: presentEmployees,
    absent_employees: absentEmployees,
    on_leave_employees: onLeaveEmployees,
    analytics_insights: {
      present_rate: presentRate,
      late_rate: lateRate,
      avg_work_hours: avgWorkHours,
      highlights
    }
  };
}

/**
 * POST /attendance/ai-summary
 * Summary from the Python service (backend/services/ai_summary) when
 * AI_SUMMARY_URL is set, otherwise the built-in summary.
 *
 * The service is not deployed. It used to be called at 127.0.0.1:8001, which
 * on the production server is another application (the corporate website's
 * API), so employee attendance data was sent there and the built-in summary
 * was returned after its error anyway.
 */
export const getAiSummary = catchAsync(async (req, res) => {
  const serviceUrl = process.env.AI_SUMMARY_URL;
  if (!serviceUrl) {
    return res.json(generateNodeAiSummaryFallback(req.body));
  }

  try {
    const response = await axios.post(`${serviceUrl.replace(/\/+$/, '')}/summarize`, req.body, { timeout: 15000 });
    return res.json(response.data);
  } catch (error) {
    console.error("AI microservice error, using fallback summary:", error.message);
    if (error.response && error.response.status === 422) {
      return res.status(422).json(error.response.data);
    }
    const fallback = generateNodeAiSummaryFallback(req.body);
    return res.json(fallback);
  }
});

/**
 * POST /attendance/ping
 * Handle presence/location ping (normal_punch)
 */
export const pingLocation = catchAsync(async (req, res) => {
  const ctx = await extractPunchContext(req);

  const result = await AttendanceService.recordLocationPing({
    userId: ctx.userId,
    latitude: ctx.latitude,
    longitude: ctx.longitude,
    accuracy: ctx.accuracy,
    address: ctx.address,
    note: req.body.note ? String(req.body.note).trim() : null,
    file: ctx.file,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    isGeofenceViolation: Boolean(req.body.is_geofence_violation),
    localTime: ctx.localTime
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

  return res.json(result);
});

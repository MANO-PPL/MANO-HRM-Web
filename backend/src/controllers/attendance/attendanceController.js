import catchAsync from "../../utils/catchAsync.js";
import * as MapsService from "../../services/google_api_services/maps.js";
import { getEventSource } from "../../utils/clientInfo.js";
import * as AttendanceService from "../../services/attendance/attendanceService.js";
import * as ShiftManagementService from "../../services/attendance/shiftManagementService.js";
import ExcelJS from "exceljs";
import { attendanceDB } from "../../config/database.js";
import { generatePdf, styleExcelWorksheet } from "../reports/reportsController.js";
import { calculateWorkHours, deriveStatus } from "../../services/reports/reportsServices.js";
import { notifyCorrectionApplied, notifyCorrectionStatusUpdated } from "../../services/collaboration/chatAlertService.js";


/**
 * POST /attendance/timein
 * Handle user check-in with location and optional image
 */
export const timeIn = catchAsync(async (req, res) => {
  // 1. DATA PREPARATION
  const userId = req.user.id || req.user.user_id;
  const { org_id } = req.user;
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const accuracy = Number(req.body.accuracy);
  const late_reason = req.body.late_reason || null;
  const file = req.file;

  // 2. CONTEXT LOADING (Google Maps)
  const nowUTC = new Date().toISOString();
  let tz = { localTime: nowUTC, tzName: "UTC" };
  let address = "Unknown Location";

  try {
    if (!isNaN(latitude) && !isNaN(longitude)) {
      tz = await MapsService.fetchTimeStamp(latitude, longitude, nowUTC);
      const addrRes = await MapsService.coordsToAddress(latitude, longitude);
      if (addrRes) address = addrRes.address;
    }
  } catch (e) {
    console.error("Maps API Error:", e);
  }

  // 3. DELEGATE TO SERVICE
  const result = await AttendanceService.processTimeIn({
    user_id: userId,
    org_id,
    latitude,
    longitude,
    accuracy,
    late_reason,
    file,
    localTime: tz.localTime,
    address,
    timezone: tz.timezone,
    ip: req.clientIp || req.ip,
    user_agent: req.get('User-Agent'),
    event_source: getEventSource(req)
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

  return res.json(result);
});

/**
 * POST /attendance/timeout
 * Handle user check-out with location and optional image
 */
export const timeOut = catchAsync(async (req, res) => {
  // 1. DATA PREPARATION
  const userId = req.user.id || req.user.user_id;
  const { org_id } = req.user;
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const accuracy = Number(req.body.accuracy);
  const file = req.file;

  // 2. CONTEXT LOADING
  const nowUTC = new Date().toISOString();
  let tz = { localTime: nowUTC, tzName: "UTC" };
  let address = "Unknown Location";

  try {
    if (!isNaN(latitude) && !isNaN(longitude)) {
      tz = await MapsService.fetchTimeStamp(latitude, longitude, nowUTC);
      const addrRes = await MapsService.coordsToAddress(latitude, longitude);
      if (addrRes) address = addrRes.address;
    }
  } catch (e) {
    console.error("Maps API Error", e);
  }

  // 3. DELEGATE TO SERVICE
  const result = await AttendanceService.processTimeOut({
    user_id: userId,
    org_id,
    latitude,
    longitude,
    accuracy,
    file,
    localTime: tz.localTime,
    address,
    timezone: tz.timezone,
    ip: req.clientIp || req.ip,
    user_agent: req.get('User-Agent'),
    event_source: getEventSource(req)
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

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

  const result = await AttendanceService.processTimeIn({
    user_id: target_user_id,
    org_id: req.user.org_id,
    latitude,
    longitude,
    accuracy,
    late_reason,
    file: file,
    localTime: simulated_time,
    address: simulated_address,
    timezone: "Simulated Timezone",
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
    simulated_address = "Simulated Location"
  } = req.body;

  const file = req.file;

  if (!simulated_time) {
    return res.status(400).json({ ok: false, message: "simulated_time (ISO format) is required" });
  }

  const result = await AttendanceService.processTimeOut({
    user_id: target_user_id,
    org_id: req.user.org_id,
    latitude,
    longitude,
    accuracy,
    file: file,
    localTime: simulated_time,
    address: simulated_address,
    timezone: "Simulated Timezone",
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
 * POST /attendance/correction-request
 * Submit a correction request for attendance
 */
export const submitCorrectionRequest = catchAsync(async (req, res) => {
  const {
    correction_type,
    request_date,
    reason,
    original_data,
    proposed_data
  } = req.body;

  const user_id = req.user.id || req.user.user_id;
  const org_id = req.user.org_id;

  if (!correction_type || !request_date || !reason) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!proposed_data || !Array.isArray(proposed_data) || proposed_data.length === 0) {
    return res.status(400).json({ error: "proposed_data (sessions array) is required" });
  }

  const id = await AttendanceService.createCorrectionRequest({
    org_id,
    user_id,
    correction_type,
    request_date,
    original_data,
    proposed_data,
    reason
  });

  // Trigger premium correction request DM alert cards to all Admins and HRs
  const io = req.app.get('io');
  notifyCorrectionApplied({ org_id, sender_id: user_id, acr_id: id, io }).catch(console.error);

  res.status(201).json({
    message: "Correction request submitted",
    acr_id: id
  });
});

/**
 * GET /attendance/correction-requests
 * Fetch correction requests with filters
 */
export const getCorrectionRequests = catchAsync(async (req, res) => {
  const { status, date, month, year, page = 1, limit = 10, my_requests } = req.query;
  const org_id = req.user.org_id;
  const user_id = req.user.id || req.user.user_id;
  const user_type = (my_requests === 'true' || my_requests === true) ? 'employee' : req.user.user_type;

  const result = await AttendanceService.fetchCorrectionRequests({
    org_id,
    user_id,
    user_type,
    status,
    date,
    month,
    year,
    page,
    limit
  });

  res.json(result);
});

/**
 * GET /attendance/correction-request/:acr_id
 * Fetch single correction request details
 */
export const getCorrectionRequestById = catchAsync(async (req, res) => {
  const { acr_id } = req.params;
  const org_id = req.user.org_id;
  const user_id = req.user.id || req.user.user_id;
  const role = req.user.user_type;

  const correction = await AttendanceService.fetchCorrectionRequestById({
    acr_id,
    org_id,
    user_id,
    role
  });

  if (!correction) {
    return res.status(404).json({ error: "Request not found" });
  }

  res.json(correction);
});

/**
 * PATCH /attendance/correct-request/:acr_id
 * Admin endpoint to approve/reject correction request
 */
export const reviewCorrectionRequest = catchAsync(async (req, res) => {
  const { acr_id } = req.params;
  const { status, review_comments, sessions } = req.body;

  const org_id = req.user.org_id;
  const reviewer_id = req.user.id || req.user.user_id;
  const role = req.user.user_type;

  if (role !== "admin" && role !== "hr") {
    return res.status(403).json({ error: "Access denied" });
  }

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    await AttendanceService.reviewCorrectionRequest({
      acr_id,
      org_id,
      reviewer_id,
      status,
      review_comments,
      adminOverrideSessions: sessions
    });

    // Trigger premium correction status update card in employee's DM chat
    const io = req.app.get('io');
    notifyCorrectionStatusUpdated({ org_id, reviewer_id, acr_id, io }).catch(console.error);

    res.json({ message: `Request ${status} successfully` });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
});

/**
 * GET /attendance/records/export
 * Export user's attendance records for a month as Excel
 */
export const exportRecords = catchAsync(async (req, res) => {
  const { month, format = "xlsx" } = req.query;
  const user_id = req.user.id || req.user.user_id;
  const org_id = req.user.org_id;
  const user_name = req.user.user_name;

  if (!month) {
    return res.status(400).json({ ok: false, message: "Month (YYYY-MM) is required" });
  }

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);

  if (isNaN(year) || isNaN(monthNum)) {
    return res.status(400).json({ ok: false, message: "Invalid month format. Use YYYY-MM." });
  }

  // Fetch monthly records for individual user
  const startDate = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`;

  const records = await attendanceDB("attendance_records")
    .where({ user_id, org_id })
    .whereRaw("DATE(time_in) >= ?", [startDate])
    .whereRaw("DATE(time_in) <= ?", [endDate])
    .orderBy("time_in", "asc");

  const sanitizedUserName = user_name.replace(/\s+/g, '_');

  // Handle PDF Export
  if (format === "pdf") {
    const pdfTitle = `Attendance Report - ${user_name} (${month})`;
    const pdfCols = ["Date", "Time In", "Time Out", "Work Hours", "Status", "Late (Mins)", "In Location", "Out Location"];
    const pdfRows = records.map(r => [
      new Date(r.time_in).toLocaleDateString(),
      r.time_in ? new Date(r.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
      r.time_out ? new Date(r.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
      calculateWorkHours(r.time_in, r.time_out),
      deriveStatus(r),
      r.late_minutes || 0,
      r.time_in_address || "-",
      r.time_out_address || "-"
    ]);

    const pdfDoc = generatePdf(pdfTitle, pdfCols, pdfRows);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Attendance_${month}_${sanitizedUserName}.pdf`);
    pdfDoc.pipe(res);
    pdfDoc.end();
    return;
  }

  // Handle Excel / CSV Export
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("My Attendance");

  worksheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Time In", key: "time_in", width: 15 },
    { header: "Time Out", key: "time_out", width: 15 },
    { header: "Work Hours", key: "work_hours", width: 12 },
    { header: "Status", key: "status", width: 15 },
    { header: "Late (Mins)", key: "late_minutes", width: 12 },
    { header: "In Location", key: "in_location", width: 40 },
    { header: "Out Location", key: "out_location", width: 40 }
  ];

  records.forEach(r => {
    worksheet.addRow({
      date: new Date(r.time_in).toLocaleDateString(),
      time_in: r.time_in ? new Date(r.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
      time_out: r.time_out ? new Date(r.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
      work_hours: parseFloat(calculateWorkHours(r.time_in, r.time_out)) || 0,
      status: deriveStatus(r),
      late_minutes: r.late_minutes || 0,
      in_location: r.time_in_address || "-",
      out_location: r.time_out_address || "-"
    });
  });

  const lastRow = worksheet.rowCount;
  if (lastRow > 1) {
    worksheet.addRow({
      date: "TOTALS",
      time_in: "",
      time_out: "",
      work_hours: { formula: `SUM(D2:D${lastRow})` },
      status: "",
      late_minutes: { formula: `SUM(F2:F${lastRow})` },
      in_location: "",
      out_location: ""
    });
  }

  if (format === "xlsx") {
    styleExcelWorksheet(worksheet, "individual_attendance");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Attendance_${month}_${sanitizedUserName}.xlsx`);
    await workbook.xlsx.write(res);
  } else {
    // CSV
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=Attendance_${month}_${sanitizedUserName}.csv`);
    await workbook.csv.write(res);
  }

  res.end();
});

/**
 * GET /attendance/my-shift
 * Fetch the current logged-in user's shift and policy rules
 */
export async function getMyShift(req, res) {
  try {
    const { user_id } = req.user;
    const shift = await AttendanceService.getUserShift(user_id);

    if (!shift) {
      const rules = ShiftManagementService.getShiftRules(null);
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

    const rules = ShiftManagementService.getShiftRules(shift);

    res.json({
      ok: true,
      shift: {
        id: shift.shift_id,
        name: shift.shift_name,
        start_time: shift.start_time || rules.shift_timing?.start_time,
        end_time: shift.end_time || rules.shift_timing?.end_time,
        rules
      }
    });
  } catch (error) {
    console.error("Error fetching my shift:", error);
    res.status(500).json({ message: "Internal server error" });
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

  let timezone = "UTC";
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

  const staff = summaries.map(s => {
    const dayData = s.days[0] || {
      status: "ABSENT",
      total_hours: 0,
      first_in: null,
      last_out: null,
      late_minutes: 0,
      late_reason: "",
      overtime_hours: 0,
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


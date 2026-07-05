import express from "express";
import multer from "multer";
import { authenticateJWT } from "../../middleware/auth.js";
import * as AttendanceController from "../../controllers/attendance/attendanceController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // store files in memory

// ========== TIME IN/OUT ENDPOINTS ==========

/**
 * POST /attendance/timein
 * User check-in with location and optional image
 */
router.post("/timein", 
  authenticateJWT, 
  upload.single("image"),
  AttendanceController.timeIn
);

/**
 * POST /attendance/timeout
 * User check-out with location and optional image
 */
router.post("/timeout", 
  authenticateJWT, 
  upload.single("image"),
  AttendanceController.timeOut
);

// ========== SIMULATION ENDPOINTS (DEVELOPMENT ONLY) ==========

/**
 * POST /attendance/simulate/timein
 * Simulate check-in with custom timestamp
 */
router.post("/simulate/timein", 
  authenticateJWT, 
  upload.single("image"),
  AttendanceController.simulateTimeIn
);

/**
 * POST /attendance/simulate/timeout
 * Simulate check-out with custom timestamp
 */
router.post("/simulate/timeout", 
  authenticateJWT, 
  upload.single("image"),
  AttendanceController.simulateTimeOut
);

// ========== RECORDS ENDPOINTS ==========

/**
 * GET /attendance/records/admin
 * Admin endpoint to fetch attendance records with filters
 */
router.get("/records/admin", 
  authenticateJWT, 
  AttendanceController.getAdminRecords
);

/**
 * GET /attendance/records
 * User endpoint to fetch their own attendance records
 */
router.get("/records", 
  authenticateJWT, 
  AttendanceController.getUserRecords
);

/**
 * GET /attendance/daily-summary/admin
 * Admin endpoint to get dynamic daily summary for all staff on a date
 */
router.get("/daily-summary/admin",
  authenticateJWT,
  AttendanceController.getAdminDailySummary
);

/**
 * GET /attendance/daily-summary
 * User endpoint to get daily summary history for a date range
 */
router.get("/daily-summary",
  authenticateJWT,
  AttendanceController.getUserDailySummary
);

/**
 * GET /attendance/records/export
 * Export user's attendance records for a month as Excel
 */
router.get("/records/export", 
  authenticateJWT, 
  AttendanceController.exportRecords
);

// ========== CORRECTION REQUEST ENDPOINTS ==========

/**
 * POST /attendance/correction-request
 * Submit a correction request for attendance
 */
router.post("/correction-request", 
  authenticateJWT, 
  AttendanceController.submitCorrectionRequest
);

/**
 * GET /attendance/correction-requests
 * Fetch correction requests with filters (user sees their own, admin sees all)
 */
router.get("/correction-requests", 
  authenticateJWT, 
  AttendanceController.getCorrectionRequests
);

/**
 * GET /attendance/correction-request/:acr_id
 * Fetch single correction request details
 */
router.get("/correction-request/:acr_id", 
  authenticateJWT, 
  AttendanceController.getCorrectionRequestById
);

/**
 * PATCH /attendance/correct-request/:acr_id
 * Admin endpoint to approve/reject correction request
 */
router.patch("/correct-request/:acr_id", 
  authenticateJWT, 
  AttendanceController.reviewCorrectionRequest
);

/**
 * GET /attendance/my-shift
 * Fetch current user's shift policy
 */
router.get("/my-shift", authenticateJWT, AttendanceController.getMyShift);

/**
 * POST /attendance/ai-summary
 * Fetch AI summary from the Python microservice (port 8001)
 */
router.post("/ai-summary", authenticateJWT, AttendanceController.getAiSummary);

export default router;

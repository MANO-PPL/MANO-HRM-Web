import express from "express";
import multer from "multer";
import { authenticateJWT, authorize } from "../../middleware/auth.js";
import * as AttendanceController from "./attendanceController.js";

const router = express.Router();
// Selfies are compressed client-side (1024px WebP); 5 MB bounds memory use
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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


router.post("/ping",
  authenticateJWT,
  upload.single("image"),
  AttendanceController.pingLocation
);

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
  authorize("admin", "hr"),
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

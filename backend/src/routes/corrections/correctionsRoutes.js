import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../middleware/auth.js';
import * as correctionsController from '../../controllers/corrections/correctionsController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ========== SUBMIT / UPDATE CORRECTION REQUEST ==========
// Web: /corrections/request | Mobile: /attendance/correction-request
router.post(
  ["/request", "/correction-request"],
  authenticateJWT,
  upload.single("attachment"),
  correctionsController.submitCorrectionRequest
);

// ========== LIST CORRECTION REQUESTS ==========
// Web: /corrections/requests | Mobile: /attendance/correction-requests
router.get(
  ["/requests", "/correction-requests"],
  authenticateJWT,
  correctionsController.getCorrectionRequests
);

// ========== GET SINGLE CORRECTION REQUEST ==========
// Web: /corrections/request/:acr_id | Mobile: /attendance/correction-request/:acr_id
router.get(
  ["/request/:acr_id", "/correction-request/:acr_id"],
  authenticateJWT,
  correctionsController.getCorrectionRequestById
);

// ========== REVIEW (APPROVE / REJECT) CORRECTION REQUEST ==========
// Web: /corrections/request/:acr_id | Mobile: /attendance/correct-request/:acr_id
router.patch(
  ["/request/:acr_id", "/correct-request/:acr_id"],
  authenticateJWT,
  correctionsController.reviewCorrectionRequest
);

export default router;
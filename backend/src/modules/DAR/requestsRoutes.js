import express from 'express';
import { authenticateJWT, authorize } from '../../middleware/auth.js';
import * as DarRequestController from './requestsControllers.js';

const router = express.Router();
const staff = authorize('admin', 'hr');

// POST /dar/requests/create
router.post('/create', authenticateJWT, DarRequestController.createRequest);
// GET /dar/requests/list
router.get('/list', authenticateJWT, staff, DarRequestController.listRequests);
// POST /dar/requests/approve/:id
router.post('/approve/:id', authenticateJWT, staff, DarRequestController.approveRequest);
// POST /dar/requests/reject/:id
router.post('/reject/:id', authenticateJWT, staff, DarRequestController.rejectRequest);

export default router;

import express from 'express';
import { authenticateJWT, authorize } from '../../middleware/auth.js';
import * as ShiftController from './shiftController.js';

const router = express.Router();
const staff = authorize('admin', 'hr');

// Shift CRUD (reading is open to all users; changes are admin/HR only)
router.get('/shifts', authenticateJWT, ShiftController.getShifts);
router.post('/shifts', authenticateJWT, staff, ShiftController.createShift);
router.put('/shifts/:shift_id', authenticateJWT, staff, ShiftController.updateShift);
router.delete('/shifts/:shift_id', authenticateJWT, staff, ShiftController.deleteShift);

// Shift assignment
router.get('/shift-users', authenticateJWT, staff, ShiftController.getShiftUsers);
router.put('/users/:user_id/shift', authenticateJWT, staff, ShiftController.assignUserShift);

export default router;

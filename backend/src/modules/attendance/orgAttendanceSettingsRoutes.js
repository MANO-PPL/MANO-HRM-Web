import express from 'express';
import { authenticateJWT, authorize } from '../../middleware/auth.js';
import * as OrgAttendanceSettingsController from './orgAttendanceSettingsController.js';

const router = express.Router();

router.use(authenticateJWT);

router.get('/', authorize('admin', 'hr'), OrgAttendanceSettingsController.getSettings);
router.patch('/', authorize('admin', 'hr'), OrgAttendanceSettingsController.updateSettings);

export default router;

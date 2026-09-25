import express from 'express';
import { authenticateJWT, authorize } from '../../middleware/auth.js';
import * as DarSettingsController from './settingsController.js';

const router = express.Router();

// Employees need the categories list; only admin/HR may change settings
router.get('/list', authenticateJWT, DarSettingsController.getSettings);
router.post('/update', authenticateJWT, authorize('admin', 'hr'), DarSettingsController.updateSettings);

export default router;

import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import * as DarSettingsController from './settingsController.js';

const router = express.Router();

router.get('/list', authenticateJWT, DarSettingsController.getSettings);
router.post('/update', authenticateJWT, DarSettingsController.updateSettings);

export default router;
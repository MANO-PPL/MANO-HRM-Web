import express from 'express';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import * as LocationController from "./employeeControllers.js";

const router = express.Router();

router.use(authenticateJWT, requireActiveOrg);

// GET /employee/locations
router.get('/locations', LocationController.getLocations);

export default router;

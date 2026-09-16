import express from 'express';
import * as orgController from './orgController.js';
import { authenticateJWT, authorize } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT, authorize('super_admin'));

router.post('/', orgController.createOrganization);
router.get('/', orgController.getOrganizations);
router.get('/check-code', orgController.checkOrgCodeAvailability);
router.put('/:id', orgController.updateOrganization);
router.delete('/:id', orgController.deleteOrganization);
router.post('/:id/cancel-deletion', orgController.cancelOrgDeletion);
router.get('/:id/admins', orgController.getOrgAdmins);
router.put('/:id/admins/:adminId', orgController.updateOrgAdmin);
router.get('/:id/analytics', orgController.getOrgAnalytics);
router.get('/:id/logs', orgController.getOrgLogs);

export default router;

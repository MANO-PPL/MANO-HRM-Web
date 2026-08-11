import express from 'express';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import { getNotifications, markAsRead, markAllAsRead, registerFCMToken, unregisterFCMToken, testPushNotification }
    from '../../controllers/notifications/notificationController.js';


const router = express.Router();

router.use(authenticateJWT, requireActiveOrg);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.post('/register-token', registerFCMToken);
router.post('/unregister-token', unregisterFCMToken);
router.post('/test-push', testPushNotification);

export default router;
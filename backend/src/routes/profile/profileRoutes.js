import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../middleware/auth.js';
import * as profileController from '../../controllers/profile/profileController.js';

const router = express.Router();
const upload = multer({
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

router.use(authenticateJWT);

router.post('/', upload.single('avatar'), profileController.uploadProfilePicture);
router.delete('/', profileController.deleteProfilePicture);
router.get('/me', profileController.getMyProfile);
router.patch('/preferences', profileController.updatePreferences);

export default router;

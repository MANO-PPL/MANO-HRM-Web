import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../middleware/auth.js';
import * as profileController from '../../controllers/profile/profileController.js';

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            const err = new Error('Invalid file format. Please upload an image file (JPEG, PNG, WebP, GIF).');
            err.statusCode = 400;
            cb(err, false);
        }
    }
});

router.use(authenticateJWT);

router.post('/', upload.single('avatar'), profileController.uploadProfilePicture);
router.delete('/', profileController.deleteProfilePicture);
router.get('/me', profileController.getMyProfile);
router.patch('/preferences', profileController.updatePreferences);

export default router;

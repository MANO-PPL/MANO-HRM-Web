import express from 'express';
import multer from 'multer';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import * as adminController from '../../controllers/admin/adminController.js';
import * as shiftController from '../../controllers/shifts/shiftController.js';

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow image files for user avatar / profile image or excel/csv for bulk import
        if (file.mimetype.startsWith('image/') || file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') || file.mimetype.includes('csv') || file.originalname.match(/\.(csv|xlsx|xls|png|jpg|jpeg|webp|gif)$/i)) {
            cb(null, true);
        } else {
            const err = new Error('Invalid file format uploaded.');
            err.statusCode = 400;
            cb(err, false);
        }
    }
});

// Protected by JWT
router.use(authenticateJWT, requireActiveOrg);

// User Operations
router.get('/users', adminController.getAllUsers);
router.get('/user/:user_id', adminController.getUserById);
router.post('/user', upload.single('profile_image'), adminController.createUser);
router.put('/user/:user_id', upload.single('profile_image'), adminController.updateUser);
router.post('/user/:user_id/avatar', upload.single('avatar'), adminController.updateUserAvatar);
router.delete('/user/:user_id', adminController.softDeleteUser);
router.delete('/user/:user_id/force', adminController.forceDeleteUser);
router.post('/user/:user_id/restore', adminController.restoreUser);
router.put('/user/:user_id/status', adminController.toggleUserStatus);
router.post('/users/bulk', upload.single('file'), adminController.bulkCreateUsers);
router.post('/users/bulk-validate', adminController.bulkValidateUsers);
router.post('/users/bulk-json', adminController.bulkCreateUsersFromJson);

// Lookups
router.get('/dashboard-stats', adminController.getDashboardStats);

router.get('/departments', adminController.getDepartments);
router.post('/departments', adminController.createDepartment);
router.put('/departments/:dept_id', adminController.updateDepartment);
router.delete('/departments/:dept_id', adminController.deleteDepartment);

router.get('/designations', adminController.getDesignations);
router.post('/designations', adminController.createDesignation);
router.put('/designations/:desg_id', adminController.updateDesignation);
router.delete('/designations/:desg_id', adminController.deleteDesignation);

// Shifts - Use dedicated shift controller
router.get('/shifts', shiftController.getShifts);
router.post('/shifts', shiftController.createShift);
router.put('/shifts/:shift_id', shiftController.updateShift);
router.delete('/shifts/:shift_id', shiftController.deleteShift);

// Locations (Frontend might use /locations or /api/locations depending on proxy, mounting here first)
router.get('/locations', adminController.getWorkLocations);

// Dashboard
router.get('/dashboard-stats', adminController.getDashboardStats);

export default router;

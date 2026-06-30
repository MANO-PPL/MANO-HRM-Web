import express from 'express';
import multer from 'multer';
import {
    getAllSites, createSite, updateSite, deleteSite,
    getAllLabours, createLabour, updateLabour, deleteLabour,
    getSiteAttendance, saveSiteAttendance,
    getFinancesSummary, logLabourAdvance, getMonthlyGridAttendance,
    bulkTransferLabours, bulkCreateLabours, getLabourWorkHistory, logLabourPayout,
    downloadBulkTemplate, parseBulkLabours
} from '../../controllers/labour/labourController.js';
import { getLabourSchedule, saveLabourSchedule } from '../../controllers/labour/dailyScheduleController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Site Routes
router.route('/sites')
    .get(getAllSites)
    .post(createSite);

router.route('/sites/:id')
    .put(updateSite)
    .delete(deleteSite);

// Labour CRUD Routes
router.route('/labours')
    .get(getAllLabours)
    .post(createLabour);

router.post('/labours/bulk', bulkCreateLabours);
router.get('/labours/bulk/template', downloadBulkTemplate);
router.post('/labours/bulk/parse', upload.single('file'), parseBulkLabours);
router.post('/labours/bulk-transfer', bulkTransferLabours);
router.get('/labours/:id/history', getLabourWorkHistory);

router.route('/labours/:id')
    .put(updateLabour)
    .delete(deleteLabour);

// Attendance Checklist Routes
router.route('/attendance')
    .get(getSiteAttendance)
    .post(saveSiteAttendance);

router.get('/attendance/monthly-summary', getMonthlyGridAttendance);

// Daily Schedule Routes
router.route('/schedule')
    .get(getLabourSchedule)
    .post(saveLabourSchedule);

// Financial/Salary Credit Tracker Routes
router.get('/finances/summary', getFinancesSummary);
router.post('/finances/advance', logLabourAdvance);
router.post('/finances/payout', logLabourPayout);

export default router;

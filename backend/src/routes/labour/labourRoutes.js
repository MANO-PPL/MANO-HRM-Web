import express from 'express';
import {
    getAllSites, createSite, updateSite, deleteSite,
    getAllLabours, createLabour, updateLabour, deleteLabour,
    getSiteAttendance, saveSiteAttendance,
    getFinancesSummary, logLabourAdvance, getMonthlyGridAttendance,
    bulkTransferLabours, bulkCreateLabours, getLabourWorkHistory, logLabourPayout
} from '../../controllers/labour/labourController.js';

const router = express.Router();

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

// Financial/Salary Credit Tracker Routes
router.get('/finances/summary', getFinancesSummary);
router.post('/finances/advance', logLabourAdvance);
router.post('/finances/payout', logLabourPayout);

export default router;

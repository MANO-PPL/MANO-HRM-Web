import express from 'express';
import adminRoutes from './admin/adminRoutes.js';
import authRoutes from './auth/authRoutes.js';
import holidayRoutes from './holidays/holidayRoutes.js';
import notificationRoutes from './notifications/notificationRoutes.js';
import leaveRoutes from './leaves/leaveRoutes.js';
import reportsRoutes from './reports/reportsRoutes.js';
import employeeRoutes from './employees/employeeRoutes.js';
import workLocationsRoutes from './locations/workLocationsRoutes.js';
import darActivityRoutes from './DAR/activitiesRoutes.js';
import darEventRoutes from './DAR/eventsRoutes.js';
import darRequestRoutes from './DAR/requestsRoutes.js';
import darSettingsRoutes from './DAR/settingsRoutes.js';
import darReportRoutes from './DAR/DARReportAPI.js';
import shiftRoutes from './shifts/shiftRoutes.js';
import attendanceRoutes from './attendance/attendanceRoutes.js';
import orgAttendanceSettingsRoutes from './attendance/orgAttendanceSettingsRoutes.js';
import correctionsRoutes from './corrections/correctionsRoutes.js';
import feedbackRoutes from './feedback/feedbackRoutes.js';
import paymentRoutes from './payments/paymentRoutes.js';
import profileRoutes from './profile/profileRoutes.js';
import orgRoutes from './organisations/orgRoutes.js';
import superAdminRoutes from './superadmin/superAdminRoutes.js';
import chatbotRoutes from './chatbot/chatbotRoutes.js';
import chatRoutes from './collaboration/chatRoutes.js';
import labourRoutes from './labour/labourRoutes.js';
import payrollRoutes from './payroll/payrollRoutes.js';
import geoLocationRoutes from './locations/locations.js';
import internalRoutes from './internal/internalRoutes.js';

import { requireActiveOrg } from '../middleware/auth.js';

const router = express.Router();

// Mount feature-specific routes
router.use('/admin', adminRoutes); // Administrative operations & organization controls
router.use('/labour', requireActiveOrg, labourRoutes); // Labour/contractor workforce management
router.use('/employee', employeeRoutes); // Employee management & directory
router.use('/auth', authRoutes); // Authentication, login, signup & tokens
router.use('/holiday', holidayRoutes); // Company holiday calendar & schedules
router.use('/policies', shiftRoutes); // Shift policies & schedule management
router.use('/notifications', notificationRoutes); // User alerts & notifications
router.use('/leaves', leaveRoutes); // Leave requests, balances & approvals
router.use('/attendance', attendanceRoutes); // Attendance records, check-in/out & punches
router.use('/attendance/org-settings', orgAttendanceSettingsRoutes); // Org-wide threshold half-day policy
router.use('/corrections', correctionsRoutes); // Attendance corrections & adjustments
router.use('/attendance', correctionsRoutes); // Backwards compatibility for legacy /attendance/correction-request(s)
router.use('/organizations', orgRoutes); // Organization profile & configuration
router.use('/super-admin', superAdminRoutes); // Super admin system-level operations
router.use('/admin/reports', reportsRoutes); // Admin reports
router.use('/attendance/reports', reportsRoutes); // Attendance reports
router.use('/locations', workLocationsRoutes); // Work location management
router.use('/dar/activities', darActivityRoutes); // DAR activities
router.use('/dar/events', darEventRoutes); // DAR events
router.use('/dar/requests', darRequestRoutes); // DAR requests
router.use('/dar/settings', darSettingsRoutes); // DAR settings
router.use('/dar/reports', darReportRoutes); // DAR reporting & LLM analysis
router.use('/feedback', feedbackRoutes); // Feedback/bug reports
router.use('/payment', paymentRoutes); // Razorpay payments
router.use('/profile', profileRoutes); // User profile management
router.use('/website-chatbot', chatbotRoutes); // Public website chatbot endpoint
router.use('/collaboration', chatRoutes);   // Real-time chat & team messaging
router.use('/payroll', payrollRoutes); // Payroll V1 endpoints
router.use('/geo', geoLocationRoutes); // Public geo data (countries, states, cities)
router.use('/internal', internalRoutes); // Internal APIs for app UI

export default router;

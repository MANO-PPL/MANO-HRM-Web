import express from 'express';
import * as authController from './authController.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { generateCaptcha, verifyCaptcha } from '../../middleware/verifyCaptcha.js';
import { authLimiter, loginIpLimiter, passwordResetLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

// ==========================================
// CAPTCHA
// ==========================================
router.get("/captcha/generate", generateCaptcha);

// ==========================================
// 1. AUTHENTICATION & IDENTITY
// ==========================================
router.post('/login', loginIpLimiter, authLimiter, verifyCaptcha, authController.login);
router.post('/super-admin/login', loginIpLimiter, authLimiter, authController.superAdminLogin);
router.post('/logout', authController.logout);
router.get('/me', authenticateJWT, authController.getCurrentUser);

// ==========================================
// 2. TOKEN REFRESH & SESSION LIFECYCLE
// ==========================================
router.post('/refresh', authController.refreshToken);

// ==========================================
// 3. PASSWORD MANAGEMENT & RECOVERY
// ==========================================
router.post('/forgot-password', passwordResetLimiter, authController.requestPasswordReset);
router.post('/verify-otp', authLimiter, authController.verifyOtp);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/change-password', authenticateJWT, authController.changePassword);

// ==========================================
// 4. USER ACTIVE SESSIONS (SELF-SERVICE)
// ==========================================
router.get('/sessions', authenticateJWT, authController.getUserSessions);
router.post('/sessions/:id/revoke', authenticateJWT, authController.revokeUserSession);
router.post('/sessions/revoke-others', authenticateJWT, authController.revokeOtherUserSessions);

// ==========================================
// 5. ORGANIZATION SELF-ONBOARDING
// ==========================================
router.post('/onboard', authLimiter, authController.onboardOrganization);

export default router;

import express from 'express';
import { askWebsiteChatbot, askInternalChatbot, getAppGuide } from './chatbotController.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { chatbotLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

router.post('/ask', chatbotLimiter, askWebsiteChatbot);
router.post('/ask-internal', authenticateJWT, chatbotLimiter, askInternalChatbot);
router.get('/guide', authenticateJWT, getAppGuide);

export default router;

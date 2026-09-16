import express from 'express';
import multer from 'multer';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import * as chatController from './chatController.js';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

// All collaboration paths require a valid organization and authenticated token session
router.use(authenticateJWT, requireActiveOrg);

// Directory list for auto-complete & chat targets
router.get('/users', chatController.getOrgUsers);

// Rooms endpoints
router.get('/rooms', chatController.getRooms);
router.post('/rooms', chatController.createRoom);

// Message logs & sending endpoints
router.get('/rooms/:roomId/messages', chatController.getRoomMessages);
router.post('/rooms/:roomId/messages', chatController.sendMessage);
router.post('/rooms/:roomId/upload', upload.single('file'), chatController.uploadAttachment);

// Message read marker updates
router.put('/rooms/:roomId/read', chatController.markAsRead);

// Update group members
router.put('/rooms/:roomId/members', chatController.updateRoomMembers);

// Delete room (clears the entire conversation row)
router.delete('/rooms/:roomId', chatController.deleteRoom);

export default router;

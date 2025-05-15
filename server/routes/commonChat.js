import express from 'express';
import { getGlobalChat, sendCommonChatMessage, joinGlobalChat, leaveGlobalChat, clearGlobalChat } from '../controllers/commonChatController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Common chat routes
router.get('/global', getGlobalChat);
router.post('/global/join', joinGlobalChat);
router.post('/global/leave', leaveGlobalChat);
router.post('/global/message', sendCommonChatMessage);
router.post('/global/clear', clearGlobalChat); // Added route for clearing chat

export default router;

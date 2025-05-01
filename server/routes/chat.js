import express from 'express';
import { handleChatMessage } from '../controllers/chatController.js';
import { authMiddleware } from '../middleware/authMiddleware.js'; // Assuming auth middleware exists

const router = express.Router();

// POST /api/chat - Handle incoming chat messages
router.post('/', authMiddleware, handleChatMessage);

export default router;

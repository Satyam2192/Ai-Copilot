import express from 'express';
import { 
  startSession, 
  getSession, 
  listSessions,
  updateSessionFeedback,
  endSession
} from '../controllers/sessionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Session management routes
router.post('/', authMiddleware, startSession); // Auth required to start a session
router.get('/', authMiddleware, listSessions);
router.get('/:id', authMiddleware, getSession);

// Feedback and session termination routes
router.post('/:id/feedback', authMiddleware, updateSessionFeedback);
router.post('/:id/end', authMiddleware, endSession);

export default router;

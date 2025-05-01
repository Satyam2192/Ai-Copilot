import express from 'express';
import { 
  startSession, 
  getSession,
  listSessions,
  updateSessionFeedback,
  updateSession,
  endSession,
  deleteSession // Import the delete function
} from '../controllers/sessionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Session management routes
router.post('/', authMiddleware, startSession); // Auth required to start a session
router.get('/', authMiddleware, listSessions);
router.get('/:id', authMiddleware, getSession);
router.patch('/:id', authMiddleware, updateSession); // Add PATCH route for updates

// Feedback, session termination, and deletion routes
router.post('/:id/feedback', authMiddleware, updateSessionFeedback);
router.post('/:id/end', authMiddleware, endSession);
router.delete('/:id', authMiddleware, deleteSession); // Add DELETE route

export default router;

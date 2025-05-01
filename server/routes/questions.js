import express from 'express';
import { listQuestions } from '../controllers/questionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
const router = express.Router();
router.get('/', authMiddleware, listQuestions);
export default router;

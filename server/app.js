import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import questionRoutes from './routes/questions.js';
import chatRoutes from './routes/chat.js'; // Added chat route
import commonChatRoutes from './routes/commonChat.js'; // Added common chat route
import { initWebSocketServer } from './socket.js';

dotenv.config();

const app = express();
const isVercel = process.env.VERCEL === '1';
const server = isVercel ? null : http.createServer(app);

connectDB();

// Initialize WebSocket server if not on Vercel
if (!isVercel && server) {
  initWebSocketServer(server);
}

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://aicopilot-peach.vercel.app',
    'https://aicopilot.onrender.com',
    'https://9287mcx4-3000.inc1.devtunnels.ms',
    'exp://localhost:*', 
    'http://localhost:*' ,
    'http://192.168.0.5:3000'
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['x-auth-token']
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/chat', chatRoutes); // Added chat route middleware
app.use('/api/common-chat', commonChatRoutes); // Added common chat routes

const PORT = process.env.PORT || 5000;

// Start the server only if not running on Vercel
if (!isVercel && server) {
  server.listen(PORT, () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Server initialized and running on port ${PORT}`);
    console.log(`[INFO] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[INFO] Connected to database: ${process.env.MONGO_URI}`);
  });
}

// For Vercel serverless functions
export default app;

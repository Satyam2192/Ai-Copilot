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
import { initWebSocketServer } from './socket.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

connectDB();

// Initialize WebSocket server
initWebSocketServer(server);

// Configure CORS more explicitly
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000', // Be more specific in production
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow Authorization header
  exposedHeaders: ['x-auth-token'] // Expose custom header for client interceptor
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/chat', chatRoutes); // Added chat route middleware

// Removed socket initialization

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Server initialized and running on port ${PORT}`);
  console.log(`[INFO] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[INFO] Connected to database: ${process.env.MONGO_URI}`);
});

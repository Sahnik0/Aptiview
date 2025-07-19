import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { prisma } from './db';
import userRoutes from './routes/user';
import interviewRoutes from './routes/interview';
import { clerkMiddleware } from '@clerk/express';
import { setupWebSocketServer } from './websocketServer';

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "https://apti-view.vercel.app",
    "https://apti-view-seven.vercel.app", // Your actual Vercel URL
    "https://aptiview.onrender.com", // Your backend URL (for health checks)
    process.env.FRONTEND_URL || "http://localhost:3000"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json());

// Configure Clerk middleware with proper environment variables
app.use(clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/users', userRoutes);
app.use('/api/interviews', interviewRoutes);

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Start WebSocket server on the same port as HTTP server
setupWebSocketServer(server);
console.log(`WebSocket server running on port ${PORT}`);
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { prisma } from './db';
import userRoutes from './routes/user';
import interviewRoutes from './routes/interview';
import { clerkMiddleware } from '@clerk/express';

const app = express();
app.use(cors({
  origin: ["http://localhost:3000"], // Add your deployed frontend URL here as needed
  credentials: true,
}));
app.use(express.json());

// Configure Clerk middleware with proper environment variables
app.use(clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/users', userRoutes);
app.use('/api/interviews', interviewRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
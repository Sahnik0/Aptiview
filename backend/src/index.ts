import express from 'express';
import cors from 'cors';
import { prisma } from './db';
import apiRoutes from './routes';

const app = express();
app.use(cors({
  origin: ["http://localhost:3000"], // Add your deployed frontend URL here as needed
  credentials: true,
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
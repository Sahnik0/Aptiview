import express from 'express';
import cors from 'cors';
import { prisma } from './db';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test: Create a dummy job (for now, without auth)
app.post('/jobs', async (req, res) => {
  try {
    const job = await prisma.job.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        recruiterId: req.body.recruiterId, // must be a valid recruiterProfile id
      },
    });
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
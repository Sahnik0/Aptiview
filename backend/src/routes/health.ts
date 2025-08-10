import { Router, Request, Response } from 'express';

const router = Router();

// Health check endpoint for uptime monitoring
router.get('/ping', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'pong' });
});

export default router;

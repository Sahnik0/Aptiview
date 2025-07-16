import { Request, Response, NextFunction } from 'express';

export interface ClerkAuthRequest extends Request {
  clerkUserId?: string;
}

const CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Use dynamic import for node-fetch (ESM in CJS)
const fetch = (...args: Parameters<typeof import('node-fetch')['default']>) =>
  import('node-fetch').then(mod => mod.default(...args));

export async function requireClerkAuth(req: ClerkAuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    // Verify token with Clerk
    const verifyRes = await fetch('https://api.clerk.dev/v1/tokens/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLERK_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ token }),
    });
    if (!verifyRes.ok) {
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }
    const data: any = await verifyRes.json();
    req.clerkUserId = data?.sub || data?.user_id || data?.id || '';
    next();
  } catch (err) {
    res.status(401).json({ error: 'Failed to verify Clerk token' });
  }
} 
import express from 'express';
import { prisma } from '../db';
import { requireClerkAuth, ClerkAuthRequest } from '../middleware/requireClerkAuth';

const router = express.Router();

// Provision user after Clerk login/signup
router.post('/provision', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  const { email, role, profile } = req.body;
  const clerkUserId = req.clerkUserId || '';
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }
  try {
    let user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          clerkId: clerkUserId,
          role: role || null,
          recruiterProfile: role === 'RECRUITER' ? { create: { company: profile?.company || '', industry: profile?.industry || '' } } : undefined,
          candidateProfile: role === 'CANDIDATE' ? { create: { education: profile?.education || '', experience: profile?.experience || '', skills: profile?.skills || '' } } : undefined,
        },
        include: { recruiterProfile: true, candidateProfile: true },
      });
    } else if (role && !user.role) {
      user = await prisma.user.update({
        where: { clerkId: clerkUserId },
        data: {
          role,
          recruiterProfile: role === 'RECRUITER' ? { create: { company: profile?.company || '', industry: profile?.industry || '' } } : undefined,
          candidateProfile: role === 'CANDIDATE' ? { create: { education: profile?.education || '', experience: profile?.experience || '', skills: profile?.skills || '' } } : undefined,
        },
        include: { recruiterProfile: true, candidateProfile: true },
      });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router; 
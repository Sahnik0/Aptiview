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
    let user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, include: { candidateProfile: true, recruiterProfile: true } });
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
    } else if (role === 'CANDIDATE' && user.role === 'CANDIDATE') {
      // Update candidate profile if it exists, or create if missing
      if (user.candidateProfile) {
        await prisma.candidateProfile.update({
          where: { userId: user.id },
          data: {
            education: profile?.education || '',
            experience: profile?.experience || '',
            skills: profile?.skills || '',
          },
        });
      } else {
        await prisma.candidateProfile.create({
          data: {
            userId: user.id,
            education: profile?.education || '',
            experience: profile?.experience || '',
            skills: profile?.skills || '',
          },
        });
      }
      // Refetch user with updated profile
      user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        include: { candidateProfile: true, recruiterProfile: true },
      });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get current user and profile
router.get('/me', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  const clerkUserId = req.clerkUserId || '';
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: { candidateProfile: true, recruiterProfile: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get all applications for the current candidate
router.get('/applications', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  const clerkUserId = req.clerkUserId || '';
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: { candidateProfile: true },
    });
    if (!user || !user.candidateProfile) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }
    const applications = await prisma.application.findMany({
      where: { candidateId: user.candidateProfile.id },
      include: {
        job: {
          include: {
            recruiter: {
              select: { company: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    // Add job.location and job.type to each application
    const appsWithJobDetails = applications.map(app => ({
      ...app,
      job: app.job ? {
        ...app.job,
        location: app.job.location,
        type: app.job.type,
      } : null
    }));
    res.json(appsWithJobDetails);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get all available jobs
router.get('/jobs', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        recruiter: {
          select: { company: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    // Add location and type fields to each job
    const jobsWithDetails = jobs.map(job => ({
      ...job,
      location: job.location,
      type: job.type,
    }));
    res.json(jobsWithDetails);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router; 
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

// Get specific job by ID
router.get('/jobs/:id', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  try {
    const { id } = req.params;
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        recruiter: {
          select: { company: true }
        }
      }
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Create a new job (recruiters only)
router.post('/jobs', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  const clerkUserId = req.clerkUserId || '';
  const { title, description, location, type } = req.body;
  
  if (!title || !description || !location || !type) {
    return res.status(400).json({ error: 'Missing required fields: title, description, location, type' });
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: { recruiterProfile: true }
    });
    
    if (!user || !user.recruiterProfile) {
      return res.status(403).json({ error: 'Only recruiters can post jobs' });
    }
    
    const job = await prisma.job.create({
      data: {
        title,
        description,
        location,
        type,
        recruiterId: user.recruiterProfile.id
      },
      include: {
        recruiter: {
          select: { company: true }
        }
      }
    });
    
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get jobs posted by current recruiter
router.get('/my-jobs', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  const clerkUserId = req.clerkUserId || '';
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: { recruiterProfile: true }
    });
    
    if (!user || !user.recruiterProfile) {
      return res.status(403).json({ error: 'Only recruiters can view their jobs' });
    }
    
    const jobs = await prisma.job.findMany({
      where: { recruiterId: user.recruiterProfile.id },
      include: {
        _count: {
          select: {
            applications: true
          }
        },
        applications: {
          select: {
            id: true,
            status: true,
            interview: {
              select: {
                id: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Add computed fields for dashboard display
    const jobsWithStats = jobs.map(job => ({
      id: job.id,
      title: job.title,
      location: job.location,
      type: job.type,
      createdAt: job.createdAt,
      applicantsCount: job._count.applications,
      interviewsCount: job.applications.filter(app => app.interview).length,
      shortlistedCount: job.applications.filter(app => app.status === 'SHORTLISTED').length
    }));
    
    res.json(jobsWithStats);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Apply for a job (candidates only)
router.post('/jobs/:id/apply', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  const clerkUserId = req.clerkUserId || '';
  const { id: jobId } = req.params;
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: { candidateProfile: true }
    });
    
    if (!user || !user.candidateProfile) {
      return res.status(403).json({ error: 'Only candidates can apply for jobs' });
    }
    
    // Check if job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Check if already applied
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId,
        candidateId: user.candidateProfile.id
      }
    });
    
    if (existingApplication) {
      return res.status(400).json({ error: 'You have already applied for this job' });
    }
    
    const application = await prisma.application.create({
      data: {
        jobId,
        candidateId: user.candidateProfile.id,
        status: 'PENDING'
      },
      include: {
        job: {
          include: {
            recruiter: {
              select: { company: true }
            }
          }
        }
      }
    });
    
    res.status(201).json(application);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get applications for a specific job (recruiters only)
router.get('/jobs/:id/applications', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  const clerkUserId = req.clerkUserId || '';
  const { id: jobId } = req.params;
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: { recruiterProfile: true }
    });
    
    if (!user || !user.recruiterProfile) {
      return res.status(403).json({ error: 'Only recruiters can view applications' });
    }
    
    // Verify the job belongs to this recruiter
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        recruiterId: user.recruiterProfile.id
      }
    });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found or not authorized' });
    }
    
    const applications = await prisma.application.findMany({
      where: { jobId },
      include: {
        candidate: {
          include: {
            user: {
              select: { email: true }
            }
          }
        },
        interview: {
          include: {
            score: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Update application status (recruiters only)
router.patch('/applications/:id/status', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  const clerkUserId = req.clerkUserId || '';
  const { id: applicationId } = req.params;
  const { status } = req.body;
  
  const validStatuses = ['PENDING', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'SHORTLISTED', 'REJECTED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: { recruiterProfile: true }
    });
    
    if (!user || !user.recruiterProfile) {
      return res.status(403).json({ error: 'Only recruiters can update application status' });
    }
    
    // Verify the application belongs to a job posted by this recruiter
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: true
      }
    });
    
    if (!application || application.job.recruiterId !== user.recruiterProfile.id) {
      return res.status(404).json({ error: 'Application not found or not authorized' });
    }
    
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: { status },
      include: {
        candidate: {
          include: {
            user: {
              select: { email: true }
            }
          }
        },
        job: true,
        interview: {
          include: {
            score: true
          }
        }
      }
    });
    
    res.json(updatedApplication);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get dashboard stats for recruiters
router.get('/recruiter-stats', requireClerkAuth, async (req: ClerkAuthRequest, res) => {
  const clerkUserId = req.clerkUserId || '';
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: { recruiterProfile: true }
    });
    
    if (!user || !user.recruiterProfile) {
      return res.status(403).json({ error: 'Only recruiters can view stats' });
    }
    
    const [totalJobs, totalApplications, totalInterviews] = await Promise.all([
      prisma.job.count({
        where: { recruiterId: user.recruiterProfile.id }
      }),
      prisma.application.count({
        where: {
          job: {
            recruiterId: user.recruiterProfile.id
          }
        }
      }),
      prisma.interview.count({
        where: {
          application: {
            job: {
              recruiterId: user.recruiterProfile.id
            }
          }
        }
      })
    ]);
    
    res.json({
      totalJobs,
      totalApplications,
      totalInterviews
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router; 
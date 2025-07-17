import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireClerkAuth, ClerkAuthRequest } from '../middleware/requireClerkAuth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const prisma = new PrismaClient();

// Service implementations (temporary placeholders)
const emailService = {
  async sendInterviewInvitation(email: string, jobTitle: string, scheduledAt: Date, interviewLink: string) {
    console.log(`Sending interview invitation to ${email} for ${jobTitle} at ${scheduledAt} - Link: ${interviewLink}`);
  },
  async sendInterviewReport(recruiterEmail: string, candidateEmail: string, jobTitle: string, analysis: any, recordingUrl: string | null) {
    console.log(`Sending interview report for ${jobTitle} from ${candidateEmail} to ${recruiterEmail}`);
  }
};

const aiInterviewer = {
  async getWelcomeMessage(jobTitle: string, jobDescription: string) {
    return `Hello! I'm your AI interviewer for the ${jobTitle} position. Let's begin our conversation. Can you start by telling me about yourself?`;
  },
  async processMessage(message: string, jobTitle: string, jobDescription: string, customQuestions: string, transcript: string, isFirstMessage: boolean) {
    return `Thank you for your response. Can you tell me more about your experience relevant to this ${jobTitle} role?`;
  },
  async generateSummary(transcript: string, jobTitle: string, jobDescription: string) {
    return {
      summary: "Candidate demonstrated good communication skills during the interview.",
      strengths: "Good technical knowledge, clear communication",
      weaknesses: "Could improve on specific examples",
      overallRating: 7.5,
      scores: {
        communication: 8.0,
        technical: 7.0,
        problemSolving: 7.5,
        culturalFit: 8.0,
        total: 7.6
      }
    };
  }
};

const fileService = {
  async saveScreenshot(imageData: string, uniqueLink: string) {
    return `/screenshots/${uniqueLink}_${Date.now()}.png`;
  },
  async saveRecording(recordingData: any, uniqueLink: string) {
    return `/recordings/${uniqueLink}_${Date.now()}.mp4`;
  }
};

// Schedule an interview (after job application)
router.post('/schedule', requireClerkAuth, async (req: ClerkAuthRequest, res: Response) => {
  try {
    const userId = req.clerkUserId;
    const { applicationId, scheduledAt } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify the application belongs to the current user (candidate)
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { candidateProfile: true }
    });

    if (!user || user.role !== 'CANDIDATE' || !user.candidateProfile) {
      return res.status(403).json({ error: 'Access denied. Candidate profile required.' });
    }

    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        candidateId: user.candidateProfile.id
      },
      include: {
        job: {
          include: {
            recruiter: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if scheduled time is before job interview end date
    if (application.job.interviewEndDate && new Date(scheduledAt) > application.job.interviewEndDate) {
      return res.status(400).json({ error: 'Interview must be scheduled before the deadline' });
    }

    // Generate unique interview link
    const uniqueLink = uuidv4();

    // Create interview record
    const interview = await prisma.interview.create({
      data: {
        applicationId,
        scheduledAt: new Date(scheduledAt),
        uniqueLink,
        isActive: false
      }
    });

    // Update application status
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: 'INTERVIEW_SCHEDULED' }
    });

    // Send email notification
    await emailService.sendInterviewInvitation(
      user.email,
      application.job.title,
      new Date(scheduledAt),
      `${process.env.FRONTEND_URL}/interview/${uniqueLink}`
    );

    res.status(201).json({
      interview,
      interviewLink: `${process.env.FRONTEND_URL}/interview/${uniqueLink}`
    });
  } catch (error) {
    console.error('Error scheduling interview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get interview details by unique link
router.get('/:uniqueLink', async (req: Request, res: Response) => {
  try {
    const { uniqueLink } = req.params;

    const interview = await prisma.interview.findUnique({
      where: { uniqueLink },
      include: {
        application: {
          include: {
            candidate: {
              include: {
                user: {
                  select: {
                    email: true
                  }
                }
              }
            },
            job: {
              include: {
                recruiter: {
                  include: {
                    user: {
                      select: {
                        email: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Check if interview is scheduled for now (within 10 minutes of scheduled time)
    const now = new Date();
    const scheduledTime = new Date(interview.scheduledAt);
    const timeDiff = Math.abs(now.getTime() - scheduledTime.getTime());
    const tenMinutes = 10 * 60 * 1000;

    if (timeDiff > tenMinutes && !interview.isActive) {
      return res.status(403).json({ error: 'Interview is not active yet' });
    }

    res.json(interview);
  } catch (error) {
    console.error('Error fetching interview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start interview (activate the link)
router.post('/:uniqueLink/start', async (req: Request, res: Response) => {
  try {
    const { uniqueLink } = req.params;

    const interview = await prisma.interview.findUnique({
      where: { uniqueLink },
      include: {
        application: {
          include: {
            job: true
          }
        }
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Check if interview time has arrived
    const now = new Date();
    const scheduledTime = new Date(interview.scheduledAt);
    
    if (now < scheduledTime) {
      return res.status(403).json({ error: 'Interview has not started yet' });
    }

    // Activate interview and set start time
    const updatedInterview = await prisma.interview.update({
      where: { uniqueLink },
      data: {
        isActive: true,
        actualStartedAt: now
      }
    });

    // Get AI welcome message
    const welcomeMessage = await aiInterviewer.getWelcomeMessage(
      interview.application.job.title,
      interview.application.job.description
    );

    res.json({
      interview: updatedInterview,
      welcomeMessage
    });
  } catch (error) {
    console.error('Error starting interview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI conversation endpoint
router.post('/:uniqueLink/chat', async (req: Request, res: Response) => {
  try {
    const { uniqueLink } = req.params;
    const { message, isFirstMessage } = req.body;

    const interview = await prisma.interview.findUnique({
      where: { uniqueLink },
      include: {
        application: {
          include: {
            job: true
          }
        }
      }
    });

    if (!interview || !interview.isActive) {
      return res.status(404).json({ error: 'Interview not found or not active' });
    }

    // Get AI response
    const aiResponse = await aiInterviewer.processMessage(
      message,
      interview.application.job.title,
      interview.application.job.description,
      interview.application.job.interviewContext || '',
      interview.aiTranscript || '',
      isFirstMessage
    );

    // Update transcript
    const updatedTranscript = interview.aiTranscript 
      ? `${interview.aiTranscript}\n\nCandidate: ${message}\nAI: ${aiResponse}`
      : `Candidate: ${message}\nAI: ${aiResponse}`;

    await prisma.interview.update({
      where: { uniqueLink },
      data: {
        aiTranscript: updatedTranscript
      }
    });

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error processing AI chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload screenshot
router.post('/:uniqueLink/screenshot', async (req: Request, res: Response) => {
  try {
    const { uniqueLink } = req.params;
    const { imageData } = req.body;

    const interview = await prisma.interview.findUnique({
      where: { uniqueLink }
    });

    if (!interview || !interview.isActive) {
      return res.status(404).json({ error: 'Interview not found or not active' });
    }

    // Save screenshot
    const imageUrl = await fileService.saveScreenshot(imageData, uniqueLink);

    const screenshot = await prisma.screenshot.create({
      data: {
        interviewId: interview.id,
        imageUrl
      }
    });

    res.json(screenshot);
  } catch (error) {
    console.error('Error saving screenshot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End interview
router.post('/:uniqueLink/end', async (req: Request, res: Response) => {
  try {
    const { uniqueLink } = req.params;
    const { recordingData } = req.body;

    const interview = await prisma.interview.findUnique({
      where: { uniqueLink },
      include: {
        application: {
          include: {
            candidate: {
              include: {
                user: {
                  select: {
                    email: true
                  }
                }
              }
            },
            job: {
              include: {
                recruiter: {
                  include: {
                    user: {
                      select: {
                        email: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const now = new Date();

    // Save recording if provided
    let recordingUrl = null;
    if (recordingData) {
      recordingUrl = await fileService.saveRecording(recordingData, uniqueLink);
      await prisma.interviewRecording.create({
        data: {
          interviewId: interview.id,
          videoUrl: recordingUrl,
          recordingType: 'VIDEO'
        }
      });
    }

    // Generate AI summary and scoring
    const aiAnalysis = await aiInterviewer.generateSummary(
      interview.aiTranscript || '',
      interview.application.job.title,
      interview.application.job.description
    );

    // Update interview
    const updatedInterview = await prisma.interview.update({
      where: { uniqueLink },
      data: {
        isActive: false,
        endedAt: now,
        aiSummary: aiAnalysis.summary,
        strengths: aiAnalysis.strengths,
        weaknesses: aiAnalysis.weaknesses,
        overallRating: aiAnalysis.overallRating
      }
    });

    // Create interview score
    await prisma.interviewScore.create({
      data: {
        interviewId: interview.id,
        communicationScore: aiAnalysis.scores.communication,
        technicalScore: aiAnalysis.scores.technical,
        problemSolvingScore: aiAnalysis.scores.problemSolving,
        culturalFitScore: aiAnalysis.scores.culturalFit,
        totalScore: aiAnalysis.scores.total,
        details: aiAnalysis.scores
      }
    });

    // Update application status
    await prisma.application.update({
      where: { id: interview.applicationId },
      data: { status: 'INTERVIEW_COMPLETED' }
    });

    // Send report to recruiter
    await emailService.sendInterviewReport(
      interview.application.job.recruiter.user.email,
      interview.application.candidate.user.email,
      interview.application.job.title,
      aiAnalysis,
      recordingUrl
    );

    res.json({
      interview: updatedInterview,
      analysis: aiAnalysis
    });
  } catch (error) {
    console.error('Error ending interview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get interview results (recruiter only)
router.get('/:uniqueLink/results', requireClerkAuth, async (req: ClerkAuthRequest, res: Response) => {
  try {
    const userId = req.clerkUserId;
    const { uniqueLink } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { recruiterProfile: true }
    });

    if (!user || user.role !== 'RECRUITER' || !user.recruiterProfile) {
      return res.status(403).json({ error: 'Access denied. Recruiter profile required.' });
    }

    const interview = await prisma.interview.findUnique({
      where: { uniqueLink },
      include: {
        application: {
          include: {
            candidate: {
              include: {
                user: {
                  select: {
                    email: true
                  }
                }
              }
            },
            job: true
          }
        },
        score: true,
        recordings: true,
        screenshots: true
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Verify the interview belongs to the recruiter's job
    if (interview.application.job.recruiterId !== user.recruiterProfile.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(interview);
  } catch (error) {
    console.error('Error fetching interview results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

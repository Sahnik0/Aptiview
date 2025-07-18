import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import { SimpleVoiceInterviewer } from './services/simpleVoiceInterviewer';
import { saveBase64Screenshot } from './services/fileService';

const prisma = new PrismaClient();

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  interviewId?: string;
  voiceInterviewer?: SimpleVoiceInterviewer;
}

export function setupWebSocketServer(port: number = 4001) {
  const wss = new WebSocketServer({ port });

  console.log(`WebSocket server started on port ${port}`);

  wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
    console.log('New WebSocket connection');

    // Extract unique link from URL
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const uniqueLink = url.pathname.split('/').pop();
    const token = url.searchParams.get('token');

    if (!uniqueLink) {
      ws.close(1008, 'Missing interview link');
      return;
    }

    try {
      // Find interview
      const interview = await prisma.interview.findUnique({
        where: { uniqueLink },
        include: {
          application: {
            include: {
              candidate: {
                include: {
                  user: true
                }
              },
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
          }
        }
      });

      if (!interview) {
        ws.close(1008, 'Interview not found');
        return;
      }

      // Validate interview timing (same logic as HTTP endpoint)
      const now = new Date();
      const scheduledTime = new Date(interview.scheduledAt);
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const timeSinceScheduled = now.getTime() - scheduledTime.getTime();

      if (timeSinceScheduled > twentyFourHours && !interview.endedAt) {
        ws.close(1008, 'Interview link has expired');
        return;
      }

      const oneHourBefore = 60 * 60 * 1000;
      const timeUntilScheduled = scheduledTime.getTime() - now.getTime();
      
      if (timeUntilScheduled > oneHourBefore && !interview.isActive) {
        ws.close(1008, 'Interview is not yet available');
        return;
      }

      // Check if interview is already completed
      if (interview.endedAt) {
        ws.close(1008, 'Interview has already been completed');
        return;
      }

      ws.userId = interview.application.candidate.user.id;
      ws.interviewId = interview.id;

      // Initialize voice interviewer
      const candidateName = interview.application.candidate.user.email.split('@')[0];
      ws.voiceInterviewer = new SimpleVoiceInterviewer({
        jobTitle: interview.application.job.title,
        jobDescription: interview.application.job.description,
        customQuestions: interview.application.job.customQuestions ? [interview.application.job.customQuestions] : undefined,
        candidateName
      });

      // Set up voice interviewer event listeners
      ws.voiceInterviewer.on('connected', () => {
        ws.send(JSON.stringify({ type: 'voice-connected' }));
      });

      ws.voiceInterviewer.on('audio-response', (audioData: Buffer) => {
        ws.send(JSON.stringify({ 
          type: 'audio-chunk', 
          data: audioData.toString('base64') 
        }));
      });

      ws.voiceInterviewer.on('assistant-message', (message: any) => {
        ws.send(JSON.stringify({ 
          type: 'transcript-update', 
          message 
        }));
      });

      ws.voiceInterviewer.on('user-message', (message: any) => {
        ws.send(JSON.stringify({ 
          type: 'transcript-update', 
          message 
        }));
      });

      ws.voiceInterviewer.on('interview-complete', () => {
        ws.send(JSON.stringify({ 
          type: 'interview-complete'
        }));
      });

      ws.voiceInterviewer.on('error', (error: any) => {
        console.error('Voice interviewer error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Voice interview error occurred' 
        }));
      });

      // Mark interview as started if not already
      if (!interview.actualStartedAt) {
        await prisma.interview.update({
          where: { id: interview.id },
          data: { 
            actualStartedAt: new Date(),
            isActive: true
          }
        });
      }

      // Start voice interview
      await ws.voiceInterviewer.startInterview();

      ws.send(JSON.stringify({ 
        type: 'interview-ready',
        interview: {
          id: interview.id,
          scheduledAt: interview.scheduledAt,
          job: interview.application.job,
          screenshotInterval: interview.application.job.screenshotInterval
        }
      }));

    } catch (error) {
      console.error('Error setting up interview:', error);
      ws.close(1011, 'Internal server error');
      return;
    }

    // Handle WebSocket messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'audio-data':
            // Handle audio transcription and processing
            if (message.audioData && ws.voiceInterviewer) {
              try {
                console.log('Received audio data, size:', message.audioData.length);
                console.log('Audio mime type:', message.mimeType);
                const audioBuffer = Buffer.from(message.audioData, 'base64');
                console.log('Audio buffer size:', audioBuffer.length, 'bytes');
                
                const transcription = await ws.voiceInterviewer.transcribeAudio(audioBuffer, message.mimeType);
                console.log('Transcription:', transcription);
                
                if (transcription.trim()) {
                  await ws.voiceInterviewer.processUserResponse(transcription.trim());
                } else {
                  console.log('Empty transcription, skipping');
                  // Send feedback to user
                  ws.send(JSON.stringify({ 
                    type: 'transcription-status', 
                    message: 'No speech detected. Please try speaking more clearly.' 
                  }));
                }
              } catch (error) {
                console.error('Error processing audio:', error);
                
                // Send more specific error messages to user
                let errorMessage = 'Error processing your audio. Please try speaking again.';
                if (error instanceof Error) {
                  if (error.message.includes('too short') || error.message.includes('1 second')) {
                    errorMessage = 'Please speak for at least 1-2 seconds before stopping recording.';
                  } else if (error.message.includes('format not supported')) {
                    errorMessage = 'Audio format issue. Please refresh the page and try again.';
                  }
                }
                
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  message: errorMessage 
                }));
              }
            }
            break;

          case 'text-message':
            // Handle text input (for testing/fallback)
            if (message.text && ws.voiceInterviewer) {
              await ws.voiceInterviewer.processUserResponse(message.text);
            }
            break;

          case 'screenshot':
            // Handle screenshot upload
            if (message.imageData && ws.interviewId) {
              try {
                const filename = await saveBase64Screenshot(
                  message.imageData,
                  `interview_${ws.interviewId}_${Date.now()}`
                );

                await prisma.screenshot.create({
                  data: {
                    interviewId: ws.interviewId,
                    imageUrl: filename,
                    takenAt: new Date()
                  }
                });

                console.log('Screenshot saved:', filename);
              } catch (error) {
                console.error('Error saving screenshot:', error);
              }
            }
            break;

          case 'end-interview':
            // End the interview
            if (ws.voiceInterviewer && ws.interviewId) {
              try {
                // Generate final summary
                const summary = await ws.voiceInterviewer.generateFinalSummary();
                const transcript = ws.voiceInterviewer.getTranscript();

                // Update interview with results
                const updatedInterview = await prisma.interview.update({
                  where: { id: ws.interviewId },
                  data: {
                    endedAt: new Date(),
                    aiSummary: summary.summary,
                    aiTranscript: JSON.stringify(transcript)
                  }
                });

                // Create interview score
                await prisma.interviewScore.create({
                  data: {
                    interviewId: ws.interviewId,
                    communicationScore: summary.scores.communication,
                    technicalScore: summary.scores.technical,
                    problemSolvingScore: summary.scores.problemSolving,
                    culturalFitScore: summary.scores.culturalFit,
                    totalScore: Math.round(
                      (summary.scores.communication + 
                       summary.scores.technical + 
                       summary.scores.problemSolving + 
                       summary.scores.culturalFit) / 4
                    ),
                    details: {
                      strengths: summary.strengths,
                      weaknesses: summary.weaknesses,
                      recommendation: summary.recommendation
                    }
                  }
                });

                // Update application status
                const interview = await prisma.interview.findUnique({
                  where: { id: ws.interviewId },
                  include: {
                    application: {
                      include: {
                        job: {
                          include: {
                            recruiter: {
                              include: {
                                user: true
                              }
                            }
                          }
                        },
                        candidate: {
                          include: {
                            user: true
                          }
                        }
                      }
                    },
                    screenshots: true,
                    recordings: true,
                    score: true
                  }
                });

                if (interview) {
                  await prisma.application.update({
                    where: { id: interview.application.id },
                    data: { status: 'INTERVIEW_COMPLETED' }
                  });

                  // Send email to recruiter
                  // (Email service call would go here)
                  console.log('Interview completed, email would be sent to recruiter');
                }

                // Stop voice interviewer
                ws.voiceInterviewer.endInterview();

                // Send completion confirmation
                ws.send(JSON.stringify({ 
                  type: 'interview-completed',
                  summary: summary
                }));

                // Close connection after a short delay
                setTimeout(() => {
                  ws.close(1000, 'Interview completed');
                }, 2000);

              } catch (error) {
                console.error('Error ending interview:', error);
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  message: 'Error ending interview' 
                }));
              }
            }
            break;

          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (ws.voiceInterviewer) {
        ws.voiceInterviewer.endInterview();
      }
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      if (ws.voiceInterviewer) {
        ws.voiceInterviewer.endInterview();
      }
    });
  });

  return wss;
}

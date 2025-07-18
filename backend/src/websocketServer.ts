import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import { SimpleVoiceInterviewer } from './services/simpleVoiceInterviewer';
import { saveBase64Screenshot, saveAudioRecording } from './services/fileService';
import { Server } from 'http';

const prisma = new PrismaClient();

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  interviewId?: string;
  voiceInterviewer?: SimpleVoiceInterviewer;
}

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  console.log(`WebSocket server started on HTTP server`);

  wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
    // Move these to the top of the handler so they are always in scope
    let interviewTimeout: NodeJS.Timeout | null = null;
    let interviewEndTime: Date;

    // Define the function FIRST so it is available everywhere in this scope
    function endInterviewWithConclusion() {
      if (ws.voiceInterviewer && ws.interviewId) {
        ws.voiceInterviewer.processUserResponse('[system:conclude]', 0); // Pass 0 seconds left
        setTimeout(async () => {
          try {
            // Generate final summary (for backend only)
            const summary = await ws.voiceInterviewer!.generateFinalSummary();
            const transcript = ws.voiceInterviewer!.getTranscript();
            await prisma.interview.update({
              where: { id: ws.interviewId },
              data: {
                endedAt: new Date(),
                aiSummary: summary.summary,
                aiTranscript: JSON.stringify(transcript)
              }
            });
            ws.voiceInterviewer!.endInterview();
            ws.send(JSON.stringify({ type: 'interview-completed' })); // No summary sent
            setTimeout(() => ws.close(1000, 'Interview completed'), 2000);
          } catch (error) {
            console.error('Error ending interview (timeout):', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Error ending interview' }));
          }
        }, 5000); // Give AI 5 seconds to finish speaking
      }
    }

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
      // Use email prefix as candidate name (schema does not have name/fullName)
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

      // Interview duration timer (10 minutes)
      // Calculate interviewEndTime
      const interviewStartTime = interview.actualStartedAt ? new Date(interview.actualStartedAt) : new Date();
      const INTERVIEW_DURATION_SECONDS = 10 * 60;
      interviewEndTime = new Date(interviewStartTime.getTime() + INTERVIEW_DURATION_SECONDS * 1000);

      // Start 10-minute timer
      interviewTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'assistant-message', message: { role: 'assistant', content: 'Thank you for your time. The interview is now concluding as we have reached the 10-minute limit. I will summarize your responses and end the session.' } }));
          endInterviewWithConclusion();
        }
      }, 10 * 60 * 1000);

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
                console.log('Audio reported size:', message.size);
                const audioBuffer = Buffer.from(message.audioData, 'base64');
                console.log('Audio buffer size:', audioBuffer.length, 'bytes');
                
                // Additional validation
                if (message.size && Math.abs(audioBuffer.length - message.size) > 1000) {
                  console.warn('Audio size mismatch - reported:', message.size, 'actual:', audioBuffer.length);
                }
                
                // Save audio recording to file system
                if (ws.interviewId) {
                  try {
                    const audioUrl = await saveAudioRecording(audioBuffer, message.mimeType, ws.interviewId);
                    
                    // Save recording to database
                    await prisma.interviewRecording.create({
                      data: {
                        interviewId: ws.interviewId,
                        audioUrl,
                        recordingType: 'AUDIO'
                      }
                    });
                    
                    console.log('Audio recording saved:', audioUrl);
                  } catch (saveError) {
                    console.error('Error saving audio recording:', saveError);
                    // Continue with transcription even if saving fails
                  }
                }
                
                const transcription = await ws.voiceInterviewer.transcribeAudio(audioBuffer, message.mimeType);
                console.log('Transcription result:', transcription);
                
                // Validate transcription quality
                if (transcription && transcription.trim().length > 0) {
                  // Always process the transcription, even if it's unclear
                  // The voice interviewer will handle unclear responses naturally
                  const now = new Date();
                  const timeLeft = Math.max(0, Math.floor((interviewEndTime.getTime() - now.getTime()) / 1000));
                  await ws.voiceInterviewer!.processUserResponse(transcription.trim(), timeLeft);
                } else {
                  console.warn('Empty or invalid transcription, asking for repeat');
                  await ws.voiceInterviewer!.processUserResponse('[unclear speech - please repeat]');
                }
                
              } catch (error) {
                console.error('Error processing audio:', error);
                
                // Handle transcription errors more gracefully
                if (error instanceof Error) {
                  if (error.message.includes('too short') || error.message.includes('3-4 seconds')) {
                    // Let the voice interviewer handle this naturally
                    await ws.voiceInterviewer!.processUserResponse('[speech too short]');
                  } else if (error.message.includes('format not supported')) {
                    ws.send(JSON.stringify({ 
                      type: 'error', 
                      message: 'Audio format issue. Please refresh the page and try again.' 
                    }));
                  } else if (error.message.includes('Failed to transcribe')) {
                    // Handle our custom transcription failures
                    await ws.voiceInterviewer!.processUserResponse('[unclear audio - could you repeat that?]');
                  } else {
                    // For other errors, let the interviewer handle it conversationally
                    await ws.voiceInterviewer!.processUserResponse('[audio processing error]');
                  }
                } else {
                  // Generic error handling
                  await ws.voiceInterviewer!.processUserResponse('[unclear audio]');
                }
              }
            }
            break;

          case 'text-message':
            // Handle text input (for testing/fallback)
            if (message.text && ws.voiceInterviewer) {
              const nowText = new Date();
              const timeLeftText = Math.max(0, Math.floor((interviewEndTime.getTime() - nowText.getTime()) / 1000));
              await ws.voiceInterviewer!.processUserResponse(message.text, timeLeftText);
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
                const summary = await ws.voiceInterviewer!.generateFinalSummary();
                const transcript = ws.voiceInterviewer!.getTranscript();

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
                ws.voiceInterviewer!.endInterview();

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
      if (interviewTimeout) clearTimeout(interviewTimeout);
      if (ws.voiceInterviewer) ws.voiceInterviewer.endInterview();
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

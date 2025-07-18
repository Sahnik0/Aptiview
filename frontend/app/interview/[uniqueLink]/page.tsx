'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Camera, CameraOff, Phone, PhoneOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TranscriptMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

interface InterviewData {
  id: string;
  scheduledAt: string;
  job: {
    title: string;
    description: string;
    recruiter: {
      company: string;
    };
  };
  screenshotInterval: number;
}

export default function VoiceInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const uniqueLink = params.uniqueLink as string;

  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInterviewEnded, setIsInterviewEnded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize WebSocket connection
  const connectWebSocket = useCallback(() => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      // Determine protocol based on current page
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      // Use backend host/port, but protocol based on current page
      const url = new URL(backendUrl);
      const wsUrl = `${wsProtocol}://${url.hostname}:${url.port || '4000'}/interview/${uniqueLink}`;
      console.log('Connecting to:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
      };

      wsRef.current.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        console.log('Received message:', message.type);

        switch (message.type) {
          case 'interview-ready':
            setInterviewData(message.interview);
            break;

          case 'voice-connected':
            console.log('Voice AI connected');
            break;

          case 'audio-chunk':
            // Play AI audio response
            if (audioRef.current && message.data) {
              try {
                // Convert base64 to blob
                const audioData = Uint8Array.from(atob(message.data), c => c.charCodeAt(0));
                const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                audioRef.current.src = audioUrl;
                audioRef.current.onloadeddata = () => {
                  audioRef.current?.play().catch(console.error);
                };
                
                // Clean up URL after playing
                audioRef.current.onended = () => {
                  URL.revokeObjectURL(audioUrl);
                };
              } catch (error) {
                console.error('Error playing audio:', error);
              }
            }
            break;

          case 'transcript-update':
            setTranscript(prev => [...prev, message.message]);
            break;

          case 'transcription-status':
            // Show temporary feedback to user
            console.log('Transcription status:', message.message);
            // You could add a toast notification here
            break;

          case 'interview-complete':
          case 'interview-completed':
            setIsInterviewEnded(true);
            setIsInterviewActive(false);
            alert('Interview completed! Results have been sent to the recruiter.');
            setTimeout(() => {
              router.push('/candidate/dashboard');
            }, 3000);
            break;

          case 'error':
            setError(message.message);
            break;
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        if (event.code === 1008) {
          setError(event.reason || 'Interview link is invalid or expired');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error occurred');
      };

    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      setError('Failed to connect to interview');
    }
  }, [uniqueLink, router]);

  // Initialize media devices
  const initializeMedia = async () => {
    try {
      console.log('Requesting media permissions...');
      
      // Start with a simple request to ensure we get permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true  // Simplified audio request
      });

      console.log('Media permissions granted');
      mediaStreamRef.current = stream;

      // Setup video display
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsCameraEnabled(true);
      setIsMicEnabled(true);

      // Create a separate audio-only stream for recording
      const audioOnlyStream = new MediaStream();
      stream.getAudioTracks().forEach(track => {
        audioOnlyStream.addTrack(track);
      });

      // Setup MediaRecorder with audio-only stream for better compatibility with Whisper
      let mediaRecorder: MediaRecorder;
      
      try {
        // Try audio-only formats for better Whisper compatibility
        const audioFormats = [
          'audio/webm;codecs=opus',
          'audio/webm;codecs=pcm',
          'audio/webm',
          'audio/mp4;codecs=mp4a.40.2',
          'audio/mp4',
          'audio/mpeg',
          ''  // Default
        ];
        
        let selectedFormat = '';
        for (const format of audioFormats) {
          if (format === '' || MediaRecorder.isTypeSupported(format)) {
            selectedFormat = format;
            console.log('Selected audio format:', selectedFormat);
            break;
          }
        }
        
        if (selectedFormat) {
          // Use specific bitrate for better quality
          mediaRecorder = new MediaRecorder(audioOnlyStream, { 
            mimeType: selectedFormat,
            audioBitsPerSecond: 128000 // 128 kbps for better quality
          });
        } else {
          // Fallback with high bitrate
          mediaRecorder = new MediaRecorder(audioOnlyStream, {
            audioBitsPerSecond: 128000
          });
        }
        
        console.log('Created audio-only MediaRecorder with format:', selectedFormat || 'default');
      } catch (error) {
        console.error('Failed to create MediaRecorder:', error);
        throw new Error('Your browser does not support audio recording. Please try a different browser.');
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Audio chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Audio recording error. Please refresh and try again.');
        setIsRecording(false);
      };

      mediaRecorder.onstop = async () => {
        try {
          if (audioChunksRef.current.length > 0) {
            // Use the MediaRecorder's mimeType if available, otherwise default to audio/webm
            const mimeType = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            audioChunksRef.current = [];

            console.log('Audio recorded:', audioBlob.size, 'bytes, type:', mimeType);

            // Check if audio is long enough (increased minimum size for longer recordings)
            const minSizeBytes = 15000; // Increased minimum size for better quality
            const maxSizeBytes = 10 * 1024 * 1024; // 10MB max to prevent memory issues
            
            if (audioBlob.size < minSizeBytes) {
              console.warn('Audio too short, skipping transcription. Size:', audioBlob.size, 'bytes');
              setError('Please speak for at least 3-4 seconds. Try again.');
              return; // Don't send very short audio clips
            }

            if (audioBlob.size > maxSizeBytes) {
              console.warn('Audio too large, skipping transcription. Size:', audioBlob.size, 'bytes');
              setError('Audio recording too long. Please keep responses under 2 minutes.');
              return; // Don't send very large audio clips
            }

            // Convert to base64 using FileReader for better memory management
            try {
              const base64Audio = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  // Remove the data URL prefix (data:audio/webm;base64,)
                  const base64 = result.split(',')[1];
                  resolve(base64);
                };
                reader.onerror = () => reject(new Error('Failed to convert audio to base64'));
                reader.readAsDataURL(audioBlob);
              });

              // Log audio details for debugging
              console.log('Audio details:', {
                size: audioBlob.size,
                type: mimeType,
                base64Length: base64Audio.length,
                sampleSize: base64Audio.substring(0, 50) + '...'
              });

              if (wsRef.current?.readyState === WebSocket.OPEN) {
                console.log('Sending audio data to server... Size:', audioBlob.size, 'bytes');
                wsRef.current.send(JSON.stringify({
                  type: 'audio-data',
                  audioData: base64Audio,
                  mimeType: mimeType,
                  size: audioBlob.size // Add size for backend validation
                }));
              } else {
                console.error('WebSocket not connected, cannot send audio');
                setError('Connection lost. Please refresh the page.');
              }
            } catch (conversionError) {
              console.error('Error converting audio to base64:', conversionError);
              setError('Failed to process audio. Please try again.');
            }
          }
        } catch (error) {
          console.error('Error processing recorded audio:', error);
          setError('Failed to process audio recording. Please try again.');
        }
      };

    } catch (error) {
      console.error('Error accessing media devices:', error);
      
      // Provide specific error messages based on the error type
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setError('Microphone and camera access denied. Please allow permissions and refresh the page.');
        } else if (error.name === 'NotFoundError') {
          setError('No microphone or camera found. Please connect these devices and refresh.');
        } else if (error.name === 'NotSupportedError') {
          setError('Your browser does not support media recording. Please try Chrome or Firefox.');
        } else {
          setError(`Media access error: ${error.message}`);
        }
      } else {
        setError('Please allow camera and microphone access to start the interview');
      }
    }
  };

  // Start recording audio
  const startRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
        audioChunksRef.current = [];
        // Start recording without time slicing to get one continuous audio file
        mediaRecorderRef.current.start();
        setIsRecording(true);
        console.log('Started recording audio (continuous recording)');
        
        // Auto-stop after 30 seconds to prevent overly long recordings
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            stopRecording();
            console.log('Auto-stopped recording after 30 seconds');
          }
        }, 30000);
      } else {
        console.warn('MediaRecorder not ready or already recording');
        if (!mediaRecorderRef.current) {
          setError('Audio recording not initialized. Please refresh and try again.');
        }
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Failed to start audio recording. Please check your microphone permissions.');
      setIsRecording(false);
    }
  };

  // Stop recording audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('Stopped recording audio');
    }
  };

  // Screenshot capture
  const captureScreenshot = useCallback(() => {
    if (videoRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        wsRef.current.send(JSON.stringify({
          type: 'screenshot',
          imageData: imageData.split(',')[1] // Remove data:image/jpeg;base64, prefix
        }));
      }
    }
  }, []);

  // New: Permission and start flow
  const handleAllowAndStart = async () => {
    setPermissionError(null);
    try {
      await initializeMedia();
      connectWebSocket();
      setShowPermissionModal(false);
      setIsInterviewActive(true);
      // Start screenshot capture interval
      if (interviewData?.screenshotInterval) {
        screenshotIntervalRef.current = setInterval(
          captureScreenshot,
          interviewData.screenshotInterval * 1000
        );
      }
    } catch (err: any) {
      setPermissionError(err?.message || 'Failed to access camera/microphone. Please try again.');
    }
  };

  // End interview
  const endInterview = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'end-interview'
      }));
    }

    // Cleanup
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current);
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }

    setIsInterviewActive(false);
  };

  // Toggle microphone
  const toggleMicrophone = () => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicEnabled(audioTrack.enabled);
      }
    }
  };

  // Toggle camera
  const toggleCamera = () => {
    if (mediaStreamRef.current) {
      const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraEnabled(videoTrack.enabled);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Interview Error</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              onClick={() => router.push('/candidate/dashboard')} 
              className="w-full mt-4"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isInterviewEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-green-600">Interview Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center mb-4">
              Thank you for completing the interview! Your responses have been recorded and sent to the recruiter.
            </p>
            <p className="text-sm text-gray-600 text-center">
              Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Dialog open={showPermissionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Your AI Interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-700">To begin, please allow camera and microphone access. This is required for the AI interview process.</p>
            {permissionError && (
              <Alert>
                <AlertDescription>{permissionError}</AlertDescription>
              </Alert>
            )}
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={handleAllowAndStart}
              disabled={isInterviewActive}
            >
              Allow & Start Interview
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/candidate/dashboard')}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!showPermissionModal && (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl">
                      {interviewData?.job.title || 'AI Interview'}
                    </CardTitle>
                    <p className="text-gray-600">
                      {interviewData?.job.recruiter.company || 'Company Interview'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={isConnected ? 'default' : 'secondary'}>
                      {isConnected ? 'Connected' : 'Connecting...'}
                    </Badge>
                    {isInterviewActive && (
                      <Badge variant="default" className="bg-red-600">
                        Recording
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Video Feed */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Video Feed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      {!isCameraEnabled && (
                        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                          <CameraOff className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {/* Controls */}
                    <div className="flex justify-center gap-4 mt-4">
                      <Button
                        variant={isMicEnabled ? 'default' : 'destructive'}
                        size="lg"
                        onClick={toggleMicrophone}
                        disabled={!isInterviewActive}
                      >
                        {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                      </Button>
                      <Button
                        variant={isCameraEnabled ? 'default' : 'destructive'}
                        size="lg"
                        onClick={toggleCamera}
                        disabled={!isInterviewActive}
                      >
                        {isCameraEnabled ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                      </Button>
                      {/* Start/Stop Speaking Controls */}
                      {isInterviewActive && (
                        <Button
                          size="lg"
                          onClick={isRecording ? stopRecording : startRecording}
                          variant={isRecording ? 'destructive' : 'default'}
                          disabled={!isMicEnabled}
                        >
                          {isRecording ? 'Stop Speaking' : 'Start Speaking'}
                        </Button>
                      )}
                      {isRecording && (
                        <p className="text-sm text-blue-600 text-center">
                          🎤 Recording... Speak clearly for 3+ seconds, then click Stop
                        </p>
                      )}
                      {!isRecording && isInterviewActive && (
                        <p className="text-sm text-gray-600 text-center">
                          Click "Start Speaking" to record your response (3+ seconds minimum)
                        </p>
                      )}
                      <Button
                        size="lg"
                        onClick={endInterview}
                        variant="destructive"
                        disabled={!isInterviewActive}
                      >
                        <PhoneOff className="w-5 h-5 mr-2" />
                        End Interview
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              {/* Transcript */}
              <div>
                <Card className="h-[600px]">
                  <CardHeader>
                    <CardTitle>Interview Transcript</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[500px] overflow-y-auto space-y-4">
                      {transcript.length === 0 ? (
                        <div className="text-center text-gray-500 mt-8">
                          <p>Interview transcript will appear here</p>
                          <p className="text-sm mt-2">Start the interview to begin</p>
                        </div>
                      ) : (
                        transcript.map((message, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg ${
                              message.role === 'assistant'
                                ? 'bg-blue-50 border-l-4 border-blue-500'
                                : 'bg-gray-50 border-l-4 border-gray-500'
                            }`}
                          >
                            <div className="font-semibold text-sm mb-1">
                              {message.role === 'assistant' ? 'AI Interviewer' : 'You'}
                            </div>
                            <p className="text-sm">{message.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            {/* Hidden audio element for AI responses */}
            <audio ref={audioRef} className="hidden" />
          </div>
        </div>
      )}
    </>
  );
}

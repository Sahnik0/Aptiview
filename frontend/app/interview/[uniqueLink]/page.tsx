'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  const [timeLeft, setTimeLeft] = useState(10 * 60); // 10 minutes in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Removed interval-based face detection refs (using RAF + BlazeFace)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const vadRef = useRef<{ctx: AudioContext; analyser: AnalyserNode; source: MediaStreamAudioSourceNode; data: Uint8Array; silenceMs: number; lastVoice: number} | null>(null);
  const blazeBoxesRef = useRef<Array<{ x: number; y: number; width: number; height: number }>>([]);
  const lastBlazeTsRef = useRef<number>(0);
  const blazeBusyRef = useRef<boolean>(false);
  const [detectorInfo, setDetectorInfo] = useState<string>('');
  const [faceCount, setFaceCount] = useState<number>(0);
  const faceStatus = useMemo<'ok' | 'none' | 'multiple'>(() => {
    if (faceCount === 1) return 'ok';
    if (faceCount === 0) return 'none';
    return 'multiple';
  }, [faceCount]);
  // Eye tracking (FaceMesh)
  const faceMeshModelRef = useRef<any>(null);
  const tfReadyRef = useRef(false);
  const detectorReadyRef = useRef(false);
  const faceMeshRuntimeRef = useRef<'mediapipe' | 'tfjs' | null>(null);
  // TFJS / BlazeFace caching
  const blazeModelRef = useRef<any>(null);
  const tfInitRef = useRef(false);
  const [gazeOff, setGazeOff] = useState(false);
  const offScreenCounterRef = useRef(0);
  const [eyesClosed, setEyesClosed] = useState(false);
  const closedEyesCounterRef = useRef(0);
  const [proctorWarning, setProctorWarning] = useState<string | null>(null);
  const [eyeTrackingAvailable, setEyeTrackingAvailable] = useState(false);
  const [terminatedByFullscreen, setTerminatedByFullscreen] = useState(false);
  // Gaze calibration (dynamic thresholds per user/session)
  const gazeCalibRef = useRef<{ done: boolean; startTs: number; samples: { hL: number[]; hR: number[]; vL: number[]; vR: number[] }; baseline: null | { hL: number; hR: number; vL: number; vR: number } }>({
    done: false,
    startTs: 0,
    samples: { hL: [], hR: [], vL: [], vR: [] },
    baseline: null,
  });
  // WebGazer (screen-based gaze) integration
  const webGazerRef = useRef<any>(null);
  const wgEnabledRef = useRef(false);
  const wgOffCounterRef = useRef(0);
  const wgCalibRef = useRef<{ done: boolean; startTs: number; cx: number; cy: number } | null>(null);
  const [usingWebGazer, setUsingWebGazer] = useState(false);
  // Head orientation tracking (watching other things)
  const headOffCounterRef = useRef(0);
  const headOffActiveRef = useRef(false);
  // Smoothed head pose values to reduce jitter
  const yawEmaRef = useRef(0);
  const pitchEmaRef = useRef(0);
  // Baseline face position for relative movement detection
  const faceBaselineRef = useRef<{ eyeWidthL: number; eyeWidthR: number; pitch: number; samples: number } | null>(null);
  // Face count ref for non-stale reads in listeners
  const faceCountRef = useRef(0);
  useEffect(() => { faceCountRef.current = faceCount; }, [faceCount]);
  // WebGazer EMA smoothing
  const wgEmaRef = useRef<{ inited: boolean; x: number; y: number }>({ inited: false, x: 0, y: 0 });

  // Ensure TFJS backend is initialized once with fallbacks
  const ensureTFReady = useCallback(async () => {
    if (tfInitRef.current) return;
    try {
      const tf = await import('@tensorflow/tfjs-core');
      // Try WebGL first
      try {
        await import('@tensorflow/tfjs-backend-webgl');
        await tf.setBackend('webgl');
      } catch {}
      // If WebGL not active, try WASM
      try {
        if (typeof tf.getBackend === 'function' && tf.getBackend() !== 'webgl') {
          await import('@tensorflow/tfjs-backend-wasm');
          await tf.setBackend('wasm');
        }
      } catch {}
      // Converter utils (no-op for backends)
      await import('@tensorflow/tfjs-converter');
      await tf.ready();
      tfInitRef.current = true;
    } catch (e) {
      console.warn('TF init failed:', e);
    }
  }, []);

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
        video: {
          facingMode: 'user',
          width: { ideal: 960, max: 1280 },
          height: { ideal: 540, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      console.log('Media permissions granted');
      mediaStreamRef.current = stream;

      // Validate video track and setup video display
      const vTrack = stream.getVideoTracks()[0];
      if (!vTrack) {
        throw new Error('No video track available. Please check your camera permissions or device.');
      }
      if (videoRef.current) {
        // Set critical attributes for autoplay on mobile browsers
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        videoRef.current.srcObject = stream;
        const tryPlay = () => {
          videoRef.current?.play().catch(() => {
            // Will be retried on next event
          });
        };
        videoRef.current.onloadedmetadata = tryPlay;
        videoRef.current.oncanplay = tryPlay;
        // Initial attempt
        tryPlay();
      }

      setIsCameraEnabled(true);
      setIsMicEnabled(true);

      // Create a separate audio-only stream for recording
      const audioOnlyStream = new MediaStream();
      stream.getAudioTracks().forEach(track => {
        audioOnlyStream.addTrack(track);
      });

      // Setup lightweight VAD (silence detection) to auto-stop
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = ctx.createMediaStreamSource(audioOnlyStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        vadRef.current = { ctx, analyser, source, data, silenceMs: 0, lastVoice: Date.now() };
      } catch {}

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
          // Lower bitrate and slice for lower latency
          mediaRecorder = new MediaRecorder(audioOnlyStream, { 
            mimeType: selectedFormat,
            audioBitsPerSecond: 96000
          });
        } else {
          mediaRecorder = new MediaRecorder(audioOnlyStream, {
            audioBitsPerSecond: 96000
          });
        }
        
        console.log('Created audio-only MediaRecorder with format:', selectedFormat || 'default');
      } catch (error) {
        console.error('Failed to create MediaRecorder:', error);
        throw new Error('Your browser does not support audio recording. Please try a different browser.');
      }

      mediaRecorderRef.current = mediaRecorder;

      // Collect chunks and send once per utterance on stop for better transcription quality
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Audio recording error. Please refresh and try again.');
        setIsRecording(false);
      };

      mediaRecorder.onstop = async () => {
        try {
          const chunks = audioChunksRef.current;
          audioChunksRef.current = [];
          if (!chunks || chunks.length === 0) return;
          const mime = mediaRecorder.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: mime });
          // Client-side guard for too-small audio that server would reject
          if (blob.size < 8000) {
            console.warn('Recorded audio too short to transcribe (size:', blob.size, ')');
            return;
          }
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              try {
                wsRef.current?.send(
                  JSON.stringify({ type: 'audio-data', audioData: base64, mimeType: blob.type, size: blob.size })
                );
              } catch (e) {
                console.error('Failed to send audio-data:', e);
              }
            };
            reader.readAsDataURL(blob);
          }
        } catch (e) {
          console.error('onstop assembly error:', e);
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
  // Start recording (no timeslice) and collect chunks until stop
  mediaRecorderRef.current.start();
  // Start VAD loop
  if (vadRef.current) {
    const { analyser, data } = vadRef.current;
    const tick = () => {
      if (!isRecording || !vadRef.current) return;
  (analyser as any).getByteTimeDomainData(data as any);
      // Compute simple RMS
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();
      if (rms > 0.02) {
        vadRef.current.lastVoice = now;
      }
      // Auto-stop if 1200ms of silence after at least 2.5s of speech window
      if (now - vadRef.current.lastVoice > 1200) {
        stopRecording();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
        setIsRecording(true);
  console.log('Started recording audio (1s slices)');
        
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
      // Reset VAD trackers
      if (vadRef.current) {
        vadRef.current.lastVoice = Date.now();
      }
    }
  };

  // Screenshot capture (optional reason for proctoring)
  const captureScreenshot = useCallback((reason?: string) => {
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
    imageData: imageData.split(',')[1], // Remove data:image/jpeg;base64, prefix
    reason: reason || undefined
        }));
      }
    }
  }, []);

  // Removed drawOverlay/detectFaces: using BlazeFace in RAF loop instead

  // (Removed face-api.js fallback and gating helper)

  // New: Permission and start flow
  const handleAllowAndStart = async () => {
    setPermissionError(null);
    try {
  await initializeMedia();
      connectWebSocket();
      setShowPermissionModal(false);
      setIsInterviewActive(true);
      // Reset gaze calibration
      gazeCalibRef.current = {
        done: false,
        startTs: performance.now(),
        samples: { hL: [], hR: [], vL: [], vR: [] },
        baseline: null,
      };
      // Start WebGazer (best-effort)
      try {
        await startWebGazer();
      } catch {}
      // Slight delay before requesting fullscreen to avoid jank
      setTimeout(async () => {
        try {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          }
        } catch {}
      }, 300);
      // Intervals are started via effects once video + data ready
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
  // Stop WebGazer if running
  try { stopWebGazer(); } catch {}
    
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
  // Stop WebGazer on unmount
  try { stopWebGazer(); } catch {}
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Timer effect
  useEffect(() => {
    if (isInterviewActive && !isInterviewEnded) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isInterviewActive, isInterviewEnded]);

  // Video attach watchdog: retries attaching stream and playing until frames are available
  useEffect(() => {
    if (!isInterviewActive || isInterviewEnded) return;
    const video = videoRef.current;
    const stream = mediaStreamRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12; // ~6s total
    const retry = () => {
      if (cancelled) return;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.setAttribute('playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.playsInline = true;
      video.muted = true;
      video.play().catch(() => {});
      if ((video as HTMLVideoElement).videoWidth > 0 || attempts >= maxAttempts) return;
      attempts += 1;
      setTimeout(retry, 500);
    };
    retry();
    return () => {
      cancelled = true;
    };
  }, [isInterviewActive, isInterviewEnded]);

  // Removed interval-based face detection effect; handled in RAF loop

  // Load FaceMesh for eye tracking (prefer MediaPipe runtime, fallback to TFJS)
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const fl = await import('@tensorflow-models/face-landmarks-detection');
        // Try mediapipe runtime first
        try {
          const model = await fl.createDetector(fl.SupportedModels.MediaPipeFaceMesh, {
            runtime: 'mediapipe',
            refineLandmarks: true,
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
            maxFaces: 1,
          } as any);
          if (!cancelled) {
            faceMeshModelRef.current = model;
            faceMeshRuntimeRef.current = 'mediapipe';
            detectorReadyRef.current = true;
            setEyeTrackingAvailable(true);
            setDetectorInfo('BlazeFace + FaceMesh');
          }
          return;
        } catch (e) {
          // fallback to tfjs
        }
  await ensureTFReady();
        const model = await fl.createDetector(fl.SupportedModels.MediaPipeFaceMesh, {
          runtime: 'tfjs',
          refineLandmarks: true,
          maxFaces: 1,
        } as any);
        if (!cancelled) {
          faceMeshModelRef.current = model;
          faceMeshRuntimeRef.current = 'tfjs';
          tfReadyRef.current = true;
          detectorReadyRef.current = true;
          setEyeTrackingAvailable(true);
          setDetectorInfo('BlazeFace + FaceMesh');
        }
      } catch (e) {
        console.warn('Eye tracking init failed:', e);
        setEyeTrackingAvailable(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // BlazeFace face detection + FaceMesh eye tracking render loop (throttled)
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = async (ts?: number) => {
      raf = requestAnimationFrame(loop);
      if (ts && last && ts - last < 120) return; // ~8 FPS throttle
      last = ts || performance.now();
      if (!isInterviewActive) return;
      const video = videoRef.current;
      const canvas = overlayRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
  // Clear once per frame; we'll draw bounding box and iris markers together
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 1) BlazeFace for face detection (throttled)
      try {
        const now = performance.now();
        if (!blazeModelRef.current) {
          const blazeface = await import('@tensorflow-models/blazeface');
          await ensureTFReady();
          blazeModelRef.current = await blazeface.load();
          if (!detectorInfo) setDetectorInfo('BlazeFace + FaceMesh');
        }
        if (!blazeBusyRef.current && now - lastBlazeTsRef.current > 120) {
          blazeBusyRef.current = true;
          const preds: any[] = await blazeModelRef.current.estimateFaces(video as any, false);
          const boxes = Array.isArray(preds)
            ? preds.map((p: any) => {
                const [x1, y1] = p.topLeft as [number, number];
                const [x2, y2] = p.bottomRight as [number, number];
                return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
              })
            : [];
          // Proctor: multiple faces
          if (faceCount <= 1 && preds && preds.length > 1) {
            captureScreenshot('multiple-faces');
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'proctor-event', event: 'multiple-faces', at: Date.now() }));
            }
          }
          setFaceCount(Array.isArray(preds) ? preds.length : 0);
          blazeBoxesRef.current = boxes;
          lastBlazeTsRef.current = now;
          blazeBusyRef.current = false;
        }
      } catch (e) {
        blazeBusyRef.current = false;
      }

      // Draw BlazeFace boxes (if any)
      const boxes = blazeBoxesRef.current || [];
      if (boxes.length > 0) {
        ctx.strokeStyle = boxes.length === 1 ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 3;
        for (const b of boxes) ctx.strokeRect(b.x, b.y, b.width, b.height);
      }

      // 2) FaceMesh for eyes (EAR/closed + optional gaze) and head pose (only if available and at least one face detected)
      if (detectorReadyRef.current && faceMeshModelRef.current && faceCount >= 1) {
        try {
          const preds = await faceMeshModelRef.current.estimateFaces(video, { flipHorizontal: true });
          if (!preds || preds.length === 0) {
            // If FaceMesh can't find landmarks while a face is still detected by BlazeFace,
            // treat this as potential gaze-off and do not clobber faceCount.
            const wasOff = gazeOff;
            if (gazeCalibRef.current.done) {
              offScreenCounterRef.current++;
              const nowOff = offScreenCounterRef.current > 6; // ~0.7s at ~8fps (harsher)
              setGazeOff(nowOff);
              setProctorWarning(nowOff ? 'Please keep your eyes on the screen.' : null);
              if (!wasOff && nowOff) {
                captureScreenshot('gaze-off-screen');
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'proctor-event', event: 'gaze-off-screen', at: Date.now() }));
                }
              }
            } else {
              // During calibration, don't penalize missing landmarks
              offScreenCounterRef.current = 0;
              setGazeOff(false);
              setProctorWarning(null);
            }
            // Do not change faceCount here; BlazeFace owns it
            return;
          }
          offScreenCounterRef.current = 0;
          const face = preds[0];
          const pts = (face.keypoints || []).map((p: any) => [p.x, p.y]);
          // Helper to safely fetch a point; returns undefined if out of range
          const getPt = (i: number) => (i >= 0 && i < pts.length && isFinite(pts[i]?.[0]) && isFinite(pts[i]?.[1])) ? pts[i] : undefined;
          const L_OUT = getPt(33), L_IN = getPt(133);
          const R_OUT = getPt(362), R_IN = getPt(263);
          const L_UP = getPt(159), L_LO = getPt(145);
          const R_UP = getPt(386), R_LO = getPt(374);
          const CHIN = getPt(152);
          const FOREHEAD = getPt(10);
          if (!L_OUT || !L_IN || !R_OUT || !R_IN || !L_UP || !L_LO || !R_UP || !R_LO) {
            // Missing critical eye landmarks: treat as potential off-screen
            const wasOff = gazeOff;
            offScreenCounterRef.current++;
            const nowOff = offScreenCounterRef.current > 16;
            setGazeOff(nowOff);
            setProctorWarning(nowOff ? 'Please keep your eyes on the screen.' : null);
            if (!wasOff && nowOff) {
              captureScreenshot('gaze-off-screen');
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'proctor-event', event: 'gaze-off-screen', at: Date.now() }));
              }
            }
            return;
          }
          // Iris centers: average ring points for stability (requires refineLandmarks: true)
          const leftIrisIdx = [468, 469, 470, 471];
          const rightIrisIdx = [473, 474, 475, 476];
          const avgPoint = (ids: number[], fallback: [number, number]) => {
            let sx = 0, sy = 0, n = 0;
            for (const id of ids) {
              const p = pts[id];
              if (p && isFinite(p[0]) && isFinite(p[1])) { sx += p[0]; sy += p[1]; n++; }
            }
            if (n === 0) return fallback;
            return [sx / n, sy / n] as [number, number];
          };
          const L_IRIS = avgPoint(leftIrisIdx, [(L_OUT[0] + L_IN[0]) / 2, (L_UP[1] + L_LO[1]) / 2]);
          const R_IRIS = avgPoint(rightIrisIdx, [(R_OUT[0] + R_IN[0]) / 2, (R_UP[1] + R_LO[1]) / 2]);
          // Eye openness (rough EAR) with guards
          const leftH = Math.hypot(L_OUT[0]-L_IN[0], L_OUT[1]-L_IN[1]);
          const rightH = Math.hypot(R_OUT[0]-R_IN[0], R_OUT[1]-R_IN[1]);
          const leftV = Math.hypot(L_UP[0]-L_LO[0], L_UP[1]-L_LO[1]);
          const rightV = Math.hypot(R_UP[0]-R_LO[0], R_UP[1]-R_LO[1]);
          const denom = Math.max(1e-6, leftH + rightH);
          const ear = (leftV + rightV) / denom;
          const closed = ear < 0.18;
          if (closed) closedEyesCounterRef.current++; else closedEyesCounterRef.current = 0;
          setEyesClosed(closedEyesCounterRef.current > 10);
          // Head pose heuristic (yaw/pitch) for "watching other things"
          // Yaw from eye-width asymmetry: one eye appears narrower when turning
          const eyeWidthL = Math.hypot(L_OUT[0]-L_IN[0], L_OUT[1]-L_IN[1]);
          const eyeWidthR = Math.hypot(R_OUT[0]-R_IN[0], R_OUT[1]-R_IN[1]);
          
          // Initialize headOff for use later
          let headOff = false;
          
          // Establish baseline if we don't have one yet (first few frames)
          if (!faceBaselineRef.current || faceBaselineRef.current.samples < 30) {
            if (!faceBaselineRef.current) {
              faceBaselineRef.current = { eyeWidthL: eyeWidthL, eyeWidthR: eyeWidthR, pitch: 0, samples: 0 };
            }
            // Update baseline using moving average
            const alpha = 0.1;
            faceBaselineRef.current.eyeWidthL = faceBaselineRef.current.eyeWidthL * (1 - alpha) + eyeWidthL * alpha;
            faceBaselineRef.current.eyeWidthR = faceBaselineRef.current.eyeWidthR * (1 - alpha) + eyeWidthR * alpha;
            faceBaselineRef.current.samples++;
            
            // During baseline collection, don't trigger warnings
            headOffCounterRef.current = 0;
            headOffActiveRef.current = false;
            if (!gazeOff) setProctorWarning(null);
          } else {
            // Calculate relative changes from baseline
            const baseline = faceBaselineRef.current;
            const eyeWidthRatio = Math.max(1e-6, baseline.eyeWidthL + baseline.eyeWidthR);
            const yawChange = ((eyeWidthL - baseline.eyeWidthL) - (eyeWidthR - baseline.eyeWidthR)) / eyeWidthRatio;
            
            // Pitch from forehead/chin symmetry around eye line
            let pitchChange = 0;
            if (CHIN && FOREHEAD) {
              const eyeLineY = (L_UP[1] + L_LO[1] + R_UP[1] + R_LO[1]) / 4;
              const faceSpan = Math.max(1e-6, Math.abs(CHIN[1] - FOREHEAD[1]));
              const currentPitch = ((CHIN[1] - eyeLineY) - (eyeLineY - FOREHEAD[1])) / faceSpan;
              pitchChange = Math.abs(currentPitch - baseline.pitch);
              
              // Update baseline pitch slowly
              baseline.pitch = baseline.pitch * 0.995 + currentPitch * 0.005;
            }
            
            // Apply exponential moving average to smooth out noise
            const alphaHP = 0.3;
            yawEmaRef.current = yawEmaRef.current * (1 - alphaHP) + Math.abs(yawChange) * alphaHP;
            pitchEmaRef.current = pitchEmaRef.current * (1 - alphaHP) + pitchChange * alphaHP;
            
            // More conservative thresholds to reduce false positives
            const yawThreshold = 0.15;  // Increased from 0.1
            const pitchThreshold = 0.3; // Increased from 0.2
            headOff = yawEmaRef.current > yawThreshold || pitchEmaRef.current > pitchThreshold;
            
            if (headOff) {
              headOffCounterRef.current++;
            } else {
              headOffCounterRef.current = Math.max(0, headOffCounterRef.current - 1); // Gradual decay
            }
            
            // Require sustained movement for longer duration to reduce false positives
            const framesToTrigger = 12; // ~1.5 seconds at 8fps
            if (headOffCounterRef.current > framesToTrigger && !headOffActiveRef.current) {
              headOffActiveRef.current = true;
              // Only set warning if no gaze warning is already active
              if (!gazeOff) {
                setProctorWarning('Please face the screen.');
              }
              captureScreenshot('head-turned');
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'proctor-event', event: 'head-turned', at: Date.now() }));
              }
            } else if (headOffCounterRef.current === 0 && headOffActiveRef.current) {
              headOffActiveRef.current = false;
              // Only clear warning if no gaze warning is active
              if (!gazeOff) setProctorWarning(null);
            }
          }

          // If WebGazer is NOT active, use FaceMesh-based gaze logic (ratios + calibration)
          if (!wgEnabledRef.current) {
            // Compute normalized gaze ratios
            const safeRatio = (num: number, den: number) => {
              if (!isFinite(num) || !isFinite(den) || Math.abs(den) < 1e-6) return 0.5;
              return num / den;
            };
            const hRatioL = safeRatio(L_IRIS[0] - L_OUT[0], L_IN[0] - L_OUT[0]);
            const hRatioR = safeRatio(R_IRIS[0] - R_OUT[0], R_IN[0] - R_OUT[0]);
            const vRatioL = safeRatio(L_IRIS[1] - L_UP[1], L_LO[1] - L_UP[1]);
            const vRatioR = safeRatio(R_IRIS[1] - R_UP[1], R_LO[1] - R_UP[1]);
            const calib = gazeCalibRef.current;
            if (!calib.done) {
              const now = performance.now();
              calib.samples.hL.push(hRatioL); calib.samples.hR.push(hRatioR);
              calib.samples.vL.push(vRatioL); calib.samples.vR.push(vRatioR);
              if (calib.samples.hL.length > 120) {
                calib.samples.hL.shift(); calib.samples.hR.shift(); calib.samples.vL.shift(); calib.samples.vR.shift();
              }
              const enoughTime = now - calib.startTs > 1200; // speed up calibration
              const enoughSamples = calib.samples.hL.length >= 24;
              if (enoughTime || enoughSamples) {
                const avg = (arr: number[]) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0.5;
                calib.baseline = {
                  hL: avg(calib.samples.hL),
                  hR: avg(calib.samples.hR),
                  vL: avg(calib.samples.vL),
                  vR: avg(calib.samples.vR),
                };
                calib.done = true;
              }
              offScreenCounterRef.current = 0;
              setGazeOff(false);
              setProctorWarning(null);
            }

            const baseline = gazeCalibRef.current.baseline;
            let centered = true;
            if (baseline) {
              // More lenient windows to reduce false positives
              const dH = 0.055, dV = 0.065; // Increased from 0.035/0.045
              const within = (v: number, c: number, d: number) => v > (c - d) && v < (c + d);
              centered = within(hRatioL, baseline.hL, dH) && within(hRatioR, baseline.hR, dH)
                      && within(vRatioL, baseline.vL, dV) && within(vRatioR, baseline.vR, dV);
            } else {
              // More lenient fallback thresholds
              const centerH = (r: number) => r > 0.45 && r < 0.55; // Wider range
              const centerV = (r: number) => r > 0.43 && r < 0.57; // Wider range
              centered = centerH(hRatioL) && centerH(hRatioR) && centerV(vRatioL) && centerV(vRatioR);
            }

            if (gazeCalibRef.current.done) {
              if (!centered || headOff) offScreenCounterRef.current++; else offScreenCounterRef.current = Math.max(0, offScreenCounterRef.current - 1); // Gradual decay
              const nowOff = offScreenCounterRef.current > 8; // Increased from 5 (~1.0s)
              const wasOff = gazeOff;
              setGazeOff(nowOff);
              
              // Coordinate with head movement warnings
              if (nowOff && !headOffActiveRef.current) {
                setProctorWarning('Please keep your eyes on the screen.');
              } else if (!nowOff && !headOffActiveRef.current) {
                setProctorWarning(null);
              }
              
              if (!wasOff && nowOff) {
                captureScreenshot('gaze-off-screen');
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'proctor-event', event: 'gaze-off-screen', at: Date.now() }));
                }
              }
            }
          }
          // Draw minimal iris overlay
          ctx.fillStyle = '#10b981';
          ctx.beginPath(); ctx.arc(L_IRIS[0], L_IRIS[1], 3, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(R_IRIS[0], R_IRIS[1], 3, 0, Math.PI*2); ctx.fill();
        } catch {}
      }
    };
  raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isInterviewActive, gazeOff, captureScreenshot]);

  // Start WebGazer and hook its gaze listener for screen-based eye movement detection
  const startWebGazer = useCallback(async () => {
    if (wgEnabledRef.current) return;
    try {
      const webgazer = (await import('webgazer')).default as any;
      if (!webgazer) return;
      // Hide internal UI
      try { webgazer.showVideo(false); } catch {}
      try { webgazer.showFaceOverlay(false); } catch {}
      try { webgazer.showPredictionPoints(false); } catch {}
      try { webgazer.params.screenVideoGL = null; } catch {}
      webgazer.setRegression('ridge');
      // Start
      await webgazer.begin();
      webGazerRef.current = webgazer;
      wgEnabledRef.current = true;
      setUsingWebGazer(true);
      // Quick calibration: capture center for ~1s
      wgCalibRef.current = { done: false, startTs: performance.now(), cx: 0.5, cy: 0.5 };
      wgOffCounterRef.current = 0;
      wgEmaRef.current = { inited: false, x: 0, y: 0 };

      webgazer.setGazeListener((data: any) => {
        if (!data) return;
        const x = data.x; // pixels
        const y = data.y;
        if (!isFinite(x) || !isFinite(y)) return;
        // If face not present, ignore WebGazer samples
        if (faceCountRef.current < 1) {
          wgOffCounterRef.current = 0;
          return;
        }
        let nx = x / Math.max(1, window.innerWidth);
        let ny = y / Math.max(1, window.innerHeight);
        // EMA smoothing
        const alpha = 0.3;
        if (!wgEmaRef.current.inited) {
          wgEmaRef.current = { inited: true, x: nx, y: ny };
        } else {
          wgEmaRef.current.x = wgEmaRef.current.x * (1 - alpha) + nx * alpha;
          wgEmaRef.current.y = wgEmaRef.current.y * (1 - alpha) + ny * alpha;
        }
        nx = wgEmaRef.current.x;
        ny = wgEmaRef.current.y;
        const calib = wgCalibRef.current;
        const now = performance.now();
        if (calib && !calib.done) {
          // assume user looks center at start
          if (now - calib.startTs > 1000) {
            calib.cx = nx; calib.cy = ny; calib.done = true;
          }
          setGazeOff(false);
          setProctorWarning(null);
          wgOffCounterRef.current = 0;
          return;
        }
        const cx = calib?.cx ?? 0.5;
        const cy = calib?.cy ?? 0.5;
        const dx = Math.abs(nx - cx);
        const dy = Math.abs(ny - cy);
        // More conservative thresholds to reduce false positives
        const off = dx > 0.12 || dy > 0.15; // Increased from 0.08/0.10
        if (off) wgOffCounterRef.current++; else wgOffCounterRef.current = Math.max(0, wgOffCounterRef.current - 1); // Gradual decay
        const nowOff = wgOffCounterRef.current > 12; // ~1.0-1.5s depending on callback rate, increased from 8
        const wasOff = gazeOff;
        if (nowOff !== wasOff) {
          setGazeOff(nowOff);
          // Coordinate with head movement warnings
          if (nowOff && !headOffActiveRef.current) {
            setProctorWarning('Please keep your eyes on the screen.');
          } else if (!nowOff && !headOffActiveRef.current) {
            setProctorWarning(null);
          }
          if (!wasOff && nowOff) {
            captureScreenshot('gaze-off-screen');
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'proctor-event', event: 'gaze-off-screen', at: Date.now() }));
            }
          }
        }
      });
    } catch (e) {
      // If WebGazer fails, continue with FaceMesh-only logic
      wgEnabledRef.current = false;
      setUsingWebGazer(false);
    }
  }, [captureScreenshot]);

  const stopWebGazer = useCallback(() => {
    try {
      const wg = webGazerRef.current;
      if (wg && typeof wg.end === 'function') {
        wg.end();
      }
    } catch {}
    wgEnabledRef.current = false;
    setUsingWebGazer(false);
  }, []);

  // Require fullscreen and tab focus; terminate if leaving fullscreen
  useEffect(() => {
    if (!isInterviewActive) return;
    const requireFull = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
    };
    requireFull();
    const visHandler = () => {
      if (document.hidden) {
        setProctorWarning('Tab switch detected. Please stay focused on the interview.');
      } else {
        // Entered fullscreen -> re-calibrate WebGazer baseline
        if (wgEnabledRef.current) {
          wgCalibRef.current = { done: false, startTs: performance.now(), cx: 0.5, cy: 0.5 };
          wgOffCounterRef.current = 0;
          wgEmaRef.current = { inited: false, x: 0, y: 0 };
        }
        setProctorWarning(null);
      }
    };
    const fsHandler = () => {
      if (!document.fullscreenElement) {
        setProctorWarning('Interview terminated: left fullscreen.');
        setTerminatedByFullscreen(true);
        if (wsRef.current) {
          try { wsRef.current.close(1000, 'Left fullscreen'); } catch {}
        }
  // Stop WebGazer when exiting fullscreen
  try { stopWebGazer(); } catch {}
  if (screenshotIntervalRef.current) { clearInterval(screenshotIntervalRef.current); screenshotIntervalRef.current = null; }
        setIsInterviewActive(false);
      } else {
        setProctorWarning(null);
      }
    };
    document.addEventListener('visibilitychange', visHandler);
    document.addEventListener('fullscreenchange', fsHandler);
    window.addEventListener('blur', visHandler);
    return () => {
      document.removeEventListener('visibilitychange', visHandler);
      document.removeEventListener('fullscreenchange', fsHandler);
      window.removeEventListener('blur', visHandler);
    };
  }, [isInterviewActive]);

  const restartInterview = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      setTerminatedByFullscreen(false);
      setIsInterviewEnded(false);
      setTimeLeft(10 * 60);
      connectWebSocket();
      setIsInterviewActive(true);
    } catch {}
  };

  // Format timer mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

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
            {terminatedByFullscreen && (
              <Card className="mb-4 border-red-300 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-red-700">Interview terminated</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-red-700">You exited fullscreen. The session was terminated. You can restart the interview now.</p>
                  <Button onClick={restartInterview} className="bg-red-600 hover:bg-red-700">Restart Interview</Button>
                </CardContent>
              </Card>
            )}
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
                  <div className="flex gap-2 items-center">
                    {/* Timer badge */}
                    {isInterviewActive && !isInterviewEnded && (
                      <Badge variant="outline" className="text-lg px-3 py-1 bg-white border-gray-300 text-gray-900">
                        ⏰ {formatTime(timeLeft)}
                      </Badge>
                    )}
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
                      <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                      {!isCameraEnabled && (
                        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                          <CameraOff className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      {isInterviewActive && (
                        <div className={`absolute top-2 left-2 right-2 mx-auto w-fit px-3 py-1 rounded-md text-xs font-medium ${faceStatus === 'ok' ? 'bg-black/60 text-white' : faceStatus === 'none' ? 'bg-yellow-500 text-white' : 'bg-red-600 text-white'}`}>
                          {faceStatus === 'ok' ? (
                            // Show calibration status or detection status
                            (!faceBaselineRef.current || faceBaselineRef.current.samples < 30) ? 
                            'Calibrating detection system...' :
                            (gazeOff ? 'Please keep your eyes on the screen.' : (detectorInfo || 'Detector active'))
                          ) : faceStatus === 'none' ? 'No face detected. Please position your face in view.' : 'Multiple faces detected. Only one person should be visible.'}
                        </div>
                      )}
                      {eyesClosed && isInterviewActive && (
                        <div className="absolute top-12 left-2 right-2 mx-auto w-fit px-3 py-1 rounded-md text-xs font-medium bg-fuchsia-600 text-white">
                          Your eyes appear closed. Please stay attentive.
                        </div>
                      )}
                      {proctorWarning && isInterviewActive && (
                        <div className="absolute bottom-2 left-2 right-2 mx-auto w-fit px-3 py-1 rounded-md text-xs font-medium bg-orange-500 text-white">
                          {proctorWarning}
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

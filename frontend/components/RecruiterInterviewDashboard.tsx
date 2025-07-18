'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Eye, 
  Download, 
  Star,
  Clock,
  CheckCircle,
  XCircle,
  Video,
  Camera,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';

interface InterviewResult {
  id: string;
  scheduledAt: string;
  actualStartedAt?: string;
  endedAt?: string;
  isActive: boolean;
  aiSummary?: string;
  strengths?: string;
  weaknesses?: string;
  overallRating?: number;
  application: {
    id: string;
    candidate: {
      user: {
        email: string;
      };
    };
    job: {
      title: string;
    };
  };
  score?: {
    communicationScore: number;
    technicalScore: number;
    problemSolvingScore: number;
    culturalFitScore: number;
    totalScore: number;
  };
  recordings: Array<{
    id: string;
    videoUrl?: string;
    audioUrl?: string;
    recordingType: string;
  }>;
  screenshots: Array<{
    id: string;
    imageUrl: string;
    takenAt: string;
  }>;
}

export default function RecruiterInterviewDashboard() {
  const [interviews, setInterviews] = useState<InterviewResult[]>([]);
  const [stats, setStats] = useState({
    totalInterviews: 0,
    completedInterviews: 0,
    averageScore: 0,
    pendingInterviews: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<InterviewResult | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    fetchInterviewData();
  }, []);

  const fetchInterviewData = async () => {
    try {
      const token = await getToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

      // Fetch recruiter applications with interview data
      const response = await fetch(`${backendUrl}/api/users/recruiter/applications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch interview data');
      }

      const applications = await response.json();
      
      // Filter applications that have interviews
      const interviewData = applications
        .filter((app: any) => app.interview)
        .map((app: any) => ({
          ...app.interview,
          application: {
            id: app.id,
            candidate: app.candidate,
            job: app.job
          }
        }));

      setInterviews(interviewData);

      // Calculate stats
      const completed = interviewData.filter((i: InterviewResult) => i.endedAt).length;
      const pending = interviewData.filter((i: InterviewResult) => !i.endedAt && i.scheduledAt).length;
      const scores = interviewData
        .filter((i: InterviewResult) => i.score?.totalScore)
        .map((i: InterviewResult) => i.score!.totalScore);
      const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

      setStats({
        totalInterviews: interviewData.length,
        completedInterviews: completed,
        averageScore: avgScore,
        pendingInterviews: pending
      });
    } catch (error) {
      console.error('Error fetching interview data:', error);
      toast.error('Failed to load interview data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (interview: InterviewResult) => {
    if (interview.endedAt) {
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    } else if (interview.isActive) {
      return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
    } else if (new Date(interview.scheduledAt) > new Date()) {
      return <Badge className="bg-yellow-100 text-yellow-800">Scheduled</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">Missed</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const downloadRecording = async (recording: any) => {
    try {
      const link = document.createElement('a');
      link.href = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}${recording.videoUrl || recording.audioUrl}`;
      link.download = `interview-recording-${recording.id}.webm`;
      link.click();
    } catch (error) {
      toast.error('Failed to download recording');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-300 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interview Analytics</h1>
          <p className="text-gray-600">Monitor and analyze candidate interviews</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Interviews</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalInterviews}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedInterviews}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.averageScore.toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingInterviews}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Interview Results */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Interview List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Interviews</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {interviews.map((interview) => (
                      <Card 
                        key={interview.id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedInterview?.id === interview.id ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => setSelectedInterview(interview)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <h3 className="font-semibold">{interview.application.job.title}</h3>
                              <p className="text-sm text-gray-600">
                                {interview.application.candidate.user.email}
                              </p>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-500">
                                  {new Date(interview.scheduledAt).toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {getStatusBadge(interview)}
                              {interview.score && (
                                <div className="text-right">
                                  <div className={`text-lg font-bold ${getScoreColor(interview.score.totalScore)}`}>
                                    {interview.score.totalScore.toFixed(1)}/10
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Interview Details */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Interview Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedInterview ? (
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="scores">Scores</TabsTrigger>
                      <TabsTrigger value="media">Media</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Candidate</h4>
                        <p className="text-sm text-gray-600">
                          {selectedInterview.application.candidate.user.email}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Position</h4>
                        <p className="text-sm text-gray-600">
                          {selectedInterview.application.job.title}
                        </p>
                      </div>

                      {selectedInterview.aiSummary && (
                        <div>
                          <h4 className="font-semibold mb-2">AI Summary</h4>
                          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                            {selectedInterview.aiSummary}
                          </p>
                        </div>
                      )}

                      {selectedInterview.strengths && (
                        <div>
                          <h4 className="font-semibold mb-2 text-green-700">Strengths</h4>
                          <p className="text-sm text-gray-600">
                            {selectedInterview.strengths}
                          </p>
                        </div>
                      )}

                      {selectedInterview.weaknesses && (
                        <div>
                          <h4 className="font-semibold mb-2 text-red-700">Areas for Improvement</h4>
                          <p className="text-sm text-gray-600">
                            {selectedInterview.weaknesses}
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="scores" className="space-y-4">
                      {selectedInterview.score ? (
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Communication</span>
                              <span>{selectedInterview.score.communicationScore}/10</span>
                            </div>
                            <Progress value={selectedInterview.score.communicationScore * 10} />
                          </div>

                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Technical Skills</span>
                              <span>{selectedInterview.score.technicalScore}/10</span>
                            </div>
                            <Progress value={selectedInterview.score.technicalScore * 10} />
                          </div>

                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Problem Solving</span>
                              <span>{selectedInterview.score.problemSolvingScore}/10</span>
                            </div>
                            <Progress value={selectedInterview.score.problemSolvingScore * 10} />
                          </div>

                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Cultural Fit</span>
                              <span>{selectedInterview.score.culturalFitScore}/10</span>
                            </div>
                            <Progress value={selectedInterview.score.culturalFitScore * 10} />
                          </div>

                          <div className="pt-2 border-t">
                            <div className="flex justify-between font-semibold">
                              <span>Overall Score</span>
                              <span className={getScoreColor(selectedInterview.score.totalScore)}>
                                {selectedInterview.score.totalScore.toFixed(1)}/10
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">
                          No scores available yet
                        </p>
                      )}
                    </TabsContent>

                    <TabsContent value="media" className="space-y-4">
                      {/* Recordings */}
                      {selectedInterview.recordings.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center">
                            <Video className="h-4 w-4 mr-2" />
                            Recordings ({selectedInterview.recordings.length})
                          </h4>
                          <div className="space-y-2">
                            {selectedInterview.recordings.map((recording) => (
                              <div key={recording.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="text-sm">{recording.recordingType} Recording</span>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => downloadRecording(recording)}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Download
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Screenshots */}
                      {selectedInterview.screenshots.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center">
                            <Camera className="h-4 w-4 mr-2" />
                            Screenshots ({selectedInterview.screenshots.length})
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {selectedInterview.screenshots.slice(0, 4).map((screenshot) => (
                              <div key={screenshot.id} className="relative">
                                <img
                                  src={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}${screenshot.imageUrl}`}
                                  alt="Screenshot"
                                  className="w-full h-20 object-cover rounded"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                                  {new Date(screenshot.takenAt).toLocaleTimeString()}
                                </div>
                              </div>
                            ))}
                          </div>
                          {selectedInterview.screenshots.length > 4 && (
                            <p className="text-sm text-gray-500 text-center mt-2">
                              +{selectedInterview.screenshots.length - 4} more screenshots
                            </p>
                          )}
                        </div>
                      )}

                      {selectedInterview.recordings.length === 0 && selectedInterview.screenshots.length === 0 && (
                        <p className="text-gray-500 text-center py-8">
                          No media files available
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Select an interview to view details
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

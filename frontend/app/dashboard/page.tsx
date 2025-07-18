"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Users, Briefcase, Eye, Calendar, MapPin, BarChart3, Trash2, Edit, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import RecruiterInterviewDashboard from "@/components/RecruiterInterviewDashboard";

interface Job {
  id: string;
  title: string;
  location: string;
  type: string;
  createdAt: string;
  applicantsCount: number;
  interviewsCount: number;
  shortlistedCount: number;
}

interface DashboardStats {
  totalJobs: number;
  totalApplications: number;
  pendingApplications: number;
  scheduledInterviews: number;
}

export default function RecruiterDashboard() {
  const router = useRouter();
  const { getToken } = useAuth();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    totalApplications: 0,
    pendingApplications: 0,
    scheduledInterviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobApplications, setJobApplications] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetchDashboardData();
    fetchAITemplates();
  }, []);

  const fetchAITemplates = async () => {
    try {
      setTemplatesLoading(true);
      const token = await getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/ai-templates`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI templates');
      }

      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching AI templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleteLoading(jobId);
      const token = await getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Check if response is JSON or HTML
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete job');
        } else {
          // If it's HTML, it's likely a server error page
          const errorText = await response.text();
          console.error('Server returned HTML error:', errorText);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      // Remove job from state
      setJobs(jobs.filter(job => job.id !== jobId));
      
      // Show success message
      alert('Job deleted successfully');
    } catch (error) {
      console.error('Error deleting job:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete job');
    } finally {
      setDeleteLoading(null);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      
      // Fetch jobs and stats in parallel
      const [jobsRes, statsRes] = await Promise.all([
        fetch(`${backendUrl}/api/users/my-jobs`, {
          headers: { "Authorization": `Bearer ${token}` },
        }),
        fetch(`${backendUrl}/api/users/recruiter-stats`, {
          headers: { "Authorization": `Bearer ${token}` },
        }),
      ]);

      if (!jobsRes.ok) {
        throw new Error("Failed to fetch jobs");
      }
      if (!statsRes.ok) {
        throw new Error("Failed to fetch stats");
      }

      const jobsData = await jobsRes.json();
      const statsData = await statsRes.json();

      setJobs(jobsData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getJobTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "full-time":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "part-time":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "contract":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "internship":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 flex items-center justify-center dark:bg-gray-900">
        <Card className="w-full max-w-md text-center shadow-lg bg-white dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Loading Dashboard...
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 flex items-center justify-center dark:bg-gray-900">
        <Card className="w-full max-w-md text-center shadow-lg bg-white dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-red-600 dark:text-red-400">
              Error Loading Dashboard
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchDashboardData} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Recruiter Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your job postings and track applications
            </p>
          </div>
          <Button
            onClick={() => router.push("/recruiter/create-job")}
            className="bg-black hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-black dark:hover:bg-gray-200"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Create New Job
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Jobs
              </CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalJobs}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Applications
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalApplications}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Pending Reviews
              </CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {stats.pendingApplications}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Interviews Scheduled
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.scheduledInterviews}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Job Management
            </TabsTrigger>
            <TabsTrigger value="ai-settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              AI Settings
            </TabsTrigger>
            <TabsTrigger value="interviews" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Interview Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            {/* Jobs Table */}
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Your Job Postings
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Manage and track your active job listings
                </CardDescription>
            </CardHeader>
            <CardContent>
            {jobs.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No jobs posted yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Start by creating your first job posting to attract candidates.
                </p>
                <Button
                  onClick={() => router.push("/recruiter/create-job")}
                  className="bg-black hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-black dark:hover:bg-gray-200"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Your First Job
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-gray-600 dark:text-gray-400">Job Title</TableHead>
                      <TableHead className="text-gray-600 dark:text-gray-400">Location</TableHead>
                      <TableHead className="text-gray-600 dark:text-gray-400">Type</TableHead>
                      <TableHead className="text-gray-600 dark:text-gray-400">Applications</TableHead>
                      <TableHead className="text-gray-600 dark:text-gray-400">Posted</TableHead>
                      <TableHead className="text-gray-600 dark:text-gray-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                          {job.title}
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {job.location}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getJobTypeColor(job.type)}>
                            {job.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            {job._count?.applications ?? 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          {formatDate(job.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => router.push(`/recruiter/jobs/${job.id}`)}
                              size="sm"
                              variant="outline"
                              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              onClick={() => router.push(`/recruiter/jobs/${job.id}/edit`)}
                              size="sm"
                              variant="outline"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => deleteJob(job.id)}
                              disabled={deleteLoading === job.id}
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              {deleteLoading === job.id ? 'Deleting...' : 'Delete'}
                          </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            </CardContent>
          </Card>
      </TabsContent>

      <TabsContent value="ai-settings">
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              AI Interview Templates
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Configure custom AI interview contexts and questions for your jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <div className="text-center py-8">Loading templates...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {templates.map((template: any) => (
                  <Card key={template.id} className="border border-gray-200 dark:border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {template.name}
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Context:</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{template.context}</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Sample Questions:</h4>
                          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {template.questions.slice(0, 2).map((question: string, index: number) => (
                              <li key={index} className="flex items-start">
                                <span className="mr-2">•</span>
                                {question}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Button
                          onClick={() => router.push(`/recruiter/create-job?template=${template.id}`)}
                          size="sm"
                          className="w-full"
                        >
                          Use This Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="interviews">
        <RecruiterInterviewDashboard />
      </TabsContent>
    </Tabs>
      </div>
    </div>
);
}

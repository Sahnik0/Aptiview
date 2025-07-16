"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Briefcase, FileText, Clock, CheckCircle } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { Metadata } from "next"
import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react"

export default function CandidateDashboardPage() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const checkRole = async () => {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${backendUrl}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const dbUser = await res.json();
      if (dbUser.role !== "CANDIDATE") {
        if (dbUser.role === "RECRUITER") {
          router.replace("/dashboard");
        } else {
          router.replace("/role-selection");
        }
      }
    };
    checkRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoaded, getToken, router]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const [appsRes, jobsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/applications`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          }),
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/jobs`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          }),
        ]);
        if (!appsRes.ok || !jobsRes.ok) throw new Error("Failed to fetch data");
        const [apps, jobs] = await Promise.all([appsRes.json(), jobsRes.json()]);
        setMyApplications(apps);
        setAvailableJobs(jobs);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;
  }

  // Map backend data to UI fields
  const mappedApplications = myApplications.map((app) => ({
    id: app.id,
    jobTitle: app.job?.title || "",
    company: app.job?.recruiter?.company || "",
    status: app.status?.replace(/_/g, " ") || "",
    date: app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "",
    location: app.job?.location || "",
    type: app.job?.type || "",
  }));
  const mappedJobs = availableJobs.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.recruiter?.company || "",
    location: job.location || "",
    type: job.type || "",
  }));

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 sm:mb-8">Candidate Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Applications</CardTitle>
              <FileText className="h-5 w-5 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-bold text-gray-900">3</div>
              <p className="text-xs text-gray-500">+1 new this week</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Interviews Scheduled</CardTitle>
              <Clock className="h-5 w-5 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-bold text-gray-900">1</div>
              <p className="text-xs text-gray-500">Next interview: July 20</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Profile Completion</CardTitle>
              <CheckCircle className="h-5 w-5 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-bold text-gray-900">85%</div>
              <p className="text-xs text-gray-500">Complete your profile for better matches</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <CardTitle className="text-xl font-bold text-gray-900">My Applications</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="bg-transparent border-gray-300 hover:bg-gray-50 w-full sm:w-auto"
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Job Title</TableHead>
                      <TableHead className="min-w-[100px]">Company</TableHead>
                      <TableHead className="min-w-[120px]">Status</TableHead>
                      <TableHead className="min-w-[100px]">Date Applied</TableHead>
                      <TableHead className="min-w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedApplications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium text-gray-800">{app.jobTitle}</TableCell>
                        <TableCell className="text-gray-700">{app.company}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`capitalize ${app.status === "Interview Scheduled" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-700 border-gray-200"}`}
                          >
                            {app.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-700">{app.date}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-gray-700 hover:bg-gray-100">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <CardTitle className="text-xl font-bold text-gray-900">Available Jobs</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="bg-transparent border-gray-300 hover:bg-gray-50 w-full sm:w-auto"
              >
                Browse All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Job Title</TableHead>
                      <TableHead className="min-w-[100px]">Company</TableHead>
                      <TableHead className="min-w-[120px]">Location</TableHead>
                      <TableHead className="min-w-[80px]">Type</TableHead>
                      <TableHead className="min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium text-gray-800">{job.title}</TableCell>
                        <TableCell className="text-gray-700">{job.company}</TableCell>
                        <TableCell className="text-gray-700">{job.location}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                            {job.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="bg-transparent border-gray-300 hover:bg-gray-50"
                            >
                              <Link href={`/candidate/jobs/${job.id}`}>View</Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="bg-black text-white hover:bg-gray-800"
                            >
                              <Link href={`/candidate/apply?jobId=${job.id}&jobTitle=${encodeURIComponent(job.title)}`}>
                                Apply
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900">Interview Preparation Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200 p-4 text-center">
              <Briefcase className="h-16 w-16 text-gray-300 mb-4" />
              <span className="text-lg font-medium">Resources to help you ace your AI interviews will be here.</span>
              <p className="text-sm text-gray-400 mt-2">Check back soon for guides and practice questions!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

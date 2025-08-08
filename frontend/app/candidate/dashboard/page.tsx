"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, FileText, Clock, CheckCircle, Search, ArrowRight, MapPin, Building2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function CandidateDashboardPage() {
  // Auth & routing hooks
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Local state hooks
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [myInterviews, setMyInterviews] = useState<any[]>([]);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [appFilter, setAppFilter] = useState<"ALL" | "PENDING" | "INTERVIEW" | "COMPLETED" | "REJECTED">("ALL");

  // Effects
  useEffect(() => {
    if (!isLoaded || !user) return;
    const checkRole = async () => {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${backendUrl}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const dbUser = await res.json();
      if (dbUser.role !== "CANDIDATE") {
        router.replace(dbUser.role === "RECRUITER" ? "/dashboard" : "/role-selection");
      }
    };
    checkRole();
  }, [user, isLoaded, getToken, router]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const [appsRes, jobsRes, interviewsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/applications`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          }),
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/jobs`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          }),
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/my-interviews`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          }),
        ]);
        if (!appsRes.ok || !jobsRes.ok) throw new Error("Failed to fetch data");
        const [apps, jobs, interviews] = await Promise.all([
          appsRes.json(),
          jobsRes.json(),
          interviewsRes.ok ? interviewsRes.json() : [],
        ]);
        setMyApplications(apps);
        setAvailableJobs(jobs);
        setMyInterviews(interviews);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getToken]);

  // Derived data (ALWAYS before any early returns to keep hooks order stable)
  const mappedApplications = myApplications.map((app) => {
    const interview = myInterviews.find((iv) => iv.application.id === app.id);
    return {
      id: app.id,
      jobId: app.jobId,
      jobTitle: app.job?.title || "",
      company: app.job?.recruiter?.company || "",
      status: app.status?.replace(/_/g, " ") || "",
      date: app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "",
      location: app.job?.location || "",
      type: app.job?.type || "",
      interview: interview
        ? {
            id: interview.id,
            uniqueLink: interview.uniqueLink,
            scheduledAt: interview.scheduledAt,
            isCompleted: !!interview.endedAt,
            canJoin:
              !interview.endedAt &&
              new Date(interview.scheduledAt) <= new Date(Date.now() + 60 * 60 * 1000),
          }
        : null,
    };
  });
  const appliedJobIds = new Set(mappedApplications.map((a) => a.jobId));
  const mappedJobs = availableJobs.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.recruiter?.company || "",
    location: job.location || "",
    type: job.type || "",
    alreadyApplied: appliedJobIds.has(job.id),
  }));

  const filteredApplications = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = mappedApplications;
    if (appFilter !== "ALL") {
      if (appFilter === "PENDING") list = list.filter((a) => a.status.includes("PENDING"));
      if (appFilter === "INTERVIEW") list = list.filter((a) => a.status.includes("INTERVIEW"));
      if (appFilter === "COMPLETED") list = list.filter((a) => a.interview?.isCompleted);
      if (appFilter === "REJECTED") list = list.filter((a) => a.status.includes("REJECTED"));
    }
    if (!q) return list;
    return list.filter(
      (a) =>
        a.jobTitle.toLowerCase().includes(q) ||
        a.company.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
    );
  }, [mappedApplications, appFilter, query]);

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mappedJobs;
    return mappedJobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.type.toLowerCase().includes(q)
    );
  }, [mappedJobs, query]);

  const upcomingInterviews = myInterviews.filter((i: any) => !i.endedAt).length;

  // Early returns AFTER derived hooks to keep order stable
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-56 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-40 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Premium Hero */}
        <div className="relative overflow-hidden rounded-2xl mb-8 border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-rose-50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
          <div className="relative p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">Welcome back{user?.firstName ? `, ${user.firstName}` : ""}</h1>
                <p className="text-sm text-gray-600 mt-2">Manage applications, interviews, and discover roles tailored to you.</p>
              </div>
              <div className="relative w-full lg:w-[360px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search jobs or applications"
                  className="pl-9 h-10 rounded-xl border-gray-200 bg-white/70 backdrop-blur-md"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/60 bg-white/60 backdrop-blur-md p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Total Applications</span>
                  <FileText className="h-4 w-4 text-gray-500" />
                </div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{myApplications.length}</div>
                <p className="text-xs text-gray-500">Submitted</p>
              </div>
              <div className="rounded-xl border border-white/60 bg-white/60 backdrop-blur-md p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Interviews</span>
                  <Clock className="h-4 w-4 text-gray-500" />
                </div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{upcomingInterviews}</div>
                <p className="text-xs text-gray-500">Upcoming</p>
              </div>
              <div className="rounded-xl border border-white/60 bg-white/60 backdrop-blur-md p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Open Roles</span>
                  <CheckCircle className="h-4 w-4 text-gray-500" />
                </div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{availableJobs.length}</div>
                <p className="text-xs text-gray-500">Available</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Applications */}
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <CardTitle className="text-xl font-semibold text-gray-900">My Applications</CardTitle>
              <Tabs value={appFilter} defaultValue="ALL" onValueChange={(v) => setAppFilter(v as any)} className="w-full sm:w-auto">
                <TabsList className="grid grid-cols-5 w-full sm:w-auto">
                  <TabsTrigger value="ALL">All</TabsTrigger>
                  <TabsTrigger value="PENDING">Pending</TabsTrigger>
                  <TabsTrigger value="INTERVIEW">Interview</TabsTrigger>
                  <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
                  <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {filteredApplications.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500">
                  No applications match your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredApplications.map((app) => (
                    <div key={app.id} className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 leading-6">{app.jobTitle}</h3>
                          <p className="text-sm text-gray-600 flex items-center gap-1"><Building2 className="h-4 w-4" /> {app.company || "—"}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            app.status === "Interview Scheduled"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          )}
                        >
                          {app.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-200">Applied: {app.date}</span>
                        {app.location && <span className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {app.location}</span>}
                        {app.type && <span className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-200">{app.type}</span>}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        {app.interview ? (
                          <div className="text-xs text-gray-600">
                            {new Date(app.interview.scheduledAt).toLocaleDateString()} at{" "}
                            {new Date(app.interview.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No interview scheduled</span>
                        )}
                        <div className="flex gap-2">
                          {app.interview && (
                            app.interview.isCompleted ? (
                              <Badge variant="secondary" className="text-xs">Completed</Badge>
                            ) : app.interview.canJoin ? (
                              <Link href={`/interview/${app.interview.uniqueLink}`}>
                                <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700">Join</Button>
                              </Link>
                            ) : (
                              <Badge variant="outline" className="text-xs">Scheduled</Badge>
                            )
                          )}
                          <Button variant="ghost" size="sm" className="h-8 text-xs">View</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Jobs */}
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <CardTitle className="text-xl font-semibold text-gray-900">Available Jobs</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <Link href="/candidate/jobs">
                  <Button size="sm" variant="default" className="w-full sm:w-auto">
                    Browse All <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {filteredJobs.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500">
                  No jobs found. Try adjusting your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredJobs.slice(0, 8).map((job) => (
                    <div key={job.id} className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 leading-6">{job.title}</h3>
                          <p className="text-sm text-gray-600 flex items-center gap-1"><Building2 className="h-4 w-4" /> {job.company || "—"}</p>
                        </div>
                        {job.alreadyApplied ? (
                          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">Applied</Badge>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        {job.location && <span className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>}
                        {job.type && <span className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-200">{job.type}</span>}
                      </div>
                      <div className="mt-4 flex items-center justify-end">
                        {job.alreadyApplied ? (
                          <Button disabled className="h-8 text-xs bg-gray-300 cursor-not-allowed">Already Applied</Button>
                        ) : (
                          <Link href={`/candidate/apply?jobId=${job.id}&jobTitle=${encodeURIComponent(job.title)}`}>
                            <Button className="h-8 text-xs">Apply</Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900">Interview Preparation Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex flex-col items-center justify-center text-gray-600 bg-gray-50 rounded-lg border border-dashed border-gray-200 p-4 text-center">
              <Briefcase className="h-14 w-14 text-gray-300 mb-3" />
              <span className="text-base font-medium">Resources to help you prepare will appear here.</span>
              <p className="text-xs text-gray-400 mt-1">Guides and practice questions coming soon.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

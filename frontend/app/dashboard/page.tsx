import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, BarChart3, Users, Briefcase, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recruiter Dashboard",
  description: "Manage your job postings, applicants, and interviews with the Talent AI recruiter dashboard.",
  keywords: ["recruiter dashboard", "job postings", "applicant tracking", "interview management"],
}

export default function DashboardPage() {
  const jobPostings = [
    { id: "JP001", title: "Senior Software Engineer", applicants: 120, interviews: 85, status: "Active" },
    { id: "JP002", title: "Product Manager", applicants: 75, interviews: 50, status: "Active" },
    { id: "JP003", title: "UX Designer", applicants: 90, interviews: 65, status: "Closed" },
    { id: "JP004", title: "Data Scientist", applicants: 150, interviews: 100, status: "Active" },
  ]

  const topCandidates = [
    { id: "C001", name: "Alice Johnson", score: 92, role: "Senior Software Engineer" },
    { id: "C002", name: "Bob Williams", score: 88, role: "Product Manager" },
    { id: "C003", name: "Charlie Brown", score: 85, role: "UX Designer" },
    { id: "C004", name: "Diana Miller", score: 90, role: "Data Scientist" },
  ]

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 sm:mb-8">Recruiter Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Job Postings</CardTitle>
              <Briefcase className="h-5 w-5 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-bold text-gray-900">4</div>
              <p className="text-xs text-gray-500">+1 new this week</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Applicants</CardTitle>
              <Users className="h-5 w-5 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-bold text-gray-900">365</div>
              <p className="text-xs text-gray-500">+25 today</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Interviews Completed</CardTitle>
              <Clock className="h-5 w-5 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-bold text-gray-900">250</div>
              <p className="text-xs text-gray-500">+15 today</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <CardTitle className="text-xl font-bold text-gray-900">Your Job Postings</CardTitle>
              <Button size="sm" className="bg-black hover:bg-gray-800 w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" /> Post New Job
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[80px]">Job ID</TableHead>
                      <TableHead className="min-w-[150px]">Title</TableHead>
                      <TableHead className="min-w-[100px]">Applicants</TableHead>
                      <TableHead className="min-w-[100px]">Interviews</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobPostings.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium text-gray-800">{job.id}</TableCell>
                        <TableCell className="text-gray-700">{job.title}</TableCell>
                        <TableCell className="text-gray-700">{job.applicants}</TableCell>
                        <TableCell className="text-gray-700">{job.interviews}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`capitalize ${job.status === "Active" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}
                          >
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-gray-700 hover:bg-gray-100">
                            View
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
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-900">Top Ranked Candidates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[60px]">Rank</TableHead>
                      <TableHead className="min-w-[120px]">Name</TableHead>
                      <TableHead className="min-w-[80px]">Score</TableHead>
                      <TableHead className="min-w-[120px]">Role</TableHead>
                      <TableHead className="min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCandidates.map((candidate, index) => (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium text-gray-800">{index + 1}</TableCell>
                        <TableCell className="text-gray-700">{candidate.name}</TableCell>
                        <TableCell className="text-gray-700">{candidate.score}%</TableCell>
                        <TableCell className="text-gray-700">{candidate.role}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-gray-700 hover:bg-gray-100">
                            View Report
                          </Button>
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
            <CardTitle className="text-xl font-bold text-gray-900">Interview Analytics Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200 p-4 text-center">
              <BarChart3 className="h-16 w-16 text-gray-300 mb-4" />
              <span className="text-lg font-medium">Detailed analytics charts will appear here.</span>
              <p className="text-sm text-gray-400 mt-2">Connect your data sources to unlock insights.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

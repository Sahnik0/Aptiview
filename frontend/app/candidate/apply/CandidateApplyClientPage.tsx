"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Video } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from "react-markdown" // Import ReactMarkdown
import remarkGfm from "remark-gfm" // Import remarkGfm for GitHub Flavored Markdown

interface CandidateApplyClientPageProps {
  job?: {
    id: string
    title: string
    company: string
    location: string
    type: string
    description: string
  }
  initialJobTitle?: string
}

export default function CandidateApplyClientPage({ job, initialJobTitle }: CandidateApplyClientPageProps) {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    linkedin: "",
    portfolio: "",
    jobRole: initialJobTitle || job?.title || "",
    cvFile: null as File | null,
    coverLetter: "",
  })
  const router = useRouter()

  useEffect(() => {
    if (job) {
      setFormData((prev) => ({ ...prev, jobRole: job.title }))
    } else if (initialJobTitle) {
      setFormData((prev) => ({ ...prev, jobRole: initialJobTitle }))
    }
  }, [job, initialJobTitle])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData((prev) => ({ ...prev, cvFile: e.target.files[0] }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, you'd send data to a backend here
    console.log("Application Submitted:", { ...formData, jobId: job?.id })
    setIsSubmitted(true)
    // Simulate a delay for submission
    setTimeout(() => {
      router.push("/candidate/dashboard") // Redirect to candidate dashboard
    }, 2000)
  }

  const displayJobTitle = formData.jobRole || "a Job"

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 flex items-center justify-center dark:bg-gray-900">
        <Card className="w-full max-w-md text-center shadow-lg bg-white dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Application Submitted!
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Your application for the <span className="font-semibold">{displayJobTitle}</span> role is complete.
              Prepare for your AI interview!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button className="w-full bg-black hover:bg-gray-800 text-lg py-6 dark:bg-gray-100 dark:text-black dark:hover:bg-gray-200">
              <Video className="h-5 w-5 mr-2" /> Start AI Interview Now (Simulated)
            </Button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              (Note: This button will lead to a simulated interview demo for now.)
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 flex items-center justify-center dark:bg-gray-900">
      <Card className="w-full max-w-5xl shadow-lg bg-white dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Apply for {displayJobTitle}
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Fill out the form below to submit your application.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col lg:flex-row gap-8">
          {/* Left Column: Job Description */}
          <div className="flex-1 lg:max-w-[50%] lg:border-r lg:pr-8 lg:py-2 dark:lg:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 mb-4 dark:text-gray-100">Job Description</h3>
            {job ? (
              <ScrollArea className="h-[600px] pr-4">
                <ReactMarkdown
                  className="prose max-w-none text-gray-700 leading-relaxed dark:text-gray-300 dark:prose-invert"
                  remarkPlugins={[remarkGfm]}
                >
                  {job.description}
                </ReactMarkdown>
              </ScrollArea>
            ) : (
              <div className="h-[600px] flex items-center justify-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200 p-4 text-center dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400">
                <p>No job description available. Please select a job from the dashboard or provide a job title.</p>
              </div>
            )}
          </div>

          {/* Right Column: Application Form */}
          <div className="flex-1 lg:max-w-[50%] lg:pl-8 lg:py-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="fullName" className="text-gray-700 dark:text-gray-300">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                  className="border-gray-300 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="john.doe@example.com"
                  className="border-gray-300 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-gray-700 dark:text-gray-300">
                  Phone Number (Optional)
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                  className="border-gray-300 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                />
              </div>
              <div>
                <Label htmlFor="linkedin" className="text-gray-700 dark:text-gray-300">
                  LinkedIn Profile URL (Optional)
                </Label>
                <Input
                  id="linkedin"
                  name="linkedin"
                  type="url"
                  value={formData.linkedin}
                  onChange={handleChange}
                  placeholder="https://linkedin.com/in/johndoe"
                  className="border-gray-300 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                />
              </div>
              <div>
                <Label htmlFor="portfolio" className="text-gray-700 dark:text-gray-300">
                  Portfolio/Website URL (Optional)
                </Label>
                <Input
                  id="portfolio"
                  name="portfolio"
                  type="url"
                  value={formData.portfolio}
                  onChange={handleChange}
                  placeholder="https://johndoe.com"
                  className="border-gray-300 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                />
              </div>
              <div>
                <Label htmlFor="jobRole" className="text-gray-700 dark:text-gray-300">
                  Applying For
                </Label>
                <Input
                  id="jobRole"
                  name="jobRole"
                  value={formData.jobRole}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Senior Software Engineer"
                  readOnly={!!job || !!initialJobTitle} // Make read-only if pre-filled
                  className="border-gray-300 focus-visible:ring-gray-400 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                />
              </div>
              <div>
                <Label htmlFor="cvFile" className="text-gray-700 dark:text-gray-300">
                  Upload CV (PDF, DOCX)
                </Label>
                <Input
                  id="cvFile"
                  name="cvFile"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  required
                  className="border-gray-300 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                />
                {formData.cvFile && (
                  <p className="text-sm text-gray-500 mt-2 dark:text-gray-400">Selected file: {formData.cvFile.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="coverLetter" className="text-gray-700 dark:text-gray-300">
                  Cover Letter (Optional)
                </Label>
                <Textarea
                  id="coverLetter"
                  name="coverLetter"
                  value={formData.coverLetter}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Tell us about your experience and why you're a great fit..."
                  className="border-gray-300 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-black hover:bg-gray-800 text-lg py-6 dark:bg-gray-100 dark:text-black dark:hover:bg-gray-200"
              >
                Submit Application
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

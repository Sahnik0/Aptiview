"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"

export default function CandidateProfileSetupClientPage() {
  const [education, setEducation] = useState("")
  const [workExperience, setWorkExperience] = useState("")
  const [skills, setSkills] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real application, you would send this data to your backend
    console.log("Candidate Profile Submitted:", { education, workExperience, skills })
    setIsSubmitted(true)
    setTimeout(() => {
      router.push("/candidate/dashboard") // Redirect to candidate dashboard
    }, 2000) // Simulate a delay for submission
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 flex items-center justify-center">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-3xl font-bold text-gray-900">Profile Created!</CardTitle>
            <CardDescription className="text-gray-600">Redirecting you to your dashboard...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900">Candidate Profile Setup</CardTitle>
          <CardDescription className="text-gray-600">
            Build your profile to showcase your qualifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="education" className="text-gray-700">
                Education (e.g., University, Degree, Year)
              </Label>
              <Input
                id="education"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="B.S. Computer Science, 2022"
                className="border-gray-300 focus-visible:ring-gray-400"
              />
            </div>
            <div>
              <Label htmlFor="workExperience" className="text-gray-700">
                Work Experience (Summarize key roles and companies)
              </Label>
              <Textarea
                id="workExperience"
                value={workExperience}
                onChange={(e) => setWorkExperience(e.target.value)}
                rows={4}
                placeholder="Software Engineer at TechCorp (2022-Present), developed scalable APIs..."
                className="border-gray-300 focus-visible:ring-gray-400"
              />
            </div>
            <div>
              <Label htmlFor="skills" className="text-gray-700">
                Skills (Comma-separated, e.g., JavaScript, React, Node.js)
              </Label>
              <Input
                id="skills"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="JavaScript, React, Node.js, AWS"
                className="border-gray-300 focus-visible:ring-gray-400"
              />
            </div>
            <Button type="submit" className="w-full bg-black hover:bg-gray-800 text-lg py-6">
              Save Profile & Go to Dashboard
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

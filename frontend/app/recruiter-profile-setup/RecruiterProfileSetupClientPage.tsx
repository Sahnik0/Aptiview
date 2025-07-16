"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle } from "lucide-react"

export default function RecruiterProfileSetupClientPage() {
  const [companyName, setCompanyName] = useState("")
  const [industry, setIndustry] = useState("")
  const [companySize, setCompanySize] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real application, you would send this data to your backend
    console.log("Recruiter Profile Submitted:", { companyName, industry, companySize, contactNumber })
    setIsSubmitted(true)
    setTimeout(() => {
      router.push("/dashboard") // Redirect to recruiter dashboard
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
          <CardTitle className="text-3xl font-bold text-gray-900">Recruiter Profile Setup</CardTitle>
          <CardDescription className="text-gray-600">Tell us about your company to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="companyName" className="text-gray-700">
                Company Name
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                placeholder="Acme Corp."
                className="border-gray-300 focus-visible:ring-gray-400"
              />
            </div>
            <div>
              <Label htmlFor="industry" className="text-gray-700">
                Industry
              </Label>
              <Select value={industry} onValueChange={setIndustry} required>
                <SelectTrigger id="industry" className="border-gray-300 focus-visible:ring-gray-400">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="companySize" className="text-gray-700">
                Company Size
              </Label>
              <Select value={companySize} onValueChange={setCompanySize} required>
                <SelectTrigger id="companySize" className="border-gray-300 focus-visible:ring-gray-400">
                  <SelectValue placeholder="Select company size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-1000">201-1000 employees</SelectItem>
                  <SelectItem value="1000+">1000+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contactNumber" className="text-gray-700">
                Contact Number (Optional)
              </Label>
              <Input
                id="contactNumber"
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+1 (555) 123-4567"
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

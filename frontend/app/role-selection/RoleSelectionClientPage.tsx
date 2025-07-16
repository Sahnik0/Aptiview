"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Briefcase } from "lucide-react"

export default function RoleSelectionClientPage() {
  const router = useRouter()

  const handleRoleSelect = (role: "recruiter" | "candidate") => {
    if (role === "recruiter") {
      router.push("/recruiter-profile-setup") // Redirect to recruiter profile setup
    } else {
      router.push("/candidate-profile-setup") // Redirect to candidate profile setup
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl text-center shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-gray-900">Select Your Role</CardTitle>
          <CardDescription className="text-gray-600">
            Please choose your role to proceed to the appropriate profile setup.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <div
            className="flex flex-col items-center space-y-4 p-6 border rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer bg-white"
            onClick={() => handleRoleSelect("recruiter")}
          >
            <Briefcase className="h-16 w-16 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Recruiter</h2>
            <p className="text-gray-600 text-sm">Set up your company profile to start posting jobs.</p>
            <Button className="mt-4 bg-black hover:bg-gray-800 text-base py-5 w-full">I'm a Recruiter</Button>
          </div>
          <div
            className="flex flex-col items-center space-y-4 p-6 border rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer bg-white"
            onClick={() => handleRoleSelect("candidate")}
          >
            <Users className="h-16 w-16 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Candidate</h2>
            <p className="text-gray-600 text-sm">Create your candidate profile to apply for jobs.</p>
            <Button className="mt-4 bg-black hover:bg-gray-800 text-base py-5 w-full">I'm a Candidate</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

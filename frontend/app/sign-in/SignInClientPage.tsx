"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react" // Import CheckCircle

export default function SignInClientPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("") // New state for success message
  const router = useRouter()

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    setError("") // Clear previous errors
    setSuccessMessage("") // Clear previous success messages

    // Hardcoded dummy credentials
    const DUMMY_EMAIL = "test@example.com"
    const DUMMY_PASSWORD = "password123"

    if (email === DUMMY_EMAIL && password === DUMMY_PASSWORD) {
      // Simulate successful login
      console.log("Sign-in successful!")
      setSuccessMessage("Free trial started! Redirecting you to role selection...") // Set success message
      setTimeout(() => {
        router.push("/role-selection") // Redirect to role selection page
      }, 2000) // Simulate a delay for redirection
    } else {
      setError("Invalid email or password. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 flex items-center justify-center dark:bg-gray-900">
      <Card className="w-full max-w-md shadow-lg bg-white dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sign In</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Use dummy credentials: <span className="font-semibold">test@example.com</span> /{" "}
            <span className="font-semibold">password123</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="test@example.com"
                className="border-gray-300 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="password123"
                className="border-gray-300 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {successMessage && (
              <div className="flex items-center justify-center text-green-600 text-sm text-center bg-green-50 p-3 rounded-md dark:bg-green-900/20 dark:text-green-400">
                <CheckCircle className="h-4 w-4 mr-2" /> {successMessage}
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-black hover:bg-gray-800 text-lg py-6 dark:bg-gray-100 dark:text-black dark:hover:bg-gray-200"
            >
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

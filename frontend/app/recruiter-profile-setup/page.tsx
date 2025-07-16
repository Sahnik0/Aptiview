import type { Metadata } from "next"
import RecruiterProfileSetupClientPage from "./RecruiterProfileSetupClientPage"

export const metadata: Metadata = {
  title: "Recruiter Profile Setup",
  description: "Set up your company profile to start using Talent AI as a recruiter.",
  keywords: ["recruiter profile", "company setup", "Talent AI recruiter"],
}

export default function RecruiterProfileSetupPage() {
  return <RecruiterProfileSetupClientPage />
}

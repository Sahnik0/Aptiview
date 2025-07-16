import type { Metadata } from "next"
import CandidateProfileSetupClientPage from "./CandidateProfileSetupClientPage"

export const metadata: Metadata = {
  title: "Candidate Profile Setup",
  description: "Build your candidate profile to showcase your qualifications and apply for jobs with Talent AI.",
  keywords: ["candidate profile", "job application", "Talent AI candidate"],
}

export default function CandidateProfileSetupPage() {
  return <CandidateProfileSetupClientPage />
}

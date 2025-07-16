import type { Metadata } from "next"
import RoleSelectionClientPage from "./RoleSelectionClientPage"

export const metadata: Metadata = {
  title: "Select Role",
  description: "Choose your role (Recruiter or Candidate) to proceed with Talent AI.",
  keywords: ["role selection", "recruiter", "candidate", "Talent AI roles"],
}

export default function RoleSelectionPage() {
  return <RoleSelectionClientPage />
}

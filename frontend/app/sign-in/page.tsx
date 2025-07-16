import type { Metadata } from "next"
import SignInClientPage from "./SignInClientPage"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Talent AI account to access your dashboard.",
  keywords: ["sign in", "login", "Talent AI account"],
}

export default function SignInPage() {
  return <SignInClientPage />
}

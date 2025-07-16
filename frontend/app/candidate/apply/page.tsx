import type { Metadata } from "next"
import CandidateApplyClientPage from "./CandidateApplyClientPage"

export const metadata: Metadata = {
  title: "Apply for Job",
  description: "Apply for your desired job role through Aptiview's streamlined application process.",
  keywords: ["job application", "apply for job", "Aptiview application"],
}

export default function CandidateApplyPage({
  searchParams,
}: {
  searchParams: { jobId?: string; jobTitle?: string }
}) {
  const jobId = searchParams.jobId
  const jobTitle = searchParams.jobTitle ? decodeURIComponent(searchParams.jobTitle) : undefined

  return <CandidateApplyClientPage jobId={jobId} initialJobTitle={jobTitle} />
}

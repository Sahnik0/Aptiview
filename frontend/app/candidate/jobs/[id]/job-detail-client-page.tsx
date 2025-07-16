"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"
import ReactMarkdown from "react-markdown" // Import ReactMarkdown
import remarkGfm from "remark-gfm" // Import remarkGfm for GitHub Flavored Markdown

interface JobDetailProps {
  job: {
    id: string
    title: string
    company: string
    location: string
    type: string
    description: string
  }
}

export default function JobDetailClientPage({ job }: JobDetailProps) {
  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-4">
            <Badge
              variant="secondary"
              className="mb-2 self-start bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              {job.company}
            </Badge>
            <CardTitle className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 dark:text-gray-100">
              {job.title}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-4 text-gray-600 text-sm sm:text-base dark:text-gray-400">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" /> {job.location}
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" /> {job.type}
              </div>
              {/* Add more job details here if available, e.g., salary range */}
              {/* <div className="flex items-center">
                <DollarSign className="h-4 w-4 mr-1 text-gray-500" /> $80k - $120k
              </div> */}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ReactMarkdown
              className="prose max-w-none text-gray-700 leading-relaxed dark:text-gray-300 dark:prose-invert"
              remarkPlugins={[remarkGfm]}
            >
              {job.description}
            </ReactMarkdown>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                asChild
                className="bg-black hover:bg-gray-800 text-lg py-6 flex-1 dark:bg-gray-100 dark:text-black dark:hover:bg-gray-200"
              >
                <Link href={`/candidate/apply?jobId=${job.id}&jobTitle=${encodeURIComponent(job.title)}`}>
                  Apply Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-gray-300 hover:bg-gray-50 text-lg py-6 flex-1 bg-transparent dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-100"
              >
                Save Job
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

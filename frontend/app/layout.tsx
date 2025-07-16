import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { MainNavigation } from "@/components/main-nav"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "Talent AI - AI-Powered Hiring Platform",
    template: "%s | Talent AI",
  },
  description:
    "Revolutionize your hiring process with Talent AI's intelligent platform. Leverage AI-powered interviews, real-time analytics, and bias-free candidate evaluation to find top talent faster.",
  keywords: [
    "AI hiring",
    "recruitment AI",
    "AI interviews",
    "talent acquisition",
    "HR tech",
    "candidate screening",
    "bias-free hiring",
  ],
  openGraph: {
    title: "Talent AI - AI-Powered Hiring Platform",
    description:
      "Revolutionize your hiring process with Talent AI's intelligent platform. Leverage AI-powered interviews, real-time analytics, and bias-free candidate evaluation to find top talent faster.",
    url: "https://www.talentai.com",
    siteName: "Talent AI",
    images: [
      {
        url: "/placeholder.svg?height=630&width=1200",
        width: 1200,
        height: 630,
        alt: "Talent AI - AI-Powered Hiring Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Talent AI - AI-Powered Hiring Platform",
    description:
      "Revolutionize your hiring process with Talent AI's intelligent platform. Leverage AI-powered interviews, real-time analytics, and bias-free candidate evaluation to find top talent faster.",
    creator: "@TalentAI",
    images: ["/placeholder.svg?height=675&width=1200"],
  },
  authors: [{ name: "Talent AI Team" }],
  creator: "Talent AI",
  publisher: "Talent AI",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="talent-ai-theme"
        >
          <MainNavigation />
          <div className="pt-16 bg-gray-50/50 dark:bg-gray-900 min-h-[calc(100vh-4rem)]">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  )
}

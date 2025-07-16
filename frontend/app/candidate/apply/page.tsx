import type { Metadata } from "next"
import CandidateApplyClientPage from "./CandidateApplyClientPage"

// Dummy job data (same as in job detail page for consistency)
const dummyJobs = [
  {
    id: "JOB004",
    title: "Frontend Developer",
    company: "WebSolutions",
    location: "Remote",
    type: "Full-time",
    description: `
      We are seeking a talented and passionate Frontend Developer to join our dynamic team.
      You will be responsible for developing and implementing user interface components
      using React.js and Next.js workflows. Your primary focus will be on developing
      user-facing features, ensuring high performance and responsiveness to requests
      from the backend.

      **Responsibilities:**
      * Develop new user-facing features using React.js and Next.js.
      * Build reusable components and front-end libraries for future use.
      * Translate designs and wireframes into high-quality code.
      * Optimize components for maximum performance across a vast array of web-capable devices and browsers.
      * Collaborate with backend developers and UI/UX designers to improve usability.
      * Stay up-to-date with the latest frontend technologies and best practices.

      **Requirements:**
      * Proven experience as a Frontend Developer or similar role.
      * In-depth understanding of React.js and its core principles.
      * Experience with Next.js framework.
      * Strong proficiency in JavaScript, HTML5, and CSS3.
      * Familiarity with RESTful APIs.
      * Experience with version control systems (e.g., Git).
      * Excellent problem-solving skills and attention to detail.
      * Bachelor's degree in Computer Science or a related field (or equivalent experience).

      **Bonus Points:**
      * Experience with TypeScript.
      * Knowledge of modern authorization mechanisms, such as JSON Web Token.
      * Familiarity with modern frontend build pipelines and tools.
      * Experience with testing frameworks (e.g., Jest, React Testing Library).
    `,
  },
  {
    id: "JOB005",
    title: "Data Scientist",
    company: "DataInsights",
    location: "New York, NY",
    type: "Full-time",
    description: `
      DataInsights is looking for an experienced Data Scientist to join our growing team.
      You will be responsible for analyzing large datasets, building predictive models,
      and developing data-driven solutions to complex business problems.

      **Responsibilities:**
      * Design, develop, and implement machine learning models.
      * Perform data cleaning, preprocessing, and feature engineering.
      * Conduct exploratory data analysis to identify trends and insights.
      * Collaborate with engineers and product managers to deploy models into production.
      * Communicate complex analytical findings to non-technical stakeholders.
      * Research and implement new statistical or other mathematical methodologies.

      **Requirements:**
      * Master's or Ph.D. in a quantitative field (e.g., Statistics, Computer Science, Mathematics).
      * 3+ years of experience as a Data Scientist.
      * Strong proficiency in Python and relevant libraries (NumPy, Pandas, Scikit-learn, TensorFlow/PyTorch).
      * Experience with SQL and database management.
      * Solid understanding of statistical modeling, machine learning algorithms, and data mining techniques.
      * Excellent communication and presentation skills.

      **Bonus Points:**
      * Experience with big data technologies (e.g., Spark, Hadoop).
      * Familiarity with cloud platforms (AWS, Azure, GCP).
      * Experience with A/B testing and experimental design.
    `,
  },
  {
    id: "JOB006",
    title: "Marketing Specialist",
    company: "BrandBoost",
    location: "San Francisco, CA",
    type: "Part-time",
    description: `
      BrandBoost is seeking a creative and results-driven Marketing Specialist to help
      execute our digital marketing strategies. You will be involved in content creation,
      social media management, email campaigns, and performance tracking.

      **Responsibilities:**
      * Develop and implement digital marketing campaigns across various channels.
      * Create engaging content for social media, blogs, and email newsletters.
      * Manage and optimize social media presence.
      * Analyze campaign performance and provide actionable insights.
      * Collaborate with sales and product teams to align marketing efforts.
      * Stay informed about industry trends and competitor activities.

      **Requirements:**
      * Bachelor's degree in Marketing, Communications, or a related field.
      * 2+ years of experience in digital marketing.
      * Proficiency with marketing automation tools and CRM software.
      * Strong understanding of SEO, SEM, and social media marketing.
      * Excellent written and verbal communication skills.
      * Ability to work independently and as part of a team.

      **Bonus Points:**
      * Experience with graphic design tools (e.g., Canva, Adobe Creative Suite).
      * Certifications in Google Ads or Google Analytics.
      * Experience with email marketing platforms (e.g., Mailchimp, HubSpot).
    `,
  },
  {
    id: "JOB007",
    title: "Backend Engineer",
    company: "CloudNine",
    location: "Remote",
    type: "Full-time",
    description: `
      CloudNine is looking for a skilled Backend Engineer to design, build, and maintain
      scalable and robust server-side applications. You will work with our team to
      develop APIs, integrate with databases, and ensure the performance and security
      of our systems.

      **Responsibilities:**
      * Design and implement highly scalable and reliable backend services.
      * Develop and maintain RESTful APIs.
      * Work with databases (SQL and NoSQL) to ensure data integrity and performance.
      * Write clean, maintainable, and efficient code.
      * Participate in code reviews and contribute to architectural discussions.
      * Troubleshoot and debug production issues.

      **Requirements:**
      * Bachelor's degree in Computer Science or a related field.
      * 3+ years of experience in backend development.
      * Strong proficiency in Node.js, Python, or Go.
      * Experience with database systems like PostgreSQL, MongoDB, or MySQL.
      * Familiarity with cloud platforms (AWS, Azure, GCP).
      * Understanding of microservices architecture.
      * Excellent problem-solving and analytical skills.

      **Bonus Points:**
      * Experience with Docker and Kubernetes.
      * Knowledge of message queues (e.g., Kafka, RabbitMQ).
      * Experience with GraphQL.
    `,
  },
]

export const metadata: Metadata = {
  title: "Apply for Job",
  description: "Apply for your desired job role through Talent AI's streamlined application process.",
  keywords: ["job application", "apply for job", "Talent AI application"],
}

export default function CandidateApplyPage({
  searchParams,
}: {
  searchParams: { jobId?: string; jobTitle?: string }
}) {
  const jobId = searchParams.jobId
  const jobTitle = searchParams.jobTitle ? decodeURIComponent(searchParams.jobTitle) : undefined

  const job = jobId ? dummyJobs.find((j) => j.id === jobId) : undefined

  return <CandidateApplyClientPage job={job} initialJobTitle={jobTitle} />
}

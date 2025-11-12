'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { WeeklySummaryReport } from '@/components/weekly-summary-report'
import { ProjectTimeline } from '@/components/project-timeline'
import { BudgetVsEacChart } from '@/components/budget-vs-eac-chart'
import { ExecutiveSummary } from '@/components/executive-summary'
import { LoadingSpinner } from '@/components/loading-spinner'
import { formatDate } from '@/lib/utils'
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Calendar, Printer, Download } from 'lucide-react'

// Calculate Monday-Friday for a given week offset (0 = current week, -1 = last week, etc.)
// Use UTC dates to avoid timezone issues
const getWeekRange = (weeksAgo: number = 0) => {
  const today = new Date()
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const dayOfWeek = todayUTC.getUTCDay()
  
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(todayUTC)
  monday.setUTCDate(todayUTC.getUTCDate() + mondayOffset)
  monday.setUTCHours(0, 0, 0, 0)
  
  if (weeksAgo !== 0) {
    monday.setUTCDate(monday.getUTCDate() + (weeksAgo * 7))
  }
  
  const friday = new Date(monday)
  friday.setUTCDate(monday.getUTCDate() + 4)
  friday.setUTCHours(23, 59, 59, 999)
  
  const fridayDayOfWeek = friday.getUTCDay()
  if (fridayDayOfWeek !== 5) {
    const adjustment = 5 - fridayDayOfWeek
    friday.setUTCDate(friday.getUTCDate() + adjustment)
  }
  
  const formatUTCDate = (date: Date) => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  return {
    startDate: formatUTCDate(monday),
    endDate: formatUTCDate(friday),
    weeksAgo,
  }
}

// Generate week range options
const getWeekRangeOptions = () => {
  const options = []
  for (let i = 0; i <= 12; i++) {
    const range = getWeekRange(-i)
    const mondayParts = range.startDate.split('-')
    const fridayParts = range.endDate.split('-')
    const monday = new Date(Date.UTC(parseInt(mondayParts[0]), parseInt(mondayParts[1]) - 1, parseInt(mondayParts[2])))
    const friday = new Date(Date.UTC(parseInt(fridayParts[0]), parseInt(fridayParts[1]) - 1, parseInt(fridayParts[2])))
    
    let label = ''
    if (i === 0) {
      label = 'This Week'
    } else if (i === 1) {
      label = 'Last Week'
    } else {
      label = `${i} Weeks Ago`
    }
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
    
    options.push({
      value: i,
      label: `${label} (${formatDate(monday)} - ${formatDate(friday)})`,
      startDate: range.startDate,
      endDate: range.endDate,
    })
  }
  return options
}

export default function WeeklySummaryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [weekOptions] = useState(() => getWeekRangeOptions())
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(1) // Default to Last Week
  const [weekEnding, setWeekEnding] = useState('')
  const [projects, setProjects] = useState<Array<{
    id: string
    name: string
    code: string
    reports?: Array<{ reportDate: string | Date; [key: string]: unknown }>
    [key: string]: unknown
  }>>([])
  const [loading, setLoading] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [reportStatus, setReportStatus] = useState<{
    totalProjects?: number
    reportedProjects?: number
    [key: string]: unknown
  } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (session && !['PM', 'EXECUTIVE', 'ADMIN'].includes(session.user.role)) {
      router.push('/')
      return
    }

    // Get week ending from query param or use default
    const weekEndingParam = searchParams.get('weekEnding')
    
    if (weekEndingParam) {
      // Find the matching week option
      const matchingIndex = weekOptions.findIndex(opt => opt.endDate === weekEndingParam)
      if (matchingIndex >= 0) {
        setSelectedWeekIndex(matchingIndex)
        setWeekEnding(weekEndingParam)
      } else {
        // If no match, use default
        const defaultWeek = weekOptions[1]
        setWeekEnding(defaultWeek.endDate)
      }
    } else {
      // Default to last week
      const defaultWeek = weekOptions[1]
      setWeekEnding(defaultWeek.endDate)
    }
  }, [session, status, router, searchParams, weekOptions])

  useEffect(() => {
    if (weekEnding) {
      fetchProjects(weekEnding)
      fetchReportStatus(weekEnding)
    }
  }, [weekEnding])

  const fetchReportStatus = async (weekEndingDate: string) => {
    if (!weekEndingDate) return
    try {
      const res = await fetch(`/api/reports/weekly-status?weekEnding=${weekEndingDate}`)
      if (res.ok) {
        const data = await res.json()
        setReportStatus(data)
      }
    } catch (error) {
      console.error('Error fetching report status:', error)
    }
  }

  const fetchProjects = async (weekEndingDate: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects?includeProjectNumbers=true`)
      const data = await res.json()
      
      if (Array.isArray(data)) {
        // Filter projects that have reports for this week
        const weekStart = new Date(weekEndingDate)
        weekStart.setDate(weekStart.getDate() - 6)
        
        const filteredProjects = data.map((project: {
          reports?: Array<{ reportDate: string | Date; [key: string]: unknown }>
          [key: string]: unknown
        }) => {
          // Get reports for this week
          const weekReports = (project.reports || []).filter((r: { reportDate: string | Date; [key: string]: unknown }) => {
            const reportDate = new Date(r.reportDate)
            return reportDate >= weekStart && reportDate <= new Date(weekEndingDate)
          })
          
          return {
            ...project,
            reports: weekReports.length > 0 ? [weekReports[0]] : [], // Latest report for the week
          }
        }).filter((p: { reports?: unknown[]; [key: string]: unknown }) => (p.reports?.length ?? 0) > 0 || true) // Show all projects, even without reports
        
        setProjects(filteredProjects)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || !session) {
    return <LoadingSpinner />
  }

  const handleWeekChange = (weekIndex: number) => {
    setSelectedWeekIndex(weekIndex)
    const selectedWeek = weekOptions[weekIndex]
    setWeekEnding(selectedWeek.endDate)
    router.push(`/reports/weekly-summary?weekEnding=${selectedWeek.endDate}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Controls */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Weekly Project Summary</h1>
              {weekEnding && (
                <p className="mt-1 text-gray-600">
                  Week Ending: {formatDate(weekEnding)}
                </p>
              )}
            </div>
            {/* Small status indicator */}
            {reportStatus && (
              <Link
                href={`/reports/status?weekEnding=${weekEnding}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-sm hover:bg-white/90 transition-all"
                title="View detailed report status"
              >
                {reportStatus.summary.isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                )}
                <span className="text-sm font-medium text-gray-700">
                  {reportStatus.summary.completedProjects}/{reportStatus.summary.totalProjects}
                </span>
              </Link>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <label htmlFor="week-select-summary" className="text-sm font-medium text-gray-700">
                    Week:
                  </label>
                </div>
                <select
                  id="week-select-summary"
                  value={selectedWeekIndex}
                  onChange={(e) => handleWeekChange(Number(e.target.value))}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {weekOptions.map((option, index) => (
                    <option key={index} value={index}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 h-[44px] transition-all shadow-sm hover:shadow-md"
              >
                <Printer className="w-4 h-4" />
                <Download className="w-4 h-4" />
                <span>Print & Save as PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Report Display */}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Warning if reports are incomplete */}
            {reportStatus && !reportStatus.summary.isComplete && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      <strong>Incomplete Reports:</strong> {reportStatus.summary.pendingProjects} of {reportStatus.summary.totalProjects} projects have not submitted weekly reports for this week. 
                      The weekly summary may be incomplete until all reports are submitted.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Projects Section with Expand/Collapse */}
            <div className="bg-white rounded-lg shadow-sm mb-8">
              <div className="border-b border-gray-200 px-8 pt-6 pb-4">
                <button
                  onClick={() => setProjectsExpanded(!projectsExpanded)}
                  className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                >
                  {projectsExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                  <span>Projects</span>
                  <span className="text-sm font-normal text-gray-500 px-2 py-1 rounded-full bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 ml-2">
                    {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                  </span>
                </button>
              </div>
              {projectsExpanded && (
                <div className="p-8">
                  <WeeklySummaryReport projects={projects} weekEnding={weekEnding} />
                </div>
              )}
            </div>
            
            {/* Executive Summary */}
            <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
              <ExecutiveSummary projects={projects} weekEnding={weekEnding} />
            </div>
            
            {/* Visualize Section */}
            <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
              <BudgetVsEacChart projects={projects} />
            </div>
            
            {/* Project Timeline */}
            <div className="bg-white rounded-lg shadow-sm p-8">
              <ProjectTimeline projects={projects} currentDate={weekEnding} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}


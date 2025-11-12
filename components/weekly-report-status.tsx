'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, Clock, FileText } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { REGION_NAMES } from '@/lib/constants'
import { useLoading } from '@/components/loading-provider'

interface WeeklyReportStatusProps {
  weekEnding: string
}

interface ProjectStatus {
  projectId: string
  projectCode: string
  projectNumber: string | null
  projectName: string
  region: string
  hasReport: boolean
  reportCount: number
  latestReportDate: string | null
  latestReportAuthor: { name: string | null; email: string } | null
  latestReportCreatedAt: string | null
}

interface WeeklyStatus {
  weekEnding: string
  weekRange: {
    startDate: string
    endDate: string
  }
  summary: {
    totalProjects: number
    completedProjects: number
    pendingProjects: number
    isComplete: boolean
    completionPercent: number
  }
  projects: ProjectStatus[]
}

export function WeeklyReportStatus({ weekEnding }: WeeklyReportStatusProps) {
  const { setLoading: setGlobalLoading } = useLoading()
  const [status, setStatus] = useState<WeeklyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!weekEnding || weekEnding.trim() === '') {
      setStatus(null)
      setLoading(false)
      return
    }

    const fetchStatus = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/reports/weekly-status?weekEnding=${weekEnding}`)
        if (!res.ok) {
          throw new Error('Failed to fetch status')
        }
        const data = await res.json()
        setStatus(data)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load report status'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    // Removed auto-refresh to prevent flashing - users can manually refresh if needed
  }, [weekEnding])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-8 text-gray-500">Loading report status...</div>
      </div>
    )
  }

  if (error || !status) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-8 text-red-500">
          {error || 'Failed to load report status'}
        </div>
      </div>
    )
  }

  // Group projects by region
  const projectsByRegion: Record<string, ProjectStatus[]> = {}
  status.projects.forEach(project => {
    if (!projectsByRegion[project.region]) {
      projectsByRegion[project.region] = []
    }
    projectsByRegion[project.region].push(project)
  })

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header with summary */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Weekly Report Status</h2>
          <div className={`px-4 py-2 rounded-lg font-semibold backdrop-blur-sm border shadow-sm ${
            status.summary.isComplete
              ? 'bg-green-50/80 border-green-200/50 text-green-800'
              : 'bg-yellow-50/80 border-yellow-200/50 text-yellow-800'
          }`}>
            {status.summary.isComplete ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                All Reports Complete
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {status.summary.pendingProjects} Pending
              </span>
            )}
          </div>
        </div>
        
        <div className="text-sm text-gray-600 mb-2">
          Week: {formatDate(new Date(status.weekRange.startDate))} - {formatDate(new Date(status.weekRange.endDate))}
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all ${
              status.summary.isComplete ? 'bg-green-600' : 'bg-yellow-500'
            }`}
            style={{ width: `${status.summary.completionPercent}%` }}
          />
        </div>
        <div className="text-sm text-gray-600 px-3 py-1.5 rounded-full bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 inline-block">
          {status.summary.completedProjects} of {status.summary.totalProjects} projects completed ({status.summary.completionPercent}%)
        </div>
      </div>

      {/* Projects by region */}
      <div className="space-y-6">
        {Object.entries(projectsByRegion).map(([region, projects]) => (
          <div key={region} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 via-blue-300 to-blue-100 text-white px-4 py-2 font-semibold">
              {REGION_NAMES[region] || region}
            </div>
            <div className="divide-y divide-gray-200">
              {projects.map(project => (
                <div
                  key={project.projectId}
                  className={`px-4 py-3 flex items-center justify-between ${
                    project.hasReport ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {project.hasReport ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{project.projectName}</div>
                      <div className="text-sm text-gray-500">{project.projectNumber || project.projectCode}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      {project.hasReport ? (
                        <div>
                          <div className="text-green-700 font-medium">Submitted</div>
                          {project.latestReportAuthor && (
                            <div className="text-gray-600">
                              by {project.latestReportAuthor.name || project.latestReportAuthor.email}
                            </div>
                          )}
                          {project.latestReportCreatedAt && (
                            <div className="text-gray-500 text-xs">
                              {formatDate(new Date(project.latestReportCreatedAt))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-red-700 font-medium">Pending</div>
                      )}
                    </div>
                    <Link
                      href={`/projects/${project.projectId}/reports/new?weekEnding=${weekEnding}`}
                      prefetch={true}
                      onClick={() => setGlobalLoading(true)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all shadow-sm ${
                        project.hasReport
                          ? 'bg-white/80 backdrop-blur-sm border border-blue-200/50 text-blue-700 hover:bg-blue-50/80'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      {project.hasReport ? 'New Report' : 'Create Report'}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


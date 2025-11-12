'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'

interface MatchStatus {
  projectId: string
  projectCode: string
  projectName: string
  jobNumber: string | null
  region: string
  matchStatus: 'matched' | 'no_match' | 'no_cost_report'
  matchType: 'job' | 'project_code' | 'name' | 'project_number' | 'unknown' | null
  excelData: {
    jobNumber: string
    projectNumber: string | null
    projectName: string
    totalBudget: number | null
    eac: number | null
    variance: number | null
  } | null
  matchDetails: {
    dbJobNumber: string | null
    dbProjectCode: string
    dbProjectName: string
    dbProjectNumber?: string | null
    additionalProjectNumbers?: string[]
    excelJobNumber?: string
    excelProjectNumber?: string | null
    excelProjectName?: string
  }
  hasDuplicateMatch?: boolean
  duplicateCount?: number | null
  noMatchReason?: string
}

interface MatchStatusResponse {
  success: boolean
  costReport: {
    fileName: string
    reportDate: string
    filePath: string
  }
  summary: {
    totalProjects: number
    matched: number
    noMatch: number
    matchedByProjectNumber: number
    projectsWithoutProjectNumber: number
    duplicateMatches?: number
    projectsWithDuplicateMatches?: number
  }
  projects: MatchStatus[]
  sampleExcelEntries: Array<{
    jobNumber: string
    projectNumber: string | null
    projectName: string
  }>
  duplicateMatches?: Array<{
    excelJobNumber: string
    excelProjectNumber: string | null
    excelProjectName: string
    matchedProjects: Array<{ projectId: string; projectCode: string; projectName: string }>
  }>
}

export function CostReportMatchStatus() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<MatchStatusResponse | null>(null)
  const [filter, setFilter] = useState<'all' | 'matched' | 'no_match'>('all')

  useEffect(() => {
    fetchMatchStatus()
  }, [])

  const fetchMatchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/cost-report/match-status')
      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to fetch match status')
      }

      setData(result)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load match status'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Project Matching Status</h3>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-red-900">Project Matching Status</h3>
        <p className="text-sm text-red-800">{error}</p>
        <button
          onClick={fetchMatchStatus}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return null
  }

  // Handle cases where summary might not be present (error responses)
  if (!data.summary) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-yellow-900">Project Matching Status</h3>
        <p className="text-sm text-yellow-800">
          {data.error || 'Unable to load match status. Please ensure a cost report has been uploaded.'}
        </p>
        <button
          onClick={fetchMatchStatus}
          className="mt-4 rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
        >
          Retry
        </button>
      </div>
    )
  }

  // Handle cases where projects array might not be present
  const projects = data.projects || []

  const filteredProjects = projects.filter(project => {
    if (filter === 'matched') return project.matchStatus === 'matched'
    if (filter === 'no_match') return project.matchStatus === 'no_match'
    return true
  })

  const getMatchTypeColor = (matchType: string | null) => {
    switch (matchType) {
      case 'project_number':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getMatchTypeLabel = (matchType: string | null) => {
    switch (matchType) {
      case 'project_number':
        return 'Project Number'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Project Matching Status</h3>
          {data.costReport && (
            <p className="mt-1 text-sm text-gray-500">
              Cost Report: {data.costReport.fileName}
            </p>
          )}
        </div>
        <button
          onClick={fetchMatchStatus}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-500">Total Projects</p>
          <p className="text-2xl font-bold text-gray-900">{data.summary.totalProjects}</p>
        </div>
        <div className="rounded-md bg-green-50 p-3">
          <p className="text-xs font-medium text-green-600">Matched</p>
          <p className="text-2xl font-bold text-green-900">{data.summary.matched}</p>
        </div>
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-xs font-medium text-red-600">No Match</p>
          <p className="text-2xl font-bold text-red-900">{data.summary.noMatch}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-600">Match Rate</p>
          <p className="text-2xl font-bold text-blue-900">
            {data.summary.totalProjects > 0
              ? `${Math.round((data.summary.matched / data.summary.totalProjects) * 100)}%`
              : '0%'}
          </p>
        </div>
      </div>

      {/* Match Type Breakdown */}
      <div className="mb-4 rounded-md bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium text-gray-700">Matching Summary:</p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
            Matched by Project Number: {data.summary.matchedByProjectNumber}
          </span>
          {data.summary.projectsWithoutProjectNumber > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
              ⚠️ Projects without Project Number: {data.summary.projectsWithoutProjectNumber}
            </span>
          )}
          {data.summary.duplicateMatches && data.summary.duplicateMatches > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
              ⚠️ Duplicate Matches: {data.summary.duplicateMatches}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Matching is done by project number only. Projects must have a project number set in the database to match cost report data.
        </p>
      </div>

      {/* Duplicate Matches Warning */}
      {data.duplicateMatches && data.duplicateMatches.length > 0 && (
        <div className="mb-4 rounded-md border border-orange-300 bg-orange-50 p-4">
          <p className="mb-2 text-sm font-semibold text-orange-900">
            ⚠️ Warning: {data.duplicateMatches.length} Excel rows have multiple project matches
          </p>
          <p className="mb-3 text-xs text-orange-800">
            Multiple database projects are matching to the same Excel row. This may indicate:
          </p>
          <ul className="mb-3 list-inside list-disc space-y-1 text-xs text-orange-800">
            <li>Matching logic is too loose (names/codes are too similar)</li>
            <li>Job numbers need to be set in database for more accurate matching</li>
            <li>Project codes need to be updated to match Excel data</li>
          </ul>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-orange-900">
              Show duplicate matches ({data.duplicateMatches.length})
            </summary>
            <div className="mt-2 space-y-2">
              {data.duplicateMatches.slice(0, 5).map((dup, idx) => (
                <div key={idx} className="rounded-md bg-white p-2">
                  <p className="font-medium text-gray-900">
                    Excel: {dup.excelProjectName} ({dup.excelJobNumber})
                  </p>
                  <p className="text-gray-600">
                    Matched by {dup.matchedProjects.length} projects:
                  </p>
                  <ul className="ml-4 list-disc">
                    {dup.matchedProjects.map((p) => (
                      <li key={p.projectId} className="text-gray-600">
                        {p.projectName} ({p.projectCode})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({projects.length})
        </button>
        <button
          onClick={() => setFilter('matched')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            filter === 'matched'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Matched ({data.summary.matched || 0})
        </button>
        <button
          onClick={() => setFilter('no_match')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            filter === 'no_match'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          No Match ({data.summary.noMatch || 0})
        </button>
      </div>

      {/* Projects List */}
      <div className="space-y-3">
        {filteredProjects.map((project) => (
          <div
            key={project.projectId}
            className={`rounded-md border p-4 ${
              project.matchStatus === 'matched'
                ? project.hasDuplicateMatch
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-900">{project.projectName}</h4>
                  {project.matchStatus === 'matched' && project.matchType && (
                    <>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${getMatchTypeColor(
                          project.matchType
                        )}`}
                      >
                        Matched by {getMatchTypeLabel(project.matchType)}
                      </span>
                      {project.hasDuplicateMatch && project.duplicateCount && project.duplicateCount > 1 && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                          ⚠️ {project.duplicateCount} projects match this Excel row
                        </span>
                      )}
                    </>
                  )}
                  {project.matchStatus === 'no_match' && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      No Match
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p>
                    <span className="font-medium">Project Code:</span> {project.projectCode}
                  </p>
                  <p>
                    <span className="font-medium">Region:</span> {project.region}
                  </p>
                  {project.jobNumber && (
                    <p>
                      <span className="font-medium">Job Number (DB):</span> {project.jobNumber}
                    </p>
                  )}
                </div>

                {/* Excel Data (if matched) */}
                {project.matchStatus === 'matched' && project.excelData && (
                  <div className="mt-3 rounded-md bg-white p-3">
                    <p className="mb-2 text-xs font-medium text-gray-700">Matched Excel Data:</p>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>
                        <span className="font-medium">Excel Job Number:</span> {project.excelData.jobNumber}
                      </p>
                      {project.excelData.projectNumber && (
                        <p>
                          <span className="font-medium">Excel Project Number:</span>{' '}
                          {project.excelData.projectNumber}
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Excel Project Name:</span>{' '}
                        <span className="font-semibold text-blue-700">{project.excelData.projectName}</span>
                      </p>
                      {project.excelData.totalBudget !== null && (
                        <p>
                          <span className="font-medium">Budget:</span>{' '}
                          {formatCurrency(project.excelData.totalBudget)}
                        </p>
                      )}
                      {project.excelData.eac !== null && (
                        <p>
                          <span className="font-medium">EAC:</span> {formatCurrency(project.excelData.eac)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* No Match Details */}
                {project.matchStatus === 'no_match' && (
                  <div className="mt-3 rounded-md bg-white p-3">
                    <p className="mb-2 text-xs font-medium text-red-700">Not Found in Cost Report</p>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>
                        <span className="font-medium">DB Project Number:</span>{' '}
                        {project.matchDetails?.dbProjectNumber || 'Not set'}
                      </p>
                      <p>
                        <span className="font-medium">DB Project Code:</span> {project.projectCode}
                      </p>
                      <p>
                        <span className="font-medium">DB Project Name:</span> {project.projectName}
                      </p>
                      <p className="mt-2 text-xs text-red-600">
                        💡 Tip: Set the project number (from Column B of the cost report) in the database to enable matching.
                        {project.matchDetails?.dbProjectNumber && (
                          <span> Project number &quot;{project.matchDetails.dbProjectNumber}&quot; was not found in the cost report.</span>
                        )}
                        {project.noMatchReason && (
                          <span> {project.noMatchReason}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <p className="text-center text-sm text-gray-500">No projects found</p>
      )}
    </div>
  )
}


'use client'

import { formatCurrency, formatDate, formatPercent } from '@/lib/utils'
import { REGION_NAMES } from '@/lib/constants'

interface Project {
  id: string
  code: string
  name: string
  projectNumber: string | null
  projectNumbers?: Array<{
    id: string
    projectNumber: string
    source: string | null
    notes: string | null
  }>
  region: string
  tenant: string | null
  startDate: string | null
  scheduledCompletion: string | null
  projectBudget: number | string
  eac: number | string
  budgetVariance: number | string | null
  percentComplete: number
  reports: Array<{
    id: string
    reportDate: string
    totalTradeWorkers: number | null
  }>
}

interface WeeklySummaryReportProps {
  projects: Project[]
  weekEnding: string
}

export function WeeklySummaryReport({ projects, weekEnding }: WeeklySummaryReportProps) {
  // Group projects by region
  const projectsByRegion: Record<string, Project[]> = {}
  projects.forEach(project => {
    const region = project.region
    if (!projectsByRegion[region]) {
      projectsByRegion[region] = []
    }
    projectsByRegion[region].push(project)
  })

  const weekEndingDate = new Date(weekEnding)
  const weekEndingStr = formatDate(weekEndingDate)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b-4 border-blue-600 pb-6 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 via-blue-400 to-blue-200 bg-clip-text text-transparent mb-3">
          Weekly Project Summary
        </h1>
        <div className="text-xl bg-gradient-to-r from-gray-600 via-blue-300 to-gray-400 bg-clip-text text-transparent font-medium">
          Week Ending: {weekEndingStr}
        </div>
      </div>

      {/* Regions */}
      {Object.entries(projectsByRegion).map(([region, regionProjects]) => (
        <div key={region} className="space-y-4">
          {/* Region Header */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-300 to-blue-100 text-white px-5 py-3 text-xl font-bold shadow-sm rounded-lg">
            {REGION_NAMES[region] || region}
          </div>

          {/* Projects Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {regionProjects.map((project) => {
              const latestReport = project.reports[0]
              const varianceRaw = project.budgetVariance !== null && project.budgetVariance !== undefined
                ? (typeof project.budgetVariance === 'string'
                  ? parseFloat(project.budgetVariance)
                  : project.budgetVariance)
                : null
              const varianceClass = varianceRaw === null
                ? 'text-gray-600'
                : varianceRaw > 0
                  ? 'text-green-600'
                  : varianceRaw < 0
                    ? 'text-red-600'
                    : 'text-gray-600'
              const varianceSign = varianceRaw !== null && varianceRaw > 0 ? '+' : ''
              const headerBarColor = varianceRaw === null
                ? 'bg-gray-300'
                : varianceRaw > 0
                  ? 'bg-green-500'
                  : varianceRaw < 0
                    ? 'bg-red-500'
                    : 'bg-gray-300'

              return (
                <div key={project.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                  {/* Colored header bar */}
                  <div className={`h-2 ${headerBarColor}`} />
                  
                  <div className="p-5">
                    {/* Project Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                        <p className="text-sm text-gray-500">
                          {project.projectNumbers && project.projectNumbers.length > 0
                            ? project.projectNumbers.map(pn => pn.projectNumber).join(', ')
                            : project.projectNumber || project.code}
                        </p>
                      </div>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                        {REGION_NAMES[region] || region}
                      </span>
                    </div>

                    {/* Project Meta */}
                    <div className="text-xs text-gray-600 space-y-1 mb-4">
                      {project.tenant && (
                        <div><strong>Tenant:</strong> {project.tenant}</div>
                      )}
                      {project.startDate && (
                        <div><strong>Start Date:</strong> {formatDate(project.startDate)}</div>
                      )}
                      {project.scheduledCompletion && (
                        <div><strong>Scheduled Completion:</strong> {formatDate(project.scheduledCompletion)}</div>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">{formatPercent(project.percentComplete)}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${Math.min(project.percentComplete, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Financial Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">Budget</div>
                        <div className="text-base font-semibold text-gray-900">
                          {formatCurrency(project.projectBudget)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">EAC (Est. Cost)</div>
                        <div className="text-base font-semibold text-gray-900">
                          {formatCurrency(project.eac)}
                        </div>
                      </div>
                      <div className="col-span-2 text-center pt-2">
                        <div className="text-xs text-gray-600 mb-1">Variance</div>
                        <div className={`text-base font-semibold ${varianceClass}`}>
                          {varianceRaw === null ? '—' : `${varianceSign}${formatCurrency(varianceRaw)}`}
                        </div>
                      </div>
                    </div>

                    {/* Trade Workers */}
                    <div className="flex justify-between items-center text-sm pt-2">
                      <span className="text-gray-600">Trade Workers</span>
                      <span className="font-semibold text-gray-900">
                        {latestReport?.totalTradeWorkers || 0}
                      </span>
                    </div>
                    {latestReport && (
                      <div className="text-xs text-gray-500 mt-1">
                        Latest report: {formatDate(latestReport.reportDate)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {projects.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No projects found for this week.</p>
        </div>
      )}
    </div>
  )
}


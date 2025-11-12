'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils'
import { REGION_NAMES } from '@/lib/constants'
import { LoadingSpinner } from '@/components/loading-spinner'
import { useLoading } from '@/components/loading-provider'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface FinancialBreakdownEntry {
  projectNumber: string
  budget: number | null
  eac: number | null
  variance: number | null
  reportDate: string | null
  sourceDate: string | null
}

interface Project {
  id: string
  code: string
  name: string
  projectNumber: string | null
  region: string
  tenant: string | null
  startDate: string
  scheduledCompletion: string | null
  projectBudget: number | string
  eac: number | string
  budgetVariance: number | string | null
  budgetVarianceNote: string | null
  percentComplete: number
  statusNote: string | null
  tags: string[]
  reports: Report[]
  financialBreakdown: FinancialBreakdownEntry[]
}

interface Report {
  id: string
  reportDate: string
  reportType: string
  workPerformed: string | null
  safety: string | null
  totalTradeWorkers: number | null
  author: { name: string | null; email: string }
  activities: Array<{
    craft?: { name: string } | null
    tradeWorkers?: number | null
  }>
}

export function ProjectOverview({ projectId }: { projectId: string }) {
  const { setLoading: setGlobalLoading } = useLoading()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBreakdownModal, setShowBreakdownModal] = useState(false)

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      const data = await res.json()
      setProject(data)
    } catch (error) {
      console.error('Error fetching project:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-500">Project not found</div>
  }

  const financialBreakdown = project.financialBreakdown || []

  const getVarianceColor = (variance: number | string | null) => {
    if (variance === null || variance === undefined) return 'text-gray-600'
    const num = typeof variance === 'string' ? parseFloat(variance) : variance
    if (Number.isNaN(num)) return 'text-gray-600'
    if (num > 0) return 'text-green-600'
    if (num < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  // Prepare chart data
  const headcountData = (project.reports || [])
    .filter(r => r.totalTradeWorkers !== null)
    .map(r => ({
      date: formatDate(r.reportDate),
      workers: r.totalTradeWorkers,
    }))
    .slice(0, 10)
    .reverse()

  // Craft mix
  const craftCounts: Record<string, number> = {}
  ;(project.reports || []).forEach(report => {
    ;(report.activities || []).forEach(activity => {
      const craftName = activity.craft?.name || 'Unknown'
      craftCounts[craftName] = (craftCounts[craftName] || 0) + (activity.tradeWorkers || 0)
    })
  })
  const craftData = Object.entries(craftCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-400 to-blue-200 p-8 shadow-lg">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{project.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm font-medium shadow-sm">
                {project.projectNumber || project.code}
              </span>
              <span className="text-blue-100 text-sm">•</span>
              <span className="text-blue-100 text-sm">{REGION_NAMES[project.region]}</span>
            </div>
          </div>
          <Link
            href={`/projects/${projectId}/reports/new`}
            prefetch={true}
            onClick={() => setGlobalLoading(true)}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-blue-700 bg-white/90 backdrop-blur-sm border border-white/50 hover:bg-white shadow-md transition-all"
          >
            New Report
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Project Facts */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-gray-200/50 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Project Facts</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-600">Start Date</dt>
                <dd className="font-medium">{formatDate(project.startDate)}</dd>
              </div>
              {project.scheduledCompletion && (
                <div>
                  <dt className="text-gray-600">Scheduled Completion</dt>
                  <dd className="font-medium">{formatDate(project.scheduledCompletion)}</dd>
                </div>
              )}
              {project.tenant && (
                <div>
                  <dt className="text-gray-600">Tenant</dt>
                  <dd className="font-medium">{project.tenant}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-600">Budget</dt>
                <dd className="font-medium flex items-center gap-3">
                  {formatCurrency(project.projectBudget)}
                  {financialBreakdown.length > 0 && (
                    <button
                      onClick={() => setShowBreakdownModal(true)}
                      className="rounded-full border border-blue-200/60 bg-blue-50/90 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      View Breakdown
                    </button>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">EAC</dt>
                <dd className="font-medium">{formatCurrency(project.eac)}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Variance</dt>
                <dd className={`font-medium ${getVarianceColor(project.budgetVariance)}`}>
                  {formatCurrency(project.budgetVariance)}
                </dd>
              </div>
              {project.budgetVarianceNote && (
                <div>
                  <dt className="text-gray-600">Variance Note</dt>
                  <dd className="text-xs text-gray-500">{project.budgetVarianceNote}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-600">Progress</dt>
                <dd className="font-medium mb-1">{formatPercent(project.percentComplete)}</dd>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200/60 backdrop-blur-sm border border-gray-200/50">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                    style={{ width: `${Math.min(project.percentComplete, 100)}%` }}
                  />
                </div>
              </div>
              {project.statusNote && (
                <div>
                  <dt className="text-gray-600">Status Note</dt>
                  <dd className="text-xs text-gray-500">{project.statusNote}</dd>
                </div>
              )}
              {project.tags.length > 0 && (
                <div>
                  <dt className="text-gray-600">Tags</dt>
                  <dd className="flex flex-wrap gap-2 mt-1">
                    {project.tags.map(tag => (
                      <span key={tag} className="rounded-full px-2.5 py-1 text-xs font-medium bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 text-blue-700 shadow-sm">
                        {tag}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Middle: Reports List */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-gray-200/50 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Reports</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {(project.reports || []).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 px-4 py-2 rounded-full bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 inline-block">
                    No reports yet
                  </p>
                </div>
              ) : (
                (project.reports || []).map((report) => (
                  <Link
                    key={report.id}
                    href={`/projects/${projectId}/reports/${report.id}`}
                    prefetch={true}
                    className="group relative block rounded-lg border border-gray-200/50 bg-white/60 backdrop-blur-sm p-4 hover:bg-white/80 hover:border-blue-200/50 transition-all shadow-sm overflow-hidden"
                  >
                    <style dangerouslySetInnerHTML={{ __html: `
                      @keyframes gradientExpand {
                        0% {
                          transform: scale(1.5);
                          opacity: 0;
                        }
                        100% {
                          transform: scale(1);
                          opacity: 1;
                        }
                      }
                      .group:hover .gradient-overlay-animate {
                        animation: gradientExpand 0.4s ease-out forwards;
                      }
                    `}} />
                    {/* Gradient overlay on hover - starts from outside and works inward */}
                    <div className="gradient-overlay-animate absolute inset-0 opacity-0 group-hover:opacity-100 rounded-lg pointer-events-none z-10"
                         style={{
                           background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.3) 0%, rgba(147, 197, 253, 0.5) 35%, rgba(219, 234, 254, 0.7) 65%, rgba(255, 255, 255, 0.95) 100%)',
                         }}
                    />
                    {/* VIEW text - appears on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                      <span className="text-2xl font-bold text-blue-700 drop-shadow-lg">VIEW</span>
                    </div>
                    {/* Content - slightly fade on hover to make VIEW more visible */}
                    <div className="relative z-0 group-hover:opacity-60 transition-opacity duration-300">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-900">{formatDate(report.reportDate)}</span>
                          </div>
                          {report.totalTradeWorkers !== null && (
                            <p className="text-xs text-gray-600 mb-2 px-2 py-1 rounded-full bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 inline-block">
                              {report.totalTradeWorkers} trade workers
                            </p>
                          )}
                          {report.workPerformed && (
                            <p className="mt-2 line-clamp-2 text-sm text-gray-700">
                              {report.workPerformed}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Charts */}
        <div className="lg:col-span-1 space-y-4">
          {headcountData.length > 0 && (
            <div className="rounded-xl border border-gray-200/50 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">Trade Workers Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={headcountData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(229, 231, 235, 0.5)',
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="workers" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ fill: '#2563eb', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {craftData.length > 0 && (
            <div className="rounded-xl border border-gray-200/50 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">Craft Mix</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={craftData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={12} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(229, 231, 235, 0.5)',
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

      {showBreakdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-gray-200/70 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-gray-50">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Cost Report Breakdown</h3>
                <p className="text-sm text-gray-500">Latest financial data by project number</p>
              </div>
              <button
                onClick={() => setShowBreakdownModal(false)}
                className="rounded-full border border-gray-200/60 bg-white px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Project Number</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Budget</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">EAC</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Variance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Report Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {financialBreakdown.map((item) => (
                    <tr key={item.projectNumber}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.projectNumber}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{item.budget !== null ? formatCurrency(item.budget) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{item.eac !== null ? formatCurrency(item.eac) : '—'}</td>
                      <td
                        className={`px-4 py-3 text-sm text-right ${
                          item.variance !== null
                            ? item.variance > 0
                              ? 'text-green-600'
                              : item.variance < 0
                                ? 'text-red-600'
                                : 'text-gray-700'
                            : 'text-gray-700'
                        }`}
                      >
                        {item.variance !== null ? formatCurrency(item.variance) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.reportDate ? formatDate(item.reportDate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-200/60 bg-gray-50 text-sm text-gray-500">
              Data sourced from the latest cost report period.
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  )
}


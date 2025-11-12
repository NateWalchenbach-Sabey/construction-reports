'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils'
import { SAFETY_TYPE_LABELS } from '@/lib/constants'
import { LoadingSpinner } from '@/components/loading-spinner'
import { useLoading } from '@/components/loading-provider'
import { ArrowLeft, Edit } from 'lucide-react'

interface Project {
  id: string
  code: string
  name: string
  projectNumber?: string | null
  startDate?: string
  scheduledCompletion?: string | null
  projectBudget?: number | string
  eac?: number | string
  budgetVariance?: number | string | null
  percentComplete?: number
  tenant?: string | null
}

interface Activity {
  id: string
  subcontractor: {
    id: string
    name: string
  } | null
  craft: {
    id: string
    name: string
  } | null
  tradeWorkers: number | null
  notes: string | null
  source: string | null
}

interface Report {
  id: string
  reportDate: string
  reportType: string
  workPerformed: string | null
  safety: string | null
  safetyType: string
  source: string | null
  architect: string | null
  sabeyProjectStaff: string[]
  activities: Activity[]
  totalTradeWorkers: number | null
  author: {
    name: string | null
    email: string
  }
  createdAt: string
}

export function ReportView({ 
  projectId, 
  project,
  reportId,
}: { 
  projectId: string
  project: Project
  reportId: string
}) {
  const router = useRouter()
  const { setLoading: setGlobalLoading } = useLoading()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<Report | null>(null)

  useEffect(() => {
    fetchReport()
  }, [reportId, projectId])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/${reportId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch report')
      }
      const data = await res.json()
      setReport(data)
    } catch (error) {
      console.error('Error fetching report:', error)
      alert('Failed to load report. Please try again.')
      router.push(`/projects/${projectId}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!report) {
    return <div className="text-center py-12 text-gray-500">Report not found</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Report Details</h1>
            <p className="mt-1 text-gray-600">{project.name} ({project.projectNumber || project.code})</p>
            <p className="mt-1 text-sm text-gray-500">
              Report Date: {formatDate(report.reportDate)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${projectId}/reports/${reportId}/edit`}
              onClick={() => setGlobalLoading(true)}
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-blue-700 bg-white/80 backdrop-blur-sm border border-gray-200/50 hover:bg-white/90 shadow-sm transition-all"
            >
              <Edit className="w-4 h-4" />
              Edit Report
            </Link>
            <Link
              href={`/projects/${projectId}`}
              onClick={() => setGlobalLoading(true)}
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-200/50 hover:bg-white/90 shadow-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Project
            </Link>
          </div>
        </div>
      </div>

      {/* Project Information Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Project Information</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Project Name</label>
            <p className="mt-1 text-sm text-gray-900">{project.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Project Number</label>
            <p className="mt-1 text-sm text-gray-900">{project.projectNumber || project.code}</p>
          </div>
          {project.tenant && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Tenant</label>
              <p className="mt-1 text-sm text-gray-900">{project.tenant}</p>
            </div>
          )}
          {project.startDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(project.startDate)}</p>
            </div>
          )}
          {project.scheduledCompletion && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Scheduled Completion</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(project.scheduledCompletion)}</p>
            </div>
          )}
          {project.projectBudget && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Project Budget</label>
              <p className="mt-1 text-sm text-gray-900">{formatCurrency(project.projectBudget)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Details Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Report Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Report Date</label>
            <p className="mt-1 text-sm text-gray-900">{formatDate(report.reportDate)}</p>
          </div>
          {report.architect && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Architect</label>
              <p className="mt-1 text-sm text-gray-900">{report.architect}</p>
            </div>
          )}
          {report.sabeyProjectStaff && report.sabeyProjectStaff.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Sabey Project Staff</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {report.sabeyProjectStaff.map((staff, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full px-3 py-1 text-sm text-blue-800 bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 shadow-sm"
                  >
                    {staff}
                  </span>
                ))}
              </div>
            </div>
          )}
          {report.source && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Source</label>
              <p className="mt-1 text-sm text-gray-900">{report.source}</p>
            </div>
          )}
        </div>
      </div>

      {/* Subcontractor Activities */}
      {report.activities && report.activities.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Subcontractor Activities</h2>
          <div className="space-y-3">
            {report.activities.map((activity, index) => (
              <div key={activity.id || index} className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-4 sm:grid-cols-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Company</label>
                    <p className="mt-1 text-sm text-gray-900">{activity.subcontractor?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Craft</label>
                    <p className="mt-1 text-sm text-gray-900">{activity.craft?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Workers</label>
                    <p className="mt-1 text-sm text-gray-900">{activity.tradeWorkers || 0}</p>
                  </div>
                  {activity.source && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Source</label>
                      <p className="mt-1 text-sm text-gray-900">{activity.source}</p>
                    </div>
                  )}
                  {activity.notes && (
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-medium text-gray-700">Notes</label>
                      <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{activity.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {report.totalTradeWorkers !== null && report.totalTradeWorkers > 0 && (
              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-medium text-gray-900">
                  Total Trade Workers: {report.totalTradeWorkers}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Narratives */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Narratives</h2>
        <div className="space-y-4">
          {report.workPerformed && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Work Performed</label>
              <p className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">{report.workPerformed}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Safety Type</label>
            <p className="mt-1 text-sm text-gray-900">
              {SAFETY_TYPE_LABELS[report.safetyType] || report.safetyType}
            </p>
          </div>
          {report.safety && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Safety Details</label>
              <p className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">{report.safety}</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Metadata */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Report Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Created By</label>
            <p className="mt-1 text-sm text-gray-900">{report.author.name || report.author.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Created At</label>
            <p className="mt-1 text-sm text-gray-900">{formatDate(report.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}


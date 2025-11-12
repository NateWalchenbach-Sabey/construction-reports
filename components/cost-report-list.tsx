'use client'

import { useState, useEffect } from 'react'
import { formatDate } from '@/lib/utils'

interface CostReport {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  reportDate: string
  uploadedAt: string
  uploadedBy: string | null
  isActive: boolean
  notes: string | null
}

export function CostReportList() {
  const [costReports, setCostReports] = useState<CostReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCostReports()
  }, [])

  const fetchCostReports = async () => {
    try {
      const res = await fetch('/api/cost-report/upload?includeInactive=true')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch cost reports')
      }

      setCostReports(data.costReports || [])
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cost reports'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Uploaded Cost Reports</h3>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-red-900">Uploaded Cost Reports</h3>
        <p className="text-sm text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Uploaded Cost Reports</h3>
      
      {costReports.length === 0 ? (
        <p className="text-sm text-gray-500">No cost reports uploaded yet.</p>
      ) : (
        <div className="space-y-3">
          {costReports.map((report) => (
            <div
              key={report.id}
              className={`rounded-md border p-4 ${
                report.isActive
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-gray-900">
                      {report.fileName}
                    </h4>
                    {report.isActive && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <p>
                      <span className="font-medium">Report Date:</span>{' '}
                      {formatDate(report.reportDate)}
                    </p>
                    <p>
                      <span className="font-medium">Uploaded:</span>{' '}
                      {formatDate(report.uploadedAt)}
                    </p>
                    <p>
                      <span className="font-medium">Size:</span> {formatFileSize(report.fileSize)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t pt-4">
        <p className="text-xs text-gray-500">
          <strong>How it works:</strong> When you upload a new cost report, it becomes the active report. 
          Previous reports are kept for historical reference. When creating a weekly report, 
          the system uses the cost report that was active at that time.
        </p>
      </div>
    </div>
  )
}


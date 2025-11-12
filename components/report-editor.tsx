'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils'
import { SAFETY_TYPES, SAFETY_TYPE_LABELS } from '@/lib/constants'
import { LoadingSpinner } from '@/components/loading-spinner'
import { ArrowLeft } from 'lucide-react'

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
  id?: string
  subcontractorId: string
  craftId: string
  tradeWorkers: number | null
  notes: string | null
  source?: string | null
}

interface Craft {
  id: string
  name: string
}

interface Subcontractor {
  id: string
  name: string
}

export function ReportEditor({ 
  projectId, 
  project,
  reportId,
}: { 
  projectId: string
  project: Project
  reportId?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [crafts, setCrafts] = useState<Craft[]>([])
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  
  // Get weekEnding from query params if available
  const weekEndingParam = searchParams.get('weekEnding')
  const defaultReportDate = weekEndingParam || new Date().toISOString().split('T')[0]
  
  const [formData, setFormData] = useState({
    reportDate: defaultReportDate,
    reportType: 'WEEKLY' as const, // Only weekly reports
    workPerformed: '',
    safety: '',
    safetyType: 'NONE_TO_REPORT' as string,
    source: 'manual_entry', // Default source for manually created reports
    architect: '',
    sabeyProjectStaff: [] as string[],
    activities: [] as Activity[],
    // Cost data from cost report
    reportBudget: null as number | null,
    reportEac: null as number | null,
    reportVariance: null as number | null,
    jobNumber: null as string | null,
    projectNumber: null as string | null,
    // Project completion
    percentComplete: project.percentComplete || 0,
    actualCompletionDate: null as string | null,
  })
  
  const [newStaffName, setNewStaffName] = useState('')
  const [costDataLoaded, setCostDataLoaded] = useState(false)
  const [costDataLoading, setCostDataLoading] = useState(false)
  const [costDataError, setCostDataError] = useState<string | null>(null)

  useEffect(() => {
    fetchCrafts()
    fetchSubcontractors()
    if (reportId) {
      fetchReport()
    } else {
      // Auto-populate architect from last report for this project
      fetchLastReport()
      // Set report date to today (or weekEnding if provided via query param)
      // For new reports, date is read-only and set to today
      const todayDate = new Date().toISOString().split('T')[0]
      const dateToUse = weekEndingParam || todayDate
      setFormData(prev => ({ ...prev, reportDate: dateToUse }))
    }
  }, [reportId, projectId, weekEndingParam])
  
  // Fetch cost data when report date changes (for new reports)
  useEffect(() => {
    if (!reportId && formData.reportDate) {
      // Small delay to ensure report date is set
      const timer = setTimeout(() => {
        fetchCostData()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [formData.reportDate, reportId])
  
  const fetchLastReport = async () => {
    try {
      const res = await fetch(`/api/reports?projectId=${projectId}&limit=1`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0].architect) {
        setFormData(prev => ({ ...prev, architect: data[0].architect }))
      }
    } catch (_error) {
      // Silently fail - it's okay if there's no last report
    }
  }

  const fetchCostData = async () => {
    setCostDataLoading(true)
    setCostDataError(null)
    
    try {
      // For new reports, use current date. For existing reports, use report date
      const dateToUse = reportId ? formData.reportDate : formData.reportDate || new Date().toISOString().split('T')[0]
      
      const url = `/api/cost-report?projectId=${projectId}${dateToUse ? `&reportDate=${dateToUse}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      
      if (res.ok && data) {
        console.log('Cost data loaded:', {
          budget: data.totalBudget,
          eac: data.eac,
          jobNumber: data.jobNumber,
          projectNumber: data.projectNumber,
          projectName: data.projectName
        })
        setFormData(prev => ({
          ...prev,
          reportBudget: data.totalBudget,
          reportEac: data.eac,
          reportVariance: data.variance,
          jobNumber: data.jobNumber,
          projectNumber: data.projectNumber,
        }))
        setCostDataLoaded(true)
      } else {
        // Not an error - just no cost data found
        if (data.code === 'NO_FILE_FOUND') {
          setCostDataError('No cost report file found. Please upload a cost report file using the upload interface.')
        } else if (data.code === 'NO_MATCH') {
          console.log('No match found. Project:', { code: data.project?.code, name: data.project?.name })
          console.log('Suggestions:', data.suggestions)
          console.log('Available project numbers:', data.availableProjectNumbers)
          const suggestions = data.suggestions?.map((s: {
            jobNumber?: string | null
            projectNumber?: string | null
            projectName?: string | null
          }) => 
            s.projectNumber ? `${s.jobNumber || 'N/A'} (Project #${s.projectNumber}) - ${s.projectName}` : `${s.jobNumber || 'N/A'} - ${s.projectName}`
          ).join('; ') || 'None'
          const projectNumbers = data.availableProjectNumbers?.slice(0, 10).join(', ') || 'None'
          setCostDataError(`No cost data found for this project. Available project numbers: ${projectNumbers}. Suggestions: ${suggestions}`)
        } else {
          setCostDataError(data.error || 'Could not load cost data')
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching cost data:', error)
      setCostDataError('Failed to load cost data from cost report')
    } finally {
      setCostDataLoading(false)
    }
  }

  const fetchCrafts = async () => {
    try {
      const res = await fetch('/api/crafts')
      if (!res.ok) {
        throw new Error('Failed to fetch crafts')
      }
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setCrafts(data)
      } else {
        throw new Error('No crafts returned')
      }
    } catch (error) {
      console.error('Error fetching crafts:', error)
      // Don't use mock data - show error instead
      alert('Failed to load crafts. Please refresh the page.')
    }
  }

  const fetchSubcontractors = async () => {
    try {
      const res = await fetch('/api/subcontractors')
      if (!res.ok) {
        throw new Error('Failed to fetch subcontractors')
      }
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setSubcontractors(data)
      } else {
        throw new Error('No subcontractors returned')
      }
    } catch (error) {
      console.error('Error fetching subcontractors:', error)
      // Don't use mock data - show error instead
      alert('Failed to load subcontractors. Please refresh the page.')
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/${reportId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch report')
      }
      const data = await res.json()
      const dateStr = new Date(data.reportDate).toISOString().split('T')[0]
      setFormData({
        reportDate: dateStr,
        reportType: data.reportType,
        workPerformed: data.workPerformed || '',
        safety: data.safety || '',
        safetyType: data.safetyType || 'NONE_TO_REPORT',
        source: data.source || 'manual_entry',
        architect: data.architect || '',
        sabeyProjectStaff: data.sabeyProjectStaff || [],
        activities: (data.activities || []).map((a: {
          id?: string
          subcontractorId?: string
          craftId?: string
          tradeWorkers?: number | null
          notes?: string | null
          source?: string | null
          subcontractor?: { id: string } | null
          craft?: { id: string } | null
        }) => ({
          id: a.id,
          subcontractorId: a.subcontractorId || a.subcontractor?.id || '',
          craftId: a.craftId || a.craft?.id || '',
          tradeWorkers: a.tradeWorkers,
          notes: a.notes,
          source: a.source || null,
        })),
        // Load cost data if it exists
        reportBudget: data.reportBudget || null,
        reportEac: data.reportEac || null,
        reportVariance: data.reportVariance || null,
        jobNumber: data.jobNumber || null,
        projectNumber: data.projectNumber || null,
        // Load completion data if it exists
        percentComplete: data.percentComplete !== undefined ? data.percentComplete : (project.percentComplete || 0),
        actualCompletionDate: data.actualCompletionDate || null,
      })
      if (data.reportBudget || data.reportEac) {
        setCostDataLoaded(true)
      }
    } catch (error) {
      console.error('Error fetching report:', error)
      alert('Failed to load report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const addActivity = () => {
    setFormData({
      ...formData,
      activities: [
        ...formData.activities,
        {
          subcontractorId: '',
          craftId: '',
          tradeWorkers: null,
          notes: null,
          source: null,
        },
      ],
    })
  }

  const updateActivity = (index: number, field: keyof Activity, value: string | number | null | string[]) => {
    const newActivities = [...formData.activities]
    newActivities[index] = {
      ...newActivities[index],
      [field]: value,
    }
    setFormData({ ...formData, activities: newActivities })
  }

  const removeActivity = (index: number) => {
    setFormData({
      ...formData,
      activities: formData.activities.filter((_, i) => i !== index),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Set saving immediately to show spinner right away
    setSaving(true)

    try {
      const url = reportId ? `/api/reports/${reportId}` : '/api/reports'
      const method = reportId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          reportDate: formData.reportDate,
          reportType: formData.reportType,
          workPerformed: formData.workPerformed || null,
          safety: formData.safety || null,
          safetyType: formData.safetyType || null,
          source: formData.source || null,
          architect: formData.architect || null,
          sabeyProjectStaff: formData.sabeyProjectStaff,
          activities: formData.activities
            .filter(a => a.subcontractorId && a.craftId)
            .map(a => ({
              subcontractorId: a.subcontractorId,
              craftId: a.craftId,
              tradeWorkers: a.tradeWorkers || null,
              notes: a.notes || null,
              source: a.source || null,
            })),
          // Include cost data from cost report
          reportBudget: formData.reportBudget,
          reportEac: formData.reportEac,
          reportVariance: formData.reportVariance,
          jobNumber: formData.jobNumber,
          projectNumber: formData.projectNumber,
          // Include completion data
          percentComplete: formData.percentComplete,
          actualCompletionDate: formData.actualCompletionDate || null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.error || `Failed to save report (${res.status})`
        throw new Error(errorMessage)
      }

      router.push(`/projects/${projectId}`)
    } catch (error: any) {
      console.error('Error saving report:', error)
      const errorMessage = error.message || 'Failed to save report. Please try again.'
      alert(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const addStaffMember = () => {
    if (newStaffName.trim()) {
      setFormData({
        ...formData,
        sabeyProjectStaff: [...formData.sabeyProjectStaff, newStaffName.trim()],
      })
      setNewStaffName('')
    }
  }

  const removeStaffMember = (index: number) => {
    setFormData({
      ...formData,
      sabeyProjectStaff: formData.sabeyProjectStaff.filter((_, i) => i !== index),
    })
  }

  const totalTradeWorkers = formData.activities.reduce(
    (sum, a) => sum + (a.tradeWorkers || 0), 0
  )

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <>
      {/* Full-screen loading overlay with fancy blue spinner */}
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="relative">
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes pulse-ring {
                0% {
                  transform: scale(0.8);
                  opacity: 1;
                }
                100% {
                  transform: scale(2.4);
                  opacity: 0;
                }
              }
              @keyframes pulse-dot {
                0%, 100% {
                  transform: scale(1);
                }
                50% {
                  transform: scale(1.2);
                }
              }
              .blue-spinner-ring {
                animation: spin 1.5s linear infinite;
              }
              .blue-spinner-pulse {
                animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }
              .blue-spinner-dot {
                animation: pulse-dot 1.5s ease-in-out infinite;
              }
            `}} />
            {/* Outer pulsing ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="blue-spinner-pulse w-32 h-32 rounded-full border-4 border-blue-200"></div>
            </div>
            {/* Spinning ring */}
            <div className="blue-spinner-ring w-24 h-24 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-500 border-b-blue-400"></div>
            {/* Center pulsing dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="blue-spinner-dot w-4 h-4 rounded-full bg-blue-600 shadow-lg shadow-blue-500/50"></div>
            </div>
            {/* Loading text */}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 mt-4">
              <p className="text-blue-600 font-semibold text-lg animate-pulse">Uploading Report...</p>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {reportId ? 'Edit Report' : 'New Report'}
            </h1>
            <p className="mt-1 text-gray-600">{project.name} ({project.projectNumber || project.code})</p>
          </div>
                   {!reportId && (
                     <Link
                       href="/reports/new"
                       className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-200/50 hover:bg-white/90 shadow-sm transition-all"
                     >
                       <ArrowLeft className="w-4 h-4" />
                       Change Project
                     </Link>
                   )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Information Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Project Information</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Project Name
              </label>
              <input
                type="text"
                value={project.name}
                disabled
                className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Project Code
              </label>
              <input
                type="text"
                value={project.code}
                disabled
                className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-600"
              />
            </div>
            {formData.projectNumber && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Project Number (from Cost Report)
                </label>
                <input
                  type="text"
                  value={formData.projectNumber}
                  disabled
                  className="mt-1 block w-full rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-blue-800 font-medium"
                />
                <p className="mt-1 text-xs text-gray-500">Project number from cost report Column B</p>
              </div>
            )}
            {project.tenant && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tenant
                </label>
                <input
                  type="text"
                  value={project.tenant}
                  disabled
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-600"
                />
              </div>
            )}
            {project.startDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <input
                  type="text"
                  value={formatDate(project.startDate)}
                  disabled
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-600"
                />
              </div>
            )}
            {project.scheduledCompletion && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Scheduled Completion
                </label>
                <input
                  type="text"
                  value={formatDate(project.scheduledCompletion)}
                  disabled
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-600"
                />
              </div>
            )}
            {project.budgetVariance !== null && project.budgetVariance !== undefined && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Budget Variance
                </label>
                <input
                  type="text"
                  value={formatCurrency(project.budgetVariance)}
                  disabled
                className={`mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 ${
                  typeof project.budgetVariance === 'number'
                    ? project.budgetVariance > 0
                      ? 'text-green-600'
                      : project.budgetVariance < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                    : 'text-gray-600'
                }`}
                />
              </div>
            )}
            
            {/* Cost Data from Cost Report - Additional/Updated values */}
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-blue-900">Cost Data from Cost Report (Latest)</h3>
                  {!reportId && (
                    <button
                      type="button"
                      onClick={fetchCostData}
                      disabled={costDataLoading}
                      className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {costDataLoading ? 'Loading...' : 'Reload Cost Data'}
                    </button>
                  )}
                </div>
                {costDataLoading && (
                  <p className="text-sm text-blue-700">Loading cost data from cost report...</p>
                )}
                {costDataError && (
                  <div className="mb-2 rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-sm font-medium text-red-800 mb-1">⚠️ Cost Report Not Available</p>
                    <p className="text-xs text-red-700 mb-2">{costDataError}</p>
                    <p className="text-xs text-gray-600">
                      <strong>Note:</strong> The project budget and EAC values shown above will be used for this report. 
                      Cost report values will be saved when the cost report is available.
                    </p>
                  </div>
                )}
                {costDataLoaded && (formData.reportBudget || formData.reportEac || formData.jobNumber || formData.projectNumber) && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(formData.reportBudget || formData.reportEac || formData.reportVariance) && (
                      <>
                        {formData.reportBudget !== null && (
                          <div>
                            <label className="block text-xs font-medium text-blue-900 mb-1">
                              Total Budget (from cost report)
                            </label>
                            <div className="text-sm font-semibold text-blue-800">
                              {formatCurrency(formData.reportBudget)}
                            </div>
                          </div>
                        )}
                        {formData.reportEac !== null && (
                          <div>
                            <label className="block text-xs font-medium text-blue-900 mb-1">
                              Forecasted Cost @ Completion (EAC)
                            </label>
                            <div className="text-sm font-semibold text-blue-800">
                              {formatCurrency(formData.reportEac)}
                            </div>
                          </div>
                        )}
                        {formData.reportVariance !== null && (
                          <div>
                            <label className="block text-xs font-medium text-blue-900 mb-1">
                              Variance (from cost report)
                            </label>
                            <div className={`text-sm font-semibold ${
                              formData.reportVariance > 0
                                ? 'text-green-600'
                                : formData.reportVariance < 0
                                  ? 'text-red-600'
                                  : 'text-blue-800'
                            }`}>
                              {formatCurrency(formData.reportVariance)}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {(formData.jobNumber || formData.projectNumber) && (
                      <div className={`sm:col-span-3 ${(formData.reportBudget || formData.reportEac || formData.reportVariance) ? 'mt-2 pt-2 border-t border-blue-200' : ''} grid grid-cols-2 gap-4`}>
                        {formData.jobNumber && (
                          <div>
                            <label className="block text-xs font-medium text-blue-900 mb-1">
                              Job Number (Column A)
                            </label>
                            <div className="text-sm font-semibold text-blue-700">
                              {formData.jobNumber}
                            </div>
                          </div>
                        )}
                        {formData.projectNumber && (
                          <div>
                            <label className="block text-xs font-medium text-blue-900 mb-1">
                              Project Number (Column B)
                            </label>
                            <div className="text-sm font-semibold text-blue-700">
                              {formData.projectNumber}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="sm:col-span-3 mt-2 pt-2 border-t border-blue-200">
                      <p className="text-xs text-blue-700">
                        <strong>Note:</strong> The values above from the cost report will be saved with this report. 
                        The project values shown above are for reference.
                      </p>
                    </div>
                  </div>
                )}
                {!costDataLoading && !costDataLoaded && !costDataError && (
                  <p className="text-sm text-gray-600">
                    Cost data will be loaded automatically from the cost report. 
                    Project values above are currently displayed.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Project Completion Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Project Completion</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Percent Complete (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.percentComplete}
                onChange={(e) => setFormData({ ...formData, percentComplete: parseFloat(e.target.value) || 0 })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0"
              />
              <div className="mt-2">
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all"
                    style={{ width: `${Math.min(Math.max(formData.percentComplete, 0), 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Current: {Math.min(Math.max(formData.percentComplete, 0), 100).toFixed(1)}%
                  {project.percentComplete !== undefined && project.percentComplete !== formData.percentComplete && (
                    <span className="ml-2 text-gray-400">
                      (Project: {project.percentComplete.toFixed(1)}%)
                    </span>
                  )}
                </p>
              </div>
            </div>
            {project.scheduledCompletion && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Scheduled Completion
                </label>
                <input
                  type="text"
                  value={formatDate(project.scheduledCompletion)}
                  disabled
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-600"
                />
                <p className="mt-1 text-xs text-gray-500">Original scheduled completion date</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Actual Completion Date
              </label>
              <input
                type="date"
                value={formData.actualCompletionDate || ''}
                onChange={(e) => setFormData({ ...formData, actualCompletionDate: e.target.value || null })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Select date if project is completed"
              />
              <p className="mt-1 text-xs text-gray-500">Leave blank if project is not yet completed</p>
            </div>
          </div>
        </div>

        {/* Report Details Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Report Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Architect
              </label>
              <input
                type="text"
                value={formData.architect}
                onChange={(e) => setFormData({ ...formData, architect: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Architect name (auto-filled from last report)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Auto-populated from the last report for this project
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Sabey Project Staff
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addStaffMember()
                    }
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter staff name and press Enter"
                />
                <button
                  type="button"
                  onClick={addStaffMember}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              {formData.sabeyProjectStaff.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.sabeyProjectStaff.map((staff, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm text-blue-800 bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 shadow-sm"
                    >
                      {staff}
                      <button
                        type="button"
                        onClick={() => removeStaffMember(index)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Subcontractor Activities</h2>
          <div className="space-y-4">
            {formData.activities.map((activity, index) => (
              <div key={index} className="grid gap-4 rounded-md border border-gray-200 p-4 sm:grid-cols-5">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Company</label>
                  <select
                    required
                    value={activity.subcontractorId}
                    onChange={(e) => updateActivity(index, 'subcontractorId', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {subcontractors.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Craft</label>
                  <select
                    required
                    value={activity.craftId}
                    onChange={(e) => updateActivity(index, 'craftId', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {crafts.map(craft => (
                      <option key={craft.id} value={craft.id}>{craft.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Workers</label>
                  <input
                    type="number"
                    min="0"
                    value={activity.tradeWorkers || ''}
                    onChange={(e) => updateActivity(index, 'tradeWorkers', parseInt(e.target.value) || null)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Source</label>
                  <input
                    type="text"
                    value={activity.source || ''}
                    onChange={(e) => updateActivity(index, 'source', e.target.value || null)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeActivity(index)}
                    className="rounded-md bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addActivity}
              className="w-full rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              + Add Activity
            </button>
            {totalTradeWorkers > 0 && (
              <div className="border-t pt-2 text-sm font-medium text-gray-900">
                Total Trade Workers: {totalTradeWorkers}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Narratives</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Work Performed
              </label>
              <textarea
                rows={6}
                value={formData.workPerformed}
                onChange={(e) => setFormData({ ...formData, workPerformed: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Describe the work performed..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Safety Type
              </label>
              <select
                value={formData.safetyType}
                onChange={(e) => setFormData({ ...formData, safetyType: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {SAFETY_TYPES.map(type => (
                  <option key={type} value={type}>
                    {SAFETY_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Safety Details
              </label>
              <textarea
                rows={4}
                value={formData.safety}
                onChange={(e) => setFormData({ ...formData, safety: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Safety details..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Source
              </label>
              <input
                type="text"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., manual_entry, weekly_project_summary.html"
              />
              <p className="mt-1 text-xs text-gray-500">
                Track where this report data came from (manual entry, imported file, etc.)
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Uploading...' : 'Upload Report'}
          </button>
        </div>
      </form>
      </div>
    </>
  )
}


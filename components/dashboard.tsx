'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils'
import { REGION_NAMES, REGIONS } from '@/lib/constants'
import { AiChat } from '@/components/ai-chat'
import { useLoading } from '@/components/loading-provider'
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react'

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
  percentComplete: number
  projectBudget: number | string
  eac: number | string
  budgetVariance: number | string | null
  latestReportTotalTradeWorkers: number
  reportsCount: number
}

type SortOption = 'alphabetical' | 'budget-high' | 'budget-low' | 'variance-green' | 'variance-red'

// Calculate Monday-Friday for a given week offset (0 = current week, -1 = last week, etc.)
// Note: This excludes weekends (Saturday/Sunday) - only Monday through Friday
// IMPORTANT: Use UTC dates to avoid timezone issues between server and client
const getWeekRange = (weeksAgo: number = 0) => {
  // Use UTC to ensure consistent dates between server and client
  const today = new Date()
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const dayOfWeek = todayUTC.getUTCDay() // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate Monday of current week (excludes Sunday)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(todayUTC)
  monday.setUTCDate(todayUTC.getUTCDate() + mondayOffset)
  monday.setUTCHours(0, 0, 0, 0)
  
  // Adjust by weeksAgo (negative values go back in time)
  if (weeksAgo !== 0) {
    monday.setUTCDate(monday.getUTCDate() + (weeksAgo * 7))
  }
  
  // Friday is exactly 4 days after Monday (Monday + 4 = Friday)
  // This ensures we never include Saturday or Sunday
  const friday = new Date(monday)
  friday.setUTCDate(monday.getUTCDate() + 4) // Add 4 days to Monday's date to get Friday
  friday.setUTCHours(23, 59, 59, 999)
  
  // Verify it's actually Friday (getUTCDay() returns 5 for Friday)
  // This is a safety check to ensure we never accidentally include weekends
  const fridayDayOfWeek = friday.getUTCDay()
  if (fridayDayOfWeek !== 5) {
    // If for some reason it's not Friday, adjust to the nearest Friday
    const adjustment = 5 - fridayDayOfWeek
    friday.setUTCDate(friday.getUTCDate() + adjustment)
  }
  
  // Format as YYYY-MM-DD using UTC to avoid timezone issues
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
// Use consistent date formatting to avoid hydration mismatches
const getWeekRangeOptions = () => {
  const options = []
  for (let i = 0; i <= 12; i++) {
    const range = getWeekRange(-i)
    // Parse dates consistently using UTC
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
    
    // Use consistent date formatting
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

export function Dashboard() {
  const { setLoading: setGlobalLoading } = useLoading()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState<string>('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical')
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({})
  
  // Initialize with no date filter by default (show all projects)
  const [weekOptions] = useState(() => getWeekRangeOptions())
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(-1) // -1 = No filter (show all)
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string } | null>(null)
  
  // Cost report period selection (for viewing historical financial data)
  const [costReportPeriods, setCostReportPeriods] = useState<Array<{ periodStart: string; label: string; sourceFile: string | null }>>([])
  const [selectedCostReportPeriod, setSelectedCostReportPeriod] = useState<string>('') // Empty = latest

  useEffect(() => {
    fetchCostReportPeriods()
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [selectedRegion, search, sortBy, dateRange, selectedCostReportPeriod])

  const fetchCostReportPeriods = async () => {
    try {
      const res = await fetch('/api/cost-report/periods')
      if (res.ok) {
        const data = await res.json()
        setCostReportPeriods(data.periods || [])
      }
    } catch (error) {
      console.error('Error fetching cost report periods:', error)
    }
  }

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedRegion) params.set('region', selectedRegion)
      if (search) params.set('search', search)
      if (dateRange && dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange && dateRange.endDate) params.set('endDate', dateRange.endDate)
      if (selectedCostReportPeriod) params.set('costReportPeriod', selectedCostReportPeriod)
      
      // API route has caching headers, so responses will be cached by the browser
      const res = await fetch(`/api/projects?${params}`)
      
      if (!res.ok) {
        console.error('API request failed:', res.status, res.statusText)
        const errorData = await res.json().catch(() => ({}))
        console.error('Error details:', errorData)
        setProjects([])
        return
      }
      
      const data = await res.json()
      console.log('Projects API response:', { count: Array.isArray(data) ? data.length : 0, isArray: Array.isArray(data) })
      
      // Ensure projects is always an array
      if (Array.isArray(data)) {
        const sorted = sortProjects(data, sortBy)
        console.log('Setting projects:', sorted.length)
        setProjects(sorted)
      } else {
        console.error('API response is not an array:', data)
        // In dev mode, use mock data if API fails
        setProjects([])
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
      // Set empty array on error
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const handleWeekChange = (weekIndex: number) => {
    setSelectedWeekIndex(weekIndex)
    if (weekIndex === -1) {
      // Show all projects (no date filter)
      setDateRange(null)
    } else {
    const selectedWeek = weekOptions[weekIndex]
    setDateRange({
      startDate: selectedWeek.startDate,
      endDate: selectedWeek.endDate,
    })
    }
  }

  const getVarianceColor = (variance: number | string | null) => {
    if (variance === null || variance === undefined) return 'text-gray-600'
    const num = typeof variance === 'string' ? parseFloat(variance) : variance
    if (Number.isNaN(num)) return 'text-gray-600'
    if (num > 0) return 'text-green-600'
    if (num < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getVarianceBarColor = (variance: number | string | null) => {
    if (variance === null || variance === undefined) return 'bg-gray-300'
    const num = typeof variance === 'string' ? parseFloat(variance) : variance
    if (Number.isNaN(num)) return 'bg-gray-300'
    if (num > 0) return 'bg-green-500'
    if (num < 0) return 'bg-red-500'
    return 'bg-gray-300'
  }

  const sortProjects = (projects: Project[], sortOption: SortOption): Project[] => {
    const sorted = [...projects]
    
    switch (sortOption) {
      case 'alphabetical':
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      
      case 'budget-high':
        return sorted.sort((a, b) => {
          const budgetA = typeof a.projectBudget === 'string' ? parseFloat(a.projectBudget) : a.projectBudget
          const budgetB = typeof b.projectBudget === 'string' ? parseFloat(b.projectBudget) : b.projectBudget
          return budgetB - budgetA
        })
      
      case 'budget-low':
        return sorted.sort((a, b) => {
          const budgetA = typeof a.projectBudget === 'string' ? parseFloat(a.projectBudget) : a.projectBudget
          const budgetB = typeof b.projectBudget === 'string' ? parseFloat(b.projectBudget) : b.projectBudget
          return budgetA - budgetB
        })
      
      case 'variance-green':
        return sorted.sort((a, b) => {
          const varianceA = a.budgetVariance ? (typeof a.budgetVariance === 'string' ? parseFloat(a.budgetVariance) : a.budgetVariance) : 0
          const varianceB = b.budgetVariance ? (typeof b.budgetVariance === 'string' ? parseFloat(b.budgetVariance) : b.budgetVariance) : 0
          const aFavorable = varianceA >= 0
          const bFavorable = varianceB >= 0
          if (aFavorable && !bFavorable) return -1
          if (!aFavorable && bFavorable) return 1
          if (aFavorable && bFavorable) return varianceB - varianceA
          return varianceA - varianceB
        })
      
      case 'variance-red':
        return sorted.sort((a, b) => {
          const varianceA = a.budgetVariance ? (typeof a.budgetVariance === 'string' ? parseFloat(a.budgetVariance) : a.budgetVariance) : 0
          const varianceB = b.budgetVariance ? (typeof b.budgetVariance === 'string' ? parseFloat(b.budgetVariance) : b.budgetVariance) : 0
          const aUnfavorable = varianceA < 0
          const bUnfavorable = varianceB < 0
          if (aUnfavorable && !bUnfavorable) return -1
          if (!aUnfavorable && bUnfavorable) return 1
          if (aUnfavorable && bUnfavorable) return varianceA - varianceB
          return varianceB - varianceA
        })
      
      default:
        return sorted
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Regions</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {REGION_NAMES[region]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <label htmlFor="week-select" className="text-sm font-medium text-gray-700">
                  Week:
                </label>
              </div>
              <select
                id="week-select"
                value={selectedWeekIndex}
                onChange={(e) => handleWeekChange(Number(e.target.value))}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={-1}>All Projects (No Date Filter)</option>
                {weekOptions.map((option, index) => (
                  <option key={index} value={index}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Cost Report Period Selector */}
            {costReportPeriods.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <label htmlFor="cost-report-period-select" className="text-sm font-medium text-gray-700">
                    Cost Report Period:
                  </label>
                </div>
                <select
                  id="cost-report-period-select"
                  value={selectedCostReportPeriod}
                  onChange={(e) => setSelectedCostReportPeriod(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Latest Cost Report</option>
                  {costReportPeriods.map((period) => (
                    <option key={period.periodStart} value={period.periodStart}>
                      {period.label} {period.sourceFile ? `(${period.sourceFile})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {dateRange ? (
          <div className="mt-2 text-xs text-gray-500">
            Showing projects with reports from {formatDate(dateRange.startDate)} to {formatDate(dateRange.endDate)}
          </div>
          ) : (
            <div className="mt-2 text-xs text-gray-500">
              Showing all projects (no date filter applied)
            </div>
          )}
          {selectedCostReportPeriod && (
            <div className="mt-2 text-xs text-blue-600 font-medium">
              📊 Viewing financial data from: {costReportPeriods.find(p => p.periodStart === selectedCostReportPeriod)?.label || selectedCostReportPeriod}
            </div>
          )}
        </div>
        
        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-700 self-center">Sort by:</span>
          <button
            onClick={() => setSortBy('alphabetical')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              sortBy === 'alphabetical'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            A-Z
          </button>
          <button
            onClick={() => setSortBy('budget-high')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              sortBy === 'budget-high'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Highest Budget
          </button>
          <button
            onClick={() => setSortBy('budget-low')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              sortBy === 'budget-low'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Lowest Budget
          </button>
          <button
            onClick={() => setSortBy('variance-red')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              sortBy === 'variance-red'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Over Budget First
          </button>
          <button
            onClick={() => setSortBy('variance-green')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              sortBy === 'variance-green'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Under Budget First
          </button>
        </div>
      </div>

      {/* Dev Mode: Quick Access to Create Report */}
      {process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true' && (!Array.isArray(projects) || projects.length === 0) && (
        <div className="mb-6 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-blue-900">Quick Start: Create a Report</h2>
          <p className="mb-4 text-sm text-blue-700">
            In dev mode, you can create a report without a project. Click below to start:
          </p>
          <Link
            href="/reports/new"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create New Report
          </Link>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : !Array.isArray(projects) || projects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No projects found</p>
          <p className="mt-2 text-sm text-gray-400">
            {process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true' 
              ? '(Dev mode: Database not connected. Connect a database to see projects.)'
              : 'Connect a database and seed data to see projects.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            // Group projects by region
            const projectsByRegion: Record<string, typeof projects> = {}
            projects.forEach((project) => {
              const region = project.region || 'OTHER'
              if (!projectsByRegion[region]) {
                projectsByRegion[region] = []
              }
              projectsByRegion[region].push(project)
            })

            // Initialize expanded state for all regions (default: all expanded)
            const allRegions = Object.keys(projectsByRegion)
            const initializedExpanded = { ...expandedRegions }
            allRegions.forEach((region) => {
              if (initializedExpanded[region] === undefined) {
                initializedExpanded[region] = true
              }
            })
            if (Object.keys(expandedRegions).length !== Object.keys(initializedExpanded).length) {
              setExpandedRegions(initializedExpanded)
            }

            return Object.entries(projectsByRegion)
              .sort(([regionA], [regionB]) => {
                // Sort regions alphabetically by name
                const nameA = REGION_NAMES[regionA] || regionA
                const nameB = REGION_NAMES[regionB] || regionB
                return nameA.localeCompare(nameB)
              })
              .map(([region, regionProjects]) => {
                const isExpanded = expandedRegions[region] !== false
                const regionName = REGION_NAMES[region] || region

                return (
                  <div key={region} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    {/* Region Header */}
                    <button
                      onClick={() => setExpandedRegions(prev => ({ ...prev, [region]: !isExpanded }))}
                      className="w-full bg-gradient-to-r from-blue-600 via-blue-300 to-blue-100 text-white px-6 py-4 flex items-center justify-between hover:from-blue-700 hover:via-blue-400 hover:to-blue-200 transition-all"
                    >
                      <h2 className="text-xl font-bold">{regionName}</h2>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium px-3 py-1.5 rounded-full bg-blue-800/60 backdrop-blur-sm border border-blue-900/40 text-white shadow-md">
                          {regionProjects.length} {regionProjects.length === 1 ? 'project' : 'projects'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </button>

                    {/* Region Projects */}
                    {isExpanded && (
                      <div className="p-6">
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                          {regionProjects.map((project) => (
                            <Link
                              key={project.id}
                              href={`/projects/${project.id}`}
                              prefetch={true}
                              onClick={() => setGlobalLoading(true)}
                              className="group relative block rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden"
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
                              {/* Colored header bar based on budget variance */}
                              <div className={`h-2 ${getVarianceBarColor(project.budgetVariance)}`} />
                              
                              <div className="p-6 relative z-0 group-hover:opacity-60 transition-opacity duration-300">
                              <div className="mb-4">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                      {project.name}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                      {(() => {
                                        // Show project numbers from ProjectProjectNumber table first
                                        if (project.projectNumbers && project.projectNumbers.length > 0) {
                                          return project.projectNumbers.map(pn => pn.projectNumber).join(', ')
                                        }
                                        // Fall back to primary projectNumber field
                                        if (project.projectNumber) {
                                          return project.projectNumber
                                        }
                                        // Last resort: show project code
                                        return project.code
                                      })()}
                                    </p>
                                  </div>
                                  <span className="rounded-full px-3 py-1.5 text-xs font-medium text-blue-800 bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 shadow-sm">
                                    {regionName}
                                  </span>
                                </div>
                                {project.tenant && (
                                  <p className="mt-1 text-sm text-gray-600">Tenant: {project.tenant}</p>
                                )}
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <div className="mb-1 flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Progress</span>
                                    <span className="font-medium">{formatPercent(project.percentComplete)}</span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                                    <div
                                      className="h-full bg-blue-600 transition-all"
                                      style={{ width: `${Math.min(project.percentComplete, 100)}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <p className="text-gray-600">Budget</p>
                                    <p className="font-medium">{formatCurrency(project.projectBudget)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">
                                      EAC
                                      <span className="ml-1 text-xs text-gray-400" title="Estimated Cost at Completion">
                                        (Est. Cost)
                                      </span>
                                    </p>
                                    <p className="font-medium">{formatCurrency(project.eac)}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-gray-600">Variance</p>
                                    <p className={`font-medium ${getVarianceColor(project.budgetVariance)}`}>
                                      {formatCurrency(project.budgetVariance)}
                                    </p>
                                  </div>
                                </div>

                                <div className="border-t pt-3">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Trade Workers</span>
                                    <span className="font-medium">
                                      {project.latestReportTotalTradeWorkers || 0}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500 px-2 py-0.5 rounded-full bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 inline-block">
                                    {project.reportsCount} report{project.reportsCount !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
          })()}
        </div>
      )}

      {/* Total Projects Count */}
      {!loading && Array.isArray(projects) && projects.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            {projects.length} Total {projects.length === 1 ? 'Project' : 'Projects'}
          </p>
        </div>
      )}

      {/* AI Chat Sidebar */}
      {!loading && projects.length > 0 && (
        <AiChat projects={projects} weekEnding={dateRange?.endDate || new Date().toISOString().split('T')[0]} />
      )}
    </div>
  )
}


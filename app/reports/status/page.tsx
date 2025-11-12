'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/navbar'
import { WeeklyReportStatus } from '@/components/weekly-report-status'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Calendar } from 'lucide-react'

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

export default function ReportStatusPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [weekOptions] = useState(() => getWeekRangeOptions())
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(1) // Default to Last Week
  const [weekEnding, setWeekEnding] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (session && !['PM', 'EXECUTIVE', 'ADMIN'].includes(session.user.role)) {
      router.push('/')
      return
    }

    // Check for weekEnding in query params first
    const weekEndingParam = searchParams.get('weekEnding')
    
    if (weekEndingParam) {
      // Find the matching week option
      const matchingIndex = weekOptions.findIndex(opt => opt.endDate === weekEndingParam)
      if (matchingIndex >= 0) {
        // Use setTimeout to avoid synchronous setState in effect
        setTimeout(() => {
          setSelectedWeekIndex(matchingIndex)
          setWeekEnding(weekEndingParam)
        }, 0)
      } else {
        // If no match, use default
        const defaultWeek = weekOptions[1]
        setTimeout(() => {
          setWeekEnding(defaultWeek.endDate)
        }, 0)
      }
    } else {
      // Default to last week
      const defaultWeek = weekOptions[1]
      setTimeout(() => {
        setWeekEnding(defaultWeek.endDate)
      }, 0)
    }
  }, [session, status, router, searchParams, weekOptions])

  const handleWeekChange = (weekIndex: number) => {
    setSelectedWeekIndex(weekIndex)
    const selectedWeek = weekOptions[weekIndex]
    setWeekEnding(selectedWeek.endDate)
    router.push(`/reports/status?weekEnding=${selectedWeek.endDate}`)
  }

  if (status === 'loading' || !session) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Weekly Report Status</h1>
            <p className="mt-1 text-gray-600">
              Track which projects have submitted weekly reports
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
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
                {weekOptions.map((option, index) => (
                  <option key={index} value={index}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {weekEnding && (
          <WeeklyReportStatus weekEnding={weekEnding} />
        )}
      </main>
    </div>
  )
}


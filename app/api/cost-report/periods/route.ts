/**
 * GET /api/cost-report/periods
 * Get all available cost report periods (historical data)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all unique periods from ProjectFinancials
    const periods = await prisma.projectFinancials.findMany({
      select: {
        periodStart: true,
        sourceDate: true,
        sourceFile: true,
      },
      distinct: ['periodStart'],
      orderBy: { periodStart: 'desc' },
    })

    // Format periods for frontend
    const formattedPeriods = periods.map(period => ({
      periodStart: period.periodStart.toISOString().split('T')[0],
      sourceDate: period.sourceDate ? period.sourceDate.toISOString().split('T')[0] : null,
      sourceFile: period.sourceFile,
      label: formatPeriodLabel(period.periodStart),
    }))

    return NextResponse.json({ periods: formattedPeriods })
  } catch (error: unknown) {
    console.error('Error fetching cost report periods:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    )
  }
}

function formatPeriodLabel(periodStart: Date): string {
  const date = new Date(periodStart)
  const weekEnding = new Date(date)
  weekEnding.setDate(weekEnding.getDate() + 6) // Add 6 days to get Friday
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  const weekStartStr = date.toLocaleDateString('en-US', options)
  const weekEndStr = weekEnding.toLocaleDateString('en-US', options)
  
  return `Week of ${weekStartStr} - ${weekEndStr}`
}


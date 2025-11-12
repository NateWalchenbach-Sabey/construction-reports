import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

// Calculate Monday-Friday for a given week ending date (Friday)
const getWeekRange = (weekEndingDate: string) => {
  const friday = new Date(weekEndingDate)
  friday.setHours(0, 0, 0, 0)
  
  // Monday is 4 days before Friday
  const monday = new Date(friday)
  monday.setDate(friday.getDate() - 4)
  monday.setHours(0, 0, 0, 0)
  
  return {
    startDate: monday,
    endDate: friday,
  }
}

export async function GET(request: NextRequest) {
  try {
    // Skip auth check in dev mode
    if (process.env.BYPASS_AUTH !== 'true') {
      const { authOptions } = await import('@/lib/auth')
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const searchParams = request.nextUrl.searchParams
    const weekEnding = searchParams.get('weekEnding') // Friday date in YYYY-MM-DD format

    if (!weekEnding) {
      return NextResponse.json({ error: 'weekEnding is required' }, { status: 400 })
    }

    // Calculate week range (Monday-Friday)
    const { startDate, endDate } = getWeekRange(weekEnding)

    // Get all active projects
    const allProjects = await prisma.project.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        projectNumber: true,
        region: true,
      },
      orderBy: { name: 'asc' },
    })

    // Get all reports for this week
    // Include reports with dates from Monday through Friday of the week
    const weekReports = await prisma.report.findMany({
      where: {
        reportDate: {
          gte: startDate,
          lte: endDate,
        },
        reportType: 'WEEKLY', // Only count weekly reports
      },
      select: {
        id: true,
        projectId: true,
        reportDate: true,
        authorId: true,
        author: {
          select: {
            name: true,
            email: true,
          },
        },
        createdAt: true,
      },
      orderBy: { reportDate: 'desc' },
    })

    // Group reports by project
    const reportsByProject = new Map<string, typeof weekReports>()
    weekReports.forEach(report => {
      if (!reportsByProject.has(report.projectId)) {
        reportsByProject.set(report.projectId, [])
      }
      reportsByProject.get(report.projectId)!.push(report)
    })

    // Build status for each project
    const projectStatuses = allProjects.map(project => {
      const projectReports = reportsByProject.get(project.id) || []
      const latestReport = projectReports[0] || null

      return {
        projectId: project.id,
        projectCode: project.code,
        projectNumber: project.projectNumber,
        projectName: project.name,
        region: project.region,
        hasReport: projectReports.length > 0,
        reportCount: projectReports.length,
        latestReportDate: latestReport?.reportDate || null,
        latestReportAuthor: latestReport?.author || null,
        latestReportCreatedAt: latestReport?.createdAt || null,
      }
    })

    // Calculate completion stats
    const totalProjects = allProjects.length
    const completedProjects = projectStatuses.filter(p => p.hasReport).length
    const pendingProjects = totalProjects - completedProjects
    const isComplete = completedProjects === totalProjects && totalProjects > 0

    return NextResponse.json({
      weekEnding,
      weekRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      summary: {
        totalProjects,
        completedProjects,
        pendingProjects,
        isComplete,
        completionPercent: totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0,
      },
      projects: projectStatuses,
    })
  } catch (error) {
    console.error('Error fetching weekly report status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


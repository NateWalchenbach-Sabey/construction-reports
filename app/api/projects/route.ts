import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { getProjectsFinancials, ProjectFinancialData } from '@/lib/get-project-financials'
import { logger, runWithRequestContext, extractTraceId, addContext } from '@/lib/logger'

// Development mode: bypass database
const useDevMode = process.env.BYPASS_AUTH === 'true'

export async function GET(request: NextRequest) {
  const traceId = extractTraceId(request.headers.get('x-request-id'))

  return runWithRequestContext({ traceId }, async () => {
    try {
      // In dev mode, still return real data from database
      // (BYPASS_AUTH just skips authentication, not database access)
      const { prisma } = await import('@/lib/prisma')

      // Use real auth (skip in dev mode)
      let session = null
      if (!useDevMode) {
        const { authOptions } = await import('@/lib/auth')
        session = await getServerSession(authOptions)
        if (!session) {
          const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
          response.headers.set('x-trace-id', traceId)
          return response
        }
      }

      if (session?.user && 'id' in session.user) {
        addContext({ userId: (session.user as { id: string }).id })
      }

      const searchParams = request.nextUrl.searchParams
      const region = searchParams.get('region')
      const search = searchParams.get('search')
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')
      const costReportPeriod = searchParams.get('costReportPeriod') // Optional: specific cost report period to view

      const where: {
        id?: { in: string[] }
        region?: string
        OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; code?: { contains: string; mode: 'insensitive' }; tenant?: { contains: string; mode: 'insensitive' } }>
      } = {}

      // Superintendents only see assigned projects (skip in dev mode)
      if (!useDevMode && session && session.user.role === 'SUPERINTENDENT' && 'id' in session.user) {
        const userId = (session.user as { id: string }).id
        const assignments = await prisma.projectAssignment.findMany({
          where: { userId },
          select: { projectId: true }
        })
        where.id = { in: assignments.map(a => a.projectId) }
      }

      if (region) {
        where.region = region
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { tenant: { contains: search, mode: 'insensitive' } },
        ]
      }

      // Build reports filter for date range
      const reportsWhere: {
        reportDate?: {
          gte?: Date
          lte?: Date
        }
      } = {}
      if (startDate || endDate) {
        reportsWhere.reportDate = {}
        if (startDate) {
          reportsWhere.reportDate.gte = new Date(startDate)
        }
        if (endDate) {
          // Include the entire end date (set to end of day)
          const endDateTime = new Date(endDate)
          endDateTime.setHours(23, 59, 59, 999)
          reportsWhere.reportDate.lte = endDateTime
        }
      }

      // Optimize query - fetch project data and reports in date range
      const projects = await prisma.project.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          projectNumber: true, // Project number from cost report (Column B)
          region: true,
          tenant: true,
          startDate: true,
          scheduledCompletion: true,
          projectBudget: true,
          eac: true,
          budgetVariance: true,
          percentComplete: true,
          projectNumbers: {
            select: {
              id: true,
              projectNumber: true,
              source: true,
              notes: true,
            },
            orderBy: { projectNumber: 'asc' },
          },
          reports: Object.keys(reportsWhere).length > 0 ? {
            where: reportsWhere,
            take: 1,
            orderBy: { reportDate: 'desc' },
            select: {
              id: true,
              reportDate: true,
              reportType: true,
              workPerformed: true,
              safety: true,
              totalTradeWorkers: true,
              activities: {
                select: {
                  tradeWorkers: true,
                  craft: { select: { name: true } },
                  subcontractor: { select: { name: true } },
                }
              },
              author: {
                select: { name: true, email: true }
              }
            }
          } : {
            take: 1,
            orderBy: { reportDate: 'desc' },
            select: {
              id: true,
              reportDate: true,
              reportType: true,
              workPerformed: true,
              safety: true,
              totalTradeWorkers: true,
              activities: {
                select: {
                  tradeWorkers: true,
                  craft: { select: { name: true } },
                  subcontractor: { select: { name: true } },
                }
              },
              author: {
                select: { name: true, email: true }
              }
            }
          },
          _count: {
            select: { 
              reports: true
            }
          }
        },
        orderBy: { name: 'asc' }
      })

      // Fetch latest financial data for each project by matching project numbers
      const projectIds = projects.map((project) => project.id)
      let financialsMap: Map<string, ProjectFinancialData> = new Map()
      try {
        financialsMap = await getProjectsFinancials(projectIds, costReportPeriod || undefined)
      } catch (financialsError: unknown) {
        const errorMessage = financialsError instanceof Error ? financialsError.message : 'Unknown error'
        logger.warn('Error fetching cost report financials', {
          error: errorMessage,
        })
      }

      // Calculate total trade workers from latest report in date range
      // Use cost data from latest report with cost data (regardless of date range)
      // Filter projects to only show those with reports in the date range
      type ProjectWithReports = typeof projects[0] & {
        reports?: Array<{
          activities?: Array<{ tradeWorkers?: number | null }>
        }>
        projectNumbers?: Array<{ id: string; projectNumber: string; source: string | null; notes: string | null }>
        _count?: { reports: number }
      }
      
      const projectsWithMetrics = projects
        .map(project => {
          const projectWithReports = project as ProjectWithReports
          const latestReportInRange = projectWithReports.reports?.[0]
          const totalTradeWorkers = latestReportInRange?.activities?.reduce(
            (sum: number, a: { tradeWorkers?: number | null }) => sum + (a.tradeWorkers || 0), 0
          ) || 0

          // Use cost data from ProjectFinancials (ingested data) or Report snapshots (fallback)
          // Cost reports are the source of truth - only use project defaults if absolutely no cost report data exists
          // This ensures we don't show stale seed data that conflicts with cost report data
          const latestFinancialData = financialsMap.get(project.id)
          const budget = latestFinancialData?.budget ?? 0
          const eac = latestFinancialData?.eac ?? 0
          const variance = latestFinancialData?.variance ?? (eac && budget ? (parseFloat(eac.toString()) - parseFloat(budget.toString())) : null)

          return {
            ...project,
            projectNumber: projectWithReports.projectNumber, // Include projectNumber in response
            projectNumbers: projectWithReports.projectNumbers, // Always include projectNumbers for dashboard display
            // Override with latest cost data from reports
            projectBudget: budget,
            eac: eac,
            budgetVariance: variance,
            latestReportTotalTradeWorkers: totalTradeWorkers,
            reportsCount: projectWithReports._count?.reports || 0,
          }
        })
        // If date range is specified, only show projects with reports in that range
        // But if no projects have reports in that range, show all projects anyway (so user can see what's available)
        .filter(project => {
          const projectWithReports = projects.find(p => p.id === project.id) as ProjectWithReports | undefined
          if (startDate || endDate) {
            // Check if ANY project has reports in the date range
            const hasAnyReportsInRange = projects.some((p) => {
              const pWithReports = p as ProjectWithReports
              return (pWithReports.reports?.length ?? 0) > 0
            })
            
            if (hasAnyReportsInRange) {
              // If some projects have reports, only show projects with reports in this range
              return (projectWithReports?.reports?.length ?? 0) > 0
            } else {
              // If NO projects have reports in this date range, show ALL projects
              // This way users can still see available projects even if they haven't reported yet
              return true
            }
          }
          // No date range filter - show all projects
          return true
        })

      const response = NextResponse.json(projectsWithMetrics)
      // Cache for 30 seconds to improve performance
      response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
      response.headers.set('x-trace-id', traceId)
      return response
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      logger.error('Error fetching projects', {
        error: errorMessage,
        stack: errorStack,
      })
      const response = NextResponse.json({ 
        error: 'Internal server error',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      }, { status: 500 })
      response.headers.set('x-trace-id', traceId)
      return response
    }
  })
}

export async function POST(request: NextRequest) {
  const traceId = extractTraceId(request.headers.get('x-request-id'))

  return runWithRequestContext({ traceId }, async () => {
    try {
      const session = await getServerSession(authOptions)
      if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'PM')) {
        const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        response.headers.set('x-trace-id', traceId)
        return response
      }

      if ('id' in session.user) {
        addContext({ userId: (session.user as { id: string }).id })
      }

      const body = await request.json()
      const {
        code,
        name,
        region,
        tenant,
        startDate,
        scheduledCompletion,
        projectBudget,
        eac,
        budgetVarianceNote,
        percentComplete,
        statusNote,
        tags,
      } = body

      const budgetVariance = eac ? (parseFloat(eac) - parseFloat(projectBudget)) : null

      const project = await prisma.project.create({
        data: {
          code,
          name,
          region,
          tenant: tenant || null,
          projectNumber: body.projectNumber || null, // Project number from cost report (Column B)
          startDate: new Date(startDate),
          scheduledCompletion: scheduledCompletion ? new Date(scheduledCompletion) : null,
          projectBudget: parseFloat(projectBudget),
          eac: parseFloat(eac || projectBudget),
          budgetVariance,
          budgetVarianceNote: budgetVarianceNote || null,
          percentComplete: parseFloat(percentComplete || 0),
          statusNote: statusNote || null,
          tags: tags || [],
        }
      })

      const response = NextResponse.json(project, { status: 201 })
      response.headers.set('x-trace-id', traceId)
      return response
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      logger.error('Error creating project', {
        error: errorMessage,
        stack: errorStack,
      })
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        const response = NextResponse.json({ error: 'Project code already exists' }, { status: 400 })
        response.headers.set('x-trace-id', traceId)
        return response
      }
      const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      response.headers.set('x-trace-id', traceId)
      return response
    }
  })
}


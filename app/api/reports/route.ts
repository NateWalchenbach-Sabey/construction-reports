import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const reportType = searchParams.get('reportType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = searchParams.get('limit')

    const where: {
      projectId?: string | { in: string[] }
      reportType?: string
      reportDate?: {
        gte?: Date
        lte?: Date
      }
    } = {}

    if (projectId) {
      where.projectId = projectId
    }

    if (reportType) {
      where.reportType = reportType
    }

    if (startDate || endDate) {
      where.reportDate = {}
      if (startDate) where.reportDate.gte = new Date(startDate)
      if (endDate) where.reportDate.lte = new Date(endDate)
    }

    // Superintendents only see reports for their projects
    if (session.user.role === 'SUPERINTENDENT' && 'id' in session.user) {
      const userId = (session.user as { id: string }).id
      const assignments = await prisma.projectAssignment.findMany({
        where: { userId },
        select: { projectId: true }
      })
      where.projectId = { in: assignments.map(a => a.projectId) }
    }

    const reports = await prisma.report.findMany({
      where,
      include: {
        project: {
          select: { code: true, name: true }
        },
        author: {
          select: { name: true, email: true }
        },
        activities: {
          include: {
            subcontractor: true,
            craft: true,
          }
        },
        attachments: true,
      },
      orderBy: { reportDate: 'desc' },
      take: limit ? parseInt(limit) : undefined,
    })

    const response = NextResponse.json(reports)
    // Cache for 10 seconds
    response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')
    return response
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Skip auth check in dev mode
    const bypassAuth = process.env.BYPASS_AUTH === 'true'
    let session = null
    
    if (!bypassAuth) {
      const { authOptions } = await import('@/lib/auth')
      session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    const {
      projectId,
      reportDate,
      reportType,
      workPerformed,
      safety,
      safetyType,
      source,
      architect,
      sabeyProjectStaff,
      activities,
      customFields,
      // Cost data from cost report
      reportBudget,
      reportEac,
      reportVariance,
      jobNumber,
      projectNumber,
    } = body

    // Validate project access for superintendents (only if not bypassing auth)
    if (!bypassAuth && session && session.user.role === 'SUPERINTENDENT' && 'id' in session.user) {
      const userId = (session.user as { id: string }).id
      const assignment = await prisma.projectAssignment.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId
          }
        }
      })
      if (!assignment) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Calculate total trade workers
    const totalTradeWorkers = activities?.reduce(
      (sum: number, a: { tradeWorkers?: number | null }) => sum + (a.tradeWorkers || 0), 0
    ) || 0

    // Get or create dev user in dev mode
    let authorId: string
    if (bypassAuth) {
      // In dev mode, find any existing user (prefer admin, then any user)
      try {
        // First try to find admin user (created by seed script)
        let devUser = await prisma.user.findFirst({
          where: { 
            OR: [
              { email: 'admin@example.com' },
              { email: 'dev@example.com' },
              { role: 'ADMIN' }
            ]
          }
        })
        
        // If no admin found, get any user
        if (!devUser) {
          devUser = await prisma.user.findFirst()
        }
        
        // If still no user, try to create one
        if (!devUser) {
          try {
            const bcrypt = await import('bcryptjs')
            const passwordHash = await bcrypt.default.hash('dev123', 10)
            devUser = await prisma.user.create({
              data: {
                email: 'dev@example.com',
                name: 'Dev User',
                passwordHash,
                role: 'ADMIN'
              }
            })
          } catch (createError: unknown) {
            throw new Error('No users found in database. Please run: npm run db:seed')
          }
        }
        authorId = devUser.id
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : 'Unknown error'
        console.error('Error getting dev user:', userError)
        throw new Error(`Failed to get user for report: ${errorMessage}`)
      }
    } else {
      if (!('id' in session!.user)) {
        throw new Error('User ID not found in session')
      }
      authorId = (session!.user as { id: string }).id
    }

    const report = await prisma.report.create({
      data: {
        projectId,
        reportDate: new Date(reportDate),
        reportType,
        workPerformed: workPerformed || null,
        safety: safety || null,
        safetyType: safetyType || null,
        source: source || null,
        architect: architect || null,
        sabeyProjectStaff: sabeyProjectStaff || [],
        totalTradeWorkers: totalTradeWorkers > 0 ? totalTradeWorkers : null,
        authorId,
        // Cost data snapshot at time of report
        reportBudget: reportBudget !== undefined && reportBudget !== null ? parseFloat(reportBudget) : null,
        reportEac: reportEac !== undefined && reportEac !== null ? parseFloat(reportEac) : null,
        reportVariance: reportVariance !== undefined && reportVariance !== null ? parseFloat(reportVariance) : null,
        jobNumber: jobNumber || null,
        projectNumber: projectNumber || null,
        activities: {
          create: (activities || []).map((activity: {
            subcontractorId: string
            craftId: string
            tradeWorkers?: number | null
            notes?: string | null
            source?: string | null
          }) => ({
            subcontractorId: activity.subcontractorId,
            craftId: activity.craftId,
            tradeWorkers: activity.tradeWorkers || null,
            notes: activity.notes || null,
            source: activity.source || null,
          }))
        },
        customFieldValues: {
          create: (customFields || []).map((cf: {
            fieldId: string
            value: string | null
          }) => ({
            fieldId: cf.fieldId,
            value: cf.value,
          }))
        }
      },
      include: {
        project: true,
        author: true,
        activities: {
          include: {
            subcontractor: true,
            craft: true,
          }
        }
      }
    })

    return NextResponse.json(report, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating report:', error)
    // Return more detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN_ERROR'
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json({ 
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 })
  }
}


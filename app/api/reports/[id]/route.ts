import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const report = await prisma.report.findUnique({
      where: { id: params.id },
      include: {
        project: true,
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
        customFieldValues: {
          include: {
            field: true
          }
        }
      }
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Check permissions for superintendents
    if (session.user.role === 'SUPERINTENDENT' && 'id' in session.user) {
      const userId = (session.user as { id: string }).id
      const assignment = await prisma.projectAssignment.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId: report.projectId
          }
        }
      })
      if (!assignment) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error fetching report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
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

    // Check permissions
    const existingReport = await prisma.report.findUnique({
      where: { id: params.id },
      include: { project: true }
    })

    if (!existingReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (session.user.role === 'SUPERINTENDENT' && 'id' in session.user) {
      const userId = (session.user as { id: string }).id
      const assignment = await prisma.projectAssignment.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId: existingReport.projectId
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

    // Update report
    const updateData: {
      reportDate?: Date
      reportType?: string
      workPerformed?: string | null
      safety?: string | null
      safetyType?: string
      source?: string | null
      architect?: string | null
      sabeyProjectStaff?: string[]
      totalTradeWorkers?: number
      reportBudget?: number | null
      reportEac?: number | null
      reportVariance?: number | null
      jobNumber?: string | null
      projectNumber?: string | null
    } = {}
    if (reportDate !== undefined) updateData.reportDate = new Date(reportDate)
    if (reportType !== undefined) updateData.reportType = reportType
    if (workPerformed !== undefined) updateData.workPerformed = workPerformed
    if (safety !== undefined) updateData.safety = safety
    if (safetyType !== undefined) updateData.safetyType = safetyType
    if (source !== undefined) updateData.source = source
    if (architect !== undefined) updateData.architect = architect
    if (sabeyProjectStaff !== undefined) updateData.sabeyProjectStaff = sabeyProjectStaff
    if (totalTradeWorkers > 0) updateData.totalTradeWorkers = totalTradeWorkers
    // Cost data
    if (reportBudget !== undefined) updateData.reportBudget = reportBudget !== null ? parseFloat(reportBudget) : null
    if (reportEac !== undefined) updateData.reportEac = reportEac !== null ? parseFloat(reportEac) : null
    if (reportVariance !== undefined) updateData.reportVariance = reportVariance !== null ? parseFloat(reportVariance) : null
    if (jobNumber !== undefined) updateData.jobNumber = jobNumber
    if (projectNumber !== undefined) updateData.projectNumber = projectNumber

    await prisma.report.update({
      where: { id: params.id },
      data: updateData,
    })

    // Update activities if provided
    if (activities !== undefined) {
      await prisma.reportSubcontractorActivity.deleteMany({
        where: { reportId: params.id }
      })
      await prisma.reportSubcontractorActivity.createMany({
        data: activities.map((activity: {
          subcontractorId: string
          craftId: string
          tradeWorkers?: number | null
          notes?: string | null
          source?: string | null
        }) => ({
          reportId: params.id,
          subcontractorId: activity.subcontractorId,
          craftId: activity.craftId,
          tradeWorkers: activity.tradeWorkers || null,
          notes: activity.notes || null,
          source: activity.source || null,
        }))
      })
    }

    // Update custom fields if provided
    if (customFields !== undefined) {
      await prisma.reportCustomFieldValue.deleteMany({
        where: { reportId: params.id }
      })
      if (customFields.length > 0) {
        await prisma.reportCustomFieldValue.createMany({
          data: customFields.map((cf: {
            fieldId: string
            value: string | null
          }) => ({
            reportId: params.id,
            fieldId: cf.fieldId,
            value: cf.value,
          }))
        })
      }
    }

    const updatedReport = await prisma.report.findUnique({
      where: { id: params.id },
      include: {
        project: true,
        author: true,
        activities: {
          include: {
            subcontractor: true,
            craft: true,
          }
        },
        customFieldValues: {
          include: {
            field: true
          }
        }
      }
    })

    return NextResponse.json(updatedReport)
  } catch (error) {
    console.error('Error updating report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


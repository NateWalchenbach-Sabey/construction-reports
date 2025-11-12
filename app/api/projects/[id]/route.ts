import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getProjectFinancials } from '@/lib/get-project-financials'

/**
 * GET /api/projects/[id]
 * Get a single project by ID with financial data from cost reports
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        projectNumbers: {
          select: {
            id: true,
            projectNumber: true,
            source: true,
            notes: true,
          },
          orderBy: { projectNumber: 'asc' },
        },
        reports: {
          orderBy: { reportDate: 'desc' },
          include: {
            activities: {
              include: {
                subcontractor: true,
                craft: true,
              },
            },
            author: {
              select: { name: true, email: true },
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get financial data from ProjectFinancials (cost reports)
    const financials = await getProjectFinancials(params.id)

    // Override project financials with cost report data if available
    return NextResponse.json({
      ...project,
      projectBudget: financials.budget !== null ? financials.budget : project.projectBudget,
      eac: financials.eac !== null ? financials.eac : project.eac,
      budgetVariance: financials.variance !== null ? financials.variance : (financials.eac && financials.budget ? financials.eac - financials.budget : project.budgetVariance),
      financialBreakdown: financials.breakdown || [],
    })
  } catch (error: unknown) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]
 * Update a project (limited fields for safety)
 * Only allows updating: name, region, tenant, statusNote, percentComplete
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, region, tenant, statusNote, percentComplete } = body

    // Validate that only allowed fields are being updated
    const allowedFields = ['name', 'region', 'tenant', 'statusNote', 'percentComplete']
    const providedFields = Object.keys(body)
    const invalidFields = providedFields.filter(field => !allowedFields.includes(field))
    
    if (invalidFields.length > 0) {
      return NextResponse.json(
        { error: `Invalid fields: ${invalidFields.join(', ')}. Only name, region, tenant, statusNote, and percentComplete can be updated.` },
        { status: 400 }
      )
    }

    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build update object with only provided and valid fields
    const updateData: {
      name?: string
      region?: string
      tenant?: string | null
      statusNote?: string | null
      percentComplete?: number
    } = {}
    if (name !== undefined) updateData.name = name.trim()
    if (region !== undefined) updateData.region = region
    if (tenant !== undefined) updateData.tenant = tenant?.trim() || null
    if (statusNote !== undefined) updateData.statusNote = statusNote?.trim() || null
    if (percentComplete !== undefined) {
      const parsed = parseFloat(percentComplete)
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        return NextResponse.json({ error: 'percentComplete must be a number between 0 and 100' }, { status: 400 })
      }
      updateData.percentComplete = parsed
    }

    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
      include: {
        projectNumbers: {
          select: {
            id: true,
            projectNumber: true,
            source: true,
            notes: true,
          },
          orderBy: { projectNumber: 'asc' },
        },
      },
    })

    return NextResponse.json(updatedProject)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Internal server error', message: errorMessage }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete the project (cascade will delete related records)
    await prisma.project.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Internal server error', message: errorMessage }, { status: 500 })
  }
}

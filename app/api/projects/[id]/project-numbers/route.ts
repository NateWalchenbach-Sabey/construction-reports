import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/projects/[id]/project-numbers
 * Add a project number to a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'PM')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectNumber, source, notes } = body

    if (!projectNumber || typeof projectNumber !== 'string') {
      return NextResponse.json({ error: 'projectNumber is required' }, { status: 400 })
    }

    const normalizedProjectNumber = projectNumber.trim().toLowerCase()

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create project number
    const projectProjectNumber = await prisma.projectProjectNumber.create({
      data: {
        projectId: params.id,
        projectNumber: normalizedProjectNumber,
        source: source || 'manual',
        notes: notes || null,
      },
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(projectProjectNumber)
  } catch (error: unknown) {
    console.error('Error adding project number:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Project number already exists for this project' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/projects/[id]/project-numbers
 * Get all project numbers for a project
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

    const projectNumbers = await prisma.projectProjectNumber.findMany({
      where: { projectId: params.id },
      orderBy: { projectNumber: 'asc' },
    })

    return NextResponse.json(projectNumbers)
  } catch (error: unknown) {
    console.error('Error fetching project numbers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


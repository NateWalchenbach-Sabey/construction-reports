import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/projects/[id]/project-number
 * Update project number for a specific project
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'PM')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectNumber } = body

    if (projectNumber === undefined) {
      return NextResponse.json({ error: 'projectNumber is required' }, { status: 400 })
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: { 
        projectNumber: projectNumber && projectNumber.trim() !== '' ? projectNumber.trim() : null 
      },
      select: {
        id: true,
        code: true,
        name: true,
        projectNumber: true,
      },
    })

    return NextResponse.json(project)
  } catch (error: unknown) {
    console.error('Error updating project number:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


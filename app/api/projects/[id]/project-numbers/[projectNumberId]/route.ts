import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/projects/[id]/project-numbers/[projectNumberId]
 * Delete a project number from a project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; projectNumberId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'PM')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the project number belongs to this project
    const projectProjectNumber = await prisma.projectProjectNumber.findUnique({
      where: { id: params.projectNumberId },
    })

    if (!projectProjectNumber) {
      return NextResponse.json({ error: 'Project number not found' }, { status: 404 })
    }

    if (projectProjectNumber.projectId !== params.id) {
      return NextResponse.json({ error: 'Project number does not belong to this project' }, { status: 403 })
    }

    // Delete the project number
    await prisma.projectProjectNumber.delete({
      where: { id: params.projectNumberId },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting project number:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


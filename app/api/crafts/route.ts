import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Development mode: return mock data
const useDevMode = process.env.BYPASS_AUTH === 'true'

export async function GET() {
  try {
    // Skip auth check in dev mode
    if (!useDevMode) {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const crafts = await prisma.craft.findMany({
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(crafts)
  } catch (error) {
    console.error('Error fetching crafts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    const craft = await prisma.craft.create({
      data: { name }
    })

    return NextResponse.json(craft, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating craft:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Craft name already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


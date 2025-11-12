import { NextRequest, NextResponse } from 'next/server'

// Development mode: return mock data
const useDevMode = process.env.BYPASS_AUTH === 'true'

export async function GET(request: NextRequest) {
  try {
    // Use real database (skip auth in dev mode)
    const { prisma } = await import('@/lib/prisma')
    
    // Skip auth check in dev mode
    if (!useDevMode) {
      const { getServerSession } = await import('next-auth')
      const { authOptions } = await import('@/lib/auth')
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')

    const where: {
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' }
        shortName?: { contains: string; mode: 'insensitive' }
      }>
    } = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const subcontractors = await prisma.subcontractorCompany.findMany({
      where,
      include: {
        defaultCrafts: {
          include: {
            craft: true
          }
        },
        contacts: true,
        _count: {
          select: { activities: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(subcontractors)
  } catch (error) {
    console.error('Error fetching subcontractors:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'PM')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, shortName, defaultCrafts, contacts } = body

    const subcontractor = await prisma.subcontractorCompany.create({
      data: {
        name,
        shortName: shortName || null,
        defaultCrafts: {
          create: (defaultCrafts || []).map((craftId: string) => ({
            craftId
          }))
        },
        contacts: {
          create: (contacts || []).map((contact: {
            name: string
            phone?: string | null
            email?: string | null
          }) => ({
            name: contact.name,
            phone: contact.phone || null,
            email: contact.email || null,
          }))
        }
      },
      include: {
        defaultCrafts: {
          include: {
            craft: true
          }
        },
        contacts: true
      }
    })

    return NextResponse.json(subcontractor, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating subcontractor:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Subcontractor name already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


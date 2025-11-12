/**
 * POST /api/cost-report/diagnostics
 * 
 * Diagnoses matching between cost report Excel file and database projects
 * Returns a detailed report showing which projects match and why
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { diagnoseCostReportMatching, generateMatchingReport } from '@/lib/cost-report-matching-diagnostics'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN and PM can run diagnostics
    if (session.user.role !== 'ADMIN' && session.user.role !== 'PM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const fileName = file.name
    if (!fileName.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .xlsx and .xls files are allowed.' },
        { status: 400 }
      )
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    logger.info('Running cost report matching diagnostics', {
      fileName,
      fileSize: buffer.length,
    })

    // Run diagnostics
    const diagnostics = await diagnoseCostReportMatching(buffer)
    const report = generateMatchingReport(diagnostics)

    return NextResponse.json({
      success: true,
      diagnostics,
      report,
    })
  } catch (error: unknown) {
    logger.error('Error running diagnostics', {
      error,
    })

    const message = error instanceof Error ? error.message : 'Failed to run diagnostics'
    const details = error instanceof Error ? error.stack : undefined

    return NextResponse.json(
      {
        error: message,
        details: process.env.NODE_ENV === 'development' ? details : undefined,
      },
      { status: 500 }
    )
  }
}


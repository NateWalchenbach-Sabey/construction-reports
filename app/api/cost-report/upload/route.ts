import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { saveCostReportFile, listCostReports, extractDateFromFilename } from '@/lib/cost-report-storage'
import { ingestCostReportBuffer } from '@/lib/costReportIngest'
import { logger } from '@/lib/logger'

/**
 * POST /api/cost-report/upload
 * Upload a new cost report file and automatically ingest financial data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN and PM can upload cost reports
    if (session.user.role !== 'ADMIN' && session.user.role !== 'PM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const autoIngest = formData.get('autoIngest') !== 'false' // Default to true

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

    // Save the file
    const userId = 'id' in session.user ? (session.user as { id: string }).id : undefined
    const result = await saveCostReportFile(
      buffer,
      fileName,
      userId || 'unknown'
    )

    // Automatically ingest financial data if autoIngest is true
    let ingestionResult = null
    if (autoIngest) {
      try {
        logger.info('Auto-ingesting cost report after upload', {
          fileName: result.fileName,
          reportDate: result.reportDate,
        })

        // Extract period start from report date or filename
        // Period start is always Monday of the week (start of reporting period)
        let periodStartDate: Date | undefined
        if (result.reportDate) {
          periodStartDate = new Date(result.reportDate)
        } else {
          // Try to extract from filename
          const extractedDate = extractDateFromFilename(fileName)
          if (extractedDate) {
            periodStartDate = extractedDate
          }
        }

        // If we still don't have a date, use today
        if (!periodStartDate) {
          periodStartDate = new Date()
        }

        // Calculate Monday of that week (period start)
        // This ensures all financial data for the same week is stored with the same periodStart
        const dayOfWeek = periodStartDate.getDay()
        const diff = periodStartDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Adjust when day is Sunday
        const monday = new Date(periodStartDate)
        monday.setDate(diff)
        monday.setHours(0, 0, 0, 0) // Start of day
        
        const periodStart = monday.toISOString().split('T')[0]

        // Ingest the cost report
        ingestionResult = await ingestCostReportBuffer(buffer, {
          dryRun: false,
          periodStart,
          sourceFileName: result.fileName,
          sourceDate: result.reportDate ? new Date(result.reportDate) : undefined,
        })

        logger.info('Cost report ingestion complete', {
          summary: ingestionResult.summary,
        })
      } catch (ingestionError: unknown) {
        const errorMessage = ingestionError instanceof Error ? ingestionError.message : 'Unknown error'
        logger.error('Failed to ingest cost report after upload', {
          error: errorMessage,
          fileName: result.fileName,
        })
        // Don't fail the upload if ingestion fails - file is still saved
        // But include error in response
        return NextResponse.json({
          success: true,
          message: 'Cost report uploaded successfully, but ingestion failed',
          costReport: result,
          ingestionError: errorMessage,
          ingestionSuccess: false,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cost report uploaded and ingested successfully',
      costReport: result,
      ingestion: ingestionResult ? {
        success: true,
        summary: ingestionResult.summary,
        matchedRows: ingestionResult.rows.length,
        unmatchedRows: ingestionResult.unmatchedRows.length,
      } : null,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload cost report'
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error('Error uploading cost report', {
      error: errorMessage,
      stack: errorStack,
    })
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cost-report/upload
 * List all uploaded cost reports
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') !== 'false'

    const costReports = await listCostReports(includeInactive)

    return NextResponse.json({ costReports })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list cost reports'
    console.error('Error listing cost reports:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}


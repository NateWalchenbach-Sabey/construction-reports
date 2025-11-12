/**
 * POST /api/cost-report/ingest
 * 
 * Ingests a Cost Report Summary Excel file, matches rows to existing projects,
 * and upserts financial data into the database.
 * 
 * Request: multipart/form-data
 *   - file: Excel file (required)
 *   - periodStart: ISO date string for reporting period (required if dryRun=false)
 *   - dryRun: "true" or "false" (default: "false")
 * 
 * Response: JSON with ingestion summary and matched rows
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ingestCostReportBuffer, IngestOptions } from '@/lib/costReportIngest'
import { logger, runWithRequestContext, extractTraceId, addContext } from '@/lib/logger'

type SessionUser = {
  id?: string
  role?: string
}

const getSessionUser = (session: Session | null): SessionUser => {
  if (!session?.user) {
    return {}
  }

  const { id, role } = session.user as Record<string, unknown>

  return {
    id: typeof id === 'string' ? id : undefined,
    role: typeof role === 'string' ? role : undefined,
  }
}

/**
 * Parse multipart/form-data request
 */
async function parseFormData(request: NextRequest): Promise<{
  file: File | null
  periodStart: string | null
  dryRun: boolean
}> {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const periodStart = formData.get('periodStart') as string | null
    const dryRunStr = formData.get('dryRun') as string | null
    const dryRun = dryRunStr === 'true' || dryRunStr === '1'

    return { file, periodStart, dryRun }
  } catch (error: unknown) {
    logger.error('Failed to parse form data', { error })
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to parse form data: ${message}`)
  }
}

/**
 * POST handler for cost report ingestion
 */
export async function POST(request: NextRequest) {
  const traceId = extractTraceId(request.headers.get('x-request-id'))

  return runWithRequestContext({ traceId }, async () => {
    try {
      // Authenticate user
      const session = await getServerSession(authOptions)
      if (!session) {
        const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        response.headers.set('x-trace-id', traceId)
        return response
      }

      // Check permissions (only ADMIN and PM can ingest)
      const sessionUser = getSessionUser(session)
      const userRole = sessionUser.role
      if (userRole !== 'ADMIN' && userRole !== 'PM') {
        const response = NextResponse.json(
          { error: 'Forbidden: Only ADMIN and PM roles can ingest cost reports' },
          { status: 403 }
        )
        response.headers.set('x-trace-id', traceId)
        return response
      }

      if (sessionUser.id) {
        addContext({ userId: sessionUser.id })
      }

      // Parse form data
      const { file, periodStart, dryRun } = await parseFormData(request)

      if (!file) {
        const response = NextResponse.json(
          { error: 'File is required' },
          { status: 400 }
        )
        response.headers.set('x-trace-id', traceId)
        return response
      }

      // Validate file type
      const fileName = file.name
      const fileExtension = fileName.split('.').pop()?.toLowerCase()
      if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
        const response = NextResponse.json(
          { error: 'Invalid file type. Only .xlsx and .xls files are supported' },
          { status: 400 }
        )
        response.headers.set('x-trace-id', traceId)
        return response
      }

      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        const response = NextResponse.json(
          { error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB` },
          { status: 400 }
        )
        response.headers.set('x-trace-id', traceId)
        return response
      }

      // Validate periodStart if not dry run
      if (!dryRun && !periodStart) {
        const response = NextResponse.json(
          { error: 'periodStart is required when dryRun is false' },
          { status: 400 }
        )
        response.headers.set('x-trace-id', traceId)
        return response
      }

      if (periodStart) {
        const periodStartDate = new Date(periodStart)
        if (isNaN(periodStartDate.getTime())) {
          const response = NextResponse.json(
            { error: `Invalid periodStart date: ${periodStart}` },
            { status: 400 }
          )
          response.headers.set('x-trace-id', traceId)
          return response
        }
      }

      logger.info('Cost report ingestion request', {
        fileName,
        fileSize: file.size,
        periodStart,
        dryRun,
        userId: sessionUser.id,
      })

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Extract date from filename if possible (e.g., "Cost Report Summary 10.15.25.xlsx")
      let sourceDate: Date | undefined
      const dateMatch = fileName.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
      if (dateMatch) {
        const [, month, day, year] = dateMatch
        const fullYear = year.length === 2 ? `20${year}` : year
        sourceDate = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
        if (isNaN(sourceDate.getTime())) {
          sourceDate = undefined
        }
      }

      // Prepare ingestion options
      const options: IngestOptions = {
        periodStart: periodStart || undefined,
        dryRun,
        sourceFileName: fileName,
        sourceDate,
      }

      // Ingest cost report
      const result = await ingestCostReportBuffer(buffer, options)

      logger.info('Cost report ingestion complete', {
        summary: result.summary,
        dryRun,
      })

      // Return result
      const response = NextResponse.json({
        success: true,
        dryRun,
        ...result,
      })
      response.headers.set('x-trace-id', traceId)
      return response
    } catch (error: unknown) {
      logger.error('Cost report ingestion failed', {
        error,
      })

      const message = error instanceof Error ? error.message : 'Failed to ingest cost report'
      const details = error instanceof Error ? error.stack : undefined

      const response = NextResponse.json(
        {
          error: message,
          details: process.env.NODE_ENV === 'development' ? details : undefined,
        },
        { status: 500 }
      )
      response.headers.set('x-trace-id', traceId)
      return response
    }
  })
}


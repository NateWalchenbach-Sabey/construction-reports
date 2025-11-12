import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loadCostReport, findCostDataForProject } from '@/lib/cost-report-loader'
import { getActiveCostReport, getCostReportForDate } from '@/lib/cost-report-storage'
import path from 'path'
import fs from 'fs'

/**
 * GET /api/cost-report
 * Fetches cost report data for a project
 * 
 * Priority order:
 * 1. ProjectFinancials table (ingested data) - for the report date or latest
 * 2. Excel file parsing (fallback/legacy)
 * 
 * Query params:
 *   - projectId: Project ID to look up (required)
 *   - reportDate: Optional date for the report (defaults to latest)
 *   - jobNumber: Optional Job Number to match (legacy/fallback)
 *   - filePath: Optional path to cost report file (legacy/fallback)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const filePath = searchParams.get('filePath')
    const reportDate = searchParams.get('reportDate') // Optional: get cost report for specific date

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Fetch project
    const { prisma } = await import('@/lib/prisma')
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        code: true,
        name: true,
        jobNumber: true,
        projectNumber: true,
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // PRIORITY 1: Try to get financial data from ProjectFinancials table (ingested data)
    try {
      const financialsQuery: {
        where: { projectId: string; periodStart?: { lte: Date } }
        orderBy: { periodStart: 'desc' }
        take: number
      } = {
        where: {
          projectId: projectId,
        },
        orderBy: {
          periodStart: 'desc' as const,
        },
        take: 1,
      }

      // If reportDate is provided, try to get financials for that specific period
      if (reportDate) {
        const targetDate = new Date(reportDate)
        // Get the Monday of that week (period start)
        const dayOfWeek = targetDate.getDay()
        const diff = targetDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const periodStart = new Date(targetDate)
        periodStart.setDate(diff)
        periodStart.setHours(0, 0, 0, 0)

        // Try exact period match first
        const exactMatch = await prisma.projectFinancials.findUnique({
          where: {
            projectId_periodStart: {
              projectId: projectId,
              periodStart: periodStart,
            },
          },
        })

        if (exactMatch) {
          return NextResponse.json({
            jobNumber: exactMatch.jobNumber,
            projectNumber: exactMatch.projectNumber,
            projectName: project.name,
            totalBudget: exactMatch.budget?.toNumber() || null,
            eac: exactMatch.forecast?.toNumber() || null,
            variance: exactMatch.variance?.toNumber() || null,
            reportDate: exactMatch.sourceDate || exactMatch.periodStart,
            fileName: exactMatch.sourceFile || null,
            source: 'database', // Indicate this came from ingested data
            periodStart: exactMatch.periodStart,
          })
        }

        // If no exact match, get the latest financials before or on this date
        financialsQuery.where.periodStart = {
          lte: periodStart,
        }
      }

      const latestFinancials = await prisma.projectFinancials.findFirst(financialsQuery)

      if (latestFinancials) {
        return NextResponse.json({
          jobNumber: latestFinancials.jobNumber,
          projectNumber: latestFinancials.projectNumber,
          projectName: project.name,
          totalBudget: latestFinancials.budget?.toNumber() || null,
          eac: latestFinancials.forecast?.toNumber() || null,
          variance: latestFinancials.variance?.toNumber() || null,
          reportDate: latestFinancials.sourceDate || latestFinancials.periodStart,
          fileName: latestFinancials.sourceFile || null,
          source: 'database', // Indicate this came from ingested data
          periodStart: latestFinancials.periodStart,
        })
      }
    } catch (financialsError: unknown) {
      // If ProjectFinancials table doesn't exist or there's an error, fall back to Excel parsing
      const errorMessage = financialsError instanceof Error ? financialsError.message : 'Unknown error'
      console.warn('Could not fetch from ProjectFinancials, falling back to Excel parsing:', errorMessage)
    }

    // PRIORITY 2: Fall back to Excel file parsing (legacy support)

    // Determine which cost report file to use
    let costReportPath: string
    let costReportMeta: { fileName: string; reportDate: Date } | null = null
    
    if (filePath) {
      // Use explicitly provided file path
      costReportPath = filePath
    } else {
      // Try to get cost report from database storage
      let storedReport
      if (reportDate) {
        // Get cost report for specific date (for historical reports)
        storedReport = await getCostReportForDate(new Date(reportDate))
      } else {
        // Get active (latest) cost report
        storedReport = await getActiveCostReport()
      }
      
      if (storedReport) {
        costReportPath = storedReport.filePath
        costReportMeta = {
          fileName: storedReport.fileName,
          reportDate: storedReport.reportDate,
        }
      } else {
        // Fallback: try to find file in project root (legacy support)
        const { getLatestCostReportFile } = await import('@/lib/cost-report-loader')
        const latestFile = getLatestCostReportFile(process.cwd())
        if (!latestFile) {
          return NextResponse.json({ 
            error: 'No cost report file found. Please upload a cost report file using the upload interface.',
            code: 'NO_FILE_FOUND'
          }, { status: 404 })
        }
        costReportPath = latestFile
      }
    }

    // Verify file exists and get absolute path
    const absolutePath = path.isAbsolute(costReportPath) 
      ? costReportPath 
      : path.resolve(process.cwd(), costReportPath)
    
    if (!fs.existsSync(absolutePath)) {
      console.error(`Cost report file not found: ${absolutePath}`)
      return NextResponse.json({ 
        error: `Cost report file not found: ${path.basename(absolutePath)}`,
        code: 'FILE_NOT_FOUND',
        filePath: absolutePath,
      }, { status: 404 })
    }

    // Verify file is readable
    try {
      fs.accessSync(absolutePath, fs.constants.R_OK)
    } catch (accessError: unknown) {
      const errorMessage = accessError instanceof Error ? accessError.message : 'Unknown error'
      console.error(`Cannot access cost report file: ${absolutePath}`, errorMessage)
      return NextResponse.json({
        error: `Cannot access cost report file: ${path.basename(absolutePath)}. Please check file permissions.`,
        code: 'FILE_ACCESS_ERROR',
        filePath: absolutePath,
      }, { status: 403 })
    }

    // Load cost report data
    let costData
    try {
      costData = await loadCostReport(absolutePath)
    } catch (loadError: unknown) {
      const errorMessage = loadError instanceof Error ? loadError.message : 'Unknown error'
      console.error('Error loading cost report file:', loadError)
      console.error('File path:', absolutePath)
      console.error('File exists:', fs.existsSync(absolutePath))
      if (fs.existsSync(absolutePath)) {
        const stats = fs.statSync(absolutePath)
        console.error('File size:', stats.size, 'bytes')
        console.error('File permissions:', (stats.mode & parseInt('777', 8)).toString(8))
      }
      return NextResponse.json({
        error: `Failed to load cost report: ${errorMessage}`,
        code: 'LOAD_ERROR',
        filePath: path.basename(absolutePath),
      }, { status: 500 })
    }

    // Find matching entry for this project by project number ONLY
    if (!project.projectNumber) {
      return NextResponse.json({
        error: 'Project does not have a project number set. Please set the project number in the database to enable cost report matching.',
        code: 'NO_PROJECT_NUMBER',
        project: {
          code: project.code,
          name: project.name,
        },
      }, { status: 400 })
    }
    
    const match = findCostDataForProject(
      costData,
      project.projectNumber
    )
    
    // Log the match for debugging
    if (match) {
      console.log('Cost report match found:', {
        projectCode: project.code,
        projectName: project.name,
        matchedJobNumber: match.jobNumber,
        matchedProjectNumber: match.projectNumber,
        matchedProjectName: match.projectName,
        budget: match.totalBudget,
        eac: match.eac
      })
    } else {
      console.warn('No cost report match found:', {
        projectCode: project.code,
        projectName: project.name,
        availableEntries: costData.entries.slice(0, 5).map(e => ({
          jobNumber: e.jobNumber,
          projectNumber: e.projectNumber,
          projectName: e.projectName
        }))
      })
    }

    if (!match) {
      // Provide helpful suggestions including all available project numbers
      const suggestions = costData.entries.slice(0, 10).map(e => ({
        jobNumber: e.jobNumber,
        projectNumber: e.projectNumber,
        projectName: e.projectName,
      }))
      
      return NextResponse.json({
        error: 'No cost data found for this project',
        code: 'NO_MATCH',
        project: {
          code: project.code,
          name: project.name,
        },
        suggestions,
        // Include all project numbers for debugging
        availableProjectNumbers: costData.entries
          .filter(e => e.projectNumber)
          .map(e => e.projectNumber)
          .slice(0, 20)
      }, { status: 404 })
    }

    return NextResponse.json({
      jobNumber: match.jobNumber,
      projectNumber: match.projectNumber,
      projectName: match.projectName,
      totalBudget: match.totalBudget,
      eac: match.eac,
      variance: match.variance,
      reportDate: costData.reportDate || costReportMeta?.reportDate,
      fileName: costReportMeta?.fileName || path.basename(costReportPath),
      filePath: costReportPath,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load cost report'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error loading cost report:', error)
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorStack
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cost-report/list
 * Lists all available cost report files
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { directory?: string }
    const directory = body.directory || process.cwd()

    const files = fs.readdirSync(directory)
    
    const costReportFiles = files
      .filter((file: string) => 
        file.match(/^Cost\s+Report\s+Summary\s+.+\.xlsx$/i)
      )
      .map((file: string) => {
        const filePath = path.join(directory, file)
        const stats = fs.statSync(filePath)
        return {
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
        }
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime()) // Newest first

    return NextResponse.json({ files: costReportFiles })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list cost report files'
    console.error('Error listing cost report files:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}


/**
 * GET /api/cost-report/match-status
 * 
 * Shows matching status for all database projects against the latest cost report
 * Returns which projects match and how they match
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getActiveCostReport } from '@/lib/cost-report-storage'
import { loadCostReport, findCostDataForProject } from '@/lib/cost-report-loader'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all projects from database
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        jobNumber: true,
        projectNumber: true,
        region: true,
        projectNumbers: {
          select: {
            projectNumber: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Get active cost report
    const activeCostReport = await getActiveCostReport()
    if (!activeCostReport) {
      const emptyProjects = projects.map(p => ({
        projectId: p.id,
        projectCode: p.code,
        projectName: p.name,
        jobNumber: p.jobNumber,
        region: p.region,
        matchStatus: 'no_cost_report' as const,
        matchType: null,
        excelData: null,
        matchDetails: {
          dbJobNumber: p.jobNumber,
          dbProjectCode: p.code,
          dbProjectName: p.name,
          dbProjectNumber: p.projectNumber,
        },
      }))
      
      return NextResponse.json({
        success: false,
        error: 'No active cost report found. Please upload a cost report first.',
        costReport: null,
        summary: {
          totalProjects: projects.length,
          matched: 0,
          noMatch: projects.length,
          matchedByProjectNumber: 0,
          projectsWithoutProjectNumber: projects.filter(p => !p.projectNumber).length,
          duplicateMatches: 0,
          projectsWithDuplicateMatches: 0,
        },
        projects: emptyProjects,
        sampleExcelEntries: [],
        duplicateMatches: [],
      })
    }

    // Load cost report data
    let costData: Awaited<ReturnType<typeof loadCostReport>>
    try {
      costData = await loadCostReport(activeCostReport.filePath)
    } catch (error: unknown) {
      logger.error('Error loading cost report', { error })
      const message = error instanceof Error ? error.message : 'Unknown error'
      const emptyProjects = projects.map(p => ({
        projectId: p.id,
        projectCode: p.code,
        projectName: p.name,
        jobNumber: p.jobNumber,
        region: p.region,
        matchStatus: 'no_cost_report' as const,
        matchType: null,
        excelData: null,
        matchDetails: {
          dbJobNumber: p.jobNumber,
          dbProjectCode: p.code,
          dbProjectName: p.name,
          dbProjectNumber: p.projectNumber,
        },
      }))
      
      return NextResponse.json({
        success: false,
        error: `Failed to load cost report: ${message}`,
        costReport: {
          fileName: activeCostReport.fileName,
          reportDate: activeCostReport.reportDate,
          filePath: activeCostReport.filePath,
        },
        summary: {
          totalProjects: projects.length,
          matched: 0,
          noMatch: projects.length,
          matchedByProjectNumber: 0,
          projectsWithoutProjectNumber: projects.filter(p => !p.projectNumber).length,
          duplicateMatches: 0,
          projectsWithDuplicateMatches: 0,
        },
        projects: emptyProjects,
        sampleExcelEntries: [],
        duplicateMatches: [],
      }, { status: 500 })
    }

    // Match each project by project number ONLY
    const projectsWithoutAnyNumbers = projects.filter(project => {
      if (project.projectNumber?.trim()) return false
      return !(project.projectNumbers || []).some(pn => pn.projectNumber?.trim())
    }).length

    const matchResults = projects.map(project => {
      const projectNumbers = new Set<string>()
      if (project.projectNumber?.trim()) {
        projectNumbers.add(project.projectNumber.trim())
      }
      for (const pn of project.projectNumbers || []) {
        if (pn.projectNumber?.trim()) {
          projectNumbers.add(pn.projectNumber.trim())
        }
      }
      const projectNumbersList = Array.from(projectNumbers)

      if (projectNumbersList.length === 0) {
        return {
          projectId: project.id,
          projectCode: project.code,
          projectName: project.name,
          jobNumber: project.jobNumber,
          projectNumber: project.projectNumber,
          region: project.region,
          matchStatus: 'no_match' as const,
          matchType: null,
          excelData: null,
          matchDetails: {
            dbJobNumber: project.jobNumber,
            dbProjectCode: project.code,
            dbProjectName: project.name,
            dbProjectNumber: project.projectNumber,
          },
          noMatchReason: 'Project number not set in database',
        }
      }

      let matchedProjectNumber: string | null = null
      let match = null
      for (const pn of projectNumbersList) {
        const result = findCostDataForProject(costData, pn)
        if (result) {
          match = result
          matchedProjectNumber = pn
          break
        }
      }

      if (match) {
        return {
          projectId: project.id,
          projectCode: project.code,
          projectName: project.name,
          jobNumber: project.jobNumber,
          projectNumber: project.projectNumber,
          region: project.region,
          matchStatus: 'matched' as const,
          matchType: 'project_number' as const,
          excelData: {
            jobNumber: match.jobNumber,
            projectNumber: match.projectNumber,
            projectName: match.projectName,
            totalBudget: match.totalBudget,
            eac: match.eac,
            variance: match.variance,
          },
          matchDetails: {
            dbJobNumber: project.jobNumber,
            dbProjectCode: project.code,
            dbProjectName: project.name,
            dbProjectNumber: matchedProjectNumber ?? project.projectNumber,
            excelJobNumber: match.jobNumber,
            excelProjectNumber: match.projectNumber,
            excelProjectName: match.projectName,
            additionalProjectNumbers: projectNumbersList,
          },
        }
      } else {
        return {
          projectId: project.id,
          projectCode: project.code,
          projectName: project.name,
          jobNumber: project.jobNumber,
          projectNumber: project.projectNumber,
          region: project.region,
          matchStatus: 'no_match' as const,
          matchType: null,
          excelData: null,
          matchDetails: {
            dbJobNumber: project.jobNumber,
            dbProjectCode: project.code,
            dbProjectName: project.name,
            dbProjectNumber: project.projectNumber,
            additionalProjectNumbers: projectNumbersList,
          },
          noMatchReason: `Project number${projectNumbersList.length > 1 ? 's' : ''} "${projectNumbersList.join(', ')}" not found in cost report`,
        }
      }
    })

    // Detect duplicate matches (multiple projects matching to same Excel row)
    const excelRowMap = new Map<string, Array<{ projectId: string; projectCode: string; projectName: string }>>()
    for (const result of matchResults) {
      if (result.matchStatus === 'matched' && result.excelData) {
        const excelKey = `${result.excelData.jobNumber}|${result.excelData.projectNumber || ''}|${result.excelData.projectName}`
        if (!excelRowMap.has(excelKey)) {
          excelRowMap.set(excelKey, [])
        }
        excelRowMap.get(excelKey)!.push({
          projectId: result.projectId,
          projectCode: result.projectCode,
          projectName: result.projectName,
        })
      }
    }

    // Mark projects with duplicate matches
    const duplicateExcelRows = Array.from(excelRowMap.entries()).filter(([, projects]) => projects.length > 1)
    const projectsWithDuplicates = new Set(
      duplicateExcelRows.flatMap(([, projects]) => projects.map(p => p.projectId))
    )

    // Add duplicate warning to match results
    const matchResultsWithWarnings = matchResults.map(result => ({
      ...result,
      hasDuplicateMatch: result.matchStatus === 'matched' && projectsWithDuplicates.has(result.projectId),
      duplicateCount: result.matchStatus === 'matched' && result.excelData
        ? excelRowMap.get(`${result.excelData.jobNumber}|${result.excelData.projectNumber || ''}|${result.excelData.projectName}`)?.length || 1
        : null,
    }))

    // Calculate summary
    const summary = {
      totalProjects: projects.length,
      matched: matchResults.filter(r => r.matchStatus === 'matched').length,
      noMatch: matchResults.filter(r => r.matchStatus === 'no_match').length,
      matchedByProjectNumber: matchResults.filter(r => r.matchType === 'project_number').length,
      projectsWithoutProjectNumber: projectsWithoutAnyNumbers,
      duplicateMatches: duplicateExcelRows.length,
      projectsWithDuplicateMatches: projectsWithDuplicates.size,
    }

    return NextResponse.json({
      success: true,
      costReport: {
        fileName: activeCostReport.fileName,
        reportDate: activeCostReport.reportDate,
        filePath: activeCostReport.filePath,
      },
      summary,
      projects: matchResultsWithWarnings,
      // Include sample Excel entries for reference
      sampleExcelEntries: costData.entries.slice(0, 10).map(e => ({
        jobNumber: e.jobNumber,
        projectNumber: e.projectNumber,
        projectName: e.projectName,
      })),
      // Include duplicate match warnings
      duplicateMatches: duplicateExcelRows.map(([excelKey, projects]) => {
        const [jobNumber, projectNumber, projectName] = excelKey.split('|')
        return {
          excelJobNumber: jobNumber,
          excelProjectNumber: projectNumber || null,
          excelProjectName: projectName,
          matchedProjects: projects,
        }
      }),
    })
  } catch (error: unknown) {
    logger.error('Error getting match status', {
      error,
    })

    const message = error instanceof Error ? error.message : 'Failed to get match status'
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


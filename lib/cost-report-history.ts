/**
 * Utilities for querying historical financial data from ProjectFinancials
 * 
 * This module provides helper functions to query financial data by date range,
 * period, or project for future reporting and analysis.
 * 
 * @module cost-report-history
 */

import { prisma } from './prisma'
import { logger } from './logger'

/**
 * Get the Monday (start of week) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Get the Sunday (end of week) for a given date
 */
export function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return weekEnd
}

/**
 * Query financial data for a specific project within a date range
 */
export async function getFinancialDataByDateRange(
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{
  id: string
  periodStart: Date
  periodEnd: Date | null
  budget: number | null
  forecast: number | null
  actual: number | null
  committed: number | null
  spent: number | null
  variance: number | null
  jobNumber: string | null
  projectNumber: string | null
  sourceFile: string | null
  sourceDate: Date | null
  matchType: string | null
  createdAt: Date
  updatedAt: Date
}>> {
  try {
    const financials = await prisma.projectFinancials.findMany({
      where: {
        projectId,
        periodStart: {
          gte: getWeekStart(startDate),
          lte: getWeekEnd(endDate),
        },
      },
      orderBy: {
        periodStart: 'asc',
      },
    })

    return financials.map(f => ({
      id: f.id,
      periodStart: f.periodStart,
      periodEnd: f.periodEnd,
      budget: f.budget?.toNumber() || null,
      forecast: f.forecast?.toNumber() || null,
      actual: f.actual?.toNumber() || null,
      committed: f.committed?.toNumber() || null,
      spent: f.spent?.toNumber() || null,
      variance: f.variance?.toNumber() || null,
      jobNumber: f.jobNumber,
      projectNumber: f.projectNumber,
      sourceFile: f.sourceFile,
      sourceDate: f.sourceDate,
      matchType: f.matchType,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }))
  } catch (error: any) {
    logger.error('Error querying financial data by date range', {
      error: error.message,
      projectId,
      startDate,
      endDate,
    })
    throw error
  }
}

/**
 * Get financial data for a specific period (week)
 */
export async function getFinancialDataByPeriod(
  projectId: string,
  periodStart: Date
): Promise<{
  id: string
  periodStart: Date
  periodEnd: Date | null
  budget: number | null
  forecast: number | null
  actual: number | null
  committed: number | null
  spent: number | null
  variance: number | null
  jobNumber: string | null
  projectNumber: string | null
  sourceFile: string | null
  sourceDate: Date | null
  matchType: string | null
  rawJson: any
  createdAt: Date
  updatedAt: Date
} | null> {
  try {
    const weekStart = getWeekStart(periodStart)
    const financial = await prisma.projectFinancials.findUnique({
      where: {
        projectId_periodStart: {
          projectId,
          periodStart: weekStart,
        },
      },
    })

    if (!financial) {
      return null
    }

    return {
      id: financial.id,
      periodStart: financial.periodStart,
      periodEnd: financial.periodEnd,
      budget: financial.budget?.toNumber() || null,
      forecast: financial.forecast?.toNumber() || null,
      actual: financial.actual?.toNumber() || null,
      committed: financial.committed?.toNumber() || null,
      spent: financial.spent?.toNumber() || null,
      variance: financial.variance?.toNumber() || null,
      jobNumber: financial.jobNumber,
      projectNumber: financial.projectNumber,
      sourceFile: financial.sourceFile,
      sourceDate: financial.sourceDate,
      matchType: financial.matchType,
      rawJson: financial.rawJson,
      createdAt: financial.createdAt,
      updatedAt: financial.updatedAt,
    }
  } catch (error: any) {
    logger.error('Error querying financial data by period', {
      error: error.message,
      projectId,
      periodStart,
    })
    throw error
  }
}

/**
 * Get all financial periods for a project (chronological history)
 */
export async function getProjectFinancialHistory(
  projectId: string
): Promise<Array<{
  periodStart: Date
  periodEnd: Date | null
  budget: number | null
  forecast: number | null
  variance: number | null
  sourceFile: string | null
  sourceDate: Date | null
  createdAt: Date
}>> {
  try {
    const financials = await prisma.projectFinancials.findMany({
      where: {
        projectId,
      },
      select: {
        periodStart: true,
        periodEnd: true,
        budget: true,
        forecast: true,
        variance: true,
        sourceFile: true,
        sourceDate: true,
        createdAt: true,
      },
      orderBy: {
        periodStart: 'asc',
      },
    })

    return financials.map(f => ({
      periodStart: f.periodStart,
      periodEnd: f.periodEnd,
      budget: f.budget?.toNumber() || null,
      forecast: f.forecast?.toNumber() || null,
      variance: f.variance?.toNumber() || null,
      sourceFile: f.sourceFile,
      sourceDate: f.sourceDate,
      createdAt: f.createdAt,
    }))
  } catch (error: any) {
    logger.error('Error querying project financial history', {
      error: error.message,
      projectId,
    })
    throw error
  }
}

/**
 * Get financial data for all projects within a date range
 */
export async function getAllProjectsFinancialDataByDateRange(
  startDate: Date,
  endDate: Date,
  projectIds?: string[]
): Promise<Array<{
  projectId: string
  projectCode: string
  projectName: string
  periodStart: Date
  budget: number | null
  forecast: number | null
  variance: number | null
  jobNumber: string | null
  projectNumber: string | null
  sourceFile: string | null
}>> {
  try {
    const where: any = {
      periodStart: {
        gte: getWeekStart(startDate),
        lte: getWeekEnd(endDate),
      },
    }

    if (projectIds && projectIds.length > 0) {
      where.projectId = { in: projectIds }
    }

    const financials = await prisma.projectFinancials.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        periodStart: 'asc',
      },
    })

    return financials.map(f => ({
      projectId: f.projectId,
      projectCode: f.project.code,
      projectName: f.project.name,
      periodStart: f.periodStart,
      budget: f.budget?.toNumber() || null,
      forecast: f.forecast?.toNumber() || null,
      variance: f.variance?.toNumber() || null,
      jobNumber: f.jobNumber,
      projectNumber: f.projectNumber,
      sourceFile: f.sourceFile,
    }))
  } catch (error: any) {
    logger.error('Error querying all projects financial data by date range', {
      error: error.message,
      startDate,
      endDate,
      projectIds,
    })
    throw error
  }
}

/**
 * Get the latest financial data for a project (most recent period)
 */
export async function getLatestFinancialData(
  projectId: string
): Promise<{
  periodStart: Date
  budget: number | null
  forecast: number | null
  variance: number | null
  jobNumber: string | null
  projectNumber: string | null
  sourceFile: string | null
  sourceDate: Date | null
} | null> {
  try {
    const financial = await prisma.projectFinancials.findFirst({
      where: {
        projectId,
      },
      orderBy: {
        periodStart: 'desc',
      },
    })

    if (!financial) {
      return null
    }

    return {
      periodStart: financial.periodStart,
      budget: financial.budget?.toNumber() || null,
      forecast: financial.forecast?.toNumber() || null,
      variance: financial.variance?.toNumber() || null,
      jobNumber: financial.jobNumber,
      projectNumber: financial.projectNumber,
      sourceFile: financial.sourceFile,
      sourceDate: financial.sourceDate,
    }
  } catch (error: any) {
    logger.error('Error querying latest financial data', {
      error: error.message,
      projectId,
    })
    throw error
  }
}

/**
 * Example SQL queries for direct database access:
 * 
 * -- Get all financial data for a project
 * SELECT * FROM "ProjectFinancials" 
 * WHERE "projectId" = 'project-id-here' 
 * ORDER BY "periodStart" ASC;
 * 
 * -- Get financial data for a date range
 * SELECT * FROM "ProjectFinancials" 
 * WHERE "projectId" = 'project-id-here' 
 *   AND "periodStart" >= '2025-10-01' 
 *   AND "periodStart" <= '2025-10-31'
 * ORDER BY "periodStart" ASC;
 * 
 * -- Get latest financial data for all projects
 * SELECT DISTINCT ON ("projectId") 
 *   "projectId", 
 *   "periodStart", 
 *   "budget", 
 *   "forecast", 
 *   "variance",
 *   "jobNumber",
 *   "projectNumber"
 * FROM "ProjectFinancials"
 * ORDER BY "projectId", "periodStart" DESC;
 * 
 * -- Get financial data by source file
 * SELECT * FROM "ProjectFinancials" 
 * WHERE "sourceFile" LIKE '%Cost Report Summary 10.15.25.xlsx%'
 * ORDER BY "periodStart" ASC;
 * 
 * -- Get projects with financial data in a date range
 * SELECT 
 *   p."code" as project_code,
 *   p."name" as project_name,
 *   pf."periodStart",
 *   pf."budget",
 *   pf."forecast",
 *   pf."variance",
 *   pf."jobNumber",
 *   pf."projectNumber"
 * FROM "ProjectFinancials" pf
 * JOIN "Project" p ON p."id" = pf."projectId"
 * WHERE pf."periodStart" >= '2025-10-01' 
 *   AND pf."periodStart" <= '2025-10-31'
 * ORDER BY p."name", pf."periodStart" ASC;
 */


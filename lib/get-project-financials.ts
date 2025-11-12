/**
 * Helper function to get latest financial data from ProjectFinancials for a project
 * Matches by project number(s) and sums if multiple matches
 */

import { prisma } from './prisma'

// Prisma's generated types are extremely strict when selecting nested relations.
// For this aggregation-heavy helper we rely on dynamic field selection, so we
// use a type assertion to avoid type noise while still sharing the singleton client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaClient = prisma as any

export interface FinancialBreakdownEntry {
  projectNumber: string
  budget: number | null
  eac: number | null
  variance: number | null
  reportDate: string | null
  sourceDate: string | null
}

export interface ProjectFinancialData {
  budget: number | null
  eac: number | null
  variance: number | null
  breakdown: FinancialBreakdownEntry[]
}

/**
 * Get financial data for a project by matching project numbers
 * @param projectId - Project ID
 * @param periodStart - Optional: specific period to get data for (ISO date string). If not provided, returns latest.
 */
export async function getProjectFinancials(projectId: string, periodStart?: string): Promise<ProjectFinancialData> {
  // Get project with all project numbers
  const project = await prismaClient.project.findUnique({
    where: { id: projectId },
    select: {
      projectNumber: true,
      projectNumbers: {
        select: {
          projectNumber: true,
        },
      },
    },
  })

  if (!project) {
    return { budget: null, eac: null, variance: null, breakdown: [] }
  }

  // Collect all project numbers
  const allProjectNumbers = new Set<string>()
  const projectNumberLabels = new Map<string, string>()
  if (project.projectNumber) {
    const normalizedPrimary = project.projectNumber.trim().toLowerCase()
    if (normalizedPrimary) {
      allProjectNumbers.add(normalizedPrimary)
      projectNumberLabels.set(normalizedPrimary, project.projectNumber.trim())
    }
  }
  for (const pn of project.projectNumbers) {
    const normalizedPn = pn.projectNumber.trim().toLowerCase()
    if (normalizedPn) {
      allProjectNumbers.add(normalizedPn)
      projectNumberLabels.set(normalizedPn, pn.projectNumber.trim())
    }
  }

  if (allProjectNumbers.size === 0) {
    return { budget: null, eac: null, variance: null, breakdown: [] }
  }

  try {
    // Build where clause
    const whereClause: any = {
      OR: Array.from(allProjectNumbers).map((pn: string) => ({
        projectNumber: {
          contains: pn,
          mode: 'insensitive' as const,
        },
      })),
    }

    // If periodStart is provided, filter by that specific period
    if (periodStart) {
      const periodDate = new Date(periodStart)
      periodDate.setHours(0, 0, 0, 0)
      const periodEnd = new Date(periodDate)
      periodEnd.setDate(periodEnd.getDate() + 6) // End of week (Sunday)
      periodEnd.setHours(23, 59, 59, 999)
      
      whereClause.periodStart = {
        gte: periodDate,
        lte: periodEnd,
      }
    }

    // Get financial data matching any of the project numbers
    const allFinancials = await prismaClient.projectFinancials.findMany({
      where: whereClause,
      select: {
        projectId: true,
        budget: true,
        forecast: true, // This is EAC
        variance: true,
        projectNumber: true,
        sourceDate: true,
        periodStart: true,
      },
      orderBy: { periodStart: 'desc' },
    })

    // Group by project number and get latest for each
    const latestByProjectNumber = new Map<string, typeof allFinancials[0]>()
    for (const financial of allFinancials) {
      const financialPn = financial.projectNumber?.trim().toLowerCase() || ''
      if (!financialPn) continue

      const pnList = financialPn.split(',').map((pn: string) => pn.trim().toLowerCase()).filter((pn: string) => pn)

      for (const pn of pnList) {
        // Check for exact match first
        if (allProjectNumbers.has(pn)) {
          if (!latestByProjectNumber.has(pn)) {
            latestByProjectNumber.set(pn, financial)
          } else {
            const existing = latestByProjectNumber.get(pn)!
            const existingDate = existing.sourceDate || existing.periodStart
            const currentDate = financial.sourceDate || financial.periodStart
            if (currentDate > existingDate) {
              latestByProjectNumber.set(pn, financial)
            }
          }
        } else {
          // Check for partial match (e.g., "24-5-072-quie1" matches "24-5-072")
          for (const dbPn of allProjectNumbers) {
            if (pn.startsWith(dbPn) || dbPn.startsWith(pn)) {
              if (!latestByProjectNumber.has(dbPn)) {
                latestByProjectNumber.set(dbPn, financial)
              } else {
                const existing = latestByProjectNumber.get(dbPn)!
                const existingDate = existing.sourceDate || existing.periodStart
                const currentDate = financial.sourceDate || financial.periodStart
                if (currentDate > existingDate) {
                  latestByProjectNumber.set(dbPn, financial)
                }
              }
              break
            }
          }
        }
      }
    }

    // Deduplicate by projectId + periodStart and sum
    const matchingFinancialsMap = new Map<string, typeof allFinancials[0]>()
    for (const financial of latestByProjectNumber.values()) {
      const key = `${financial.projectId}_${financial.periodStart.toISOString()}`
      if (!matchingFinancialsMap.has(key)) {
        matchingFinancialsMap.set(key, financial)
      }
    }

    const matchingFinancials = Array.from(matchingFinancialsMap.values())

    if (matchingFinancials.length === 0) {
      return { budget: null, eac: null, variance: null, breakdown: [] }
    }

    const breakdown: FinancialBreakdownEntry[] = []
    const projectNumbersList = Array.from(allProjectNumbers)
    for (const pn of projectNumbersList) {
      const financial = latestByProjectNumber.get(pn)
      if (financial) {
        const label = projectNumberLabels.get(pn) || pn
        const budget = financial.budget ? parseFloat(financial.budget.toString()) : null
        const eac = financial.forecast ? parseFloat(financial.forecast.toString()) : null
        const variance = financial.variance ? parseFloat(financial.variance.toString()) : null
        const date = financial.sourceDate || financial.periodStart
        breakdown.push({
          projectNumber: label,
          budget,
          eac,
          variance,
          reportDate: date ? date.toISOString() : null,
          sourceDate: financial.sourceDate ? financial.sourceDate.toISOString() : null,
        })
      }
    }

    breakdown.sort((a, b) => a.projectNumber.localeCompare(b.projectNumber))

    // Sum up budgets and EACs
    let totalBudget = 0
    let totalEac = 0
    let totalVariance = 0

    for (const financial of matchingFinancials) {
      const budget = financial.budget ? parseFloat(financial.budget.toString()) : 0
      const eac = financial.forecast ? parseFloat(financial.forecast.toString()) : 0
      const variance = financial.variance ? parseFloat(financial.variance.toString()) : 0

      totalBudget += budget
      totalEac += eac
      totalVariance += variance
    }

    // Calculate variance if not already summed
    const calculatedVariance = totalEac - totalBudget

    return {
      budget: totalBudget > 0 ? totalBudget : null,
      eac: totalEac > 0 ? totalEac : null,
      variance: totalVariance !== 0 ? totalVariance : calculatedVariance,
      breakdown,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.warn('Error fetching ProjectFinancials:', errorMessage)
    return { budget: null, eac: null, variance: null, breakdown: [] }
  }
}

/**
 * Get financial data for multiple projects at once (more efficient)
 * @param projectIds - Array of project IDs
 * @param periodStart - Optional: specific period to get data for (ISO date string). If not provided, returns latest.
 */
export async function getProjectsFinancials(projectIds: string[], periodStart?: string): Promise<Map<string, ProjectFinancialData>> {
  const result = new Map<string, ProjectFinancialData>()

  if (projectIds.length === 0) {
    return result
  }

  // Get all projects with their project numbers
  const projects = await prismaClient.project.findMany({
    where: { id: { in: projectIds } },
    select: {
      id: true,
      projectNumber: true,
      projectNumbers: {
        select: {
          projectNumber: true,
        },
      },
    },
  })

  // Collect all project numbers
  const allProjectNumbers = new Set<string>()
  const projectNumberLabels = new Map<string, string>()
  const projectIdToNumbers = new Map<string, string[]>()

  for (const project of projects) {
    const numbers: string[] = []
    if (project.projectNumber) {
      const trimmed = project.projectNumber.trim()
      const normalized = trimmed.toLowerCase()
      if (normalized) {
        numbers.push(normalized)
        allProjectNumbers.add(normalized)
        projectNumberLabels.set(normalized, trimmed)
      }
    }
    for (const pn of project.projectNumbers) {
      const trimmed = pn.projectNumber.trim()
      const normalized = trimmed.toLowerCase()
      if (normalized && !numbers.includes(normalized)) {
        numbers.push(normalized)
        allProjectNumbers.add(normalized)
        projectNumberLabels.set(normalized, trimmed)
      }
    }
    projectIdToNumbers.set(project.id, numbers)
  }

  if (allProjectNumbers.size === 0) {
    // No project numbers, return null for all
    for (const projectId of projectIds) {
      result.set(projectId, { budget: null, eac: null, variance: null, breakdown: [] })
    }
    return result
  }

  try {
    // Build where clause
    const whereClause: {
      OR: Array<{ projectNumber: { contains: string; mode: 'insensitive' } }>
      periodStart?: { lte?: Date; gte?: Date }
    } = {
      OR: Array.from(allProjectNumbers).map((pn: string) => ({
        projectNumber: {
          contains: pn,
          mode: 'insensitive' as const,
        },
      })),
    }

    // If periodStart is provided, filter by that specific period
    if (periodStart) {
      const periodDate = new Date(periodStart)
      periodDate.setHours(0, 0, 0, 0)
      const periodEnd = new Date(periodDate)
      periodEnd.setDate(periodEnd.getDate() + 6) // End of week (Sunday)
      periodEnd.setHours(23, 59, 59, 999)
      
      whereClause.periodStart = {
        gte: periodDate,
        lte: periodEnd,
      }
    }

    // Get all matching financials
    const allFinancials = await prismaClient.projectFinancials.findMany({
      where: whereClause,
      select: {
        projectId: true,
        budget: true,
        forecast: true,
        variance: true,
        projectNumber: true,
        sourceDate: true,
        periodStart: true,
      },
      orderBy: { periodStart: 'desc' },
    })

    // Group by project number and get latest
    const latestByProjectNumber = new Map<string, typeof allFinancials[0]>()
    for (const financial of allFinancials) {
      const financialPn = financial.projectNumber?.trim().toLowerCase() || ''
      if (!financialPn) continue

      const pnList = financialPn.split(',').map((pn: string) => pn.trim().toLowerCase()).filter((pn: string) => pn)

      for (const pn of pnList) {
        // Check for exact match first
        if (allProjectNumbers.has(pn)) {
          if (!latestByProjectNumber.has(pn)) {
            latestByProjectNumber.set(pn, financial)
          } else {
            const existing = latestByProjectNumber.get(pn)!
            const existingDate = existing.sourceDate || existing.periodStart
            const currentDate = financial.sourceDate || financial.periodStart
            if (currentDate > existingDate) {
              latestByProjectNumber.set(pn, financial)
            }
          }
        } else {
          // Check for partial match (e.g., "24-5-072-quie1" matches "24-5-072")
          for (const dbPn of allProjectNumbers) {
            if (pn.startsWith(dbPn) || dbPn.startsWith(pn)) {
              if (!latestByProjectNumber.has(dbPn)) {
                latestByProjectNumber.set(dbPn, financial)
              } else {
                const existing = latestByProjectNumber.get(dbPn)!
                const existingDate = existing.sourceDate || existing.periodStart
                const currentDate = financial.sourceDate || financial.periodStart
                if (currentDate > existingDate) {
                  latestByProjectNumber.set(dbPn, financial)
                }
              }
              break
            }
          }
        }
      }
    }

    // Aggregate by project
    for (const project of projects) {
      const projectNumbers = projectIdToNumbers.get(project.id) || []
      const matchingFinancialsMap = new Map<string, typeof allFinancials[0]>()

      for (const pn of projectNumbers) {
        const financial = latestByProjectNumber.get(pn)
        if (financial) {
          const key = `${financial.projectId}_${financial.periodStart.toISOString()}`
          if (!matchingFinancialsMap.has(key)) {
            matchingFinancialsMap.set(key, financial)
          }
        }
      }

      const matchingFinancials = Array.from(matchingFinancialsMap.values())

      if (matchingFinancials.length === 0) {
        result.set(project.id, { budget: null, eac: null, variance: null, breakdown: [] })
        continue
      }

      const breakdown: FinancialBreakdownEntry[] = []
      for (const pn of projectNumbers) {
        const financial = latestByProjectNumber.get(pn)
        if (financial) {
          const label = projectNumberLabels.get(pn) || pn
          const budget = financial.budget ? parseFloat(financial.budget.toString()) : null
          const eac = financial.forecast ? parseFloat(financial.forecast.toString()) : null
          const variance = financial.variance ? parseFloat(financial.variance.toString()) : null
          const date = financial.sourceDate || financial.periodStart
          breakdown.push({
            projectNumber: label,
            budget,
            eac,
            variance,
            reportDate: date ? date.toISOString() : null,
            sourceDate: financial.sourceDate ? financial.sourceDate.toISOString() : null,
          })
        }
      }
      breakdown.sort((a, b) => a.projectNumber.localeCompare(b.projectNumber))

      // Sum up
      let totalBudget = 0
      let totalEac = 0
      let totalVariance = 0

      for (const financial of matchingFinancials) {
        const budget = financial.budget ? parseFloat(financial.budget.toString()) : 0
        const eac = financial.forecast ? parseFloat(financial.forecast.toString()) : 0
        const variance = financial.variance ? parseFloat(financial.variance.toString()) : 0

        totalBudget += budget
        totalEac += eac
        totalVariance += variance
      }

      const calculatedVariance = totalEac - totalBudget

      result.set(project.id, {
        budget: totalBudget > 0 ? totalBudget : null,
        eac: totalEac > 0 ? totalEac : null,
        variance: totalVariance !== 0 ? totalVariance : calculatedVariance,
        breakdown,
      })
    }

    // Set null for projects not found
    for (const projectId of projectIds) {
      if (!result.has(projectId)) {
        result.set(projectId, { budget: null, eac: null, variance: null, breakdown: [] })
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.warn('Error fetching ProjectFinancials:', errorMessage)
    // Return null for all on error
    for (const projectId of projectIds) {
      result.set(projectId, { budget: null, eac: null, variance: null, breakdown: [] })
    }
  }

  return result
}


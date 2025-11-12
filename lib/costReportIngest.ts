/**
 * Production-grade Cost Report Ingestion Service
 * 
 * Reads Excel cost reports, matches rows to existing projects in PostgreSQL,
 * and upserts financial data into the database.
 * 
 * @module costReportIngest
 */

import * as XLSX from 'xlsx'
import { prisma } from './prisma'
import { logger } from './logger'
import { Prisma } from '@prisma/client'

/**
 * Options for cost report ingestion
 */
export interface IngestOptions {
  /** Header hints for job number column detection */
  jobHints?: string[]
  /** Header hints for project name column detection */
  nameHints?: string[]
  /** Header hints for financial column detection */
  financialHints?: string[]
  /** ISO date string for the reporting period start (e.g., "2025-10-15") */
  periodStart?: string
  /** If true, perform matching but do not write to database */
  dryRun?: boolean
  /** Source file name for metadata */
  sourceFileName?: string
  /** Source file date for metadata */
  sourceDate?: Date
}

/**
 * Summary of ingestion results
 */
export interface IngestSummary {
  /** Number of rows matched by project number */
  matchedByProjectNumber: number
  /** Number of rows that could not be matched to database projects (skipped) */
  unmatched: number
  /** List of financial column names detected */
  financialColumns: string[]
  /** Total rows processed (only matched rows that were stored) */
  totalRows: number
  /** Total projects updated in database */
  projectsUpdated: number
  /** Total rows in Excel file (before filtering) */
  totalExcelRows?: number
  /** Number of rows skipped (empty, headers, etc.) */
  skippedRows?: number
  /** Total projects in database */
  totalProjectsInDatabase?: number
}

/**
 * Information about a matched row
 */
export interface IngestRow {
  /** Project ID from database */
  projectId: string
  /** Project name from database */
  projectName: string
  /** Job number from Excel (Column A) */
  jobNumber: string | null
  /** Project number from Excel (Column B) */
  projectNumber: string | null
  /** How this row was matched */
  matchType: 'project_number'
  /** Extracted financial values */
  financials: Record<string, number | null>
  /** Optional raw fields retained from source */
  sourceMeta?: Record<string, unknown>
}

/**
 * Complete ingestion result
 */
export interface IngestResult {
  /** Summary statistics */
  summary: IngestSummary
  /** Matched rows with project associations */
  rows: IngestRow[]
  /** Unmatched Excel rows for debugging */
  unmatchedRows: Array<{
    jobNumber: string | null
    projectNumber: string | null
    projectName: string | null
    financials: Record<string, number | null>
  }>
}

/**
 * Column detection result
 */
interface ColumnMapping {
  jobNumberCol: number | null
  projectNumberCol: number | null
  projectNameCol: number | null
  financialCols: Map<number, string> // column index -> header name
}

/**
 * Default header hints for column detection
 */
const DEFAULT_JOB_HINTS = ['job', 'job #', 'job number', 'job id', 'project id', 'proj #']
const DEFAULT_NAME_HINTS = ['project', 'name', 'title', 'project name']
const DEFAULT_FINANCIAL_HINTS = [
  'budget',
  'forecast',
  'actual',
  'committed',
  'spent',
  'variance',
  'cost',
  'eac',
  'hard cost',
  'soft cost',
  'total budget',
  'forecasted cost',
  'cost to complete',
]

/**
 * Normalize a string for matching: lowercase, remove punctuation, collapse whitespace
 */
export function normalizeString(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()
}

function normalizeProjectNumber(value: string | null | undefined): string {
  if (!value) return ''
  const normalized = normalizeString(value)
    .replace(/\s+/g, '')
    .replace(/_/g, '')
  return normalized
}

/**
 * Extract job number from text: first 3-8 digit number, skipping years 2010-2030
 */
export function extractJobNumber(text: string | null | undefined): string | null {
  if (!text) return null
  
  const str = String(text).trim()
  if (!str) return null
  
  // Try to extract numbers (including those with dashes like "25-8-131")
  const numberPatterns = [
    /\d{1,2}-\d{1,2}-\d{2,4}(?:-\w+)?/, // Pattern like "25-8-131" or "25-8-131-quie6"
    /\d{3,8}/, // 3-8 digit numbers
  ]
  
  for (const pattern of numberPatterns) {
    const match = str.match(pattern)
    if (match) {
      const num = match[0]
      // Skip if it's just a year (2010-2030)
      const year = parseInt(num)
      if (year >= 2010 && year <= 2030 && num.length === 4) {
        continue
      }
      return num
    }
  }
  
  return null
}

/**
 * Parse numeric value from Excel cell
 */
function parseNumericValue(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    return isNaN(value) ? null : value
  }
  if (typeof value === 'string') {
    // Remove commas, dollar signs, parentheses (for negatives), whitespace
    const cleaned = value.replace(/[$,\s()]/g, '')
    if (cleaned === '' || cleaned === '-') return null
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }
  return null
}

/**
 * Detect columns in Excel sheet by scanning headers
 */
function detectColumns(
  headers: any[],
  jobHints: string[],
  nameHints: string[],
  financialHints: string[]
): ColumnMapping {
  const mapping: ColumnMapping = {
    jobNumberCol: null,
    projectNumberCol: null,
    projectNameCol: null,
    financialCols: new Map(),
  }

  // Normalize headers for case-insensitive matching
  const normalizedHeaders = headers.map((h, idx) => ({
    index: idx,
    value: h ? String(h).trim().toLowerCase() : '',
    original: h ? String(h).trim() : '',
  }))

  // Find job number column
  for (const header of normalizedHeaders) {
    if (!header.value) continue
    for (const hint of jobHints) {
      if (header.value.includes(hint.toLowerCase())) {
        mapping.jobNumberCol = header.index
        logger.debug(`Found job number column at index ${header.index}: "${header.original}"`)
        break
      }
    }
    if (mapping.jobNumberCol !== null) break
  }

  // Find project name column
  for (const header of normalizedHeaders) {
    if (!header.value) continue
    for (const hint of nameHints) {
      if (header.value.includes(hint.toLowerCase())) {
        // Don't use the same column as job number
        if (mapping.jobNumberCol !== header.index) {
          mapping.projectNameCol = header.index
          logger.debug(`Found project name column at index ${header.index}: "${header.original}"`)
          break
        }
      }
    }
    if (mapping.projectNameCol !== null) break
  }

  // Find project number column (typically column B, after job number)
  // Look for headers that might indicate project number
  for (const header of normalizedHeaders) {
    if (!header.value) continue
    if (
      header.value.includes('project number') ||
      header.value.includes('project #') ||
      header.value.includes('proj number')
    ) {
      if (mapping.jobNumberCol !== header.index && mapping.projectNameCol !== header.index) {
        mapping.projectNumberCol = header.index
        logger.debug(`Found project number column at index ${header.index}: "${header.original}"`)
        break
      }
    }
  }
  
  // If no explicit project number column found, assume it's column B (index 1) if job is column A
  if (mapping.projectNumberCol === null && mapping.jobNumberCol === 0 && headers.length > 1) {
    mapping.projectNumberCol = 1
    logger.debug(`Assuming project number column at index 1 (column B)`)
  }

  // Find financial columns
  for (const header of normalizedHeaders) {
    if (!header.value) continue
    for (const hint of financialHints) {
      if (header.value.includes(hint.toLowerCase())) {
        // Don't use columns already assigned
        if (
          mapping.jobNumberCol !== header.index &&
          mapping.projectNameCol !== header.index &&
          mapping.projectNumberCol !== header.index
        ) {
          mapping.financialCols.set(header.index, header.original)
          logger.debug(`Found financial column at index ${header.index}: "${header.original}"`)
          break
        }
      }
    }
  }

  return mapping
}

/**
 * Find the first non-empty sheet in workbook
 */
function findDataSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
    // Check if sheet has more than 1 column and at least 1 row
    if (range.e.c > 0 && range.e.r > 0) {
      return sheet
    }
  }
  return null
}

/**
 * Load all projects from database for matching by project number
 * Now supports multiple project numbers per project via ProjectProjectNumber table
 */
type ProjectMatch = {
  id: string
  code: string
  name: string
  projectNumber: string | null
}

type ProjectWithNumbers = ProjectMatch & {
  projectNumbers: Array<{ projectNumber: string }>
}

async function loadProjectsForMatching(): Promise<{
  projectMap: Map<string, ProjectMatch>
  projectNumbersMap: Map<string, ProjectMatch[]>
}> {
  const projects = await prisma.project.findMany({
    include: {
      projectNumbers: {
        select: {
          projectNumber: true,
        },
      },
    },
  } as any) as unknown as ProjectWithNumbers[]

  // Map: projectNumber -> project (for single matches)
  const projectMap = new Map<string, ProjectMatch>()

  // Map: projectNumber -> array of projects (for aggregation)
  const projectNumbersMap = new Map<string, ProjectMatch[]>()

  for (const project of projects) {
    // Index by primary project number (for backward compatibility)
    if (project.projectNumber) {
      const normalizedProjectNumber = normalizeProjectNumber(project.projectNumber)
      if (normalizedProjectNumber) {
        const projectMatch: ProjectMatch = {
          id: project.id,
          code: project.code,
          name: project.name,
          projectNumber: project.projectNumber ?? null,
        }
        projectMap.set(normalizedProjectNumber, projectMatch)
        
        if (!projectNumbersMap.has(normalizedProjectNumber)) {
          projectNumbersMap.set(normalizedProjectNumber, [])
        }
        const existing = projectNumbersMap.get(normalizedProjectNumber)!
        if (!existing.find(p => p.id === project.id)) {
          existing.push(projectMatch)
        }
      }
    }
    
    for (const pn of project.projectNumbers) {
      const normalizedProjectNumber = normalizeProjectNumber(pn.projectNumber)
      if (normalizedProjectNumber) {
        const projectMatch: ProjectMatch = {
          id: project.id,
          code: project.code,
          name: project.name,
          projectNumber: pn.projectNumber ?? project.projectNumber ?? null,
        }
        projectMap.set(normalizedProjectNumber, projectMatch)
        
        if (!projectNumbersMap.has(normalizedProjectNumber)) {
          projectNumbersMap.set(normalizedProjectNumber, [])
        }
        const existing = projectNumbersMap.get(normalizedProjectNumber)!
        if (!existing.find(p => p.id === project.id)) {
          existing.push(projectMatch)
        }
      }
    }
  }

  const totalProjectNumbers = Array.from(projectNumbersMap.values()).reduce((sum, arr) => sum + arr.length, 0)
  logger.info(`Loaded ${projects.length} projects for matching (${projectMap.size} unique project numbers, ${totalProjectNumbers} total mappings)`)
  
  return { projectMap, projectNumbersMap }
}

/**
 * Match Excel row to database project by project number ONLY
 * 
 * Matching is done by exact project number match (case-insensitive, trimmed).
 * Project numbers must be set in the database for matching to work.
 */
function matchRowToProject(
  row: any[],
  mapping: ColumnMapping,
  projectMap: Map<string, { id: string; code: string; name: string; projectNumber: string | null }>
): { project: { id: string; code: string; name: string; projectNumber: string | null } | null; matchType: 'project_number' | null } {
  // Match by project number ONLY (Column B from Excel)
  if (mapping.projectNumberCol !== null && row[mapping.projectNumberCol]) {
    const projectNumberText = String(row[mapping.projectNumberCol]).trim()
    if (projectNumberText && projectNumberText.toLowerCase() !== 'n/a') {
      const normalizedCandidates = new Set<string>()
      const normalizedFull = normalizeProjectNumber(projectNumberText)
      if (normalizedFull) normalizedCandidates.add(normalizedFull)

      const parts = projectNumberText.split(/[\s,\/|;]+/).map(part => part.trim()).filter(Boolean)
      for (const part of parts) {
        const normalized = normalizeProjectNumber(part)
        if (normalized) normalizedCandidates.add(normalized)
      }

      for (const candidate of normalizedCandidates) {
        const project = projectMap.get(candidate)
        if (project) {
          logger.debug(`Matched by project number: "${projectNumberText}" -> Project "${project.name}" (${project.code})`)
          return { project, matchType: 'project_number' }
        }
      }

      logger.debug(`No project found with project number: "${projectNumberText}"`)
    }
  }

  // No match found
  logger.debug(`No match found for Excel row (project number column: ${mapping.projectNumberCol})`)
  return { project: null, matchType: null }
}

/**
 * Extract financial values from Excel row
 */
function extractFinancials(
  row: any[],
  mapping: ColumnMapping
): Record<string, number | null> {
  const financials: Record<string, number | null> = {}
  
  for (const [colIndex, headerName] of mapping.financialCols.entries()) {
    const value = row[colIndex]
    const numValue = parseNumericValue(value)
    financials[headerName] = numValue
  }
  
  return financials
}

/**
 * Main ingestion function - processes Excel buffer and matches to projects
 */
export async function ingestCostReportBuffer(
  excelBuffer: Buffer,
  options: IngestOptions = {}
): Promise<IngestResult> {
  const {
    jobHints = DEFAULT_JOB_HINTS,
    nameHints = DEFAULT_NAME_HINTS,
    financialHints = DEFAULT_FINANCIAL_HINTS,
    periodStart,
    dryRun = false,
    sourceFileName,
    sourceDate,
  } = options

  logger.info('Starting cost report ingestion', {
    dryRun,
    periodStart,
    sourceFileName,
    bufferSize: excelBuffer.length,
  })

  // Parse Excel file
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(excelBuffer, {
      type: 'buffer',
      cellDates: false,
      cellNF: false,
      cellText: false,
    })
  } catch (error: any) {
    logger.error('Failed to parse Excel file', { error: error.message })
    throw new Error(`Failed to parse Excel file: ${error.message}`)
  }

  // Find data sheet
  const sheet = findDataSheet(workbook)
  if (!sheet) {
    throw new Error('No data sheet found in Excel file')
  }

  logger.info(`Using sheet: ${workbook.SheetNames[0]}`)

  // Convert to JSON array
  const data = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as any[][]

  if (data.length < 2) {
    throw new Error('Excel file must contain at least a header row and one data row')
  }

  // Find header row (first non-empty row with multiple columns)
  let headerRowIndex = 0
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i]
    if (row && row.filter(cell => cell !== null && cell !== undefined && cell !== '').length >= 3) {
      headerRowIndex = i
      break
    }
  }

  const headers = data[headerRowIndex] || []
  logger.debug(`Using header row ${headerRowIndex + 1}`, { headers: headers.slice(0, 10) })

  // Detect columns
  const mapping = detectColumns(headers, jobHints, nameHints, financialHints)
  
  if (mapping.jobNumberCol === null && mapping.projectNameCol === null) {
    throw new Error('Could not detect job number or project name column in Excel file')
  }

  if (mapping.financialCols.size === 0) {
    logger.warn('No financial columns detected in Excel file')
  }

  logger.info('Column mapping detected', {
    jobNumberCol: mapping.jobNumberCol,
    projectNumberCol: mapping.projectNumberCol,
    projectNameCol: mapping.projectNameCol,
    financialCols: Array.from(mapping.financialCols.entries()).map(([idx, name]) => `${idx}:${name}`),
  })

  // Load projects from database - THIS IS THE SOURCE OF TRUTH
  // Only projects that exist in the database will be processed
  // All other rows from the cost report will be skipped (not stored)
  const { projectMap, projectNumbersMap } = await loadProjectsForMatching()
  
  logger.info('Project filtering initialized', {
    totalProjectsInDatabase: projectNumbersMap.size,
    message: 'Only projects in the database will be processed. All other cost report rows will be skipped.',
  })

  // Process rows and aggregate by project
  // Map: projectId -> aggregated financials from all matching project numbers
  const projectFinancialsMap = new Map<string, {
    projectId: string
    projectName: string
    projectCode: string
    jobNumbers: Set<string>
    projectNumbers: Set<string>
    financials: Record<string, number | null>
    matchTypes: Set<string>
  }>()
  
  const unmatchedRows: Array<{
    jobNumber: string | null
    projectNumber: string | null
    projectName: string | null
    financials: Record<string, number | null>
  }> = []

  let matchedByProjectNumber = 0
  let totalExcelRows = 0
  let skippedRows = 0

  // Process data rows (skip header row)
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    // Skip empty rows
    const hasData = row.some(cell => cell !== null && cell !== undefined && cell !== '')
    if (!hasData) {
      skippedRows++
      continue
    }

    // Skip section headers (like "SDC Ashburn")
    const firstCell = row[0]
    if (firstCell && String(firstCell).match(/^SDC\s+/i)) {
      skippedRows++
      continue
    }

    totalExcelRows++

    // Extract job number, project number, project name
    let jobNumber = mapping.jobNumberCol !== null && row[mapping.jobNumberCol]
      ? String(row[mapping.jobNumberCol]).trim()
      : null
    const projectNumber = mapping.projectNumberCol !== null && row[mapping.projectNumberCol]
      ? String(row[mapping.projectNumberCol]).trim() || null
      : null
    const projectName = mapping.projectNameCol !== null && row[mapping.projectNameCol]
      ? String(row[mapping.projectNameCol]).trim()
      : null

    // Skip rows without job number AND project name (need at least one)
    if (!jobNumber && !projectName) {
      skippedRows++
      continue
    }

    // Skip "n/a" job numbers, but allow rows with project numbers even if job is "n/a"
    // This is important because some cost report rows have "n/a" as job number but valid project numbers
    if (jobNumber && (jobNumber.toLowerCase() === 'n/a' || jobNumber === '')) {
      // Only skip if there's no project number to match on
      if (!projectNumber) {
        skippedRows++
        continue
      }
      // If we have a project number, set jobNumber to null so it doesn't interfere
      jobNumber = null
    }

    // Extract financials from this row
    const financials = extractFinancials(row, mapping)
    
    // CRITICAL: Match to project(s) in database by project number
    // A single project number in Excel can match multiple projects (if they share the same project number)
    // Multiple project numbers in Excel can match the same project (if project has multiple project numbers)
    // Support matching even if Excel project number has extra characters (e.g., "24-5-072-something" matches "24-5-072")
    const matchingCandidates = new Set<string>()
    if (projectNumber) {
      const normalizedFull = normalizeProjectNumber(projectNumber)
      if (normalizedFull) matchingCandidates.add(normalizedFull)

      const candidateParts = projectNumber
        .split(/[\s,\/|;]+/)
        .map(part => part.trim())
        .filter(Boolean)

      for (const part of candidateParts) {
        const normalized = normalizeProjectNumber(part)
        if (normalized) matchingCandidates.add(normalized)
      }
    }

    let matchingProjects: Array<{ id: string; code: string; name: string; projectNumber: string | null }> = []

    const addProjects = (projectsToAdd: ProjectMatch[]) => {
      for (const project of projectsToAdd) {
        if (!matchingProjects.some(p => p.id === project.id)) {
          matchingProjects.push(project)
        }
      }
    }

    if (matchingCandidates.size > 0) {
      // First, try direct matches for each candidate
      for (const candidate of matchingCandidates) {
        const projects = projectNumbersMap.get(candidate)
        if (projects) {
          addProjects(projects)
        }
      }

      if (matchingProjects.length === 0) {
        logger.debug(`Trying partial match for Excel project number: "${projectNumber}" (candidates: ${Array.from(matchingCandidates).join(', ')})`)
        for (const candidate of matchingCandidates) {
          for (const [dbProjectNumber, projects] of projectNumbersMap.entries()) {
            if (candidate.startsWith(dbProjectNumber) || dbProjectNumber.startsWith(candidate)) {
              addProjects(projects)
              const representative = projects[0]?.projectNumber ?? dbProjectNumber
              logger.debug(`✅ Partial match: Excel candidate "${candidate}" aligned with database "${representative}" -> Matched ${projects.length} project(s)`)
            }
          }
        }

        if (matchingProjects.length === 0) {
          logger.debug(`❌ No partial match found for "${projectNumber}" after checking ${projectNumbersMap.size} database project numbers`)
        }
      }
    }
 
    if (matchingProjects.length > 0) {
      // This project number matches one or more projects in the database
      
      for (const project of matchingProjects) {
        // Initialize or get existing aggregation for this project
        if (!projectFinancialsMap.has(project.id)) {
          projectFinancialsMap.set(project.id, {
            projectId: project.id,
            projectName: project.name,
            projectCode: project.code,
            jobNumbers: new Set(),
            projectNumbers: new Set(),
            financials: {},
            matchTypes: new Set(),
          })
        }
        
        const agg = projectFinancialsMap.get(project.id)!
        
        // Add job number and project number to sets
        if (jobNumber) agg.jobNumbers.add(jobNumber)
        if (projectNumber) agg.projectNumbers.add(projectNumber)
        agg.matchTypes.add('project_number')
        
        // Aggregate financials (sum numeric values, keep track of sources)
        for (const [key, value] of Object.entries(financials)) {
          if (value !== null && typeof value === 'number') {
            // Sum numeric values (budgets, EACs, etc.)
            agg.financials[key] = (agg.financials[key] || 0) + value
          } else if (agg.financials[key] === undefined) {
            // Keep first non-numeric value or null
            agg.financials[key] = value
          }
        }
      }
      
      matchedByProjectNumber++
      logger.debug(`Matched project number "${projectNumber}" to ${matchingProjects.length} project(s)`, {
        projectNumber,
        projects: matchingProjects.map(p => `${p.code} (${p.name})`),
      })
    } else {
      // Unmatched row - this project number is NOT associated with any project in the database
      // It will NOT be stored in ProjectFinancials
      // It's tracked in unmatchedRows for reporting/debugging only
      unmatchedRows.push({
        jobNumber: jobNumber || null,
        projectNumber: projectNumber || null,
        projectName: projectName || null,
        financials,
      })
      
      logger.debug('Skipped unmatched row (project number not in database)', {
        jobNumber,
        projectNumber,
        projectName,
        rowIndex: i + 1,
      })
    }
  }

  // Convert aggregated financials to IngestRow format
  const matchedRows: IngestRow[] = Array.from(projectFinancialsMap.values()).map(agg => ({
    projectId: agg.projectId,
    projectName: agg.projectName,
    jobNumber: Array.from(agg.jobNumbers).join(', ') || null,
    projectNumber: Array.from(agg.projectNumbers).join(', ') || null,
    matchType: 'project_number' as const,
    financials: agg.financials,
    sourceMeta: {
      matchedProjectNumbers: Array.from(agg.projectNumbers),
      matchedJobNumbers: Array.from(agg.jobNumbers),
      matchTypes: Array.from(agg.matchTypes),
    },
  }))

  logger.info('Row processing complete - Financials aggregated by project', {
    totalExcelRows,
    totalProjectsInDatabase: projectNumbersMap.size,
    matchedByProjectNumber,
    matchedTotal: matchedRows.length,
    unmatched: unmatchedRows.length,
    skippedRows,
    message: `${matchedRows.length} projects matched with aggregated financials. ${unmatchedRows.length} rows from cost report were skipped (project numbers not associated with any database project).`,
  })

  // Upsert financials to database (if not dry run)
  let projectsUpdated = 0
  if (!dryRun && matchedRows.length > 0) {
    if (!periodStart) {
      throw new Error('periodStart is required when dryRun is false')
    }

    const periodStartDate = new Date(periodStart)
    if (isNaN(periodStartDate.getTime())) {
      throw new Error(`Invalid periodStart date: ${periodStart}`)
    }

    logger.info('Upserting aggregated financials to database', {
      projectCount: matchedRows.length,
      periodStart: periodStartDate.toISOString(),
    })

    // Upsert in transaction
    // Each period (week) gets its own record, preserving historical data
    // Financials are aggregated across all project numbers for each project
    await prisma.$transaction(async (tx) => {
      const client = tx as any
      for (const row of matchedRows) {
        // Map financial columns to our schema fields
        const budget = row.financials['Total Budget'] ?? row.financials['budget'] ?? row.financials['Hard Cost Budget'] ?? null
        const forecast = row.financials['Forecasted Cost @ Completion'] ?? row.financials['Forecasted Cost @ Completion (EAC)'] ?? row.financials['forecast'] ?? row.financials['eac'] ?? null
        const actual = row.financials['Actual Costs Invoiced'] ?? row.financials['actual'] ?? null
        const committed = row.financials['Committed Costs'] ?? row.financials['committed'] ?? null
        const spent = row.financials['Spent'] ?? row.financials['spent'] ?? null
        const variance = row.financials['Variance (Over)/Under'] ?? row.financials['variance'] ?? null

        // Prepare raw JSON with all financial fields and aggregation metadata
        const rawJson: Record<string, any> = { ...row.financials }
        if (row.sourceMeta) {
          rawJson._sourceMeta = row.sourceMeta
          rawJson._aggregated = true
          rawJson._projectNumbers = row.sourceMeta.matchedProjectNumbers
        }

        // Calculate period end (Sunday of the week)
        const periodEnd = new Date(periodStartDate)
        periodEnd.setDate(periodEnd.getDate() + 6)
        periodEnd.setHours(23, 59, 59, 999)

        // Upsert project financials
        // Unique constraint on (projectId, periodStart) ensures one record per project per week
        // This preserves historical data: each week has its own record
        await client.projectFinancials.upsert({
          where: {
            projectId_periodStart: {
              projectId: row.projectId,
              periodStart: periodStartDate,
            },
          },
          create: {
            projectId: row.projectId,
            periodStart: periodStartDate,
            periodEnd: periodEnd,
            budget: budget !== null ? new Prisma.Decimal(budget) : null,
            forecast: forecast !== null ? new Prisma.Decimal(forecast) : null,
            actual: actual !== null ? new Prisma.Decimal(actual) : null,
            committed: committed !== null ? new Prisma.Decimal(committed) : null,
            spent: spent !== null ? new Prisma.Decimal(spent) : null,
            variance: variance !== null ? new Prisma.Decimal(variance) : null,
            rawJson,
            sourceFile: sourceFileName || null,
            sourceDate: sourceDate || null,
            jobNumber: row.jobNumber,
            projectNumber: row.projectNumber,
            matchType: row.matchType,
          },
          update: {
            // Update existing record for this period (newer cost report overwrites)
            // This allows re-uploading cost reports to update data for a period
            periodEnd: periodEnd,
            budget: budget !== null ? new Prisma.Decimal(budget) : null,
            forecast: forecast !== null ? new Prisma.Decimal(forecast) : null,
            actual: actual !== null ? new Prisma.Decimal(actual) : null,
            committed: committed !== null ? new Prisma.Decimal(committed) : null,
            spent: spent !== null ? new Prisma.Decimal(spent) : null,
            variance: variance !== null ? new Prisma.Decimal(variance) : null,
            rawJson,
            sourceFile: sourceFileName || null,
            sourceDate: sourceDate || null,
            jobNumber: row.jobNumber,
            projectNumber: row.projectNumber,
            matchType: row.matchType,
            updatedAt: new Date(),
          },
        })

        projectsUpdated++
      }
    })

    logger.info('Database upsert complete', { projectsUpdated })
  }

  // Build result
  const summary: IngestSummary = {
    matchedByProjectNumber,
    unmatched: unmatchedRows.length,
    financialColumns: Array.from(mapping.financialCols.values()),
    totalRows: matchedRows.length,
    projectsUpdated,
    totalExcelRows,
    skippedRows,
    totalProjectsInDatabase: projectNumbersMap.size,
  }

  // Log summary with filtering information
  logger.info('Ingestion summary - Database filtering applied', {
    summary,
    processingRate: totalExcelRows > 0 
      ? `${((matchedRows.length / totalExcelRows) * 100).toFixed(1)}% of Excel rows matched database projects`
      : 'N/A',
    note: 'Only projects that exist in the database were processed. Unmatched rows were skipped and not stored in ProjectFinancials.',
  })

  return {
    summary,
    rows: matchedRows,
    unmatchedRows,
  }
}

export const __testables = {
  parseNumericValue,
  detectColumns,
  findDataSheet,
  matchRowToProject,
  extractFinancials,
}


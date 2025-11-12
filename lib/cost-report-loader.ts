import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

export interface CostReportEntry {
  jobNumber: string | null
  projectNumber: string | null // Column B - Project number from cost report
  projectName: string
  totalBudget: number | null
  eac: number | null
  variance: number | null
}

export interface CostReportData {
  entries: CostReportEntry[]
  reportDate: Date | null
}

/**
 * Load cost report data from Excel file
 * Expected format: "Cost Report Summary [date].xlsx"
 * Sheet: "Cost Rpt Summary"
 * Headers in row 5 (0-indexed row 4)
 */
export async function loadCostReport(filePath: string): Promise<CostReportData> {
  // Check if file exists and is readable
  // Resolve to absolute path to avoid any relative path issues
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Cost report file not found: ${absolutePath}`)
  }
  
  try {
    // Check file permissions
    fs.accessSync(absolutePath, fs.constants.R_OK)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Cannot read cost report file: ${absolutePath}. Error: ${errorMessage}`)
  }
  
  // Verify it's actually a file (not a directory)
  const stats = fs.statSync(absolutePath)
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${absolutePath}`)
  }
  
  let workbook
  try {
    // Read file into buffer first (more reliable than direct file read)
    const fileBuffer = fs.readFileSync(absolutePath)
    
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('File is empty or could not be read')
    }
    
    // Read Excel file from buffer
    workbook = XLSX.read(fileBuffer, { 
      type: 'buffer', 
      cellDates: false,
      // Additional options for better compatibility
      cellNF: false,
      cellText: false,
    })
  } catch (error: unknown) {
    // Provide more helpful error message
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const fileInfo = `File exists: ${fs.existsSync(absolutePath)}, File size: ${stats.size} bytes, Path: ${absolutePath}`
    throw new Error(`Failed to read Excel file. ${errorMsg}. ${fileInfo}`)
  }
  
  const sheetName = 'Cost Rpt Summary'
  const sheet = workbook.Sheets[sheetName]
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in Excel file`)
  }
  
  // Convert to JSON with headers starting at row 5 (0-indexed: 4)
  // Skip the first 4 rows (company name, title, date, blank)
  const data = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    range: 4, // Start from row 5 (0-indexed: 4)
  }) as Array<Array<unknown>>
  
  // Row 0 (actual row 5 in Excel) should have headers
  const headers = data[0] || []
  
  // Find column indices
  const jobNumberCol = 0 // Column A - Job Number
  const projectNumberCol = 1 // Column B - Project Number
  const projectNameCol = 2 // Column C - Project Name
  const totalBudgetCol = 7 // Column H - Total Budget
  const eacCol = 11 // Column L - Forecasted Cost @ Completion (EAC)
  const varianceCol = 12 // Column M - Variance
  
  // Extract report date from row 2 (0-indexed: 1 in our range, or 3 in actual Excel)
  // Date is typically in row 3, column B
  let reportDate: Date | null = null
  try {
    const dateRow = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, range: 2 })[0] as Array<unknown>
    if (dateRow && dateRow[1]) {
      // Excel date serial number
      if (typeof dateRow[1] === 'number') {
        reportDate = excelDateToJSDate(dateRow[1])
      } else if (typeof dateRow[1] === 'string') {
        reportDate = new Date(dateRow[1])
      }
    }
  } catch (e) {
    console.warn('Could not parse report date:', e)
  }
  
  const entries: CostReportEntry[] = []
  
  // Process data rows (skip header row)
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row) continue

    const rawJobNumber = row[jobNumberCol]
    const rawProjectNumber = row[projectNumberCol]
    const rawProjectName = row[projectNameCol]

    // Skip empty rows with no identifiers
    if (
      (rawJobNumber === null || rawJobNumber === undefined || rawJobNumber === '') &&
      (rawProjectNumber === null || rawProjectNumber === undefined || rawProjectNumber === '') &&
      (!rawProjectName || String(rawProjectName).trim() === '')
    ) {
      continue
    }

    let jobNumber = rawJobNumber !== null && rawJobNumber !== undefined
      ? String(rawJobNumber).trim()
      : null

    if (jobNumber && jobNumber.match(/^SDC\s+/i)) {
      continue
    }

    if (jobNumber && jobNumber.toLowerCase() === 'n/a') {
      jobNumber = null
    }

    const projectNumber = rawProjectNumber
      ? String(rawProjectNumber).trim()
      : null
    const projectName = rawProjectName ? String(rawProjectName).trim() : ''

    // Require at least a project number or job number to match on
    if (!jobNumber && !projectNumber) {
      continue
    }
    
    // Parse budget values
    const totalBudget = parseNumericValue(row[totalBudgetCol])
    const eac = parseNumericValue(row[eacCol])
    const variance = parseNumericValue(row[varianceCol])
    
    entries.push({
      jobNumber,
      projectNumber: projectNumber && projectNumber !== '' ? projectNumber : null,
      projectName,
      totalBudget,
      eac,
      variance,
    })
  }
  
  return {
    entries,
    reportDate,
  }
}

/**
 * Parse numeric value from Excel cell
 */
function parseNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return isNaN(value) ? null : value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    const isNegative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith('-')
    const cleaned = trimmed.replace(/[,$\s()]/g, '').replace(/^-/, '')
    if (!cleaned || cleaned === '-') return null

    const num = parseFloat(cleaned)
    if (isNaN(num)) return null
    return isNegative ? -num : num
  }
  return null
}

/**
 * Convert Excel date serial number to JavaScript Date
 */
function excelDateToJSDate(serial: number): Date {
  // Excel epoch is January 1, 1900, but Excel incorrectly treats 1900 as a leap year
  // So we add 1 day to compensate
  const excelEpoch = new Date(1899, 11, 30) // December 30, 1899
  return new Date(excelEpoch.getTime() + serial * 86400000)
}

/**
 * Find cost data for a project by matching project number (Column B from Excel)
 * This is the ONLY matching method - project numbers must be set in the database
 * 
 * @param costData - The cost report data
 * @param projectNumber - The project number to match (from Project.projectNumber)
 * @returns The matching cost report entry or null
 */
export function findCostDataForProject(
  costData: CostReportData,
  projectNumber?: string | null
): CostReportEntry | null {
  if (!costData || !costData.entries) return null
  if (!projectNumber) return null

  const normalizedProjectNumber = projectNumber.trim().toLowerCase()
  if (!normalizedProjectNumber) return null

  // Try exact (case-insensitive) match first
  const exactMatch = costData.entries.find(entry => {
    if (!entry.projectNumber) return false
    return entry.projectNumber.trim().toLowerCase() === normalizedProjectNumber
  })
  if (exactMatch) return exactMatch

  const targetVariants = new Set(buildProjectNumberVariants(projectNumber))
  if (targetVariants.size === 0) return null

  const fuzzyMatches = costData.entries
    .filter(entry => {
      if (!entry.projectNumber) return false
      const entryVariants = buildProjectNumberVariants(entry.projectNumber)
      return entryVariants.some(variant => targetVariants.has(variant))
    })
    .map(entry => ({
      entry,
      score: rankProjectNumberMatch(entry.projectNumber!, normalizedProjectNumber, targetVariants),
      tieBreaker: entry.projectNumber
        ? entry.projectNumber.trim().toLowerCase().length
        : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => {
      if (a.score === b.score) {
        return a.tieBreaker - b.tieBreaker
      }
      return a.score - b.score
    })

  return fuzzyMatches.length > 0 ? fuzzyMatches[0].entry : null
}

function buildProjectNumberVariants(value: string): string[] {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return []

  const variants = new Set<string>()
  variants.add(normalized)

  // Include comma/space separated values
  for (const part of normalized.split(/[,\s]+/)) {
    const trimmed = part.trim()
    if (trimmed) {
      variants.add(trimmed)
    }
  }

  // Remove trailing suffixes separated by -, _, or / when suffix contains letters
  const separatorPattern = /[-_/]([a-z0-9]+)$/
  let candidate = normalized
  while (true) {
    const match = candidate.match(separatorPattern)
    if (!match) break

    const suffix = match[1]
    if (!/[a-z]/.test(suffix)) break

    candidate = candidate.slice(0, -(suffix.length + 1)).replace(/[-_/]+$/, '')
    if (!candidate) break
    variants.add(candidate)
  }

  return Array.from(variants)
}

function rankProjectNumberMatch(
  candidate: string,
  normalizedTarget: string,
  targetVariants: Set<string>
): number {
  const candidateVariants = buildProjectNumberVariants(candidate)

  let bestScore = Number.POSITIVE_INFINITY

  for (const variant of candidateVariants) {
    if (!targetVariants.has(variant)) continue

    if (variant === normalizedTarget) {
      return 0
    }

    const variantPenalty =
      Math.abs(variant.length - normalizedTarget.length) + 100
    bestScore = Math.min(bestScore, variantPenalty)
  }

  return bestScore
}

/**
 * Get the latest cost report file in the directory (legacy support)
 * @deprecated Use getActiveCostReport() from cost-report-storage.ts instead
 */
export function getLatestCostReportFile(directory: string = process.cwd()): string | null {
  try {
    const files = fs.readdirSync(directory)
    
    // Find files matching pattern: "Cost Report Summary *.xlsx"
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
          mtime: stats.mtime
        }
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()) // Sort by modification time, newest first
    
    return costReportFiles.length > 0 ? costReportFiles[0].path : null
  } catch (error) {
    console.error('Error finding cost report files:', error)
    return null
  }
}

export const __loaderTestables = {
  buildProjectNumberVariants,
  rankProjectNumberMatch,
  parseNumericValue,
}


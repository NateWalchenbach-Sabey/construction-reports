/**
 * Diagnostics tool for cost report matching
 * 
 * This tool helps diagnose why projects aren't matching between
 * the database and cost report Excel files.
 */

import * as XLSX from 'xlsx'
import { prisma } from './prisma'
import { normalizeString, extractJobNumber } from './costReportIngest'

interface MatchingDiagnostic {
  excelRow: {
    jobNumber: string | null
    projectNumber: string | null
    projectName: string | null
  }
  potentialMatches: Array<{
    projectId: string
    projectCode: string
    projectName: string
    jobNumber: string | null
    matchReason: string
    confidence: 'high' | 'medium' | 'low'
  }>
  bestMatch: {
    projectId: string | null
    projectCode: string | null
    projectName: string | null
    matchReason: string | null
    confidence: 'high' | 'medium' | 'low' | null
  }
}

/**
 * Run matching diagnostics on a cost report file
 */
export async function diagnoseCostReportMatching(
  excelBuffer: Buffer
): Promise<{
  totalExcelRows: number
  totalDbProjects: number
  diagnostics: MatchingDiagnostic[]
  summary: {
    highConfidenceMatches: number
    mediumConfidenceMatches: number
    lowConfidenceMatches: number
    noMatches: number
  }
}> {
  // Load all projects from database
  const dbProjects = await prisma.project.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      jobNumber: true,
    },
  })

  // Parse Excel file
  const workbook = XLSX.read(excelBuffer, {
    type: 'buffer',
    cellDates: false,
  })

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as any[][]

  // Find header row
  let headerRowIndex = 0
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i]
    if (row && row.filter(cell => cell !== null && cell !== undefined && cell !== '').length >= 3) {
      headerRowIndex = i
      break
    }
  }

  const headers = data[headerRowIndex] || []
  
  // Detect columns (simple detection)
  const jobNumberCol = 0 // Column A
  const projectNumberCol = 1 // Column B
  const projectNameCol = 2 // Column C

  const diagnostics: MatchingDiagnostic[] = []

  // Process Excel rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    const firstCell = row[0]
    if (firstCell && String(firstCell).match(/^SDC\s+/i)) {
      continue // Skip section headers
    }

    const jobNumber = row[jobNumberCol] ? String(row[jobNumberCol]).trim() : null
    const projectNumber = row[projectNumberCol] ? String(row[projectNumberCol]).trim() : null
    const projectName = row[projectNameCol] ? String(row[projectNameCol]).trim() : null

    if (!jobNumber && !projectName) continue
    if (jobNumber && (jobNumber.toLowerCase() === 'n/a' || jobNumber === '')) continue

    // Find potential matches
    const potentialMatches: MatchingDiagnostic['potentialMatches'] = []

    // Normalize Excel data
    const normalizedJob = jobNumber ? normalizeString(jobNumber) : null
    const normalizedProjectNum = projectNumber ? normalizeString(projectNumber) : null
    const normalizedProjectName = projectName ? normalizeString(projectName) : null
    const extractedJob = jobNumber ? extractJobNumber(jobNumber) : null

    // Check each database project
    for (const dbProject of dbProjects) {
      const dbNormalizedName = normalizeString(dbProject.name)
      const dbNormalizedCode = normalizeString(dbProject.code)
      const dbNormalizedJob = dbProject.jobNumber ? normalizeString(dbProject.jobNumber) : null
      const dbExtractedJob = dbProject.jobNumber ? extractJobNumber(dbProject.jobNumber) : null

      let matchReason = ''
      let confidence: 'high' | 'medium' | 'low' = 'low'

      // Check job number match (high confidence)
      if (normalizedJob && dbNormalizedJob && normalizedJob === dbNormalizedJob) {
        matchReason = `Job number exact match: "${jobNumber}" === "${dbProject.jobNumber}"`
        confidence = 'high'
      } else if (extractedJob && dbExtractedJob && normalizeString(extractedJob) === normalizeString(dbExtractedJob)) {
        matchReason = `Job number extracted match: "${extractedJob}" === "${dbExtractedJob}"`
        confidence = 'high'
      }
      // Check project code match (high confidence)
      else if (normalizedProjectNum && dbNormalizedCode && (
        normalizedProjectNum.includes(dbNormalizedCode) || 
        dbNormalizedCode.includes(normalizedProjectNum)
      )) {
        matchReason = `Project code match: "${projectNumber}" contains "${dbProject.code}" or vice versa`
        confidence = 'high'
      }
      // Check if project code appears in job number (medium confidence)
      else if (normalizedJob && dbNormalizedCode && normalizedJob.includes(dbNormalizedCode)) {
        matchReason = `Project code in job number: "${jobNumber}" contains "${dbProject.code}"`
        confidence = 'medium'
      }
      // Check name parts match (medium confidence)
      else if (normalizedProjectName && dbNormalizedName) {
        const excelParts = normalizedProjectName.replace(/sdc-/gi, '').split(/[\s-]+/).filter(p => p.length > 1)
        const dbParts = dbNormalizedName.replace(/sdc-/gi, '').split(/[\s-]+/).filter(p => p.length > 1)
        
        const commonParts = excelParts.filter(p => dbParts.includes(p))
        if (commonParts.length > 0) {
          matchReason = `Name parts match: "${commonParts.join(', ')}" in both names`
          confidence = commonParts.length >= 2 ? 'medium' : 'low'
        }
      }
      // Check substring match (low confidence)
      else if (normalizedProjectName && dbNormalizedName && (
        normalizedProjectName.includes(dbNormalizedName) || 
        dbNormalizedName.includes(normalizedProjectName)
      )) {
        matchReason = `Name substring match: "${projectName}" and "${dbProject.name}"`
        confidence = 'low'
      }

      if (matchReason) {
        potentialMatches.push({
          projectId: dbProject.id,
          projectCode: dbProject.code,
          projectName: dbProject.name,
          jobNumber: dbProject.jobNumber,
          matchReason,
          confidence,
        })
      }
    }

    // Find best match (highest confidence)
    const bestMatch = potentialMatches.length > 0
      ? potentialMatches.reduce((best, current) => {
          const confidenceOrder = { high: 3, medium: 2, low: 1 }
          return confidenceOrder[current.confidence] > confidenceOrder[best.confidence] ? current : best
        })
      : null

    diagnostics.push({
      excelRow: {
        jobNumber,
        projectNumber,
        projectName,
      },
      potentialMatches,
      bestMatch: bestMatch
        ? {
            projectId: bestMatch.projectId,
            projectCode: bestMatch.projectCode,
            projectName: bestMatch.projectName,
            matchReason: bestMatch.matchReason,
            confidence: bestMatch.confidence,
          }
        : {
            projectId: null,
            projectCode: null,
            projectName: null,
            matchReason: null,
            confidence: null,
          },
    })
  }

  // Calculate summary
  const summary = {
    highConfidenceMatches: diagnostics.filter(d => d.bestMatch.confidence === 'high').length,
    mediumConfidenceMatches: diagnostics.filter(d => d.bestMatch.confidence === 'medium').length,
    lowConfidenceMatches: diagnostics.filter(d => d.bestMatch.confidence === 'low').length,
    noMatches: diagnostics.filter(d => d.bestMatch.confidence === null).length,
  }

  return {
    totalExcelRows: diagnostics.length,
    totalDbProjects: dbProjects.length,
    diagnostics,
    summary,
  }
}

/**
 * Generate a matching report
 */
export function generateMatchingReport(diagnostics: ReturnType<typeof diagnoseCostReportMatching> extends Promise<infer T> ? T : never): string {
  let report = '=== Cost Report Matching Diagnostics ===\n\n'
  report += `Total Excel Rows: ${diagnostics.totalExcelRows}\n`
  report += `Total DB Projects: ${diagnostics.totalDbProjects}\n\n`
  report += `Summary:\n`
  report += `  - High Confidence Matches: ${diagnostics.summary.highConfidenceMatches}\n`
  report += `  - Medium Confidence Matches: ${diagnostics.summary.mediumConfidenceMatches}\n`
  report += `  - Low Confidence Matches: ${diagnostics.summary.lowConfidenceMatches}\n`
  report += `  - No Matches: ${diagnostics.summary.noMatches}\n\n`

  report += `=== Unmatched Rows ===\n\n`
  const unmatched = diagnostics.diagnostics.filter(d => d.bestMatch.confidence === null)
  for (const diag of unmatched.slice(0, 10)) {
    report += `Excel Row:\n`
    report += `  Job Number: ${diag.excelRow.jobNumber || 'N/A'}\n`
    report += `  Project Number: ${diag.excelRow.projectNumber || 'N/A'}\n`
    report += `  Project Name: ${diag.excelRow.projectName || 'N/A'}\n`
    report += `  Status: NO MATCH FOUND\n\n`
  }

  report += `=== Low Confidence Matches (Review Needed) ===\n\n`
  const lowConfidence = diagnostics.diagnostics.filter(d => d.bestMatch.confidence === 'low')
  for (const diag of lowConfidence.slice(0, 10)) {
    report += `Excel Row:\n`
    report += `  Job Number: ${diag.excelRow.jobNumber || 'N/A'}\n`
    report += `  Project Number: ${diag.excelRow.projectNumber || 'N/A'}\n`
    report += `  Project Name: ${diag.excelRow.projectName || 'N/A'}\n`
    report += `Matched To:\n`
    report += `  Project Code: ${diag.bestMatch.projectCode}\n`
    report += `  Project Name: ${diag.bestMatch.projectName}\n`
    report += `  Reason: ${diag.bestMatch.matchReason}\n`
    report += `  Confidence: LOW - REVIEW NEEDED\n\n`
  }

  return report
}


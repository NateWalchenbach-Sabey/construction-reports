/**
 * Parse weekly report Excel files to extract:
 * - Project name from row 5
 * - Project numbers from row 7
 */

import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface WeeklyReportData {
  filename: string
  projectName: string | null
  projectNumbers: string[]
}

/**
 * Extract project numbers from a cell value
 */
function extractProjectNumbers(text: string): string[] {
  if (!text) return []
  
  // Pattern: YY-N-NNN or YY-N-NNN-identifier
  // Also handle formats like "24-3-013-asha/24-3-014-asha"
  const pattern = /\b\d{2}-\d-\d{3}(?:-[a-z0-9]+)?\b/gi
  const matches = text.match(pattern) || []
  return matches.map(m => m.toLowerCase().trim())
}

/**
 * Parse a weekly report Excel file
 */
function parseWeeklyReport(filePath: string): WeeklyReportData {
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: false })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    // Convert to JSON array
    const data = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: false,
    }) as any[][]
    
    // Get project name from row 5 (index 4)
    let projectName: string | null = null
    if (data.length > 4) {
      const row5 = data[4] || []
      // Project name is typically in the first few cells of row 5
      for (let i = 0; i < Math.min(5, row5.length); i++) {
        const cellValue = row5[i]
        if (cellValue && String(cellValue).trim().length > 10) {
          projectName = String(cellValue).trim()
          break
        }
      }
    }
    
    // Get project numbers from row 7 (index 6)
    const projectNumbers = new Set<string>()
    if (data.length > 6) {
      const row7 = data[6] || []
      // Project numbers can be in any cell of row 7
      for (const cell of row7) {
        if (cell) {
          const cellText = String(cell).trim()
          const numbers = extractProjectNumbers(cellText)
          numbers.forEach(n => projectNumbers.add(n))
        }
      }
    }
    
    return {
      filename: path.basename(filePath),
      projectName,
      projectNumbers: Array.from(projectNumbers).sort(),
    }
  } catch (error: any) {
    console.error(`Error parsing ${filePath}:`, error.message)
    return {
      filename: path.basename(filePath),
      projectName: null,
      projectNumbers: [],
    }
  }
}

async function parseAllWeeklyReports() {
  const weeklyReportsDir = path.join(process.cwd(), 'weekly_reports')
  
  if (!fs.existsSync(weeklyReportsDir)) {
    console.error('❌ weekly_reports directory not found')
    process.exit(1)
  }
  
  const files = fs.readdirSync(weeklyReportsDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .map(f => path.join(weeklyReportsDir, f))
  
  console.log(`📄 Parsing ${files.length} weekly report files...\n`)
  
  const results: WeeklyReportData[] = []
  
  for (const filePath of files) {
    const result = parseWeeklyReport(filePath)
    results.push(result)
    
    console.log(`\n${result.filename}`)
    console.log(`  Project Name (Row 5): ${result.projectName || 'NOT FOUND'}`)
    console.log(`  Project Numbers (Row 7): ${result.projectNumbers.length > 0 ? result.projectNumbers.join(', ') : 'NOT FOUND'}`)
  }
  
  // Export to JSON
  const outputPath = path.join(process.cwd(), 'weekly-reports-parsed.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`\n✅ Results exported to: ${outputPath}`)
  
  // Try to match to database projects
  console.log(`\n` + '='.repeat(80))
  console.log('MATCHING TO DATABASE PROJECTS')
  console.log('='.repeat(80))
  
  const dbProjects = await prisma.project.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      projectNumber: true,
      projectNumbers: {
        select: {
          projectNumber: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  })
  
  // Create mappings
  const mappings: Array<{
    dbProject: { id: string; code: string; name: string }
    weeklyReport: WeeklyReportData
    matchReason: string
  }> = []
  
  for (const dbProject of dbProjects) {
    // Try to match by filename
    const matchingReport = results.find(r => {
      const filenameLower = r.filename.toLowerCase()
      const codeLower = dbProject.code.toLowerCase()
      const nameLower = dbProject.name.toLowerCase()
      
      // Check if filename contains project code
      if (filenameLower.includes(codeLower)) {
        return true
      }
      
      // Check if filename contains key parts of project name
      const nameParts = nameLower.split(/\s+/).filter(p => p.length > 2)
      for (const part of nameParts) {
        if (filenameLower.includes(part)) {
          return true
        }
      }
      
      return false
    })
    
    if (matchingReport) {
      mappings.push({
        dbProject: {
          id: dbProject.id,
          code: dbProject.code,
          name: dbProject.name,
        },
        weeklyReport: matchingReport,
        matchReason: 'filename match',
      })
    }
  }
  
  console.log(`\n📊 Found ${mappings.length} matches:\n`)
  
  for (const mapping of mappings) {
    console.log(`${mapping.dbProject.code} - ${mapping.dbProject.name}`)
    console.log(`  Weekly Report: ${mapping.weeklyReport.filename}`)
    console.log(`  Project Name from Report: ${mapping.weeklyReport.projectName || 'NOT FOUND'}`)
    console.log(`  Project Numbers: ${mapping.weeklyReport.projectNumbers.join(', ') || 'NONE'}`)
    console.log(`  Current DB Project Numbers: ${mapping.dbProject.projectNumbers.map(pn => pn.projectNumber).join(', ') || 'NONE'}`)
    console.log()
  }
  
  await prisma.$disconnect()
}

parseAllWeeklyReports().catch(console.error)


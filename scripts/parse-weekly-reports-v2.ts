/**
 * Parse weekly report Excel files - improved version
 * Looks for project name and project numbers more carefully
 */

import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

interface WeeklyReportData {
  filename: string
  projectName: string | null
  projectNumbers: string[]
  row5Data: string[]
  row7Data: string[]
}

/**
 * Extract project numbers from text - handles various formats
 */
function extractProjectNumbers(text: string): string[] {
  if (!text) return []
  
  const numbers: string[] = []
  const textLower = text.toLowerCase()
  
  // Pattern 1: YY-N-NNN-identifier (e.g., 24-3-013-asha, 24-3-052-ashadh1)
  const pattern1 = /\b\d{2}-\d-\d{3}(?:-[a-z0-9]+)?\b/gi
  const matches1 = text.match(pattern1) || []
  matches1.forEach(m => numbers.push(m.toLowerCase().trim()))
  
  // Pattern 2: Handle formats like "24-3-052asha-dh1" (missing dash before identifier)
  const pattern2 = /\b\d{2}-\d-\d{3}([a-z]+[0-9a-z-]*)\b/gi
  let match
  while ((match = pattern2.exec(text)) !== null) {
    const fullMatch = match[0]
    if (!numbers.includes(fullMatch.toLowerCase())) {
      numbers.push(fullMatch.toLowerCase().trim())
    }
  }
  
  return [...new Set(numbers)] // Remove duplicates
}

/**
 * Parse a weekly report Excel file
 */
function parseWeeklyReport(filePath: string): WeeklyReportData {
  try {
    const workbook = XLSX.readFile(filePath, { 
      cellDates: false,
      cellText: false,
      cellNF: false,
    })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    // Convert to JSON array with all cells
    const data = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true, // Get raw values
      defval: '',
    }) as any[][]
    
    // Get row 5 data (index 4)
    const row5 = data[4] || []
    const row5Data = row5.map(cell => cell ? String(cell).trim() : '').filter(c => c)
    
    // Get row 7 data (index 6)
    const row7 = data[6] || []
    const row7Data = row7.map(cell => cell ? String(cell).trim() : '').filter(c => c)
    
    // Find project name in row 5, column B (index 1)
    // Column B is typically where the actual project name is
    let projectName: string | null = null
    
    // First, try column B (index 1) of row 5
    if (row5.length > 1 && row5[1]) {
      const cellText = String(row5[1]).trim()
      // Skip header-like text and dates
      if (cellText.length > 5 && 
          !cellText.match(/^(PROJECT NAME|PROJECT|NAME|WEEK|DATE|REPORT)/i) &&
          !cellText.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) {
        projectName = cellText
      }
    }
    
    // If column B doesn't have it, look through other cells in row 5
    if (!projectName) {
      for (let i = 0; i < row5.length; i++) {
        if (row5[i] && typeof row5[i] === 'string') {
          const cellText = String(row5[i]).trim()
          // Skip header-like text and dates
          if (!cellText.match(/^(PROJECT NAME|PROJECT|NAME|WEEK|DATE|REPORT)/i) && 
              cellText.length > 10 && 
              !cellText.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) {
            projectName = cellText
            break
          }
        }
      }
    }
    
    // If still no project name, check row 4 or row 6
    if (!projectName) {
      const row4 = data[3] || []
      if (row4.length > 1 && row4[1]) {
        const cellText = String(row4[1]).trim()
        if (cellText.length > 10 && !cellText.match(/^(PROJECT|WEEK|DATE)/i)) {
          projectName = cellText
        }
      }
    }
    
    // Extract all project numbers from row 7
    const projectNumbers = new Set<string>()
    for (const cell of row7) {
      if (cell) {
        const cellText = String(cell).trim()
        const numbers = extractProjectNumbers(cellText)
        numbers.forEach(n => projectNumbers.add(n))
      }
    }
    
    // Also check row 6 and row 8 for project numbers (sometimes they span rows)
    const row6 = data[5] || []
    for (const cell of row6) {
      if (cell) {
        const cellText = String(cell).trim()
        const numbers = extractProjectNumbers(cellText)
        numbers.forEach(n => projectNumbers.add(n))
      }
    }
    
    const row8 = data[7] || []
    for (const cell of row8) {
      if (cell) {
        const cellText = String(cell).trim()
        const numbers = extractProjectNumbers(cellText)
        numbers.forEach(n => projectNumbers.add(n))
      }
    }
    
    return {
      filename: path.basename(filePath),
      projectName: projectName || null,
      projectNumbers: Array.from(projectNumbers).sort(),
      row5Data,
      row7Data,
    }
  } catch (error: any) {
    console.error(`Error parsing ${filePath}:`, error.message)
    return {
      filename: path.basename(filePath),
      projectName: null,
      projectNumbers: [],
      row5Data: [],
      row7Data: [],
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
    console.log(`  Row 5 cells: ${result.row5Data.slice(0, 5).join(' | ')}`)
    console.log(`  Project Name: ${result.projectName || 'NOT FOUND'}`)
    console.log(`  Row 7 cells: ${result.row7Data.slice(0, 5).join(' | ')}`)
    console.log(`  Project Numbers: ${result.projectNumbers.length > 0 ? result.projectNumbers.join(', ') : 'NOT FOUND'}`)
  }
  
  // Export to JSON
  const outputPath = path.join(process.cwd(), 'weekly-reports-parsed-v2.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`\n✅ Results exported to: ${outputPath}`)
}

parseAllWeeklyReports().catch(console.error)


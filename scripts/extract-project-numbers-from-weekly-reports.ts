/**
 * Extract project numbers from weekly report Excel files
 * This script scans all weekly report files to find project numbers
 */

import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Extract project numbers from a cell value
 * Pattern: YY-N-NNN or YY-N-NNN-identifier (e.g., 24-7-031, 25-7-131-quie6)
 */
function extractProjectNumbers(text: string): string[] {
  if (!text) return []
  
  const pattern = /\b\d{2}-\d-\d{3}(?:-[a-z0-9]+)?\b/gi
  const matches = text.match(pattern) || []
  return matches.map(m => m.toLowerCase())
}

/**
 * Extract project numbers from an Excel file
 */
function extractProjectNumbersFromFile(filePath: string): { projectNumbers: string[]; projectName: string | null } {
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: false })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    // Convert to JSON to search through
    const data = XLSX.utils.sheet_to_json(sheet, { 
      header: 1, 
      defval: null,
      raw: false // Get formatted values as strings
    }) as any[][]
    
    const projectNumbers = new Set<string>()
    let projectName: string | null = null
    
    // Search through all cells
    for (let rowIndex = 0; rowIndex < Math.min(data.length, 100); rowIndex++) {
      const row = data[rowIndex] || []
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cellValue = row[colIndex]
        if (!cellValue) continue
        
        const cellText = String(cellValue).trim()
        
        // Look for project numbers
        const numbers = extractProjectNumbers(cellText)
        numbers.forEach(num => projectNumbers.add(num))
        
        // Try to extract project name from filename or first few rows
        if (rowIndex < 10 && cellText.length > 10 && cellText.length < 100) {
          // Look for project-like names (containing SDC, AUS, ASH, etc.)
          if (/^(SDC|AUS|ASH|IGE|IGQ|SEA|JAMES|JEFFERSON)/i.test(cellText)) {
            if (!projectName || cellText.length > projectName.length) {
              projectName = cellText
            }
          }
        }
      }
    }
    
    return {
      projectNumbers: Array.from(projectNumbers).sort(),
      projectName: projectName || path.basename(filePath, '.xlsx')
    }
  } catch (error: any) {
    console.error(`Error reading ${filePath}:`, error.message)
    return { projectNumbers: [], projectName: null }
  }
}

async function extractAllProjectNumbers() {
  const weeklyReportsDir = path.join(process.cwd(), 'weekly_reports')
  
  if (!fs.existsSync(weeklyReportsDir)) {
    console.error('❌ weekly_reports directory not found')
    process.exit(1)
  }
  
  const files = fs.readdirSync(weeklyReportsDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .map(f => path.join(weeklyReportsDir, f))
  
  console.log(`📄 Found ${files.length} weekly report files\n`)
  
  const results: Array<{
    filename: string
    projectName: string | null
    projectNumbers: string[]
  }> = []
  
  for (const filePath of files) {
    const filename = path.basename(filePath)
    console.log(`Processing: ${filename}...`)
    
    const { projectNumbers, projectName } = extractProjectNumbersFromFile(filePath)
    
    results.push({
      filename,
      projectName,
      projectNumbers,
    })
    
    if (projectNumbers.length > 0) {
      console.log(`  ✓ Found ${projectNumbers.length} project number(s): ${projectNumbers.join(', ')}`)
    } else {
      console.log(`  ⚠ No project numbers found`)
    }
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log()
  
  // Get all database projects
  const dbProjects = await prisma.project.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      projectNumber: true,
    },
    orderBy: { name: 'asc' },
  })
  
  console.log('📊 Project Numbers by Weekly Report File:')
  console.log()
  
  for (const result of results) {
    console.log(`${result.filename}`)
    if (result.projectName) {
      console.log(`  Project Name: ${result.projectName}`)
    }
    if (result.projectNumbers.length > 0) {
      console.log(`  Project Numbers: ${result.projectNumbers.join(', ')}`)
    } else {
      console.log(`  ⚠ No project numbers found`)
    }
    console.log()
  }
  
  // Try to match files to database projects
  console.log('='.repeat(80))
  console.log('MATCHING TO DATABASE PROJECTS')
  console.log('='.repeat(80))
  console.log()
  
  for (const dbProject of dbProjects) {
    console.log(`\n${dbProject.name} (${dbProject.code})`)
    console.log(`  Current projectNumber: ${dbProject.projectNumber || 'NOT SET'}`)
    
    // Find matching weekly report files
    const matchingFiles = results.filter(r => {
      const filenameLower = r.filename.toLowerCase()
      const projectNameLower = dbProject.name.toLowerCase()
      const codeLower = dbProject.code.toLowerCase()
      
      // Check if filename contains project code or name
      return filenameLower.includes(codeLower.toLowerCase()) ||
             filenameLower.includes(projectNameLower.replace(/\s+/g, '').substring(0, 10)) ||
             (r.projectName && r.projectName.toLowerCase().includes(projectNameLower.substring(0, 20)))
    })
    
    if (matchingFiles.length > 0) {
      const allProjectNumbers = new Set<string>()
      matchingFiles.forEach(f => f.projectNumbers.forEach(n => allProjectNumbers.add(n)))
      
      if (allProjectNumbers.size > 0) {
        console.log(`  ✓ Matching files: ${matchingFiles.map(f => f.filename).join(', ')}`)
        console.log(`  📋 Project numbers from weekly reports: ${Array.from(allProjectNumbers).sort().join(', ')}`)
      } else {
        console.log(`  ⚠ Matching files found but no project numbers extracted`)
      }
    } else {
      console.log(`  ⚠ No matching weekly report files found`)
    }
  }
  
  // Export results to JSON
  const outputPath = path.join(process.cwd(), 'weekly-reports-project-numbers.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`\n✅ Results exported to: ${outputPath}`)
  
  await prisma.$disconnect()
}

extractAllProjectNumbers().catch(console.error)


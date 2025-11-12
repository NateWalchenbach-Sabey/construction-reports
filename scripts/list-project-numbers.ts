/**
 * Script to list all project numbers from cost report and database projects
 * This helps identify which project numbers need to be mapped to which database projects
 * 
 * Usage: npx tsx scripts/list-project-numbers.ts [cost-report-file.xlsx]
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

const prisma = new PrismaClient()

/**
 * Extract project numbers and names from cost report Excel file
 */
function extractProjectNumbersFromExcel(filePath: string): Array<{ projectNumber: string; projectName: string; jobNumber: string }> {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheetName = 'Cost Rpt Summary'
  const sheet = workbook.Sheets[sheetName]
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in Excel file`)
  }
  
  // Convert to JSON with headers starting at row 5 (0-indexed: 4)
  const data = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    range: 4, // Start from row 5 (0-indexed: 4)
  }) as any[][]
  
  const jobNumberCol = 0 // Column A - Job Number
  const projectNumberCol = 1 // Column B - Project Number
  const projectNameCol = 2 // Column C - Project Name
  
  const projects: Array<{ projectNumber: string; projectName: string; jobNumber: string }> = []
  const seen = new Set<string>()
  
  // Process data rows (skip header row)
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    
    if (!row || !row[jobNumberCol]) continue
    
    const jobNumber = String(row[jobNumberCol]).trim()
    
    // Skip section headers (like "SDC Ashburn", "SDC Quincy")
    if (!jobNumber || jobNumber === 'n/a' || jobNumber.match(/^SDC\s+/i)) {
      continue
    }
    
    // Get project number from column B (may be empty or null)
    const projectNumber = row[projectNumberCol] 
      ? String(row[projectNumberCol]).trim() 
      : null
    const projectName = row[projectNameCol] ? String(row[projectNameCol]).trim() : ''
    
    if (projectNumber && projectNumber !== 'n/a' && projectNumber !== '') {
      // Deduplicate by project number (take first occurrence)
      if (!seen.has(projectNumber)) {
        projects.push({
          projectNumber,
          projectName,
          jobNumber,
        })
        seen.add(projectNumber)
      }
    }
  }
  
  return projects
}

async function listProjectNumbers() {
  try {
    // Get cost report file path
    let costReportPath: string | null = null
    
    if (process.argv[2]) {
      costReportPath = path.resolve(process.argv[2])
    } else {
      costReportPath = path.join(process.cwd(), 'Cost Report Summary 10.15.25.xlsx')
    }
    
    if (!costReportPath || !fs.existsSync(costReportPath)) {
      console.error('❌ Cost report file not found')
      console.error('Usage: npx tsx scripts/list-project-numbers.ts [cost-report-file.xlsx]')
      process.exit(1)
    }
    
    console.log(`📄 Loading cost report: ${costReportPath}\n`)
    
    // Extract project numbers from Excel
    const excelProjects = extractProjectNumbersFromExcel(costReportPath)
    console.log(`📊 Found ${excelProjects.length} unique project numbers in cost report\n`)
    
    // Get all projects from database
    const dbProjects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        projectNumber: true,
      },
      orderBy: { name: 'asc' },
    })
    
    console.log(`📦 Found ${dbProjects.length} projects in database\n`)
    
    console.log('='.repeat(80))
    console.log('PROJECT NUMBERS FROM COST REPORT (Column B)')
    console.log('='.repeat(80))
    console.log('\n')
    
    excelProjects.forEach((p, index) => {
      console.log(`${index + 1}. Project Number: ${p.projectNumber}`)
      console.log(`   Project Name: ${p.projectName}`)
      console.log(`   Job Number: ${p.jobNumber}`)
      console.log('')
    })
    
    console.log('='.repeat(80))
    console.log('DATABASE PROJECTS (Need Project Numbers)')
    console.log('='.repeat(80))
    console.log('\n')
    
    dbProjects.forEach((p, index) => {
      console.log(`${index + 1}. Code: ${p.code}`)
      console.log(`   Name: ${p.name}`)
      console.log(`   Current Project Number: ${p.projectNumber || 'NOT SET'}`)
      console.log('')
    })
    
    console.log('='.repeat(80))
    console.log('MAPPING INSTRUCTIONS')
    console.log('='.repeat(80))
    console.log('\n')
    console.log('To update project numbers, you can:')
    console.log('1. Use the script: npx tsx scripts/update-project-numbers.ts')
    console.log('2. Manually update in the database using Prisma Studio: npx prisma studio')
    console.log('3. Use the API to update projects (if you have an admin UI)')
    console.log('\n')
    console.log('Project numbers should match Column B from the cost report Excel file.')
    console.log('These are the key identifiers for matching cost report data to projects.')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

listProjectNumbers()


/**
 * Script to extract project numbers from cost report and update database projects
 * 
 * Usage: npx tsx scripts/update-project-numbers.ts [cost-report-file.xlsx]
 * 
 * This script:
 * 1. Loads the cost report Excel file
 * 2. Extracts project numbers (Column B) and project names (Column C)
 * 3. Matches them to database projects by name (fuzzy matching)
 * 4. Updates the database with project numbers
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

const prisma = new PrismaClient()

/**
 * Normalize string for matching (lowercase, remove punctuation, collapse whitespace)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()
}

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
      projects.push({
        projectNumber,
        projectName,
        jobNumber,
      })
    }
  }
  
  return projects
}

/**
 * Match Excel project to database project by name
 */
function matchProjectByName(
  excelName: string,
  dbProjects: Array<{ id: string; name: string; code: string }>
): { id: string; name: string; code: string } | null {
  const normalizedExcelName = normalizeString(excelName)
  
  // Try exact match first
  for (const dbProject of dbProjects) {
    const normalizedDbName = normalizeString(dbProject.name)
    if (normalizedDbName === normalizedExcelName) {
      return dbProject
    }
  }
  
  // Try partial match (Excel name contains DB name or vice versa)
  for (const dbProject of dbProjects) {
    const normalizedDbName = normalizeString(dbProject.name)
    if (normalizedExcelName.includes(normalizedDbName) || normalizedDbName.includes(normalizedExcelName)) {
      return dbProject
    }
  }
  
  // Try matching key parts (remove dates, SDC prefix, etc.)
  const excelParts = normalizedExcelName
    .replace(/sdc-/gi, '')
    .replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/g, '') // Remove dates like "11.1.25"
    .replace(/\d{1,2}\s+\d{1,2}\s+\d{2,4}/g, '') // Remove dates like "11 01 25"
    .split(/[\s-]+/)
    .filter(part => part.length > 2)
  
  for (const dbProject of dbProjects) {
    const dbParts = normalizeString(dbProject.name)
      .replace(/sdc-/gi, '')
      .split(/[\s-]+/)
      .filter(part => part.length > 2)
    
    // Check if significant parts match
    const matchingParts = excelParts.filter(ep => 
      dbParts.some(dp => dp.includes(ep) || ep.includes(dp))
    )
    
    if (matchingParts.length >= 2 || (matchingParts.length === 1 && matchingParts[0].length >= 4)) {
      return dbProject
    }
  }
  
  return null
}

async function updateProjectNumbers() {
  try {
    // Get cost report file path from command line argument or find latest
    let costReportPath: string | null = null
    
    if (process.argv[2]) {
      costReportPath = path.resolve(process.argv[2])
    } else {
      // Try to find cost report file in current directory or uploads
      const possiblePaths = [
        path.join(process.cwd(), 'Cost Report Summary 10.15.25.xlsx'),
        path.join(process.cwd(), 'uploads', 'cost-reports', 'Cost Report Summary 10.15.25.xlsx'),
      ]
      
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          costReportPath = possiblePath
          break
        }
      }
      
      // If not found, look for any cost report file
      if (!costReportPath) {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'cost-reports')
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir)
          const costReportFiles = files.filter(f => 
            f.match(/Cost\s+Report\s+Summary.*\.xlsx$/i)
          )
          if (costReportFiles.length > 0) {
            costReportPath = path.join(uploadsDir, costReportFiles[costReportFiles.length - 1])
          }
        }
      }
    }
    
    if (!costReportPath || !fs.existsSync(costReportPath)) {
      console.error('❌ Cost report file not found')
      console.error('Usage: npx tsx scripts/update-project-numbers.ts [cost-report-file.xlsx]')
      console.error('\nTried to find:')
      console.error('  - Cost Report Summary 10.15.25.xlsx')
      console.error('  - uploads/cost-reports/Cost Report Summary 10.15.25.xlsx')
      process.exit(1)
    }
    
    console.log(`📄 Loading cost report: ${costReportPath}\n`)
    
    // Extract project numbers from Excel
    const excelProjects = extractProjectNumbersFromExcel(costReportPath)
    console.log(`📊 Found ${excelProjects.length} projects with project numbers in cost report\n`)
    
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
    
    // Match and update
    const updates: Array<{
      dbProject: { id: string; name: string; code: string }
      excelProject: { projectNumber: string; projectName: string; jobNumber: string }
    }> = []
    
    const unmatched: Array<{ projectNumber: string; projectName: string; jobNumber: string }> = []
    
    for (const excelProject of excelProjects) {
      const matched = matchProjectByName(excelProject.projectName, dbProjects)
      if (matched) {
        updates.push({
          dbProject: matched,
          excelProject,
        })
      } else {
        unmatched.push(excelProject)
      }
    }
    
    console.log(`✅ Matched ${updates.length} projects\n`)
    console.log(`❌ Could not match ${unmatched.length} projects:\n`)
    unmatched.forEach(p => {
      console.log(`  - ${p.projectNumber}: ${p.projectName}`)
    })
    
    if (updates.length === 0) {
      console.log('\n⚠️  No projects to update')
      return
    }
    
    console.log(`\n📝 Projects to update:\n`)
    updates.forEach(({ dbProject, excelProject }) => {
      const currentProjectNumber = dbProject.projectNumber || 'Not set'
      console.log(`  ${dbProject.name} (${dbProject.code})`)
      console.log(`    Current: ${currentProjectNumber}`)
      console.log(`    New: ${excelProject.projectNumber}`)
      console.log(`    Excel Name: ${excelProject.projectName}\n`)
    })
    
    // Ask for confirmation
    console.log('⚠️  This will update the database. Press Ctrl+C to cancel.\n')
    console.log('Updating projects...\n')
    
    // Update projects
    let updated = 0
    for (const { dbProject, excelProject } of updates) {
      // Only update if project number is different or not set
      if (dbProject.projectNumber !== excelProject.projectNumber) {
        await prisma.project.update({
          where: { id: dbProject.id },
          data: { projectNumber: excelProject.projectNumber },
        })
        console.log(`✅ Updated: ${dbProject.name} -> Project Number: ${excelProject.projectNumber}`)
        updated++
      } else {
        console.log(`⏭️  Skipped: ${dbProject.name} (already has project number: ${excelProject.projectNumber})`)
      }
    }
    
    console.log(`\n✅ Successfully updated ${updated} projects`)
    console.log(`\n📊 Summary:`)
    console.log(`  - Total projects in Excel: ${excelProjects.length}`)
    console.log(`  - Matched to database: ${updates.length}`)
    console.log(`  - Updated: ${updated}`)
    console.log(`  - Unmatched: ${unmatched.length}`)
    
    if (unmatched.length > 0) {
      console.log(`\n⚠️  Unmatched projects (these might be new projects not in database yet):`)
      unmatched.forEach(p => {
        console.log(`  - ${p.projectNumber}: ${p.projectName}`)
      })
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

updateProjectNumbers()


/**
 * Quick script to map common project numbers based on project names
 * This uses intelligent matching to automatically map project numbers
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

const prisma = new PrismaClient()

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractProjectNumbersFromExcel(filePath: string): Array<{ projectNumber: string; projectName: string; jobNumber: string }> {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheetName = 'Cost Rpt Summary'
  const sheet = workbook.Sheets[sheetName]
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`)
  }
  
  const data = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    range: 4,
  }) as any[][]
  
  const jobNumberCol = 0
  const projectNumberCol = 1
  const projectNameCol = 2
  
  const projects: Array<{ projectNumber: string; projectName: string; jobNumber: string }> = []
  const seen = new Set<string>()
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || !row[jobNumberCol]) continue
    
    const jobNumber = String(row[jobNumberCol]).trim()
    if (!jobNumber || jobNumber === 'n/a' || jobNumber.match(/^SDC\s+/i)) {
      continue
    }
    
    const projectNumber = row[projectNumberCol] ? String(row[projectNumberCol]).trim() : null
    const projectName = row[projectNameCol] ? String(row[projectNameCol]).trim() : ''
    
    if (projectNumber && projectNumber !== 'n/a' && projectNumber !== '' && projectNumber !== 'tbd' && !seen.has(projectNumber)) {
      projects.push({ projectNumber, projectName, jobNumber })
      seen.add(projectNumber)
    }
  }
  
  return projects
}

// Manual mappings based on project names (you can adjust these)
const MANUAL_MAPPINGS: Record<string, string> = {
  'ASH AB1': '22-3-303', // SDC-ASH-B AB1-1 & AB1-2 6MW Data Halls LLO
  'AUS 11 Weekly Job Status': '24-4-022-ausa11', // SDC-AUS-A11 9MW Data Hall
  'AUS 12 Weekly Job Status': '24-4-055-ausa12', // SDC-AUS-A12 TACC 15MW LLO
  'AUS Building B': '25-4-085-ausbsi', // SDC-AUS-B Site LLO (or could be 25-4-086-asubsc)
  'IGE SDC 43 6MW': '23-7-719', // SDC-SEA-43 6MW Data Hall Build
  'IGQ QUI E16 ZOHO OFFICE EXPANSION LLO': '25-7-131-quie6', // SDC-QUI-E6 Zoho Office Exp LLO
  'IGQ QUI E1 9MW LLO': '24-7-031-quie1dh', // SDC-QUI-E1 9MW Data Hall LLO
  'James Tower Elevator Mods.': '24-2-034-jamtow', // James Tower Elevator Modernization
  'Jefferson Garage Elevator Modernization': '24-2-033-jeffgar', // Jefferson Tower Garage Elevator Modernization
  'SDC COL B DATA HALL 1&2 TIER 3 CONVERSION': '24-7-079-colb12', // SDC-COL-B Data Hall 1 & 2 Tier 3 Conversion
  'SDC Columbia 24 7 051 SDC COL E Shell Core LLO': '24-7-051-colesc', // SDC-COL-E Shell & Core LLO
  'SDC Manhattan Cooling Tower 6 Study': '25-6-105-ny375', // SDC-NY Cooling Tower 6 Study
  'SDC Manhattan NYSERDA Heat Recovery Study': '25-6-113-ny375', // SDC-NY NYSERDA Heat Recovery Study
  'SDC QUI E1 MWH23 EX2 Fit Out TI': '24-7-031-quie1dh', // Could be same as IGQ QUI E1
  'SDC QUI Juniper Office Storage Conversion': '25-7-132-quic', // SDC-QUI-C Juniper Office to Storage Conversion LLO
  'SDC SEA 53 UPS Replacement': '24-7-077-sdc53', // SDC-SEA-53 UPS Replacement LLO
  'SDC SEA SDC42 Chiller': '25-7-095-sdc42', // SDC-SEA-42 D2 Chiller Install LLO
  'SEA Providence Pharmacy HVAC TI': 'tbd', // Might not have a project number yet
}

async function quickMapProjectNumbers() {
  try {
    const costReportPath = path.join(process.cwd(), 'Cost Report Summary 10.15.25.xlsx')
    
    if (!fs.existsSync(costReportPath)) {
      console.error('❌ Cost report file not found')
      process.exit(1)
    }
    
    console.log('📄 Loading projects and cost report...\n')
    
    const excelProjects = extractProjectNumbersFromExcel(costReportPath)
    const dbProjects = await prisma.project.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        projectNumber: true,
      },
      orderBy: { name: 'asc' },
    })
    
    console.log(`📊 Found ${excelProjects.length} project numbers in cost report`)
    console.log(`📦 Found ${dbProjects.length} projects in database\n`)
    
    const updates: Array<{ id: string; name: string; code: string; projectNumber: string }> = []
    
    for (const dbProject of dbProjects) {
      // Skip if already has project number
      if (dbProject.projectNumber) {
        console.log(`⏭️  Skipped: ${dbProject.name} (already has: ${dbProject.projectNumber})`)
        continue
      }
      
      // Check manual mappings first
      if (MANUAL_MAPPINGS[dbProject.name]) {
        const projectNumber = MANUAL_MAPPINGS[dbProject.name]
        if (projectNumber !== 'tbd') {
          updates.push({
            id: dbProject.id,
            name: dbProject.name,
            code: dbProject.code,
            projectNumber,
          })
        }
        continue
      }
      
      // Try to match by name
      const normalizedDbName = normalizeString(dbProject.name)
      const match = excelProjects.find(excel => {
        const normalizedExcelName = normalizeString(excel.projectName)
        
        // Extract key parts from database name
        const dbParts = normalizedDbName
          .replace(/sdc-/gi, '')
          .split(/[\s-]+/)
          .filter(p => p.length > 2)
        
        // Extract key parts from Excel name
        const excelParts = normalizedExcelName
          .replace(/sdc-/gi, '')
          .split(/[\s-]+/)
          .filter(p => p.length > 2)
        
        // Check if significant parts match
        const matchingParts = dbParts.filter(dbp => 
          excelParts.some(ep => ep.includes(dbp) || dbp.includes(ep))
        )
        
        return matchingParts.length >= 2
      })
      
      if (match) {
        updates.push({
          id: dbProject.id,
          name: dbProject.name,
          code: dbProject.code,
          projectNumber: match.projectNumber,
        })
      }
    }
    
    if (updates.length === 0) {
      console.log('✅ No projects need updating')
      return
    }
    
    console.log(`\n📝 Projects to update:\n`)
    updates.forEach(u => {
      console.log(`  ${u.name} (${u.code})`)
      console.log(`    -> ${u.projectNumber}\n`)
    })
    
    console.log('⚠️  This will update the database. Press Ctrl+C to cancel.\n')
    console.log('Updating projects...\n')
    
    let updated = 0
    for (const update of updates) {
      await prisma.project.update({
        where: { id: update.id },
        data: { projectNumber: update.projectNumber },
      })
      console.log(`✅ Updated: ${update.name} -> ${update.projectNumber}`)
      updated++
    }
    
    console.log(`\n✅ Successfully updated ${updated} projects`)
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

quickMapProjectNumbers()


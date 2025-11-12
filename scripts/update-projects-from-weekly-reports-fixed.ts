/**
 * Update projects in database with data from weekly reports - FIXED VERSION
 * Improved matching logic to correctly map weekly reports to database projects
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface WeeklyReportData {
  filename: string
  projectName: string | null
  projectNumbers: string[]
}

/**
 * Normalize project number format
 * Examples:
 * - "24-3-013-asha" -> "24-3-013-asha"
 * - "24-3-052asha-dh1" -> "24-3-052-ashadh1" (remove dash in identifier, add dash after number)
 * - "24-7-023-cole1" -> "24-7-023-cole1"
 */
function normalizeProjectNumber(pn: string): string {
  let normalized = pn.trim().toLowerCase().replace(/\s+/g, '')
  
  // Pattern: YY-N-NNN followed by identifier (with or without dash)
  // If there's no dash after the 3-digit number, add one
  // Remove any dashes within the identifier part and keep it as one unit
  if (normalized.match(/^\d{2}-\d-\d{3}[a-z]/)) {
    // Format: YY-N-NNNidentifier (no dash, identifier starts immediately)
    normalized = normalized.replace(/^(\d{2}-\d-\d{3})([a-z][a-z0-9-]*)$/, (match, prefix, identifier) => {
      // Remove any dashes from identifier
      const cleanId = identifier.replace(/-/g, '')
      return `${prefix}-${cleanId}`
    })
  } else if (normalized.match(/^\d{2}-\d-\d{3}-/)) {
    // Format: YY-N-NNN-identifier (already has dash)
    // Just clean up any extra dashes in identifier
    normalized = normalized.replace(/^(\d{2}-\d-\d{3}-)([a-z0-9-]+)$/, (match, prefix, identifier) => {
      // Remove any dashes from identifier part
      const cleanId = identifier.replace(/-/g, '')
      return `${prefix}${cleanId}`
    })
  }
  
  return normalized
}

/**
 * Manual mappings - explicit mapping of weekly report filenames to project codes
 * Note: Some weekly reports may map to the same project code if they represent the same project
 */
const WEEKLY_REPORT_TO_PROJECT_CODE: Record<string, string> = {
  'ASH-A 10 - 25 -25  .xlsx': 'ASH',
  'ASH-AB1 10-25 -25 .xlsx': 'ASH-1',
  'AUS-11 Weekly Job Status 10.25.25.xlsx': 'AUS',
  'AUS-12 Weekly Job Status 10.25.25.xlsx': 'AUS-1',
  'AUS Building B 10.25.25.xlsx': 'AUS-2',
  // 'AUS-23 Weekly Job Status 10.25.25.xlsx': 'AUS-2', // Skip - this might be a separate project
  'IGE SDC 43 6MW.xlsx': 'IGE',
  'IGQ-QUI-E1 9MW LLO 10.25.25.xlsx': 'IGQ',
  'IGQ-QUI-E16 ZOHO OFFICE EXPANSION LLO  10.25.25.xlsx': 'IGQ-1',
  'James Tower Elevator Modernization - 10-25-2025.xlsx': 'JAMES',
  'Jefferson Garage Elevator Modernization - 10-25-2025.xlsx': 'JEFFERSON',
  'SDC-COL-B DATA HALL 1&2 TIER 3 CONVERSION 10.25.25.xlsx': 'SDC',
  'SDC- Columbia  24 7 051  SDC COL E Shell Core LLO (24 8 051) 10-25-2025.xlsx': 'SDC-1',
  'SDC Manhattan Cooling Tower 6 Study - 10.25.25.xlsx': 'SDC-2',
  'SDC Manhattan NYSERDA Heat Recovery Study - 10.25.25.xlsx': 'SDC-3',
  // 'SDC Manhattan LL11 Facade Restoration - 10.25.25.xlsx': 'SDC-2', // Skip - this appears to be a separate project
  'SDC -QUI-E1 MWH23-EX2 Fit Out TI 10.25.25.xlsx': 'SDC-4',
  'SDC-QUI-Juniper Office -Storage Conversion 10.25.25.xlsx': 'SDC-5',
  'SDC-SEA-53 UPS Replacement 10.24.2025.xlsx': 'SDC-6',
  'SDC-SEA-SDC42 Chiller 10.25.2025.xlsx': 'SDC-7',
  'SEA-Providence Pharmacy HVAC TI - 10-25-2025.xlsx': 'SEA',
}

async function updateProjectsFromWeeklyReports() {
  // Load parsed weekly reports
  const parsedDataPath = path.join(process.cwd(), 'weekly-reports-parsed-v2.json')
  if (!fs.existsSync(parsedDataPath)) {
    console.error('❌ Parsed weekly reports file not found. Run parse-weekly-reports-v2.ts first.')
    process.exit(1)
  }
  
  const weeklyReports: WeeklyReportData[] = JSON.parse(fs.readFileSync(parsedDataPath, 'utf-8'))
  
  console.log(`📄 Loaded ${weeklyReports.length} weekly reports\n`)
  
  // Get all database projects
  const dbProjects = await prisma.project.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      projectNumber: true,
      projectNumbers: {
        select: {
          id: true,
          projectNumber: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  })
  
  console.log(`📦 Found ${dbProjects.length} projects in database\n`)
  
  // Create a map of project codes to database projects
  const dbProjectMap = new Map(dbProjects.map(p => [p.code, p]))
  
  // Match weekly reports to database projects using explicit mappings
  const updates: Array<{
    project: { id: string; code: string; name: string }
    weeklyReport: WeeklyReportData
    projectNumbers: string[]
  }> = []
  
  for (const weeklyReport of weeklyReports) {
    const projectCode = WEEKLY_REPORT_TO_PROJECT_CODE[weeklyReport.filename]
    
    if (projectCode && dbProjectMap.has(projectCode)) {
      const dbProject = dbProjectMap.get(projectCode)!
      
      if (weeklyReport.projectName) {
        // Normalize project numbers
        const normalizedProjectNumbers = weeklyReport.projectNumbers
          .map(normalizeProjectNumber)
          .filter(pn => pn && pn !== 'n/a' && pn.length > 5)
        
        updates.push({
          project: dbProject,
          weeklyReport,
          projectNumbers: normalizedProjectNumbers,
        })
      }
    } else {
      console.log(`⚠️  No mapping found for: ${weeklyReport.filename}`)
    }
  }
  
  console.log(`📊 Found ${updates.length} projects to update:\n`)
  
  for (const update of updates) {
    console.log(`${update.project.code} - ${update.project.name}`)
    console.log(`  New Name: ${update.weeklyReport.projectName}`)
    console.log(`  Project Numbers: ${update.projectNumbers.join(', ')}`)
    console.log()
  }
  
  // Apply updates
  console.log('⚠️  This will update the database. Press Ctrl+C to cancel.\n')
  console.log('Updating projects...\n')
  
  let updatedNames = 0
  let updatedProjectNumbers = 0
  
  for (const update of updates) {
    // Update project name
    if (update.weeklyReport.projectName && update.weeklyReport.projectName !== update.project.name) {
      await prisma.project.update({
        where: { id: update.project.id },
        data: { name: update.weeklyReport.projectName },
      })
      console.log(`✅ Updated name: ${update.project.code} -> "${update.weeklyReport.projectName}"`)
      updatedNames++
    }
    
    // Delete existing project numbers for this project
    if (update.project.projectNumbers.length > 0) {
      await prisma.projectProjectNumber.deleteMany({
        where: { projectId: update.project.id },
      })
      console.log(`  🗑️  Deleted ${update.project.projectNumbers.length} existing project number(s)`)
    }
    
    // Add new project numbers
    for (const pn of update.projectNumbers) {
      try {
        await prisma.projectProjectNumber.create({
          data: {
            projectId: update.project.id,
            projectNumber: pn,
            source: 'weekly_report',
            notes: `From weekly report: ${update.weeklyReport.filename}`,
          },
        })
        console.log(`  ✅ Added project number: ${pn}`)
        updatedProjectNumbers++
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`  ⚠️  Project number already exists: ${pn}`)
        } else {
          console.error(`  ❌ Error adding project number ${pn}:`, error.message)
        }
      }
    }
    
    // Update primary projectNumber (use first one)
    if (update.projectNumbers.length > 0) {
      await prisma.project.update({
        where: { id: update.project.id },
        data: { projectNumber: update.projectNumbers[0] },
      })
    }
    
    console.log()
  }
  
  console.log(`\n✅ Successfully updated projects`)
  console.log(`   Updated names: ${updatedNames}`)
  console.log(`   Updated project numbers: ${updatedProjectNumbers} entries`)
  
  await prisma.$disconnect()
}

updateProjectsFromWeeklyReports().catch(console.error)


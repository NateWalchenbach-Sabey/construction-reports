/**
 * Update projects in database with data from weekly reports
 * - Update project names to match weekly reports
 * - Update project numbers to match weekly reports
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
 * Converts "24-3-052asha-dh1" to "24-3-052-ashadh1"
 */
function normalizeProjectNumber(pn: string): string {
  // Remove any spaces
  let normalized = pn.trim().toLowerCase().replace(/\s+/g, '')
  
  // Fix format: YY-N-NNNidentifier-identifier to YY-N-NNN-identifier-identifier
  // Pattern: \d{2}-\d-\d{3}[a-z] should become \d{2}-\d-\d{3}-[a-z]
  normalized = normalized.replace(/(\d{2}-\d-\d{3})([a-z])/g, '$1-$2')
  
  return normalized
}

/**
 * Manual mappings based on filename patterns
 */
const FILENAME_TO_PROJECT_CODE: Record<string, string> = {
  'ASH-A': 'ASH',
  'ASH-AB1': 'ASH-1',
  'AUS-11': 'AUS',
  'AUS-12': 'AUS-1',
  'AUS Building B': 'AUS-2',
  'AUS-23': 'AUS-2', // This might be a separate project, but maps to AUS-2 for now
  'IGE SDC 43': 'IGE',
  'IGQ-QUI-E1': 'IGQ',
  'IGQ-QUI-E16': 'IGQ-1',
  'James Tower': 'JAMES',
  'Jefferson Garage': 'JEFFERSON',
  'SDC COL B': 'SDC',
  'SDC- Columbia': 'SDC-1',
  'SDC Manhattan Cooling Tower': 'SDC-2',
  'SDC Manhattan NYSERDA': 'SDC-3',
  'SDC -QUI-E1 MWH23': 'SDC-4',
  'SDC-QUI-Juniper': 'SDC-5',
  'SDC-SEA-53': 'SDC-6',
  'SDC-SEA-SDC42': 'SDC-7',
  'SEA-Providence': 'SEA',
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
  
  // Match weekly reports to database projects
  const updates: Array<{
    project: { id: string; code: string; name: string }
    weeklyReport: WeeklyReportData
    projectNumbers: string[]
  }> = []
  
  for (const dbProject of dbProjects) {
    // Find matching weekly report
    const matchingReport = weeklyReports.find(wr => {
      const filenameLower = wr.filename.toLowerCase()
      const codeLower = dbProject.code.toLowerCase()
      
      // Check filename patterns
      for (const [pattern, code] of Object.entries(FILENAME_TO_PROJECT_CODE)) {
        if (code === dbProject.code && filenameLower.includes(pattern.toLowerCase())) {
          return true
        }
      }
      
      // Check if filename contains project code
      if (filenameLower.includes(codeLower)) {
        return true
      }
      
      // Check if filename contains key parts of project name
      const nameParts = dbProject.name.toLowerCase().split(/\s+/).filter(p => p.length > 3)
      for (const part of nameParts) {
        if (filenameLower.includes(part)) {
          return true
        }
      }
      
      return false
    })
    
    if (matchingReport && matchingReport.projectName) {
      // Normalize project numbers
      const normalizedProjectNumbers = matchingReport.projectNumbers
        .map(normalizeProjectNumber)
        .filter(pn => pn && pn !== 'n/a')
      
      updates.push({
        project: dbProject,
        weeklyReport: matchingReport,
        projectNumbers: normalizedProjectNumbers,
      })
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
    
    // Delete existing project numbers
    if (update.project.projectNumbers.length > 0) {
      await prisma.projectProjectNumber.deleteMany({
        where: { projectId: update.project.id },
      })
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


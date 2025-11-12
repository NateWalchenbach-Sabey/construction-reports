/**
 * Import project numbers from weekly report analysis into database
 * This creates ProjectProjectNumber entries for each project
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// Manual mappings based on weekly report analysis
// Format: { projectCode: { projectNumbers: string[], source: string } }
const PROJECT_NUMBER_MAPPINGS: Record<string, { projectNumbers: string[]; source: string; notes?: string }> = {
  'ASH': {
    projectNumbers: [
      '24-3-013-ashasi',
      '24-3-014-ashasc',
      '24-3-052asha-dh1',
      '24-3-053asha-dh2',
      '22-3-302'
    ],
    source: 'weekly_report',
    notes: 'ASH-A Site/Shell & Core/Data Halls 1&2 from weekly reports'
  },
  'ASH-1': {
    projectNumbers: ['22-3-303', '25-5-125'],
    source: 'weekly_report',
    notes: 'ASH-AB1 from weekly reports'
  },
  'AUS': {
    projectNumbers: ['24-4-022-ausa11', '24-8-022'],
    source: 'weekly_report',
    notes: 'AUS-11 Weekly Job Status from weekly reports'
  },
  'AUS-1': {
    projectNumbers: ['24-4-055-ausa12', '24-5-058'],
    source: 'weekly_report',
    notes: 'AUS-12 Weekly Job Status from weekly reports'
  },
  'AUS-2': {
    projectNumbers: ['25-4-085-ausbsi', '25-4-086-asubsc', '25-4-087-ausb35', '25-4-088-ausb36'],
    source: 'weekly_report',
    notes: 'AUS Building B + DH B35-B36 from weekly reports'
  },
  'IGE': {
    projectNumbers: ['23-7-719', '23-8-719'],
    source: 'weekly_report',
    notes: 'IGE SDC 43 6MW from weekly reports'
  },
  'IGQ-1': {
    projectNumbers: ['25-7-131-quie6'],
    source: 'weekly_report',
    notes: 'IGQ-QUI-E16 ZOHO OFFICE EXPANSION from weekly reports'
  },
  'IGQ': {
    projectNumbers: ['24-7-031-quie1dh'],
    source: 'weekly_report',
    notes: 'IGQ-QUI-E1 9MW LLO from weekly reports'
  },
  'JAMES': {
    projectNumbers: ['24-2-034-jamtow', '24-8-034'],
    source: 'weekly_report',
    notes: 'James Tower Elevator Modernization from weekly reports'
  },
  'JEFFERSON': {
    projectNumbers: ['24-2-033-jeffgar', '24-8-033'],
    source: 'weekly_report',
    notes: 'Jefferson Garage Elevator Modernization from weekly reports'
  },
  'SDC': {
    projectNumbers: ['24-7-079-colb12'],
    source: 'weekly_report',
    notes: 'SDC COL B DATA HALL 1&2 TIER 3 CONVERSION from weekly reports'
  },
  'SDC-1': {
    projectNumbers: ['24-7-050-colesi', '24-7-051-colesc', '24-7-023-cole1dh'],
    source: 'weekly_report',
    notes: 'SDC COL E Site/Shell & Core/E2 Data Hall from weekly reports'
  },
  'SDC-2': {
    projectNumbers: ['25-6-105-ny375', '25-8-105'],
    source: 'weekly_report',
    notes: 'SDC Manhattan Cooling Tower 6 Study from weekly reports'
  },
  'SDC-3': {
    projectNumbers: ['25-6-113-ny375', '25-8-113'],
    source: 'weekly_report',
    notes: 'SDC Manhattan NYSERDA Heat Recovery Study from weekly reports'
  },
  'SDC-4': {
    projectNumbers: ['24-5-072', '24-5-073', '24-5-075', '24-5-076', '25-5-092', '25-5-093', '25-5-097', '25-5-099', '25-5-100', '25-5-101', '25-5-102', '25-5-114', '25-5-115', '25-5-119'],
    source: 'weekly_report',
    notes: 'SDC-QUI-E1 MWH23-EX2 Fit Out TI - multiple fit-out projects from weekly reports'
  },
  'SDC-5': {
    projectNumbers: ['25-7-132-quic'],
    source: 'weekly_report',
    notes: 'SDC-QUI-Juniper Office Storage Conversion from weekly reports'
  },
  'SDC-6': {
    projectNumbers: ['24-7-077-sdc53'],
    source: 'weekly_report',
    notes: 'SDC-SEA-53 UPS Replacement from weekly reports'
  },
  'SDC-7': {
    projectNumbers: ['25-7-095-sdc42'],
    source: 'weekly_report',
    notes: 'SDC-SEA-SDC42 Chiller from weekly reports'
  },
  'SEA': {
    projectNumbers: ['24-1-061'],
    source: 'weekly_report',
    notes: 'SEA-Providence Pharmacy HVAC TI from weekly reports'
  },
}

async function importProjectNumbers() {
  try {
    console.log('📊 Importing project numbers from weekly reports...\n')
    
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        projectNumber: true,
      },
      orderBy: { code: 'asc' },
    })
    
    console.log(`Found ${projects.length} projects in database\n`)
    
    let totalAdded = 0
    let totalSkipped = 0
    
    for (const project of projects) {
      const mapping = PROJECT_NUMBER_MAPPINGS[project.code]
      
      if (!mapping) {
        console.log(`⏭️  Skipped: ${project.name} (${project.code}) - no mapping defined`)
        totalSkipped++
        continue
      }
      
      console.log(`\n📋 ${project.name} (${project.code})`)
      console.log(`   Project numbers: ${mapping.projectNumbers.join(', ')}`)
      
      // Delete existing project numbers for this project
      const deleted = await prisma.projectProjectNumber.deleteMany({
        where: { projectId: project.id },
      })
      if (deleted.count > 0) {
        console.log(`   🗑️  Deleted ${deleted.count} existing project number(s)`)
      }
      
      // Add new project numbers
      for (const projectNumber of mapping.projectNumbers) {
        try {
          await prisma.projectProjectNumber.create({
            data: {
              projectId: project.id,
              projectNumber: projectNumber.toLowerCase().trim(),
              source: mapping.source,
              notes: mapping.notes || null,
            },
          })
          console.log(`   ✅ Added: ${projectNumber}`)
          totalAdded++
        } catch (error: any) {
          if (error.code === 'P2002') {
            console.log(`   ⚠️  Already exists: ${projectNumber}`)
          } else {
            console.error(`   ❌ Error adding ${projectNumber}:`, error.message)
          }
        }
      }
      
      // Update primary projectNumber field (use first one for backward compatibility)
      if (mapping.projectNumbers.length > 0) {
        await prisma.project.update({
          where: { id: project.id },
          data: { projectNumber: mapping.projectNumbers[0].toLowerCase().trim() },
        })
        console.log(`   🔄 Updated primary projectNumber: ${mapping.projectNumbers[0]}`)
      }
    }
    
    console.log(`\n✅ Successfully imported project numbers`)
    console.log(`   Added: ${totalAdded} project numbers`)
    console.log(`   Skipped: ${totalSkipped} projects`)
    
    // Summary
    console.log(`\n📊 Summary by project:`)
    const allMappings = await prisma.projectProjectNumber.findMany({
      include: { project: { select: { code: true, name: true } } },
      orderBy: { project: { code: 'asc' } },
    })
    
    const byProject = new Map<string, Array<{ projectNumber: string; source: string }>>()
    for (const mapping of allMappings) {
      const key = `${mapping.project.code} - ${mapping.project.name}`
      if (!byProject.has(key)) {
        byProject.set(key, [])
      }
      byProject.get(key)!.push({
        projectNumber: mapping.projectNumber,
        source: mapping.source || 'unknown',
      })
    }
    
    for (const [projectName, numbers] of Array.from(byProject.entries())) {
      console.log(`\n${projectName}:`)
      numbers.forEach(n => {
        console.log(`  - ${n.projectNumber} (${n.source})`)
      })
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

importProjectNumbers()


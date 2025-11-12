/**
 * Interactive script to map project numbers from cost report to database projects
 * 
 * This script:
 * 1. Lists all database projects
 * 2. Lists all project numbers from cost report
 * 3. Allows manual mapping via a JSON file
 * 
 * Usage:
 *   1. Run: npx tsx scripts/map-project-numbers.ts
 *   2. Edit the generated project-number-mapping.json file
 *   3. Run: npx tsx scripts/map-project-numbers.ts --apply
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

const prisma = new PrismaClient()

interface ProjectMapping {
  projectCode: string
  projectNumber: string
  notes?: string
}

function extractProjectNumbersFromExcel(filePath: string): Array<{ projectNumber: string; projectName: string; jobNumber: string }> {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheetName = 'Cost Rpt Summary'
  const sheet = workbook.Sheets[sheetName]
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in Excel file`)
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
    
    const projectNumber = row[projectNumberCol] 
      ? String(row[projectNumberCol]).trim() 
      : null
    const projectName = row[projectNameCol] ? String(row[projectNameCol]).trim() : ''
    
    if (projectNumber && projectNumber !== 'n/a' && projectNumber !== '' && !seen.has(projectNumber)) {
      projects.push({
        projectNumber,
        projectName,
        jobNumber,
      })
      seen.add(projectNumber)
    }
  }
  
  return projects
}

async function generateMappingFile() {
  try {
    const costReportPath = path.join(process.cwd(), 'Cost Report Summary 10.15.25.xlsx')
    
    if (!fs.existsSync(costReportPath)) {
      console.error('❌ Cost report file not found:', costReportPath)
      process.exit(1)
    }
    
    console.log('📄 Loading cost report and database projects...\n')
    
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
    
    // Create mapping template
    const mapping: ProjectMapping[] = dbProjects.map(dbProject => ({
      projectCode: dbProject.code,
      projectNumber: dbProject.projectNumber || '',
      notes: `Database: ${dbProject.name}`,
    }))
    
    const mappingFile = path.join(process.cwd(), 'project-number-mapping.json')
    fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2))
    
    console.log(`✅ Generated mapping file: ${mappingFile}\n`)
    console.log('📝 Edit this file to map project numbers:')
    console.log('   - Set "projectNumber" field to the project number from Column B of the cost report')
    console.log('   - Leave empty if no mapping needed')
    console.log('\n📋 Available project numbers from cost report:\n')
    
    excelProjects.forEach((p, index) => {
      console.log(`  ${p.projectNumber.padEnd(20)} - ${p.projectName}`)
    })
    
    console.log('\n💡 After editing the mapping file, run:')
    console.log('   npx tsx scripts/map-project-numbers.ts --apply')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

async function applyMapping() {
  try {
    const mappingFile = path.join(process.cwd(), 'project-number-mapping.json')
    
    if (!fs.existsSync(mappingFile)) {
      console.error('❌ Mapping file not found:', mappingFile)
      console.error('Run without --apply flag to generate the mapping file first')
      process.exit(1)
    }
    
    const mapping: ProjectMapping[] = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'))
    
    console.log('📄 Applying project number mappings...\n')
    
    let updated = 0
    let skipped = 0
    
    for (const map of mapping) {
      if (!map.projectNumber || map.projectNumber.trim() === '') {
        skipped++
        continue
      }
      
      const project = await prisma.project.findUnique({
        where: { code: map.projectCode },
      })
      
      if (!project) {
        console.error(`⚠️  Project not found: ${map.projectCode}`)
        continue
      }
      
      if (project.projectNumber === map.projectNumber) {
        console.log(`⏭️  Skipped: ${project.name} (already has project number: ${map.projectNumber})`)
        skipped++
        continue
      }
      
      await prisma.project.update({
        where: { code: map.projectCode },
        data: { projectNumber: map.projectNumber.trim() },
      })
      
      console.log(`✅ Updated: ${project.name} (${project.code}) -> ${map.projectNumber}`)
      updated++
    }
    
    console.log(`\n✅ Successfully updated ${updated} projects`)
    console.log(`⏭️  Skipped ${skipped} projects (no mapping or already set)`)
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

// Main
const applyFlag = process.argv.includes('--apply')

if (applyFlag) {
  applyMapping()
} else {
  generateMappingFile()
}


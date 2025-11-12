/**
 * Import project names and project numbers from weekly report Excel files
 * Reads B5 (project name) and B7 (project numbers) from each file
 * Updates existing projects in the database
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import XLSX from 'xlsx'

const prisma = new PrismaClient()

interface WeeklyReportData {
  fileName: string
  projectName: string
  projectNumbers: string[]
}

// Manual mapping of filename patterns to project codes
// This ensures accurate matching
const FILENAME_TO_PROJECT_CODE: Record<string, string> = {
  'ASH-A': 'ASH',
  'ASH-AB1': 'ASH-1',
  'AUS-11': 'AUS-1',
  'AUS-12': 'AUS',
  'AUS-23': 'AUS-2',
  'AUS Building B': 'AUS-2',
  'IGE SDC 43': 'IGE',
  'IGQ-QUI-E1 9MW': 'IGQ',
  'IGQ-QUI-E16': 'IGQ-1',
  'IGQ-QUI-E6': 'IGQ-1',
  'James Tower': 'JAMES',
  'Jefferson Garage': 'JEFFERSON',
  'SDC-COL-B': 'SDC',
  'SDC-COL-E': 'SDC-1',
  'SDC- Columbia': 'SDC-1',
  'SDC-QUI-E1 MWH23': 'SDC-4',
  'SDC-QUI-Juniper': 'SDC-5',
  'SDC-SEA-53': 'SDC-6',
  'SDC-SEA-SDC42': 'SDC-7',
  'SDC Manhattan Cooling Tower': 'SDC-2',
  'SDC Manhattan LL11': 'SDC-2', // This might need a new project code
  'SDC Manhattan NYSERDA': 'SDC-3',
  'SEA-Providence': 'SEA',
}

/**
 * Extract project name and numbers from Excel file
 */
function extractProjectData(filePath: string): WeeklyReportData | null {
  try {
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Get B5 (project name)
    const projectNameCell = worksheet['B5']
    const projectName = projectNameCell?.v?.toString().trim() || null

    // Get B7 (project numbers)
    const projectNumbersCell = worksheet['B7']
    const projectNumbersStr = projectNumbersCell?.v?.toString().trim() || ''

    if (!projectName) {
      console.warn(`⚠️  No project name found in B5 for ${path.basename(filePath)}`)
      return null
    }

    // Parse project numbers (can be separated by /, comma, &, or space)
    let projectNumbers = projectNumbersStr
      .split(/[\/,\n&]/)
      .map(pn => pn.trim())
      .filter(pn => pn.length > 0)

    // Clean up project numbers - remove extra text like "DEV", "A12", "TI"
    projectNumbers = projectNumbers.map(pn => {
      // Remove common suffixes
      pn = pn.replace(/\s+(DEV|A12|TI|DH)$/i, '').trim()
      // Remove any trailing non-project-number text
      pn = pn.replace(/\s+[A-Z]{2,}.*$/i, '').trim()
      return pn
    }).filter(pn => pn.length > 0 && /^\d{2}-\d-\d{3}/.test(pn)) // Must match pattern XX-X-XXX

    if (projectNumbers.length === 0) {
      console.warn(`⚠️  No valid project numbers found in B7 for ${path.basename(filePath)}`)
      return null
    }

    return {
      fileName: path.basename(filePath),
      projectName,
      projectNumbers,
    }
  } catch (error: any) {
    console.error(`❌ Error reading ${filePath}:`, error.message)
    return null
  }
}

/**
 * Match weekly report to existing project by code
 */
async function findMatchingProject(
  projectName: string,
  fileName: string
): Promise<{ id: string; code: string; name: string } | null> {
  // Try manual mapping first
  for (const [pattern, code] of Object.entries(FILENAME_TO_PROJECT_CODE)) {
    if (fileName.includes(pattern)) {
      const project = await prisma.project.findUnique({
        where: { code },
        select: { id: true, code: true, name: true },
      })
      if (project) {
        return project
      }
    }
  }

  // Try to extract project code from filename
  const fileNameBase = fileName.replace(/\.xlsx$/i, '').trim()
  
  // Try different patterns
  const patterns = [
    /^([A-Z]+-?[A-Z0-9]+)/i,  // ASH-A, ASH-AB1
    /^([A-Z]+)/i,              // ASH, AUS
  ]

  for (const pattern of patterns) {
    const match = fileNameBase.match(pattern)
    if (match) {
      const potentialCode = match[1].toUpperCase()
      
      // Try exact match
      const exactMatch = await prisma.project.findUnique({
        where: { code: potentialCode },
        select: { id: true, code: true, name: true },
      })
      if (exactMatch) {
        return exactMatch
      }

      // Try with dash variations
      const dashVariations = [
        potentialCode.replace(/-/g, ''),
        potentialCode + '-1',
        potentialCode.replace(/(\d+)$/, '-$1'),
      ]

      for (const variant of dashVariations) {
        const variantMatch = await prisma.project.findUnique({
          where: { code: variant },
          select: { id: true, code: true, name: true },
        })
        if (variantMatch) {
          return variantMatch
        }
      }
    }
  }

  // Last resort: try matching by project name similarity
  const allProjects = await prisma.project.findMany({
    select: { id: true, code: true, name: true },
  })

  const projectNameLower = projectName.toLowerCase()
  const nameMatch = allProjects.find(p => {
    const pNameLower = p.name.toLowerCase()
    // More strict matching - require significant overlap
    const words = projectNameLower.split(/\s+/)
    const matchingWords = words.filter(w => 
      w.length > 3 && pNameLower.includes(w)
    )
    return matchingWords.length >= 2
  })

  return nameMatch || null
}

async function main() {
  console.log('📋 Importing projects from weekly reports...\n')

  const weeklyReportsDir = path.join(process.cwd(), 'weekly_reports')

  if (!fs.existsSync(weeklyReportsDir)) {
    console.error(`❌ Directory not found: ${weeklyReportsDir}`)
    process.exit(1)
  }

  // Get all Excel files
  const files = fs.readdirSync(weeklyReportsDir).filter(
    f => f.toLowerCase().endsWith('.xlsx')
  )

  console.log(`Found ${files.length} weekly report files\n`)

  const results: Array<{
    fileName: string
    projectName: string
    projectNumbers: string[]
    matched: boolean
    projectCode?: string
    updated: boolean
  }> = []

  // Process each file
  for (const file of files) {
    const filePath = path.join(weeklyReportsDir, file)
    console.log(`📄 Processing: ${file}`)

    const data = extractProjectData(filePath)
    if (!data) {
      results.push({
        fileName: file,
        projectName: '',
        projectNumbers: [],
        matched: false,
        updated: false,
      })
      continue
    }

    console.log(`   Project Name: ${data.projectName}`)
    console.log(`   Project Numbers: ${data.projectNumbers.join(', ')}`)

    // Find matching project
    const project = await findMatchingProject(data.projectName, file)
    if (!project) {
      console.log(`   ⚠️  No matching project found in database`)
      results.push({
        fileName: file,
        projectName: data.projectName,
        projectNumbers: data.projectNumbers,
        matched: false,
        updated: false,
      })
      continue
    }

    console.log(`   ✅ Matched to: ${project.code} - ${project.name}`)

    // Update project name
    await prisma.project.update({
      where: { id: project.id },
      data: { name: data.projectName },
    })
    console.log(`   ✅ Updated project name`)

    // Remove existing project numbers for this project
    await prisma.projectProjectNumber.deleteMany({
      where: { projectId: project.id },
    })

    // Add new project numbers
    for (const pn of data.projectNumbers) {
      await prisma.projectProjectNumber.create({
        data: {
          projectId: project.id,
          projectNumber: pn.trim(),
          source: 'weekly_report',
          notes: `Imported from ${file}`,
        },
      })
    }
    console.log(`   ✅ Updated ${data.projectNumbers.length} project number(s)`)

    results.push({
      fileName: file,
      projectName: data.projectName,
      projectNumbers: data.projectNumbers,
      matched: true,
      projectCode: project.code,
      updated: true,
    })

    console.log('')
  }

  // Summary
  console.log('\n📊 Summary:')
  console.log(`   Total files: ${files.length}`)
  console.log(`   Successfully processed: ${results.filter(r => r.updated).length}`)
  console.log(`   Failed to match: ${results.filter(r => !r.matched).length}`)

  if (results.filter(r => !r.matched).length > 0) {
    console.log('\n⚠️  Files that could not be matched:')
    results
      .filter(r => !r.matched)
      .forEach(r => {
        console.log(`   - ${r.fileName}`)
      })
  }

  console.log('\n✅ Import complete!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


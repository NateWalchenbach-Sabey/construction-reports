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

    // Parse project numbers (can be separated by /, comma, or space)
    const projectNumbers = projectNumbersStr
      .split(/[\/,\n]/)
      .map(pn => pn.trim())
      .filter(pn => pn.length > 0)

    if (projectNumbers.length === 0) {
      console.warn(`⚠️  No project numbers found in B7 for ${path.basename(filePath)}`)
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
 * Match weekly report to existing project by code or name similarity
 */
async function findMatchingProject(
  projectName: string,
  fileName: string
): Promise<{ id: string; code: string; name: string } | null> {
  // Try to extract project code from filename
  // Examples: "ASH-A 10 - 25 -25  .xlsx" -> "ASH-A"
  //           "ASH-AB1 10-25 -25 .xlsx" -> "ASH-AB1"
  const fileNameBase = fileName.replace(/\.xlsx$/i, '').trim()
  const codeMatch = fileNameBase.match(/^([A-Z]+-?[A-Z0-9]*)/i)
  const potentialCode = codeMatch ? codeMatch[1].toUpperCase() : null

  // Get all projects
  const allProjects = await prisma.project.findMany({
    select: {
      id: true,
      code: true,
      name: true,
    },
  })

  // First, try exact code match
  if (potentialCode) {
    const exactMatch = allProjects.find(
      p => p.code.toUpperCase() === potentialCode.toUpperCase()
    )
    if (exactMatch) {
      return exactMatch
    }

    // Try partial code match (e.g., "ASH-A" matches "ASH")
    const partialMatch = allProjects.find(
      p => p.code.toUpperCase().startsWith(potentialCode.toUpperCase()) ||
           potentialCode.toUpperCase().startsWith(p.code.toUpperCase())
    )
    if (partialMatch) {
      return partialMatch
    }
  }

  // Try matching by project name similarity
  const projectNameLower = projectName.toLowerCase()
  const nameMatch = allProjects.find(p => {
    const pNameLower = p.name.toLowerCase()
    return (
      pNameLower.includes(projectNameLower) ||
      projectNameLower.includes(pNameLower) ||
      projectNameLower.startsWith(p.code.toLowerCase()) ||
      p.code.toLowerCase().startsWith(projectNameLower.split(' ')[0].toLowerCase())
    )
  })

  if (nameMatch) {
    return nameMatch
  }

  // Try matching by code in project name
  if (potentialCode) {
    const codeInNameMatch = allProjects.find(p => {
      const pNameLower = p.name.toLowerCase()
      return pNameLower.includes(potentialCode.toLowerCase())
    })
    if (codeInNameMatch) {
      return codeInNameMatch
    }
  }

  return null
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


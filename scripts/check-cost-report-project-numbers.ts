/**
 * Script to check what project numbers are in uploaded cost reports
 * and help identify which projects need project numbers added
 * 
 * Run with: npx tsx scripts/check-cost-report-project-numbers.ts
 */

import { PrismaClient } from '@prisma/client'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

async function main() {
  console.log('📊 Checking cost report project numbers...\n')

  // Get all projects
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      projectNumber: true,
      projectNumbers: {
        select: {
          projectNumber: true,
        },
      },
    },
  })

  console.log(`Found ${projects.length} projects in database\n`)

  // Check which projects have project numbers
  const projectsWithNumbers = projects.filter(
    p => p.projectNumber || (p.projectNumbers && p.projectNumbers.length > 0)
  )
  const projectsWithoutNumbers = projects.filter(
    p => !p.projectNumber && (!p.projectNumbers || p.projectNumbers.length === 0)
  )

  console.log(`✅ Projects WITH project numbers: ${projectsWithNumbers.length}`)
  for (const project of projectsWithNumbers) {
    const numbers = [
      project.projectNumber,
      ...(project.projectNumbers?.map(pn => pn.projectNumber) || []),
    ].filter(Boolean)
    console.log(`   - ${project.code}: ${project.name}`)
    console.log(`     Project Numbers: ${numbers.join(', ')}`)
  }

  console.log(`\n❌ Projects WITHOUT project numbers: ${projectsWithoutNumbers.length}`)
  for (const project of projectsWithoutNumbers) {
    console.log(`   - ${project.code}: ${project.name}`)
  }

  // Check ProjectFinancials for project numbers
  console.log(`\n📈 Checking ProjectFinancials table...`)
  const financials = await prisma.projectFinancials.findMany({
    select: {
      projectNumber: true,
      project: {
        select: {
          code: true,
          name: true,
        },
      },
    },
    distinct: ['projectNumber'],
  })

  if (financials.length > 0) {
    console.log(`\nFound ${financials.length} unique project numbers in cost reports:`)
    for (const f of financials) {
      if (f.projectNumber) {
        console.log(`   - ${f.projectNumber} → ${f.project?.code || 'No project matched'}`)
      }
    }
  } else {
    console.log(`\n⚠️  No ProjectFinancials entries found.`)
    console.log(`   This means either:`)
    console.log(`   1. No cost reports have been uploaded yet, OR`)
    console.log(`   2. Cost reports were uploaded but couldn't match to projects (missing project numbers)`)
  }

  // Check cost report files
  const costReportDir = path.join(process.cwd(), 'uploads', 'cost-reports')
  try {
    const files = await readdir(costReportDir)
    const excelFiles = files.filter(f => f.match(/\.(xlsx|xls)$/i))
    
    if (excelFiles.length > 0) {
      console.log(`\n📁 Found ${excelFiles.length} cost report file(s):`)
      for (const file of excelFiles) {
        console.log(`   - ${file}`)
        
        // Try to read and extract project numbers
        try {
          const filePath = path.join(costReportDir, file)
          const workbook = XLSX.readFile(filePath)
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
          
          // Look for project number column (usually column B)
          const headers = data[0] || []
          const projectNumberColIndex = headers.findIndex((h: any) => 
            h && String(h).toLowerCase().includes('project number')
          )
          
          if (projectNumberColIndex >= 0) {
            const projectNumbers = new Set<string>()
            for (let i = 1; i < data.length; i++) {
              const row = data[i]
              const pn = row[projectNumberColIndex]
              if (pn && String(pn).trim()) {
                projectNumbers.add(String(pn).trim().toLowerCase())
              }
            }
            
            console.log(`     Project numbers in file: ${Array.from(projectNumbers).join(', ')}`)
          }
        } catch (err: any) {
          console.log(`     Could not read file: ${err.message}`)
        }
      }
    }
  } catch (err: any) {
    console.log(`\n⚠️  Could not read cost-reports directory: ${err.message}`)
  }

  console.log(`\n💡 To fix matching:`)
  console.log(`   1. Add project numbers to projects using the Projects Manager`)
  console.log(`   2. Or use the cost report upload page to see unmatched rows`)
  console.log(`   3. Re-upload cost reports after adding project numbers`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


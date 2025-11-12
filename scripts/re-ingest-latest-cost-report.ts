/**
 * Script to re-ingest the latest uploaded cost report
 * This ensures financial data is properly stored in ProjectFinancials
 * 
 * Run with: npx tsx scripts/re-ingest-latest-cost-report.ts
 */

import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'
import path from 'path'
import { ingestCostReportBuffer } from '../lib/costReportIngest'

const prisma = new PrismaClient()

async function main() {
  console.log('📊 Re-ingesting latest cost report...\n')

  // Get the latest cost report file
  const costReportDir = path.join(process.cwd(), 'uploads', 'cost-reports')
  const files = await import('fs/promises').then(fs => fs.readdir(costReportDir))
  const excelFiles = files
    .filter(f => f.match(/\.(xlsx|xls)$/i))
    .sort()
    .reverse() // Most recent first

  if (excelFiles.length === 0) {
    console.log('❌ No cost report files found in uploads/cost-reports/')
    return
  }

  const latestFile = excelFiles[0]
  const filePath = path.join(costReportDir, latestFile)
  
  console.log(`📁 Found latest cost report: ${latestFile}`)
  console.log(`   Path: ${filePath}\n`)

  // Read the file
  const buffer = await readFile(filePath)
  console.log(`📄 File size: ${(buffer.length / 1024).toFixed(2)} KB\n`)

  // Extract date from filename if possible
  let periodStart: string | undefined
  let sourceDate: Date | undefined
  
  const dateMatch = latestFile.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (dateMatch) {
    const [, month, day, year] = dateMatch
    const fullYear = year.length === 2 ? `20${year}` : year
    sourceDate = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
    if (!isNaN(sourceDate.getTime())) {
      // Calculate Monday of that week (period start)
      const dayOfWeek = sourceDate.getDay()
      const diff = sourceDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(sourceDate)
      monday.setDate(diff)
      monday.setHours(0, 0, 0, 0)
      periodStart = monday.toISOString().split('T')[0]
      console.log(`📅 Extracted date: ${sourceDate.toISOString().split('T')[0]}`)
      console.log(`📅 Period start (Monday): ${periodStart}\n`)
    }
  }

  if (!periodStart) {
    // Use current week's Monday
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const monday = new Date(today)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    periodStart = monday.toISOString().split('T')[0]
    console.log(`📅 Using current week's Monday as period start: ${periodStart}\n`)
  }

  console.log('🔄 Starting ingestion...\n')

  try {
    const result = await ingestCostReportBuffer(buffer, {
      dryRun: false,
      periodStart,
      sourceFileName: latestFile,
      sourceDate,
    })

    console.log('\n✅ Ingestion complete!\n')
    console.log('📊 Summary:')
    console.log(`   - Total rows processed: ${result.summary.totalRows}`)
    console.log(`   - Matched projects: ${result.summary.matchedProjects}`)
    console.log(`   - Matched by project number: ${result.summary.matchedByProjectNumber}`)
    console.log(`   - Unmatched rows: ${result.summary.unmatchedRows}`)
    console.log(`   - Projects updated: ${result.summary.projectsUpdated}`)

    if (result.unmatchedRows.length > 0) {
      console.log(`\n⚠️  Unmatched rows (${result.unmatchedRows.length}):`)
      for (const row of result.unmatchedRows.slice(0, 5)) {
        console.log(`   - ${row.projectNumber || row.jobNumber || 'N/A'}: ${row.projectName || 'N/A'}`)
      }
      if (result.unmatchedRows.length > 5) {
        console.log(`   ... and ${result.unmatchedRows.length - 5} more`)
      }
    }

    // Verify data was stored
    const financialsCount = await prisma.projectFinancials.count()
    console.log(`\n✅ ProjectFinancials entries in database: ${financialsCount}`)

    if (financialsCount > 0) {
      const sample = await prisma.projectFinancials.findFirst({
        include: { project: { select: { name: true, code: true } } },
        orderBy: { periodStart: 'desc' },
      })
      if (sample) {
        console.log(`\n📊 Sample entry:`)
        console.log(`   Project: ${sample.project.code} - ${sample.project.name}`)
        console.log(`   Project Number: ${sample.projectNumber}`)
        console.log(`   Budget: ${sample.budget}`)
        console.log(`   EAC: ${sample.forecast}`)
        console.log(`   Period: ${sample.periodStart.toISOString().split('T')[0]}`)
      }
    }

  } catch (error: any) {
    console.error('\n❌ Ingestion failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


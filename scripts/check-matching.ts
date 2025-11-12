/**
 * Script to check project matching against cost report
 * Run with: npx tsx scripts/check-matching.ts
 */

import { PrismaClient } from '@prisma/client'
import { loadCostReport, findCostDataForProject } from '../lib/cost-report-loader'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function checkMatching() {
  try {
    console.log('🔍 Checking project matching against cost report...\n')

    // Load all projects from database
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        jobNumber: true,
        region: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    console.log(`📊 Found ${projects.length} projects in database\n`)

    // Find cost report file
    const costReportFile = 'Cost Report Summary 10.15.25.xlsx'
    const costReportPath = path.resolve(process.cwd(), costReportFile)

    if (!fs.existsSync(costReportPath)) {
      console.error(`❌ Cost report file not found: ${costReportPath}`)
      process.exit(1)
    }

    console.log(`📄 Loading cost report: ${costReportFile}\n`)
    const costData = await loadCostReport(costReportPath)
    console.log(`📋 Found ${costData.entries.length} entries in cost report\n`)

    // Match each project
    const matches: Array<{
      project: { code: string; name: string; jobNumber: string | null; id: string }
      match: { jobNumber: string; projectNumber: string | null; projectName: string } | null
      matchType: string | null
    }> = []

    // Track which Excel rows are matched by which projects (to detect duplicates)
    const excelRowMatches = new Map<string, Array<{ projectCode: string; projectName: string }>>()

    for (const project of projects) {
      const match = findCostDataForProject(
        costData,
        project.jobNumber || null,
        project.name,
        project.code,
        null
      )

      let matchType: string | null = null
      if (match) {
        // Determine match type
        if (project.jobNumber && match.jobNumber && 
            project.jobNumber.toLowerCase() === match.jobNumber.toLowerCase()) {
          matchType = 'job'
        } else if (project.code && (
          match.jobNumber?.toLowerCase().includes(project.code.toLowerCase().replace(/-/g, '')) ||
          match.projectNumber?.toLowerCase().includes(project.code.toLowerCase().replace(/-/g, '')) ||
          match.projectName?.toLowerCase().includes(project.code.toLowerCase().replace(/-/g, ''))
        )) {
          matchType = 'project_code'
        } else {
          matchType = 'name'
        }

        // Track Excel row matches
        const excelKey = `${match.jobNumber}|${match.projectNumber || ''}|${match.projectName}`
        if (!excelRowMatches.has(excelKey)) {
          excelRowMatches.set(excelKey, [])
        }
        excelRowMatches.get(excelKey)!.push({
          projectCode: project.code,
          projectName: project.name,
        })
      }

      matches.push({
        project: { ...project, id: project.id },
        match,
        matchType,
      })
    }

    // Print results
    console.log('='.repeat(80))
    console.log('MATCHING RESULTS')
    console.log('='.repeat(80))
    console.log()

    const matched = matches.filter(m => m.match !== null)
    const unmatched = matches.filter(m => m.match === null)

    console.log(`✅ Matched: ${matched.length} projects`)
    console.log(`❌ Unmatched: ${unmatched.length} projects`)
    console.log()

    // Show matched projects
    console.log('='.repeat(80))
    console.log('MATCHED PROJECTS')
    console.log('='.repeat(80))
    console.log()

    // Group by Excel row to show duplicates
    const excelRowGroups = new Map<string, Array<{ project: any; match: any; matchType: string }>>()
    for (const { project, match, matchType } of matched) {
      if (match) {
        const excelKey = `${match.jobNumber}|${match.projectNumber || ''}|${match.projectName}`
        if (!excelRowGroups.has(excelKey)) {
          excelRowGroups.set(excelKey, [])
        }
        excelRowGroups.get(excelKey)!.push({ project, match, matchType })
      }
    }

    // Show unique Excel rows and which projects match to them
    for (const [excelKey, projectMatches] of excelRowGroups.entries()) {
      const [jobNumber, projectNumber, projectName] = excelKey.split('|')
      const isDuplicate = projectMatches.length > 1
      
      if (isDuplicate) {
        console.log(`⚠️  WARNING: Multiple projects match to the same Excel row:`)
      } else {
        console.log(`✅ Single match:`)
      }
      console.log(`   Excel Job Number: ${jobNumber}`)
      console.log(`   Excel Project Number: ${projectNumber || 'N/A'}`)
      console.log(`   Excel Project Name: ${projectName}`)
      console.log(`   Matched Projects (${projectMatches.length}):`)
      
      for (const { project, matchType } of projectMatches) {
        console.log(`      - ${project.name} (${project.code}) [${matchType}]`)
        console.log(`        DB Job Number: ${project.jobNumber || 'Not set'}`)
      }
      console.log()
    }

    // Show unmatched projects
    console.log('='.repeat(80))
    console.log('UNMATCHED PROJECTS')
    console.log('='.repeat(80))
    console.log()

    for (const { project } of unmatched) {
      console.log(`❌ ${project.name} (${project.code})`)
      console.log(`   DB Job Number: ${project.jobNumber || 'Not set'}`)
      console.log(`   Region: ${project.region}`)
      console.log()
    }

    // Show sample Excel entries for reference
    console.log('='.repeat(80))
    console.log('SAMPLE EXCEL ENTRIES (for reference)')
    console.log('='.repeat(80))
    console.log()

    for (const entry of costData.entries.slice(0, 10)) {
      console.log(`  Job: ${entry.jobNumber}, ProjNum: ${entry.projectNumber || 'N/A'}, Name: ${entry.projectName}`)
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

checkMatching()


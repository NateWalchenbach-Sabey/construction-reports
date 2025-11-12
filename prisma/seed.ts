import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import path from 'path'
import { loadExcelData } from '../lib/excel-loader'
import { generateProjectCode, mapRegionToEnum } from '../lib/excel-types'
import { cleanProjectName } from '../lib/clean-project-name'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with real Excel data...')

  // Load Excel data
  const excelPath = path.join(process.cwd(), 'aggregated_reports.xlsx')
  console.log(`Loading Excel file from: ${excelPath}`)
  
  const { reports, activities } = await loadExcelData(excelPath)
  
  console.log(`\nLoaded from Excel:`)
  console.log(`  - ${reports.length} reports`)
  console.log(`  - ${activities.length} subcontractor activities`)

  // Create users (needed for report authors)
  const adminPassword = await bcrypt.hash('admin123', 10)
  const superPassword = await bcrypt.hash('super123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  })

  const super1 = await prisma.user.upsert({
    where: { email: 'super1@example.com' },
    update: {},
    create: {
      email: 'super1@example.com',
      name: 'John Superintendent',
      passwordHash: superPassword,
      role: 'SUPERINTENDENT',
    },
  })

  console.log('\n✅ Users created')

  // Group reports by project_title to create Projects
  const projectMap = new Map<string, typeof reports>()
  for (const report of reports) {
    const key = report.project_title.trim()
    if (!projectMap.has(key)) {
      projectMap.set(key, [])
    }
    projectMap.get(key)!.push(report)
  }

  console.log(`\nFound ${projectMap.size} unique projects`)

  // Create Projects from unique project titles
  const createdProjects = new Map<string, { id: string; code: string; title: string }>()
  const codeCounts = new Map<string, number>()

  for (const [title, projectReports] of projectMap.entries()) {
    // Use first report for project-level data
    const firstReport = projectReports[0]
    
    // Clean project name to remove dates
    const cleanedName = cleanProjectName(title)
    
    // Generate unique project code from cleaned name
    let code = generateProjectCode(cleanedName)
    const baseCode = code
    let counter = codeCounts.get(baseCode) || 0
    if (counter > 0) {
      code = `${baseCode}-${counter}`
    }
    codeCounts.set(baseCode, counter + 1)

    // Get region from first report
    const region = mapRegionToEnum(firstReport.region || 'NON_SDC') as any

    // Get project-level dates from first report
    const startDate = firstReport.start_date || projectReports
      .map(r => r.start_date)
      .filter(Boolean)[0] || new Date()
    
    const scheduledCompletion = firstReport.scheduled_completion || projectReports
      .map(r => r.scheduled_completion)
      .filter(Boolean)[0] || null

    // Set financial fields to 0 - cost reports are the source of truth
    // Financial data will come from ProjectFinancials table (ingested from cost report summaries)
    const projectBudget = 0
    const eac = 0
    const budgetVariance = null

    // Calculate percent complete (average) - this can stay as it's not financial data
    const percents = projectReports
      .map(r => r.percent_complete)
      .filter((p): p is number => p !== null && p !== undefined)
    const percentComplete = percents.length > 0
      ? percents.reduce((sum, p) => sum + p, 0) / percents.length
      : 0

    // Create or update project
    const project = await prisma.project.upsert({
      where: { code },
      update: {
        name: cleanedName,
        region,
        tenant: firstReport.tenant || null,
        startDate,
        scheduledCompletion,
        projectBudget,
        eac,
        budgetVariance,
        percentComplete,
      },
      create: {
        code,
        name: cleanedName,
        region,
        tenant: firstReport.tenant || null,
        startDate,
        scheduledCompletion,
        projectBudget,
        eac,
        budgetVariance,
        percentComplete,
        tags: [],
      },
    })

    createdProjects.set(title, { id: project.id, code: project.code, title })
    console.log(`  ✅ Project: ${project.code} - ${project.name}`)
  }

  console.log(`\n✅ Created ${createdProjects.size} projects`)

  // Create Crafts (from unique craft names in activities)
  const craftNames = new Set<string>()
  for (const activity of activities) {
    if (activity.craft && activity.craft.trim()) {
      craftNames.add(activity.craft.trim())
    }
  }

  const createdCrafts = new Map<string, string>()
  for (const craftName of craftNames) {
    const craft = await prisma.craft.upsert({
      where: { name: craftName },
      update: {},
      create: { name: craftName },
    })
    createdCrafts.set(craftName, craft.id)
  }

  console.log(`\n✅ Created ${createdCrafts.size} crafts`)

  // Create SubcontractorCompanies (from unique company names)
  const companyNames = new Set<string>()
  for (const activity of activities) {
    if (activity.company && activity.company.trim()) {
      companyNames.add(activity.company.trim())
    }
  }

  const createdSubcontractors = new Map<string, string>()
  for (const companyName of companyNames) {
    const subcontractor = await prisma.subcontractorCompany.upsert({
      where: { name: companyName },
      update: {},
      create: { name: companyName },
    })
    createdSubcontractors.set(companyName, subcontractor.id)
  }

  console.log(`\n✅ Created ${createdSubcontractors.size} subcontractors`)

  // Create Reports and link activities
  const createdReports = new Map<string, string>() // key: `${projectTitle}_${weekEnding.toISOString()}`
  
  console.log(`\nCreating ${reports.length} reports...`)
  
  for (const reportData of reports) {
    const project = createdProjects.get(reportData.project_title.trim())
    if (!project) {
      console.warn(`  ⚠️  Skipping report - project not found: ${reportData.project_title}`)
      continue
    }

    // All reports are weekly
    const reportType = 'WEEKLY'

    // Create report
    const report = await prisma.report.create({
      data: {
        projectId: project.id,
        reportDate: reportData.week_ending,
        reportType,
        workPerformed: reportData.work_performed || null,
        safety: reportData.safety || null,
        safetyType: reportData.safety?.toLowerCase().includes('none') 
          ? 'NONE_TO_REPORT'
          : reportData.safety?.toLowerCase().includes('tool box') || reportData.safety?.toLowerCase().includes('ppe')
          ? 'TOOL_BOX_TALK_PPE'
          : reportData.safety?.toLowerCase().includes('incident')
          ? 'INCIDENT'
          : reportData.safety?.toLowerCase().includes('near miss')
          ? 'NEAR_MISS'
          : reportData.safety?.toLowerCase().includes('audit')
          ? 'AUDIT'
          : null,
        totalTradeWorkers: reportData.total_trade_workers || null,
        authorId: super1.id,
      },
    })

    const reportKey = `${reportData.project_title.trim()}_${reportData.week_ending.toISOString()}`
    createdReports.set(reportKey, report.id)

    // Find activities for this report (matching project_title and week_ending)
    const reportActivities = activities.filter(
      (a) =>
        a.project_title.trim() === reportData.project_title.trim() &&
        a.week_ending.toISOString() === reportData.week_ending.toISOString()
    )

    // Create ReportSubcontractorActivity records
    for (const activityData of reportActivities) {
      if (!activityData.company || !activityData.craft) {
        continue
      }

      const subcontractorId = createdSubcontractors.get(activityData.company.trim())
      const craftId = createdCrafts.get(activityData.craft.trim())

      if (!subcontractorId || !craftId) {
        console.warn(
          `  ⚠️  Skipping activity - missing subcontractor or craft: ${activityData.company} / ${activityData.craft}`
        )
        continue
      }

      await prisma.reportSubcontractorActivity.create({
        data: {
          reportId: report.id,
          subcontractorId,
          craftId,
          tradeWorkers: activityData.trade_workers || null,
          notes: null,
        },
      })
    }

    console.log(`  ✅ Report: ${report.reportDate.toISOString().split('T')[0]} (${reportType}) - ${reportActivities.length} activities`)
  }

  console.log(`\n✅ Created ${createdReports.size} reports with activities`)

  // Assign first project to super1
  const firstProject = Array.from(createdProjects.values())[0]
  if (firstProject) {
    await prisma.projectAssignment.upsert({
      where: {
        userId_projectId: {
          userId: super1.id,
          projectId: firstProject.id,
        },
      },
      update: {},
      create: {
        userId: super1.id,
        projectId: firstProject.id,
      },
    })
    console.log(`\n✅ Assigned project ${firstProject.code} to superintendent`)
  }

  console.log('\n🎉 Seed completed successfully!')
  console.log('\n📊 Summary:')
  console.log(`  - Projects: ${createdProjects.size}`)
  console.log(`  - Reports: ${createdReports.size}`)
  console.log(`  - Crafts: ${createdCrafts.size}`)
  console.log(`  - Subcontractors: ${createdSubcontractors.size}`)
  
  console.log('\n📋 Step 4: Importing project numbers from weekly reports...')
  try {
    // Import project numbers using the import script
    const { execSync } = require('child_process')
    const path = require('path')
    const scriptPath = path.join(__dirname, '..', 'scripts', 'import-project-numbers-from-weekly-reports.ts')
    execSync(`npx tsx "${scriptPath}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
    console.log('\n✅ Project numbers imported successfully!')
  } catch (error: any) {
    console.warn('\n⚠️  Could not import project numbers automatically:', error.message)
    console.log('   You can run this manually: npx tsx scripts/import-project-numbers-from-weekly-reports.ts')
  }
  
  console.log('\n🔐 Login Credentials:')
  console.log('  - admin@example.com / admin123')
  console.log('  - super1@example.com / super123')
  console.log('\n💡 Next Steps:')
  console.log('  1. Upload cost report summaries to populate financial data')
  console.log('  2. Financial data will automatically match by project numbers')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

/**
 * Tests for cost report ingestion service
 * 
 * Run with: npx tsx lib/__tests__/costReportIngest.test.ts
 * Or with Jest/Vitest if configured
 */

import * as XLSX from 'xlsx'
import { ingestCostReportBuffer, IngestOptions } from '../costReportIngest'
import { prisma } from '../prisma'

/**
 * Create a test Excel file in memory
 */
function createTestExcel(rows: Array<{
  jobNumber?: string
  projectNumber?: string
  projectName?: string
  budget?: number
  eac?: number
  variance?: number
}>): Buffer {
  const workbook = XLSX.utils.book_new()
  
  // Create headers
  const headers = [
    'Job Number',
    'Project Number',
    'Project Name',
    'Hard Cost Budget',
    'Soft Cost Budget',
    'Total Budget',
    'Committed Costs',
    'Actual Costs Invoiced',
    'Cost To Complete',
    'Forecasted Cost @ Completion',
    'Variance (Over)/Under',
  ]
  
  // Create data rows
  const data = [headers]
  for (const row of rows) {
    data.push([
      row.jobNumber || '',
      row.projectNumber || '',
      row.projectName || '',
      '',
      '',
      row.budget || '',
      '',
      '',
      '',
      row.eac || '',
      row.variance || '',
    ])
  }
  
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Rpt Summary')
  
  // Convert to buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return buffer
}

/**
 * Test helper: Create a test project
 */
async function createTestProject(data: {
  code: string
  name: string
  jobNumber?: string | null
  region?: string
}) {
  return await prisma.project.create({
    data: {
      code: data.code,
      name: data.name,
      jobNumber: data.jobNumber || null,
      region: data.region || 'QUINCY',
      startDate: new Date('2025-01-01'),
      projectBudget: 100000,
      eac: 100000,
    },
  })
}

/**
 * Test helper: Clean up test data
 */
async function cleanupTestData(projectIds: string[]) {
  await prisma.projectFinancials.deleteMany({
    where: { projectId: { in: projectIds } },
  })
  await prisma.project.deleteMany({
    where: { id: { in: projectIds } },
  })
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Starting cost report ingestion tests...\n')
  
  const testProjectIds: string[] = []
  
  try {
    // Test 1: Create test projects
    console.log('Test 1: Creating test projects...')
    const project1 = await createTestProject({
      code: 'QUI-E6',
      name: 'SDC-QUI-E6 Zoho Office Exp LLO',
      jobNumber: '25-8-131-quie6',
    })
    testProjectIds.push(project1.id)
    
    const project2 = await createTestProject({
      code: 'QUI-E1',
      name: 'SDC-QUI-E1 Site LLO',
      jobNumber: '24-8-029-quie1si',
    })
    testProjectIds.push(project2.id)
    
    const project3 = await createTestProject({
      code: 'TEST-PROJ',
      name: 'Test Project Without Job Number',
    })
    testProjectIds.push(project3.id)
    
    console.log('✅ Test projects created\n')
    
    // Test 2: Create test Excel file
    console.log('Test 2: Creating test Excel file...')
    const excelBuffer = createTestExcel([
      {
        jobNumber: '25-8-131-quie6',
        projectNumber: '25-7-131-quie6',
        projectName: 'SDC-QUI-E6 Zoho Office Exp LLO',
        budget: 86738,
        eac: 86738,
        variance: 0,
      },
      {
        jobNumber: '24-8-029-quie1si',
        projectNumber: '24-7-029-quie1si',
        projectName: 'SDC-QUI-E1 Site LLO',
        budget: 508812,
        eac: 511192.7,
        variance: -2380.7,
      },
      {
        jobNumber: 'UNKNOWN-JOB',
        projectNumber: 'UNKNOWN-PROJ',
        projectName: 'Unknown Project',
        budget: 100000,
        eac: 110000,
        variance: -10000,
      },
    ])
    console.log('✅ Test Excel file created\n')
    
    // Test 3: Dry run ingestion
    console.log('Test 3: Running dry run ingestion...')
    const dryRunOptions: IngestOptions = {
      dryRun: true,
      periodStart: '2025-10-15',
      sourceFileName: 'test-cost-report.xlsx',
    }
    
    const dryRunResult = await ingestCostReportBuffer(excelBuffer, dryRunOptions)
    
    console.log('Dry run results:')
    console.log(`  - Matched by job: ${dryRunResult.summary.matchedByJob}`)
    console.log(`  - Matched by name: ${dryRunResult.summary.matchedByName}`)
    console.log(`  - Unmatched: ${dryRunResult.summary.unmatched}`)
    console.log(`  - Total rows: ${dryRunResult.summary.totalRows}`)
    console.log(`  - Financial columns: ${dryRunResult.summary.financialColumns.join(', ')}`)
    
    if (dryRunResult.summary.matchedByJob !== 2) {
      throw new Error(`Expected 2 matches by job, got ${dryRunResult.summary.matchedByJob}`)
    }
    
    if (dryRunResult.summary.unmatched !== 1) {
      throw new Error(`Expected 1 unmatched, got ${dryRunResult.summary.unmatched}`)
    }
    
    console.log('✅ Dry run test passed\n')
    
    // Test 4: Actual ingestion (not dry run)
    console.log('Test 4: Running actual ingestion...')
    const ingestOptions: IngestOptions = {
      dryRun: false,
      periodStart: '2025-10-15',
      sourceFileName: 'test-cost-report.xlsx',
      sourceDate: new Date('2025-10-15'),
    }
    
    const ingestResult = await ingestCostReportBuffer(excelBuffer, ingestOptions)
    
    console.log('Ingestion results:')
    console.log(`  - Projects updated: ${ingestResult.summary.projectsUpdated}`)
    console.log(`  - Matched rows: ${ingestResult.rows.length}`)
    
    if (ingestResult.summary.projectsUpdated !== 2) {
      throw new Error(`Expected 2 projects updated, got ${ingestResult.summary.projectsUpdated}`)
    }
    
    console.log('✅ Ingestion test passed\n')
    
    // Test 5: Verify database records
    console.log('Test 5: Verifying database records...')
    const financials1 = await prisma.projectFinancials.findUnique({
      where: {
        projectId_periodStart: {
          projectId: project1.id,
          periodStart: new Date('2025-10-15'),
        },
      },
    })
    
    if (!financials1) {
      throw new Error('Financials not found for project 1')
    }
    
    if (financials1.budget?.toNumber() !== 86738) {
      throw new Error(`Expected budget 86738, got ${financials1.budget?.toNumber()}`)
    }
    
    if (financials1.forecast?.toNumber() !== 86738) {
      throw new Error(`Expected forecast 86738, got ${financials1.forecast?.toNumber()}`)
    }
    
    if (financials1.jobNumber !== '25-8-131-quie6') {
      throw new Error(`Expected job number '25-8-131-quie6', got '${financials1.jobNumber}'`)
    }
    
    console.log('✅ Database verification passed\n')
    
    // Test 6: Test name matching (project without job number)
    console.log('Test 6: Testing name matching...')
    const excelBuffer2 = createTestExcel([
      {
        jobNumber: '',
        projectNumber: '',
        projectName: 'Test Project Without Job Number',
        budget: 50000,
        eac: 55000,
        variance: -5000,
      },
    ])
    
    const nameMatchResult = await ingestCostReportBuffer(excelBuffer2, {
      dryRun: true,
      periodStart: '2025-10-15',
    })
    
    if (nameMatchResult.summary.matchedByName !== 1) {
      throw new Error(`Expected 1 match by name, got ${nameMatchResult.summary.matchedByName}`)
    }
    
    console.log('✅ Name matching test passed\n')
    
    console.log('🎉 All tests passed!')
  } catch (error: any) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...')
    await cleanupTestData(testProjectIds)
    console.log('✅ Cleanup complete')
    await prisma.$disconnect()
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error)
}

export { runTests }


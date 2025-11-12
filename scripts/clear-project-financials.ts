/**
 * Script to clear financial data from Project table
 * This ensures cost reports (ProjectFinancials) are the only source of truth
 * 
 * Run with: npx tsx scripts/clear-project-financials.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Clearing financial data from Project table...')
  console.log('This will set projectBudget, eac, and budgetVariance to 0/null')
  console.log('Cost reports (ProjectFinancials) will remain as the source of truth\n')

  const result = await prisma.project.updateMany({
    data: {
      projectBudget: 0,
      eac: 0,
      budgetVariance: null,
    },
  })

  console.log(`✅ Updated ${result.count} projects`)
  console.log('\n📊 Financial data is now cleared from Project table')
  console.log('💡 All financial data should come from cost report summaries (ProjectFinancials table)')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


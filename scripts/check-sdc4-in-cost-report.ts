/**
 * Check if SDC-4 project numbers are in the cost report
 */

import XLSX from 'xlsx'
import * as path from 'path'

const costReportPath = path.join(process.cwd(), 'uploads/cost-reports/Cost_Report_Summary_1762883774662.xlsx')
const workbook = XLSX.readFile(costReportPath)
const worksheet = workbook.Sheets['Cost Rpt Summary']
const range = XLSX.utils.decode_range(worksheet['!ref']!)

const sdc4ProjectNumbers = [
  '24-5-072', '24-5-073', '24-5-075', '24-5-076',
  '25-5-092', '25-5-093', '25-5-097', '25-5-099',
  '25-5-100', '25-5-101', '25-5-102', '25-5-114',
  '25-5-115', '25-5-119'
]

console.log('Searching for SDC-4 project numbers in cost report...\n')

const found: Array<{
  row: number
  jobNumber: string | null
  projectNumber: string | null
  projectName: string | null
  budget: number | null
  forecast: number | null
}> = []

for (let R = 5; R <= range.e.r; R++) {
  const cellB = worksheet[XLSX.utils.encode_cell({ r: R, c: 1 })]
  if (!cellB || !cellB.v) continue

  const projectNumber = String(cellB.v).trim()
  const projectNumberLower = projectNumber.toLowerCase()

  // Check if this row contains any SDC-4 project number
  for (const pn of sdc4ProjectNumbers) {
    if (projectNumberLower.includes(pn.toLowerCase()) || projectNumberLower.startsWith(pn.toLowerCase())) {
      const cellA = worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })]
      const cellC = worksheet[XLSX.utils.encode_cell({ r: R, c: 2 })]
      const cellG = worksheet[XLSX.utils.encode_cell({ r: R, c: 7 })] // Total Budget
      const cellL = worksheet[XLSX.utils.encode_cell({ r: R, c: 11 })] // Forecast

      found.push({
        row: R,
        jobNumber: cellA?.v ? String(cellA.v) : null,
        projectNumber,
        projectName: cellC?.v ? String(cellC.v) : null,
        budget: cellG?.v ? Number(cellG.v) : null,
        forecast: cellL?.v ? Number(cellL.v) : null,
      })
      break
    }
  }
}

console.log(`Found ${found.length} rows with SDC-4 project numbers:\n`)
found.forEach(f => {
  console.log(`Row ${f.row}:`)
  console.log(`  Job Number: ${f.jobNumber}`)
  console.log(`  Project Number: ${f.projectNumber}`)
  console.log(`  Project Name: ${f.projectName}`)
  console.log(`  Budget: ${f.budget}`)
  console.log(`  Forecast: ${f.forecast}`)
  console.log('')
})

if (found.length === 0) {
  console.log('❌ No SDC-4 project numbers found in cost report!')
} else {
  const totalBudget = found.reduce((sum, f) => sum + (f.budget || 0), 0)
  const totalForecast = found.reduce((sum, f) => sum + (f.forecast || 0), 0)
  console.log(`\n📊 Totals:`)
  console.log(`  Budget: ${totalBudget}`)
  console.log(`  Forecast: ${totalForecast}`)
}


import * as XLSX from 'xlsx'
import {
  ExcelReportSchema,
  ExcelSubcontractorActivitySchema,
  type ExcelReport,
  type ExcelSubcontractorActivity,
} from './excel-types'

export interface ExcelData {
  reports: ExcelReport[]
  activities: ExcelSubcontractorActivity[]
}

/**
 * Load and parse the aggregated_reports.xlsx file
 */
export async function loadExcelData(filePath: string): Promise<ExcelData> {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  
  // Get sheet names
  const sheetNames = workbook.SheetNames
  console.log(`Found sheets: ${sheetNames.join(', ')}`)
  
  // Load Reports sheet
  const reportsSheet = workbook.Sheets['Reports']
  if (!reportsSheet) {
    throw new Error('Reports sheet not found in Excel file')
  }
  
  const reportsRaw = XLSX.utils.sheet_to_json(reportsSheet, {
    defval: null,
    raw: false, // Keep raw values for date conversion
  })
  
  console.log(`Loaded ${reportsRaw.length} raw report rows`)
  
  // Validate and transform Reports
  const reports: ExcelReport[] = []
  for (let i = 0; i < reportsRaw.length; i++) {
    try {
      const validated = ExcelReportSchema.parse(reportsRaw[i])
      reports.push(validated)
    } catch (error) {
      console.warn(`Error parsing report row ${i + 1}:`, error)
      if (error instanceof Error) {
        console.warn(`  Row data:`, JSON.stringify(reportsRaw[i], null, 2))
      }
    }
  }
  
  console.log(`Successfully parsed ${reports.length} reports`)
  
  // Load SubcontractorActivity sheet
  const activitiesSheet = workbook.Sheets['SubcontractorActivity']
  if (!activitiesSheet) {
    throw new Error('SubcontractorActivity sheet not found in Excel file')
  }
  
  const activitiesRaw = XLSX.utils.sheet_to_json(activitiesSheet, {
    defval: null,
    raw: false,
  })
  
  console.log(`Loaded ${activitiesRaw.length} raw activity rows`)
  
  // Validate and transform Activities
  const activities: ExcelSubcontractorActivity[] = []
  for (let i = 0; i < activitiesRaw.length; i++) {
    try {
      const validated = ExcelSubcontractorActivitySchema.parse(activitiesRaw[i])
      activities.push(validated)
    } catch (error) {
      console.warn(`Error parsing activity row ${i + 1}:`, error)
      if (error instanceof Error) {
        console.warn(`  Row data:`, JSON.stringify(activitiesRaw[i], null, 2))
      }
    }
  }
  
  console.log(`Successfully parsed ${activities.length} activities`)
  
  return { reports, activities }
}

/**
 * Get sample data for testing
 */
export function getSampleData(): ExcelData {
  return {
    reports: [],
    activities: [],
  }
}


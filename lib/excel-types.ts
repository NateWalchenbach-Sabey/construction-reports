import { z } from 'zod'

// Excel date serial number to Date helper
export function excelDateToJSDate(serial: number): Date {
  // Excel epoch is January 1, 1900, but Excel incorrectly treats 1900 as a leap year
  // So we add 1 day to compensate
  const excelEpoch = new Date(1899, 11, 30) // December 30, 1899
  const jsDate = new Date(excelEpoch.getTime() + serial * 86400000)
  return jsDate
}

// Zod schemas for Excel data validation
export const ExcelReportSchema = z.object({
  week_ending: z.number().or(z.string()).transform((val) => {
    if (typeof val === 'number') return excelDateToJSDate(val)
    // Try parsing string dates
    const parsed = new Date(val)
    if (!isNaN(parsed.getTime())) return parsed
    throw new Error(`Invalid date: ${val}`)
  }),
  project_title: z.string().trim(),
  region: z.string().trim().nullable().optional(),
  tenant: z.string().trim().nullable().optional(),
  start_date: z.number().or(z.string()).nullable().optional().transform((val) => {
    if (!val) return null
    if (typeof val === 'number') return excelDateToJSDate(val)
    const parsed = new Date(val)
    if (!isNaN(parsed.getTime())) return parsed
    return null
  }),
  scheduled_completion: z.number().or(z.string()).nullable().optional().transform((val) => {
    if (!val) return null
    if (typeof val === 'number') return excelDateToJSDate(val)
    const parsed = new Date(val)
    if (!isNaN(parsed.getTime())) return parsed
    return null
  }),
  project_budget: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null
    const num = typeof val === 'string' ? parseFloat(val.replace(/[,$]/g, '')) : val
    return isNaN(num) ? null : num
  }),
  eac: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null
    const num = typeof val === 'string' ? parseFloat(val.replace(/[,$]/g, '')) : val
    return isNaN(num) ? null : num
  }),
  budget_variance: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null
    const num = typeof val === 'string' ? parseFloat(val.replace(/[,$]/g, '')) : val
    return isNaN(num) ? null : num
  }),
  percent_complete: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null
    const num = typeof val === 'string' ? parseFloat(val.replace(/[%]/g, '')) : val
    return isNaN(num) ? null : num
  }),
  total_trade_workers: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? null : Math.floor(num)
  }),
  work_performed: z.string().trim().nullable().optional(),
  safety: z.string().trim().nullable().optional(),
  source: z.string().trim().nullable().optional(),
})

export const ExcelSubcontractorActivitySchema = z.object({
  week_ending: z.number().or(z.string()).transform((val) => {
    if (typeof val === 'number') return excelDateToJSDate(val)
    const parsed = new Date(val)
    if (!isNaN(parsed.getTime())) return parsed
    throw new Error(`Invalid date: ${val}`)
  }),
  project_title: z.string().trim(),
  region: z.string().trim().nullable().optional(),
  company: z.string().trim().nullable().optional(),
  craft: z.string().trim().nullable().optional(),
  trade_workers: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? null : Math.floor(num)
  }),
  source: z.string().trim().nullable().optional(),
})

// TypeScript types
export type ExcelReport = z.infer<typeof ExcelReportSchema>
export type ExcelSubcontractorActivity = z.infer<typeof ExcelSubcontractorActivitySchema>

// Helper to generate project code from title
export function generateProjectCode(title: string): string {
  // Try to extract code patterns like "ASH A 11 01 25" or "IGQ-QUI-E1"
  // If no pattern found, create a code from title
  const codePattern = /([A-Z]{2,4}[-_]?[A-Z]{0,3}[-_]?[A-Z0-9]{0,4})/i
  const match = title.match(codePattern)
  if (match) {
    return match[1].toUpperCase().replace(/[-_]/g, '-')
  }
  
  // Generate from title: take first letters of words, uppercase, max 12 chars
  const words = title.split(/\s+/).filter(w => w.length > 0)
  const code = words
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 12)
  
  // Add a number if we have duplicates (will be handled in seed script)
  return code || 'PROJ-' + Math.random().toString(36).substr(2, 6).toUpperCase()
}

// Helper to map region string to Region enum
export function mapRegionToEnum(region: string | null | undefined): string {
  if (!region) return 'NON_SDC'
  
  const normalized = region.trim().toUpperCase()
  const regionMap: Record<string, string> = {
    'ASHBURN': 'ASHBURN',
    'SDC ASHBURN': 'ASHBURN',
    'SEATTLE': 'SEATTLE',
    'SDC SEATTLE': 'SEATTLE',
    'AUSTIN': 'AUSTIN',
    'SDC AUSTIN': 'AUSTIN',
    'COLUMBIA': 'COLUMBIA',
    'SDC COLUMBIA': 'COLUMBIA',
    'QUINCY': 'QUINCY',
    'SDC QUINCY': 'QUINCY',
    'MANHATTAN': 'MANHATTAN',
    'SDC MANHATTAN': 'MANHATTAN',
    'UMATILLA': 'UMATILLA',
    'SDC UMATILLA': 'UMATILLA',
    'BUTTE': 'BUTTE',
    'SDC BUTTE': 'BUTTE',
    'NON SDC': 'NON_SDC',
    'NON SDC PROJECTS': 'NON_SDC',
    'NON_SDC': 'NON_SDC',
  }
  
  return regionMap[normalized] || 'NON_SDC'
}


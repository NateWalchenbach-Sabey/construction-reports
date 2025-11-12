import fs from 'fs'
import path from 'path'
import { prisma } from './prisma'

// Type guard to check if costReport model exists
function hasCostReportModel(prismaClient: { costReport?: unknown }): boolean {
  return typeof prismaClient.costReport !== 'undefined'
}

/**
 * Cost report storage configuration
 */
export const COST_REPORT_STORAGE = {
  // Directory to store cost report files
  UPLOAD_DIR: path.join(process.cwd(), 'uploads', 'cost-reports'),
  // Allowed file extensions
  ALLOWED_EXTENSIONS: ['.xlsx', '.xls'],
  // Max file size (50MB)
  MAX_FILE_SIZE: 50 * 1024 * 1024,
}

/**
 * Ensure the upload directory exists
 */
export function ensureUploadDirectory(): void {
  if (!fs.existsSync(COST_REPORT_STORAGE.UPLOAD_DIR)) {
    fs.mkdirSync(COST_REPORT_STORAGE.UPLOAD_DIR, { recursive: true })
  }
}

/**
 * Extract report date from filename
 * Format: "Cost Report Summary 10.15.25.xlsx" -> Date
 */
export function extractDateFromFilename(fileName: string): Date | null {
  // Try to match patterns like "10.15.25", "10-15-25", "10/15/25"
  const datePatterns = [
    /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/, // 10.15.25 or 10-15-25
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/,   // 2025.10.15
  ]
  
  for (const pattern of datePatterns) {
    const match = fileName.match(pattern)
    if (match) {
      const [, part1, part2, part3] = match
      let month: number, day: number, year: number
      
      // Determine format based on part lengths
      if (part3.length === 4) {
        // YYYY-MM-DD format
        year = parseInt(part1)
        month = parseInt(part2)
        day = parseInt(part3)
      } else {
        // MM-DD-YY format (assume US format)
        month = parseInt(part1)
        day = parseInt(part2)
        year = parseInt(part3)
        // Convert 2-digit year to 4-digit (assume 2000s)
        if (year < 100) {
          year += 2000
        }
      }
      
      const date = new Date(year, month - 1, day)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }
  
  return null
}

/**
 * Generate a safe filename (prevent overwrites and ensure uniqueness)
 */
export function generateSafeFileName(originalFileName: string): string {
  const ext = path.extname(originalFileName)
  const baseName = path.basename(originalFileName, ext)
  const timestamp = Date.now()
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${sanitized}_${timestamp}${ext}`
}

/**
 * Save uploaded cost report file
 */
export async function saveCostReportFile(
  file: Buffer,
  originalFileName: string,
  uploadedBy?: string
): Promise<{
  id: string
  fileName: string
  filePath: string
  reportDate: Date | null
}> {
  ensureUploadDirectory()
  
  // Validate file extension
  const ext = path.extname(originalFileName).toLowerCase()
  if (!COST_REPORT_STORAGE.ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Invalid file type. Allowed: ${COST_REPORT_STORAGE.ALLOWED_EXTENSIONS.join(', ')}`)
  }
  
  // Validate file size
  if (file.length > COST_REPORT_STORAGE.MAX_FILE_SIZE) {
    throw new Error(`File too large. Max size: ${COST_REPORT_STORAGE.MAX_FILE_SIZE / 1024 / 1024}MB`)
  }
  
  // Generate safe filename (preserve original name but add timestamp to prevent overwrites)
  const safeFileName = generateSafeFileName(originalFileName)
  const filePath = path.join(COST_REPORT_STORAGE.UPLOAD_DIR, safeFileName)
  
  // Write file to disk
  fs.writeFileSync(filePath, file)
  
  // Extract report date from filename
  const reportDate = extractDateFromFilename(originalFileName) || new Date()
  
  // Verify costReport model is available
  if (!hasCostReportModel(prisma)) {
    throw new Error('CostReport model is not available. Please restart the server after running: npx prisma generate')
  }
  
  // Deactivate all previous reports (only one active at a time)
  // Check if costReport model exists and has records
  try {
    // Use findMany first to check if model exists and has records
    const existingActive = await prisma.costReport.findMany({
      where: { isActive: true },
      take: 1
    })
    
    if (existingActive.length > 0) {
      await prisma.costReport.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      })
    }
  } catch (error: unknown) {
    // If this fails, log it but continue - this might be the first upload
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.warn('Could not deactivate previous reports:', errorMessage)
  }
  
  // Create database record
  const costReport = await prisma.costReport.create({
    data: {
      fileName: originalFileName, // Store original filename
      filePath: filePath,
      fileSize: file.length,
      reportDate: reportDate,
      uploadedBy: uploadedBy || null,
      isActive: true, // New uploads are active by default
    }
  })
  
  return {
    id: costReport.id,
    fileName: originalFileName,
    filePath: filePath,
    reportDate: reportDate,
  }
}

/**
 * Get the active (latest) cost report
 */
export async function getActiveCostReport(): Promise<{
  id: string
  fileName: string
  filePath: string
  reportDate: Date
} | null> {
  if (!hasCostReportModel(prisma)) {
    return null
  }
  
  const costReport = await prisma.costReport.findFirst({
    where: { isActive: true },
    orderBy: { reportDate: 'desc' }
  })
  
  if (!costReport) return null
  
  // Verify file still exists
  if (!fs.existsSync(costReport.filePath)) {
    console.warn(`Cost report file not found: ${costReport.filePath}`)
    return null
  }
  
  return {
    id: costReport.id,
    fileName: costReport.fileName,
    filePath: costReport.filePath,
    reportDate: costReport.reportDate,
  }
}

/**
 * Get cost report for a specific date (finds the report that was active on that date)
 */
export async function getCostReportForDate(targetDate: Date): Promise<{
  id: string
  fileName: string
  filePath: string
  reportDate: Date
} | null> {
  if (!hasCostReportModel(prisma)) {
    return null
  }
  
  // Find the cost report that was uploaded before or on the target date
  // and is the most recent one before that date
  const costReport = await prisma.costReport.findFirst({
    where: {
      reportDate: { lte: targetDate }
    },
    orderBy: { reportDate: 'desc' }
  })
  
  if (!costReport) {
    // Fall back to active report if no historical match
    return getActiveCostReport()
  }
  
  // Verify file still exists
  if (!fs.existsSync(costReport.filePath)) {
    console.warn(`Cost report file not found: ${costReport.filePath}`)
    return getActiveCostReport()
  }
  
  return {
    id: costReport.id,
    fileName: costReport.fileName,
    filePath: costReport.filePath,
    reportDate: costReport.reportDate,
  }
}

/**
 * List all cost reports (for admin interface)
 */
export async function listCostReports(includeInactive: boolean = true) {
  if (!hasCostReportModel(prisma)) {
    return []
  }
  
  return prisma.costReport.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { reportDate: 'desc' },
    select: {
      id: true,
      fileName: true,
      filePath: true,
      fileSize: true,
      reportDate: true,
      uploadedAt: true,
      uploadedBy: true,
      isActive: true,
      notes: true,
    }
  })
}

/**
 * Delete a cost report (soft delete - just mark as inactive)
 */
export async function deleteCostReport(id: string): Promise<void> {
  if (!hasCostReportModel(prisma)) {
    throw new Error('CostReport model is not available')
  }
  
  await prisma.costReport.update({
    where: { id },
    data: { isActive: false }
  })
  // Note: We keep the file on disk for historical purposes
  // If you want to actually delete files, add that logic here
}


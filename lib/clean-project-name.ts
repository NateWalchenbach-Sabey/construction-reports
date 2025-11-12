/**
 * Utility function to clean project names by removing date patterns
 * Removes patterns like "11 01 25", "11.01.25", "110125", etc.
 */

/**
 * Remove date patterns from project names
 * Handles formats like:
 * - "11 01 25" (space-separated)
 * - "11.01.25" (dot-separated)
 * - "110125" (no separators)
 * - "11/01/25" (slash-separated)
 * - "11-01-25" (dash-separated)
 */
export function cleanProjectName(name: string): string {
  if (!name) return name

  let cleaned = name.trim()

  // Remove date patterns at the end of the name
  // Only match patterns that look like actual dates (month 01-12)
  
  // Remove trailing date patterns with separators (MM/DD/YY or MM.DD.YY or MM-DD-YY)
  // First number must be 01-12 (valid month)
  cleaned = cleaned.replace(/\s+(0[1-9]|1[0-2])[.\-\s\/](\d{1,2})[.\-\s\/](\d{2,4})\s*$/, '')
  
  // Remove trailing date patterns with spaces (M D YY or MM DD YY)
  // First number must be 01-12 (valid month)
  cleaned = cleaned.replace(/\s+(0[1-9]|1[0-2])\s+(\d{1,2})\s+(\d{2,4})\s*$/, '')
  
  // Remove compact formats like "110125" (MMDDYY) or "11012025" (MMDDYYYY)
  // Must start with 01-12 (valid month)
  cleaned = cleaned.replace(/\s+(0[1-9]|1[0-2])(\d{2})(\d{2,4})\s*$/, '')
  
  // Clean up any double spaces or trailing spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
}

/**
 * Clean project name but preserve important suffixes
 * This version is more conservative and only removes obvious date patterns
 */
export function cleanProjectNameConservative(name: string): string {
  if (!name) return name

  let cleaned = name.trim()

  // Remove common date patterns at the end
  // Pattern: month (01-12), day (01-31), year (00-99 or 2000-2099)
  
  // Remove "MM DD YY" or "M D YY" patterns with spaces
  cleaned = cleaned.replace(/\s+([01]?\d)\s+(\d{1,2})\s+(\d{2,4})\s*$/, '')
  
  // Remove "MM.DD.YY" or "M.D.YY" patterns with dots
  cleaned = cleaned.replace(/\s+([01]?\d)\.(\d{1,2})\.(\d{2,4})\s*$/, '')
  
  // Remove "MM-DD-YY" patterns with dashes
  cleaned = cleaned.replace(/\s+([01]?\d)-(\d{1,2})-(\d{2,4})\s*$/, '')
  
  // Remove "MM/DD/YY" patterns with slashes
  cleaned = cleaned.replace(/\s+([01]?\d)\/(\d{1,2})\/(\d{2,4})\s*$/, '')
  
  // Remove compact formats like "110125" (but only if it looks like a date)
  // Check if it starts with 0-1 (month) and has 6 or 8 digits
  cleaned = cleaned.replace(/\s+([01]\d)(\d{2})(\d{2,4})\s*$/, '')
  
  // Clean up any double spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
}


import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  
  let d: Date
  if (typeof date === 'string') {
    // If it's a YYYY-MM-DD string, parse it as UTC to avoid timezone issues
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number)
      d = new Date(Date.UTC(year, month - 1, day))
    } else {
      d = new Date(date)
    }
  } else {
    d = date
  }
  
  // Check if date is valid
  if (isNaN(d.getTime())) return ''
  
  // Use UTC timezone for formatting to ensure consistency
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0%'
  return `${value.toFixed(1)}%`
}


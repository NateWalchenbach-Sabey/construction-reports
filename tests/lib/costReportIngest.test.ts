import { describe, expect, it } from 'vitest'

import { extractJobNumber, normalizeString, __testables } from '@/lib/costReportIngest'

const { parseNumericValue, detectColumns, extractFinancials, matchRowToProject } = __testables

describe('normalizeString', () => {
  it('trims, lowercases, and removes punctuation', () => {
    expect(normalizeString('  Project #12 ')).toBe('project 12')
  })

  it('returns empty string for falsy input', () => {
    expect(normalizeString(undefined)).toBe('')
    expect(normalizeString(null)).toBe('')
    expect(normalizeString('')).toBe('')
  })
})

describe('extractJobNumber', () => {
  it('extracts compound job numbers with dashes', () => {
    expect(extractJobNumber('Job 25-8-131 details')).toBe('25-8-131')
  })

  it('ignores year-like values', () => {
    expect(extractJobNumber('Budget 2024 update')).toBeNull()
  })

  it('returns null when no suitable number is present', () => {
    expect(extractJobNumber('No numbers here')).toBeNull()
  })
})

describe('parseNumericValue', () => {
  it('parses numeric strings with currency formatting', () => {
    expect(parseNumericValue('$1,234.56')).toBeCloseTo(1234.56)
  })

  it('handles parenthetical values by removing formatting', () => {
    expect(parseNumericValue('($9,876.54)')).toBeCloseTo(9876.54)
  })

  it('returns null for empty or non-numeric values', () => {
    expect(parseNumericValue('--')).toBeNull()
    expect(parseNumericValue('not a number')).toBeNull()
  })
})

describe('detectColumns', () => {
  it('detects job, project, and financial columns based on hints', () => {
    const headers = ['Job #', 'Project Name', 'Project Number', 'Total Budget', 'Forecasted Cost @ Completion']
    const mapping = detectColumns(headers, ['job'], ['project', 'name'], ['budget', 'forecast'])

    expect(mapping.jobNumberCol).toBe(0)
    expect(mapping.projectNameCol).toBe(1)
    expect(mapping.projectNumberCol).toBe(2)
    expect(mapping.financialCols.get(3)).toBe('Total Budget')
    expect(mapping.financialCols.get(4)).toBe('Forecasted Cost @ Completion')
  })

  it('defaults project number to column B when hints are missing', () => {
    const headers = ['Job Number', 'Column B', 'Something Else']
    const mapping = detectColumns(headers, ['job'], ['project'], ['budget'])

    expect(mapping.jobNumberCol).toBe(0)
    expect(mapping.projectNumberCol).toBe(1)
  })
})

describe('extractFinancials', () => {
  it('returns numeric values keyed by detected headers', () => {
    const mapping = {
      jobNumberCol: 0,
      projectNumberCol: 1,
      projectNameCol: 2,
      financialCols: new Map<number, string>([
        [3, 'Budget'],
        [4, 'Forecast'],
      ]),
    }

    const row = ['J-1', '24-5-072', 'Project Foo', '$1,200.00', '($400.00)']
    const financials = extractFinancials(row, mapping as any)

    expect(financials).toEqual({ Budget: 1200, Forecast: 400 })
  })
})

describe('matchRowToProject', () => {
  const mapping = {
    jobNumberCol: 0,
    projectNumberCol: 1,
    projectNameCol: 2,
    financialCols: new Map(),
  }

  it('matches by project number ignoring case', () => {
    const row = ['J-1', '24-5-072', 'Project Foo']
    const projectMap = new Map([
      ['24-5-072', { id: 'p1', code: 'P1', name: 'Project Foo', projectNumber: '24-5-072' }],
    ])

    const { project, matchType } = matchRowToProject(row, mapping as any, projectMap)

    expect(project?.id).toBe('p1')
    expect(matchType).toBe('project_number')
  })

  it('returns null when project number not found', () => {
    const row = ['J-1', 'UNKNOWN', 'Project Foo']
    const projectMap = new Map([
      ['24-5-072', { id: 'p1', code: 'P1', name: 'Project Foo', projectNumber: '24-5-072' }],
    ])

    const { project, matchType } = matchRowToProject(row, mapping as any, projectMap)

    expect(project).toBeNull()
    expect(matchType).toBeNull()
  })
})

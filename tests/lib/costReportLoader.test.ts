import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as XLSX from 'xlsx'

import { findCostDataForProject, type CostReportData, __loaderTestables, loadCostReport } from '@/lib/cost-report-loader'

const { buildProjectNumberVariants, rankProjectNumberMatch, parseNumericValue } = __loaderTestables

describe('buildProjectNumberVariants', () => {
  it('returns base variant when suffix contains letters', () => {
    const variants = buildProjectNumberVariants('24-1-061-ige03')
    expect(variants).toContain('24-1-061-ige03')
    expect(variants).toContain('24-1-061')
  })

  it('keeps numeric suffixes intact', () => {
    const variants = buildProjectNumberVariants('24-1-061-123')
    expect(variants).toContain('24-1-061-123')
    expect(variants).not.toContain('24-1-061')
  })

  it('splits comma and whitespace delimited numbers', () => {
    const variants = buildProjectNumberVariants('24-1-063, 24-1-064  24-1-065')
    expect(variants).toEqual(expect.arrayContaining(['24-1-063', '24-1-064', '24-1-065']))
  })

  it('normalises underscores and slashes when removing suffix', () => {
    const variants = buildProjectNumberVariants('24_1_061_extra')
    expect(variants).toContain('24_1_061_extra')
    expect(variants).toContain('24_1_061')

    const slashVariants = buildProjectNumberVariants('24/1/061/SUFF')
    expect(slashVariants).toContain('24/1/061/suff')
    expect(slashVariants).toContain('24/1/061')
  })
})

describe('rankProjectNumberMatch', () => {
  it('returns 0 for exact variant matches', () => {
    const target = '24-1-061'
    const targetVariants = new Set(buildProjectNumberVariants(target))
    expect(rankProjectNumberMatch('24-1-061-ige03', target, targetVariants)).toBe(0)
  })

  it('returns zero score for exact variants even with extra suffixes', () => {
    const target = '24-1-061'
    const targetVariants = new Set(buildProjectNumberVariants(target))
    expect(rankProjectNumberMatch('24-1-061-extra', target, targetVariants)).toBe(0)
    expect(rankProjectNumberMatch('24-1-061-extra-longer', target, targetVariants)).toBe(0)
  })

  it('returns infinity when no shared variants exist', () => {
    const target = '24-1-061'
    const targetVariants = new Set(buildProjectNumberVariants(target))
    expect(rankProjectNumberMatch('99-9-999', target, targetVariants)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('findCostDataForProject', () => {
  const costData: CostReportData = {
    entries: [
      {
        jobNumber: null,
        projectNumber: '24-1-061-ige03',
        projectName: 'SDC-SEA-3 Prov PHCC Pharmacy HVAC TI',
        totalBudget: 100,
        eac: 95,
        variance: 5,
      },
      {
        jobNumber: 'SEA-002',
        projectNumber: '24-1-062',
        projectName: 'Another Project',
        totalBudget: 200,
        eac: 180,
        variance: 20,
      },
      {
        jobNumber: 'SEA-003',
        projectNumber: '24-1-063, 24-1-064',
        projectName: 'Combined Entry',
        totalBudget: 300,
        eac: 290,
        variance: 10,
      },
      {
        jobNumber: 'SEA-004',
        projectNumber: '24/1/065/abc',
        projectName: 'Slash Entry',
        totalBudget: 400,
        eac: 390,
        variance: 10,
      },
      {
        jobNumber: 'SEA-005',
        projectNumber: '24-1-066-extra-longer',
        projectName: 'Long Suffix',
        totalBudget: 500,
        eac: 480,
        variance: 20,
      },
      {
        jobNumber: 'SEA-006',
        projectNumber: '24-1-066-extra',
        projectName: 'Shorter Suffix',
        totalBudget: 600,
        eac: 585,
        variance: 15,
      },
    ],
    reportDate: null,
  }

  it('matches project numbers with hyphenated suffixes', () => {
    const entry = findCostDataForProject(costData, '24-1-061')
    expect(entry?.jobNumber).toBeNull()
    expect(entry?.projectNumber).toBe('24-1-061-ige03')
  })

  it('matches when excel project number contains comma separated values', () => {
    const entry = findCostDataForProject(costData, '24-1-064')
    expect(entry?.jobNumber).toBe('SEA-003')
  })

  it('prefers exact matches when both exact and fuzzy candidates exist', () => {
    const entry = findCostDataForProject(costData, '24-1-062')
    expect(entry?.jobNumber).toBe('SEA-002')
  })

  it('handles case-insensitive comparisons', () => {
    const entry = findCostDataForProject(costData, '24-1-061-IGE03')
    expect(entry?.jobNumber).toBeNull()
    expect(entry?.projectNumber).toBe('24-1-061-ige03')
  })

  it('matches variants with slash-separated suffixes', () => {
    const entry = findCostDataForProject(costData, '24/1/065')
    expect(entry?.jobNumber).toBe('SEA-004')
  })

  it('chooses the closest fuzzy match when multiple candidates share the same base number', () => {
    const entry = findCostDataForProject(costData, '24-1-066')
    expect(entry?.jobNumber).toBe('SEA-006')
  })

  it('returns null when no entries match', () => {
    const entry = findCostDataForProject(costData, '99-9-999')
    expect(entry).toBeNull()
  })

  it('returns null for missing project numbers', () => {
    expect(findCostDataForProject(costData, undefined)).toBeNull()
    expect(findCostDataForProject(costData, '')).toBeNull()
  })

  it('retains rows when job number is n/a but project number exists', () => {
    const entry = findCostDataForProject(costData, '24-1-061')
    expect(entry?.jobNumber).toBeNull()
    expect(entry?.projectNumber).toBe('24-1-061-ige03')
  })
})

describe('loadCostReport', () => {
  it('keeps rows where job number is n/a but project number is present', async () => {
    const workbook = XLSX.utils.book_new()
    const rows: any[][] = [[], [], [], []]
    rows.push([
      'Job Number',
      'Project Number',
      'Project Name',
      null,
      null,
      null,
      null,
      'Total Budget',
      null,
      null,
      null,
      'Forecasted Cost @ Completion (EAC)',
      'Variance',
    ])
    rows.push([
      'n/a',
      '24-1-061-ige03',
      'Providence Project',
      null,
      null,
      null,
      null,
      3584022,
      null,
      null,
      null,
      2914397.72,
      669624.28,
    ])
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, sheet, 'Cost Rpt Summary')

    const tmpPath = path.join(os.tmpdir(), `cost-report-${Date.now()}.xlsx`)
    XLSX.writeFile(workbook, tmpPath)

    const data = await loadCostReport(tmpPath)
    fs.unlinkSync(tmpPath)

    const entry = data.entries.find(e => e.projectNumber === '24-1-061-ige03')
    expect(entry).toBeDefined()
    expect(entry?.jobNumber).toBeNull()
  })

  it('skips rows that lack both job and project numbers', async () => {
    const workbook = XLSX.utils.book_new()
    const rows: any[][] = [[], [], [], []]
    rows.push([
      'Job Number',
      'Project Number',
      'Project Name',
      null,
      null,
      null,
      null,
      'Total Budget',
      null,
      null,
      null,
      'Forecasted Cost @ Completion (EAC)',
      'Variance',
    ])
    rows.push([
      null,
      null,
      'Header Row',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
    rows.push([
      '25-1-001',
      '25-1-001',
      'Valid Project',
      null,
      null,
      null,
      null,
      1000,
      null,
      null,
      null,
      900,
      100,
    ])
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, sheet, 'Cost Rpt Summary')

    const tmpPath = path.join(os.tmpdir(), `cost-report-${Date.now()}-blank.xlsx`)
    XLSX.writeFile(workbook, tmpPath)

    const data = await loadCostReport(tmpPath)
    fs.unlinkSync(tmpPath)

    expect(data.entries.length).toBe(1)
    expect(data.entries[0].projectNumber).toBe('25-1-001')
  })
})

describe('parseNumericValue', () => {
  it('parses currency strings with commas and dollar signs', () => {
    expect(parseNumericValue('$1,234.56')).toBeCloseTo(1234.56)
  })

  it('handles parenthetical negatives and leading minus', () => {
    expect(parseNumericValue('($9,876.54)')).toBeCloseTo(-9876.54)
    expect(parseNumericValue('-3,210')).toBeCloseTo(-3210)
  })

  it('returns null for non-numeric values', () => {
    expect(parseNumericValue('--')).toBeNull()
    expect(parseNumericValue('not a number')).toBeNull()
  })
})

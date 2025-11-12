# Excel Data Seeding

This document describes the Excel data seeding system for the Construction Reporting app.

## Overview

The app now uses **real data** from `aggregated_reports.xlsx` instead of mock/placeholder content. This Excel file contains two sheets:

1. **Reports** - 19 weekly/daily reports with project information
2. **SubcontractorActivity** - 187 subcontractor activity records

## Files Created

### 1. `lib/excel-types.ts`
- TypeScript types and Zod schemas for Excel data validation
- Helper functions:
  - `excelDateToJSDate()` - Converts Excel serial dates to JavaScript Date objects
  - `generateProjectCode()` - Creates unique project codes from titles
  - `mapRegionToEnum()` - Maps region strings to Prisma Region enum

### 2. `lib/excel-loader.ts`
- Excel file loader using `xlsx` library
- Reads and validates both sheets
- Returns typed arrays of `ExcelReport` and `ExcelSubcontractorActivity`

### 3. `prisma/seed.ts` (Updated)
- Loads data from `aggregated_reports.xlsx`
- Creates Projects from unique project titles
- Creates Reports linked to Projects
- Creates SubcontractorCompany and Craft records as needed
- Links SubcontractorActivity to Reports by matching `week_ending` and `project_title`

## Data Mapping

### Excel → Prisma Schema

| Excel Field | Prisma Field | Notes |
|------------|-------------|-------|
| `project_title` | `Project.name` | Also used to generate `Project.code` |
| `region` | `Project.region` | Mapped to Region enum |
| `week_ending` | `Report.reportDate` | Excel serial date converted |
| `work_performed` | `Report.workPerformed` | Text field |
| `safety` | `Report.safety` | Text field, also mapped to `safetyType` enum |
| `total_trade_workers` | `Report.totalTradeWorkers` | Integer |
| `company` | `SubcontractorCompany.name` | Unique per company |
| `craft` | `Craft.name` | Unique per craft |
| `trade_workers` | `ReportSubcontractorActivity.tradeWorkers` | Integer |

## Running the Seed

```bash
cd /home/nwalchenbach/construction-reports
DATABASE_URL="postgresql://construction_user:construction_password@localhost:5432/construction_reports?schema=public" npm run db:seed
```

## Data Summary

After seeding, the database contains:
- **19 Projects** - From unique project titles in Excel
- **19 Reports** - One per row in Reports sheet
- **187 Subcontractor Activities** - Linked to reports by date/project match
- **98 Subcontractor Companies** - Unique companies from activities
- **95 Crafts** - Unique crafts from activities

## Features

### Automatic Type Conversion
- Excel dates (serial numbers) → JavaScript Date objects
- String numbers → Numeric types (handles commas, currency symbols)
- Percentages → Decimal values
- Handles null/empty values gracefully

### Project Code Generation
- Extracts codes from titles (e.g., "ASH A 11 01 25" → "ASH")
- Generates unique codes for duplicates
- Falls back to abbreviation from title words

### Region Mapping
- Maps "SDC Ashburn" → "ASHBURN"
- Maps "Non SDC Projects" → "NON_SDC"
- Handles various region name formats

### Report Type Detection
- Determines DAILY vs WEEKLY based on day of week
- Friday = WEEKLY, other days = DAILY

## Validation

All data is validated using Zod schemas:
- Type safety at compile time
- Runtime validation with helpful error messages
- Handles missing/null values appropriately

## Notes

- The seed script creates a default user (super1@example.com) to assign as report author
- Projects are linked to reports by matching `project_title`
- Activities are linked to reports by matching both `project_title` and `week_ending`
- If an activity can't be matched to a report, it's skipped with a warning


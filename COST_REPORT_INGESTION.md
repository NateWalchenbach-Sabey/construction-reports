# Cost Report Ingestion System

Production-grade implementation for ingesting Cost Report Summary Excel files into the database.

## Overview

This system reads Excel cost reports, automatically matches rows to existing projects in PostgreSQL, extracts financial data (budget, EAC, variance, etc.), and upserts this data into the database. It only processes projects that exist in your database (DB is the source of truth).

## What Was Implemented

### 1. Database Schema (`prisma/schema.prisma`)

- **Added `jobNumber` field to `Project` model**: Stores job number from cost reports (Column A)
- **Created `ProjectFinancials` model**: Stores financial data by period with:
  - Core fields: `budget`, `forecast`, `actual`, `committed`, `spent`, `variance`
  - Metadata: `sourceFile`, `sourceDate`, `jobNumber`, `projectNumber`, `matchType`
  - Flexible storage: `rawJson` for all other financial columns
  - Unique constraint: `(projectId, periodStart)` to prevent duplicates

### 2. Core Ingestion Service (`lib/costReportIngest.ts`)

**Key Features:**
- **Automatic Column Detection**: Scans Excel headers to find job number, project number, project name, and financial columns
- **Smart Matching Logic**:
  1. **Job Number Match** (primary): Extracts job number from Column A, normalizes it, matches against `Project.jobNumber`
  2. **Project Name Match** (fallback): Normalizes project names (lowercase, remove punctuation), matches against `Project.name`
  3. **Project Code Match** (fallback): Matches project number (Column B) against project codes
- **Financial Data Extraction**: Automatically extracts budget, forecast (EAC), actual, committed, spent, variance
- **Transaction Safety**: All database updates in a single transaction
- **Dry Run Mode**: Test matching without writing to database
- **Comprehensive Logging**: Structured logging for debugging

**Functions:**
- `ingestCostReportBuffer(excelBuffer: Buffer, options?: IngestOptions): Promise<IngestResult>`

### 3. API Route (`app/api/cost-report/ingest/route.ts`)

**Endpoint**: `POST /api/cost-report/ingest`

**Request**: `multipart/form-data`
- `file`: Excel file (required, .xlsx or .xls)
- `periodStart`: ISO date string (required if `dryRun=false`)
- `dryRun`: "true" or "false" (default: "false")

**Authentication**: Requires ADMIN or PM role

**Response**: JSON with ingestion summary and matched/unmatched rows

### 4. Logger Utility (`lib/logger.ts`)

Simple structured logger with DEBUG, INFO, WARN, ERROR levels. Automatically adjusts log level based on `NODE_ENV`.

### 5. Test Suite (`lib/__tests__/costReportIngest.test.ts`)

Comprehensive test suite covering:
- Dry run ingestion
- Actual ingestion with database updates
- Job number matching
- Name matching
- Database record verification

Run tests: `npx tsx lib/__tests__/costReportIngest.test.ts`

### 6. Documentation (`lib/costReportIngest.md`)

Complete API documentation with usage examples, column detection details, matching logic, and error handling.

## Usage

### Via API Route

```bash
curl -X POST http://localhost:3000/api/cost-report/ingest \
  -H "Authorization: Bearer <token>" \
  -F "file=@Cost Report Summary 10.15.25.xlsx" \
  -F "periodStart=2025-10-15" \
  -F "dryRun=false"
```

### Via Code

```typescript
import { ingestCostReportBuffer } from '@/lib/costReportIngest'
import fs from 'fs'

const excelBuffer = fs.readFileSync('Cost Report Summary 10.15.25.xlsx')

const result = await ingestCostReportBuffer(excelBuffer, {
  dryRun: false,
  periodStart: '2025-10-15',
  sourceFileName: 'Cost Report Summary 10.15.25.xlsx',
})

console.log(`Matched ${result.summary.matchedByJob} by job number`)
console.log(`Matched ${result.summary.matchedByName} by name`)
console.log(`Unmatched: ${result.summary.unmatched}`)
console.log(`Projects updated: ${result.summary.projectsUpdated}`)
```

## Column Detection

The service automatically detects columns by scanning headers for keywords:

### Job Number Column
- Default hints: `["job", "job #", "job number", "job id", "project id", "proj #"]`
- Extracts job numbers using pattern matching (e.g., "25-8-131-quie6")
- Skips years 2010-2030 unless no other candidate exists

### Project Name Column
- Default hints: `["project", "name", "title", "project name"]`

### Project Number Column
- Looks for headers containing "project number", "project #", "proj number"
- Falls back to column B if job number is in column A

### Financial Columns
- Default hints: `["budget", "forecast", "actual", "committed", "spent", "variance", "cost", "eac", ...]`
- All matching columns are extracted and stored

## Matching Logic

1. **Job Number Match** (highest priority):
   - Extract job number from Excel row (Column A)
   - Normalize (lowercase, remove punctuation)
   - Match against `Project.jobNumber` in database
   - Also try matching full job number text

2. **Project Name Match** (fallback):
   - Extract project name from Excel row
   - Normalize (lowercase, remove punctuation, collapse whitespace)
   - Match against `Project.name` in database

3. **Project Code Match** (fallback):
   - Extract project number from Excel row (Column B)
   - Match against `Project.code` in database

## Database Updates

When `dryRun=false` and `periodStart` is provided:

1. **Upserts financials** into `ProjectFinancials` table:
   - Unique constraint: `(projectId, periodStart)`
   - If record exists, updates it
   - If record doesn't exist, creates it

2. **Updates project job number** if not set:
   - If match was by job number and project doesn't have a job number, updates `Project.jobNumber`

3. **All updates in a single transaction**:
   - If any update fails, all changes are rolled back

## Error Handling

The service handles:
- Invalid Excel file format
- Missing required columns
- Invalid `periodStart` date
- Database transaction failures
- File size limits (50MB max)

All errors are logged with structured logging for debugging.

## Testing

Run the test suite:

```bash
npx tsx lib/__tests__/costReportIngest.test.ts
```

The test suite:
- Creates test projects
- Generates test Excel files
- Tests dry run ingestion
- Tests actual ingestion
- Verifies database records
- Cleans up test data

## Next Steps

1. **Run database migration**:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

2. **Test the ingestion**:
   ```bash
   # Dry run first
   curl -X POST http://localhost:3000/api/cost-report/ingest \
     -F "file=@Cost Report Summary 10.15.25.xlsx" \
     -F "periodStart=2025-10-15" \
     -F "dryRun=true"
   
   # Then actual ingestion
   curl -X POST http://localhost:3000/api/cost-report/ingest \
     -F "file=@Cost Report Summary 10.15.25.xlsx" \
     -F "periodStart=2025-10-15" \
     -F "dryRun=false"
   ```

3. **Create UI for ingestion** (optional):
   - Add a form to upload Excel files
   - Show ingestion results
   - Display matched/unmatched rows
   - Allow users to review before ingesting

## Files Created/Modified

- ✅ `prisma/schema.prisma` - Added `ProjectFinancials` model and `jobNumber` field
- ✅ `lib/costReportIngest.ts` - Core ingestion service
- ✅ `lib/logger.ts` - Logger utility
- ✅ `app/api/cost-report/ingest/route.ts` - API route
- ✅ `lib/__tests__/costReportIngest.test.ts` - Test suite
- ✅ `lib/costReportIngest.md` - API documentation
- ✅ `COST_REPORT_INGESTION.md` - This file

## Architecture Decisions

1. **DB is Source of Truth**: Only projects that exist in the database are processed
2. **Prisma ORM**: Uses Prisma for type-safe database operations
3. **Transaction Safety**: All updates in a single transaction
4. **Flexible Schema**: `rawJson` field stores all financial columns for future use
5. **Normalized Matching**: Uses normalized strings for reliable matching
6. **Dry Run Mode**: Allows testing without database changes
7. **Comprehensive Logging**: Structured logging for debugging and monitoring

## Limitations

- Maximum file size: 50MB (configurable)
- Supported formats: `.xlsx`, `.xls`
- Matching is case-insensitive
- Duplicate project matches: Last row wins (deterministic)
- Requires projects to exist in database before ingestion

## Future Enhancements

- Support for multiple sheets
- Custom column mapping configuration
- Batch processing for large files
- Progress tracking for long-running ingestions
- Email notifications for ingestion completion
- Historical data preservation (archive old financials)
- UI for ingestion and results review


# Cost Report Ingestion Service

Production-grade service for ingesting Cost Report Summary Excel files into the database.

## Overview

The `costReportIngest` module reads Excel cost reports, matches rows to existing projects in PostgreSQL, and upserts financial data into the `ProjectFinancials` table.

## Features

- **Automatic Column Detection**: Detects job number, project number, project name, and financial columns by scanning headers
- **Smart Matching**: Matches Excel rows to database projects by:
  1. Job number (exact match)
  2. Project name (normalized, fuzzy matching)
  3. Project code (fallback)
- **Financial Data Extraction**: Extracts budget, forecast (EAC), actual, committed, spent, and variance
- **Transaction Safety**: All database updates are performed in a single transaction
- **Dry Run Mode**: Test matching without writing to database
- **Comprehensive Logging**: Structured logging for debugging and monitoring

## API

### `ingestCostReportBuffer(excelBuffer: Buffer, options?: IngestOptions): Promise<IngestResult>`

Main entry point for ingesting cost reports.

#### Parameters

- `excelBuffer`: Buffer containing the Excel file
- `options`: Optional configuration (see `IngestOptions` interface)

#### Returns

`IngestResult` containing:
- `summary`: Statistics about the ingestion (matched counts, unmatched count, financial columns)
- `rows`: Array of matched rows with project associations
- `unmatchedRows`: Array of unmatched Excel rows for debugging

### `IngestOptions`

```typescript
interface IngestOptions {
  jobHints?: string[];        // Header hints for job number detection
  nameHints?: string[];       // Header hints for project name detection
  financialHints?: string[];  // Header hints for financial column detection
  periodStart?: string;       // ISO date string for reporting period (required if dryRun=false)
  dryRun?: boolean;           // If true, perform matching but do not write to database
  sourceFileName?: string;    // Source file name for metadata
  sourceDate?: Date;          // Source file date for metadata
}
```

## Usage

### Basic Usage

```typescript
import { ingestCostReportBuffer } from '@/lib/costReportIngest'
import fs from 'fs'

// Read Excel file
const excelBuffer = fs.readFileSync('Cost Report Summary 10.15.25.xlsx')

// Ingest with dry run
const result = await ingestCostReportBuffer(excelBuffer, {
  dryRun: true,
  periodStart: '2025-10-15',
  sourceFileName: 'Cost Report Summary 10.15.25.xlsx',
})

console.log(`Matched ${result.summary.matchedByJob} rows by job number`)
console.log(`Matched ${result.summary.matchedByName} rows by name`)
console.log(`Unmatched: ${result.summary.unmatched} rows`)
```

### API Route Usage

The service is exposed via a Next.js API route at `/api/cost-report/ingest`.

#### Request

```
POST /api/cost-report/ingest
Content-Type: multipart/form-data

file: <Excel file>
periodStart: 2025-10-15 (ISO date string, required if dryRun=false)
dryRun: true|false (default: false)
```

#### Response

```json
{
  "success": true,
  "dryRun": false,
  "summary": {
    "matchedByJob": 10,
    "matchedByName": 5,
    "unmatched": 2,
    "financialColumns": ["Total Budget", "Forecasted Cost @ Completion", "Variance (Over)/Under"],
    "totalRows": 17,
    "projectsUpdated": 15
  },
  "rows": [
    {
      "projectId": "clx...",
      "projectName": "SDC-QUI-E6 Zoho Office Exp LLO",
      "jobNumber": "25-8-131-quie6",
      "projectNumber": "25-7-131-quie6",
      "matchType": "job",
      "financials": {
        "Total Budget": 86738,
        "Forecasted Cost @ Completion": 86738,
        "Variance (Over)/Under": 0
      }
    }
  ],
  "unmatchedRows": [
    {
      "jobNumber": "UNKNOWN-JOB",
      "projectNumber": "UNKNOWN-PROJ",
      "projectName": "Unknown Project",
      "financials": {}
    }
  ]
}
```

## Column Detection

The service automatically detects columns by scanning headers for keywords:

### Job Number Column
- Default hints: `["job", "job #", "job number", "job id", "project id", "proj #"]`
- Case-insensitive matching
- Extracts job numbers using pattern matching (e.g., "25-8-131-quie6")

### Project Name Column
- Default hints: `["project", "name", "title", "project name"]`
- Case-insensitive matching

### Project Number Column
- Looks for headers containing "project number", "project #", "proj number"
- Falls back to column B if job number is in column A

### Financial Columns
- Default hints: `["budget", "forecast", "actual", "committed", "spent", "variance", "cost", "eac", "hard cost", "soft cost", "total budget", "forecasted cost", "cost to complete"]`
- All matching columns are extracted and stored in the `rawJson` field

## Matching Logic

### Job Number Matching
1. Extract job number from Excel row (Column A)
2. Normalize job number (lowercase, remove punctuation)
3. Match against `Project.jobNumber` in database
4. Also try matching full job number text

### Name Matching (Fallback)
1. Extract project name from Excel row
2. Normalize name (lowercase, remove punctuation, collapse whitespace)
3. Match against `Project.name` in database (exact match on normalized strings)

### Project Code Matching (Fallback)
1. Extract project code from Excel row (if available)
2. Match against `Project.code` in database

## Database Schema

Financial data is stored in the `ProjectFinancials` table:

```prisma
model ProjectFinancials {
  id            String   @id @default(cuid())
  projectId     String
  periodStart   DateTime
  periodEnd     DateTime?
  budget        Decimal? @db.Decimal(12, 2)
  forecast      Decimal? @db.Decimal(12, 2)
  actual        Decimal? @db.Decimal(12, 2)
  committed     Decimal? @db.Decimal(12, 2)
  spent         Decimal? @db.Decimal(12, 2)
  variance      Decimal? @db.Decimal(12, 2)
  rawJson       Json?
  sourceFile    String?
  sourceDate    DateTime?
  jobNumber     String?
  projectNumber String?
  matchType     String?
  // ...
  
  @@unique([projectId, periodStart])
}
```

## Error Handling

The service throws errors for:
- Invalid Excel file format
- Missing required columns (job number or project name)
- Invalid `periodStart` date (when `dryRun=false`)
- Database transaction failures

All errors are logged with structured logging for debugging.

## Testing

Run the test suite:

```bash
npx tsx lib/__tests__/costReportIngest.test.ts
```

The test suite covers:
- Dry run ingestion
- Actual ingestion with database updates
- Job number matching
- Name matching
- Database record verification

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (required)
- `NODE_ENV`: Set to `development` for debug logging

## Logging

The service uses a structured logger (`lib/logger.ts`) with the following levels:
- `DEBUG`: Detailed information for debugging
- `INFO`: General information about ingestion progress
- `WARN`: Warnings (e.g., no financial columns detected)
- `ERROR`: Error messages with stack traces

Log level is automatically set based on `NODE_ENV` (DEBUG in development, INFO in production).

## Limitations

- Maximum file size: 50MB (configurable in API route)
- Supported formats: `.xlsx`, `.xls`
- Matching is case-insensitive and uses normalized strings
- Duplicate project matches: Last row wins (deterministic)

## Future Enhancements

- Support for multiple sheets
- Custom column mapping configuration
- Batch processing for large files
- Progress tracking for long-running ingestions
- Email notifications for ingestion completion
- Historical data preservation (archive old financials)


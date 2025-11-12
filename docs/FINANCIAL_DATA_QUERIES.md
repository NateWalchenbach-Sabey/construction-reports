# Financial Data Queries

This document explains how to query historical financial data from the `ProjectFinancials` table for reporting and analysis.

## Database Schema

The `ProjectFinancials` table stores financial data by project and period (week):

- `projectId`: Reference to the Project
- `periodStart`: Monday of the week (start of reporting period)
- `periodEnd`: Sunday of the week (end of reporting period)
- `budget`: Total Budget
- `forecast`: Forecasted Cost @ Completion (EAC)
- `actual`: Actual Costs
- `committed`: Committed Costs
- `spent`: Spent/Invoiced Costs
- `variance`: Variance (Over)/Under
- `jobNumber`: Job Number from cost report (Column A)
- `projectNumber`: Project Number from cost report (Column B)
- `sourceFile`: Source cost report file name
- `sourceDate`: Date from the source cost report
- `matchType`: How the row was matched ("job" or "name")
- `rawJson`: All other financial columns from Excel (JSON)
- `createdAt`: When the record was created
- `updatedAt`: When the record was last updated

**Unique Constraint**: `(projectId, periodStart)` - one record per project per week

## Key Concepts

### Period (Week)
- Each period represents one week
- `periodStart` is always Monday (00:00:00)
- `periodEnd` is always Sunday (23:59:59)
- Financial data is stored once per week per project

### Historical Data
- Each week gets its own record
- Re-uploading a cost report for the same week updates that week's record
- Previous weeks' data is preserved (not overwritten)
- This allows tracking financial changes over time

## SQL Queries

### Get All Financial Data for a Project

```sql
SELECT 
  "periodStart",
  "periodEnd",
  "budget",
  "forecast",
  "actual",
  "committed",
  "spent",
  "variance",
  "jobNumber",
  "projectNumber",
  "sourceFile",
  "sourceDate",
  "matchType",
  "createdAt",
  "updatedAt"
FROM "ProjectFinancials" 
WHERE "projectId" = 'your-project-id-here' 
ORDER BY "periodStart" ASC;
```

### Get Financial Data for a Date Range

```sql
SELECT 
  "periodStart",
  "periodEnd",
  "budget",
  "forecast",
  "variance",
  "jobNumber",
  "projectNumber",
  "sourceFile",
  "sourceDate"
FROM "ProjectFinancials" 
WHERE "projectId" = 'your-project-id-here' 
  AND "periodStart" >= '2025-10-01' 
  AND "periodStart" <= '2025-10-31'
ORDER BY "periodStart" ASC;
```

### Get Latest Financial Data for All Projects

```sql
SELECT DISTINCT ON ("projectId") 
  p."code" as project_code,
  p."name" as project_name,
  pf."projectId", 
  pf."periodStart", 
  pf."budget", 
  pf."forecast", 
  pf."variance",
  pf."jobNumber",
  pf."projectNumber",
  pf."sourceFile",
  pf."sourceDate"
FROM "ProjectFinancials" pf
JOIN "Project" p ON p."id" = pf."projectId"
ORDER BY "projectId", "periodStart" DESC;
```

### Get Financial Data by Source File

```sql
SELECT 
  p."code" as project_code,
  p."name" as project_name,
  pf."periodStart",
  pf."budget",
  pf."forecast",
  pf."variance",
  pf."jobNumber",
  pf."projectNumber"
FROM "ProjectFinancials" pf
JOIN "Project" p ON p."id" = pf."projectId"
WHERE pf."sourceFile" LIKE '%Cost Report Summary 10.15.25.xlsx%'
ORDER BY p."name", pf."periodStart" ASC;
```

### Get All Projects with Financial Data in a Date Range

```sql
SELECT 
  p."code" as project_code,
  p."name" as project_name,
  pf."periodStart",
  pf."periodEnd",
  pf."budget",
  pf."forecast",
  pf."variance",
  pf."jobNumber",
  pf."projectNumber",
  pf."sourceFile",
  pf."sourceDate"
FROM "ProjectFinancials" pf
JOIN "Project" p ON p."id" = pf."projectId"
WHERE pf."periodStart" >= '2025-10-01' 
  AND pf."periodStart" <= '2025-10-31'
ORDER BY p."name", pf."periodStart" ASC;
```

### Get Financial Trends (Budget vs Forecast Over Time)

```sql
SELECT 
  "periodStart",
  "budget",
  "forecast",
  "variance",
  ("forecast" - "budget") as calculated_variance
FROM "ProjectFinancials" 
WHERE "projectId" = 'your-project-id-here' 
  AND "budget" IS NOT NULL 
  AND "forecast" IS NOT NULL
ORDER BY "periodStart" ASC;
```

### Get Projects with Budget Variances

```sql
SELECT 
  p."code" as project_code,
  p."name" as project_name,
  pf."periodStart",
  pf."budget",
  pf."forecast",
  pf."variance",
  CASE 
    WHEN pf."variance" > 0 THEN 'Over Budget'
    WHEN pf."variance" < 0 THEN 'Under Budget'
    ELSE 'On Budget'
  END as status
FROM "ProjectFinancials" pf
JOIN "Project" p ON p."id" = pf."projectId"
WHERE pf."periodStart" >= '2025-10-01' 
  AND pf."variance" IS NOT NULL
ORDER BY pf."variance" DESC;
```

### Get All Raw JSON Data (Additional Financial Columns)

```sql
SELECT 
  "periodStart",
  "budget",
  "forecast",
  "rawJson"
FROM "ProjectFinancials" 
WHERE "projectId" = 'your-project-id-here' 
  AND "rawJson" IS NOT NULL
ORDER BY "periodStart" DESC
LIMIT 10;
```

## Using the Helper Functions (TypeScript)

### Get Financial Data by Date Range

```typescript
import { getFinancialDataByDateRange } from '@/lib/cost-report-history'

const startDate = new Date('2025-10-01')
const endDate = new Date('2025-10-31')
const financialData = await getFinancialDataByDateRange(projectId, startDate, endDate)
```

### Get Financial Data for a Specific Period

```typescript
import { getFinancialDataByPeriod } from '@/lib/cost-report-history'

const periodDate = new Date('2025-10-15')
const financialData = await getFinancialDataByPeriod(projectId, periodDate)
```

### Get Project Financial History

```typescript
import { getProjectFinancialHistory } from '@/lib/cost-report-history'

const history = await getProjectFinancialHistory(projectId)
// Returns all financial periods for the project in chronological order
```

### Get All Projects' Financial Data for a Date Range

```typescript
import { getAllProjectsFinancialDataByDateRange } from '@/lib/cost-report-history'

const startDate = new Date('2025-10-01')
const endDate = new Date('2025-10-31')
const allProjectsData = await getAllProjectsFinancialDataByDateRange(startDate, endDate)

// Optionally filter by specific projects
const specificProjects = await getAllProjectsFinancialDataByDateRange(
  startDate, 
  endDate, 
  ['project-id-1', 'project-id-2']
)
```

### Get Latest Financial Data

```typescript
import { getLatestFinancialData } from '@/lib/cost-report-history'

const latest = await getLatestFinancialData(projectId)
```

## Using Prisma Client Directly

```typescript
import { prisma } from '@/lib/prisma'

// Get financial data for a project
const financials = await prisma.projectFinancials.findMany({
  where: {
    projectId: 'your-project-id',
    periodStart: {
      gte: new Date('2025-10-01'),
      lte: new Date('2025-10-31'),
    },
  },
  orderBy: {
    periodStart: 'asc',
  },
  include: {
    project: {
      select: {
        code: true,
        name: true,
      },
    },
  },
})
```

## Important Notes

1. **Period Start is Always Monday**: All periods start on Monday (00:00:00) of that week
2. **One Record Per Week**: Each project can have one financial record per week (unique constraint)
3. **Updates Overwrite**: Re-uploading a cost report for the same week updates that week's record
4. **Historical Preservation**: Previous weeks' data is never overwritten
5. **Source Tracking**: Each record includes `sourceFile` and `sourceDate` to track which cost report it came from
6. **Raw Data Available**: All additional financial columns are stored in `rawJson` for future use

## Examples

### Export Financial Data to CSV

```sql
-- Export to CSV (PostgreSQL)
\copy (
  SELECT 
    p."code",
    p."name",
    pf."periodStart",
    pf."budget",
    pf."forecast",
    pf."variance",
    pf."jobNumber",
    pf."projectNumber"
  FROM "ProjectFinancials" pf
  JOIN "Project" p ON p."id" = pf."projectId"
  WHERE pf."periodStart" >= '2025-10-01' 
    AND pf."periodStart" <= '2025-10-31'
  ORDER BY p."name", pf."periodStart" ASC
) TO '/tmp/financial_data.csv' WITH CSV HEADER;
```

### Generate Financial Report for a Month

```sql
SELECT 
  p."code" as project_code,
  p."name" as project_name,
  COUNT(pf."id") as weeks_with_data,
  AVG(pf."budget") as avg_budget,
  AVG(pf."forecast") as avg_forecast,
  AVG(pf."variance") as avg_variance,
  MAX(pf."forecast") as max_forecast,
  MIN(pf."forecast") as min_forecast
FROM "ProjectFinancials" pf
JOIN "Project" p ON p."id" = pf."projectId"
WHERE pf."periodStart" >= '2025-10-01' 
  AND pf."periodStart" <= '2025-10-31'
GROUP BY p."id", p."code", p."name"
ORDER BY p."name";
```


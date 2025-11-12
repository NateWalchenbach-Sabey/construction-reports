# Project Filtering in Cost Report Ingestion

## Overview

The cost report ingestion system **only processes projects that exist in your database**. This ensures that:

1. **Only tracked projects are stored** - Financial data is only saved for projects you're actively tracking
2. **No unnecessary data** - Projects from the cost report that aren't in your database are completely ignored
3. **Database is the source of truth** - Your database defines which projects to track, not the cost report

## How It Works

### 1. Load Projects from Database (Source of Truth)

```typescript
// Only projects in the database are loaded
const projectMap = await loadProjectsForMatching()
// This creates a map indexed by:
// - Job number (if available)
// - Project name (normalized)
// - Project code
```

**Key Point**: The database is loaded FIRST, before processing any Excel rows.

### 2. Process Excel Rows

For each row in the cost report Excel file:

1. Extract job number, project number, and project name from the row
2. **Attempt to match** the row to a project in the database
3. **If matched**: Process and store financial data
4. **If not matched**: Skip the row (not stored in database)

### 3. Matching Logic

The system tries to match Excel rows to database projects in this order:

1. **Job Number Match** (most reliable)
   - Extracts job number from Excel row (Column A)
   - Normalizes and matches against `Project.jobNumber` in database
   
2. **Project Name Match** (fallback)
   - Normalizes project name (lowercase, remove punctuation)
   - Matches against `Project.name` in database
   
3. **Project Code Match** (fallback)
   - Matches project number (Column B) against `Project.code` in database

### 4. Storage

**Only matched rows are stored**:
- Financial data is upserted to `ProjectFinancials` table
- Only for projects that exist in the database
- Unmatched rows are tracked in the response but **not stored**

## Example

### Scenario

- **Database has**: 25 projects
- **Cost report has**: 100 projects (including the 25 tracked projects + 75 other projects)

### What Happens

1. System loads 25 projects from database
2. System processes all 100 rows from cost report
3. System matches 25 rows to database projects
4. System stores financial data for only those 25 matched projects
5. System skips the other 75 rows (not stored in database)

### Result

- **25 projects updated** in `ProjectFinancials` table
- **75 projects ignored** (not stored)
- **No unnecessary data** in the database

## Logging

The ingestion process logs detailed information about filtering:

```
INFO: Project filtering initialized
  totalProjectsInDatabase: 25
  message: "Only projects in the database will be processed. All other cost report rows will be skipped."

INFO: Row processing complete - Database filtering applied
  totalExcelRows: 100
  totalProjectsInDatabase: 25
  matchedByJob: 20
  matchedByName: 5
  matchedTotal: 25
  unmatched: 75
  skippedRows: 0
  message: "Only 25 rows matched projects in database. 75 rows from cost report were skipped (projects not tracked in database)."
```

## API Response

The ingestion API returns a summary that shows:

```json
{
  "success": true,
  "summary": {
    "matchedByJob": 20,
    "matchedByName": 5,
    "unmatched": 75,
    "totalRows": 100,
    "projectsUpdated": 25,
    "totalExcelRows": 100,
    "totalProjectsInDatabase": 25
  },
  "unmatchedRows": [
    {
      "jobNumber": "UNTRACKED-JOB",
      "projectNumber": "UNTRACKED-PROJ",
      "projectName": "Untracked Project",
      "financials": { ... }
    }
    // ... 74 more unmatched rows
  ]
}
```

**Important**: `unmatchedRows` are included in the response for debugging/review, but they are **NOT stored in the database**.

## Adding New Projects

If you want to track a new project from the cost report:

1. **Add the project to the database first**:
   ```sql
   INSERT INTO "Project" (id, code, name, region, ...)
   VALUES ('new-project-id', 'PROJ-CODE', 'Project Name', 'QUINCY', ...);
   ```

2. **Re-upload the cost report**:
   - The ingestion will now match the new project
   - Financial data will be stored for the new project

## Verification

### Check Which Projects Were Processed

```sql
-- Get all projects that have financial data
SELECT DISTINCT 
  p."code",
  p."name",
  COUNT(pf."id") as financial_records
FROM "ProjectFinancials" pf
JOIN "Project" p ON p."id" = pf."projectId"
GROUP BY p."id", p."code", p."name"
ORDER BY p."name";
```

### Check Unmatched Projects from Cost Report

The ingestion response includes `unmatchedRows` which shows projects from the cost report that weren't in the database. Review these to identify projects you might want to add.

## Benefits

1. **Clean Database**: Only relevant projects are stored
2. **Performance**: Faster queries (less data to process)
3. **Cost Control**: No storage waste on untracked projects
4. **Data Integrity**: Database defines what to track, not the cost report
5. **Flexibility**: Easy to add/remove tracked projects

## Configuration

### Filter by Region (Future Enhancement)

You could extend the filtering to only process projects in specific regions:

```typescript
// In loadProjectsForMatching()
const projects = await prisma.project.findMany({
  where: {
    region: { in: ['QUINCY', 'SEATTLE'] }, // Only process these regions
  },
  // ...
})
```

### Filter by Project Status (Future Enhancement)

```typescript
// Only process active projects
const projects = await prisma.project.findMany({
  where: {
    // Add status filter when you have a status field
  },
  // ...
})
```

## Summary

- ✅ **Database is the source of truth** - Only projects in the database are processed
- ✅ **No unnecessary data** - Untracked projects are completely ignored
- ✅ **Clean storage** - Only relevant financial data is stored
- ✅ **Easy to extend** - Add projects to database to start tracking them
- ✅ **Transparent** - Logging shows exactly what was processed and what was skipped


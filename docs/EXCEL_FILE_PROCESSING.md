# Excel File Processing in the Application

## Overview

This document clarifies which Excel files are processed by the application and how they are used.

## Production Excel File Processing

### Cost Report Summary (ONLY Excel file processed in production)

**File Type**: `Cost Report Summary [DATE].xlsx`

**How it's used**:
- Users (ADMIN/PM) upload this file via the UI (`/admin/cost-reports`)
- The file is stored in the database and filesystem
- Financial data (budget, EAC, variance, etc.) is automatically extracted and ingested into the `ProjectFinancials` table
- Data is matched to projects by project number (Column B)
- This is the **ONLY** Excel file that the application automatically processes

**Location**: `/app/api/cost-report/upload/route.ts` and `/lib/costReportIngest.ts`

## One-Time Data Import Scripts (NOT part of production app)

### Weekly Report Excel Files

**File Type**: Individual weekly report Excel files (e.g., `ASH-AB1 10-25 -25 .xlsx`)

**How they were used**:
- These files were provided for **one-time data import only**
- Scripts in `/scripts` folder were used to:
  - Extract project names and project numbers from these files
  - Import them into the database to populate initial project data
- These scripts are **NOT** part of the running application
- They are **NOT** automatically executed
- They were used once during initial setup to populate project numbers

**Scripts** (one-time use only):
- `/scripts/parse-weekly-reports-v2.ts` - Parsed weekly reports to extract project names and numbers
- `/scripts/update-projects-from-weekly-reports-fixed.ts` - Updated database with extracted data
- Other scripts in `/scripts` folder - Various one-time data migration scripts

## Production Workflow

1. **Admin uploads Cost Report Summary** → Excel file is processed → Financial data is ingested
2. **Users create weekly reports** → Data is entered via the web UI (not from Excel files)
3. **Project numbers are managed** → Via the admin UI (`/admin/projects`)

## Notes Field in ProjectProjectNumber

The `notes` field in the `ProjectProjectNumber` table may contain references to weekly report filenames (e.g., "From weekly report: ASH-AB1 10-25 -25 .xlsx"). This is:
- **Metadata from the one-time import** - Not used by the application
- **Can be hidden in the UI** - The application hides these notes in production
- **Can be cleaned up** - These notes are not required for the application to function

## Summary

- ✅ **Cost Report Summary Excel files** - Processed automatically when uploaded
- ❌ **Weekly Report Excel files** - NOT processed by the application (only used for one-time import)
- ✅ **Web UI** - Users create weekly reports via the web interface, not from Excel files


# Project Matching Logic

## Overview

The cost report ingestion system matches Excel rows to database projects using a multi-step process. This document explains how matching works and how to troubleshoot matching issues.

## Matching Priority Order

The system tries to match projects in this order (stops at first successful match):

### 1. Job Number Match (Highest Priority - Most Reliable)

**How it works:**
- Extracts job number from Excel Column A
- Normalizes the job number (lowercase, remove punctuation)
- Matches against `Project.jobNumber` in database

**Example:**
- Excel: Job Number = `"25-8-131-quie6"`
- Database: `Project.jobNumber = "25-8-131-quie6"`
- **Match!** ✅

**Why it's reliable:**
- Job numbers are typically unique identifiers
- Exact matching is possible
- No ambiguity

**Limitations:**
- Requires job numbers to be set in database
- If database projects don't have job numbers, this won't work

### 2. Project Code Match (High Priority - Very Reliable)

**How it works:**
- Extracts project number from Excel Column B
- Also checks if project code appears in job number or project name
- Matches against `Project.code` in database

**Example:**
- Excel: Project Number = `"25-7-131-quie6"` or Job Number contains `"QUI-E6"`
- Database: `Project.code = "QUI-E6"`
- **Match!** ✅

**Why it's reliable:**
- Project codes are typically consistent identifiers
- Can match even if names differ
- Flexible matching (partial matches, code parts)

**Matching strategies:**
1. **Exact match**: Project number contains project code or vice versa
2. **Code in job number**: Project code appears in job number from Excel
3. **Code in name**: Project code appears in project name from Excel
4. **Code parts match**: Significant parts of project code match (e.g., "ASH", "QUI", "SEA")

### 3. Project Name Match (Lower Priority - Less Reliable)

**How it works:**
- Extracts project name from Excel Column C
- Normalizes both Excel name and database name
- Tries multiple matching strategies

**Matching strategies:**

#### 3a. Exact Normalized Match
- Normalizes both names (lowercase, remove punctuation, collapse whitespace)
- Compares normalized strings

**Example:**
- Excel: `"SDC-QUI-E6 Zoho Office Exp LLO"`
- Normalized: `"sdc quie6 zoho office exp llo"`
- Database: `"SDC-QUI-E6 Zoho Office Exp LLO"`
- Normalized: `"sdc quie6 zoho office exp llo"`
- **Match!** ✅

#### 3b. Name Parts Match
- Splits names into parts (e.g., "SDC-QUI-E6" → ["sdc", "qui", "e6"])
- Removes "SDC-" prefix
- Checks if all distinguishing parts match

**Example:**
- Excel: `"SDC-QUI-E6 Zoho Office Exp LLO"`
- Parts: `["qui", "e6", "zoho", "office", "exp", "llo"]`
- Distinguishing parts: `["e6"]`
- Database: `"SDC-QUI-E6 Project"`
- Parts: `["qui", "e6", "project"]`
- Distinguishing parts: `["e6"]`
- **Match!** ✅ (both have "e6")

#### 3c. Substring Match (Low Confidence)
- Checks if one name contains the other
- Only used if no distinguishing parts exist

**Example:**
- Excel: `"Building A Renovation"`
- Database: `"Office Building A Renovation Project"`
- **Match!** ✅ (database name contains Excel name)

## Common Matching Issues

### Issue 1: Names Don't Match

**Problem:**
- Database: `"UPS Replacement Project"`
- Excel: `"SDC-ASH Building A 54MW Design LLO"`
- Names are completely different

**Solution:**
- Use project codes instead of names
- Set job numbers in database
- The system will try project code matching automatically

### Issue 2: Job Numbers Not Set

**Problem:**
- Database projects don't have `jobNumber` set
- Job number matching fails

**Solution:**
- The system automatically updates job numbers when matched by job number
- For existing projects, you may need to manually set job numbers
- Or rely on project code matching

### Issue 3: Project Codes Don't Match

**Problem:**
- Database: `Project.code = "SDC-SEA-53"`
- Excel: Project Number = `"22-3-302"`
- Codes don't match

**Solution:**
- Check if project code appears in job number or name
- The system checks multiple places for project code
- You may need to update project codes in database to match Excel

## Improving Matching

### 1. Set Job Numbers in Database

The most reliable way to match is by job number:

```sql
-- Update project with job number from cost report
UPDATE "Project" 
SET "jobNumber" = '25-8-131-quie6'
WHERE "code" = 'QUI-E6';
```

### 2. Ensure Project Codes Match

Project codes should match between database and Excel:

```sql
-- Check project codes
SELECT "code", "name", "jobNumber" 
FROM "Project" 
ORDER BY "code";
```

### 3. Use Diagnostics Tool

Run the diagnostics tool to see what's matching and what's not:

```bash
# Upload cost report to diagnostics endpoint
curl -X POST http://localhost:3000/api/cost-report/diagnostics \
  -F "file=@Cost Report Summary 10.15.25.xlsx"
```

This will show:
- Which projects match (and why)
- Which projects don't match
- Suggested fixes

## Matching Examples

### Example 1: Job Number Match

**Excel:**
- Job Number: `"25-8-131-quie6"`
- Project Number: `"25-7-131-quie6"`
- Project Name: `"SDC-QUI-E6 Zoho Office Exp LLO"`

**Database:**
- Code: `"QUI-E6"`
- Name: `"SDC-QUI-E6 Zoho Office Exp LLO"`
- Job Number: `"25-8-131-quie6"`

**Match:** ✅ Job number exact match

### Example 2: Project Code Match

**Excel:**
- Job Number: `"24-8-013-ashasi"`
- Project Number: `"24-3-013-ashasi"`
- Project Name: `"SDC-ASH-A Site LLO"`

**Database:**
- Code: `"ASH-A"`
- Name: `"ASH Building A"`
- Job Number: `null`

**Match:** ✅ Project code "ASH-A" appears in job number "24-8-013-ashasi"

### Example 3: Name Parts Match

**Excel:**
- Job Number: `"22-8-502"`
- Project Number: `"22-3-302"`
- Project Name: `"SDC-ASH Building A 54MW Design LLO"`

**Database:**
- Code: `"ASH-DC-12"`
- Name: `"ASH Building A Project"`
- Job Number: `null`

**Match:** ✅ Name parts match: "ASH" and "Building A" in both names

### Example 4: No Match

**Excel:**
- Job Number: `"99-9-999"`
- Project Number: `"99-9-999"`
- Project Name: `"Unknown Project"`

**Database:**
- No project with matching job number, code, or name

**Match:** ❌ No match - row will be skipped (not stored in database)

## Troubleshooting

### Check What's Matching

1. **Enable debug logging:**
   ```typescript
   // In costReportIngest.ts
   logger.setLevel(LogLevel.DEBUG)
   ```

2. **Check ingestion response:**
   ```json
   {
     "summary": {
       "matchedByJob": 20,
       "matchedByName": 5,
       "unmatched": 75
     },
     "unmatchedRows": [...]
   }
   ```

3. **Run diagnostics:**
   - Use `/api/cost-report/diagnostics` endpoint
   - Shows detailed matching information
   - Identifies why projects aren't matching

### Fix Matching Issues

1. **Add job numbers to database:**
   ```sql
   UPDATE "Project" 
   SET "jobNumber" = 'excel-job-number'
   WHERE "code" = 'project-code';
   ```

2. **Update project codes:**
   ```sql
   UPDATE "Project" 
   SET "code" = 'excel-project-code'
   WHERE "id" = 'project-id';
   ```

3. **Update project names (if needed):**
   ```sql
   UPDATE "Project" 
   SET "name" = 'excel-project-name'
   WHERE "id" = 'project-id';
   ```

## Best Practices

1. **Set job numbers:** Most reliable matching method
2. **Keep project codes consistent:** Should match between database and Excel
3. **Use descriptive names:** But don't rely solely on names for matching
4. **Run diagnostics:** Before ingesting, check what will match
5. **Review unmatched rows:** After ingestion, check what didn't match

## Summary

- **Job Number Match:** Most reliable (if job numbers are set)
- **Project Code Match:** Very reliable (works even if names differ)
- **Project Name Match:** Less reliable (names often differ)
- **Database is source of truth:** Only matched projects are processed
- **Use diagnostics:** To identify and fix matching issues


# Project Matching Summary

## How Projects Are Matched

The system matches Excel cost report rows to database projects using **three methods in priority order**:

### 1. Job Number Match (Most Reliable) ✅
- **What:** Matches job number from Excel Column A to `Project.jobNumber` in database
- **When it works:** When database projects have job numbers set
- **Why it's best:** Job numbers are unique identifiers, exact matching

### 2. Project Code Match (Very Reliable) ✅
- **What:** Matches project code from Excel (Column B, job number, or name) to `Project.code` in database
- **When it works:** When project codes appear in Excel data (even if names differ)
- **Why it's good:** Project codes are consistent identifiers, works even when names don't match

**Matching strategies:**
- Project number (Column B) contains project code
- Job number contains project code (e.g., "24-8-013-ashasi" contains "ASH")
- Project name contains project code (e.g., "SDC-ASH Building A" contains "ASH")
- Project code parts match (e.g., "ASH", "QUI", "SEA" appear in Excel data)

### 3. Project Name Match (Less Reliable) ⚠️
- **What:** Matches normalized project names
- **When it works:** When names are similar (after normalization)
- **Why it's less reliable:** Names often differ between database and Excel

**Matching strategies:**
- Exact normalized match (after removing punctuation, lowercasing)
- Name parts match (e.g., "QUI-E6" matches "SDC-QUI-E6 Zoho Office")
- Substring match (one name contains the other)

## Why Names Don't Match

**Database names are often generic:**
- `"UPS Replacement Project"`
- `"Office Renovation"`
- `"Warehouse Expansion"`

**Excel names are often detailed:**
- `"SDC-ASH Building A 54MW Design LLO"`
- `"SDC-QUI-E6 Zoho Office Exp LLO"`
- `"SDC-ASH-A Site LLO"`

**Solution:** Use project codes or job numbers instead of names for matching.

## Current Matching Status

Based on your data:

### Database Projects
- Most don't have job numbers set (`jobNumber: null`)
- Project codes like `"SDC-SEA-53"`, `"IGQ-QUI-E1"`, `"ASH-DC-12"`
- Generic names like `"UPS Replacement Project"`, `"9MW LLO Project"`

### Excel Projects
- Job numbers like `"24-8-013-ashasi"`, `"25-8-131-quie6"`
- Project numbers like `"24-3-013-ashasi"`, `"25-7-131-quie6"`
- Detailed names like `"SDC-ASH-A Site LLO"`, `"SDC-QUI-E6 Zoho Office Exp LLO"`

### Matching Results
- **Job number match:** ❌ Won't work (database projects don't have job numbers)
- **Project code match:** ✅ Should work (project codes like "ASH", "QUI" appear in Excel data)
- **Name match:** ⚠️ Might work for some (if name parts match)

## How to Improve Matching

### Option 1: Set Job Numbers in Database (Best)

Update database projects with job numbers from Excel:

```sql
-- Example: Update project with job number
UPDATE "Project" 
SET "jobNumber" = '25-8-131-quie6'
WHERE "code" = 'QUI-E6';
```

### Option 2: Ensure Project Codes Match (Good)

Make sure project codes in database match patterns in Excel:

```sql
-- Check project codes
SELECT "code", "name", "jobNumber" 
FROM "Project" 
ORDER BY "code";

-- Update if needed
UPDATE "Project" 
SET "code" = 'ASH-A'
WHERE "code" = 'ASH-DC-12';
```

### Option 3: Use Diagnostics Tool

Run the diagnostics tool to see what's matching:

```bash
curl -X POST http://localhost:3000/api/cost-report/diagnostics \
  -F "file=@Cost Report Summary 10.15.25.xlsx"
```

This will show:
- Which projects match (and why)
- Which projects don't match
- Suggested fixes

## What Gets Stored

**Only matched projects are stored:**
- If a project matches → Financial data is stored in `ProjectFinancials`
- If a project doesn't match → Row is skipped (not stored)

**This ensures:**
- Only tracked projects have financial data
- No unnecessary data in database
- Database is the source of truth

## Next Steps

1. **Run diagnostics** to see current matching status
2. **Set job numbers** in database for better matching
3. **Verify project codes** match between database and Excel
4. **Review unmatched rows** to identify projects that need to be added to database

## Example: Improving Matching

### Before (No Job Numbers)
```
Database: Project.code = "QUI-E6", jobNumber = null
Excel: Job Number = "25-8-131-quie6", Project Number = "25-7-131-quie6"
Match: ❌ Job number match fails (no job number in DB)
Match: ✅ Project code match works ("QUI-E6" appears in job number)
Result: ✅ Matches by project code
```

### After (With Job Numbers)
```
Database: Project.code = "QUI-E6", jobNumber = "25-8-131-quie6"
Excel: Job Number = "25-8-131-quie6", Project Number = "25-7-131-quie6"
Match: ✅ Job number match works (exact match)
Result: ✅ Matches by job number (more reliable)
```

## Summary

- **Job numbers:** Most reliable (set them in database)
- **Project codes:** Very reliable (already works if codes match)
- **Project names:** Less reliable (names often differ)
- **Database is source of truth:** Only matched projects are processed
- **Use diagnostics:** To identify and fix matching issues


# Weekly Report Workflow & Storage

## How Reports Are Stored

When a user completes a weekly report:

1. **Report Creation**: Users fill out the report form via `/reports/new` or `/projects/[id]/reports/new`
2. **Database Storage**: Reports are stored in the `Report` table with:
   - `projectId`: Links to the project
   - `reportDate`: The date of the report (typically Friday for weekly reports)
   - `reportType`: Set to `WEEKLY` (default) or `DAILY`
   - `workPerformed`: Narrative text
   - `safety`: Safety information
   - `totalTradeWorkers`: Calculated sum of all subcontractor activities
   - `architect`: Auto-populated from last report
   - `sabeyProjectStaff`: Array of staff names
   - `authorId`: User who created the report
   - `createdAt` / `updatedAt`: Timestamps for archiving
   - `source`: Tracks where data came from (e.g., "manual_entry")

3. **Subcontractor Activities**: Each activity is stored in `ReportSubcontractorActivity` table with:
   - `reportId`: Links to the parent report
   - `subcontractorId`: The subcontractor company
   - `craftId`: The craft/trade
   - `tradeWorkers`: Number of workers
   - `notes`: Additional notes

## Weekly Report Tracking

### Report Status Page (`/reports/status`)
- Shows which projects have submitted weekly reports for a given week
- Displays completion percentage
- Lists pending projects
- Shows who submitted each report and when

### Weekly Summary Page (`/reports/weekly-summary`)
- Shows a warning banner if reports are incomplete
- Displays report status at the top
- Aggregates all project data for the selected week
- Only shows data from projects that have submitted reports

## Workflow

1. **End of Week / Weekend**: PMs and Superintendents fill out weekly reports
2. **Report Submission**: Each project submits one weekly report (reportType: 'WEEKLY')
3. **Status Tracking**: The system tracks which projects have submitted:
   - Green checkmark = Report submitted
   - Red X = Report pending
4. **Weekly Summary Generation**: 
   - Available once all reports are in (or can be viewed with incomplete data warning)
   - Aggregates data from all submitted reports
   - Generates AI executive summary
   - Creates visualizations (timeline, charts)

## Archive Data

All reports are automatically archived:
- `createdAt`: When the report was first created
- `updatedAt`: When the report was last modified
- Reports are never deleted, only updated
- Historical data is preserved for all past weeks

## Database Schema

Reports are stored in:
- `Report` table: Main report data
- `ReportSubcontractorActivity` table: Subcontractor activities per report
- `ReportAttachment` table: File attachments (if any)
- `ReportCustomFieldValue` table: Custom field values (if any)

All tables have proper indexes on `reportDate` and `projectId` for efficient querying.


# Cost Report Storage System

## Overview

The cost report storage system provides a structured way to upload, store, and manage cost report Excel files. It ensures historical data is preserved while making it easy for users to upload new cost reports.

## Features

1. **File Upload Interface**: Easy-to-use web interface for uploading cost report files
2. **Database Tracking**: All uploaded files are tracked in the database with metadata
3. **Historical Preservation**: Old cost reports are kept for historical reference
4. **Date-based Lookup**: System automatically uses the correct cost report based on report date
5. **Active Report Management**: Only one cost report is active at a time (latest upload)

## How It Works

### File Storage

- **Upload Directory**: `uploads/cost-reports/`
- **File Naming**: Files are stored with timestamps to prevent overwrites
- **Original Filename**: Original filename is preserved in the database

### Database Schema

The `CostReport` model tracks:
- Original filename
- File path on disk
- File size
- Report date (extracted from filename)
- Upload timestamp
- Active status
- Uploader information

### Active Report System

- When a new cost report is uploaded, it becomes the "active" report
- Previous reports are marked as inactive but remain in the system
- The active report is used for new weekly reports
- Historical reports use the cost report that was active at that time

## Usage

### Uploading a Cost Report

1. Navigate to `/admin/cost-reports` (ADMIN/PM only)
2. Click "Select Cost Report File"
3. Choose your Excel file (`.xlsx` or `.xls`)
4. Click "Upload Cost Report"
5. The file is automatically processed and becomes the active report

### File Naming

For best results, name your files with dates:
- `Cost Report Summary 10.15.25.xlsx`
- `Cost Report Summary 11.15.25.xlsx`
- `Cost Report Summary 12.15.25.xlsx`

The system will extract the date from the filename automatically.

### Creating Weekly Reports

When creating a weekly report:
1. The system automatically loads cost data from the active cost report
2. Budget and EAC values are populated automatically
3. The cost data is saved as a snapshot with the report (historical data doesn't change)

### Historical Reports

When viewing or editing historical reports:
1. The system finds the cost report that was active at the time of that report
2. Historical cost data remains unchanged (snapshots are preserved)

## API Endpoints

### Upload Cost Report
```
POST /api/cost-report/upload
Content-Type: multipart/form-data
Body: { file: File }
```

### List Cost Reports
```
GET /api/cost-report/upload?includeInactive=true
```

### Get Cost Data for Project
```
GET /api/cost-report?projectId=<id>&reportDate=<date>
```

## File Structure

```
construction-reports/
├── uploads/
│   └── cost-reports/
│       ├── Cost_Report_Summary_10.15.25_1697234567890.xlsx
│       ├── Cost_Report_Summary_11.15.25_1700000000000.xlsx
│       └── Cost_Report_Summary_12.15.25_1702000000000.xlsx
└── ...
```

## Benefits

1. **Easy Upload**: Simple web interface, no need to manually place files
2. **Historical Accuracy**: Each report has its own cost data snapshot
3. **No Data Loss**: Old cost reports are preserved for reference
4. **Automatic Matching**: System finds the right cost report based on date
5. **User-Friendly**: Clear interface showing which report is active

## Migration from Legacy System

If you have existing cost report files in the project root:
1. Upload them through the new interface
2. The system will automatically use uploaded files
3. Legacy files in the root directory are still supported as fallback

## Best Practices

1. **Upload Monthly**: Upload cost reports as they become available
2. **Use Descriptive Names**: Include dates in filenames for easy identification
3. **Don't Delete**: Let the system manage files (don't manually delete from disk)
4. **Check Active Report**: Verify the correct report is active before creating reports

## Troubleshooting

### File Not Found Error
- Ensure you've uploaded a cost report file
- Check that the file exists in `uploads/cost-reports/`
- Verify file permissions

### No Match Found
- Check that the Job Number in the cost report matches your project
- Verify project name matches (case-insensitive partial matching)
- Check the cost report upload interface for suggestions

### Date Extraction Issues
- Ensure filename includes a date in format: `MM.DD.YY` or `MM-DD-YY`
- Manually verify the extracted date in the cost reports list


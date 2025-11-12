# How to View Your Database

## Option 1: Prisma Studio (Visual Interface) - RECOMMENDED

**Prisma Studio is already running!** It provides a beautiful web interface to view and edit your database.

### Access Prisma Studio:

1. **From your SSH server (directly):**
   - Open: `http://localhost:5555` or `http://localhost:5556`

2. **From your laptop (via SSH port forwarding):**
   ```bash
   ssh -L 0.0.0.0:5555:localhost:5555 your-username@your-server-ip
   ```
   Then open: `http://localhost:5555` on your laptop

3. **From your phone:**
   - After setting up port forwarding on your laptop (see above)
   - Use: `http://[your-laptop-ip]:5555`

### What you'll see in Prisma Studio:
- **User** - All user accounts
- **Project** - All construction projects
- **Report** - All weekly reports
- **ReportSubcontractorActivity** - Activity data for each report
- **SubcontractorCompany** - Subcontractor companies
- **Craft** - Trade/craft types
- **ProjectAssignment** - User-project assignments
- And more...

You can:
- ✅ Browse all tables
- ✅ View records
- ✅ Edit data
- ✅ Add new records
- ✅ Delete records
- ✅ Filter and search

---

## Option 2: Direct SQL Queries

### Quick Data Overview:

```bash
cd /home/nwalchenbach/construction-reports
psql postgresql://construction_user:construction_password@localhost:5432/construction_reports
```

Then run SQL queries like:

```sql
-- See all projects
SELECT code, name, region, "projectBudget" FROM "Project" ORDER BY name;

-- See all reports with project info
SELECT r."reportDate", p.code, p.name, r."totalTradeWorkers" 
FROM "Report" r 
JOIN "Project" p ON r."projectId" = p.id 
ORDER BY r."reportDate" DESC 
LIMIT 10;

-- Count reports per project
SELECT p.code, p.name, COUNT(r.id) as report_count
FROM "Project" p
LEFT JOIN "Report" r ON p.id = r."projectId"
GROUP BY p.id, p.code, p.name
ORDER BY report_count DESC;

-- See all users
SELECT email, name, role FROM "User";
```

---

## Option 3: Restart Prisma Studio (if needed)

If Prisma Studio isn't running:

```bash
cd /home/nwalchenbach/construction-reports
npx prisma studio
```

This will start it on `http://localhost:5555`

---

## Your Current Database Contents

**Current Data:**
- ✅ **25 Projects** - Construction projects across different regions
- ✅ **47 Reports** - Weekly reports created
- ✅ **3 Users** - User accounts (Admin, Superintendent, PM)
- ✅ **102 Subcontractors** - Subcontractor companies
- ✅ **392 Activities** - Subcontractor activities across reports

**Sample Projects:**
- SDC-SEA-53: UPS Replacement Project (SEATTLE)
- IGQ-QUI-E1: 9MW LLO Project (QUINCY)
- ASH-DC-12: Office Renovation (ASHBURN)
- AUS-TX-78: Warehouse Expansion (AUSTIN)
- COL-MO-99: Retail Outlet (COLUMBIA)

---

## Database Schema Overview

Your database contains:

### Core Tables:
- **User** - User accounts (Superintendents, PMs, Executives, Admins)
- **Project** - Construction projects with budgets, dates, regions
- **Report** - Weekly reports for each project
- **ReportSubcontractorActivity** - Activities performed by subcontractors

### Reference Tables:
- **SubcontractorCompany** - Subcontractor companies
- **Craft** - Trade types (Electrical, Plumbing, etc.)
- **SubcontractorCraft** - Which crafts each subcontractor does
- **SubcontractorContact** - Contact info for subcontractors

### Supporting Tables:
- **ProjectAssignment** - Links users to projects
- **ProjectCustomField** / **ProjectCustomFieldValue** - Custom project fields
- **ReportCustomField** / **ReportCustomFieldValue** - Custom report fields
- **ReportAttachment** - File attachments for reports
- **ActivityLog** - Audit log of user actions
- **ImportMapping** - Data import templates

---

## Quick Commands

```bash
# View database connection info
cd /home/nwalchenbach/construction-reports
cat .env | grep DATABASE_URL

# Open Prisma Studio
npx prisma studio

# Run a quick query (using Prisma)
npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.project.count().then(c => { console.log('Projects:', c); p.\$disconnect(); });"

# Or using psql directly
psql postgresql://construction_user:construction_password@localhost:5432/construction_reports -c "SELECT COUNT(*) FROM \"Project\";"
```


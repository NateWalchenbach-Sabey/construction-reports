# Testing Guide

This guide will help you test the Construction Reports application.

## Prerequisites Check

Before testing, ensure you have:

1. ✅ Node.js installed (20.9.0+ recommended)
2. ✅ PostgreSQL database running
3. ✅ Environment variables configured
4. ✅ Database schema created
5. ✅ Seed data loaded

## Step 1: Verify Environment Setup

Check your `.env` file contains:
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/construction_reports?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"
```

## Step 2: Set Up Database

Run these commands in order:

```bash
# 1. Generate Prisma Client
npm run db:generate

# 2. Create database tables (if not already done)
npm run db:push

# 3. Seed sample data
npm run db:seed
```

Expected output:
- ✅ Prisma Client generated
- ✅ Database schema created
- ✅ Sample users, projects, and reports created

## Step 3: Start the Development Server

```bash
npm run dev
```

You should see:
```
✓ Ready in X.Xs
○ Local:        http://localhost:3000
```

## Step 4: Test Login

Open http://localhost:3000 in your browser.

You should be redirected to `/login`. Test with these accounts:

### Admin Account
- **Email**: `admin@example.com`
- **Password**: `admin123`
- **Access**: Full system access

### Superintendent Account
- **Email**: `super1@example.com`
- **Password**: `super123`
- **Access**: Can create/edit reports for assigned projects

### Project Manager Account
- **Email**: `pm1@example.com`
- **Password**: `pm123`
- **Access**: Financial fields, project management

## Step 5: Test Core Features

### A. Dashboard (Home Page)

After login, you should see:
- ✅ Project cards with region badges
- ✅ Progress bars showing % complete
- ✅ Budget vs EAC comparison
- ✅ Trade worker counts
- ✅ Region filter dropdown
- ✅ Search functionality

**Test Actions:**
1. Click on a project card → Should navigate to project overview
2. Filter by region → Projects should filter
3. Search for a project name → Results should update

### B. Project Overview

Navigate to any project (e.g., "UPS Replacement Project").

You should see:
- ✅ Project facts panel (dates, budget, EAC, variance)
- ✅ Reports list (time-ordered)
- ✅ Trade workers trend chart
- ✅ Craft mix bar chart

**Test Actions:**
1. Click "New Report" button → Should open report editor
2. Click on an existing report → Should open report editor
3. Verify charts show data (if reports exist)

### C. Report Editor

**Creating a New Report:**
1. Click "New Report" from project overview
2. Fill in:
   - Report Date: Select today's date
   - Report Type: Choose Daily or Weekly
3. Add Subcontractor Activities:
   - Click "+ Add Activity"
   - Select Company (e.g., "ABC Electric")
   - Select Craft (e.g., "Electrical")
   - Enter Trade Workers count (e.g., 10)
   - Repeat for multiple activities
4. Add Narratives:
   - Work Performed: "Test work performed today"
   - Safety Type: Select from dropdown
   - Safety Details: "No incidents"
5. Click "Save Report"
6. Should redirect back to project overview

**Editing an Existing Report:**
1. From project overview, click on a report
2. Modify any field
3. Click "Save Report"
4. Verify changes are saved

### D. Excel Import (Admin/PM only)

1. Navigate to `/import` (only visible to Admin/PM)
2. Click "Select Excel File"
3. Choose a sample Excel file (see below for format)
4. Review header mapping:
   - Headers should auto-map to fields
   - Unmapped headers will be listed
5. Select project from dropdown
6. Set report date and type
7. Click "Import Report"
8. Should create report and redirect to project

**Sample Excel Format:**
| Company | Craft | Trade Workers | Work Performed | Safety |
|---------|-------|---------------|----------------|--------|
| ABC Electric | Electrical | 8 | Installed panels | None to report |
| XYZ Mechanical | Mechanical | 6 | Ductwork installation | Tool Box Talk – PPE |

### E. Subcontractors Directory

1. Navigate to `/subcontractors`
2. Should see list of subcontractor companies
3. Test search functionality
4. Verify each card shows:
   - Company name
   - Default crafts
   - Contact information
   - Activity count

## Step 6: Test Role-Based Access

### Superintendent Tests
1. Login as `super1@example.com`
2. Should only see assigned projects
3. Can create/edit reports for assigned projects
4. Cannot access financial fields directly
5. Cannot access `/import` page

### PM Tests
1. Login as `pm1@example.com`
2. Can see all projects
3. Can access financial fields
4. Can access `/import` page
5. Can create new projects (if implemented)

### Admin Tests
1. Login as `admin@example.com`
2. Full access to all features
3. Can manage crafts, regions, etc.

## Step 7: Test Mobile Responsiveness

1. Open browser DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test on different screen sizes:
   - Mobile (375px)
   - Tablet (768px)
   - Desktop (1920px)
4. Verify:
   - Forms are usable on mobile
   - Tables scroll horizontally if needed
   - Navigation works on small screens

## Step 8: Test Data Validation

### Report Validation
- ✅ Try saving report without required fields → Should show errors
- ✅ Enter negative trade workers → Should prevent or warn
- ✅ Enter percent complete > 100 → Should validate

### Project Validation
- ✅ Try creating duplicate project code → Should show error
- ✅ Enter invalid dates → Should validate

## Step 9: Test Calculations

Verify these calculations work correctly:

1. **Budget Variance**:
   - Should be: EAC - Project Budget
   - Green if favorable (negative), Red if overrun (positive)

2. **Total Trade Workers**:
   - Should sum all activity trade workers
   - Display at bottom of activities table

3. **Progress Bar**:
   - Should show % complete visually
   - Should not exceed 100%

## Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify connection string in .env
# Test connection
psql $DATABASE_URL
```

### Prisma Client Not Found
```bash
npm run db:generate
```

### Migration Errors
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or push schema again
npm run db:push
```

### Seed Data Not Loading
```bash
# Check if tables exist
npx prisma studio

# Re-run seed
npm run db:seed
```

### Authentication Issues
- Clear browser cookies
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your dev URL

## Manual Test Checklist

- [ ] Can login with all user roles
- [ ] Dashboard shows projects
- [ ] Can filter by region
- [ ] Can search projects
- [ ] Can view project details
- [ ] Can create new report
- [ ] Can edit existing report
- [ ] Can add multiple subcontractor activities
- [ ] Total trade workers calculates correctly
- [ ] Can import Excel file (Admin/PM)
- [ ] Charts display correctly
- [ ] Mobile layout works
- [ ] Role-based access works
- [ ] Data persists after page refresh

## Automated Testing (Future)

Consider adding:
- Unit tests for utilities
- Integration tests for API routes
- E2E tests with Playwright/Cypress
- Component tests with React Testing Library

## Performance Testing

Check:
- Page load times (< 2s)
- API response times (< 500ms)
- Database query performance
- Large dataset handling (100+ projects)

## Security Testing

Verify:
- Authentication required for protected routes
- Role-based access control works
- SQL injection protection (Prisma handles this)
- XSS protection (React escapes by default)
- CSRF protection (NextAuth handles this)

---

**Happy Testing!** 🚀

If you encounter issues, check the browser console and terminal for error messages.


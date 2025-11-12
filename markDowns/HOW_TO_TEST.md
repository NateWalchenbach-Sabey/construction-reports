# How to Test the App - Step by Step

## Current Status Check

Your `.env` file has a placeholder DATABASE_URL. You need to set up a real database first.

## Option 1: Quick Test with Local PostgreSQL (Recommended)

### Step 1: Set Up PostgreSQL Database

If you have PostgreSQL installed locally:

```bash
# Create database
createdb construction_reports

# Or using psql:
psql -U postgres
CREATE DATABASE construction_reports;
\q
```

### Step 2: Update .env File

Edit `.env` and update DATABASE_URL:
```bash
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/construction_reports?schema=public"
```

Replace:
- `YOUR_USERNAME` with your PostgreSQL username
- `YOUR_PASSWORD` with your PostgreSQL password
- If no password, use: `postgresql://postgres@localhost:5432/construction_reports?schema=public`

### Step 3: Initialize Database

```bash
cd /home/nwalchenbach/construction-reports

# Generate Prisma Client
npm run db:generate

# Create all tables
npm run db:push

# Load sample data
npm run db:seed
```

You should see:
```
✔ Generated Prisma Client
✔ Database tables created
✔ Seed completed successfully!
```

## Option 2: Use Supabase (Free Cloud Database)

### Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Sign up (free tier is fine)
3. Create a new project

### Step 2: Get Connection String
1. Go to Project Settings → Database
2. Copy the "Connection string" (URI format)
3. It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

### Step 3: Update .env
```bash
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres?schema=public"
```

### Step 4: Initialize Database
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

## Step 4: Start the App

```bash
npm run dev
```

You should see:
```
✓ Ready in 2.5s
○ Local:        http://localhost:3000
```

## Step 5: Test in Browser

1. **Open**: http://localhost:3000
2. **Login Page**: You'll be redirected to `/login`
3. **Login Credentials** (after seeding):
   - **Admin**: 
     - Email: `admin@example.com`
     - Password: `admin123`
   - **Superintendent**:
     - Email: `super1@example.com`
     - Password: `super123`
   - **Project Manager**:
     - Email: `pm1@example.com`
     - Password: `pm123`

## Step 6: Quick Test Flow

### Test 1: Dashboard
- ✅ Should see 6 project cards
- ✅ Try filtering by region
- ✅ Try searching for a project name
- ✅ Click on a project card

### Test 2: Project Overview
- ✅ Should see project details
- ✅ Should see reports list (5 reports for first project)
- ✅ Should see charts (trade workers, craft mix)
- ✅ Click "New Report" button

### Test 3: Create Report
- ✅ Fill in report date (today)
- ✅ Select "DAILY"
- ✅ Click "+ Add Activity"
- ✅ Select subcontractor: "ABC Electric"
- ✅ Select craft: "Electrical"
- ✅ Enter workers: 8
- ✅ Add work performed: "Test work"
- ✅ Select safety type
- ✅ Click "Save Report"
- ✅ Should redirect to project overview

### Test 4: View Report
- ✅ Click on an existing report
- ✅ Should open in editor
- ✅ Make a change
- ✅ Save
- ✅ Verify change persists

### Test 5: Subcontractors
- ✅ Click "Subcontractors" in nav
- ✅ Should see 4 subcontractors
- ✅ Try search
- ✅ Verify contacts and crafts display

### Test 6: Import (Admin/PM only)
- ✅ Login as admin
- ✅ Click "Import" in nav
- ✅ Create a simple Excel file:
   ```
   Company          | Craft      | Trade Workers | Work Performed
   ABC Electric     | Electrical | 8             | Test work
   XYZ Mechanical   | Mechanical| 6             | Installation
   ```
- ✅ Upload file
- ✅ Review mapping
- ✅ Select project
- ✅ Set date
- ✅ Import
- ✅ Verify report created

## Verify Database Setup

If you want to verify the database is working:

```bash
# Open Prisma Studio (visual database browser)
npx prisma studio
```

This opens at http://localhost:5555 where you can:
- Browse all tables
- See projects, reports, users
- Verify seed data

## Troubleshooting

### "Missing DATABASE_URL" Error
- Check `.env` file exists
- Verify DATABASE_URL is set (no quotes in value)
- Restart terminal/shell

### "Cannot connect to database"
```bash
# Test connection
psql $DATABASE_URL

# Or test with Prisma
npx prisma db pull
```

### "Prisma Client not generated"
```bash
npm run db:generate
```

### "No projects showing"
```bash
# Re-seed database
npm run db:seed
```

### "Login fails"
- Verify seed ran: `npm run db:seed`
- Check `NEXTAUTH_SECRET` in `.env`
- Clear browser cookies
- Check browser console for errors

### "Port 3000 already in use"
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

## Quick Verification Commands

```bash
# Check if database tables exist
npx prisma db pull

# View all data
npx prisma studio

# Check Prisma Client
ls node_modules/.prisma/client

# Verify environment
cat .env | grep -E "DATABASE_URL|NEXTAUTH"
```

## Expected Results

After setup, you should have:
- ✅ 6 Projects (SDC-SEA-53, IGQ-QUI-E1, etc.)
- ✅ 5 Reports for the first project
- ✅ 4 Subcontractors with contacts
- ✅ 12 Crafts
- ✅ 3 Users (admin, super, pm)

## Next Steps

Once basic testing works:
1. ✅ Test on mobile (use browser DevTools)
2. ✅ Create more complex reports
3. ✅ Test Excel import with your actual files
4. ✅ Test different user roles
5. ✅ Verify charts and analytics

---

**Need help?** Check the console for errors and the terminal output for server logs.


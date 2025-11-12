# Quick Testing Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Verify Prerequisites

```bash
cd /home/nwalchenbach/construction-reports

# Check Node version
node --version  # Should be 20.9.0+ ideally

# Check if database is configured
cat .env | grep DATABASE_URL
```

### Step 2: Set Up Database (First Time Only)

If you haven't set up the database yet:

```bash
# 1. Ensure DATABASE_URL is in .env
# Example: DATABASE_URL="postgresql://user:password@localhost:5432/construction_reports"

# 2. Generate Prisma Client
npm run db:generate

# 3. Create database tables
npm run db:push

# 4. Seed sample data
npm run db:seed
```

Expected output from seed:
```
Seeding database...
Seed completed successfully!
Users created:
  - admin@example.com / admin123
  - super1@example.com / super123
  - pm1@example.com / pm123
```

### Step 3: Start the Server

```bash
npm run dev
```

You should see:
```
✓ Ready in X.Xs
○ Local:        http://localhost:3000
```

### Step 4: Open in Browser

1. Open http://localhost:3000
2. You'll be redirected to `/login`
3. Login with one of these accounts:
   - **Admin**: `admin@example.com` / `admin123`
   - **Superintendent**: `super1@example.com` / `super123`
   - **PM**: `pm1@example.com` / `pm123`

## ✅ Quick Test Checklist

### Basic Navigation
- [ ] Login page loads
- [ ] Can login successfully
- [ ] Dashboard shows after login
- [ ] See project cards on dashboard

### Dashboard Features
- [ ] Can see 6 sample projects
- [ ] Region filter works
- [ ] Search works
- [ ] Click project card → goes to project detail

### Project Overview
- [ ] Project details display correctly
- [ ] Can see reports list
- [ ] Charts display (if reports exist)
- [ ] "New Report" button works

### Report Creation
- [ ] Can create new report
- [ ] Can add subcontractor activities
- [ ] Total trade workers calculates
- [ ] Can save report
- [ ] Report appears in project overview

### Report Editing
- [ ] Can click on existing report
- [ ] Can edit fields
- [ ] Can save changes
- [ ] Changes persist

## 🧪 Test Scenarios

### Scenario 1: Create Daily Report
1. Go to any project
2. Click "New Report"
3. Set date to today
4. Select "DAILY"
5. Add 2-3 subcontractor activities:
   - ABC Electric / Electrical / 8 workers
   - XYZ Mechanical / Mechanical / 6 workers
6. Add work performed: "Test work description"
7. Select safety type: "Tool Box Talk – PPE"
8. Add safety details: "All workers compliant"
9. Save
10. Verify report appears in list

### Scenario 2: Test Excel Import (Admin/PM only)
1. Login as admin or PM
2. Go to `/import`
3. Create a simple Excel file with:
   - Headers: Company, Craft, Trade Workers, Work Performed
   - 2-3 rows of data
4. Upload file
5. Review header mapping
6. Select project
7. Set date and type
8. Import
9. Verify report created

### Scenario 3: Test Role Permissions
1. Login as superintendent (`super1@example.com`)
2. Should only see assigned projects
3. Cannot access `/import` page
4. Logout and login as admin
5. Can see all projects
6. Can access `/import` page

## 🔍 Verify Data

### Check Database (Optional)
```bash
# Using Prisma Studio (visual database browser)
npx prisma studio
```

This opens a web interface at http://localhost:5555 where you can:
- Browse all tables
- View projects, reports, users
- Verify seed data loaded correctly

## 🐛 Common Issues

### Issue: "Missing DATABASE_URL"
**Solution**: Add to `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/construction_reports"
```

### Issue: "Prisma Client not generated"
**Solution**: Run `npm run db:generate`

### Issue: "Cannot connect to database"
**Solution**: 
- Verify PostgreSQL is running
- Check connection string is correct
- Test: `psql $DATABASE_URL`

### Issue: "No projects showing"
**Solution**: Run `npm run db:seed` to load sample data

### Issue: "Login fails"
**Solution**: 
- Verify seed data ran (`npm run db:seed`)
- Check `NEXTAUTH_SECRET` is set in `.env`
- Clear browser cookies

## 📊 Expected Seed Data

After seeding, you should have:
- **6 Projects** across different regions
- **5 Reports** for the first project
- **4 Subcontractors** with contacts
- **12 Crafts** (Electrical, Mechanical, etc.)
- **3 Users** (admin, super, pm)

## 🎯 Next Steps After Testing

Once basic testing works:
1. Test on mobile device or browser DevTools
2. Create more complex reports
3. Test with larger datasets
4. Review charts and analytics
5. Test Excel import with your actual files

## 💡 Tips

- Use browser DevTools (F12) to see console errors
- Check terminal for server errors
- Use Prisma Studio to inspect database
- Test with different user roles
- Try edge cases (empty fields, invalid data)

---

**Need help?** Check the full `TESTING.md` guide for detailed scenarios.


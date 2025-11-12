# Setup Local Database Backend - Step by Step

## Quick Setup (Choose One Method)

### Method 1: Install PostgreSQL Locally (Recommended)

#### Step 1: Install PostgreSQL

Open a terminal and run:

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

#### Step 2: Start PostgreSQL Service

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Step 3: Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In the PostgreSQL prompt, run these commands:
CREATE DATABASE construction_reports;
CREATE USER construction_user WITH PASSWORD 'construction_password';
GRANT ALL PRIVILEGES ON DATABASE construction_reports TO construction_user;
\q
```

#### Step 4: Update .env File

The .env file is already updated with:
```
DATABASE_URL="postgresql://construction_user:construction_password@localhost:5432/construction_reports?schema=public"
BYPASS_AUTH=false
```

#### Step 5: Setup Database Schema

```bash
cd /home/nwalchenbach/construction-reports
npm run db:generate
npm run db:push
npm run db:seed
```

#### Step 6: Restart Server

```bash
pkill -f "next dev"
npm run dev
```

---

### Method 2: Use Docker (Easiest - No Sudo Needed)

If you have Docker installed:

```bash
# Start PostgreSQL container
docker run --name construction-postgres \
  -e POSTGRES_PASSWORD=construction_password \
  -e POSTGRES_USER=construction_user \
  -e POSTGRES_DB=construction_reports \
  -p 5432:5432 \
  -d postgres:14

# Then run migrations
cd /home/nwalchenbach/construction-reports
npm run db:generate
npm run db:push
npm run db:seed

# Restart server
pkill -f "next dev"
npm run dev
```

To stop the database:
```bash
docker stop construction-postgres
docker rm construction-postgres
```

---

### Method 3: Use Supabase (Cloud - Free, No Installation)

1. Go to https://supabase.com
2. Sign up (free account)
3. Create a new project
4. Go to Settings > Database
5. Copy the "Connection string" (URI format)
6. Update `.env`:
   ```
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
   ```
7. Run migrations:
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

---

## After Setup

### Login Credentials (from seed data):
- **Admin**: admin@example.com / admin123
- **Superintendent**: super1@example.com / super123
- **PM**: pm1@example.com / pm123

### What You'll Have:
- ✅ 6 Sample Projects
- ✅ 5 Sample Reports
- ✅ 4 Subcontractors
- ✅ 12 Crafts
- ✅ Full database with all tables

### Test It:
1. Open http://localhost:3000
2. Login with one of the accounts above
3. You should see projects on the dashboard
4. Create new reports - they'll be saved to the database!

---

## Troubleshooting

### "Can't reach database server"
- Make sure PostgreSQL is running: `sudo systemctl status postgresql`
- Check if port 5432 is open: `netstat -tlnp | grep 5432`

### "Authentication failed"
- Check the password in .env matches what you created
- Try: `psql -U construction_user -d construction_reports -h localhost`

### "Database doesn't exist"
- Create it: `sudo -u postgres psql -c "CREATE DATABASE construction_reports;"`

---

## Next Steps

Once database is working:
1. ✅ Reports will save to database
2. ✅ Projects will persist
3. ✅ All data will be stored locally
4. ✅ You can work with real data!


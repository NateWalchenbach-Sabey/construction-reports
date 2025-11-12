# Complete Database Setup Guide

## Step-by-Step Instructions

### Step 1: Install PostgreSQL (Run these commands in your terminal)

```bash
# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << 'EOF'
CREATE DATABASE construction_reports;
CREATE USER construction_user WITH PASSWORD 'construction_password';
GRANT ALL PRIVILEGES ON DATABASE construction_reports TO construction_user;
\c construction_reports
GRANT ALL ON SCHEMA public TO construction_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO construction_user;
\q
EOF
```

### Step 2: Verify Installation

Check if PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

Check if database exists:
```bash
sudo -u postgres psql -c "\l" | grep construction_reports
```

### Step 3: Run Database Setup Script

Once PostgreSQL is installed and the database is created, run:

```bash
cd /home/nwalchenbach/construction-reports
bash SETUP_AFTER_INSTALL.sh
```

This will:
- Generate Prisma client
- Create all database tables
- Seed sample data
- Restart the server

## Alternative: Run Setup Manually

If you prefer to run commands manually:

```bash
cd /home/nwalchenbach/construction-reports

# Generate Prisma client
npm run db:generate

# Create tables
npm run db:push

# Seed data
npm run db:seed

# Restart server
pkill -f "next dev"
npm run dev
```

## After Setup

**Login Credentials:**
- Admin: `admin@example.com` / `admin123`
- Superintendent: `super1@example.com` / `super123`
- PM: `pm1@example.com` / `pm123`

**What You'll Have:**
- ✅ 6 Sample Projects
- ✅ 5 Sample Reports
- ✅ 4 Subcontractors
- ✅ 12 Crafts
- ✅ All data stored in PostgreSQL

**Access:**
- Open http://localhost:3000
- Login with one of the accounts above
- Start creating reports!

## Troubleshooting

**"Can't reach database server"**
- Make sure PostgreSQL is running: `sudo systemctl status postgresql`
- Check if port 5432 is listening: `netstat -tlnp | grep 5432`

**"Database doesn't exist"**
- Make sure you ran the CREATE DATABASE command
- Verify: `sudo -u postgres psql -c "\l" | grep construction`

**"Authentication failed"**
- Check password in .env matches what you created
- Test connection: `psql -U construction_user -d construction_reports -h localhost`


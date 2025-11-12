# Setting Up Local Database Backend

## Quick Setup Guide

### Option 1: Local PostgreSQL (Recommended)

#### Step 1: Install PostgreSQL (if not already installed)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS (with Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows:**
Download from: https://www.postgresql.org/download/windows/

#### Step 2: Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE construction_reports;
CREATE USER construction_user WITH PASSWORD 'construction_password';
GRANT ALL PRIVILEGES ON DATABASE construction_reports TO construction_user;
\q
```

#### Step 3: Update .env File

```bash
DATABASE_URL="postgresql://construction_user:construction_password@localhost:5432/construction_reports?schema=public"
```

#### Step 4: Run Migrations and Seed

```bash
cd /home/nwalchenbach/construction-reports
npm run db:generate
npm run db:push
npm run db:seed
```

### Option 2: Docker (Easiest)

#### Step 1: Install Docker
https://docs.docker.com/get-docker/

#### Step 2: Run PostgreSQL Container

```bash
docker run --name construction-postgres \
  -e POSTGRES_PASSWORD=construction_password \
  -e POSTGRES_USER=construction_user \
  -e POSTGRES_DB=construction_reports \
  -p 5432:5432 \
  -d postgres:14
```

#### Step 3: Update .env

```bash
DATABASE_URL="postgresql://construction_user:construction_password@localhost:5432/construction_reports?schema=public"
```

#### Step 4: Run Migrations

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### Option 3: Supabase (Cloud, Free)

1. Go to https://supabase.com
2. Create free account
3. Create new project
4. Copy connection string from Settings > Database
5. Update DATABASE_URL in .env
6. Run migrations

---

## After Setup

1. **Disable Dev Mode** (optional):
   ```bash
   # In .env, set:
   BYPASS_AUTH=false
   ```

2. **Restart Server:**
   ```bash
   pkill -f "next dev"
   npm run dev
   ```

3. **Login with seeded accounts:**
   - admin@example.com / admin123
   - super1@example.com / super123
   - pm1@example.com / pm123


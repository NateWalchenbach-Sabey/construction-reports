# Quick Setup Guide

## Prerequisites

- Node.js 20.9.0 or higher (currently using 18.19.1 - may need upgrade)
- PostgreSQL database
- npm or yarn

## Step-by-Step Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NEXTAUTH_URL`: http://localhost:3000 (for development)
   - `NEXTAUTH_SECRET`: Generate a random secret (e.g., `openssl rand -base64 32`)

3. **Set up the database:**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Create database schema
   npm run db:push
   
   # Seed with sample data
   npm run db:seed
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   - Open http://localhost:3000
   - Login with:
     - Email: `admin@example.com` / Password: `admin123`
     - Email: `super1@example.com` / Password: `super123`
     - Email: `pm1@example.com` / Password: `pm123`

## Database Setup Options

### Option 1: Local PostgreSQL
Install PostgreSQL locally and create a database:
```sql
CREATE DATABASE construction_reports;
```

### Option 2: Supabase (Recommended for development)
1. Create a free account at https://supabase.com
2. Create a new project
3. Copy the connection string from Project Settings > Database
4. Use it as your `DATABASE_URL`

### Option 3: Railway
1. Create account at https://railway.app
2. Create a new PostgreSQL database
3. Copy the connection string
4. Use it as your `DATABASE_URL`

## Troubleshooting

### Node.js Version Warning
If you see Node.js version warnings, consider upgrading to Node.js 20+:
```bash
# Using nvm (Node Version Manager)
nvm install 20
nvm use 20
```

### Database Connection Issues
- Verify your `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check firewall settings if using remote database

### Prisma Client Not Generated
Run:
```bash
npm run db:generate
```

### Seed Fails
Make sure you've run `npm run db:push` first to create the tables.

## Next Steps

After setup:
1. Explore the dashboard with sample projects
2. Create a new report
3. Try importing an Excel file
4. Review the subcontractors directory
5. Check project overviews with charts

## Production Deployment

For production:
1. Set up a production PostgreSQL database
2. Update all environment variables
3. Set `NODE_ENV=production`
4. Run `npm run build`
5. Deploy to Vercel, Railway, or your preferred platform


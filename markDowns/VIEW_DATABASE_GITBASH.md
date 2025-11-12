# Step-by-Step: View Database from Git Bash (Windows)

## Method 1: Prisma Studio (Visual Interface) - EASIEST

### Step 1: Open Git Bash on your Windows computer

### Step 2: Set up SSH port forwarding

Run this command in Git Bash (replace with your actual SSH details):

```bash
ssh -L 0.0.0.0:5555:localhost:5555 your-username@your-server-ip
```

**Example:**
```bash
ssh -L 0.0.0.0:5555:localhost:5555 nwalchenbach@192.168.1.100
```

**What this does:** Forwards port 5555 from the remote server to your local computer.

### Step 3: Keep Git Bash open

**Important:** Leave this Git Bash window open! The port forwarding only works while the SSH connection is active.

### Step 4: Open your web browser

On your Windows computer, open any browser (Chrome, Firefox, Edge) and go to:

```
http://localhost:5555
```

### Step 5: View your database!

You'll see Prisma Studio with all your tables:
- Click on any table name (User, Project, Report, etc.)
- Browse, edit, add, or delete records
- Use the search and filter features

---

## Method 2: Direct SQL Queries via SSH

### Step 1: Open Git Bash

### Step 2: Connect to your SSH server

```bash
ssh your-username@your-server-ip
```

**Example:**
```bash
ssh nwalchenbach@192.168.1.100
```

### Step 3: Navigate to your project

```bash
cd /home/nwalchenbach/construction-reports
```

### Step 4: Run SQL queries using Prisma

**Quick overview:**
```bash
npx tsx -e "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); (async () => { console.log('Projects:', await prisma.project.count()); console.log('Reports:', await prisma.report.count()); console.log('Users:', await prisma.user.count()); await prisma.\$disconnect(); })();"
```

**See all projects:**
```bash
npx tsx -e "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); (async () => { const projects = await prisma.project.findMany({ select: { code: true, name: true, region: true } }); projects.forEach(p => console.log(\`\${p.code}: \${p.name} (\${p.region})\`)); await prisma.\$disconnect(); })();"
```

**See all reports:**
```bash
npx tsx -e "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); (async () => { const reports = await prisma.report.findMany({ take: 10, include: { project: { select: { code: true } } }, orderBy: { reportDate: 'desc' } }); reports.forEach(r => console.log(\`\${r.reportDate.toISOString().split('T')[0]}: \${r.project.code}\`)); await prisma.\$disconnect(); })();"
```

### Step 5: Or use psql directly

```bash
psql postgresql://construction_user:construction_password@localhost:5432/construction_reports
```

Then run SQL queries:
```sql
-- See all projects
SELECT code, name, region FROM "Project" ORDER BY name;

-- Count records
SELECT 
  (SELECT COUNT(*) FROM "Project") as projects,
  (SELECT COUNT(*) FROM "Report") as reports,
  (SELECT COUNT(*) FROM "User") as users;

-- See recent reports
SELECT r."reportDate", p.code, p.name 
FROM "Report" r 
JOIN "Project" p ON r."projectId" = p.id 
ORDER BY r."reportDate" DESC 
LIMIT 10;

-- Exit psql
\q
```

---

## Method 3: One-Line Commands (Quick Checks)

### From Git Bash, SSH in and run:

**Check database status:**
```bash
ssh your-username@your-server-ip "cd /home/nwalchenbach/construction-reports && npx tsx -e \"import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.project.count().then(c => { console.log('Projects:', c); p.\$disconnect(); });\""
```

**Get project list:**
```bash
ssh your-username@your-server-ip "cd /home/nwalchenbach/construction-reports && npx tsx -e \"import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.project.findMany({ select: { code: true, name: true } }).then(projs => { projs.forEach(pr => console.log(pr.code + ': ' + pr.name)); p.\$disconnect(); });\""
```

---

## Troubleshooting

### "Connection refused" when accessing localhost:5555
- Make sure Prisma Studio is running on the server
- Check that your SSH port forwarding command is still active
- Verify you used `0.0.0.0:5555` not just `5555`

### "Command not found: npx" or "Command not found: psql"
- Make sure you're SSH'd into the server (not running commands locally)
- Check that Node.js is installed: `node --version`
- Check that PostgreSQL client is installed: `which psql`

### Can't connect via SSH
- Verify your SSH server IP address
- Check that you have SSH access configured
- Try: `ssh -v your-username@your-server-ip` for verbose output

### Port 5555 already in use
- Close any other applications using port 5555
- Or use a different local port: `ssh -L 0.0.0.0:5556:localhost:5555 ...`
- Then access at `http://localhost:5556`

---

## Quick Reference

**Your Database Connection:**
```
postgresql://construction_user:construction_password@localhost:5432/construction_reports
```

**Current Data:**
- 25 Projects
- 47 Reports  
- 3 Users
- 102 Subcontractors
- 392 Activities

**Prisma Studio Port:** 5555 (or 5556 if multiple instances)

**Project Location:** `/home/nwalchenbach/construction-reports`


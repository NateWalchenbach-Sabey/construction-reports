# How to Start the Development Server

## Current Issue

Your Node.js version (18.19.1) is too old for Next.js 16, which requires Node.js >=20.9.0.

## Solution Options

### Option 1: Upgrade Node.js (Recommended)

If you have `nvm` (Node Version Manager):

```bash
# Install Node.js 20
nvm install 20
nvm use 20

# Verify version
node --version  # Should show v20.x.x

# Then start the server
cd /home/nwalchenbach/construction-reports
npm run dev
```

### Option 2: Install Node.js 20 Manually

Download from https://nodejs.org/ or use your package manager:

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or use snap
sudo snap install node --classic --channel=20
```

### Option 3: Use Docker (If Node.js upgrade is not possible)

```bash
# Run with Docker (Node 20)
docker run -it -v $(pwd):/app -w /app -p 3000:3000 node:20 npm run dev
```

## After Upgrading Node.js

1. **Set up database** (if not done):
   ```bash
   # Update .env with real DATABASE_URL
   # Then:
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

2. **Start the server**:
   ```bash
   npm run dev
   ```

3. **Access the app**:
   - Open http://localhost:3000
   - Login with seeded accounts

## Quick Commands

```bash
# Check Node version
node --version

# Start dev server (after Node.js upgrade)
npm run dev

# Stop server
Ctrl + C
```

## Troubleshooting

### "Next.js requires Node.js >=20.9.0"
- Upgrade Node.js (see above)
- Or downgrade Next.js to version 14 (not recommended)

### "DATABASE_URL not found"
- Set DATABASE_URL in `.env` file
- Even a placeholder will work for frontend-only testing

### "Port 3000 in use"
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or use different port
PORT=3001 npm run dev
```

---

**The main blocker is Node.js version.** Upgrade to Node.js 20+ to run the dev server.


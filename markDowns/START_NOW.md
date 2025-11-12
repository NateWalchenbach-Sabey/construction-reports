# Start the Development Server - Quick Fix

## The Problem
Node.js 18.19.1 is too old for Next.js 16 (requires 20.9.0+)

## Quick Solution

### Try This First (if nvm is installed):
```bash
# Load nvm if available
source ~/.nvm/nvm.sh 2>/dev/null || source ~/.bashrc

# Install and use Node 20
nvm install 20
nvm use 20

# Start server
cd /home/nwalchenbach/construction-reports
npm run dev
```

### Alternative: Downgrade Next.js (Quick Fix)

If you can't upgrade Node.js right now, we can temporarily downgrade Next.js:

```bash
cd /home/nwalchenbach/construction-reports
npm install next@14.2.0 react@18 react-dom@18 --save
npm run dev
```

**Note:** This may cause some compatibility issues, but will let you run the server.

### Or: Use System Node.js 20 (if available)

```bash
# Check if Node 20 is available via snap
sudo snap install node --classic --channel=20

# Or check package manager
sudo apt update && sudo apt install nodejs npm
```

## After Node.js is Upgraded

1. **Set DATABASE_URL** in `.env` (even a placeholder works):
   ```
   DATABASE_URL="postgresql://user:pass@localhost:5432/db"
   ```

2. **Start the server**:
   ```bash
   npm run dev
   ```

3. **Open browser**: http://localhost:3000

---

**The server won't start until Node.js is upgraded to 20+**


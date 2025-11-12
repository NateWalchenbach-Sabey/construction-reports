# How to Run the Development Server

## Quick Start

```bash
cd /home/nwalchenbach/construction-reports

# Start the development server
npm run dev
```

That's it! The app will start at **http://localhost:3000**

## Prerequisites Check

Before running, make sure:

1. **Database is set up** (one-time setup):
   ```bash
   npm run db:generate  # Generate Prisma client
   npm run db:push      # Create database tables
   npm run db:seed      # Load sample data (optional)
   ```

2. **Environment variables** are configured in `.env`:
   - `DATABASE_URL` - PostgreSQL connection string
   - `NEXTAUTH_SECRET` - Random secret for auth
   - `NEXTAUTH_URL` - http://localhost:3000

## Running the Dev Server

### Standard Command
```bash
npm run dev
```

### What You'll See
```
✓ Ready in 2.5s
○ Local:        http://localhost:3000
○ Network:      http://192.168.x.x:3000
```

### Access the App
- **Local**: http://localhost:3000
- **Network**: Use the network URL shown to access from other devices

## Development Features

When running in dev mode:
- ✅ Hot reload (changes auto-refresh)
- ✅ Error overlay (shows errors in browser)
- ✅ Fast refresh (React components update instantly)
- ✅ Source maps (for debugging)

## Stopping the Server

Press `Ctrl + C` in the terminal to stop the server.

## Running on Different Port

If port 3000 is busy:
```bash
PORT=3001 npm run dev
```

Or add to `package.json`:
```json
"dev": "next dev -p 3001"
```

## Troubleshooting

### "Port already in use"
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### "Module not found"
```bash
# Reinstall dependencies
npm install
```

### "Prisma Client not generated"
```bash
npm run db:generate
```

### "Cannot connect to database"
- Check `.env` has correct `DATABASE_URL`
- Verify PostgreSQL is running
- Test connection: `psql $DATABASE_URL`

## Build for Production

```bash
npm run build    # Build the app
npm start        # Run production server
```

## Common Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run start    # Run production build
npm run lint     # Run linter
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:seed      # Seed sample data
```

---

**That's it!** Just run `npm run dev` and open http://localhost:3000


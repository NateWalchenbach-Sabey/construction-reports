# Production Project Data Management

## Current State

**Yes, the project data will be in production** - it's stored in your PostgreSQL database in the `Project` table.

## How It Currently Works

1. **Development/Seeding**: Projects are created from Excel files via `prisma/seed.ts`
2. **API Endpoint**: There's a `POST /api/projects` endpoint that allows ADMIN/PM users to create projects programmatically
3. **No UI**: Currently, there's no user interface for managing projects

## Production Workflow Options

### Option 1: Admin Project Management Interface (Recommended)

Create an admin interface for project management:

**New Page**: `/admin/projects` or `/projects/manage`
- List all projects
- Create new projects (form with all fields)
- Edit existing projects
- Delete/archive projects
- Bulk import from Excel/CSV

**Features needed:**
- Project creation form (name, code, region, dates, budget, etc.)
- Project edit form
- Project list with search/filter
- Excel/CSV import functionality
- Permission checks (ADMIN/PM only)

### Option 2: Excel Import (Quick Start)

Keep using Excel import for initial setup:
- Run seed script in production (one-time)
- Or create an admin import page that accepts Excel uploads
- Projects are created/updated from Excel data

### Option 3: Manual API Creation

Use the existing API endpoint:
- POST to `/api/projects` with project data
- Requires ADMIN/PM authentication
- Good for programmatic setup or integration

### Option 4: Hybrid Approach (Best for Production)

Combine multiple methods:
1. **Initial Setup**: Import from Excel (one-time bulk import)
2. **Ongoing Management**: Admin UI for creating/editing individual projects
3. **Updates**: Projects can be updated via:
   - Admin UI
   - API endpoint (for integrations)
   - Excel re-import (for bulk updates)

## Recommended Implementation

### 1. Create Admin Project Management Page

**File**: `app/admin/projects/page.tsx`

```typescript
// Admin-only page for managing projects
// Features:
// - List projects with search/filter
// - Create new project button
// - Edit/delete actions
// - Excel import button
```

### 2. Create Project Form Component

**File**: `components/project-form.tsx`

```typescript
// Reusable form for creating/editing projects
// Fields:
// - Project Name (required)
// - Project Code (required, unique)
// - Region (dropdown)
// - Tenant (optional)
// - Start Date (required)
// - Scheduled Completion (optional)
// - Project Budget (required)
// - EAC (optional, defaults to budget)
// - Percent Complete (optional)
// - Status Note (optional)
// - Tags (optional)
```

### 3. Excel Import Feature

**File**: `app/admin/projects/import/page.tsx`

```typescript
// Upload Excel file
// Parse and validate data
// Show preview of projects to be created/updated
// Confirm and import
```

## Data Flow in Production

```
┌─────────────────────────────────────────┐
│  Project Data Sources                   │
├─────────────────────────────────────────┤
│  1. Excel Import (bulk)                 │
│  2. Admin UI (manual creation/edit)      │
│  3. API Endpoint (programmatic)         │
└─────────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │  PostgreSQL Database   │
        │  (Project table)       │
        └───────────────────────┘
                    ↓
        ┌───────────────────────┐
        │  Report Creation      │
        │  (Read-only display)  │
        └───────────────────────┘
```

## Security & Permissions

- **ADMIN**: Full access (create, edit, delete projects)
- **PM**: Full access (create, edit, delete projects)
- **EXECUTIVE**: Read-only (view projects)
- **SUPERINTENDENT**: Read-only (view assigned projects only)

## Data Persistence

- All project data is stored in PostgreSQL
- Projects persist across app restarts
- No data loss (unless explicitly deleted)
- Can be backed up via database backups

## Migration from Development to Production

1. **Export data** from dev database:
   ```bash
   pg_dump -t Project > projects_backup.sql
   ```

2. **Import to production**:
   ```bash
   psql production_db < projects_backup.sql
   ```

3. **Or use Prisma migrations**:
   ```bash
   npx prisma migrate deploy
   ```

## Next Steps

1. ✅ API endpoint exists (`POST /api/projects`)
2. ⚠️ Need: Admin UI for project management
3. ⚠️ Need: Excel import page for bulk operations
4. ⚠️ Need: Project edit/delete functionality

Would you like me to create the admin project management interface?


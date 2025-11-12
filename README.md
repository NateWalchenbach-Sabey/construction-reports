# Construction Daily/Weekly Reporting System

A unified, production-ready web application for managing construction project daily and weekly reports. This system replaces multiple Excel templates with a consistent, mobile-friendly interface.

## Features

- **Multi-Project Management**: Track multiple construction projects across different regions
- **Daily & Weekly Reports**: Create and manage daily and weekly construction reports
- **Excel/CSV Import**: Import existing Excel files with intelligent header mapping
- **Subcontractor Tracking**: Manage subcontractor companies, crafts, and trade worker counts
- **Financial Tracking**: Monitor project budgets, EAC, and variances
- **Progress Tracking**: Visual progress indicators and completion percentages
- **Role-Based Access**: Support for Superintendents, PMs, Executives, and Admins
- **Mobile-First Design**: Responsive UI optimized for mobile devices
- **Charts & Analytics**: Visualizations for trade worker trends and craft mix

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **UI**: Tailwind CSS
- **Charts**: Recharts
- **File Processing**: XLSX (Excel parsing)

## Getting Started

### Prerequisites

- Node.js 20.9.0 or higher
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository:
```bash
cd construction-reports
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables by creating a `.env` file at the project root:

Edit `.env` and add your configuration:
```
DATABASE_URL="postgresql://user:password@localhost:5432/construction_reports?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-here"

# Okta OpenID Connect application
OKTA_ISSUER="https://your-okta-domain.okta.com/oauth2/default"
OKTA_CLIENT_ID="your-okta-client-id"
OKTA_CLIENT_SECRET="your-okta-client-secret"

# Optional: allow legacy email/password sign-in alongside Okta
ENABLE_CREDENTIALS_SIGNIN="false"

# Optional: development bypass helpers
BYPASS_AUTH="false"
NEXT_PUBLIC_BYPASS_AUTH="false"
```

4. Set up the database:
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed the database with sample data
npm run db:seed
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Default Login Credentials

If `ENABLE_CREDENTIALS_SIGNIN` is enabled (or Okta is not yet configured), the seeded users can authenticate with email/password:

- **Admin**: `admin@example.com` / `admin123`
- **Superintendent**: `super1@example.com` / `super123`
- **Project Manager**: `pm1@example.com` / `pm123`

When Okta is enabled without legacy credentials, user access is managed entirely through your Okta directory.

## Okta Authentication Setup

1. In the Okta Admin console, create a new **OIDC - Web Application**. Assign it to the users or groups who should access Construction Reports.
2. Set the login redirect URI to `http://localhost:3000/api/auth/callback/okta` for local development. Add your production domain as `https://your-domain.com/api/auth/callback/okta` when deploying.
3. (Optional) Set the sign-out redirect URI to match your app domain, e.g., `http://localhost:3000`.
4. Copy the **Client ID**, **Client Secret**, and issuer base URL (`https://your-okta-domain.okta.com/oauth2/default`). Add them to `.env` as shown above.
5. Ensure `NEXTAUTH_SECRET` is set to a strong random value. This must remain stable between deployments.
6. Apply the latest Prisma schema changes so the NextAuth Prisma adapter tables (`Account`, `Session`, `VerificationToken`) exist:
   ```bash
   npx prisma migrate dev --name enable_okta_auth
   npm run db:generate
   ```
   For production databases use `npx prisma migrate deploy` instead.
7. Restart the Next.js server so the new configuration is picked up.
8. (Optional) If you want to keep local credentials available alongside Okta—for example, for service accounts or break-glass scenarios—set `ENABLE_CREDENTIALS_SIGNIN="true"` before restarting the server.

Once Okta is configured, the login page will display a "Continue with Okta" button and hide the legacy email/password form unless the credentials provider is explicitly enabled.

## Project Structure

```
construction-reports/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── projects/          # Project pages
│   ├── import/            # Import wizard
│   ├── login/             # Login page
│   └── subcontractors/    # Subcontractors directory
├── components/            # React components
├── lib/                   # Utilities and configurations
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client
│   ├── utils.ts          # Utility functions
│   └── constants.ts      # Constants and enums
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed script
└── public/               # Static assets
```

## Key Features

### Excel Import

The import wizard supports:
- Automatic header detection and mapping
- Synonym-based field matching
- Project code and date extraction from filenames
- Preview before import
- Support for .xlsx, .xls, and .csv files

### Report Editor

- Mobile-optimized form layout
- Dynamic subcontractor activity table
- Rich text narratives (Work Performed, Safety)
- Automatic total trade worker calculation
- Autosave functionality

### Dashboard

- Region-based filtering
- Project search
- Progress indicators
- Budget vs EAC comparison
- Latest trade worker counts

### Project Overview

- Time-ordered reports list
- Trade worker trend charts
- Craft mix visualization
- Safety summary
- Financial metrics

## Database Schema

The system uses a normalized database schema with:

- **Projects**: Core project information, financials, progress
- **Reports**: Daily/weekly reports with narratives
- **SubcontractorCompany**: Subcontractor master data
- **Craft**: Trade/craft lookup table
- **ReportSubcontractorActivity**: Line items for each report
- **CustomFields**: Flexible custom field system (project and report scoped)
- **Users**: User accounts with role-based access
- **ActivityLog**: Audit trail for changes

## Role Permissions

- **Superintendent**: Create/edit reports for assigned projects
- **PM**: Access to financial fields, can create/edit projects and reports
- **Executive**: Read-only access to dashboards and reports
- **Admin**: Full access, manage lookups, crafts, regions, custom fields

## Development

### Running Migrations

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy
```

### Generating Prisma Client

After schema changes:
```bash
npm run db:generate
```

### Seeding Database

```bash
npm run db:seed
```

## Production Deployment

1. Set up a PostgreSQL database (e.g., on Supabase, Railway, or AWS RDS)
2. Update environment variables with production values
3. Run database migrations: `npx prisma migrate deploy`
4. Seed initial data if needed: `npm run db:seed`
5. Build the application: `npm run build`
6. Start the production server: `npm start`

## Notes

- The application uses server-side rendering for improved performance
- File uploads are handled in-memory for Excel imports (consider adding file storage for production)
- Authentication uses JWT sessions with NextAuth.js
- Mobile-first design ensures usability on all devices

## License

This project is proprietary software.

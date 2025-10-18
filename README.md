# BestPrice – Quickstart

## 🏗️ Environment Architecture

This application uses **separate environments** for safe development and production:

### Development Environment
- **Database**: `ep-lingering-hat-adb2bp8d` (NEON PostgreSQL)
- **Purpose**: Development, testing, and staging
- **URL**: `postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`

### Production Environment
- **Database**: `ep-lingering-sea-adyjzybe` (NEON PostgreSQL)
- **Purpose**: Live customers and production data
- **URL**: `postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`

**⚠️ SAFETY**: Two separate databases ensure development work never affects live customers.

## 🚀 Development to Production Workflow

### Quick Development Start
```bash
npm install
npm run dev  # Uses development database (ep-lingering-hat-adb2bp8d)
```

### Safe Deployment Process
```bash
# 1. Develop and test in development
npm run dev

# 2. Pre-deployment checks
npm run deploy:safe

# 3. Deploy to production
npm run deploy

# 4. Monitor production deployment
# Check Runway dashboard for deployment status
```

**📖 Complete Guides**:
- [DEV_PROD_WORKFLOW.md](./DEV_PROD_WORKFLOW.md) - Development workflow
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) - Environment configuration

## Environment Variables

### Development
- `DATABASE_URL`: Development NEON database (`ep-lingering-hat-adb2bp8d`)
- `NODE_ENV=development`
- `PORT=3000`

### Production
- `DATABASE_URL`: Production NEON database (`ep-lingering-sea-adyjzybe`)
- `NODE_ENV=production`
- `PORT=3000`

## Clean Restart (Dev)

```bash
pm2 delete all || true
pkill -f "tsx server/index.ts|node .*dist/index.js|vite|npm run dev" || true
PORT=5000 NODE_ENV=development npm run dev
```

## Health & Readiness

- Health: `GET /api/health` → status, mode, PID, uptime, DB
- Ready: `GET /api/ready` → readiness after routes/static mounted

## Modes

- Dev: `NODE_ENV=development` (Vite HMR)
- Prod: `NODE_ENV=production` (serve built static)

## Builds & Prod-like Run

```bash
npm run build
npm run start           # node dist/index.js
# or with PM2 (prod-like only)
npm run start:pm2
```

## Background Jobs

- Do not run jobs in the web process during Replit dev.
- For production, run a separate worker (PM2) or an external scheduler.

## Troubleshooting

- Port 5000 in use: ensure a single owner (see Clean Restart above).
- Auth 401 on test endpoints: use the app UI (cookies) or dev-only token.

For deeper details see `ARCHITECTURE.md`.

## Database Configuration

### Development Environment
Set `DATABASE_URL` to your development NEON database:
```bash
DATABASE_URL=postgresql://neondb_owner:***@ep-dev-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Production Environment
Set `DATABASE_URL` to your production NEON database:
```bash
DATABASE_URL=postgresql://neondb_owner:***@ep-prod-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Deployment (Runway/Production Hosting)

- Build: `npm ci && npm run build`
- Run: `NODE_ENV=production PORT=$PORT node dist/index.js`
- Health check: `/api/health`
- Required Environment Variables:
  - `DATABASE_URL` (production NEON database)
  - `SESSION_SECRET` (for session management)
  - `CREDENTIAL_ENCRYPTION_KEY` (for encrypting stored credentials)
  - `BASE_URL` (your production domain URL)
  - `SENDGRID_API_KEY` (if using email features)
  - `GOOGLE_CLOUD_PROJECT_ID` (for object storage)
  - `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_APPLICATION_CREDENTIALS_JSON` (for GCS access)
  - Zoho Billing variables if used (`ZOHO_BILLING_*`, `ZOHO_WEBHOOK_SECRET`)
- Filesystem may be ephemeral. Store uploads in object storage; log to stdout, not files.

## Vendor Sync Methods Overview

- Bill Hicks & Co.
  - Source: FTP CSV (`/MicroBiz/Feeds/MicroBiz_Daily_Catalog.csv` for catalog, hourly inventory CSV)
  - Change detection: file-level MD5; if unchanged, skip. If changed, per-row priority checks with no-op update skip to avoid unchanged writes. Inventory uses in-memory diff and bulk updates.
  - Triggers: Admin manual endpoints; optional Scheduled Deployment.
  - See: [Bill Hicks Scheduled Deployment Guide](./BILL_HICKS_SCHEDULED_DEPLOYMENT.md)

- Sports South
  - Source: Web service API (XML) `DailyItemUpdate` (full and incremental). No CSV download.
  - Change detection: API-level incremental using last sync timestamp; full sync uses early date to fetch all.
  - Triggers: Admin endpoints for full/incremental; scheduler support.
  - See: [Sports South Catalog Sync Guide](./SPORTS_SOUTH_SYNC_GUIDE.md)

- Chattanooga Shooting Supplies
  - Source: CSV feed (download and parse).
  - Change detection: file-level MD5; CSV parsed and applied with priority rules.
  - Triggers: Admin manual and scheduler (where configured).
  - See: [Chattanooga Shooting Supplies Sync Guide](./CHATTANOOGA_SYNC_GUIDE.md)

See dedicated docs in repository for vendor-specific setup and troubleshooting.






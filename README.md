# BestPrice – Quickstart (Replit)

## Dev Start

```bash
npm install
PORT=5000 NODE_ENV=development npm run dev
```

- Replit `.replit` sets `PORT=5000` so only one process listens on 5000.
- Do not run PM2 in Replit dev.

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

## Replit Hosting-Only (Deployments)

- Build: `npm ci && npm run build`
- Run: `NODE_ENV=production PORT=$PORT node dist/index.js`
- Health check: `/api/health`
- Secrets to set: `DATABASE_URL`, `SESSION_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `BASE_URL`, `SENDGRID_API_KEY` (if emails), Zoho Billing vars if used (`ZOHO_BILLING_*`, `ZOHO_WEBHOOK_SECRET`)
- Filesystem is ephemeral in Deployments. Store uploads in object storage; log to stdout, not files.

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






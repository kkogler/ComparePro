# Database Setup & Environment Guide

**Last Updated:** October 7, 2025

## Overview

This document clarifies the database architecture and environments to prevent confusion between development and production databases.

---

## Database Environments

### 🟢 **Production Database (Neon Cloud)**
- **Type:** PostgreSQL (Neon managed database)
- **Connection:** Set via Replit Environment Variable `DATABASE_URL`
- **URL Pattern:** `postgresql://neondb_owner:***@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`
- **Used By:** 
  - Production website: https://pricecomparehub.com
  - Deployed Replit app
  - Background jobs and webhooks
- **Access:**
  - Via Replit environment variable: `$DATABASE_URL`
  - Via Replit SQL console (Database tab)
  - Via `psql "$DATABASE_URL"` in terminal

### 🔵 **Development Database (Local)**
- **Type:** PostgreSQL (Local instance - NOT currently running)
- **Connection:** Defined in `.env` file (NOT used in production)
- **URL:** `postgresql://user:password@localhost:5432/pricecompare`
- **Used By:**
  - Local development only (when running `npm run dev`)
  - NOT used by deployed production
- **Status:** ⚠️ Currently not running (connection refused)

---

## ⚠️ IMPORTANT: Which Database Am I Using?

### When Running Code in Terminal/Shell
```bash
# Check current DATABASE_URL
echo $DATABASE_URL
# Returns: postgresql://neondb_owner:***@ep-lingering-hat...  (PRODUCTION)
```

The terminal uses **Replit's environment variable**, which points to **Neon production database**.

### When Running the Application
```bash
# Production mode (Replit deployment)
NODE_ENV=production node dist/index.js
# Uses: Neon production database (from environment variable)

# Development mode (local)
npm run dev
# Uses: .env file settings (local database - currently not running)
```

### When Browsing the Website
- **https://pricecomparehub.com** → Neon production database
- **localhost:3000** (if running) → .env file database (local)

---

## Common Confusion Points ❗

### Issue 1: "I reset the database but still see data"
**Explanation:** You likely reset the LOCAL database (via .env), but the production website uses the NEON database.

**Solution:** Always use `$DATABASE_URL` environment variable:
```bash
# Correct - resets PRODUCTION (Neon)
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Wrong - tries to reset LOCAL (not running)
psql "postgresql://user:password@localhost:5432/pricecompare" -c "..."
```

### Issue 2: "Terminal queries show 0 rows but website shows data"
**Explanation:** The website might be using a different database than your terminal queries.

**Solution:** Verify you're querying the same database:
```bash
# Check what database the website uses
curl -s http://localhost:5000/api/health | grep -o "status.*ok"

# Confirm your terminal is using production
echo $DATABASE_URL
```

### Issue 3: "I deployed code but nothing changed"
**Explanation:** You need to rebuild the production bundle after code changes.

**Solution:**
```bash
# 1. Commit and push changes
git add -A && git commit -m "..." && git push

# 2. Rebuild production bundle
npm run build

# 3. Restart server (Replit deployment auto-restarts)
# OR manually: npm run start
```

---

## Database Operations

### Querying Production Database
```bash
# Always use $DATABASE_URL for production
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM products;"

# Run migration scripts
psql "$DATABASE_URL" -f migrations/seed-production-category-templates.sql
```

### Resetting Production Database (⚠️ DESTRUCTIVE)
```bash
# 1. Wipe database (drops all tables, data, and schemas)
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 2. Recreate schema
npm run db:push  # Runs drizzle-kit push

# 3. Seed essential data
bash scripts/seed-production-data.sh
```

### Seeding Production Data
```bash
# Automated seeding (recommended)
bash scripts/seed-production-data.sh

# Manual seeding
psql "$DATABASE_URL" -f migrations/seed-production-category-templates.sql
psql "$DATABASE_URL" -f migrations/seed-production-vendor-mappings.sql
```

---

## Environment Variables

### Production Environment (Replit)
Set in **Replit Secrets** (automatically injected as environment variables):

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://neondb_owner:***@ep-lingering-hat...` | Production database connection |
| `ZOHO_WEBHOOK_SECRET` | `your-webhook-secret` | Zoho webhook verification |
| `SMTP_HOST` | `mail.smtp2go.com` | Email service |
| `NODE_ENV` | `production` | Environment mode |

### Development Environment (Local)
Set in `.env` file (NOT used in production):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/pricecompare
NODE_ENV=development
```

---

## Vendor Source Standardization

### Standard Vendor Short Codes
All products should use these standardized vendor source codes:

| Vendor Name | Short Code (Correct) | Old Names (Migrated) |
|-------------|---------------------|----------------------|
| Sports South | `sports-south` | ~~`Sports South`~~ |
| Bill Hicks & Co. | `bill-hicks` | ~~`Bill Hicks & Co.`~~ |
| Chattanooga Shooting Supplies | `chattanooga` | ~~`Chattanooga Shooting Supplies`~~ |
| GunBroker | `gunbroker` | ~~`GunBroker.com`~~ |
| Lipsey's Inc. | `lipseys` | ~~`Lipsey's Inc.`~~, ~~`Lipsey's`~~ |

### Consolidating Vendor Sources
If products have inconsistent vendor sources (e.g., mix of `Sports South` and `sports-south`):

**Option 1: Via Browser (Recommended)**
1. Go to https://pricecomparehub.com
2. Open browser console (F12)
3. Run:
```javascript
fetch('/api/admin/migrate-product-sources', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(data => console.log('Updated:', data.totalUpdated, 'products'));
```

**Option 2: Via SQL**
```bash
psql "$DATABASE_URL" -f scripts/consolidate-vendor-sources.sql
```

---

## Troubleshooting

### "Connection refused" when querying database
**Cause:** Trying to connect to local database that's not running

**Solution:** Use `$DATABASE_URL` instead:
```bash
# Wrong
psql "postgresql://user:password@localhost:5432/pricecompare" -c "..."

# Correct
psql "$DATABASE_URL" -c "..."
```

### "0 products found" but website shows products
**Cause:** Querying wrong database or old cached results

**Solution:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Verify database connection:
```bash
echo $DATABASE_URL  # Should show Neon URL
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM products;"
```

### Changes don't appear after deployment
**Cause:** Production bundle not rebuilt

**Solution:**
```bash
npm run build  # Rebuild TypeScript to JavaScript
# Replit auto-restarts, or manually restart
```

---

## Database Schema Management

### Updating Schema (Development → Production)

1. **Make schema changes** in `migrations/schema.ts` or `shared/schema.ts`

2. **Push to database:**
```bash
# Push schema changes to production
npm run db:push
```

3. **Verify schema:**
```bash
psql "$DATABASE_URL" -c "\d table_name"
```

4. **Commit changes:**
```bash
git add migrations/ shared/
git commit -m "Update database schema"
git push
```

---

## Quick Reference Commands

```bash
# Check which database you're using
echo $DATABASE_URL

# Query production database
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM products;"

# Reset production database
bash scripts/reset-production-db.sh

# Seed production data
bash scripts/seed-production-data.sh

# Rebuild production code
npm run build

# Check git status before deployment
git status

# Deploy to production
git push  # Replit auto-deploys on push
```

---

## Related Documentation

- [Production Migration Guide](./PRODUCTION_MIGRATION_GUIDE.md) - Seeding category templates and vendor mappings
- [Vendor Code Standard](./VENDOR_CODE_STANDARD_FINAL.md) - Vendor naming conventions
- [Subscription Creation System](./SUBSCRIPTION_CREATION_SYSTEM.md) - Webhook provisioning flow

---

## Support

If you're unsure which database you're connected to:

1. **Check environment variable:** `echo $DATABASE_URL`
2. **Test query:** `psql "$DATABASE_URL" -c "SELECT current_database(), version();"`
3. **Verify via API:** `curl http://localhost:5000/api/health`

**Rule of Thumb:** 
- Terminal commands → Use `$DATABASE_URL` (points to Neon production)
- Production website → Uses `$DATABASE_URL` (Neon production)  
- Local dev server → Uses `.env` file (local database - not currently running)


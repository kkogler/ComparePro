# Database Setup & Environment Guide

**Last Updated:** October 15, 2025

## Overview

This document clarifies the database architecture and environments. The application uses **two hosted NEON PostgreSQL databases** - one for development and one for production. **No local PostgreSQL database is required.**

---

## 🚨 CRITICAL: Replit Deployment Secrets Configuration

**⚠️ WARNING: DO NOT CLICK "Sync to Workspace" ON DEPLOYMENT DATABASE_URL**

### The Correct Setup (Do Not Change!)

**Workspace Secret (Development):**
- Location: Tools → Secrets → DATABASE_URL  
- Value: `postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`
- Purpose: Safe development/testing environment

**Deployment Secret (Production):**
- Location: Tools → Publishing → Advanced Settings → Production app secrets → DATABASE_URL
- Value: `postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`
- Status: **MUST show yellow link icon (Syncing Disabled)**
- Purpose: Live user data

### 🚫 NEVER DO THIS:
- ❌ Click "Sync to Workspace" on deployment DATABASE_URL (overwrites production with dev!)
- ❌ Edit workspace DATABASE_URL to point to production  (makes dev work affect live users!)
- ❌ Click "Sync from Workspace" on deployment DATABASE_URL (same problem!)

### ✅ How to Verify Configuration:
Run the verification script anytime:
```bash
bash scripts/verify-database-config.sh
```

Or check manually:
1. Workspace: `echo $DATABASE_URL` should show `ep-lingering-hat-adb2bp8d`
2. Deployment: Tools → Publishing → Advanced Settings → DATABASE_URL should show `ep-lingering-sea-adyjzybe` with yellow icon

---

## Database Environments

### 🔵 **Development Database (NEON Cloud)**
- **Type:** PostgreSQL (NEON managed database)
- **Connection:** Set via `DATABASE_URL` environment variable
- **URL Pattern:** `postgresql://neondb_owner:***@ep-dev-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
- **Used By:** 
  - Local development (when running `npm run dev`)
  - Testing and staging environments
  - Development team members
- **Access:**
  - Via environment variable: `$DATABASE_URL`
  - Via NEON console: https://console.neon.tech/
  - Via `psql "$DATABASE_URL"` in terminal

### 🟢 **Production Database (NEON Cloud)**
- **Type:** PostgreSQL (NEON managed database)
- **Connection:** Set via production hosting Environment Variable `DATABASE_URL`
- **URL Pattern:** `postgresql://neondb_owner:***@ep-prod-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
- **Used By:** 
  - Production website: https://pricecomparehub.com
  - Deployed production app
  - Background jobs and webhooks
- **Access:**
  - Via production environment variable: `$DATABASE_URL`
  - Via NEON console: https://console.neon.tech/
  - Via `psql "$DATABASE_URL"` in terminal

---

## ⚠️ IMPORTANT: Which Database Am I Using?

### When Running Code in Terminal/Shell
```bash
# Check current DATABASE_URL
echo $DATABASE_URL
# Returns the database URL currently set in your environment
```

**For Development:** Set `DATABASE_URL` to your development NEON database  
**For Production:** The production environment automatically uses the production NEON database

### When Running the Application
```bash
# Development mode
npm run dev
# Uses: DATABASE_URL from your environment (should be development NEON)

# Production mode (production deployment)
NODE_ENV=production node dist/index.js
# Uses: DATABASE_URL from production environment (production NEON)
```

### When Browsing the Website
- **https://pricecomparehub.com** → Production NEON database
- **localhost:5000** (if running locally) → Development NEON database (via your local DATABASE_URL)

---

## Common Confusion Points ❗

### Issue 1: "I'm not sure which database I'm connected to"
**Explanation:** Both development and production use NEON databases, so it's important to verify which one you're using.

**Solution:** Always check your `DATABASE_URL`:
```bash
# Check which database you're connected to
echo $DATABASE_URL

# Development should show: ep-dev-xxxxx
# Production should show: ep-prod-xxxxx
```

### Issue 2: "Changes in dev are appearing in production"
**Explanation:** Your `DATABASE_URL` is pointing to the production database instead of development.

**Solution:** Set the correct database URL for development:
```bash
# Set development database
export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."

# Verify it's set correctly
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

### Querying Databases
```bash
# Query development database
export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM products;"

# Query production database (be careful!)
export DATABASE_URL="postgresql://...@ep-prod-xxxxx..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM products;"
```

### Running Migrations
```bash
# Push schema changes to development
export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."
npm run db:push

# After testing, push to production
export DATABASE_URL="postgresql://...@ep-prod-xxxxx..."
npm run db:push
```

### Resetting a Database (⚠️ DESTRUCTIVE)
```bash
# 1. Wipe database (drops all tables, data, and schemas)
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 2. Recreate schema
npm run db:push  # Runs drizzle-kit push

# 3. Seed essential data (if you have seed scripts)
bash scripts/seed-production-data.sh
```

⚠️ **Always ensure you're connected to the correct database before running destructive operations!**

---

## Environment Variables

### Development Environment
Set in `.env` file or export in your shell:

```env
# Development NEON Database
DATABASE_URL=postgresql://neondb_owner:***@ep-dev-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Application Settings
NODE_ENV=development
SESSION_SECRET=your-dev-session-secret
CREDENTIAL_ENCRYPTION_KEY=your-dev-encryption-key
BASE_URL=http://localhost:5000

# Optional Email Settings (for testing)
SENDGRID_API_KEY=your-sendgrid-key
```

### Production Environment
Set in **Production Hosting Secrets** (Replit, Heroku, Vercel, etc.):

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://neondb_owner:***@ep-prod-xxxxx...` | Production NEON database connection |
| `NODE_ENV` | `production` | Environment mode |
| `SESSION_SECRET` | `your-prod-secret` | Session encryption |
| `CREDENTIAL_ENCRYPTION_KEY` | `your-prod-key` | Credential encryption |
| `BASE_URL` | `https://pricecomparehub.com` | Production URL |
| `SENDGRID_API_KEY` | `your-key` | Email service |
| `ZOHO_WEBHOOK_SECRET` | `your-webhook-secret` | Zoho webhook verification |

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
**Cause:** Invalid `DATABASE_URL` or database is not accessible

**Solution:** Verify your connection string:
```bash
# Check your DATABASE_URL is set
echo $DATABASE_URL

# Test connection
psql "$DATABASE_URL" -c "SELECT current_database();"

# Ensure it includes ?sslmode=require for NEON
```

### "I'm modifying the wrong database"
**Cause:** `DATABASE_URL` is pointing to the wrong environment

**Solution:** Always verify which database you're connected to:
```bash
# Check current connection
echo $DATABASE_URL

# Development should show: ep-dev-xxxxx
# Production should show: ep-prod-xxxxx

# Set the correct one
export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."  # For dev
```

### "Changes don't appear after deployment"
**Cause:** Production bundle not rebuilt

**Solution:**
```bash
npm run build  # Rebuild TypeScript to JavaScript
# Deployment platform auto-restarts, or manually restart
```

### "Database is suspended" (NEON-specific)
**Cause:** NEON databases auto-suspend after inactivity

**Solution:**
- Simply query the database to wake it up
- Or configure "Always Active" in NEON console (paid feature)
```bash
psql "$DATABASE_URL" -c "SELECT 1;"  # Wakes up the database
```

---

## Database Schema Management

### Updating Schema (Development → Production)

1. **Make schema changes** in `shared/schema.ts`

2. **Push to development first:**
```bash
# Set development database
export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."

# Push schema changes
npm run db:push

# Test thoroughly
npm run dev
```

3. **Push to production after testing:**
```bash
# Set production database
export DATABASE_URL="postgresql://...@ep-prod-xxxxx..."

# Push schema changes
npm run db:push
```

4. **Verify schema:**
```bash
psql "$DATABASE_URL" -c "\d table_name"
```

5. **Commit changes:**
```bash
git add shared/
git commit -m "Update database schema"
git push
```

---

## Quick Reference Commands

```bash
# Check which database you're using
echo $DATABASE_URL

# Switch to development database
export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."

# Switch to production database
export DATABASE_URL="postgresql://...@ep-prod-xxxxx..."

# Query current database
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM products;"

# Push schema changes
npm run db:push

# Rebuild production code
npm run build

# Check git status before deployment
git status

# Deploy to production
git push  # Auto-deploys on most platforms
```

---

## Backup and Recovery

### NEON Built-in Backups
- Automatic daily backups (retained for 7 days on free tier, longer on paid)
- Point-in-time recovery available
- Access through NEON console: https://console.neon.tech/

### Manual Backup
```bash
# Export database to SQL file
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql

# Restore from backup
psql "$DATABASE_URL" < backup-20251009.sql
```

### Branching (NEON Feature)
NEON supports database branching - create a copy of production for testing:
```bash
# 1. Create branch in NEON console from production
# 2. Get branch connection URL
# 3. Use branch URL for development/testing
export DATABASE_URL="postgresql://...@ep-branch-xxxxx..."
```

---

## Related Documentation

- [Production Migration Guide](../migrations/PRODUCTION_MIGRATION_GUIDE.md) - Seeding category templates and vendor mappings
- [Vendor Code Standard](./VENDOR_CODE_STANDARD_FINAL.md) - Vendor naming conventions
- [Subscription Creation System](./SUBSCRIPTION_CREATION_SYSTEM.md) - Webhook provisioning flow

---

## Support

If you're unsure which database you're connected to:

1. **Check environment variable:** `echo $DATABASE_URL`
2. **Test query:** `psql "$DATABASE_URL" -c "SELECT current_database(), version();"`
3. **Verify via API:** `curl http://localhost:5000/api/health`
4. **Check NEON console:** https://console.neon.tech/ to see both databases

**Rule of Thumb:** 
- Always verify `DATABASE_URL` before running any database operations
- Development NEON → Safe for testing and experimentation
- Production NEON → Handle with care, always test in dev first


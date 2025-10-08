# Database Migration Guide

## Current Situation

You have **3 databases** that need to be synchronized:

### 1. Hosted NEON Database (Development/Staging)
- **Connection**: ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech
- **Products**: ~65,000
- **Accessed by**: `npm run dev:cursor` (uses current DATABASE_URL)
- **Status**: ✅ Has most recent changes and complete data

### 2. Production NEON Database
- **Website**: https://pricecomparehub.com/
- **Products**: ~450
- **Status**: ⚠️ Outdated, needs to be updated from Hosted NEON

### 3. Local PostgreSQL Database
- **Location**: Local machine
- **Products**: 0 (empty)
- **Accessed by**: `./start-dev.sh`
- **Status**: 🆕 Empty, needs to be populated

## The Problem

After the database corruption incident, development work accidentally continued on the Hosted NEON database instead of the local PostgreSQL. Now:

- ✅ **Hosted NEON** has the correct schema and most recent data (65k products)
- ⚠️ **Production** has outdated data (450 products)
- 🆕 **Local Dev** is empty

## The Solution

Copy the Hosted NEON database (with correct schema and data) to both Production and Local Development databases.

---

## Migration Steps

### Step 1: Verify Current Database Setup

```bash
# Check which databases are accessible
tsx scripts/check-all-databases.ts
```

This will show:
- Product counts in each database
- Table counts and schema consistency
- Connection status

### Step 2: Set Up Environment Variables

You need to configure access to all three databases:

```bash
# 1. Hosted NEON (already set as DATABASE_URL)
export DATABASE_URL="postgresql://neondb_owner:npg_...@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# 2. Production NEON (you need to get this from pricecomparehub.com deployment)
export PRODUCTION_DATABASE_URL="postgresql://..."

# 3. Local PostgreSQL (automatically detected)
# Uses: postgresql://user:password@/pricecompare?host=$HOME/.postgresql/sockets
```

**To find your Production DATABASE_URL:**
1. Log into your production hosting provider (Replit, Heroku, Vercel, etc.)
2. Look in environment variables or secrets
3. It should be another Neon database connection string

### Step 3: Export from Hosted NEON

```bash
# Export the Hosted NEON database (the one with 65k products)
tsx scripts/export-database.ts
```

This creates a backup file in `./backups/hosted-neon-backup-YYYY-MM-DD.sql`

### Step 4: Import to Production

⚠️ **IMPORTANT**: This will REPLACE all data in production!

```bash
# Set production database URL first
export PRODUCTION_DATABASE_URL="your-production-connection-string"

# Import to production
tsx scripts/import-database.ts production
```

You'll be prompted to confirm before the import proceeds.

### Step 5: Import to Local Development

```bash
# Make sure local PostgreSQL is running
./ensure-postgres.sh

# Import to local development database
tsx scripts/import-database.ts local
```

### Step 6: Verify Migration

```bash
# Check all databases again
tsx scripts/check-all-databases.ts
```

All three databases should now have:
- ✅ Same schema (same number of tables)
- ✅ Same data (~65,000 products in all three)

---

## Environment Configuration

### For Development Work (Local PostgreSQL)

```bash
# Use local database
./start-dev.sh
```

This automatically sets `DATABASE_URL` to your local PostgreSQL instance.

### For Testing with Hosted NEON

```bash
# Use hosted NEON database
npm run dev:cursor
```

This uses whatever is in your current `DATABASE_URL` environment variable.

### For Production

Production should be configured with its own `DATABASE_URL` in your deployment platform's environment variables.

---

## Going Forward

### Recommended Setup

1. **Local Development** → Local PostgreSQL (via `./start-dev.sh`)
2. **Testing/Staging** → Hosted NEON (via `npm run dev:cursor`)
3. **Production** → Production NEON (via production deployment)

### Database Sync Strategy

When you need to refresh local/staging from production:

```bash
# Export from production
export DATABASE_URL="$PRODUCTION_DATABASE_URL"
tsx scripts/export-database.ts

# Import to local
tsx scripts/import-database.ts local
```

### Schema Changes

When you make schema changes:

```bash
# 1. Update shared/schema.ts
# 2. Push to local database first (testing)
npm run db:push

# 3. Test locally
./start-dev.sh

# 4. If tests pass, push to staging
export DATABASE_URL="your-hosted-neon-url"
npm run db:push

# 5. If staging tests pass, push to production
export DATABASE_URL="$PRODUCTION_DATABASE_URL"
npm run db:push
```

---

## Troubleshooting

### "Cannot connect to database"

- Check that the database URL is correct
- For Neon databases, ensure `?sslmode=require` is in the URL
- For local PostgreSQL, ensure it's running: `./ensure-postgres.sh`

### "pg_dump not found"

Install PostgreSQL client tools:
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql
```

### "Permission denied"

For local PostgreSQL, check that the socket directory exists:
```bash
mkdir -p ~/.postgresql/sockets
```

### "Database already has data"

The import script uses `--clean --if-exists` flags, which will drop existing tables before importing. This is safe but destructive - make sure you have a backup first!

---

## Backup Strategy

### Automated Backups

Consider setting up automated backups:

```bash
# Add to crontab (daily at 2am)
0 2 * * * cd /path/to/project && tsx scripts/export-database.ts
```

### Manual Backups Before Major Changes

```bash
# Always backup before schema changes or major updates
tsx scripts/export-database.ts
```

Backups are stored in `./backups/` directory.

---

## Quick Reference

```bash
# Check all databases
tsx scripts/check-all-databases.ts

# Export current database
tsx scripts/export-database.ts

# Import to production (requires PRODUCTION_DATABASE_URL)
tsx scripts/import-database.ts production

# Import to local
tsx scripts/import-database.ts local

# Run local dev (uses local PostgreSQL)
./start-dev.sh

# Run with hosted NEON
npm run dev:cursor

# Push schema changes to current database
npm run db:push
```

---

## Need Help?

If you encounter issues:

1. Check which database you're connected to:
   ```bash
   echo $DATABASE_URL
   ```

2. Verify database connectivity:
   ```bash
   tsx scripts/check-all-databases.ts
   ```

3. Check the logs in `./logs/` directory

4. Ensure all environment variables are set correctly



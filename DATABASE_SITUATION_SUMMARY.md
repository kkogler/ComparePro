# Database Situation Summary

## What Happened

After the database corruption incident, you were working on development thinking you were using the **local PostgreSQL database**, but you were actually working on a **Hosted NEON database**. This Hosted NEON database now has all your recent changes and is the most complete database.

---

## Current Status (Verified)

### ✅ 1. Hosted NEON Database (MOST COMPLETE)
- **Location**: `ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech`
- **Products**: **66,982** ✅
- **Tables**: **37** ✅
- **Status**: Has the correct schema and most recent changes
- **Accessed by**: `npm run dev:cursor` (uses current `DATABASE_URL`)

### ⚠️ 2. Production NEON Database (OUTDATED)
- **Location**: https://pricecomparehub.com/
- **Products**: ~450 (outdated)
- **Status**: **NEEDS UPDATE** - Should be synced from Hosted NEON
- **Note**: You need to provide the `PRODUCTION_DATABASE_URL` environment variable

### 🆕 3. Local PostgreSQL (EMPTY)
- **Location**: Local machine (`~/.postgresql/sockets`)
- **Products**: 0 (empty)
- **Status**: **NEEDS SETUP** - Should be populated from Hosted NEON
- **Accessed by**: `./start-dev.sh`

---

## The Solution

**Copy the Hosted NEON database to both Production and Local Development.**

This will ensure:
- ✅ All three databases have the same schema (37 tables)
- ✅ All three databases have the same data (66,982 products)
- ✅ You can work locally without affecting production
- ✅ Production has all your recent changes

---

## Quick Start Guide

### Step 1: Find Your Production Database URL

You need to get the production database connection string. Check:

- **Replit**: Go to your production Repl → Secrets/Environment Variables → Find `DATABASE_URL`
- **Heroku**: `heroku config:get DATABASE_URL -a your-app-name`
- **Vercel**: Check Project Settings → Environment Variables
- **Other hosting**: Check your deployment platform's environment variables

The production URL should look like:
```
postgresql://username:password@ep-xxxxx.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Once you have it, set it:
```bash
export PRODUCTION_DATABASE_URL="postgresql://..."
```

### Step 2: Check All Databases

```bash
npm run db:check
```

This will show you the current status of all three databases.

### Step 3: Export from Hosted NEON

```bash
npm run db:export
```

This creates a backup file in `./backups/` with all data from the Hosted NEON database.

### Step 4: Import to Production

⚠️ **IMPORTANT**: This will replace all data in production!

```bash
# Make sure PRODUCTION_DATABASE_URL is set first
export PRODUCTION_DATABASE_URL="your-production-connection-string"

# Import to production
npm run db:import:prod
```

You'll be asked to confirm before the import proceeds.

### Step 5: Import to Local Development

```bash
# Start local PostgreSQL
./ensure-postgres.sh

# Import to local
npm run db:import:local
```

### Step 6: Verify Everything

```bash
npm run db:check
```

All three databases should now show:
- ✅ ~66,982 products
- ✅ 37 tables
- ✅ Connected successfully

---

## Daily Development Workflow

### For Local Development (Recommended)

```bash
# Start local PostgreSQL and run the app
./start-dev.sh
```

This uses your **local PostgreSQL database**, so you can make changes without affecting production or staging.

### For Testing on Hosted NEON

```bash
# Use the hosted NEON database
npm run dev:cursor
```

This uses the **Hosted NEON database** (the one with 66k products).

### For Production

Production runs automatically with its own `DATABASE_URL` set in your deployment platform.

---

## Database Schema Changes

When you need to modify the database schema:

1. **Edit** `shared/schema.ts` with your changes

2. **Test locally first**:
   ```bash
   ./start-dev.sh  # This uses local PostgreSQL
   npm run db:push  # Push schema changes to local DB
   # Test your changes locally
   ```

3. **Push to staging** (Hosted NEON):
   ```bash
   export DATABASE_URL="postgresql://neondb_owner:...@ep-lingering-hat..."
   npm run db:push
   # Test on staging
   ```

4. **Push to production** (only after testing):
   ```bash
   export DATABASE_URL="$PRODUCTION_DATABASE_URL"
   npm run db:push
   ```

---

## Available Commands

```bash
# Check status of all three databases
npm run db:check

# Export current database to backup file
npm run db:export

# Import backup to production (requires PRODUCTION_DATABASE_URL)
npm run db:import:prod

# Import backup to local development
npm run db:import:local

# Push schema changes to current database
npm run db:push

# Run local development (uses local PostgreSQL)
./start-dev.sh

# Run with hosted NEON (uses DATABASE_URL)
npm run dev:cursor
```

---

## Environment Variables Reference

```bash
# Hosted NEON (current DATABASE_URL - already set)
DATABASE_URL="postgresql://neondb_owner:npg_...@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Production NEON (you need to provide this)
PRODUCTION_DATABASE_URL="postgresql://..."

# Local PostgreSQL (automatically detected)
# Uses: postgresql://user:password@/pricecompare?host=$HOME/.postgresql/sockets
```

---

## Important Notes

### ⚠️ Before Importing to Production

1. **Backup production first** (if it has any data you might need)
2. **Verify the export file** looks good (check file size)
3. **Test locally first** to make sure everything works
4. **Schedule during low-traffic time** if possible

### 🔒 Security

- Never commit database credentials to git
- Use environment variables for all database URLs
- Keep backups in a secure location (the `./backups/` folder is gitignored)

### 📊 Backups

The `npm run db:export` command creates timestamped backup files:
```
backups/
  hosted-neon-backup-2025-10-08.sql
  hosted-neon-backup-2025-10-07.sql
  ...
```

Consider setting up automated daily backups for production.

---

## Troubleshooting

### "Cannot connect to local PostgreSQL"

```bash
# Start PostgreSQL
./ensure-postgres.sh

# Check if it's running
ps aux | grep postgres
```

### "PRODUCTION_DATABASE_URL not set"

You need to get this from your production hosting provider. See Step 1 above.

### "pg_dump not found"

Install PostgreSQL client tools:
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Replit (already installed)
```

### "Permission denied" on import

Make sure you have write permissions to the target database. For production, you may need admin credentials.

---

## Questions?

Run the database checker to see current status:
```bash
npm run db:check
```

Or check the detailed migration guide:
```bash
cat DATABASE_MIGRATION_GUIDE.md
```



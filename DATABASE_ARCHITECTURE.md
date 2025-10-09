# Database Architecture

**Last Updated:** October 9, 2025

## Overview

This application uses a **two-database architecture** with both databases hosted on **NEON PostgreSQL**. There is no local PostgreSQL database requirement.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Code                          │
│                  (Local Development)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ DATABASE_URL environment variable
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│ Development  │          │ Production   │
│ NEON Database│          │ NEON Database│
├──────────────┤          ├──────────────┤
│ ep-dev-xxxxx │          │ ep-prod-xxxxx│
│              │          │              │
│ For testing  │          │ Live site    │
│ & dev work   │          │ data         │
└──────────────┘          └──────────────┘
```

---

## Database Details

### Development Database

**Purpose:** Development, testing, and experimentation

**Connection:**
```bash
DATABASE_URL=postgresql://neondb_owner:***@ep-dev-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**Used By:**
- Local development (`npm run dev`)
- Development team members
- Testing new features
- Schema changes (tested here first)

**Characteristics:**
- Safe to reset or modify
- Can contain test data
- Separate from production
- No impact on live site

### Production Database

**Purpose:** Live production application

**Connection:**
```bash
DATABASE_URL=postgresql://neondb_owner:***@ep-prod-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**Used By:**
- Production website (https://pricecomparehub.com)
- Production deployments
- Real customer data
- Live transactions

**Characteristics:**
- Contains real customer data
- Must be handled with care
- Automatic daily backups via NEON
- Always test changes in dev first

---

## Why Two NEON Databases? (No Local PostgreSQL)

### Benefits

1. **Consistency:** Same database technology in all environments
2. **No Local Setup:** No need to install or manage local PostgreSQL
3. **Collaboration:** Team members can share development database
4. **Cloud Features:** Automatic backups, monitoring, and scaling
5. **Simplicity:** One less service to manage locally

### Trade-offs

1. **Internet Required:** Need connection to work
2. **Cost:** Two NEON databases (but free tier is generous)
3. **Slower Than Local:** Network latency vs. localhost

---

## Development Workflow

### Daily Development

```bash
# 1. Set development database
export DATABASE_URL="postgresql://neondb_owner:***@ep-dev-xxxxx..."

# 2. Start development server
npm run dev

# 3. Make changes and test
# All changes affect only the development database
```

### Schema Changes

```bash
# 1. Make changes to shared/schema.ts

# 2. Test in development
export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."
npm run db:push
npm run dev
# Test thoroughly!

# 3. Apply to production
export DATABASE_URL="postgresql://...@ep-prod-xxxxx..."
npm run db:push
```

### Syncing Data Between Databases

If you need production data in development for testing:

**Option 1: NEON Branch (Recommended)**
```bash
# 1. Create a branch from production in NEON console
# 2. Use branch URL as your development DATABASE_URL
# 3. Branch includes copy of all production data
```

**Option 2: Manual Export/Import**
```bash
# 1. Export from production
pg_dump "postgresql://...@ep-prod-xxxxx..." > prod_backup.sql

# 2. Import to development
psql "postgresql://...@ep-dev-xxxxx..." < prod_backup.sql
```

---

## Environment Configuration

### Development (.env file)

```bash
# Development NEON Database
DATABASE_URL=postgresql://neondb_owner:***@ep-dev-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Application Settings
NODE_ENV=development
SESSION_SECRET=dev-session-secret-change-in-production
CREDENTIAL_ENCRYPTION_KEY=dev-encryption-key-change-in-production
BASE_URL=http://localhost:5000

# Optional: Email testing
SENDGRID_API_KEY=your-sendgrid-key
```

### Production (Hosting Provider Secrets)

Set these in your production hosting environment (Replit, Heroku, Vercel, etc.):

```bash
# Production NEON Database
DATABASE_URL=postgresql://neondb_owner:***@ep-prod-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Application Settings
NODE_ENV=production
SESSION_SECRET=strong-random-production-secret
CREDENTIAL_ENCRYPTION_KEY=strong-random-production-key
BASE_URL=https://pricecomparehub.com

# Email Service
SENDGRID_API_KEY=your-production-sendgrid-key

# Other Services
ZOHO_WEBHOOK_SECRET=your-webhook-secret
# ... additional production secrets
```

---

## Best Practices

### Always Know Which Database You're Using

```bash
# Before ANY database operation, check:
echo $DATABASE_URL

# Look for the database identifier:
# ep-dev-xxxxx  = Development (safe)
# ep-prod-xxxxx = Production (be careful!)
```

### Test Everything in Development First

```bash
# ✅ CORRECT workflow
export DATABASE_URL="dev-url"
npm run db:push  # Test schema change
# ... thorough testing ...
export DATABASE_URL="prod-url"
npm run db:push  # Apply to production

# ❌ WRONG workflow
export DATABASE_URL="prod-url"
npm run db:push  # Untested change to production!
```

### Use NEON Console for Monitoring

- View query performance
- Check database size and usage
- Monitor active connections
- Review automatic backups
- Create branches for testing

Access: https://console.neon.tech/

---

## Common Tasks

### Check Database Connection

```bash
echo $DATABASE_URL
psql "$DATABASE_URL" -c "SELECT current_database(), version();"
```

### Switch Databases

```bash
# Switch to development
export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."

# Switch to production
export DATABASE_URL="postgresql://...@ep-prod-xxxxx..."

# Verify the switch
echo $DATABASE_URL
```

### Reset Development Database

```bash
# Safe to do in development!
export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:push  # Recreate schema
```

### Backup Production Database

```bash
# Manual backup
export DATABASE_URL="postgresql://...@ep-prod-xxxxx..."
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql

# Or use NEON's automatic daily backups (in console)
```

---

## Troubleshooting

### "I accidentally modified production!"

1. **Don't Panic**
2. Check NEON console for automatic backups
3. Restore from backup (NEON has point-in-time recovery)
4. Or restore from manual backup if you have one

### "Database is suspended"

NEON databases auto-suspend after inactivity:
```bash
# Wake it up with any query
psql "$DATABASE_URL" -c "SELECT 1;"
```

### "Can't connect to database"

1. Check `DATABASE_URL` is set: `echo $DATABASE_URL`
2. Verify the URL includes `?sslmode=require`
3. Test connection: `psql "$DATABASE_URL" -c "SELECT 1;"`
4. Check NEON console for database status

### "Which database am I connected to?"

```bash
# Always check before operations
echo $DATABASE_URL | grep -o "ep-[^.]*"

# Output examples:
# ep-dev-xxxxx  → Development
# ep-prod-xxxxx → Production
```

---

## Security

### Database Credentials

- ✅ Store in environment variables only
- ✅ Never commit to git
- ✅ Use different credentials for dev and prod
- ✅ Rotate credentials periodically

### Access Control

- Limit production database access to necessary team members
- Use NEON's IP allowlist if needed (paid feature)
- Enable NEON's audit logging (paid feature)
- Use separate NEON projects for dev and prod

### Connection Security

- All connections use SSL (`?sslmode=require`)
- NEON enforces encrypted connections
- Use strong database passwords

---

## Migration from Old Architecture

If you're migrating from the old three-database architecture (Hosted NEON, Production NEON, Local PostgreSQL):

### What Changed

- ❌ **Removed:** Local PostgreSQL database
- ✅ **Kept:** Development NEON database (formerly "Hosted NEON")
- ✅ **Kept:** Production NEON database

### Migration Steps

1. **No action needed** - If you were using the "Hosted NEON" for development, just continue using it
2. **Update documentation** - This file and others have been updated
3. **Remove local PostgreSQL scripts** - No longer needed
4. **Update team** - Inform everyone of the new architecture

### Obsolete Files/Scripts

These are no longer used:
- `setup-local-db.sh` - Local PostgreSQL setup
- `ensure-postgres.sh` - Local PostgreSQL checks
- `start-dev.sh` - Used local PostgreSQL (now just use `npm run dev`)

---

## Related Documentation

- [README.md](./README.md) - Quick start guide
- [README_DATABASE_SETUP.md](./README_DATABASE_SETUP.md) - Database setup instructions
- [docs/DATABASE_SETUP_GUIDE.md](./docs/DATABASE_SETUP_GUIDE.md) - Detailed environment guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Application architecture

---

## Summary

✅ **Two NEON databases**: Development and Production  
✅ **No local PostgreSQL**: Everything is cloud-hosted  
✅ **Simple workflow**: Set `DATABASE_URL` to switch between databases  
✅ **Automatic backups**: NEON handles backups for both databases  
✅ **Easy collaboration**: Team shares development database  

**Key Principle:** Always know which database you're connected to, and always test in development first!





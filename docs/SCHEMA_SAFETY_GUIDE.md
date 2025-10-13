# Database Schema Safety Guide

## ⚠️ What Went Wrong

The `credentials` column kept disappearing because:
1. Schema used incorrect Drizzle syntax: `text("credentials", { mode: 'json' })`
2. Drizzle couldn't parse it properly
3. Deployment ran `db:push --force` which auto-dropped "unrecognized" columns
4. Every deployment → credentials deleted → credentials stopped working

## ✅ What's Fixed

1. **Schema corrected** to proper Drizzle syntax:
   ```typescript
   credentials: json("credentials").$type<Record<string, any>>()
   ```

2. **Deployment no longer pushes schema**:
   ```bash
   # OLD (DANGEROUS - caused schema mismatch):
   build = "npm ci && npm run build && npm run db:push -- --force"

   # NEW (SAFE - only validates):
   build = "npm ci && npm run build && npm run db:validate"
   ```

3. **Schema changes are now manual** (prevents mismatches):
   - Push to dev: `npm run db:push`
   - Test changes
   - Push to production: `DATABASE_URL=<prod> npm run db:push`
   - Deploy code

## 🛡️ Safe Schema Change Workflow

### Step 1: Make Schema Changes
```bash
# Edit shared/schema.ts with your changes
```

### Step 2: Apply to Development Database
```bash
npm run db:push
```
This pushes changes to your dev database for testing.

### Step 3: Test Your Changes
```bash
# Test the schema changes locally
# Make sure everything works!
```

### Step 4: Apply to Production Database
```bash
# Set DATABASE_URL to production
export DATABASE_URL="<production-database-url>"

# Push schema to production
npm run db:push

# Restore dev DATABASE_URL
export DATABASE_URL="<dev-database-url>"
```

### Step 5: Deploy the Code
```bash
git add shared/schema.ts
git commit -m "Update schema: [your change]"
git push
```

Deployment will validate schema (but NOT push it - you already did that manually).

## 🚫 Never Use These in Production

```bash
❌ npm run db:push -- --force    # Dangerous! Auto-drops columns
❌ Direct SQL changes             # Bypasses schema tracking
❌ Editing migrations/*.sql       # Breaks migration history
```

## ✅ Safe Commands

```bash
✅ npm run db:generate            # Create migration files
✅ npm run db:migrate              # Apply migrations safely
✅ npm run db:push                 # Quick iteration (dev only)
✅ npm run db:check                # Verify schema consistency
```

## 🔍 Pre-Deployment Checklist

Before deploying schema changes:

1. ✅ Generated migration file exists in `migrations/`
2. ✅ Reviewed SQL in migration file
3. ✅ Tested migration locally
4. ✅ No `--force` flags in deployment config
5. ✅ Migration committed to git

## 🆘 Recovery Plan

If schema gets out of sync again:

```bash
# 1. Check what's in production database
psql $DATABASE_URL -c "\d table_name"

# 2. Check what Drizzle thinks should be there
npm run db:check

# 3. Generate migration to fix differences
npm run db:generate

# 4. Review and apply
npm run db:migrate
```

## 📝 Key Takeaways

1. **Always generate migrations** - Don't use `db:push` in production
2. **Never use `--force`** - It's a nuclear option that destroys data
3. **Review SQL before applying** - Migration files show exactly what will happen
4. **Test locally first** - Apply migrations in dev before production
5. **Keep schema and DB in sync** - Use Drizzle's migration system properly

## 🔗 Related Files

- `.replit` - Deployment configuration (now uses `db:migrate`)
- `drizzle.config.ts` - Drizzle configuration
- `shared/schema.ts` - Source of truth for database schema
- `migrations/` - Generated SQL migration files (version history)


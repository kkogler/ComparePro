# 🚀 Development to Production Workflow

## 📋 Overview
This guide explains how to properly develop in the development environment and deploy to production while keeping live customers safe.

## 🏗️ Environment Setup

### Development Database
- **Database**: `ep-lingering-hat-adb2bp8d` (NEON PostgreSQL)
- **Purpose**: Development, testing, and staging
- **URL**: `postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`

### Production Database
- **Database**: `ep-lingering-sea-adyjzybe` (NEON PostgreSQL)
- **Purpose**: Live customers and production data
- **URL**: `postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`

## 🛠️ Development Workflow

### 1. Start Development Server
```bash
# Standard development (uses dev database)
npm run dev

# Development with production database (DANGEROUS - only for testing)
npm run dev:prod-db

# Clean development restart
npm run dev:clean
```

### 2. Environment Variables for Development
Set these in your development environment:
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
APP_URL=http://localhost:3000
BASE_URL=http://localhost:3000
SESSION_SECRET=dev-session-secret
CREDENTIAL_ENCRYPTION_KEY=dev-encryption-key-32-chars
```

### 3. Database Safety Checks
The server automatically detects which database you're using and shows warnings:

```
🔍 DATABASE ENVIRONMENT CHECK:
   Environment: DEVELOPMENT
   Database: DEVELOPMENT (ep-lingering-hat)

🚨🚨🚨 CRITICAL WARNING 🚨🚨🚨
   WORKSPACE is using PRODUCTION database!
   Development work will affect live users!

   Fix: Go to Tools → Secrets
   Set DATABASE_URL to development endpoint (ep-lingering-hat)
```

## 🚢 Production Deployment

### 1. Pre-deployment Checklist
- [ ] All changes tested in development
- [ ] Database migrations ready (if any)
- [ ] No breaking changes for existing customers
- [ ] Backup production database (if making schema changes)

### 2. Environment Variables for Production
Set these in your Runway/production environment:
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
APP_URL=https://your-production-domain.com
BASE_URL=https://your-production-domain.com
SESSION_SECRET=your-production-session-secret
CREDENTIAL_ENCRYPTION_KEY=your-production-encryption-key
GOOGLE_CLOUD_PROJECT_ID=your-production-gcp-project
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
```

### 3. Deploy to Runway
1. **Commit your changes** to GitHub
2. **Push to main branch**
3. **Runway auto-deploys** on push
4. **Monitor deployment logs** in Runway dashboard

## 🔄 Database Migration Workflow

### For Schema Changes:
1. **Test in development**:
   ```bash
   # Apply migration to dev database
   psql "$DATABASE_URL" -f migrations/0044_new_feature.sql
   ```

2. **Test thoroughly** in development

3. **Deploy code changes** to production first

4. **Apply migration to production**:
   ```bash
   # Set production DATABASE_URL temporarily
   export DATABASE_URL="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

   # Apply migration
   psql "$DATABASE_URL" -f migrations/0044_new_feature.sql
   ```

## 🛡️ Safety Features

### Automatic Database Detection
The server automatically detects which database you're using:

```typescript
const isDevDatabase = dbUrl.includes('ep-lingering-hat-adb2bp8d');
const isProdDatabase = dbUrl.includes('ep-lingering-sea-adyjzybe');

if (isProduction && isDevDatabase) {
  console.error('🚨 CRITICAL: Using DEV database in PRODUCTION!');
}
```

### Environment Warnings
- Development database in production environment = **CRITICAL WARNING**
- Production database in development environment = **WARNING**
- Wrong database for environment = **ERROR with fix instructions**

## 📊 Database Utilities

### Copy Production Data to Development
```bash
# Reset dev database from production (CAUTION: DELETES DEV DATA)
./scripts/reset-dev-from-prod-final.sh

# Compare databases
./scripts/compare-databases.sh

# Copy specific data
./scripts/simple-copy-data.sh
```

### Backup and Restore
```bash
# Backup production
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql "$DATABASE_URL" < backup_file.sql
```

## ✅ Deployment Checklist

### Before Deploying:
- [ ] Test all changes in development
- [ ] Verify database migrations work
- [ ] Check no critical warnings in server logs
- [ ] Ensure all environment variables are set correctly

### After Deployment:
- [ ] Verify `/api/health` returns 200
- [ ] Test critical user flows
- [ ] Check database queries work correctly
- [ ] Monitor for any errors in logs

## 🚨 Emergency Procedures

### If Something Goes Wrong:
1. **Check server logs** for errors
2. **Verify database connectivity**
3. **Test with development environment first**
4. **Rollback if necessary** (restore from backup)

### Rollback Procedure:
1. Restore production database from backup
2. Revert code changes if needed
3. Redeploy previous working version

## 🎯 Best Practices

1. **Never develop directly on production**
2. **Always test in development first**
3. **Use separate databases for dev/prod**
4. **Backup before making schema changes**
5. **Monitor server logs regularly**
6. **Test deployments during low-traffic periods**

## 📞 Getting Help

If you encounter issues:
1. Check the server logs for specific error messages
2. Verify database connectivity with health checks
3. Test in development environment first
4. Check environment variables are correctly set

---

**Remember**: Development = `ep-lingering-hat-adb2bp8d` | Production = `ep-lingering-sea-adyjzybe`

# Environment Configuration Guide

## Overview
This application uses separate databases and configurations for development and production environments to ensure safe development practices.

## Required Environment Variables

### Core Variables (Required)
```bash
# Environment type
NODE_ENV=development  # or 'production'

# Database connection
DATABASE_URL=postgresql://neondb_owner:***@your-db-host.neon.tech/neondb?sslmode=require
```

### Application Configuration
```bash
# Application URLs
APP_URL=http://localhost:3000
BASE_URL=http://localhost:3000

# Server port
PORT=3000
```

### Security
```bash
# Session management (generate secure random string)
SESSION_SECRET=your-super-secure-session-secret-here

# Credentials encryption (32 character key)
CREDENTIAL_ENCRYPTION_KEY=your-32-character-encryption-key-here
```

## Database URLs

### Development Database
```
postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Production Database
```
postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Environment Setup

### Development Setup
1. **Database**: Use development NEON database (`ep-lingering-hat-adb2bp8d`)
2. **Environment Variables**:
   ```bash
   NODE_ENV=development
   DATABASE_URL=postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
   APP_URL=http://localhost:3000
   ```

3. **Start Development**:
   ```bash
   npm run dev  # Uses correct dev database automatically
   ```

### Production Setup (Runway)
1. **Database**: Use production NEON database (`ep-lingering-sea-adyjzybe`)
2. **Environment Variables in Runway**:
   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
   APP_URL=https://your-production-domain.com
   ```

3. **Deploy**: `npm run deploy`

## Safety Features

### Automatic Database Detection
The server automatically detects which database you're using and shows warnings:

```
🔍 DATABASE ENVIRONMENT CHECK:
   Environment: DEVELOPMENT
   Database: DEVELOPMENT (ep-lingering-hat)

🚨🚨🚨 CRITICAL WARNING 🚨🚨🚨
   WORKSPACE is using PRODUCTION database!
   Development work will affect live users!
```

### Environment Validation
The server validates required environment variables on startup:
- `DATABASE_URL` (required)
- `NODE_ENV` (required)

If missing, the server will exit with an error message.

## Quick Setup Commands

### Test Current Setup
```bash
# Check which database is being used
npm run dev

# The server will show database environment check
```

### Switch to Production Database (for testing)
```bash
# DANGEROUS: Only use for testing production database connectivity
npm run dev:prod-db
```

### Pre-deployment Checks
```bash
# Test build and verify setup
npm run deploy:safe
```

## Troubleshooting

### "Missing required environment variables"
- Ensure `DATABASE_URL` and `NODE_ENV` are set
- Check that the database URL is accessible

### "Using wrong database for environment"
- Verify `DATABASE_URL` points to the correct database
- Development should use `ep-lingering-hat-adb2bp8d`
- Production should use `ep-lingering-sea-adyjzybe`

### Database Connection Issues
- Verify the NEON database is active and accessible
- Check database credentials are correct
- Ensure SSL mode is set to `require`

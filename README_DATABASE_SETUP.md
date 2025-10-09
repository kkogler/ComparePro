# 📊 Database Setup Guide

## ✅ Database Architecture

The application uses **two hosted NEON PostgreSQL databases**:

| # | Database | Environment | Access |
|---|----------|-------------|--------|
| 1 | **Development NEON** | Development/Testing | `DATABASE_URL` in dev environment |
| 2 | **Production NEON** | Production | `DATABASE_URL` in production environment |

### What This Means:

- **Development NEON**: Used for local development and testing. Set this in your local environment variables.
- **Production NEON**: Used for the live production application (pricecomparehub.com). Set this in your production hosting environment.
- **No Local PostgreSQL**: All database operations use hosted NEON databases. Local PostgreSQL is no longer required or supported.

---

## 🚀 Quick Start

### Environment Variables

Set the appropriate `DATABASE_URL` for your environment:

**For Development:**
```bash
export DATABASE_URL="postgresql://neondb_owner:***@ep-dev-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

**For Production:**
Set this in your production hosting provider's environment variables/secrets:
```bash
DATABASE_URL="postgresql://neondb_owner:***@ep-prod-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

### Running the Application

**Development:**
```bash
npm run dev
# or
npm run dev:cursor
```

**Production:**
```bash
npm run build
npm run start
```

### Database Migrations

Push schema changes to the current database:
```bash
npm run db:push
```

⚠️ **Always test schema changes in development first before applying to production!**

---

## 📚 Documentation

For more detailed information, see:
- **`docs/DATABASE_SETUP_GUIDE.md`** - Detailed database setup and environment guide
- **`ARCHITECTURE.md`** - Application architecture overview
- **`README.md`** - Quick start guide

---

## 🛠️ Database Operations

### Schema Management

When you make schema changes in `shared/schema.ts`:

1. **Test in Development First:**
   ```bash
   # Point to development database
   export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."
   npm run db:push
   ```

2. **Test Your Changes:**
   ```bash
   npm run dev
   # Test your application thoroughly
   ```

3. **Apply to Production:**
   ```bash
   # Point to production database
   export DATABASE_URL="postgresql://...@ep-prod-xxxxx..."
   npm run db:push
   ```

### Backup and Restore

For database backups, use NEON's built-in backup features:
- NEON provides automatic daily backups
- Point-in-time recovery is available
- Access backups through the NEON console: https://console.neon.tech/

---

## 🔧 Configuration

### Environment Variables

**Development Environment:**
```bash
# Development NEON database
DATABASE_URL="postgresql://neondb_owner:***@ep-dev-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Other required variables
SESSION_SECRET="your-session-secret"
CREDENTIAL_ENCRYPTION_KEY="your-encryption-key"
BASE_URL="http://localhost:5000"
```

**Production Environment:**
Set these in your production hosting provider (Replit, Heroku, Vercel, etc.):
```bash
# Production NEON database
DATABASE_URL="postgresql://neondb_owner:***@ep-prod-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Other required variables
SESSION_SECRET="your-production-session-secret"
CREDENTIAL_ENCRYPTION_KEY="your-production-encryption-key"
BASE_URL="https://pricecomparehub.com"
SENDGRID_API_KEY="your-sendgrid-key"
# ... other production secrets
```

---

## 📋 Available Commands

```bash
# Database Management
npm run db:push           # Push schema changes to current database

# Development
npm run dev              # Start dev server (uses DATABASE_URL)
npm run dev:cursor       # Start dev on port 3001 (uses DATABASE_URL)

# Production
npm run build            # Build for production
npm run start            # Start production server
npm run start:pm2        # Start with PM2 process manager
```

---

## ✅ Database Setup Checklist

To get started with the two-database architecture:

1. **Get NEON Database URLs**
   - Create two databases in NEON console: https://console.neon.tech/
   - One for development, one for production
   - Copy connection strings for both

2. **Set Development Environment**
   ```bash
   # In your local .env file or environment
   export DATABASE_URL="postgresql://...@ep-dev-xxxxx..."
   ```

3. **Initialize Development Database**
   ```bash
   # Push schema to development database
   npm run db:push
   ```

4. **Set Production Environment**
   - Add `DATABASE_URL` to your production hosting provider's secrets/environment variables
   - Use the production NEON database connection string

5. **Initialize Production Database**
   ```bash
   # After deploying, push schema to production
   # (Run this from your production environment or temporarily point DATABASE_URL to production)
   npm run db:push
   ```

---

## 🎯 Recommended Workflow

### Daily Development

```bash
# Ensure DATABASE_URL points to development NEON database
npm run dev
# or
npm run dev:cursor
```

Your changes only affect your development database. Production is safe.

### Schema Changes

```bash
# 1. Make changes to shared/schema.ts
# 2. Test in development first
export DATABASE_URL="your-dev-neon-url"
npm run db:push
npm run dev  # Test your changes

# 3. If tests pass, apply to production
export DATABASE_URL="your-prod-neon-url"
npm run db:push
```

### Copying Data Between Environments

If you need to copy data from production to development for testing:

```bash
# Use NEON's built-in copy/restore features:
# 1. Create a branch from production in NEON console
# 2. Use that branch URL as your development DATABASE_URL
# OR use pg_dump/pg_restore manually
```

---

## 🔒 Security Notes

- ✅ Database credentials are stored in environment variables only
- ✅ Never commit database credentials to git
- ✅ Use separate databases for development and production
- ✅ NEON provides SSL connections by default (`?sslmode=require`)
- ✅ Use strong, unique passwords for each NEON database

---

## 🆘 Troubleshooting

### Common Issues

**"Cannot connect to database"**
- Verify your `DATABASE_URL` is set correctly
- Ensure the connection string includes `?sslmode=require`
- Check that your IP is not blocked (NEON allows connections from anywhere by default)

**"Schema push failed"**
- Make sure you're connected to the correct database
- Check that you have write permissions
- Verify your database user has necessary privileges

**"Application can't connect to database"**
- Ensure `DATABASE_URL` environment variable is set
- Verify the connection string format
- Check NEON database is active (not suspended)

### Getting Help

1. **Check Database Connection:**
   ```bash
   echo $DATABASE_URL  # Verify it's set
   npm run dev  # Check server logs for database connection status
   ```

2. **Test Connection Manually:**
   ```bash
   psql "$DATABASE_URL" -c "SELECT current_database(), version();"
   ```

3. **Review NEON Console:**
   - Check database status at https://console.neon.tech/
   - View connection details and logs
   - Verify database is not suspended

---

## 📊 Summary

You're all set! 🎉

✅ **Two-Database Architecture**: Development and Production NEON databases  
✅ **No Local Setup Required**: All databases are hosted on NEON  
✅ **Simple Workflow**: Use environment variables to switch between databases  
✅ **Automatic Backups**: NEON handles daily backups automatically  

**You have everything you need to develop safely.**

---

*For more detailed information, see:*
- `docs/DATABASE_SETUP_GUIDE.md` - Detailed environment guide
- `ARCHITECTURE.md` - Application architecture
- `README.md` - Quick start guide



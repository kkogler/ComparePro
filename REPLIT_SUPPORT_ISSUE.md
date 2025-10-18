# Replit Deployment Issue: Single-Database Architecture Conflict

## Issue Summary

Replit's deployment system requires both development and production databases, but this conflicts with our application's architectural requirements for a single shared database. Attempting to use separate databases causes the deployment system to propose destructive migrations that would delete all production data.

## Application Architecture

**Platform:** Multi-tenant B2B SaaS (BestPrice - Firearms Retail Inventory Management)

**Database:** PostgreSQL (Neon serverless)

**Why Single Database is Required:**

1. **Complex Vendor Credentials:** 200+ vendor integrations with encrypted credentials stored in JSONB columns
2. **Large Reference Data:** 487,006+ vendor product mappings that cannot be easily duplicated
3. **Encryption Keys:** Single `CREDENTIAL_ENCRYPTION_KEY` must decrypt credentials across environments
4. **Manual Migration Strategy:** Complex schema requires manual SQL migrations only (Drizzle auto-migrations disabled)
5. **Production Data Volume:** 40 companies, 71,523 products, 200 vendors - impractical to duplicate in dev

## Problem Encountered

### Initial State (Working)
- Single database: `ep-lingering-sea-adyjzybe` (production)
- Workspace `DATABASE_URL` pointing to production
- Application working correctly
- **Deployment Error:** "Neon development database not found"

### Attempted Solution #1: Delete Old Dev Database
- Previous development database (`ep-lingering-hat-adb2bp8d`) had outdated schema
- Was causing migration conflicts (wanted to truncate production tables)
- Deleted to resolve conflicts
- **Result:** Deployment still required dev database to exist

### Attempted Solution #2: Create New Empty Dev Database
- Created new development database: `ep-wild-fog-adwk1xqv`
- Production database: `ep-lingering-sea-adyjzybe` (with all data)
- **Result:** CRITICAL FAILURE

### Deployment Migration Dialog Shows:
```
Warning: this migration will permanently remove data from your production database.

You're about to delete:
- vendor_product_mappings table with 467,000 items
- products table with 71,523 items  
- vendors table with 200 items
- companies table with 40 items
- [25+ more tables with thousands of items each]
```

**Root Cause:** Empty development database makes Replit think production database should also be empty, generating destructive DROP TABLE migrations.

## What We Need

**Option 1 (Preferred):** Deploy with single database
- Allow workspace to use single database for both development and production
- Skip schema comparison during deployment
- Use manual migration strategy instead of auto-detection

**Option 2:** Safe two-database deployment
- How to configure development database to not trigger destructive migrations
- Whether dev database can point to production database (same connection string)
- How to disable automatic migration detection

**Option 3:** Alternative deployment approach
- Different deployment method that doesn't require dev database
- Custom deployment configuration for single-database architectures

## Technical Environment

- **Platform:** Replit (Deployments)
- **Database:** Neon PostgreSQL 16
- **ORM:** Drizzle (with auto-migrations disabled)
- **Migration Strategy:** Manual SQL migrations only
- **Current Production DB:** `ep-lingering-sea-adyjzybe`
- **App Type:** Express.js + React (Vite) full-stack application

## Current Blockers

1. Cannot deploy without development database (deployment error)
2. Cannot create development database without triggering data deletion (migration dialog)
3. Single-database architecture is non-negotiable due to encrypted credentials and large reference datasets

## Questions for Replit Support

1. Does Replit's deployment system support single-database architectures?
2. Can we configure deployments to skip automatic schema migration detection?
3. Is there a way to mark databases as "migration-managed-externally"?
4. Can development and production databases share the same connection string safely?
5. What is the recommended approach for applications requiring manual migration control?

## Urgency

- Production application currently deployed and working
- Unable to deploy updates due to this issue
- Critical business operations dependent on this platform

---

**Contact:** [Your contact information]
**Repl:** BestPrice Platform
**Database IDs:** 
- Production: `ep-lingering-sea-adyjzybe`
- Dev (created but dangerous): `ep-wild-fog-adwk1xqv`

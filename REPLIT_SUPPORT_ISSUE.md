# Replit Deployment Issue: Need Instructions for Two-Database Setup

## Issue Summary

**My preference:** Separate development and production databases (standard best practice)

**The problem:** Replit was unable to provide instructions on how to properly set up a two-database model for my application, so Replit support previously recommended using a single shared database instead. I followed that recommendation, but now the deployment system is proposing destructive migrations that would delete all production data.

**What I need:** Clear instructions on how to properly configure separate development and production databases for deployment without triggering data loss.

## Background: Previous Replit Guidance

When I initially asked about setting up separate dev/prod databases with my application architecture, Replit support was unable to provide specific setup instructions and instead recommended using a single shared database approach. I followed this recommendation and have been operating with a single database.

Now that I'm attempting to deploy, the system requires a development database, but creating one triggers catastrophic migration warnings.

## Application Architecture

**Platform:** Multi-tenant B2B SaaS (BestPrice - Firearms Retail Inventory Management)

**Database:** PostgreSQL (Neon serverless)

**Why Two Databases Would Be Ideal:**

1. **Separation of Concerns:** Test changes in development before production deployment (standard practice)
2. **Data Safety:** Avoid any risk of development work affecting production data
3. **Proper Testing:** Validate schema changes and migrations in isolated environment

**Challenges with Two-Database Setup:**

1. **Complex Vendor Credentials:** 200+ vendor integrations with encrypted credentials stored in JSONB columns
2. **Large Reference Data:** 487,006+ vendor product mappings 
3. **Encryption Keys:** Single `CREDENTIAL_ENCRYPTION_KEY` must decrypt credentials across environments
4. **Manual Migration Strategy:** Complex schema requires manual SQL migrations only (Drizzle auto-migrations disabled)
5. **Production Data Volume:** 40 companies, 71,523 products, 200 vendors

## Problem Encountered

### Current State
- Production database: `ep-lingering-sea-adyjzybe` (fully populated, working)
- Workspace `DATABASE_URL` pointing to production
- Application working correctly in production
- Following Replit's previous recommendation for single-database approach

### Attempting to Deploy
**Step 1:** Tried to deploy
- **Error:** "Neon development database not found"
- Deployment system requires development database to exist

**Step 2:** Created development database (as required by deployment system)
- Created new development database: `ep-wild-fog-adwk1xqv` (empty)
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

**Root Cause:** Empty development database makes Replit's deployment system think production database should also be empty, generating destructive DROP TABLE migrations for all tables.

## What I Need from Replit Support

### PRIMARY REQUEST: Two-Database Setup Instructions

**I strongly prefer a two-database model** (dev + production). Please provide complete instructions for:

1. **How to properly initialize a development database** without triggering destructive migrations
   - Should it be empty or should it mirror production schema?
   - Should it be populated with seed data?
   - How to handle existing production database during setup?

2. **How to configure deployments with manual migrations**
   - How to disable automatic schema comparison/migration detection
   - How to mark databases as "migration-managed-externally"
   - Best practices for applications using manual SQL migrations

3. **How to handle large reference datasets across environments**
   - Recommended approach for 487K+ vendor mappings
   - Handling encrypted credentials that can't be duplicated
   - Managing environment-specific encryption keys

4. **Proper deployment workflow**
   - Step-by-step process for deploying schema changes manually
   - How to test migrations in dev before applying to production
   - Safe rollback procedures

### ALTERNATIVE: If Two-Database Setup Is Not Possible

If Replit's current deployment system cannot support:
- Manual migration management
- Applications with encrypted credentials and large reference datasets
- Two separate databases with different schemas

Then please provide alternative solutions or workarounds.

## Technical Environment

- **Platform:** Replit (Deployments)
- **Database:** Neon PostgreSQL 16
- **ORM:** Drizzle (with auto-migrations disabled via `drizzle.config.disabled.ts`)
- **Migration Strategy:** Manual SQL migrations only
- **Current Production DB:** `ep-lingering-sea-adyjzybe`
- **App Type:** Express.js + React (Vite) full-stack application
- **Migration Files:** Stored in `migrations/` directory, applied manually via SQL

## Current Blockers

1. Cannot deploy without development database (deployment error)
2. Cannot create development database without triggering destructive migrations (would delete all production data)
3. No documentation on how to properly set up two-database model for this use case
4. Previous Replit guidance recommended single-database approach, but this conflicts with deployment requirements

## Timeline

1. **Initially:** Asked Replit support how to set up two-database model
2. **Replit Response:** Unable to provide instructions, recommended single-database approach
3. **Followed Guidance:** Implemented single-database architecture per Replit's recommendation
4. **Now:** Attempting to deploy, system requires dev database
5. **Problem:** Creating dev database triggers data deletion warnings

## Urgency

- **HIGH PRIORITY:** Production application currently deployed and working
- Unable to deploy critical updates due to this issue
- Business operations dependent on this platform
- Need clear path forward to maintain development velocity

## What I've Tried

✅ Followed Replit's recommendation for single-database approach  
❌ Single database blocks deployment ("dev database not found")  
✅ Created separate development database as required  
❌ Triggers destructive migrations that would delete production data  

**I'm stuck in a catch-22 and need Replit's expertise to resolve this properly.**

---

**Contact:** [Your contact information]  
**Repl:** BestPrice Platform  
**Database IDs:** 
- Production: `ep-lingering-sea-adyjzybe`
- Dev (created but unsafe to use): `ep-wild-fog-adwk1xqv`

**Attached:** Screenshot of destructive migration warning dialog

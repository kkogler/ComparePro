# Database Migration Order

**Last Updated:** October 13, 2025  
**Purpose:** Define the correct order for running database migrations

---

## Migration Naming Convention

All migrations follow the pattern: `NNNN_descriptive_name.sql`

- `NNNN` = Zero-padded sequential number (0000, 0001, 0002, etc.)
- `descriptive_name` = Lowercase with underscores describing the change
- Seed files: Prefix with `seed-` and do not use numbers

---

## Migration Execution Order

### 1. Baseline Schema (Run First)

```bash
psql $DATABASE_URL -f migrations/0000_fresh_baseline.sql
```

This creates all core tables, indexes, and initial structure.

---

### 2. Schema Migrations (Run in Numerical Order)

Execute these in sequential order:

```bash
# Store Email Removal
psql $DATABASE_URL -f migrations/0001_remove_store_email.sql

# Order Items Category Addition
psql $DATABASE_URL -f migrations/0002_add_category_to_order_items.sql

# Admin Settings Default Pricing
psql $DATABASE_URL -f migrations/0028_add_default_pricing_to_admin_settings.sql

# Vendor Priority System
psql $DATABASE_URL -f migrations/0030_add_priority_to_vendor_retail_verticals.sql

# Billing Events Provider Fix
psql $DATABASE_URL -f migrations/0031_fix_billing_events_provider.sql

# Vendor Slug Refactoring (Critical - Don't Skip!)
psql $DATABASE_URL -f migrations/0032_rename_vendor_short_code_to_slug.sql

# Plan Settings Schema Fix (Critical - Don't Skip!)
psql $DATABASE_URL -f migrations/0033_fix_plan_settings_schema.sql

# Settings Address Schema Fix
psql $DATABASE_URL -f migrations/0034_fix_settings_schema.sql

# Plan Settings Max Orders
psql $DATABASE_URL -f migrations/0035_add_max_orders_column.sql

# Credentials Column Type Fix
psql $DATABASE_URL -f migrations/0036_fix_credentials_column_type.sql

# Vendor Short Name Length Fix
psql $DATABASE_URL -f migrations/0037_fix_short_name_length.sql

# Category Templates
psql $DATABASE_URL -f migrations/0038_create_category_templates.sql
```

**⚠️ IMPORTANT:** Run these in order. Some migrations depend on previous changes.

---

### 3. Seed Data (Run After All Schema Migrations)

These can be run in any order, but follow this recommended sequence:

```bash
# 1. Admin settings (system-level configuration)
psql $DATABASE_URL -f migrations/seed-admin-settings.sql

# 2. Plan settings (subscription plans)
psql $DATABASE_URL -f migrations/seed-plan-settings.sql

# 3. Supported vendors (master vendor list)
psql $DATABASE_URL -f migrations/seed-supported-vendors.sql

# 4. Vendor retail vertical mappings (vendor-vertical associations)
psql $DATABASE_URL -f migrations/seed-production-vendor-mappings.sql

# 5. Retail vertical categories (category definitions)
psql $DATABASE_URL -f migrations/seed-all-retail-vertical-categories.sql

# 6. Category templates (default category mappings)
psql $DATABASE_URL -f migrations/seed-production-category-templates.sql
```

**Note:** Seed files are idempotent (safe to run multiple times).

---

## Critical Migrations (Don't Skip These!)

| Migration | Why It's Critical |
|-----------|------------------|
| `0032_rename_vendor_short_code_to_slug.sql` | Separates vendor slug (immutable) from short code (editable). System routing depends on this. |
| `0033_fix_plan_settings_schema.sql` | Fixes plan settings schema mismatch. Required for subscription management. |
| `0034_fix_settings_schema.sql` | Drops legacy store_address column that causes NOT NULL conflicts. |

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Backup database: `pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql`
- [ ] Test migrations in development environment first
- [ ] Run migrations in maintenance window (low traffic period)
- [ ] Verify schema changes: `\d table_name` in psql
- [ ] Test application functionality after migration
- [ ] Monitor logs for errors

---

## Troubleshooting

### Migration Already Applied?

Check if a migration was already applied:

```sql
-- Check if column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'your_table' 
  AND column_name = 'your_column';

-- Check if table exists
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'your_table';
```

### Migration Failed Mid-Run?

1. Check error message carefully
2. Identify which statement failed
3. Fix the issue (e.g., missing dependency)
4. Continue from the failed statement

### Duplicate Baseline Error?

If you get errors about tables already existing:
- The baseline was already applied
- Skip `0000_fresh_baseline.sql`
- Start with schema migrations

---

## Adding New Migrations

When creating a new migration:

1. **Determine the next number:**
   ```bash
   ls -1 migrations/*.sql | grep "^migrations/[0-9]" | sort | tail -1
   # Current highest: 0038_create_category_templates.sql
   # Your new migration: 0039_your_description.sql
   ```

2. **Create the file:**
   ```bash
   touch migrations/0039_your_description.sql
   ```

3. **Write the migration:**
   - Use `IF EXISTS` / `IF NOT EXISTS` when possible
   - Add comments explaining the change
   - Include rollback instructions if applicable
   - Test in development first

4. **Update this document:**
   - Add your migration to the execution order
   - Document any critical dependencies

5. **Commit everything:**
   ```bash
   git add migrations/0039_your_description.sql
   git add migrations/MIGRATION_ORDER.md
   git commit -m "migration: Add your description"
   ```

---

## TypeScript Migrations

Some migrations are TypeScript files (`.ts`) for complex data transformations:

- `add-lipseys-sync-fields.ts`
- `migrate-products-to-slug-sources.ts`

**Execution:**
```bash
tsx migrations/script-name.ts
```

These typically require Node.js runtime and database connection configuration.

---

## Migration Conflicts

If two developers create migrations with the same number:

1. Renumber the newer migration
2. Update MIGRATION_ORDER.md
3. Coordinate with team to avoid conflicts

**Prevention:** Use a central migration number registry or increment by 10s to leave gaps.

---

## Rollback Strategy

We don't currently have automated rollbacks. To revert a migration:

1. Create a new migration that undoes the changes
2. Number it sequentially (don't try to delete old migrations)
3. Test thoroughly before applying to production

**Example:**
- Migration 0035 added a column
- Create 0039 to remove that column (if needed)

---

## Related Documentation

- [PRODUCTION_MIGRATION_GUIDE.md](./PRODUCTION_MIGRATION_GUIDE.md) - Production deployment steps
- [../shared/schema.ts](../shared/schema.ts) - Current schema definition (Drizzle ORM)

---

## Cleanup History

### October 13, 2025 - Duplicate Migrations Removed

**Removed:**
- `0000_flaky_patch.sql` - Duplicate of `0000_fresh_baseline.sql` (identical files)
- `fix-settings-schema.sql` - V1 had issues, V2 supersedes it

**Renamed to Numbered Format:**
- `fix-settings-schema-v2.sql` → `0034_fix_settings_schema.sql`
- `add-max-orders-column.sql` → `0035_add_max_orders_column.sql`
- `fix-credentials-column-type.sql` → `0036_fix_credentials_column_type.sql`
- `fix-short-name-length.sql` → `0037_fix_short_name_length.sql`
- `create-category-templates.sql` → `0038_create_category_templates.sql`

**Fixed Duplicate Numbering:**
- `0001_add_category_to_order_items.sql` → `0002_add_category_to_order_items.sql`
  - Reason: Both migrations had number `0001`. Based on git history (Oct 4 vs Oct 6), `0001_remove_store_email.sql` was created first and kept `0001`.

**Why:** Eliminated confusion, established naming convention, improved maintainability.

---

**Maintained by:** Development Team  
**Questions?** Check git history or ask in team chat


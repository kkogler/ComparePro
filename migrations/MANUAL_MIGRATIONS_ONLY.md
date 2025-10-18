# ⚠️ MANUAL MIGRATIONS ONLY

## Important: This project uses MANUAL SQL migrations

**DO NOT run `drizzle-kit push` or `drizzle-kit generate` in production!**

### Why Manual Migrations?

1. **Data Safety**: Auto-migrations can truncate tables and lose data
2. **Schema Conflicts**: Drizzle's snapshot system gets out of sync with manual changes
3. **Control**: We need precise control over migration order and data backfills

### How to Make Schema Changes

1. **Update `shared/schema.ts`** with your changes
2. **Create a manual SQL migration** in `/migrations/`:
   ```sql
   -- migrations/0043_my_new_feature.sql
   ALTER TABLE my_table ADD COLUMN my_column text;
   UPDATE my_table SET my_column = 'default_value' WHERE my_column IS NULL;
   ALTER TABLE my_table ALTER COLUMN my_column SET NOT NULL;
   ```
3. **Test locally** by running the SQL against your local database
4. **Run in production** manually via `psql "$DATABASE_URL" < migrations/0043_my_new_feature.sql`
5. **Commit both** `shared/schema.ts` and the `.sql` file

### Production Deployment

**CRITICAL: `drizzle.config.ts` has been renamed to `drizzle.config.disabled.ts`**

Replit's deployment platform **scans the repository root for `drizzle.config.ts`** and auto-runs migrations regardless of:
- `.drizzle-kit-skip` file (ignored by Replit)
- Build command configuration (Replit scans independently)

**Nuclear Option Implemented:**
- Config file renamed: `drizzle.config.disabled.ts`
- Replit can't detect it → No auto-migrations
- Manual operations reference: `--config=drizzle.config.disabled.ts`
- **DO NOT rename back to `drizzle.config.ts`!**

**Safety Protections:**
- Build command: `npm ci && npm run build` (no DB operations)
- `db:validate` script only validates critical columns exist (does not migrate)
- Manual introspection: `npm run db:introspect` (uses disabled config)

### Current Schema State

As of the last manual migration:
- ✅ `vendors.vendor_slug` is NOT NULL (primary identifier)
- ✅ `vendors.slug` column has been dropped (was redundant)
- ✅ All vendors use immutable `vendorSlug` for routing
- ✅ `vendorShortCode` is used for display only

### If You Accidentally Run Auto-Migrations

If Replit auto-runs migrations during deployment:

1. **Check the database**:
   ```bash
   psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='vendors' AND column_name IN ('slug', 'vendor_slug');"
   ```

2. **If `slug` column was re-added**:
   ```sql
   ALTER TABLE vendors DROP COLUMN slug;
   ALTER TABLE vendors ALTER COLUMN vendor_slug SET NOT NULL;
   ```

3. **Recreate vendors if they were truncated**:
   ```sql
   INSERT INTO vendors (company_id, supported_vendor_id, name, vendor_slug, vendor_short_code, integration_type, status, enabled_for_price_comparison, created_at, updated_at)
   SELECT 
     c.id, sv.id, sv.name, sv.vendor_slug, sv.vendor_short_code, 
     sv.api_type, 'offline', true, NOW(), NOW()
   FROM companies c CROSS JOIN supported_vendors sv
   WHERE sv.is_enabled = true;
   ```

### Contact

If you have questions about migrations, check:
- `docs/VENDOR_SLUG_STANDARDIZATION.md`
- `migrations/PRODUCTION_MIGRATION_GUIDE.md`


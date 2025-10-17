# Production Schema Fix - Urgent

## Issue
The **Supported Vendors** page at https://pricecomparehub.com/admin/supported-vendors is blank because the production database is missing required columns:
- ❌ `image_quality` column in `supported_vendors` table
- ❌ `vendor_slug` column in `supported_vendors` table
- ❌ `vendor_slug` column in `vendors` table

**Error from logs:**
```
❌ Failed to fetch supported vendors: NeonDbError: column "image_quality" does not exist
```

## Quick Fix (Recommended)

Run the master fix script that handles everything:

```bash
psql "$DATABASE_URL" -f migrations/fix-production-schema.sql
```

This script:
1. ✅ Adds `image_quality` column with default value 'high'
2. ✅ Adds `vendor_slug` column with auto-populated values
3. ✅ Adds `vendor_slug` to vendors table
4. ✅ Safe to run multiple times (checks for existing columns)
5. ✅ Verifies data exists in supported_vendors table

## Manual Step-by-Step (Alternative)

If you prefer to run migrations individually:

```bash
# Step 1: Add image_quality column
psql "$DATABASE_URL" -f migrations/0040_add_image_quality_column.sql

# Step 2: Add vendor_slug to supported_vendors
psql "$DATABASE_URL" -f migrations/0041_add_vendor_slug_column.sql

# Step 3: Add vendor_slug to vendors table
psql "$DATABASE_URL" -f migrations/0042_add_vendor_slug_to_vendors_table.sql
```

## If Supported Vendors Table is Empty

After running the schema fix, if the table is empty, seed the vendors:

```bash
psql "$DATABASE_URL" -f migrations/seed-supported-vendors.sql
```

This will insert:
- GunBroker.com LLC
- Sports South LLC
- Bill Hicks & Co. NAME
- Lipsey's Inc.
- Chattanooga Shooting Supplies Inc.

## Verification

After running the migrations, verify in the database:

```sql
-- Check columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'supported_vendors' 
AND column_name IN ('image_quality', 'vendor_slug');

-- Should show both columns

-- Check data exists
SELECT id, name, vendor_slug, vendor_short_code, image_quality 
FROM supported_vendors 
ORDER BY product_record_priority;

-- Should show 5 vendors
```

## Test in Browser

After migrations:
1. Go to https://pricecomparehub.com/admin/supported-vendors
2. You should see a table with 5 vendors
3. Each vendor should have a short code displayed

## Rollback (if needed)

If something goes wrong:

```sql
-- Remove columns (WARNING: loses data)
ALTER TABLE supported_vendors DROP COLUMN IF EXISTS image_quality;
ALTER TABLE supported_vendors DROP COLUMN IF EXISTS vendor_slug;
ALTER TABLE vendors DROP COLUMN IF EXISTS vendor_slug;
```

## Next Deployment Steps

After fixing production:
1. ✅ Ensure all future deployments run Drizzle migrations automatically
2. ✅ Document migration process in deployment pipeline
3. ✅ Set up migration tracking to prevent this issue

## Support

If you encounter errors:
- Check that `$DATABASE_URL` environment variable is set
- Ensure you have database admin permissions
- Check production logs for more details
- Verify PostgreSQL version (should be 13+)


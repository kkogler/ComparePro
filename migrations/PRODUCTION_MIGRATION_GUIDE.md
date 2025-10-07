# Production Database Migration Guide

## Overview
This guide covers seeding missing data in production to fix webhook provisioning issues.

## Issues Being Fixed
1. **Missing Category Templates** - New subscriptions receive 0 categories instead of 8
2. **Missing Vendor Mappings** - Vendors don't show up in Store > Supported Vendors page

## Prerequisites
- Access to production database (Replit SQL console or `psql`)
- Backup recommended (though these scripts are idempotent and safe)

## Migration Scripts

### 1. Seed Category Templates
**File:** `seed-production-category-templates.sql`

**What it does:**
- Inserts 8 default category templates for Firearms retail vertical
- Safe to run multiple times (uses ON CONFLICT DO NOTHING)

**Run in Replit SQL Console:**
```sql
-- Copy and paste the entire contents of seed-production-category-templates.sql
```

**Or via command line:**
```bash
psql "$DATABASE_URL" -f migrations/seed-production-category-templates.sql
```

**Expected output:**
```
INSERT 0 8
```

**Verify:**
```sql
SELECT COUNT(*) FROM category_templates WHERE retail_vertical_id = 1;
-- Should return: 8
```

### 2. Seed Vendor-to-Retail-Vertical Mappings
**File:** `seed-production-vendor-mappings.sql`

**What it does:**
- Links all enabled vendors to Firearms retail vertical
- Ensures vendors appear on Store > Supported Vendors page
- Safe to run multiple times (checks for existing mappings)

**Run in Replit SQL Console:**
```sql
-- Copy and paste the entire contents of seed-production-vendor-mappings.sql
```

**Or via command line:**
```bash
psql "$DATABASE_URL" -f migrations/seed-production-vendor-mappings.sql
```

**Expected output:**
```
INSERT 0 5  (or however many enabled vendors you have)
```

**Verify:**
```sql
SELECT COUNT(*) FROM supported_vendor_retail_verticals;
-- Should be > 0 (likely 5)
```

## Post-Migration Testing

### Test New Subscription
1. Create a new subscription in Zoho Billing using Gmail plus addressing:
   - Email: `your.email+test1@domain.com`
   - Company: "Test Store Name"

2. Check webhook logs for successful processing:
   ```
   🔍 Storage: Query returned 8 templates
   ✅ Storage: Successfully copied 8 category templates
   ```

3. Log into new store and verify:
   - ✅ Store > Settings > Product Categories shows 8 categories
   - ✅ Store > Supported Vendors shows all vendors (GunBroker, Lipsey's, etc.)
   - ✅ URL is `/org/test-store-name/auth` (not `/org/company-{id}/auth`)

### Test Existing Subscription
1. Log into an existing store (e.g., Toobin Guns)
2. Check if categories are missing:
   - If missing, manually copy templates using Admin UI or SQL:
     ```sql
     -- Get company ID for the store
     SELECT id, name, slug FROM companies WHERE slug = 'toobin-guns';
     
     -- Copy templates to that company (replace 123 with actual company_id)
     INSERT INTO categories (company_id, name, slug, display_name, description, is_active, sort_order)
     SELECT 123, name, slug, display_name, description, is_active, sort_order
     FROM category_templates
     WHERE retail_vertical_id = 1
     ON CONFLICT DO NOTHING;
     ```

## Rollback (if needed)

If something goes wrong, you can remove the seeded data:

```sql
-- Remove category templates (only for retail vertical 1)
DELETE FROM category_templates WHERE retail_vertical_id = 1;

-- Remove vendor mappings (only for retail vertical 1)
DELETE FROM supported_vendor_retail_verticals WHERE retail_vertical_id = 1;
```

## Testing Strategy

### Using Gmail Plus Addressing
Gmail (and many providers) support plus addressing for testing:
- `kevin.kogler+test1@microbiz.com`
- `kevin.kogler+bullys@microbiz.com`
- `kevin.kogler+smiths@microbiz.com`

All emails deliver to the base address, but Zoho treats them as unique customers.

**Best Practice:**
- Use descriptive suffixes matching store name
- Delete test subscriptions after testing
- Keep a list of test customer IDs for cleanup

## Monitoring

After migration, monitor webhook logs for:
```
✅ Successful patterns:
🔍 Storage: Query returned 8 templates
✅ Storage: Successfully copied 8 category templates
✅ BillingService: Created 5 new vendors for company

❌ Error patterns:
⚠️ Storage: No category templates found
⚠️ BillingService: Will create 0 new vendors
❌ Storage: Error copying category templates
```

## Support

If you encounter issues:
1. Check production logs for detailed error messages
2. Verify data exists: `SELECT COUNT(*) FROM category_templates;`
3. Check for constraint violations in logs
4. Ensure retail vertical ID 1 exists: `SELECT * FROM retail_verticals WHERE id = 1;`


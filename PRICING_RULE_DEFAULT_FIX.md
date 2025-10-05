# Pricing Rule Default Configuration Fix

## Issue Summary

Two different default pricing rules were being created for new subscriptions depending on when they were created:

- **From Zoho Billing webhook**: Pricing Rule with fallback of **MAP**
- **From Admin > Create Subscription**: Pricing Rule with fallback of **Cost + 55% Markup**

## Root Cause

There was a conflict between two database configuration sources:

### 1. Migration Default (`migrations/0028_add_default_pricing_to_admin_settings.sql`)
```sql
ALTER TABLE "admin_settings" 
  ADD COLUMN "default_pricing_fallback_strategy" text DEFAULT 'map';
```
- Sets column default to `'map'`

### 2. Seed File (`migrations/seed-admin-settings.sql`)
```sql
INSERT INTO admin_settings (...) VALUES (
  ...,
  'cost_markup',  -- default_pricing_fallback_strategy
  55.00,          -- default_pricing_fallback_markup_percentage
  ...
)
ON CONFLICT (id) DO UPDATE SET
  default_pricing_fallback_strategy = COALESCE(admin_settings.default_pricing_fallback_strategy, 'cost_markup'),
  ...
```
- Tried to set to `'cost_markup'` with 55% markup
- But used `COALESCE` which **only updates NULL values**

### The Problem

The migration runs first and sets the value to `'map'` (not NULL). Then when the seed file runs, the `COALESCE` function sees a non-NULL value (`'map'`) and doesn't update it to `'cost_markup'`.

**Result**: Both subscription creation paths use the same code (`provisionCompanyOnboarding()` in `billing-service.ts`), but they were reading different values from admin_settings depending on when the seed was run.

## The Fix

### Updated `migrations/seed-admin-settings.sql`

Changed from:
```sql
ON CONFLICT (id) DO UPDATE SET
  default_pricing_strategy = COALESCE(admin_settings.default_pricing_strategy, 'msrp'),
  default_pricing_fallback_strategy = COALESCE(admin_settings.default_pricing_fallback_strategy, 'cost_markup'),
  default_pricing_fallback_markup_percentage = COALESCE(admin_settings.default_pricing_fallback_markup_percentage, 55.00),
```

To:
```sql
ON CONFLICT (id) DO UPDATE SET
  default_pricing_strategy = 'msrp',
  default_pricing_fallback_strategy = 'cost_markup',
  default_pricing_fallback_markup_percentage = 55.00,
```

This **forces** the correct values instead of only updating NULL values.

## Verification

Both subscription creation methods now use the **same pricing configuration**:

1. **Admin > Subscriptions > Create Subscription**
   - Calls: `BillingService.createManualSubscription()`
   - Then: `BillingService.provisionCompanyOnboarding()`
   - Reads from: `admin_settings` table

2. **Zoho Billing Webhook**
   - Calls: `BillingService.handleSubscriptionCreated()`
   - Then: `BillingService.provisionCompanyOnboarding()`
   - Reads from: `admin_settings` table

**Both paths converge at `provisionCompanyOnboarding()` which reads admin_settings (lines 1816-1845 of `server/billing-service.ts`)**.

## How to Apply the Fix

1. **Re-run the seed file** to update existing admin settings:
   ```bash
   psql your_database < migrations/seed-admin-settings.sql
   ```

2. **Verify the settings** in Admin UI or via SQL:
   ```sql
   SELECT 
     default_pricing_strategy,
     default_pricing_fallback_strategy,
     default_pricing_fallback_markup_percentage
   FROM admin_settings
   WHERE id = 1;
   ```
   
   Should return:
   - `default_pricing_strategy`: `msrp`
   - `default_pricing_fallback_strategy`: `cost_markup`
   - `default_pricing_fallback_markup_percentage`: `55.00`

3. **Optional**: Update existing subscriptions that have MAP fallback to use Cost + 55% Markup:
   ```sql
   UPDATE pricing_configurations
   SET 
     fallback_strategy = 'cost_markup',
     fallback_markup_percentage = 55.00
   WHERE 
     is_default = true 
     AND fallback_strategy = 'map'
     AND fallback_markup_percentage IS NULL;
   ```

## Admin UI Override

Admins can still override these defaults at any time via:
- **Admin > Plan Settings** → Configure default pricing for all new subscriptions
- Individual companies can customize their pricing rules in their own **Pricing Rules** page

## Notes

- Neither value was "hardcoded" in the application code
- Both paths use the same `BillingService.provisionCompanyOnboarding()` method
- The issue was purely a database configuration mismatch between migration and seed files
- The fix ensures consistency going forward while allowing admin customization


-- Fix vendor enablement null values
-- Updates all vendors with null enabled_for_price_comparison to true

-- Check current state
SELECT 
  'Before Update' as status,
  COUNT(*) as total_vendors,
  COUNT(CASE WHEN enabled_for_price_comparison IS NULL THEN 1 END) as null_values,
  COUNT(CASE WHEN enabled_for_price_comparison = true THEN 1 END) as enabled_vendors,
  COUNT(CASE WHEN enabled_for_price_comparison = false THEN 1 END) as disabled_vendors
FROM vendors;

-- Show vendors that will be updated
SELECT 
  id, 
  company_id, 
  name, 
  enabled_for_price_comparison 
FROM vendors 
WHERE enabled_for_price_comparison IS NULL
ORDER BY company_id, name;

-- Update null values to true (default enabled)
UPDATE vendors 
SET 
  enabled_for_price_comparison = true,
  updated_at = NOW()
WHERE enabled_for_price_comparison IS NULL;

-- Verify the fix
SELECT 
  'After Update' as status,
  COUNT(*) as total_vendors,
  COUNT(CASE WHEN enabled_for_price_comparison IS NULL THEN 1 END) as null_values,
  COUNT(CASE WHEN enabled_for_price_comparison = true THEN 1 END) as enabled_vendors,
  COUNT(CASE WHEN enabled_for_price_comparison = false THEN 1 END) as disabled_vendors
FROM vendors;
























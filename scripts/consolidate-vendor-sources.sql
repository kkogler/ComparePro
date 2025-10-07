-- Consolidate Vendor Source Names to Standard Short Codes
-- This updates all products to use consistent vendor slugs for priority matching

BEGIN;

-- Update Bill Hicks & Co. to bill-hicks
UPDATE products 
SET source = 'bill-hicks', updated_at = NOW()
WHERE source = 'Bill Hicks & Co.';

-- Update Sports South variants
UPDATE products 
SET source = 'sports-south', updated_at = NOW()
WHERE source IN ('Sports South', 'sports_south', 'sportssouth');

-- Update Chattanooga variants
UPDATE products 
SET source = 'chattanooga', updated_at = NOW()
WHERE source IN ('Chattanooga Shooting Supplies Inc.', 'Chattanooga Shooting Supplies', 'Chattanooga', 'chattanooga_shooting_supplies');

-- Update GunBroker variants
UPDATE products 
SET source = 'gunbroker', updated_at = NOW()
WHERE source IN ('GunBroker.com LLC', 'GunBroker', 'gunbroker.com');

-- Update Lipsey's variants
UPDATE products 
SET source = 'lipseys', updated_at = NOW()
WHERE source IN ('Lipsey''s Inc.', 'Lipsey''s', 'Lipseys', 'lipseys_inc');

-- Show results
SELECT 
  source, 
  COUNT(*) as product_count,
  MIN(updated_at) as oldest_update,
  MAX(updated_at) as newest_update
FROM products 
GROUP BY source 
ORDER BY source;

COMMIT;


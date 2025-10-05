-- Migration: Fix stores.short_name values that exceed 8 characters
-- This ensures all existing stores comply with the 8-character limit

-- Update any short_name values that are longer than 8 characters
-- Truncate to 8 characters and ensure alphanumeric only
UPDATE stores 
SET short_name = UPPER(REGEXP_REPLACE(LEFT(short_name, 8), '[^A-Za-z0-9]', '', 'g'))
WHERE LENGTH(short_name) > 8;

-- Verify the results
SELECT 
  id,
  name,
  short_name,
  LENGTH(short_name) as short_name_length
FROM stores
WHERE LENGTH(short_name) > 8;

-- This query should return no rows after the migration


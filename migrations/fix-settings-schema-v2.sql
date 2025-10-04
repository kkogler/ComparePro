-- Migration V2: Remove old store_address column after migrating data
-- This fixes the NOT NULL constraint issue on the legacy column

-- First, ensure new columns exist and have data
ALTER TABLE settings 
  ADD COLUMN IF NOT EXISTS store_address1 text,
  ADD COLUMN IF NOT EXISTS store_address2 text,
  ADD COLUMN IF NOT EXISTS store_city text,
  ADD COLUMN IF NOT EXISTS store_state text,
  ADD COLUMN IF NOT EXISTS store_zip_code text;

-- Migrate any data from old column to new column
UPDATE settings 
SET store_address1 = COALESCE(store_address1, store_address, '')
WHERE store_address1 IS NULL OR store_address1 = '';

-- Set defaults for other new columns
UPDATE settings
SET 
  store_city = COALESCE(store_city, ''),
  store_state = COALESCE(store_state, ''),
  store_zip_code = COALESCE(store_zip_code, '')
WHERE store_city IS NULL OR store_state IS NULL OR store_zip_code IS NULL;

-- Add NOT NULL constraints to new columns
ALTER TABLE settings 
  ALTER COLUMN store_address1 SET NOT NULL,
  ALTER COLUMN store_city SET NOT NULL,
  ALTER COLUMN store_state SET NOT NULL,
  ALTER COLUMN store_zip_code SET NOT NULL;

-- **FIX**: Drop the old store_address column to prevent NOT NULL conflicts
ALTER TABLE settings DROP COLUMN IF EXISTS store_address CASCADE;

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'settings' 
  AND column_name LIKE 'store_%'
ORDER BY column_name;

-- Migration: Rename store_address to store_address1 and add new address columns
-- This fixes the schema mismatch between code and Production database

-- Add new columns if they don't exist
ALTER TABLE settings 
  ADD COLUMN IF NOT EXISTS store_address1 text,
  ADD COLUMN IF NOT EXISTS store_address2 text,
  ADD COLUMN IF NOT EXISTS store_city text,
  ADD COLUMN IF NOT EXISTS store_state text,
  ADD COLUMN IF NOT EXISTS store_zip_code text;

-- Copy data from old column to new column
UPDATE settings 
SET store_address1 = COALESCE(store_address, '')
WHERE store_address1 IS NULL OR store_address1 = '';

-- Set defaults for new columns
UPDATE settings
SET 
  store_city = COALESCE(store_city, ''),
  store_state = COALESCE(store_state, ''),
  store_zip_code = COALESCE(store_zip_code, '')
WHERE store_city IS NULL OR store_state IS NULL OR store_zip_code IS NULL;

-- Add NOT NULL constraints
ALTER TABLE settings 
  ALTER COLUMN store_address1 SET NOT NULL,
  ALTER COLUMN store_city SET NOT NULL,
  ALTER COLUMN store_state SET NOT NULL,
  ALTER COLUMN store_zip_code SET NOT NULL;

-- Drop old column (commented out for safety - uncomment after verification)
-- ALTER TABLE settings DROP COLUMN IF EXISTS store_address;

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'settings' 
  AND column_name IN ('store_address', 'store_address1', 'store_address2', 'store_city', 'store_state', 'store_zip_code')
ORDER BY column_name;

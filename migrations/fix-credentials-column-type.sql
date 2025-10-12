-- Fix credentials column type mismatch between dev and production
-- Issue: Production has TEXT, development has JSONB
-- This migration converts the column to JSONB for proper JSON storage

-- Step 1: First, let's see what we're working with
-- Show current column type
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'company_vendor_credentials' 
  AND column_name = 'credentials';

-- Step 2: Convert TEXT to JSONB
-- This will parse existing text values as JSON
-- If any row has invalid JSON, this will fail (which is good - we want to know)
ALTER TABLE company_vendor_credentials 
ALTER COLUMN credentials 
TYPE jsonb 
USING credentials::jsonb;

-- Step 3: Verify the change
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'company_vendor_credentials' 
  AND column_name = 'credentials';

-- Step 4: Check that existing data is intact
SELECT 
  id,
  company_id,
  supported_vendor_id,
  jsonb_typeof(credentials) as credentials_type,
  jsonb_object_keys(credentials) as credential_keys
FROM company_vendor_credentials
WHERE credentials IS NOT NULL 
  AND credentials != '{}'::jsonb
LIMIT 10;










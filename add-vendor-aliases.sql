-- Migration script to add name aliases and field aliases for existing vendors
-- This eliminates hardcoded vendor-specific logic

-- Add name_aliases column if it doesn't exist (schema change)
-- Note: This should be handled by your migration system
-- ALTER TABLE supported_vendors ADD COLUMN name_aliases TEXT[];

-- Add GunBroker name aliases to eliminate hardcoded variations
UPDATE supported_vendors 
SET name_aliases = ARRAY['GunBroker', 'gunbroker', 'GunBroker.com', 'GunBroker.com LLC', 'GunBroker API']
WHERE name ILIKE '%gunbroker%' OR vendor_short_code ILIKE '%gunbroker%';

-- Add Bill Hicks field aliases to eliminate hardcoded field aliasing
-- Update the credential fields to include aliases for ftpServer field
UPDATE supported_vendors 
SET credential_fields = jsonb_set(
  credential_fields::jsonb,
  '{0,aliases}',
  '["ftpHost"]'::jsonb
)
WHERE (name ILIKE '%bill%hicks%' OR vendor_short_code ILIKE '%bill%hicks%')
AND credential_fields::jsonb->0->>'name' = 'ftpServer';

-- Alternative: If the field is named 'ftpHost' instead, add 'ftpServer' as alias
UPDATE supported_vendors 
SET credential_fields = jsonb_set(
  credential_fields::jsonb,
  '{0,aliases}',
  '["ftpServer"]'::jsonb
)
WHERE (name ILIKE '%bill%hicks%' OR vendor_short_code ILIKE '%bill%hicks%')
AND credential_fields::jsonb->0->>'name' = 'ftpHost';

-- Verify the changes
SELECT 
  name,
  vendor_short_code,
  name_aliases,
  credential_fields::jsonb->0->>'name' as first_field_name,
  credential_fields::jsonb->0->>'aliases' as first_field_aliases
FROM supported_vendors 
WHERE name_aliases IS NOT NULL 
   OR credential_fields::jsonb->0->'aliases' IS NOT NULL;






















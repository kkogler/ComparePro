-- Migration 0032: Separate vendor_slug (immutable) from vendor_short_code (editable)
-- Date: 2025-10-13
-- Purpose: Fix architectural issue where vendor_short_code serves dual purpose
--          - System routing (needs immutable identifier)
--          - Reports/display (needs editable short name)

-- ============================================================================
-- SUPPORTED_VENDORS TABLE
-- ============================================================================

-- Step 1: Rename vendor_short_code → vendor_slug (the immutable system identifier)
ALTER TABLE supported_vendors 
  RENAME COLUMN vendor_short_code TO vendor_slug;

-- Step 2: Add new vendor_short_code column (editable for reports/display)
ALTER TABLE supported_vendors 
  ADD COLUMN vendor_short_code TEXT;

-- Step 3: Initialize new vendor_short_code with vendor_slug values
UPDATE supported_vendors 
  SET vendor_short_code = vendor_slug;

-- Step 4: Add unique constraint on vendor_slug (prevent duplicates)
ALTER TABLE supported_vendors 
  ADD CONSTRAINT supported_vendors_vendor_slug_unique UNIQUE (vendor_slug);

-- Step 5: Add index for performance
CREATE INDEX IF NOT EXISTS idx_supported_vendors_vendor_slug ON supported_vendors(vendor_slug);

-- ============================================================================
-- VENDORS TABLE (organization instances)
-- ============================================================================

-- Step 6: Rename vendor_short_code → vendor_slug in vendors table
ALTER TABLE vendors 
  RENAME COLUMN vendor_short_code TO vendor_slug;

-- Step 7: Add new vendor_short_code column
ALTER TABLE vendors 
  ADD COLUMN vendor_short_code TEXT;

-- Step 8: Initialize new vendor_short_code with vendor_slug values
UPDATE vendors 
  SET vendor_short_code = vendor_slug;

-- Step 9: Add index for performance
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_slug ON vendors(vendor_slug);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the migration
DO $$
BEGIN
  -- Check supported_vendors has both columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supported_vendors' 
    AND column_name = 'vendor_slug'
  ) THEN
    RAISE EXCEPTION 'Migration failed: supported_vendors.vendor_slug not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supported_vendors' 
    AND column_name = 'vendor_short_code'
  ) THEN
    RAISE EXCEPTION 'Migration failed: supported_vendors.vendor_short_code not found';
  END IF;

  -- Check vendors has both columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' 
    AND column_name = 'vendor_slug'
  ) THEN
    RAISE EXCEPTION 'Migration failed: vendors.vendor_slug not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' 
    AND column_name = 'vendor_short_code'
  ) THEN
    RAISE EXCEPTION 'Migration failed: vendors.vendor_short_code not found';
  END IF;

  RAISE NOTICE 'Migration 0032 completed successfully';
END $$;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- To rollback this migration, run:
--
-- ALTER TABLE supported_vendors DROP COLUMN IF EXISTS vendor_short_code;
-- ALTER TABLE supported_vendors RENAME COLUMN vendor_slug TO vendor_short_code;
-- DROP INDEX IF EXISTS idx_supported_vendors_vendor_slug;
-- ALTER TABLE supported_vendors DROP CONSTRAINT IF EXISTS supported_vendors_vendor_slug_unique;
--
-- ALTER TABLE vendors DROP COLUMN IF EXISTS vendor_short_code;
-- ALTER TABLE vendors RENAME COLUMN vendor_slug TO vendor_short_code;
-- DROP INDEX IF EXISTS idx_vendors_vendor_slug;


-- ============================================================================
-- PRODUCTION SCHEMA FIX
-- ============================================================================
-- This script fixes missing columns in the production database that are
-- preventing the Supported Vendors page from loading.
-- 
-- SAFE TO RUN MULTIPLE TIMES - All operations check for existing data
-- ============================================================================

-- Step 1: Add image_quality column
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supported_vendors' 
        AND column_name = 'image_quality'
    ) THEN
        ALTER TABLE supported_vendors ADD COLUMN image_quality text DEFAULT 'high';
        RAISE NOTICE '✅ Added image_quality column to supported_vendors';
    ELSE
        RAISE NOTICE '⏭️  Column image_quality already exists, skipping';
    END IF;
END $$;

-- Set default values for existing vendors
UPDATE supported_vendors 
SET image_quality = 'high' 
WHERE image_quality IS NULL;

-- Step 2: Add vendor_slug column to supported_vendors
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supported_vendors' 
        AND column_name = 'vendor_slug'
    ) THEN
        -- Add column without NOT NULL first
        ALTER TABLE supported_vendors ADD COLUMN vendor_slug text;
        RAISE NOTICE '✅ Added vendor_slug column to supported_vendors';
        
        -- Populate vendor_slug based on existing data
        UPDATE supported_vendors SET vendor_slug = 'gunbroker' WHERE LOWER(name) LIKE '%gunbroker%';
        UPDATE supported_vendors SET vendor_slug = 'sports-south' WHERE LOWER(name) LIKE '%sports%south%';
        UPDATE supported_vendors SET vendor_slug = 'bill-hicks' WHERE LOWER(name) LIKE '%bill%hicks%';
        UPDATE supported_vendors SET vendor_slug = 'lipseys' WHERE LOWER(name) LIKE '%lipsey%';
        UPDATE supported_vendors SET vendor_slug = 'chattanooga' WHERE LOWER(name) LIKE '%chattanooga%';
        
        -- Now make it NOT NULL and UNIQUE
        ALTER TABLE supported_vendors ALTER COLUMN vendor_slug SET NOT NULL;
        
        RAISE NOTICE '✅ Set vendor_slug as NOT NULL';
    ELSE
        RAISE NOTICE '⏭️  Column vendor_slug already exists, skipping';
    END IF;
END $$;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'supported_vendors_vendor_slug_unique'
    ) THEN
        ALTER TABLE supported_vendors ADD CONSTRAINT supported_vendors_vendor_slug_unique UNIQUE(vendor_slug);
        RAISE NOTICE '✅ Added UNIQUE constraint on vendor_slug';
    ELSE
        RAISE NOTICE '⏭️  UNIQUE constraint already exists, skipping';
    END IF;
END $$;

-- Step 3: Add vendor_slug column to vendors table
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' 
        AND column_name = 'vendor_slug'
    ) THEN
        -- Add column as nullable
        ALTER TABLE vendors ADD COLUMN vendor_slug text;
        RAISE NOTICE '✅ Added vendor_slug column to vendors table';
        
        -- Populate vendor_slug from the related supported_vendor
        UPDATE vendors v
        SET vendor_slug = sv.vendor_slug
        FROM supported_vendors sv
        WHERE v.supported_vendor_id = sv.id
        AND v.vendor_slug IS NULL;
        
        RAISE NOTICE '✅ Populated vendor_slug values from supported_vendors';
    ELSE
        RAISE NOTICE '⏭️  Column vendor_slug already exists in vendors table, skipping';
    END IF;
END $$;

-- Step 4: Verify supported_vendors has data
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    vendor_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO vendor_count FROM supported_vendors;
    
    IF vendor_count = 0 THEN
        RAISE NOTICE '⚠️  WARNING: supported_vendors table is EMPTY!';
        RAISE NOTICE '⚠️  You need to run: migrations/seed-supported-vendors.sql';
    ELSE
        RAISE NOTICE '✅ Found % vendors in supported_vendors table', vendor_count;
    END IF;
END $$;

-- Summary
-- ----------------------------------------------------------------------------
SELECT 
    '✅ MIGRATION COMPLETE' as status,
    COUNT(*) as total_vendors,
    COUNT(CASE WHEN vendor_slug IS NOT NULL THEN 1 END) as vendors_with_slug,
    COUNT(CASE WHEN image_quality IS NOT NULL THEN 1 END) as vendors_with_image_quality
FROM supported_vendors;


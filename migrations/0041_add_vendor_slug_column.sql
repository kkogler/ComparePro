-- Add vendor_slug column to supported_vendors table
-- This migration adds the missing column that stores immutable vendor identifiers

-- First add the column as nullable
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supported_vendors' 
        AND column_name = 'vendor_slug'
    ) THEN
        -- Add column without NOT NULL first
        ALTER TABLE supported_vendors ADD COLUMN vendor_slug text;
        RAISE NOTICE 'Added vendor_slug column to supported_vendors';
        
        -- Populate vendor_slug based on existing data (lowercase vendor names with hyphens)
        UPDATE supported_vendors SET vendor_slug = 'gunbroker' WHERE LOWER(name) LIKE '%gunbroker%';
        UPDATE supported_vendors SET vendor_slug = 'sports-south' WHERE LOWER(name) LIKE '%sports%south%';
        UPDATE supported_vendors SET vendor_slug = 'bill-hicks' WHERE LOWER(name) LIKE '%bill%hicks%';
        UPDATE supported_vendors SET vendor_slug = 'lipseys' WHERE LOWER(name) LIKE '%lipsey%';
        UPDATE supported_vendors SET vendor_slug = 'chattanooga' WHERE LOWER(name) LIKE '%chattanooga%';
        
        -- Now make it NOT NULL and UNIQUE
        ALTER TABLE supported_vendors ALTER COLUMN vendor_slug SET NOT NULL;
        ALTER TABLE supported_vendors ADD CONSTRAINT supported_vendors_vendor_slug_unique UNIQUE(vendor_slug);
        
        RAISE NOTICE 'Set vendor_slug as NOT NULL and added UNIQUE constraint';
    ELSE
        RAISE NOTICE 'Column vendor_slug already exists, skipping';
    END IF;
END $$;


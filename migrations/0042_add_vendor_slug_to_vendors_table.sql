-- Add vendor_slug column to vendors table (store-level vendor instances)
-- This migration adds the missing column for store vendor slugs

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' 
        AND column_name = 'vendor_slug'
    ) THEN
        -- Add column as nullable (it's populated from supported_vendors)
        ALTER TABLE vendors ADD COLUMN vendor_slug text;
        RAISE NOTICE 'Added vendor_slug column to vendors table';
        
        -- Populate vendor_slug from the related supported_vendor
        UPDATE vendors v
        SET vendor_slug = sv.vendor_slug
        FROM supported_vendors sv
        WHERE v.supported_vendor_id = sv.id
        AND v.vendor_slug IS NULL;
        
        RAISE NOTICE 'Populated vendor_slug values from supported_vendors';
    ELSE
        RAISE NOTICE 'Column vendor_slug already exists in vendors table, skipping';
    END IF;
END $$;


-- Add image_quality column to supported_vendors table
-- This migration adds the missing column that controls image replacement priority

-- Check if column exists before adding (safe to run multiple times)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supported_vendors' 
        AND column_name = 'image_quality'
    ) THEN
        ALTER TABLE supported_vendors ADD COLUMN image_quality text DEFAULT 'high';
        RAISE NOTICE 'Added image_quality column to supported_vendors';
    ELSE
        RAISE NOTICE 'Column image_quality already exists, skipping';
    END IF;
END $$;

-- Set default values for existing vendors if any exist
UPDATE supported_vendors 
SET image_quality = 'high' 
WHERE image_quality IS NULL;


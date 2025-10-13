-- Migration 0033: Fix plan_settings schema inconsistencies
-- Date: 2025-10-13
-- Purpose: Add missing max_orders column to plan_settings table to match companies table structure

-- ============================================================================
-- PLAN_SETTINGS TABLE - Add missing max_orders
-- ============================================================================

-- Add max_orders column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plan_settings' 
    AND column_name = 'max_orders'
  ) THEN
    ALTER TABLE plan_settings 
      ADD COLUMN max_orders integer;
    
    RAISE NOTICE 'Added max_orders column to plan_settings';
  ELSE
    RAISE NOTICE 'max_orders column already exists in plan_settings';
  END IF;
END $$;

-- ============================================================================
-- Update existing plan settings with default values if needed
-- ============================================================================

-- Update null values with sensible defaults based on plan type
UPDATE plan_settings 
SET max_orders = CASE 
  WHEN plan_id = 'free' THEN 100
  WHEN plan_id = 'basic' THEN 500
  WHEN plan_id = 'professional' THEN 2000
  WHEN plan_id = 'enterprise' THEN NULL -- unlimited
  ELSE 500
END
WHERE max_orders IS NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  col_count integer;
BEGIN
  -- Verify max_orders column exists
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns 
  WHERE table_name = 'plan_settings' 
  AND column_name = 'max_orders';
  
  IF col_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: max_orders column not found';
  END IF;
  
  -- Verify max_users column exists
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns 
  WHERE table_name = 'plan_settings' 
  AND column_name = 'max_users';
  
  IF col_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: max_users column not found';
  END IF;
  
  -- Verify max_vendors column exists
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns 
  WHERE table_name = 'plan_settings' 
  AND column_name = 'max_vendors';
  
  IF col_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: max_vendors column not found';
  END IF;
  
  RAISE NOTICE 'Migration 0033 completed successfully';
  RAISE NOTICE 'plan_settings now has: max_users, max_vendors, max_orders';
END $$;

-- ============================================================================
-- SCHEMA ALIGNMENT CHECK
-- ============================================================================

-- Display current schema for verification
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'plan_settings' 
AND column_name LIKE 'max_%'
ORDER BY column_name;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- To rollback this migration, run:
-- ALTER TABLE plan_settings DROP COLUMN IF EXISTS max_orders;


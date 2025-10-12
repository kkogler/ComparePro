-- Add max_orders column to plan_settings
-- This migration adds the max_orders column that was added in the schema but never migrated

ALTER TABLE plan_settings 
ADD COLUMN IF NOT EXISTS max_orders integer;

-- Restore default values for all plans based on the original seed data
UPDATE plan_settings 
SET 
  trial_length_days = 30,
  plan_length_days = CASE 
    WHEN plan_id = 'free-plan' THEN NULL
    ELSE 365
  END,
  max_vendors = CASE 
    WHEN plan_id = 'free-plan' THEN 3
    WHEN plan_id = 'standard-plan' THEN 10
    WHEN plan_id = 'professional-plan' THEN 25
    WHEN plan_id = 'enterprise-plan' THEN NULL
    ELSE 10
  END,
  max_orders = CASE 
    WHEN plan_id = 'free-plan' THEN 100
    WHEN plan_id = 'standard-plan' THEN 1000
    WHEN plan_id = 'professional-plan' THEN 5000
    WHEN plan_id = 'enterprise-plan' THEN NULL
    ELSE 1000
  END,
  updated_at = NOW()
WHERE trial_length_days IS NULL OR max_vendors IS NULL;

-- Verify the update
SELECT 
  id,
  plan_id,
  plan_name,
  trial_length_days,
  plan_length_days,
  max_vendors,
  max_orders,
  online_ordering,
  asn_processing,
  webhook_export,
  is_active
FROM plan_settings
ORDER BY sort_order;


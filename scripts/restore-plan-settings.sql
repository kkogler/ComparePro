-- Restore plan_settings values after max_orders column is re-added
-- Run this AFTER deployment completes

-- First, ensure the max_orders column exists
ALTER TABLE plan_settings 
ADD COLUMN IF NOT EXISTS max_orders integer;

-- Restore the values for all plans
UPDATE plan_settings 
SET 
  trial_length_days = 30,
  plan_length_days = CASE 
    WHEN plan_id LIKE '%free%' THEN NULL
    ELSE 365
  END,
  max_vendors = CASE 
    WHEN plan_id LIKE '%free%' THEN 3
    WHEN plan_id LIKE '%standard%' THEN 10
    WHEN plan_id LIKE '%professional%' OR plan_id LIKE '%premium%' THEN 25
    WHEN plan_id LIKE '%enterprise%' THEN NULL
    ELSE 10
  END,
  max_orders = CASE 
    WHEN plan_id LIKE '%free%' THEN 100
    WHEN plan_id LIKE '%standard%' THEN 1000
    WHEN plan_id LIKE '%professional%' OR plan_id LIKE '%premium%' THEN 5000
    WHEN plan_id LIKE '%enterprise%' THEN NULL
    ELSE 1000
  END,
  updated_at = NOW()
WHERE trial_length_days IS NULL OR max_vendors IS NULL OR max_orders IS NULL;

-- Verify the restoration
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
  webhook_export
FROM plan_settings
ORDER BY sort_order;


-- Seed default plan settings for Production
-- This creates the Free, Standard, and Enterprise plans

-- Insert Free Plan
INSERT INTO plan_settings (
  plan_id,
  plan_name,
  trial_length_days,
  plan_length_days,
  max_users,
  max_vendors,
  online_ordering,
  asn_processing,
  webhook_export,
  is_active,
  sort_order,
  created_at,
  updated_at
) VALUES (
  'free',
  'Free',
  30,
  NULL,
  3,
  3,
  false,
  false,
  false,
  true,
  1,
  NOW(),
  NOW()
) ON CONFLICT (plan_id) DO NOTHING;

-- Insert Standard Plan
INSERT INTO plan_settings (
  plan_id,
  plan_name,
  trial_length_days,
  plan_length_days,
  max_users,
  max_vendors,
  online_ordering,
  asn_processing,
  webhook_export,
  is_active,
  sort_order,
  created_at,
  updated_at
) VALUES (
  'standard',
  'Standard',
  30,
  365,
  10,
  10,
  true,
  true,
  false,
  true,
  2,
  NOW(),
  NOW()
) ON CONFLICT (plan_id) DO NOTHING;

-- Insert Professional Plan
INSERT INTO plan_settings (
  plan_id,
  plan_name,
  trial_length_days,
  plan_length_days,
  max_users,
  max_vendors,
  online_ordering,
  asn_processing,
  webhook_export,
  is_active,
  sort_order,
  created_at,
  updated_at
) VALUES (
  'professional',
  'Professional',
  30,
  365,
  25,
  25,
  true,
  true,
  true,
  true,
  3,
  NOW(),
  NOW()
) ON CONFLICT (plan_id) DO NOTHING;

-- Insert Enterprise Plan (unlimited)
INSERT INTO plan_settings (
  plan_id,
  plan_name,
  trial_length_days,
  plan_length_days,
  max_users,
  max_vendors,
  online_ordering,
  asn_processing,
  webhook_export,
  is_active,
  sort_order,
  created_at,
  updated_at
) VALUES (
  'enterprise',
  'Enterprise',
  30,
  365,
  NULL,
  NULL,
  true,
  true,
  true,
  true,
  4,
  NOW(),
  NOW()
) ON CONFLICT (plan_id) DO NOTHING;

-- Verify the plans were created
SELECT 
  id,
  plan_id,
  plan_name,
  max_users,
  max_vendors,
  online_ordering,
  asn_processing,
  webhook_export,
  is_active
FROM plan_settings
ORDER BY sort_order;
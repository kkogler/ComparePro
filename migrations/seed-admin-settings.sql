-- Seed admin_settings with proper defaults
-- This ensures admin_settings always exists and has sensible defaults

INSERT INTO admin_settings (
  id,
  system_email,
  system_time_zone,
  maintenance_mode,
  registration_enabled,
  max_organizations,
  support_email,
  company_name,
  brand_name,
  support_domain,
  default_pricing_strategy,
  default_pricing_fallback_strategy,
  default_pricing_fallback_markup_percentage,
  default_pricing_rounding_rule,
  default_pricing_use_cross_vendor_fallback,
  created_at,
  updated_at
) VALUES (
  1,
  'noreply@pricecomparehub.com',
  'America/New_York',
  false,
  true,
  1000,
  'support@pricecomparehub.com',
  'PriceCompare Hub',
  'PriceCompare',
  'pricecomparehub.com',
  'msrp',
  'cost_markup',
  55.00,
  'none',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  -- Only update if the pricing defaults are NULL (preserve existing admin settings)
  default_pricing_strategy = COALESCE(admin_settings.default_pricing_strategy, 'msrp'),
  default_pricing_fallback_strategy = COALESCE(admin_settings.default_pricing_fallback_strategy, 'cost_markup'),
  default_pricing_fallback_markup_percentage = COALESCE(admin_settings.default_pricing_fallback_markup_percentage, 55.00),
  updated_at = NOW();

-- Verify the admin settings
SELECT 
  id,
  default_pricing_strategy,
  default_pricing_fallback_strategy,
  default_pricing_fallback_markup_percentage,
  system_email,
  brand_name
FROM admin_settings
WHERE id = 1;

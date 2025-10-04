-- Add default pricing configuration columns to admin_settings table
ALTER TABLE "admin_settings" ADD COLUMN "default_pricing_strategy" text DEFAULT 'msrp';
ALTER TABLE "admin_settings" ADD COLUMN "default_pricing_markup_percentage" numeric(5, 2);
ALTER TABLE "admin_settings" ADD COLUMN "default_pricing_margin_percentage" numeric(5, 2);
ALTER TABLE "admin_settings" ADD COLUMN "default_pricing_premium_amount" numeric(10, 2);
ALTER TABLE "admin_settings" ADD COLUMN "default_pricing_discount_percentage" numeric(5, 2);
ALTER TABLE "admin_settings" ADD COLUMN "default_pricing_rounding_rule" text DEFAULT 'none';
ALTER TABLE "admin_settings" ADD COLUMN "default_pricing_fallback_strategy" text DEFAULT 'map';
ALTER TABLE "admin_settings" ADD COLUMN "default_pricing_fallback_markup_percentage" numeric(5, 2);
ALTER TABLE "admin_settings" ADD COLUMN "default_pricing_use_cross_vendor_fallback" boolean DEFAULT false;


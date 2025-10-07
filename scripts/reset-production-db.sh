#!/bin/bash
# Reset production database - USE WITH CAUTION!
# This will delete ALL data

echo "⚠️  WARNING: This will DELETE ALL DATA in production database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

echo "🗑️  Dropping all tables..."

psql "$DATABASE_URL" <<EOF
-- Drop all tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS asn_items CASCADE;
DROP TABLE IF EXISTS asns CASCADE;
DROP TABLE IF EXISTS vendor_products CASCADE;
DROP TABLE IF EXISTS vendor_product_mappings CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS user_stores CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS po_sequences CASCADE;
DROP TABLE IF EXISTS pricing_configurations CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_payments CASCADE;
DROP TABLE IF EXISTS subscription_plan_changes CASCADE;
DROP TABLE IF EXISTS subscription_webhook_events CASCADE;
DROP TABLE IF EXISTS subscription_usage CASCADE;
DROP TABLE IF EXISTS billing_events CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS org_domains CASCADE;
DROP TABLE IF EXISTS supported_vendor_retail_verticals CASCADE;
DROP TABLE IF EXISTS category_templates CASCADE;
DROP TABLE IF EXISTS retail_verticals CASCADE;
DROP TABLE IF EXISTS supported_vendors CASCADE;
DROP TABLE IF EXISTS vendor_field_mappings CASCADE;
DROP TABLE IF EXISTS admin_settings CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS integration_settings CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS plan_settings CASCADE;
DROP TABLE IF EXISTS organization_status_audit_log CASCADE;
DROP TABLE IF EXISTS products CASCADE;

SELECT 'All tables dropped' as status;
EOF

echo "✅ Database wiped!"
echo ""
echo "🔄 Restarting application to run migrations..."
echo "After restart, run: bash scripts/seed-production-data.sh"


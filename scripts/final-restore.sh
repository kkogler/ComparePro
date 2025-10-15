#!/bin/bash
# Final restore with CORRECT dependency order

set -e

DEV_DB="postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
PROD_DB="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔄 FINAL RESTORE: DEV FROM PRODUCTION"
echo "======================================"
echo ""

echo "1️⃣  Resetting dev schema..."
psql "$DEV_DB" <<EOF >/dev/null
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
EOF
echo "   ✅ Schema dropped"

echo ""
echo "2️⃣  Recreating tables from code..."
npm run db:push -- --force 2>&1 | grep -E "(Changes applied|error)" || true
echo "   ✅ Tables created"

echo ""
echo "3️⃣  Copying data in dependency order..."

# Function to copy a table
copy_table() {
  local table=$1
  local count=$(psql "$PROD_DB" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | tr -d ' ' || echo "0")
  
  if [ "$count" -gt 0 ]; then
    echo "   📋 $table ($count rows)..."
    psql "$PROD_DB" -c "\COPY $table TO STDOUT" 2>/dev/null | \
      psql "$DEV_DB" -c "\COPY $table FROM STDIN" 2>/dev/null
    
    local dev_count=$(psql "$DEV_DB" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | tr -d ' ' || echo "0")
    if [ "$count" == "$dev_count" ]; then
      echo "      ✅ $dev_count rows"
    else
      echo "      ❌ Mismatch: Prod=$count, Dev=$dev_count"
      return 1
    fi
  fi
}

# Copy in correct dependency order
copy_table "retail_verticals"
copy_table "companies"
copy_table "stores"
copy_table "users"
copy_table "user_stores"
copy_table "supported_vendors"
copy_table "supported_vendor_retail_verticals"
copy_table "company_vendor_credentials"
copy_table "category_templates"
copy_table "categories"
copy_table "products"
copy_table "vendor_products"
copy_table "vendor_product_mappings"
copy_table "vendor_inventory"
copy_table "vendor_field_mappings"
copy_table "vendors"
copy_table "pricing_configurations"
copy_table "subscriptions"
copy_table "subscription_webhook_events"
copy_table "subscription_payments"
copy_table "subscription_plan_changes"
copy_table "subscription_usage"
copy_table "billing_events"
copy_table "plan_settings"
copy_table "admin_settings"
copy_table "settings"
copy_table "integration_settings"
copy_table "org_domains"
copy_table "organization_status_audit_log"
copy_table "usage_metrics"
copy_table "search_history"
copy_table "import_jobs"
copy_table "orders"
copy_table "order_items"
copy_table "asns"
copy_table "asn_items"
copy_table "po_sequences"

echo ""
echo "✅ RESTORE COMPLETE!"
echo ""
echo "📊 Final Verification:"
psql "$DEV_DB" <<EOF
SELECT 
  'companies' as "Table", COUNT(*)::text as "Count" FROM companies UNION ALL
  SELECT 'users', COUNT(*)::text FROM users UNION ALL
  SELECT 'products', COUNT(*)::text FROM products UNION ALL
  SELECT 'supported_vendors', COUNT(*)::text FROM supported_vendors UNION ALL
  SELECT 'company_vendor_credentials', COUNT(*)::text FROM company_vendor_credentials UNION ALL
  SELECT 'vendor_product_mappings', COUNT(*)::text FROM vendor_product_mappings UNION ALL
  SELECT 'vendor_inventory', COUNT(*)::text FROM vendor_inventory
ORDER BY "Table";
EOF

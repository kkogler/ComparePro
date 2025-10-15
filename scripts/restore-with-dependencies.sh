#!/bin/bash
# Restore dev from production with proper dependency order

set -e

DEV_DB="postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
PROD_DB="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔄 RESTORE DEV FROM PRODUCTION (with dependencies)"
echo "==================================================="
echo ""

# Define tables in dependency order (parents first)
TABLES=(
  "retail_verticals"
  "companies"
  "stores"
  "users"
  "user_stores"
  "supported_vendors"
  "supported_vendor_retail_verticals"
  "company_vendor_credentials"
  "category_templates"
  "categories"
  "products"
  "vendor_products"
  "vendor_product_mappings"
  "vendor_inventory"
  "vendor_field_mappings"
  "vendors"
  "pricing_configurations"
  "subscriptions"
  "subscription_webhook_events"
  "subscription_payments"
  "subscription_plan_changes"
  "subscription_usage"
  "billing_events"
  "plan_settings"
  "admin_settings"
  "settings"
  "integration_settings"
  "org_domains"
  "organization_status_audit_log"
  "usage_metrics"
  "search_history"
  "import_jobs"
  "orders"
  "order_items"
  "asns"
  "asn_items"
  "po_sequences"
)

echo "1️⃣  Disabling triggers in dev..."
psql "$DEV_DB" -c "SET session_replication_role = replica;" >/dev/null

echo "2️⃣  Truncating all tables..."
for table in "${TABLES[@]}"; do
  psql "$DEV_DB" -c "TRUNCATE TABLE $table CASCADE;" 2>/dev/null || true
done

echo ""
echo "3️⃣  Copying data..."
TOTAL_ROWS=0

for table in "${TABLES[@]}"; do
  COUNT=$(psql "$PROD_DB" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | tr -d ' ' || echo "0")
  
  if [ "$COUNT" -gt 0 ]; then
    echo "   📋 $table ($COUNT rows)..."
    psql "$PROD_DB" -c "\COPY $table TO STDOUT" 2>/dev/null | psql "$DEV_DB" -c "\COPY $table FROM STDIN" 2>/dev/null
    
    if [ $? -eq 0 ]; then
      DEV_COUNT=$(psql "$DEV_DB" -t -c "SELECT COUNT(*) FROM $table" | tr -d ' ')
      TOTAL_ROWS=$((TOTAL_ROWS + DEV_COUNT))
      echo "      ✅ $DEV_COUNT rows copied"
    else
      echo "      ⚠️  Copy failed (may be empty)"
    fi
  fi
done

echo ""
echo "4️⃣  Re-enabling triggers..."
psql "$DEV_DB" -c "SET session_replication_role = DEFAULT;" >/dev/null

echo ""
echo "✅ RESTORE COMPLETE! ($TOTAL_ROWS total rows)"
echo ""
echo "📊 Key table verification:"
psql "$DEV_DB" <<EOF
SELECT 
  'companies' as table_name, COUNT(*)::text as count FROM companies UNION ALL
  SELECT 'users', COUNT(*)::text FROM users UNION ALL
  SELECT 'products', COUNT(*)::text FROM products UNION ALL
  SELECT 'supported_vendors', COUNT(*)::text FROM supported_vendors UNION ALL
  SELECT 'company_vendor_credentials', COUNT(*)::text FROM company_vendor_credentials UNION ALL
  SELECT 'vendor_product_mappings', COUNT(*)::text FROM vendor_product_mappings UNION ALL
  SELECT 'vendor_inventory', COUNT(*)::text FROM vendor_inventory
ORDER BY table_name;
EOF

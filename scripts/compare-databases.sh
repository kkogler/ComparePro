#!/bin/bash
# Compare dev and production databases

DEV_DB="postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
PROD_DB="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔍 DATABASE COMPARISON: DEV vs PRODUCTION"
echo "=========================================="
echo ""

echo "📋 TABLES IN PRODUCTION:"
psql "$PROD_DB" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" -t | sed 's/^/ /'
echo ""

echo "📋 TABLES IN DEV:"
psql "$DEV_DB" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" -t | sed 's/^/ /'
echo ""

echo "📊 DATA COUNTS - PRODUCTION:"
psql "$PROD_DB" <<EOF
SELECT 
  'companies' as table_name, COUNT(*)::text as count FROM companies UNION ALL
  SELECT 'users', COUNT(*)::text FROM users UNION ALL
  SELECT 'stores', COUNT(*)::text FROM stores UNION ALL
  SELECT 'products', COUNT(*)::text FROM products UNION ALL
  SELECT 'supported_vendors', COUNT(*)::text FROM supported_vendors UNION ALL
  SELECT 'vendor_product_mappings', COUNT(*)::text FROM vendor_product_mappings UNION ALL
  SELECT 'vendor_inventory', COUNT(*)::text FROM vendor_inventory UNION ALL
  SELECT 'company_vendor_credentials', COUNT(*)::text FROM company_vendor_credentials
ORDER BY table_name;
EOF

echo ""
echo "📊 DATA COUNTS - DEV:"
psql "$DEV_DB" <<EOF
SELECT 
  'companies' as table_name, COUNT(*)::text as count FROM companies UNION ALL
  SELECT 'users', COUNT(*)::text FROM users UNION ALL
  SELECT 'stores', COUNT(*)::text FROM stores UNION ALL
  SELECT 'products', COUNT(*)::text FROM products UNION ALL
  SELECT 'supported_vendors', COUNT(*)::text FROM supported_vendors UNION ALL
  SELECT 'vendor_product_mappings', COUNT(*)::text FROM vendor_product_mappings UNION ALL
  SELECT 'vendor_inventory', COUNT(*)::text FROM vendor_inventory UNION ALL
  SELECT 'company_vendor_credentials', COUNT(*)::text FROM company_vendor_credentials
ORDER BY table_name;
EOF

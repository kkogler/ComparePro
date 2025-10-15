#!/bin/bash
# Complete restore of dev from production with ALL tables

set -e

DEV_DB="postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
PROD_DB="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔄 FULL RESTORE: DEV FROM PRODUCTION"
echo "====================================="
echo ""

# Get all table names from production in dependency order
echo "1️⃣  Getting table list from production..."
TABLES=$(psql "$PROD_DB" -t -c "
  SELECT tablename 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  ORDER BY tablename
")

echo "   Found $(echo "$TABLES" | wc -w) tables"
echo ""

echo "2️⃣  Truncating all dev tables..."
for table in $TABLES; do
  echo "   Truncating $table..."
  psql "$DEV_DB" -c "TRUNCATE TABLE $table CASCADE;" 2>/dev/null || echo "      (skipped)"
done
echo ""

echo "3️⃣  Copying data table by table..."
for table in $TABLES; do
  COUNT=$(psql "$PROD_DB" -t -c "SELECT COUNT(*) FROM $table" | tr -d ' ')
  
  if [ "$COUNT" -gt 0 ]; then
    echo "   📋 $table ($COUNT rows)..."
    psql "$PROD_DB" -c "\COPY $table TO STDOUT" | psql "$DEV_DB" -c "\COPY $table FROM STDIN"
    
    if [ $? -eq 0 ]; then
      DEV_COUNT=$(psql "$DEV_DB" -t -c "SELECT COUNT(*) FROM $table" | tr -d ' ')
      if [ "$COUNT" == "$DEV_COUNT" ]; then
        echo "      ✅ Copied $DEV_COUNT rows"
      else
        echo "      ⚠️  Mismatch: Prod=$COUNT, Dev=$DEV_COUNT"
      fi
    else
      echo "      ❌ Copy failed"
    fi
  fi
done

echo ""
echo "✅ RESTORE COMPLETE!"
echo ""
echo "Final verification:"
psql "$DEV_DB" <<EOF
SELECT 
  'companies' as table_name, COUNT(*)::text as dev_count FROM companies UNION ALL
  SELECT 'supported_vendors', COUNT(*)::text FROM supported_vendors UNION ALL
  SELECT 'company_vendor_credentials', COUNT(*)::text FROM company_vendor_credentials UNION ALL
  SELECT 'vendor_product_mappings', COUNT(*)::text FROM vendor_product_mappings UNION ALL
  SELECT 'vendor_inventory', COUNT(*)::text FROM vendor_inventory UNION ALL
  SELECT 'products', COUNT(*)::text FROM products UNION ALL
  SELECT 'users', COUNT(*)::text FROM users
ORDER BY table_name;
EOF

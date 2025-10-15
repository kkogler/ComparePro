#!/bin/bash
# Clean restore: drop schema, recreate, copy all data

set -e

DEV_DB="postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
PROD_DB="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔄 CLEAN RESTORE: DEV FROM PRODUCTION"
echo "======================================"
echo ""

echo "1️⃣  Dropping and recreating dev schema..."
psql "$DEV_DB" <<EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
EOF
echo "   ✅ Schema reset"
echo ""

echo "2️⃣  Recreating schema from code..."
npm run db:push -- --force
echo ""

echo "3️⃣  Getting production schema..."
PROD_SCHEMA=$(psql "$PROD_DB" -t -c "
  SELECT 
    'CREATE TABLE ' || tablename || ' (' || 
    string_agg(column_def, ', ') || ');'
  FROM (
    SELECT 
      t.tablename,
      a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod) as column_def
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE t.schemaname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY t.tablename, a.attnum
  ) sub
  GROUP BY tablename
  ORDER BY tablename;
")

echo "4️⃣  Copying ALL data from production..."
TABLES=$(psql "$PROD_DB" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")

# Copy in batches to handle foreign keys
for table in $TABLES; do
  COUNT=$(psql "$PROD_DB" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | tr -d ' ' || echo "0")
  
  if [ "$COUNT" -gt 0 ]; then
    echo "   📋 $table ($COUNT rows)..."
    
    # Dump from prod and load to dev
    psql "$PROD_DB" -c "\COPY (SELECT * FROM $table) TO STDOUT" 2>/dev/null | \
      psql "$DEV_DB" -c "\COPY $table FROM STDIN" 2>&1 | grep -v "^COPY" || true
      
    DEV_COUNT=$(psql "$DEV_DB" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$COUNT" == "$DEV_COUNT" ]; then
      echo "      ✅ Copied $DEV_COUNT rows"
    else
      echo "      ⚠️  Prod: $COUNT, Dev: $DEV_COUNT"
    fi
  fi
done

echo ""
echo "✅ RESTORE COMPLETE!"
echo ""
echo "📊 Verification:"
psql "$DEV_DB" <<EOF
SELECT 
  'companies' as table, COUNT(*)::text as count FROM companies UNION ALL
  SELECT 'users', COUNT(*)::text FROM users UNION ALL
  SELECT 'products', COUNT(*)::text FROM products UNION ALL
  SELECT 'supported_vendors', COUNT(*)::text FROM supported_vendors UNION ALL
  SELECT 'company_vendor_credentials', COUNT(*)::text FROM company_vendor_credentials UNION ALL
  SELECT 'vendor_product_mappings', COUNT(*)::text FROM vendor_product_mappings UNION ALL
  SELECT 'vendor_inventory', COUNT(*)::text FROM vendor_inventory
ORDER BY table;
EOF

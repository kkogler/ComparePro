#!/bin/bash
# Final simple version: Drop dev schema and copy from production

set -e

DEV_DB="postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
PROD_DB="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔄 RESET DEV FROM PRODUCTION"
echo "============================"
echo ""

echo "1️⃣  Dropping dev database schema..."
psql "$DEV_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
echo "   ✅ Dev schema dropped"
echo ""

echo "2️⃣  Pushing schema from code to dev..."
DATABASE_URL="$DEV_DB" npm run db:push -- --force
echo ""

echo "3️⃣  Copying data table by table..."
TABLES="retail_verticals supported_vendors supported_vendor_retail_verticals companies stores users category_templates products vendor_product_mappings vendor_inventory company_vendor_credentials"

for table in $TABLES; do
  echo "   📋 $table..."
  COUNT=$(psql "$PROD_DB" -t -c "SELECT COUNT(*) FROM $table")
  if [ "$COUNT" -gt 0 ]; then
    psql "$PROD_DB" -c "\COPY $table TO STDOUT" | psql "$DEV_DB" -c "\COPY $table FROM STDIN" 2>/dev/null || echo "      (skipped - table may not exist)"
  fi
done

echo ""
echo "✅ RESTORE COMPLETE!"
echo ""
psql "$DEV_DB" -c "SELECT 'Companies:' as item, COUNT(*)::text as count FROM companies UNION ALL SELECT 'Users:', COUNT(*)::text FROM users UNION ALL SELECT 'Products:', COUNT(*)::text FROM products;"

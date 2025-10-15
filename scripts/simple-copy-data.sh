#!/bin/bash
# Simple data copy from production to development
# Assumes schema already exists in dev

DEV_DB="postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
PROD_DB="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔄 COPY DATA FROM PRODUCTION TO DEVELOPMENT"
echo ""

# Step 1: Ensure dev has schema (from code)
echo "1️⃣  Ensuring dev database has schema..."
npm run db:push -- --force

echo ""
echo "2️⃣  Truncating dev tables..."
psql "$DEV_DB" <<EOF
TRUNCATE companies, users, stores, products, pricing_rules, 
  supported_vendors, company_vendor_credentials, 
  vendor_product_mappings, vendor_inventory, 
  retail_verticals, category_templates,
  supported_vendor_retail_verticals
CASCADE;
EOF

echo ""
echo "3️⃣  Copying data from production to dev..."

# Copy in dependency order
for table in retail_verticals supported_vendors companies users stores products pricing_rules company_vendor_credentials vendor_product_mappings vendor_inventory category_templates supported_vendor_retail_verticals; do
  echo "   Copying $table..."
  psql "$PROD_DB" -c "\COPY $table TO STDOUT" | psql "$DEV_DB" -c "\COPY $table FROM STDIN"
done

echo ""
echo "✅ DATA COPY COMPLETE!"
echo ""
echo "Verification:"
psql "$DEV_DB" -c "SELECT COUNT(*) as companies FROM companies; SELECT COUNT(*) as products FROM products; SELECT COUNT(*) as users FROM users;"

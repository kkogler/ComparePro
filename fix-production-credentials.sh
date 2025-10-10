#!/bin/bash
# Fix Production Credentials Schema
# This script applies the credentials schema fix to production

set -e  # Exit on error

echo "🔧 Production Credentials Schema Fix"
echo "===================================="
echo ""

# Check if PRODUCTION_DATABASE_URL is set
if [ -z "$PRODUCTION_DATABASE_URL" ]; then
  echo "❌ Error: PRODUCTION_DATABASE_URL is not set"
  echo ""
  echo "Please set it first:"
  echo "  export PRODUCTION_DATABASE_URL='your-production-db-url'"
  echo ""
  exit 1
fi

echo "✅ Production database URL is configured"
echo ""

# Step 1: Backup
echo "📦 Step 1: Creating backup..."
echo ""
export DATABASE_URL="$PRODUCTION_DATABASE_URL"
tsx scripts/export-database.ts

if [ $? -ne 0 ]; then
  echo "❌ Backup failed! Aborting."
  exit 1
fi

echo ""
echo "✅ Backup completed"
echo ""

# Step 2: Run schema fix
echo "🔄 Step 2: Applying schema fix..."
echo ""
tsx scripts/fix-credentials-schema.ts

if [ $? -ne 0 ]; then
  echo "❌ Schema fix failed! Database may be in inconsistent state."
  echo "   Please check the error and consider restoring from backup."
  exit 1
fi

echo ""
echo "✅ Schema fix completed"
echo ""

# Step 3: Build application
echo "🏗️  Step 3: Building application..."
echo ""
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed! Please fix build errors before deploying."
  exit 1
fi

echo ""
echo "✅ Build completed"
echo ""

# Step 4: Success message
echo "🎉 Production credentials schema fix complete!"
echo ""
echo "Next steps:"
echo "  1. Deploy the built application to production"
echo "  2. Test credential saves at: https://pricecomparehub.com/org/slither-guns/supported-vendors"
echo "  3. Verify Bill Hicks and Lipsey's credentials work"
echo ""
echo "If anything goes wrong, restore from backup:"
echo "  tsx scripts/import-database.ts production --file backups/[latest-backup].sql"
echo ""





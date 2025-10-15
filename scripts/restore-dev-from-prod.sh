#!/bin/bash
# Restore Development Database from Production
# This safely copies production data to dev database

set -e  # Exit on error

echo "🔄 RESTORE DEV FROM PRODUCTION"
echo "=============================="
echo ""

# Database URLs
DEV_DB="postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
PROD_DB="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Create backups directory if it doesn't exist
mkdir -p backups

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/production_backup_${TIMESTAMP}.sql"

echo "📦 Step 1: Backing up PRODUCTION database..."
echo "   Saving to: $BACKUP_FILE"
pg_dump "$PROD_DB" > "$BACKUP_FILE"

if [ $? -ne 0 ]; then
  echo "❌ Production backup failed!"
  exit 1
fi

echo "   ✅ Production backup saved: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""

echo "🗑️  Step 2: Clearing DEVELOPMENT database..."
psql "$DEV_DB" <<EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO neondb_owner;
GRANT ALL ON SCHEMA public TO public;
EOF

if [ $? -ne 0 ]; then
  echo "❌ Failed to clear dev database!"
  exit 1
fi

echo "   ✅ Dev database cleared"
echo ""

echo "📥 Step 3: Restoring production data to DEVELOPMENT..."
psql "$DEV_DB" < "$BACKUP_FILE"

if [ $? -ne 0 ]; then
  echo "❌ Restore failed!"
  echo "   Dev database may be in inconsistent state"
  exit 1
fi

echo "   ✅ Production data restored to dev"
echo ""

echo "🔍 Step 4: Verification..."
echo ""
echo "Production database:"
psql "$PROD_DB" -c "SELECT COUNT(*) as companies FROM companies; SELECT COUNT(*) as products FROM products; SELECT COUNT(*) as users FROM users;"

echo ""
echo "Development database:"
psql "$DEV_DB" -c "SELECT COUNT(*) as companies FROM companies; SELECT COUNT(*) as products FROM products; SELECT COUNT(*) as users FROM users;"

echo ""
echo "✅ RESTORE COMPLETE!"
echo ""
echo "📊 Summary:"
echo "   - Production backed up to: $BACKUP_FILE"
echo "   - Dev database now has production data"
echo "   - You can safely test/develop without affecting production"
echo ""

#!/bin/bash
# Copy Production to Development using pg_dump with compatibility flag

set -e

echo "🔄 RESTORE DEV FROM PRODUCTION"
echo "=============================="
echo ""

DEV_DB="postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
PROD_DB="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

mkdir -p backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/production_backup_${TIMESTAMP}.sql"

echo "📦 Step 1: Backing up PRODUCTION database..."
echo "   Using format compatible with pg_dump 15.7"

# Use --no-sync for faster backup and compatibility
pg_dump "$PROD_DB" --no-sync --no-tablespaces --no-owner --no-acl > "$BACKUP_FILE" 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Production backup failed!"
  cat "$BACKUP_FILE"
  exit 1
fi

echo "   ✅ Production backup saved: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""

echo "🗑️  Step 2: Clearing DEVELOPMENT database..."
psql "$DEV_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "   ✅ Dev database cleared"
echo ""

echo "📥 Step 3: Restoring to DEVELOPMENT..."
psql "$DEV_DB" -f "$BACKUP_FILE" -v ON_ERROR_STOP=0

echo ""
echo "✅ RESTORE COMPLETE!"
echo ""
echo "Verification:"
psql "$DEV_DB" -c "SELECT 'Companies:', COUNT(*) FROM companies UNION ALL SELECT 'Products:', COUNT(*) FROM products UNION ALL SELECT 'Users:', COUNT(*) FROM users;"

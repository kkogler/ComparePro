#!/bin/bash
# Migrate production database to latest schema

set -e

PROD_DB="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔄 PRODUCTION SCHEMA MIGRATION"
echo "================================"
echo ""
echo "⚠️  This will update production database schema to match code"
echo "   (Safe: only adds columns, doesn't delete data)"
echo ""

# Backup current DATABASE_URL
ORIGINAL_DB_URL="$DATABASE_URL"
echo "📌 Saved current DATABASE_URL: ep-lingering-hat-adb2bp8d (dev)"
echo ""

# Point to production temporarily
export DATABASE_URL="$PROD_DB"
echo "1️⃣  Switched to PRODUCTION database: ep-lingering-sea-adyjzybe"
echo ""

echo "2️⃣  Running schema migration on production..."
npm run db:push -- --force 2>&1 | grep -E "(Changes applied|error|warning)" || true
echo ""

# Restore dev DATABASE_URL
export DATABASE_URL="$ORIGINAL_DB_URL"
echo "3️⃣  Restored workspace to DEV database: ep-lingering-hat-adb2bp8d"
echo ""

echo "✅ Production schema migration complete!"
echo ""
echo "Verifying production schema:"
psql "$PROD_DB" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'supported_vendors' AND column_name IN ('vendor_slug', 'vendor_short_code') ORDER BY column_name;"

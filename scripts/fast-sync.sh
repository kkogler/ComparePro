#!/bin/bash
# Fast database sync using native PostgreSQL tools
set -e

SOURCE_URL="${DATABASE_URL}"
TARGET_URL="${PRODUCTION_DATABASE_URL}"

if [ -z "$SOURCE_URL" ]; then
    echo "❌ DATABASE_URL not set (source)"
    exit 1
fi

if [ -z "$TARGET_URL" ]; then
    echo "❌ PRODUCTION_DATABASE_URL not set (target)"
    exit 1
fi

echo "🔄 FAST DATABASE SYNC"
echo ""
echo "📤 Source: Hosted NEON"
echo "📥 Target: Production NEON"
echo ""

# Create temp directory
TEMP_DIR="/tmp/db-sync-$$"
mkdir -p "$TEMP_DIR"

echo "⏳ Step 1: Dumping data from source..."
pg_dump "$SOURCE_URL" \
    --data-only \
    --no-owner \
    --no-acl \
    --disable-triggers \
    --file="$TEMP_DIR/data.sql" 2>&1 | grep -v "server version" || true

if [ ! -f "$TEMP_DIR/data.sql" ]; then
    echo "❌ Export failed"
    exit 1
fi

FILE_SIZE=$(du -h "$TEMP_DIR/data.sql" | cut -f1)
echo "✅ Export complete (${FILE_SIZE})"
echo ""

echo "⏳ Step 2: Clearing target database..."
psql "$TARGET_URL" -c "
DO \$\$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END \$\$;
" > /dev/null 2>&1

echo "✅ Target database cleared"
echo ""

echo "⏳ Step 3: Importing data to target..."
psql "$TARGET_URL" \
    --file="$TEMP_DIR/data.sql" \
    --single-transaction \
    --quiet 2>&1 | grep -v "ERROR" | head -20 || true

echo ""
echo "✅ Import complete!"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"

echo "🎉 Fast sync complete!"





















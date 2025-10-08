#!/bin/bash
set -e

# Ensure PostgreSQL is running
./ensure-postgres.sh

PG_SOCKETS="/home/runner/.postgresql/sockets"

# FORCE local database URL (overrides Replit Secrets)
unset DATABASE_URL
export DATABASE_URL="postgresql://user:password@localhost:5432/pricecompare?host=$PG_SOCKETS"
export NODE_ENV=development

echo "=== Starting Development Server ==="
echo "🔌 Database: LOCAL PostgreSQL"
echo "📍 URL: $DATABASE_URL"

tsx server/index.ts

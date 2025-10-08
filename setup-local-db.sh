#!/bin/bash
set -e

echo "🔧 Setting up local PostgreSQL database..."

# Create directories
PG_DIR="/home/runner/.postgresql"
PG_DATA="$PG_DIR/data"
PG_SOCKETS="$PG_DIR/sockets"
PG_LOG="$PG_DIR/postgres.log"

mkdir -p "$PG_DATA" "$PG_SOCKETS"

# Initialize PostgreSQL if not already done
if [ ! -f "$PG_DATA/PG_VERSION" ]; then
  echo "📦 Initializing PostgreSQL database..."
  initdb -D "$PG_DATA" -U user --auth=trust
fi

# Start PostgreSQL
echo "🚀 Starting PostgreSQL server..."
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-k $PG_SOCKETS -h localhost" start

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
  if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!"
    break
  fi
  sleep 1
done

# Create database if it doesn't exist
echo "🗄️ Creating pricecompare database..."
psql -h localhost -U user -tc "SELECT 1 FROM pg_database WHERE datname = 'pricecompare'" | grep -q 1 || \
  psql -h localhost -U user -c "CREATE DATABASE pricecompare"

# Set password for user
psql -h localhost -U user -c "ALTER USER \"user\" WITH PASSWORD 'password';"

echo "✅ Local PostgreSQL setup complete!"
echo "📍 Connection: postgresql://user:password@localhost:5432/pricecompare"

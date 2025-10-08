#!/bin/bash

PG_DIR="/home/runner/.postgresql"
PG_DATA="$PG_DIR/data"
PG_SOCKETS="$PG_DIR/sockets"
PG_LOG="$PG_DIR/postgres.log"

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo "🚀 Starting local PostgreSQL..."
  pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-k $PG_SOCKETS -h localhost" start
  sleep 2
fi

# Verify it's running
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo "✅ Local PostgreSQL is running"
else
  echo "❌ Failed to start PostgreSQL"
  exit 1
fi

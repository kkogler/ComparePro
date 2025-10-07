#!/bin/bash
# Start PostgreSQL for Development

echo "🔍 Checking PostgreSQL status..."

# Check if PostgreSQL is already running
if pg_ctl -D /home/runner/.postgresql/data status > /dev/null 2>&1; then
    echo "✅ PostgreSQL is already running"
    exit 0
fi

# Start PostgreSQL
echo "🚀 Starting PostgreSQL..."
pg_ctl -D /home/runner/.postgresql/data -o "-k /home/runner/.postgresql/sockets" -l /home/runner/.postgresql/logfile start

# Wait for startup
sleep 2

# Check if it started successfully
if pg_ctl -D /home/runner/.postgresql/data status > /dev/null 2>&1; then
    echo "✅ PostgreSQL started successfully"
    echo "📊 Database: pricecompare"
    echo "🔌 Connection: postgresql://user:password@localhost:5432/pricecompare"
else
    echo "❌ Failed to start PostgreSQL"
    echo "Check logs at: /home/runner/.postgresql/logfile"
    exit 1
fi


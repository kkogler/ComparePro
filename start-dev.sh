#!/bin/bash
# Start Development Server with Local PostgreSQL

echo "🔍 Starting PostgreSQL..."
./start-postgres.sh

echo ""
echo "🚀 Starting Development Server..."
echo "📊 Using LOCAL database: postgresql://user:password@localhost:5432/pricecompare"

# Override Replit Secrets to use local database
export DATABASE_URL="postgresql://user:password@localhost:5432/pricecompare"
export NODE_ENV="development"

npm run dev


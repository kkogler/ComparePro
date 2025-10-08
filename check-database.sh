#!/bin/bash

if [[ "$DATABASE_URL" == *"localhost"* ]]; then
  echo "🏠 Using LOCAL PostgreSQL database"
  echo "📍 $DATABASE_URL"
elif [[ "$DATABASE_URL" == *"neon"* ]] || [[ "$DATABASE_URL" == *"ep-"* ]]; then
  echo "☁️  Using NEON Cloud database (Production)"
  echo "📍 ${DATABASE_URL:0:60}..."
else
  echo "❓ Unknown database connection"
  echo "📍 ${DATABASE_URL:0:60}..."
fi

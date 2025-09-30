#!/bin/bash

# Clean Start Script - Avoids port conflicts
echo "🧹 Cleaning up existing processes..."

# Stop any PM2-managed apps (ignore errors if PM2 not installed)
pm2 delete all 2>/dev/null || true

# Kill any existing server processes (dev/prod)
pkill -f "tsx server/index.ts" 2>/dev/null || echo "No tsx processes found"
pkill -f "node .*dist/index.js" 2>/dev/null || echo "No dist server processes found"
pkill -f "vite" 2>/dev/null || echo "No vite processes found"
pkill -f "npm run dev" 2>/dev/null || echo "No npm dev processes found"

# Wait a moment for processes to fully terminate
sleep 2

echo "🔎 Ensuring port 5000 is free (skipping lsof in this environment)"

echo "✅ Cleanup complete. Starting server..."
PORT=${PORT:-5000} NODE_ENV=development npm run dev















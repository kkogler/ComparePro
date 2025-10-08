#!/bin/bash
# Simple script to restart the dev server

echo "🛑 Stopping server..."
pkill -f "tsx server/index.ts"

echo "⏳ Waiting for clean shutdown..."
sleep 2

echo "🚀 Starting server..."
cd /home/runner/workspace && npm run dev:cursor &

echo "✅ Server restarting in background..."
echo "📍 Server will be available at http://localhost:3001"

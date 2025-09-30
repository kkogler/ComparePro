#!/bin/bash

echo "🔍 Finding all server processes..."

# Kill all tsx processes running server/index.ts
echo "🛑 Killing tsx server processes..."
pkill -f "tsx server/index.ts" 2>/dev/null || true
pkill -f "server/index.ts" 2>/dev/null || true

# Kill any npm processes running dev
echo "🛑 Killing npm dev processes..."
pkill -f "npm run dev" 2>/dev/null || true

# Kill any node processes with server/index.ts
echo "🛑 Killing node server processes..."
ps aux | grep "server/index.ts" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true

# Kill anything listening on port 5000
echo "🛑 Killing processes on port 5000..."
# Use ss instead of lsof/netstat (more reliable)
PORT_PIDS=$(ss -tlnp | grep :5000 | grep -o 'pid=[0-9]*' | cut -d= -f2)
if [ ! -z "$PORT_PIDS" ]; then
    echo "Found processes on port 5000: $PORT_PIDS"
    echo $PORT_PIDS | xargs kill -9 2>/dev/null || true
fi

# Clean up PID files
echo "🧹 Cleaning up PID files..."
rm -f server.pid
rm -f .server.pid

echo "⏳ Waiting for cleanup..."
sleep 3

echo "✅ All server processes killed!"

# Verify port 5000 is free
if ss -tln | grep -q :5000; then
    echo "❌ Port 5000 is still in use!"
    ss -tlnp | grep :5000
    exit 1
else
    echo "✅ Port 5000 is now free!"
fi
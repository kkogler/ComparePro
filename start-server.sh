#!/bin/bash

# Proper server startup script with process management
# Prevents multiple instances and ensures clean startup

PID_FILE="/tmp/server.pid"
PORT=${PORT:-5000}

echo "🚀 Starting server with process management..."

# Function to check if server is running
is_server_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0  # Server is running
        else
            rm -f "$PID_FILE"  # Remove stale PID file
            return 1  # Server is not running
        fi
    else
        return 1  # No PID file
    fi
}

# Function to kill existing server processes
kill_existing_processes() {
    echo "🛑 Stopping existing server processes..."
    
    # Kill tsx server processes
    pkill -f "tsx server/index.ts" 2>/dev/null || true
    pkill -f "server/index.ts" 2>/dev/null || true
    
    # Kill npm dev processes
    pkill -f "npm run dev" 2>/dev/null || true
    
    # Kill any node processes with server/index.ts
    ps aux | grep "server/index.ts" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
    
    # Remove PID file
    rm -f "$PID_FILE"
    rm -f server.pid
    
    # Wait for processes to die
    sleep 3
    
    echo "✅ Cleanup complete"
}

# Function to start the server
start_server() {
    echo "🔧 Starting server on port $PORT..."
    
    # Start server in background and capture PID
    NODE_ENV=development npm run dev &
    local server_pid=$!
    
    # Store PID for future reference
    echo "$server_pid" > "$PID_FILE"
    
    echo "✅ Server started with PID: $server_pid"
    echo "🌍 Server should be available at: http://localhost:$PORT"
    
    # Wait for server to be ready (optional)
    sleep 3
    
    # Check if server is actually responding
    if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
        echo "✅ Server is responding and ready!"
    else
        echo "⚠️  Server may still be starting up..."
    fi
    
    # Keep the script running to maintain the server
    wait $server_pid
}

# Function to handle script termination
cleanup() {
    echo ""
    echo "🛑 Received termination signal, cleaning up..."
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "🔪 Stopping server (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if ps -p "$pid" > /dev/null 2>&1; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$PID_FILE"
    fi
    echo "✅ Cleanup complete, exiting..."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Main execution
echo "🔍 Checking for existing server processes..."

if is_server_running; then
    echo "⚠️  Server is already running!"
    echo "🔍 Use 'kill $(cat $PID_FILE)' to stop it, or run with --force to restart"
    
    if [ "$1" = "--force" ] || [ "$1" = "-f" ]; then
        echo "🔄 Force restart requested..."
        kill_existing_processes
        start_server
    else
        echo "💡 Server is already running. Use --force to restart."
        exit 1
    fi
else
    echo "🧹 Cleaning up any orphaned processes..."
    kill_existing_processes
    start_server
fi

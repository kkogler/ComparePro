#!/bin/bash

# Hybrid Mode Switcher
# Easily switch between development and production modes

MODE=${1:-status}

case $MODE in
  dev|development)
    echo "🔧 Switching to DEVELOPMENT mode..."
    echo "   - Hot reload enabled"
    echo "   - Source maps available"
    echo "   - Detailed logging"
    echo ""
    npm run kill
    sleep 1
    echo "Starting development server..."
    npm run dev
    ;;
    
  prod|production)
    echo "🚀 Switching to PRODUCTION mode..."
    echo "   - Optimized build"
    echo "   - Minified code"
    echo "   - Production settings"
    echo ""
    npm run kill
    sleep 1
    echo "Building for production..."
    npm run prod:test
    ;;
    
  test-prod|test)
    echo "🧪 Testing PRODUCTION build (temporary)..."
    echo "   This will build and run production mode"
    echo "   Press Ctrl+C when done testing"
    echo ""
    npm run prod:test
    ;;
    
  status)
    echo "📊 Current Process Status:"
    echo ""
    ps aux | grep -E "(tsx server/index|node.*dist/index)" | grep -v grep || echo "No server running"
    echo ""
    echo "Available commands:"
    echo "  ./switch-mode.sh dev        - Switch to development mode"
    echo "  ./switch-mode.sh prod       - Switch to production mode"
    echo "  ./switch-mode.sh test-prod  - Test production build temporarily"
    echo "  ./switch-mode.sh status     - Show current status"
    ;;
    
  *)
    echo "❌ Unknown mode: $MODE"
    echo ""
    echo "Usage: ./switch-mode.sh [dev|prod|test-prod|status]"
    exit 1
    ;;
esac


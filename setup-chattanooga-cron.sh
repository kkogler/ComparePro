#!/bin/bash

# Chattanooga Cron Job Setup
# Alternative to Replit Scheduled Deployments

echo "🔄 Setting up Chattanooga cron jobs..."

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 Script directory: $SCRIPT_DIR"

# Create cron job entries
echo "📝 Creating cron job entries..."

# Daily catalog sync at 2:15 PM Pacific (21:15 UTC in winter, 22:15 UTC in summer)
# Note: You may need to adjust the UTC time based on daylight saving time
echo "15 21 * * * cd $SCRIPT_DIR && tsx scripts/chattanooga-sync.ts >> /tmp/chattanooga-sync.log 2>&1" > /tmp/chattanooga-cron

echo "📋 Cron jobs created:"
cat /tmp/chattanooga-cron

echo ""
echo "🔧 To install these cron jobs:"
echo "1. Copy the contents above"
echo "2. Run: crontab -e"
echo "3. Paste the cron job entries"
echo "4. Save and exit"
echo ""
echo "📊 To monitor the syncs:"
echo "- Chattanooga sync logs: tail -f /tmp/chattanooga-sync.log"
echo ""
echo "🧪 To test manually:"
echo "- Chattanooga sync: tsx scripts/chattanooga-sync.ts"

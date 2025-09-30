#!/bin/bash

# Bill Hicks Cron Job Setup
# Alternative to Replit Scheduled Deployments

echo "🔄 Setting up Bill Hicks cron jobs..."

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 Script directory: $SCRIPT_DIR"

# Create cron job entries
echo "📝 Creating cron job entries..."

# Daily catalog sync at 9:15 AM Pacific (16:15 UTC in winter, 17:15 UTC in summer)
# Note: You may need to adjust the UTC time based on daylight saving time
echo "15 16 * * * cd $SCRIPT_DIR && tsx manual-bill-hicks-catalog-sync.ts >> /tmp/bill-hicks-catalog.log 2>&1" > /tmp/bill-hicks-cron

# Hourly inventory sync every hour
echo "0 * * * * cd $SCRIPT_DIR && tsx manual-bill-hicks-inventory-sync.ts >> /tmp/bill-hicks-inventory.log 2>&1" >> /tmp/bill-hicks-cron

echo "📋 Cron jobs created:"
cat /tmp/bill-hicks-cron

echo ""
echo "🔧 To install these cron jobs:"
echo "1. Copy the contents above"
echo "2. Run: crontab -e"
echo "3. Paste the cron job entries"
echo "4. Save and exit"
echo ""
echo "📊 To monitor the syncs:"
echo "- Catalog sync logs: tail -f /tmp/bill-hicks-catalog.log"
echo "- Inventory sync logs: tail -f /tmp/bill-hicks-inventory.log"
echo ""
echo "🧪 To test manually:"
echo "- Catalog sync: tsx manual-bill-hicks-catalog-sync.ts"
echo "- Inventory sync: tsx manual-bill-hicks-inventory-sync.ts"

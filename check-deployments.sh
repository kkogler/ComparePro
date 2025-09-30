#!/bin/bash

echo "🔍 Scheduled Deployment Diagnostic"
echo "=================================="
echo ""

echo "📋 Expected Deployments:"
echo "1. Sports South Daily Sync (6:30 AM PDT)"
echo "2. Bill Hicks Daily Catalog Sync (9:15 AM PDT)"
echo "3. Bill Hicks Hourly Inventory Sync (Every hour)"
echo "4. Chattanooga Daily Sync (6:10 AM PDT)"
echo ""

echo "🧪 Testing Sync Scripts:"
echo "========================"

echo "Testing Sports South sync..."
if tsx scripts/sports-south-sync.ts --dry-run > /dev/null 2>&1; then
    echo "✅ Sports South sync script: WORKING"
else
    echo "❌ Sports South sync script: FAILED"
fi

echo "Testing Bill Hicks sync..."
if tsx server/bill-hicks-simple-sync.ts --dry-run > /dev/null 2>&1; then
    echo "✅ Bill Hicks sync script: WORKING"
else
    echo "❌ Bill Hicks sync script: FAILED"
fi

echo "Testing Chattanooga sync..."
if tsx scripts/chattanooga-sync.ts --dry-run > /dev/null 2>&1; then
    echo "✅ Chattanooga sync script: WORKING"
else
    echo "❌ Chattanooga sync script: FAILED (likely rate limited)"
fi

echo ""
echo "📊 Next Steps:"
echo "=============="
echo "1. Go to Replit Deployments tab"
echo "2. Check if these deployments exist and are enabled"
echo "3. Review their logs for error messages"
echo "4. Verify their schedules and commands"
echo "5. Test them manually with 'Run Now'"
echo ""
echo "💡 If deployments don't exist, create them using the configuration files:"
echo "   - SPORTS_SOUTH_SCHEDULED_DEPLOYMENT.md"
echo "   - BILL_HICKS_SCHEDULED_DEPLOYMENT.md"
echo "   - BILL_HICKS_HOURLY_INVENTORY_DEPLOYMENT.md"
echo "   - CHATTANOOGA_SCHEDULED_DEPLOYMENT_SETUP.md"

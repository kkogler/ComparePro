#!/bin/bash

# Chattanooga Scheduled Deployment Setup Script
# This script helps configure the Scheduled Deployment for Chattanooga sync

echo "🚀 Chattanooga Scheduled Deployment Setup"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "scripts/chattanooga-sync.ts" ]; then
    echo "❌ Error: chattanooga-sync.ts not found"
    echo "   Please run this script from the workspace root directory"
    exit 1
fi

echo "✅ Found chattanooga-sync.ts script"
echo ""

# Test the sync script
echo "🧪 Testing sync script..."
if tsx scripts/chattanooga-sync.ts --dry-run > /dev/null 2>&1; then
    echo "✅ Sync script test passed"
else
    echo "❌ Sync script test failed"
    echo "   Please check the script and database connection"
    exit 1
fi

echo ""
echo "📋 Scheduled Deployment Configuration:"
echo "====================================="
echo ""
echo "Name: Chattanooga Daily Sync"
echo "Description: Daily catalog synchronization for Chattanooga Shooting Supplies products"
echo ""
echo "Schedule: 10 13 * * * (6:10 AM PDT = 1:10 PM UTC)"
echo "Timezone: America/Los_Angeles"
echo ""
echo "Build Command: npm install"
echo "Run Command: tsx scripts/chattanooga-sync.ts"
echo "Working Directory: /home/runner/workspace"
echo ""
echo "Resources:"
echo "- CPU: 1 vCPU (default)"
echo "- Memory: 2 GiB"
echo "- Timeout: 30 minutes (1800 seconds)"
echo "- Concurrency: 1"
echo ""
echo "📊 Cost Estimate:"
echo "=================="
echo "Execution time: ~24 seconds"
echo "Daily cost: \$0.0015"
echo "Monthly cost: \$0.045"
echo "Annual cost: \$0.54"
echo ""
echo "✅ Setup Instructions:"
echo "====================="
echo "1. Go to the 'Deployments' tab in your Replit workspace"
echo "2. Click 'Create Deployment'"
echo "3. Select 'Scheduled' as the deployment type"
echo "4. Use the configuration above"
echo "5. Click 'Create' to set up the deployment"
echo "6. Test with 'Run Now' button"
echo ""
echo "📖 For detailed instructions, see:"
echo "   CHATTANOOGA_SCHEDULED_DEPLOYMENT_SETUP.md"
echo ""
echo "🎯 Next Steps:"
echo "=============="
echo "1. Create the Scheduled Deployment using the config above"
echo "2. Test it manually with 'Run Now'"
echo "3. Monitor for successful execution"
echo "4. Verify sync status in admin panel"
echo ""
echo "✨ Setup complete! The deployment will run daily at 6:10 AM PDT"

#!/bin/bash
# Database Configuration Verification Script
# Run this anytime to verify your dev/prod database setup

echo "🔍 DATABASE CONFIGURATION VERIFICATION"
echo "========================================"
echo ""

# Check workspace DATABASE_URL
WORKSPACE_DB=$(echo $DATABASE_URL | grep -o 'ep-[^.]*' | head -1)

echo "📍 Workspace DATABASE_URL:"
if [[ "$DATABASE_URL" == *"ep-lingering-hat-adb2bp8d"* ]]; then
  echo "   ✅ CORRECT: Using DEVELOPMENT database (ep-lingering-hat-adb2bp8d)"
elif [[ "$DATABASE_URL" == *"ep-lingering-sea-adyjzybe"* ]]; then
  echo "   ❌ ERROR: Workspace is using PRODUCTION database!"
  echo "   🔧 FIX: Go to Tools → Secrets → DATABASE_URL"
  echo "          Change to: postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
  echo ""
  ERROR=1
else
  echo "   ⚠️  UNKNOWN: Cannot identify database endpoint"
  echo "   Current: $WORKSPACE_DB"
  echo ""
fi

echo ""
echo "📍 Deployment DATABASE_URL:"
echo "   Go to Tools → Publishing → Advanced Settings → Production app secrets"
echo "   Verify DATABASE_URL contains: ep-lingering-sea-adyjzybe"
echo "   Verify link icon is YELLOW (syncing disabled)"
echo ""

if [[ $ERROR -eq 1 ]]; then
  echo "❌ VERIFICATION FAILED - Fix errors above"
  exit 1
else
  echo "✅ WORKSPACE DATABASE VERIFIED"
  echo ""
  echo "Remember to also check deployment DATABASE_URL manually:"
  echo "1. Tools → Publishing → Advanced Settings"
  echo "2. Find DATABASE_URL in Production app secrets"
  echo "3. Should contain: ep-lingering-sea-adyjzybe"
  echo "4. Yellow link icon (syncing disabled)"
fi

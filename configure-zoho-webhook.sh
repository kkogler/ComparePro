#!/bin/bash

# Zoho Webhook Configuration Script
# This script helps set up the webhook secret for Zoho Billing integration

echo "🔧 Zoho Webhook Configuration Helper"
echo "===================================="
echo ""

# Check current environment
echo "📋 Current Zoho Environment Variables:"
env | grep -i zoho | while read line; do
  key=$(echo $line | cut -d'=' -f1)
  if [[ $key == *"SECRET"* ]] || [[ $key == *"TOKEN"* ]]; then
    echo "  $key=***HIDDEN***"
  else
    echo "  $line"
  fi
done

echo ""

# Check for webhook secret
WEBHOOK_SECRET=${ZOHO_WEBHOOK_SECRET:-${ZOHO_BILLING_WEBHOOK_SECRET:-""}}

if [ -z "$WEBHOOK_SECRET" ]; then
  echo "❌ WEBHOOK SECRET NOT CONFIGURED"
  echo ""
  echo "🔧 To fix the webhook signature issue:"
  echo ""
  echo "1. Find your webhook secret in Zoho Billing:"
  echo "   - Login to Zoho Billing"
  echo "   - Go to Settings > Automation > Webhooks"
  echo "   - Find your webhook pointing to /api/webhooks/zoho"
  echo "   - Copy the secret token"
  echo ""
  echo "2. Set the environment variable:"
  echo "   export ZOHO_WEBHOOK_SECRET=\"your-secret-here\""
  echo ""
  echo "3. Add to your .env file:"
  echo "   echo 'ZOHO_WEBHOOK_SECRET=your-secret-here' >> .env"
  echo ""
  echo "4. Restart the server:"
  echo "   ./restart-server.sh"
  echo ""
else
  echo "✅ WEBHOOK SECRET CONFIGURED"
  echo "   Source: ${ZOHO_WEBHOOK_SECRET:+ZOHO_WEBHOOK_SECRET}${ZOHO_BILLING_WEBHOOK_SECRET:+ZOHO_BILLING_WEBHOOK_SECRET}"
  echo "   Length: ${#WEBHOOK_SECRET} characters"
  echo ""
fi

# Test webhook endpoint
echo "🧪 Testing webhook endpoint..."
WEBHOOK_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/webhooks/zoho)

if [ "$WEBHOOK_TEST" = "200" ]; then
  echo "✅ Webhook endpoint is responding (HTTP 200)"
else
  echo "❌ Webhook endpoint issue (HTTP $WEBHOOK_TEST)"
  echo "   Make sure the server is running on port 5000"
fi

echo ""

# Provide testing command
echo "🔍 To test webhook configuration:"
echo "   curl -X POST http://localhost:5000/api/webhooks/zoho/test \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -H \"X-Zoho-Webhook-Signature: sha256=test\" \\"
echo "     -d '{\"test\": \"payload\"}'"

echo ""
echo "📚 For detailed troubleshooting, see:"
echo "   ZOHO_WEBHOOK_SECURITY_FIX.md"



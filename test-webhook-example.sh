#!/bin/bash

# Test Zoho Webhook in Development
# This simulates a new subscription being created

echo "🧪 Testing Zoho Webhook Subscription Flow..."
echo ""
echo "This will:"
echo "  1. Create a new company in your Development database"
echo "  2. Create an admin user with temporary password"
echo "  3. Create a default store"
echo "  4. Log the welcome email content (not actually send it)"
echo ""
echo "Watch your server console for detailed logs!"
echo ""

curl -X POST http://localhost:5000/api/test-zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.smith@testgunshop.com",
    "organizationName": "Smith Firearms & Accessories",
    "firstName": "John",
    "lastName": "Smith",
    "planCode": "standard-plan-v1"
  }' | jq '.'

echo ""
echo "✅ Test complete!"
echo ""
echo "Next steps:"
echo "  1. Check your server console for the email content"
echo "  2. Copy the login URL and credentials from the console"
echo "  3. Test logging in with those credentials"
echo ""










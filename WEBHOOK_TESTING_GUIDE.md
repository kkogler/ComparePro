# Webhook Testing Guide - Development Workflow

## Overview
This guide explains how to develop and test Zoho Billing webhook integrations safely without affecting production data.

## Development Workflow (Recommended)

### Phase 1: Local Development Testing

**1. Test Endpoint in Development**
```bash
# Development server running on localhost:5000
curl -X POST http://localhost:5000/api/test-zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_number": "SUB-TEST-001",
    "subscription_id": "test-sub-123",
    "planCode": "standard-plan-v1"
  }'
```

**Benefits:**
- ✅ Tests full subscription creation flow
- ✅ Tests company provisioning
- ✅ Tests user creation with temporary password
- ✅ Tests email generation (even if not sent)
- ✅ Uses development database
- ✅ No risk to production data

**Available Test Endpoint:**
- **URL:** `/api/test-zoho-webhook`
- **Method:** POST
- **Environment:** Development only (blocked in production)
- **Database:** Uses development database

---

### Phase 2: Email Service Testing

**Configure Email Service for Development:**

```typescript
// server/email-service.ts
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  // Log email instead of sending
  console.log('📧 EMAIL (DEV MODE - NOT SENT):', {
    to: email,
    subject: 'Welcome to Your New Account',
    username,
    password: tempPassword,
    loginUrl
  });
} else {
  // Send actual email in production
  await sendGridMail.send(emailData);
}
```

**Test Email Generation:**
```bash
# Development mode - emails logged only
NODE_ENV=development npm run dev

# Check logs for email content
# grep "EMAIL (DEV MODE" logs/development.log
```

---

### Phase 3: Webhook Signature Validation

**Test Signature Validation:**

```bash
# Test with valid signature
curl -X POST http://localhost:5000/api/webhooks/zoho \
  -H "Content-Type: application/json" \
  -H "X-Zoho-Webhook-Signature: <calculated-hmac>" \
  -d @test-webhook-payload.json

# Test without signature (URL secrecy mode)
curl -X POST http://localhost:5000/api/webhooks/zoho \
  -H "Content-Type: application/json" \
  -d @test-webhook-payload.json
```

**Generate Test Signature:**
```javascript
const crypto = require('crypto');
const secret = process.env.ZOHO_WEBHOOK_SECRET;
const payload = JSON.stringify(webhookData);
const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');
```

---

### Phase 4: Database Validation

**Check Created Records:**

```sql
-- Check newly created company
SELECT * FROM companies 
WHERE slug LIKE 'test-%' 
ORDER BY created_at DESC LIMIT 5;

-- Check admin user creation
SELECT u.id, u.username, u.email, u.status, c.name as company
FROM users u
JOIN companies c ON u.company_id = c.id
WHERE c.slug LIKE 'test-%'
ORDER BY u.created_at DESC;

-- Check default store
SELECT s.*, c.name as company
FROM stores s
JOIN companies c ON s.company_id = c.id
WHERE c.slug LIKE 'test-%';

-- Check subscription records
SELECT * FROM subscriptions
WHERE external_subscription_id LIKE 'test-%'
ORDER BY created_at DESC;
```

---

## Testing Strategy by Feature

### Feature 1: Company Provisioning

**Test Cases:**
1. ✅ New customer → New company created
2. ✅ Existing customer → Company updated
3. ✅ Missing customer data → Fallback handling
4. ✅ Duplicate prevention → Idempotency

**Test Script:**
```javascript
// scripts/test-company-provisioning.ts
import { billingService } from '../server/billing-service';

async function testCompanyProvisioning() {
  const testWebhook = {
    eventType: 'subscription_created',
    eventId: 'test-' + Date.now(),
    subscription: {
      subscription_id: 'SUB-TEST-001',
      customer_id: 'CUST-TEST-001',
      plan: { plan_code: 'standard-plan-v1' },
      customer: {
        display_name: 'Test Company Inc',
        email: 'test@example.com',
        company_name: 'Test Company'
      }
    },
    customer: {
      customer_id: 'CUST-TEST-001',
      display_name: 'Test Company Inc',
      email: 'test@example.com'
    },
    rawPayload: {}
  };
  
  await billingService.processZohoWebhook(testWebhook);
  console.log('✅ Company provisioning test complete');
}

testCompanyProvisioning().catch(console.error);
```

---

### Feature 2: User Creation with Temporary Password

**Test Cases:**
1. ✅ Admin user created with email as username
2. ✅ Temporary password generated securely
3. ✅ Default user created for operations
4. ✅ User-store mappings established

**Validation:**
```sql
-- Verify admin user
SELECT 
  u.username,
  u.email,
  u.role,
  u.is_admin,
  u.status,
  u.password IS NOT NULL as has_password
FROM users u
WHERE u.username = 'test@example.com';

-- Verify default store assignment
SELECT 
  u.username,
  u.default_store_id,
  s.name as default_store_name
FROM users u
LEFT JOIN stores s ON u.default_store_id = s.id
WHERE u.email = 'test@example.com';
```

---

### Feature 3: Welcome Email

**Test Cases:**
1. ✅ Email content generated correctly
2. ✅ Login URL formatted properly
3. ✅ Temporary password included
4. ✅ Organization name displayed

**Development Testing:**
```javascript
// Add to server/email-service.ts for dev mode
export async function sendInviteEmail(
  email: string,
  organizationName: string,
  username: string,
  tempPassword: string,
  loginUrl: string
): Promise<boolean> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    console.log('==================================================');
    console.log('📧 WELCOME EMAIL (DEVELOPMENT MODE - NOT SENT)');
    console.log('==================================================');
    console.log('To:', email);
    console.log('Subject: Welcome to', organizationName);
    console.log('');
    console.log('Login URL:', loginUrl);
    console.log('Username:', username);
    console.log('Temporary Password:', tempPassword);
    console.log('==================================================');
    
    // Save to file for review
    const fs = require('fs');
    fs.appendFileSync('dev-emails.log', 
      `\n${new Date().toISOString()} - ${email}\n` +
      `URL: ${loginUrl}\n` +
      `User: ${username}\n` +
      `Pass: ${tempPassword}\n` +
      `---\n`
    );
    
    return true; // Simulate success
  }
  
  // Production email sending logic...
  return await sendGridMail.send(emailData);
}
```

---

## Deployment to Production

### Step 1: Thorough Development Testing

**Pre-Deployment Checklist:**
- [ ] Test endpoint works in development
- [ ] Company provisioning tested with multiple scenarios
- [ ] User creation validated
- [ ] Email content reviewed in dev logs
- [ ] Database records verified
- [ ] Idempotency tested (duplicate webhooks)
- [ ] Error handling validated
- [ ] All edge cases covered

### Step 2: Deploy to Production

```bash
# Build production bundle
npm run build

# Deploy to Replit Production
git push replit main

# Or deploy via Replit UI
# - Push code changes
# - Deployment auto-triggers
```

### Step 3: Configure Production Environment

**Required Environment Variables:**
```bash
# Production Replit Secrets
DATABASE_URL=postgresql://neondb_owner:npg_3U8KcQGzhMLW@...
ZOHO_WEBHOOK_SECRET=GoMicroBiz01
SENDGRID_API_KEY=SG.xxxxx
NODE_ENV=production
BASE_URL=https://pricecomparehub.com
```

### Step 4: Zoho Billing Configuration

**Webhook Setup:**
1. Go to Zoho Billing → Settings → Automation → Webhooks
2. Add webhook URL: `https://pricecomparehub.com/api/webhooks/zoho`
3. Set Secret Token: `GoMicroBiz01`
4. Select Events:
   - ✅ subscription_created
   - ✅ subscription_cancelled
   - ✅ subscription_reactivated
   - ✅ invoice_paid
   - ✅ invoice_payment_failed

---

## Production Testing (Careful!)

### Option A: Test Subscription in Zoho (Creates Real Data)

**⚠️ WARNING: This creates real production data!**

1. Create test subscription in Zoho Billing
2. Use test email: `test+prod@yourdomain.com`
3. Monitor production logs for webhook processing
4. Verify welcome email received
5. Test login with temporary password
6. Clean up test data after validation

### Option B: Manual Subscription Sync

**Safer Option:**
```bash
# Sync existing subscription from Zoho to production
curl -X POST https://pricecomparehub.com/api/admin/zoho-billing/sync-subscription \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"subscriptionId": "SUB-EXISTING-001"}'
```

---

## Continuous Development Workflow

### Making Changes to Webhook Logic

**Step 1: Develop Locally**
```bash
# Start development server
npm run dev

# Terminal 2: Test webhook
curl -X POST http://localhost:5000/api/test-zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{"subscription_number": "SUB-NEW-TEST"}'
```

**Step 2: Validate in Dev Database**
```bash
# Check development database
npx tsx scripts/check-webhook-processing.ts
```

**Step 3: Code Review & Testing**
- Review all changes
- Test edge cases
- Verify error handling
- Check logs for issues

**Step 4: Deploy When Ready**
```bash
# Commit changes
git add .
git commit -m "feat: improve webhook processing"

# Push to production
git push replit main

# OR: Use Replit UI to deploy
```

---

## Best Practices

### ✅ Do This:
1. **Always test in development first**
2. **Use test endpoint** (`/api/test-zoho-webhook`)
3. **Log emails in development** (don't send)
4. **Use development database** for testing
5. **Validate database records** after tests
6. **Test error scenarios**
7. **Deploy only after thorough testing**

### ❌ Don't Do This:
1. ~~Test directly in production~~
2. ~~Create subscriptions just to test~~
3. ~~Skip development testing~~
4. ~~Deploy untested code~~
5. ~~Assume webhooks work without testing~~
6. ~~Ignore error logs~~

---

## Debugging Tips

### View Webhook Logs

**Development:**
```bash
# Watch logs in real-time
npm run dev | grep "WEBHOOK"
```

**Production:**
```bash
# View Replit logs
# Check Console tab in Replit
# Filter for "WEBHOOK" or "BillingService"
```

### Common Issues

**Issue: "Company not found"**
- **Cause:** Customer ID mismatch
- **Fix:** Verify customer_id in webhook payload

**Issue: "Email not sent"**
- **Cause:** SendGrid API key not configured
- **Fix:** Set `SENDGRID_API_KEY` environment variable

**Issue:** "Duplicate subscription"
- **Cause:** Webhook sent twice
- **Fix:** System handles this with idempotency check

---

## Summary

**Development Workflow:**
1. ✅ Code changes in development
2. ✅ Test with `/api/test-zoho-webhook` endpoint
3. ✅ Validate in development database
4. ✅ Review email logs (not sent in dev)
5. ✅ Deploy to production when ready
6. ✅ Monitor production logs

**Production Deployment:**
- No need to create test subscriptions
- Webhook works automatically when real subscriptions created
- Email sent to new subscribers
- Login credentials provided in email

**You only need to deploy to production ONCE after development testing is complete.**





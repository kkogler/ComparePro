# Development Testing Guide: Zoho Webhook & Welcome Email

## 🎯 How to Test Subscription Sign-Up in Development

You're right - Zoho webhooks only create subscriptions in Production. But there's a **test endpoint** that simulates the entire flow in Development!

---

## ✅ Test Endpoint: `/api/test-zoho-webhook`

### What It Does:
1. ✅ Simulates a Zoho `subscription_created` webhook
2. ✅ Creates company in your **Development** database
3. ✅ Creates admin user with temporary password
4. ✅ Creates default store
5. ✅ **Logs the welcome email** (doesn't send it, just shows what would be sent)

### How to Use:

#### Step 1: Make Sure You're Running Dev Environment

```bash
# From your workspace
npm run dev
```

**Verify development mode:**
- Server should start on `http://localhost:5000`
- Console should show `NODE_ENV: development`

#### Step 2: Send Test Request

Open a new terminal and run:

```bash
curl -X POST http://localhost:5000/api/test-zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcustomer@example.com",
    "organizationName": "Test Gun Shop",
    "firstName": "John",
    "lastName": "Doe",
    "planCode": "standard-plan-v1"
  }'
```

#### Step 3: Watch Server Console

You'll see detailed logs like:

```
TEST ZOHO WEBHOOK TRIGGERED
📧 EMAIL CONFIGURATION: No email providers configured!
📧 Email would be sent to:
{
  to: 'testcustomer@example.com',
  organization: 'Test Gun Shop',
  username: 'testcustomer@example.com',
  temporaryPassword: 'ABC123xyz456',
  loginUrl: 'http://localhost:5000/org/test-gun-shop/auth'
}
✅ Organization created: test-gun-shop
✅ Admin user created
✅ Default store created
```

#### Step 4: Test the Login

1. Go to the login URL from the console: `http://localhost:5000/org/test-gun-shop/auth`
2. Use the credentials from the console:
   - **Username:** `testcustomer@example.com`
   - **Password:** `ABC123xyz456` (from console)
3. You should be able to log in!

---

## 🧪 Different Test Scenarios

### Test Different Plans:

**Free Plan:**
```bash
curl -X POST http://localhost:5000/api/test-zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "freeuser@example.com",
    "organizationName": "Free Tier Shop",
    "planCode": "free-plan-v1"
  }'
```

**Standard Plan:**
```bash
curl -X POST http://localhost:5000/api/test-zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "standarduser@example.com",
    "organizationName": "Standard Shop",
    "planCode": "standard-plan-v1"
  }'
```

**Enterprise Plan:**
```bash
curl -X POST http://localhost:5000/api/test-zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "enterprise@example.com",
    "organizationName": "Enterprise Shop",
    "planCode": "enterprise-plan-v1"
  }'
```

### Test Missing Email (Edge Case):
```bash
curl -X POST http://localhost:5000/api/test-zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "No Email Shop",
    "planCode": "free-plan-v1"
  }'
```

---

## 📧 Understanding Email Behavior

### In Development (No SendGrid/SMTP2GO keys):
```typescript
// What happens in server/email-service.ts
if (!adminSettings?.sendgridApiKey && !adminSettings?.smtp2goApiKey) {
  console.log('📧 Email would be sent to:', {
    to: email,
    organization: organizationName,
    username: username,
    temporaryPassword: temporaryPassword,
    loginUrl: loginUrl
  });
  return false; // Email NOT sent, just logged
}
```

**Result:** You see the email content in console but no actual email is sent.

### In Production (With SendGrid/SMTP2GO keys):
```typescript
// Email service tries SendGrid/SMTP2GO
return await sendEmail(content, adminSettings);
```

**Result:** Real email is sent to the customer.

---

## 🔍 Verify Test Results

### Check Development Database:

**Via terminal:**
```bash
node -e "
const { Client } = require('pg');

const devDb = 'postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkTestResults() {
  const client = new Client({ connectionString: devDb });
  await client.connect();
  
  console.log('📊 Recent Test Companies:');
  const companies = await client.query(\`
    SELECT name, slug, status, created_at 
    FROM companies 
    WHERE id != -1
    ORDER BY created_at DESC 
    LIMIT 5
  \`);
  
  companies.rows.forEach(c => {
    console.log(\`   ✅ \${c.name} (\${c.slug})\`);
  });
  
  await client.end();
}

checkTestResults().catch(console.error);
"
```

### Check Admin Panel:

1. Log into admin: `http://localhost:5000/admin/auth`
2. Go to Companies section
3. You should see your test company listed

---

## 🧹 Clean Up Test Data

### Delete Test Companies:

```bash
node -e "
const { Client } = require('pg');

const devDb = 'postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function cleanupTestData() {
  const client = new Client({ connectionString: devDb });
  await client.connect();
  
  // Delete companies created in the last hour
  const result = await client.query(\`
    DELETE FROM companies 
    WHERE created_at > NOW() - INTERVAL '1 hour'
    AND name LIKE '%Test%'
    RETURNING name
  \`);
  
  console.log(\`🗑️  Deleted \${result.rows.length} test companies:\`);
  result.rows.forEach(r => console.log(\`   - \${r.name}\`));
  
  await client.end();
}

cleanupTestData().catch(console.error);
"
```

---

## 🚀 Complete Development Workflow

### 1. **Develop & Test in Dev:**

```bash
# Terminal 1: Run dev server
npm run dev

# Terminal 2: Test webhook
curl -X POST http://localhost:5000/api/test-zoho-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "organizationName": "Test Shop",
    "planCode": "free-plan-v1"
  }'

# Check console logs for:
# - Company creation
# - User creation
# - Email content (logged, not sent)

# Test login with credentials from console
# Visit: http://localhost:5000/org/test-shop/auth
```

### 2. **Iterate on Code:**

```bash
# Make changes to server/billing-service.ts or server/email-service.ts
# Server auto-reloads with nodemon
# Re-test immediately with curl command

# Clean up test data when done
node -e "/* cleanup script from above */"
```

### 3. **Deploy to Production:**

```bash
# When everything works in dev:
git add .
git commit -m "feat: improved webhook processing"
git push replit main

# Or use Replit UI to deploy
```

### 4. **Verify Production:**

**Option A: Use Zoho's Test Mode**
- Zoho Billing → Settings → Webhooks
- Click "Test Webhook" button
- Check production logs

**Option B: Create Real Test Subscription**
- Use test credit card in Zoho
- Use your personal email: `you+test@yourdomain.com`
- Verify welcome email received
- Clean up after testing

---

## 📊 Summary: Dev vs Prod

| Feature | Development | Production |
|---------|-------------|------------|
| **Test Endpoint** | ✅ `/api/test-zoho-webhook` available | ❌ Blocked (404) |
| **Database** | Development Neon DB | Production Neon DB |
| **Emails** | 📝 Logged to console | 📧 Sent via SendGrid/SMTP2GO |
| **Zoho Webhooks** | ❌ Don't reach dev | ✅ Reach production |
| **Testing Method** | Use test endpoint with curl | Real Zoho subscriptions |
| **Data Cleanup** | Easy - delete test data | Be careful - real customers |

---

## 💡 Pro Tips

1. **Keep Development Clean:**
   - Delete test companies regularly
   - Use descriptive names like "TEST-[feature]"
   - Don't let test data accumulate

2. **Test Edge Cases:**
   - Missing email address
   - Duplicate company names
   - Different plan types
   - Special characters in names

3. **Monitor Logs:**
   - Watch for `BillingService: Processing` messages
   - Check for email content logs
   - Verify user/company creation success

4. **Production Safety:**
   - Test thoroughly in dev first
   - Never test with real customer emails in dev
   - Use `you+test@domain.com` format for production testing

---

**Last Updated:** September 30, 2025  
**Version:** 1.0


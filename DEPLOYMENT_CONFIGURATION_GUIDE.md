# Deployment Configuration Guide

## Question 1: Do I Need to Make Changes?

### ✅ Email Service Already Configured Correctly

**Good News:** Your email service is already production-ready and doesn't need changes!

**Current Implementation:**
```typescript
// server/email-service.ts - sendInviteEmail()
if (!adminSettings?.sendgridApiKey && !adminSettings?.smtp2goApiKey) {
  console.error('❌ EMAIL CONFIGURATION: No email providers configured!');
  console.log('📧 Email would be sent to:', {
    to: to,
    organization: organizationName,
    username: username,
    temporaryPassword: temporaryPassword,
    loginUrl: loginUrl
  });
  return false; // Won't send, but logs the content
}
```

**What This Means:**
- ✅ In **Development** (no SendGrid/SMTP2GO keys): Emails are logged but not sent
- ✅ In **Production** (with SendGrid/SMTP2GO keys): Emails are sent to real users
- ✅ No code changes needed - it automatically adapts based on configuration

### 📋 Configuration Checklist

#### Development Environment (Already Done)
- ✅ No email API keys configured
- ✅ Emails logged to console
- ✅ Can test webhook flow without sending emails
- ✅ Development database used

#### Production Environment (Need to Configure)
**Required Replit Secrets:**

```bash
# Core Configuration
DATABASE_URL=postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
NODE_ENV=production
BASE_URL=https://pricecomparehub.com

# Webhook Configuration
ZOHO_WEBHOOK_SECRET=GoMicroBiz01

# Email Configuration (Choose ONE or BOTH)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# OR
SMTP2GO_API_KEY=api-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Security Keys
SESSION_SECRET=your-session-secret-here
CREDENTIAL_ENCRYPTION_KEY=your-64-char-hex-key-here
```

**To Add Replit Secrets:**
1. Go to your Replit Production deployment
2. Click **Tools** → **Secrets**
3. Add each environment variable
4. Redeploy (automatic when secrets change)

---

## Question 2: How to Push Dev to Production?

### 🚨 Important Considerations

**You asked about pushing 10x more product records from Dev to Production.**

**⚠️ Consider This First:**

#### Option A: Keep Separate Databases (Recommended)
**Pros:**
- ✅ Production stays clean with real customer data only
- ✅ Development can be messy with test data
- ✅ No risk of test data polluting production
- ✅ Each environment independent

**Cons:**
- ❌ Production starts with less data
- ❌ Need to sync specific data if needed

#### Option B: Copy Dev Database to Production
**Pros:**
- ✅ Production has all 83k product records immediately
- ✅ More realistic data for testing

**Cons:**
- ❌ Test companies/users will be in production
- ❌ May confuse real data with test data
- ❌ Need to clean up test data later

---

### 🔄 If You Want to Sync Specific Data

**Recommended: Sync Only Essential Data**

```bash
# Run this script to copy specific tables
node scripts/sync-production-data.js
```

**What to Sync:**
1. ✅ **Products** (83k records) - Safe to sync, universal catalog
2. ✅ **Retail Verticals** - Reference data
3. ✅ **Supported Vendors** - Configuration data
4. ❌ **Companies** - DON'T sync (test data)
5. ❌ **Users** - DON'T sync (test accounts)
6. ❌ **Orders** - DON'T sync (test orders)

### 📋 Selective Data Sync Strategy

**Step 1: Identify What to Sync**
```sql
-- Development database analysis
SELECT 
  'products' as table_name, COUNT(*) as count FROM products
UNION ALL
SELECT 'supported_vendors', COUNT(*) FROM supported_vendors
UNION ALL
SELECT 'retail_verticals', COUNT(*) FROM retail_verticals
UNION ALL
SELECT 'companies', COUNT(*) FROM companies
UNION ALL
SELECT 'users', COUNT(*) FROM users;
```

**Step 2: Create Sync Script**
```javascript
// scripts/sync-production-data.js
const { Client } = require('pg');

const devDb = 'postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const prodDb = 'postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function syncProducts() {
  const devClient = new Client({ connectionString: devDb });
  const prodClient = new Client({ connectionString: prodDb });
  
  await devClient.connect();
  await prodClient.connect();
  
  console.log('🔄 Starting product sync...');
  
  // Get products from dev that don't exist in prod
  const devProducts = await devClient.query(`
    SELECT * FROM products 
    WHERE status = 'active' 
    ORDER BY created_at
  `);
  
  console.log(`📊 Found ${devProducts.rows.length} products in development`);
  
  let synced = 0;
  let skipped = 0;
  
  for (const product of devProducts.rows) {
    try {
      // Check if product already exists in production
      const existing = await prodClient.query(
        'SELECT id FROM products WHERE upc = $1',
        [product.upc]
      );
      
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }
      
      // Insert product into production
      await prodClient.query(`
        INSERT INTO products (
          upc, name, brand, model, manufacturer_part_number,
          alt_id_1, alt_id_2, caliber, category, subcategory1,
          subcategory2, subcategory3, description, barrel_length,
          image_url, image_source, source, serialized, specifications,
          status, retail_vertical_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
      `, [
        product.upc, product.name, product.brand, product.model,
        product.manufacturer_part_number, product.alt_id_1, product.alt_id_2,
        product.caliber, product.category, product.subcategory1,
        product.subcategory2, product.subcategory3, product.description,
        product.barrel_length, product.image_url, product.image_source,
        product.source, product.serialized, JSON.stringify(product.specifications),
        product.status, product.retail_vertical_id
      ]);
      
      synced++;
      
      if (synced % 1000 === 0) {
        console.log(`✅ Synced ${synced} products...`);
      }
    } catch (error) {
      console.error(`❌ Error syncing product ${product.upc}:`, error.message);
    }
  }
  
  await devClient.end();
  await prodClient.end();
  
  console.log(`\n✅ Sync complete!`);
  console.log(`   Synced: ${synced} products`);
  console.log(`   Skipped: ${skipped} (already exist)`);
}

syncProducts().catch(console.error);
```

**Step 3: Run Sync**
```bash
# From your workspace
node scripts/sync-production-data.js
```

---

## 🚀 Complete Production Deployment Workflow

### Step 1: Configure Production Environment

**Add Replit Secrets:**
```bash
# Required for webhook processing
ZOHO_WEBHOOK_SECRET=GoMicroBiz01

# Required for email sending
SENDGRID_API_KEY=SG.your-key-here
# OR
SMTP2GO_API_KEY=api-your-key-here

# Core configuration
NODE_ENV=production
DATABASE_URL=<production-db-url>
BASE_URL=https://pricecomparehub.com
SESSION_SECRET=<secure-random-string>
CREDENTIAL_ENCRYPTION_KEY=<64-char-hex>
```

### Step 2: Deploy Code to Production

**Option A: Git Push (if configured)**
```bash
git add .
git commit -m "feat: production-ready webhook and email system"
git push replit main
```

**Option B: Replit UI**
1. Commit changes in Replit
2. Go to Deployments tab
3. Click "Deploy" button
4. Wait for build and deployment

### Step 3: Configure Zoho Billing

**Webhook Settings:**
1. Go to Zoho Billing → Settings → Automation → Webhooks
2. **URL:** `https://pricecomparehub.com/api/webhooks/zoho`
3. **Secret Token:** `GoMicroBiz01`
4. **Events:** Select all relevant events
   - subscription_created
   - subscription_cancelled
   - subscription_reactivated
   - invoice_paid
   - invoice_payment_failed

### Step 4: Verify Production Setup

**Test Webhook Endpoint:**
```bash
# Check that webhook secret is configured
curl https://pricecomparehub.com/api/webhooks/zoho/test
```

**Expected Response:**
```json
{
  "success": true,
  "debug": {
    "hasSecret": true,
    "secretSource": "ZOHO_WEBHOOK_SECRET"
  }
}
```

**Test Email Configuration:**
```bash
# Via Replit shell or SSH
node -e "
const { storage } = require('./server/storage');
storage.getAdminSettings().then(settings => {
  console.log('SendGrid configured:', !!settings.sendgridApiKey);
  console.log('SMTP2GO configured:', !!settings.smtp2goApiKey);
});
"
```

### Step 5: Test with Real Subscription (Optional)

**Create Test Subscription in Zoho:**
1. Use test credit card
2. Use your own email: `you+test@yourdomain.com`
3. Monitor production logs for webhook processing
4. Verify welcome email received
5. Test login with temporary password
6. Delete test subscription and data when done

---

## 🎯 Summary

### Configuration Needed:

**✅ No Code Changes Required**
- Email service already handles dev/prod environments
- Webhook processing already production-ready

**📝 Only Need to Configure:**
1. Add Replit Secrets (environment variables)
2. Configure Zoho Billing webhook URL
3. Optionally sync product data if needed

### Deployment Approach:

**Recommended:**
1. Keep separate databases (dev has test data, prod has real data)
2. Sync only universal data (products, vendors, verticals)
3. Let production build its own company/user data from real subscriptions
4. Deploy code once after testing in development

**Alternative:**
- Copy entire dev database to production
- Clean up test data afterward
- More work and risk of confusion

---

## 📚 Quick Reference

### Development Environment
- **Database:** Development Neon database
- **Emails:** Logged to console, not sent
- **Test Endpoint:** `/api/test-zoho-webhook` available
- **NODE_ENV:** `development`

### Production Environment  
- **Database:** Production Neon database
- **Emails:** Sent via SendGrid/SMTP2GO
- **Test Endpoint:** Blocked (404)
- **NODE_ENV:** `production`

### When Real Subscription Created in Zoho:
1. Zoho sends webhook to production
2. System creates company
3. System creates admin user with temp password
4. System sends welcome email
5. Customer receives email and can log in
6. No manual intervention needed!

---

**Last Updated:** September 30, 2025  
**Version:** 1.0


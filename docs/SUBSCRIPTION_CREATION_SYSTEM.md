# Subscription Creation & Onboarding System

## 🎯 Overview

This document describes the enhanced subscription creation system that enables both manual test subscription creation in Development and automated production subscriptions via Zoho Billing webhooks.

## ✅ What Was Built

### 1. Enhanced Provisioning Service (`server/billing-service.ts`)

**Key Features:**
- ✅ **Full Address Support**: Accepts and stores complete address information (address1, address2, city, state, zip, country)
- ✅ **Timezone Support**: Sets company and store timezone from customer data
- ✅ **Retail Vertical Support**: Associates company with retail vertical (e.g., Firearms)
- ✅ **Auto-Vendor Enablement**: Automatically enables ALL active supported vendors for new companies
- ✅ **Duplicate Slug Handling**: Auto-appends numbers to duplicate company names (e.g., `demo-gun-store-2`)
- ✅ **Welcome Email**: Sends email with username, temporary password, and login URL
- ✅ **Complete Onboarding**: Creates company → store → admin user → vendor enablement → email in one transaction

### 2. API Endpoint (`server/routes.ts`)

**Endpoint:** `POST /api/admin/subscriptions/create`

**Required Fields:**
- `companyName` - Company/store name
- `firstName` - Admin user first name
- `lastName` - Admin user last name
- `email` - Admin user email (receives welcome email)
- `plan` - Subscription plan (free, standard, enterprise)

**Optional Fields:**
- `phone` - Contact phone
- `address1`, `address2`, `city`, `state`, `zipCode`, `country` - Store address
- `timezone` - Store timezone (default: America/New_York)
- `retailVerticalId` - Retail vertical (default: Firearms if ID 1)
- `customerAccountNumber` - Custom account number (auto-generated if not provided)

**Response:**
```json
{
  "success": true,
  "message": "Subscription created successfully for {companyName}",
  "company": {
    "id": 123,
    "name": "Demo Gun Store",
    "slug": "demo-gun-store",
    "plan": "standard",
    "loginUrl": "https://pricecomparehub.com/org/demo-gun-store/auth"
  }
}
```

### 3. Admin UI (`client/src/components/CreateSubscriptionDialog.tsx`)

**Location:** Admin > Subscriptions page → "Create Subscription" button

**Form Fields:**
- Plan selection (dropdown from Plan Settings)
- Company name (required)
- Retail vertical (dropdown)
- Timezone (dropdown)
- Admin user info: First name, Last name, Email (all required)
- Phone (optional)
- Full address fields (all optional)
- Customer account number (optional)

**Features:**
- ✅ Real-time validation
- ✅ Success notification with login URL
- ✅ Confirms welcome email was sent
- ✅ Auto-refreshes subscription list

### 4. What Gets Created Automatically

When a subscription is created (manually or via Zoho):

1. **Company Record**
   - Name, slug (unique), plan, status
   - Timezone, retail vertical
   - Plan limits (users, vendors, orders)
   - Features based on plan

2. **Subscription Record**
   - External IDs, plan, status
   - Billing period dates
   - Amount, currency

3. **Default Store**
   - Name matches company
   - Store #01
   - Full address if provided
   - Timezone

4. **Admin User**
   - Username = email
   - Temporary password (12 characters, auto-generated)
   - Role: admin
   - Assigned to default store

5. **Default User**
   - Username: "default"
   - Role: user (for system operations)

6. **Vendor Enablement**
   - ALL active supported vendors enabled
   - Ready for price comparison
   - No manual setup required

7. **Default Pricing Rule**
   - Strategy: MSRP
   - Fallback: Cost + 50% markup
   - Enabled by default

8. **Welcome Email** (via SMTP2GO)
   - Company/store name
   - Login URL
   - Username (email)
   - Temporary password
   - Instructions to change password

## 🔄 Usage Scenarios

### Development: Manual Test Subscriptions

1. Admin logs into dev environment
2. Goes to Admin > Subscriptions
3. Clicks "Create Subscription"
4. Fills out form
5. System creates everything
6. Welcome email sent (or logged if SMTP2GO not configured)
7. Test user can log in immediately

### Production: Zoho Billing Webhooks

1. Customer signs up in Zoho Billing
2. Zoho sends webhook to production
3. System extracts customer data
4. Calls same provisioning logic
5. Welcome email sent via SMTP2GO
6. Customer receives email and can log in

## 🔒 Duplicate Handling

If a company name/slug already exists:
- System auto-appends `-2`, `-3`, etc.
- Example: `demo-gun-store` → `demo-gun-store-2`
- Ensures unique URLs
- No manual intervention needed

## 🛡️ Webhook Deduplication & Email Protection

### Problem
Zoho Billing sends multiple webhook events for a single subscription creation:
- `customer_created`
- `subscription_created`
- `subscription_activation`
- `subscription_activated`

This could result in multiple welcome emails with different temporary passwords sent to the same customer.

### Solution (Implemented October 4, 2025)

**Two-Layer Deduplication:**

1. **Event-Level Deduplication**
   - Checks if a specific event ID was already processed
   - Prevents processing the exact same webhook twice
   - Uses `billing_events` table with `processed` flag

2. **Subscription-Level Deduplication** ⭐ NEW
   - Checks if a subscription ID was already processed (regardless of event type)
   - Prevents duplicate provisioning when Zoho sends multiple event types
   - Looks back 10 minutes for recent processing
   - Compares subscription IDs across events

3. **Email-Level Deduplication** ⭐ NEW
   - Checks if welcome email was sent within last 10 minutes
   - Prevents multiple emails with different passwords
   - Tracks email sends in `billing_events` with type `welcome_email_sent`
   - Only sends one email per company per 10-minute window

**Implementation Details:**

```typescript
// In processZohoWebhook():
if (subscriptionData && isSubscriptionEvent) {
  const alreadyProcessed = await wasSubscriptionAlreadyProcessed(subscriptionId);
  if (alreadyProcessed) {
    return; // Skip duplicate
  }
}

// In provisionCompanyOnboarding():
const emailSentRecently = await wasWelcomeEmailSentRecently(companyId);
if (emailSentRecently) {
  console.log('Email already sent, skipping');
  return;
}
```

**Benefits:**
- ✅ Customers receive exactly ONE welcome email
- ✅ No confusion from multiple temporary passwords
- ✅ System remains idempotent (safe to retry)
- ✅ Works even if Zoho sends 10+ webhooks
- ✅ 10-minute window allows legitimate re-sends if needed

**Edge Cases Handled:**
- Multiple webhooks arriving simultaneously → Only first processes
- Network retries from Zoho → Safely ignored
- Manual re-provisioning after 10 minutes → Allowed
- Different subscriptions for same customer → Each gets one email

## 📧 Welcome Email Content

```
Subject: Your PriceCompare Pro Account - {Company Name}

Welcome to PriceCompare Pro!

We've created your PriceCompare Pro account for {Company Name}.

Login Details:
Username: user@email.com
Temporary password: ABC123xyz789

[Log In Now Button]

For your security, please log in and change your password immediately.

Can't click the button? Copy and paste this link:
https://pricecomparehub.com/org/company-slug/auth
```

## 🧪 Testing

### Dev Environment Testing:

```bash
# 1. Start dev server
npm run dev

# 2. Log in as admin
https://localhost:5000/admin/auth

# 3. Go to Subscriptions
https://localhost:5000/admin/subscriptions

# 4. Click "Create Subscription"

# 5. Fill out form:
- Company: Test Gun Shop
- Plan: Free
- First Name: John
- Last Name: Doe  
- Email: test@example.com
- (Optional fields as desired)

# 6. Click "Create Subscription"

# 7. Check success message for login URL

# 8. Log out and log in with new credentials:
URL: https://localhost:5000/org/test-gun-shop/auth
Username: test@example.com
Password: (from welcome email or server logs)

# 9. Verify:
- ✓ Can log in
- ✓ Store exists in Settings > Stores
- ✓ User exists in Settings > Users
- ✓ All vendors enabled in Supported Vendors
- ✓ Default pricing rule exists in Settings > Pricing Rules
```

### Production Testing:

**Option 1: Use the Manual Creation UI**
- Same as dev testing above
- Emails will be sent via SMTP2GO
- Customer receives actual email

**Option 2: Test Zoho Webhook**
- Create test subscription in Zoho Billing
- Webhook automatically creates subscription
- Customer receives welcome email
- Clean up test subscription after validation

## 📊 What's Different from Before

### Before:
- ❌ No manual creation in Dev
- ❌ Address fields not captured
- ❌ Vendors NOT auto-enabled
- ❌ Had to manually enable each vendor
- ❌ Duplicate names caused errors
- ❌ Limited customer data in provisioning

### After:
- ✅ Manual creation via UI
- ✅ Full address captured and stored
- ✅ ALL vendors auto-enabled
- ✅ Zero manual setup required
- ✅ Duplicate names handled automatically
- ✅ Complete customer data flow

## 🚀 Deployment Notes

1. **No database migrations needed** - All existing fields
2. **Backward compatible** - Existing subscriptions unaffected
3. **Environment agnostic** - Works in Dev and Production
4. **SMTP2GO required** - For welcome emails in production

## 📝 Future Enhancements

Potential improvements:
- [ ] Custom email templates
- [ ] Multiple admin users on creation
- [ ] Bulk subscription import
- [ ] Subscription templates/presets
- [ ] Welcome email preview
- [ ] Test email sending before creation

## 🔗 Related Files

**Backend:**
- `server/billing-service.ts` - Main provisioning logic
- `server/routes.ts` - API endpoint
- `server/email-service.ts` - Welcome email

**Frontend:**
- `client/src/components/CreateSubscriptionDialog.tsx` - Form UI
- `client/src/pages/AdminDashboard.tsx` - Integration

**Schema:**
- `shared/schema.ts` - Database schema (no changes needed)

## ✅ Success Criteria Met

- [x] Create test subscriptions in Dev via UI
- [x] Production subscriptions work via Zoho
- [x] Users receive welcome email with credentials
- [x] Users can log in immediately
- [x] All vendors enabled automatically
- [x] Duplicate names handled
- [x] Full address captured
- [x] Timezone support
- [x] Retail vertical support
- [x] Complete onboarding automation

---

**Last Updated:** October 4, 2025
**Version:** 1.1
**Status:** ✅ Complete & Production Ready

**Recent Changes:**
- Added webhook deduplication to prevent duplicate emails (Oct 4, 2025)




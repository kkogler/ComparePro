# Zoho Webhook Integration - Environment Variables Only

## Overview

The Zoho webhook integration has been simplified to use **environment variables only** for secret management. This follows industry best practices and eliminates the complexity and potential corruption issues of database-stored secrets.

## Configuration

### Environment Variables

Set the webhook secret in your hosting environment:

```bash
ZOHO_WEBHOOK_SECRET=GoMicroBiz01
```

**Alternative name** (for backward compatibility):
```bash
ZOHO_BILLING_WEBHOOK_SECRET=GoMicroBiz01
```

### Zoho Billing Setup

1. **Go to Zoho Billing** → Settings → Automation → Webhooks
2. **Create/Edit webhook** pointing to: `https://pricecomparehub.com/api/webhooks/zoho`
3. **Set Secret Token** to: `GoMicroBiz01` (must match environment variable)
4. **Select events**: subscription_created, subscription_cancelled, etc.

## How It Works

### Authentication Methods

The webhook endpoint supports both:

1. **HMAC Signature Verification** (when signature provided)
   - Zoho sends `X-Zoho-Webhook-Signature` header
   - System verifies using `ZOHO_WEBHOOK_SECRET`

2. **URL Secrecy** (when no signature provided)
   - Relies on the webhook URL being secret
   - Common fallback for Zoho webhooks

### Code Flow

```typescript
// Get webhook secret from environment variables only
const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET || process.env.ZOHO_BILLING_WEBHOOK_SECRET;

// Check if signature is provided and valid
if (normalizedSignature) {
  // Verify HMAC signature
  const isValidSignature = verifyZohoWebhookSignature(rawBody, normalizedSignature, webhookSecret);
  if (!isValidSignature) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
} else {
  // No signature provided - allow based on URL secrecy
  console.log('✅ WEBHOOK SECURITY: No signature provided - allowing based on URL secrecy');
}
```

## Benefits

### ✅ Advantages
- **Simpler Architecture**: No database complexity
- **Standard Practice**: Follows 12-factor app methodology
- **Better Security**: Environment variables are encrypted and access-controlled
- **No Corruption Risk**: Can't have database corruption issues
- **Easier Maintenance**: Single source of truth
- **Platform Agnostic**: Works with any hosting provider

### ❌ Previous Issues Resolved
- No more corrupted database values (like `GoMicrdi201`)
- No complex fallback logic
- No database/environment variable sync issues
- No admin interface complexity

## Testing

### Test Endpoint
```bash
curl -X POST http://localhost:5000/api/webhooks/zoho/test \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "debug": {
    "hasSecret": true,
    "secretSource": "ZOHO_WEBHOOK_SECRET",
    "hasSignature": false,
    "signatureHeader": "none"
  }
}
```

### Live Webhook Test
```bash
curl -X POST https://pricecomparehub.com/api/webhooks/zoho \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "subscription_created",
    "event_id": "test_123",
    "data": {
      "subscription": {
        "subscription_id": "SUB-TEST",
        "customer_id": "test_customer",
        "status": "live"
      }
    }
  }'
```

## Deployment

### Environment Variable Setup

**Replit:**
1. Go to Secrets tab
2. Add `ZOHO_WEBHOOK_SECRET` = `GoMicroBiz01`

**Other Hosting Providers:**
- **Vercel**: Environment Variables in dashboard
- **Netlify**: Site Settings → Environment Variables
- **Heroku**: Config Vars in dashboard
- **Railway**: Environment Variables in project settings

### Verification

After deployment, verify the webhook is working:

1. **Check test endpoint**: Should show `"secretSource": "ZOHO_WEBHOOK_SECRET"`
2. **Trigger test webhook** from Zoho Billing
3. **Monitor logs** for successful processing

## Troubleshooting

### Common Issues

**"No webhook secret configured"**
- Ensure `ZOHO_WEBHOOK_SECRET` environment variable is set
- Restart application after setting environment variables

**"Invalid webhook signature"**
- Verify secret in Zoho Billing matches environment variable exactly
- Check for extra spaces or characters

**Webhook not receiving events**
- Verify webhook URL in Zoho Billing: `https://pricecomparehub.com/api/webhooks/zoho`
- Check webhook is enabled and events are selected

## Migration Notes

### Breaking Changes
- Removed `zohoWebhookSecret` from database schema
- Removed webhook secret field from Admin Settings
- Environment variables are now the only source of webhook secrets

### No Action Required
- Existing `ZOHO_WEBHOOK_SECRET` environment variable continues to work
- No changes needed to Zoho Billing webhook configuration
- Webhook functionality remains the same

---

**Last Updated:** September 30, 2025  
**Version:** 2.0 (Environment Variables Only)

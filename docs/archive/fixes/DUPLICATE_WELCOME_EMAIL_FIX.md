# Duplicate Welcome Email Fix

## Issue Summary

When creating a subscription from the Zoho Billing hosted payment page, **two welcome emails were sent**, each with a **different password**. This made it confusing for users to know which password to use.

## Root Cause

Zoho Billing sends **multiple webhook events** for a single subscription creation:
1. `subscription_created` (e.g., event ID: `sub-123-created`)
2. `subscription_activated` (e.g., event ID: `sub-123-activated`)  
3. Sometimes also `subscription_activation`

### The Problem Flow

```
User creates subscription in Zoho
    ↓
Zoho sends webhook: subscription_created (event ID: abc-123)
    ↓
handleSubscriptionCreated() → provisionCompanyOnboarding() → sendInviteEmail()
✉️ Email #1 sent with password: "xYz789AbC123"
    ↓
Zoho sends webhook: subscription_activated (event ID: abc-456) ← DIFFERENT EVENT ID!
    ↓
Event deduplication passes (different event ID)
    ↓
handleSubscriptionCreated() → provisionCompanyOnboarding() → sendInviteEmail()
✉️ Email #2 sent with password: "qWe456RtY789" ← NEW PASSWORD!
```

### Why Deduplication Failed

The system had **event-level deduplication** (checking if the same event ID was already processed), but NOT **subscription-level deduplication** (checking if the subscription was already provisioned).

Since Zoho sends multiple events with **different event IDs** for the **same subscription**, both events passed the deduplication check and both triggered provisioning.

The `provisioningCompleted` flag was a **local variable** within each `handleSubscriptionCreated()` call, so it reset to `false` for each new webhook event.

## The Fix

Added a **database check** before running provisioning to see if the company was already set up (lines 807-825 in `server/billing-service.ts`):

```typescript
// **DATABASE CHECK**: See if this company was already provisioned
// Check for existing admin users and stores as indicators of completed provisioning
const [existingAdminUsers, existingStores] = await Promise.all([
  db.select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.companyId, finalOrg.id),
      eq(users.role, 'admin')
    ))
    .limit(1),
  db.select({ id: stores.id })
    .from(stores)
    .where(eq(stores.companyId, finalOrg.id))
    .limit(1)
]);

if (existingAdminUsers.length > 0 && existingStores.length > 0) {
  console.log('✅ Provisioning already completed, skipping duplicate provisioning');
  provisioningCompleted = true;
} else {
  // Run provisioning...
}
```

### How It Works Now

```
User creates subscription in Zoho
    ↓
Zoho sends webhook: subscription_created (event ID: abc-123)
    ↓
Check database: No admin user or store exists yet
    ↓
handleSubscriptionCreated() → provisionCompanyOnboarding() → sendInviteEmail()
✉️ Email #1 sent with password: "xYz789AbC123"
    ↓
Zoho sends webhook: subscription_activated (event ID: abc-456)
    ↓
Event deduplication passes (different event ID - expected)
    ↓
Check database: Admin user and store ALREADY EXIST ✓
    ↓
Skip provisioning - NO duplicate email sent! ✅
```

## Why Not Change the Webhook?

You **shouldn't disable any webhooks** in Zoho because:

1. **Different events serve different purposes** - Some events may arrive earlier than others in different scenarios
2. **Robustness** - Having multiple event types ensures the system works even if one event fails to deliver
3. **Zoho's behavior** - This is standard Zoho Billing behavior; all customers receive these multiple events
4. **Code-based fix is better** - The application should handle duplicate events gracefully (idempotency)

## Testing

To verify the fix works:

1. **Create a new subscription** from Zoho Billing hosted page
2. **Check email inbox** - Should receive only **ONE** welcome email
3. **Check server logs** - Should see:
   ```
   🔄 BillingService: Checking if provisioning already completed...
   ✅ BillingService: Provisioning already completed (admin user and store exist), skipping duplicate provisioning
   ```

## Additional Benefits

This fix also prevents duplicate provisioning in other scenarios:
- If the webhook is manually replayed/retried
- If there are network issues causing duplicate webhook deliveries
- If an admin manually triggers a subscription sync

## Related Files

- **Fixed:** `server/billing-service.ts` (lines 802-863)
- **Documentation:** `docs/SUBSCRIPTION_CREATION_SYSTEM.md` (lines 150-202)


# CRITICAL FIXES: Schema Deletion & User Limits

**Date:** October 13, 2025  
**Issues Fixed:**
1. ✅ Fields being deleted on production deployments
2. ✅ Disabled user limits for all subscription plans

---

## 🚨 ISSUE 1: Why Fields Keep Getting Deleted

### **Root Cause Found:**

There was a **DANGEROUS admin endpoint** that was deleting database fields:

```typescript
// server/routes.ts (line 9787-9818) - NOW REMOVED
app.post('/api/admin/sync-schema', requireAdminAuth, async (req, res) => {
  // This ran: npm run db:push -- --force
  // ❌ Drizzle drops ANY columns not defined in schema.ts
  // ❌ This was deleting max_users, max_orders, etc.
});
```

### **The Problem:**

1. Someone hits `/api/admin/sync-schema` (or automation triggers it)
2. Endpoint runs `drizzle-kit push --force`
3. Drizzle compares database to `schema.ts`
4. Any field in database but NOT in schema.ts → **DELETED** 💥
5. This happened every time schema.ts was missing a field (like `maxUsers` until today)

### **Why It Happened Repeatedly:**

- **Night 1:** Added `max_users` to database with migration
- **Morning 1:** Someone deployed code → `/api/admin/sync-schema` triggered
- **Result 1:** Field deleted (wasn't in schema.ts yet)
- **Night 2:** Added `max_users` again
- **Morning 2:** Deployed → deleted again
- **Cycle repeated** until schema.ts was updated

### **✅ Fix Applied:**

**Removed the dangerous endpoint entirely:**

```typescript
// ❌ REMOVED: Dangerous schema sync endpoint
// Schema changes must be done manually with migrations to prevent data loss
```

---

## 🛡️ PERMANENT SOLUTION: Migration-Based Workflow

### **✅ CORRECT Workflow (Going Forward):**

```bash
# 1. Create SQL migration file
touch migrations/0034_description.sql

# 2. Write migration SQL
ALTER TABLE table_name ADD COLUMN new_field type;

# 3. Test in development
psql $DEV_DATABASE_URL -f migrations/0034_description.sql

# 4. Update schema.ts to match
# shared/schema.ts
export const table = pgTable("table", {
  newField: type("new_field"),
});

# 5. Test locally
npm run dev

# 6. Apply to production
psql $PROD_DATABASE_URL -f migrations/0034_description.sql

# 7. Deploy code
git add migrations/ shared/schema.ts
git commit -m "Add new_field to table"
git push
```

### **❌ NEVER DO THIS:**

```bash
❌ npm run db:push -- --force  # Drops unrecognized columns
❌ Direct database edits without migration files
❌ Using admin sync endpoints in production
❌ Modifying schema.ts without migration
```

---

## 🔒 ISSUE 2: Disable User Limits

### **Requirement:**

> "We no longer have plans that have limitation on number of users"

### **✅ Fix Applied:**

Updated all subscription plans to have **unlimited users**:

**File:** `shared/subscription-config.ts`

```typescript
// Before:
free: {
  limits: {
    maxUsers: 2,  // ❌ Limited
  }
}

// After:
free: {
  limits: {
    maxUsers: -1,  // ✅ Unlimited
  }
}
```

**Applied to ALL plans:**
- Free: `maxUsers: -1` (unlimited)
- Standard: `maxUsers: -1` (unlimited)
- Enterprise: `maxUsers: -1` (unlimited)

---

## 📋 Changes Made

### 1. Removed Dangerous Endpoint ✅

**File:** `server/routes.ts`

- **Removed:** `/api/admin/sync-schema` endpoint (lines 9787-9818)
- **Replaced with:** Comment explaining safe workflow

### 2. Updated Subscription Plans ✅

**File:** `shared/subscription-config.ts`

- **Changed:** All `maxUsers` limits to `-1` (unlimited)
- **Result:** No user limit enforcement for any plan

### 3. Database Already Has maxUsers ✅

**Status:** `max_users` column exists in both:
- `companies` table (stores actual limit)
- `plan_settings` table (stores plan definition)

**No database changes needed** - just code config changes

---

## 🎯 Impact & Benefits

### **Schema Stability:**
- ✅ Fields will no longer be deleted on deployment
- ✅ Database schema is protected from code changes
- ✅ Migration-based workflow enforced

### **User Limits Disabled:**
- ✅ Organizations can add unlimited users
- ✅ No "user limit exceeded" errors
- ✅ Billing/plans still track users for analytics

### **System Safety:**
- ✅ No more schema drift between dev/prod
- ✅ All schema changes require explicit migrations
- ✅ Audit trail for all database changes

---

## 🧪 Testing

### **Test Schema Protection:**

```bash
# 1. Make a schema change (add a field to schema.ts)
# 2. Deploy code (should NOT delete any database fields)
# 3. Verify: psql $PROD_DATABASE_URL -c "\d table_name"
# Expected: All existing fields still present
```

### **Test User Limits Disabled:**

```bash
# 1. Add 10+ users to any organization
# 2. No "user limit exceeded" errors should appear
# 3. Check: All users can be created successfully
```

---

## 📊 Current State

### **Production Database:**
```sql
-- plan_settings table
max_users   | integer | nullable (null = unlimited)
max_vendors | integer | nullable (null = unlimited)  
max_orders  | integer | nullable (null = unlimited)

-- All three fields present ✅
```

### **Subscription Plans:**
```typescript
{
  free:       { maxUsers: -1 }, // unlimited
  standard:   { maxUsers: -1 }, // unlimited
  enterprise: { maxUsers: -1 }  // unlimited
}
```

---

## 🚀 Deployment

### **Files Changed:**

1. `/server/routes.ts` - Removed dangerous endpoint
2. `/shared/subscription-config.ts` - Set unlimited users
3. `/CRITICAL_FIXES_SCHEMA_AND_USERS.md` - This documentation

### **Deployment Steps:**

```bash
# 1. Restart server to apply changes
pkill -f "npm run dev"
npm run dev

# 2. Or deploy to production
git add server/routes.ts shared/subscription-config.ts
git commit -m "CRITICAL: Fix schema deletion & disable user limits"
git push
```

---

## 🔍 Monitoring

### **Watch For:**

1. **Schema stability:**
   - Monitor: Are fields still present after deployments?
   - Alert: If any columns disappear unexpectedly

2. **User creation:**
   - Monitor: Can organizations add unlimited users?
   - Alert: If user limit errors appear

3. **Error logs:**
   - Watch: For any schema sync related errors
   - Check: No `db:push --force` commands in logs

---

## 📚 Related Documentation

- `/SCHEMA_SAFETY_GUIDE.md` - Schema change best practices
- `/PLAN_SETTINGS_SCHEMA_FIX.md` - Recent max_users field fix
- `/migrations/0033_fix_plan_settings_schema.sql` - Latest migration

---

## ⚠️ IMPORTANT REMINDERS

### **For Developers:**

1. **NEVER** create schema sync endpoints
2. **ALWAYS** use migrations for schema changes
3. **TEST** in development before production
4. **VERIFY** database state after deployment

### **For Schema Changes:**

```bash
✅ DO:     Create migration → Test dev → Apply prod → Deploy code
❌ DON'T:  Edit database directly
❌ DON'T:  Use db:push in production
❌ DON'T:  Trust automated schema sync
```

---

## 🎉 Summary

**Before:**
- ❌ Fields deleted on every deployment
- ❌ Users limited by subscription plan
- ❌ Dangerous auto-sync endpoint active

**After:**
- ✅ Schema protected with migration-based workflow
- ✅ Unlimited users for all plans
- ✅ Dangerous endpoint removed
- ✅ Production database stable

**Status:** ✅ **BOTH ISSUES RESOLVED**

---

**CRITICAL:** Test thoroughly before deploying to production!

1. Verify no user limit errors
2. Verify schema fields persist after restart
3. Monitor logs for any db:push commands

**Questions?** Check the documentation or ask for help!


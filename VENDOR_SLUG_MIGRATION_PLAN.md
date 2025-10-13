# Vendor Slug Architecture Fix - Migration Plan

**Date:** October 13, 2025  
**Issue:** vendor_short_code serves dual purpose (editable + immutable)  
**Solution:** Separate concerns with proper field naming

---

## Current Problem

```
vendor_short_code = "lipseys"
  ├─ Purpose 1: Reports/CSV exports (needs to be EDITABLE)
  └─ Purpose 2: System routing/API (needs to be IMMUTABLE)
  
❌ Can't be both!
```

---

## Recommended Solution: Field Rename + Add New Field

### Step 1: Schema Changes

```sql
-- 1. Rename vendor_short_code → vendor_slug (what it really is)
ALTER TABLE supported_vendors 
  RENAME COLUMN vendor_short_code TO vendor_slug;

-- 2. Add new vendor_short_code (editable for display)
ALTER TABLE supported_vendors 
  ADD COLUMN vendor_short_code TEXT;

-- 3. Initialize new field with slug values
UPDATE supported_vendors 
  SET vendor_short_code = vendor_slug;

-- 4. Add unique constraint on slug (immutable)
ALTER TABLE supported_vendors 
  ADD CONSTRAINT supported_vendors_vendor_slug_unique UNIQUE (vendor_slug);

-- 5. Same for vendors table
ALTER TABLE vendors 
  RENAME COLUMN vendor_short_code TO vendor_slug;

ALTER TABLE vendors 
  ADD COLUMN vendor_short_code TEXT;

UPDATE vendors 
  SET vendor_short_code = vendor_slug;
```

### Step 2: Update Schema Types

**File:** `shared/schema.ts`

```typescript
// supported_vendors table
export const supportedVendors = pgTable("supported_vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  
  // NEW FIELD: Immutable system identifier for routing/API
  vendorSlug: text("vendor_slug").notNull().unique(), 
  
  // EXISTING FIELD (repositioned): Editable short name for reports
  vendorShortCode: text("vendor_short_code"),
  
  description: text("description").notNull(),
  // ... rest of fields
});

// vendors table  
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(), // Per-org instance identifier
  
  // NEW: Immutable vendor type identifier
  vendorSlug: text("vendor_slug"),
  
  // EXISTING: Editable display name
  vendorShortCode: text("vendor_short_code"),
  
  // ... rest of fields
});
```

### Step 3: Code Migration Pattern

**BEFORE:**
```typescript
// Using vendor_short_code for system routing ❌
const handler = vendorRegistry.getHandlerBySlug(vendor.vendorShortCode);
const credentials = await vault.get(vendor.vendorShortCode);
```

**AFTER:**
```typescript
// Use vendorSlug for system routing ✅
const handler = vendorRegistry.getHandlerBySlug(vendor.vendorSlug);
const credentials = await vault.get(vendor.vendorSlug);

// Use vendorShortCode only for display/reports ✅
const reportName = vendor.vendorShortCode || vendor.name;
```

### Step 4: Files to Update (~30 files)

**Critical Files (System Routing):**
- [ ] `server/routes.ts` - API routing logic
- [ ] `server/vendor-registry.ts` - Handler lookup
- [ ] `server/credential-vault-service.ts` - Credential keys
- [ ] `server/vendor-priority.ts` - Priority lookups
- [ ] `server/storage.ts` - Database queries
- [ ] `server/credential-management-routes.ts` - Credential routing
- [ ] `server/billing-service.ts` - Vendor lookups

**Display Files (Keep using vendorShortCode):**
- [ ] `client/src/pages/SupportedVendorsAdmin.tsx` - Admin UI
- [ ] `client/src/pages/SupportedVendors.tsx` - Org UI
- [ ] `server/csv-export-service.ts` - CSV exports
- [ ] Report generation files

**Search Pattern:**
```bash
# Find all vendorShortCode usage
grep -r "vendorShortCode" server/ client/ --include="*.ts" --include="*.tsx"

# Pattern to look for:
# - Routing/API: Change to vendorSlug
# - Display/Reports: Keep as vendorShortCode
```

---

## Testing Plan

### 1. Unit Tests
```typescript
describe('Vendor Slug vs Short Code', () => {
  it('should use vendorSlug for API routing', () => {
    const handler = registry.getHandlerBySlug('lipseys');
    expect(handler).toBeDefined();
  });
  
  it('should allow editing vendorShortCode', async () => {
    await updateVendor(4, { vendorShortCode: 'LSY' });
    // Should succeed
  });
  
  it('should prevent editing vendorSlug', async () => {
    await updateVendor(4, { vendorSlug: 'new-slug' });
    // Should fail or be ignored
  });
});
```

### 2. Manual Tests
- [ ] Edit vendor short code in admin UI → Should work
- [ ] Test connection for each vendor → Should work
- [ ] Generate CSV export → Should show new short code
- [ ] Check API routing → Should use slug (unchanged)
- [ ] Verify credentials lookup → Should use slug

### 3. Regression Tests
- [ ] All 5 vendor connection tests pass
- [ ] Lipsey's still visible in supported vendors
- [ ] Price comparison works
- [ ] Ordering works
- [ ] CSV exports work

---

## Rollback Plan

If migration fails:

```sql
-- Rollback schema changes
ALTER TABLE supported_vendors 
  DROP COLUMN IF EXISTS vendor_short_code;

ALTER TABLE supported_vendors 
  RENAME COLUMN vendor_slug TO vendor_short_code;

-- Restore original state
```

---

## Alternative: Quick Fix (Temporary)

If full migration is too risky right now:

```typescript
// In admin UI, make vendorShortCode read-only
<Input 
  value={vendor.vendorShortCode}
  disabled={true}
  className="bg-gray-50 cursor-not-allowed"
  title="System identifier - cannot be edited"
/>

// Add warning modal if they try to edit
{showWarning && (
  <Alert variant="destructive">
    ⚠️ Vendor Short Code cannot be edited as it's used throughout the system.
    Contact support if you need to change it.
  </Alert>
)}
```

**Then schedule proper migration for later.**

---

## Timeline Estimates

**Quick Fix (Lock field):**
- Implementation: 30 minutes
- Testing: 15 minutes
- Total: 45 minutes

**Full Migration (Rename + Add):**
- Schema changes: 30 minutes
- Code migration: 2-3 hours
- Testing: 1 hour
- Deployment: 30 minutes
- Total: 4-5 hours

**Which to choose?**
- **Quick fix:** If you need reports working NOW
- **Full migration:** If you can afford 4-5 hours for proper architecture

---

## Recommendation

**Phase 1 (Today):** Quick fix - lock the field, add warning
**Phase 2 (Next week):** Full migration when you have dedicated time

This prevents immediate breakage while allowing proper fix later.

---

## Decision Record

**Date:** ___________  
**Decision:** ☐ Quick Fix  ☐ Full Migration  ☐ Other: ___________  
**Approved By:** ___________  
**Scheduled For:** ___________

---

## Questions to Answer Before Starting

1. **Do you currently need to edit vendor short codes for reports?**
   - If NO: Just lock the field (5 minutes)
   - If YES: Need full migration

2. **How urgent is proper architecture?**
   - Not urgent: Quick fix now, migrate later
   - Urgent: Do full migration

3. **What's your downtime tolerance?**
   - Zero downtime: Quick fix only
   - Can afford 30min: Full migration possible

4. **Who will approve schema changes to production?**
   - Answer: ___________

---

**Next Steps:**
1. Review this plan
2. Choose approach (Quick Fix vs Full Migration)
3. Schedule implementation
4. Execute with testing
5. Monitor for issues


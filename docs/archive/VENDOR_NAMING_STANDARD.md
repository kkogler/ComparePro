# Vendor Naming Standard & Conventions 🎯

## 🚨 CRITICAL: Single Source of Truth

**The `vendorShortCode` field MUST exactly match the vendor handler ID in the vendor registry.**

This is NON-NEGOTIABLE for the system to work correctly.

## 📋 Naming Rules

### 1. **vendorShortCode Format**
- ✅ **MUST** be lowercase
- ✅ **MUST** use hyphens for multi-word vendors (NOT underscores)
- ✅ **MUST** match exactly with vendor registry handler ID
- ✅ **MUST** be URL-safe (no spaces, special characters)
- ✅ **MUST** be unique across all vendors

### 2. **Examples**

| Vendor Name | ✅ CORRECT vendorShortCode | ❌ WRONG |
|-------------|---------------------------|----------|
| Chattanooga Shooting Supplies Inc. | `chattanooga` | ~~Chattanooga~~, ~~chattanooga-shooting~~ |
| Bill Hicks & Co. | `bill-hicks` | ~~bill_hicks~~, ~~BillHicks~~ |
| Sports South | `sports-south` | ~~sports_south~~, ~~SportsSouth~~ |
| Lipsey's Inc. | `lipseys` | ~~lipsey's~~, ~~Lipseys~~ |
| GunBroker.com LLC | `gunbroker` | ~~gun-broker~~, ~~GunBroker~~ |

## 🏗️ Three-Layer Architecture

### Layer 1: Vendor Registry (Handler Definition)
**File**: `server/vendor-registry.ts`
```typescript
this.register({
  vendorId: 'chattanooga',  // ← This is the canonical ID
  vendorName: 'Chattanooga Shooting Supplies Inc.',
  apiType: 'rest_api',
  testConnection: async (creds) => { /* ... */ }
});
```

### Layer 2: Supported Vendors (Admin Template)
**Table**: `supported_vendors`
```sql
INSERT INTO supported_vendors (name, vendor_short_code, ...) VALUES
  ('Chattanooga Shooting Supplies Inc.', 'chattanooga', ...);
  --                                      ↑ MUST match vendorId above
```

### Layer 3: Organization Vendors (Store Instance)
**Table**: `vendors`
```sql
INSERT INTO vendors (company_id, supported_vendor_id, name, vendor_short_code, slug, ...) VALUES
  (5, 2, 'Chattanooga Shooting Supplies Inc.', 'chattanooga', 'chattanooga', ...);
  --                                            ↑ copied from supported_vendors
```

## 🔧 Enforcement Mechanisms

### Database Level
```sql
-- TODO: Add constraint to enforce lowercase
ALTER TABLE supported_vendors 
ADD CONSTRAINT vendor_short_code_lowercase 
CHECK (vendor_short_code = LOWER(vendor_short_code));
```

### Application Level
```typescript
// In storage.ts - createSupportedVendor()
async createSupportedVendor(vendor: InsertSupportedVendor): Promise<SupportedVendor> {
  // Auto-normalize vendorShortCode
  if (vendor.vendorShortCode) {
    vendor.vendorShortCode = vendor.vendorShortCode.toLowerCase();
  }
  // ... rest of creation logic
}
```

## 📝 New Vendor Onboarding Checklist

When adding a new vendor, follow these steps IN ORDER:

### Step 1: Choose the Canonical ID
- [ ] Decide on the vendorShortCode (lowercase, hyphenated)
- [ ] Verify it's unique and not used by existing vendors
- [ ] Document it in this file

### Step 2: Register Handler
- [ ] Create handler in `server/vendor-registry.ts` with `vendorId` = your chosen shortCode
- [ ] Implement required methods (testConnection, searchProducts, etc.)
- [ ] Test handler in isolation

### Step 3: Create Supported Vendor
- [ ] Add to `supported_vendors` table with `vendor_short_code` = your chosen shortCode
- [ ] Ensure credential fields match handler expectations
- [ ] Verify shortCode is lowercase

### Step 4: Create Vendor Config (Optional)
- [ ] Add entry to `shared/vendor-config.ts` if needed
- [ ] Use same shortCode as ID

### Step 5: Verify End-to-End
- [ ] Check admin panel can find vendor
- [ ] Test connection works
- [ ] Verify price comparison works (if applicable)
- [ ] Test credential management

## 🚫 Common Mistakes to Avoid

### ❌ Mistake 1: Case Mismatch
```typescript
// Handler registered as:
vendorId: 'chattanooga'

// But supported_vendor has:
vendor_short_code: 'Chattanooga'  // ← WRONG! Will break lookups
```

### ❌ Mistake 2: Underscore vs Hyphen
```typescript
// Handler registered as:
vendorId: 'bill-hicks'

// But supported_vendor has:
vendor_short_code: 'bill_hicks'  // ← WRONG! Different identifier
```

### ❌ Mistake 3: Multiple Sources of Truth
```typescript
// Don't hardcode vendor IDs in multiple places:
if (vendor.name.includes('Chattanooga')) { /* ... */ }  // ← WRONG
if (vendor.id === 13) { /* ... */ }  // ← WRONG

// Always use the shortCode:
if (vendor.vendorShortCode === 'chattanooga') { /* ... */ }  // ✅ CORRECT
```

## 🔍 Debugging Vendor Identification Issues

If a vendor connection/lookup is failing:

1. **Check Handler Registration**
   ```bash
   grep -r "vendorId:" server/vendor-registry.ts
   ```

2. **Check Supported Vendor Record**
   ```sql
   SELECT id, name, vendor_short_code FROM supported_vendors WHERE name LIKE '%Chattanooga%';
   ```

3. **Verify They Match**
   - Handler `vendorId` should EXACTLY match `vendor_short_code`
   - Both should be lowercase
   - Both should use same hyphenation

4. **Check Console Logs**
   ```
   🔍 ADMIN TEST CONNECTION: Testing with vendorIdentifier: chattanooga
   🔍 VENDOR REGISTRY: Fetching admin credentials for chattanooga
   ```

## 📚 Reference: Current Vendor IDs

| Vendor | Handler ID | vendorShortCode | Status |
|--------|-----------|-----------------|--------|
| Chattanooga Shooting Supplies | `chattanooga` | `chattanooga` | ✅ Active |
| Bill Hicks & Co. | `bill-hicks` | `bill-hicks` | ✅ Active |
| Sports South | `sports-south` | `sports-south` | ✅ Active |
| Lipsey's Inc. | `lipseys` | `lipseys` | ✅ Active |
| GunBroker.com LLC | `gunbroker` | `gunbroker` | ✅ Active |

---

**Last Updated**: 2025-10-03  
**Maintainer**: Development Team  
**Version**: 1.0



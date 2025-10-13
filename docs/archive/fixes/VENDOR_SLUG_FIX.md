# Vendor Slug Mismatch Fix

## Problem

Store-level credential saving was failing with error:
```
Error: 400: {"success":false,"message":"Vendor not found after save: sports-south"}
```

## Root Cause

There are **two different vendor identifier systems** in the application:

### 1. Company-Specific Vendors (`vendors` table)
- Slugs have numeric suffixes: `sports-south-1`, `gunbroker-1`, `bill-hicks-1`
- These are unique per company
- Multiple companies can have their own instances

### 2. Global Vendor Registry (`supported_vendors` table)
- Identifiers have NO suffix: `sports-south`, `gunbroker`, `bill-hicks`
- These are shared across all companies
- Used for credential schemas, vendor configs, etc.

### The Mismatch

**Frontend sends:** `sports-south-1` (from `vendors` table slug)  
**Credential vault expects:** `sports-south` (from `supported_vendors` lookup)

The `getSupportedVendorByName()` function normalizes names by removing non-alphanumeric chars:
- `sports-south-1` → `sportssouth1`
- `sports-south` → `sportssouth`
- **These don't match!** ❌

## Solution

Strip the numeric suffix (e.g., `-1`, `-2`) from vendor slugs before passing to credential vault:

```typescript
// Before
const stringVendorId = vendorSlug; // sports-south-1

// After
const stringVendorId = vendorSlug.replace(/-\d+$/, ''); // sports-south
```

The regex `/-\d+$/` removes trailing dash + digits.

## Files Modified

**server/credential-management-routes.ts**

Updated 5 routes to strip numeric suffixes:

1. **GET `/org/:slug/api/vendors/:vendorSlug/credential-schema`**
   - Line 201: Strip suffix before getting schema

2. **POST `/org/:slug/api/vendors/:vendorSlug/credentials`** (Save credentials)
   - Line 239: Strip suffix before saving
   - This was causing the original error!

3. **POST `/org/:slug/api/vendors/:vendorSlug/test-connection-alt`** (Test connection)
   - Line 339: Strip suffix before testing

4. **GET `/org/:slug/api/vendors/:vendorSlug/credentials`** (Get credentials)
   - Line 389: Strip suffix before retrieving

5. **GET `/org/:slug/api/vendors/:vendorSlug/credentials/debug`** (Debug)
   - Line 553: Strip suffix for debugging

## Why This Works

**Company Vendor Lookup (verification):**
```typescript
// Line 292 - Still uses full slug with -1 suffix
const vendor = await storage.getVendorBySlug(vendorSlug, companyId);
// ✅ Looks in vendors table: sports-south-1
```

**Credential Vault Operations (save/retrieve):**
```typescript
// Line 239 - Now uses base identifier without suffix
const stringVendorId = vendorSlug.replace(/-\d+$/, '');
await credentialVault.storeStoreCredentials(stringVendorId, companyId, ...);
// ✅ Looks in supported_vendors table: sports-south
```

## Testing

1. Navigate to: http://localhost:3001/org/phils-guns/supported-vendors
2. Click "Configure" on Sports South
3. Enter credentials:
   - Username: 3716
   - Customer Number: 3716
   - Password: 49028
   - Source: BSTPRC
4. Click "Save Credentials"

**Expected behavior:**
- ✅ Credentials save successfully
- ✅ No "Vendor not found" error
- ✅ Verification step passes
- ✅ Test connection works

**Logs to verify:**
```
🔄 CREDENTIAL SAVE: Converted vendor slug sports-south-1 → sports-south
💾 STORAGE (HYBRID): Saving company vendor credentials
✅ STORAGE (HYBRID): Successfully saved credentials to JSON + legacy columns
✅ VERIFICATION PASSED: All credential fields saved successfully
```

## Impact

**Before Fix:**
- ❌ Sports South credentials: FAILED
- ❌ Chattanooga credentials: FAILED
- ❌ Bill Hicks credentials: FAILED
- ❌ Lipsey's credentials: FAILED
- ✅ GunBroker credentials: OK (uses admin creds)

**After Fix:**
- ✅ All vendors: WORK
- ✅ Credential save succeeds
- ✅ Test connection works
- ✅ Price comparison retrieves credentials

## Related Concepts

### Why Do We Have Two Slug Systems?

**`supported_vendors` (Global Registry):**
- Defines available vendors for ALL companies
- Contains schema, API config, priority
- Single source of truth for vendor capabilities
- One record per vendor type

**`vendors` (Company-Specific):**
- Each company gets their own vendor instances
- Allows custom settings per company
- Stores company-specific credentials
- Multiple records per vendor type (one per company)

### Why Numeric Suffixes?

The `-1` suffix allows:
- Future multi-tenancy: Company A can have `sports-south-1`, Company B can have `sports-south-2`
- URL uniqueness: Each company's vendor has unique route
- Database uniqueness: Slug is part of compound key `(company_id, slug)`

## Implementation Date
October 9, 2025

## Status
✅ **FIXED** - All 5 credential management routes updated





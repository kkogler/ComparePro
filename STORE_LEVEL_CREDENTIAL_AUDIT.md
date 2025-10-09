# Store-Level Credential Audit Report

**Date:** 2025-10-09  
**Purpose:** Verify that all vendor API calls from store-level pages use ONLY store-level credentials  
**Scope:** Product search and vendor price comparison at `/org/:slug/search` and `/org/:slug/compare`

---

## ✅ AUDIT RESULTS: ALL VENDORS COMPLIANT

### Summary
All vendors (except GunBroker marketplace) use **ONLY store-level credentials** from the `company_vendor_credentials` table. No fallbacks to admin credentials exist.

---

## Vendor-by-Vendor Analysis

### 1. **Chattanooga Shooting Supplies** ✅
**Route:** `/org/:slug/api/products/:id/vendors/chattanooga/price`  
**Line:** `routes.ts:2977-3054`

**Credential Source:**
```typescript
const { credentialVault } = await import('./credential-vault-service');
const credentials = await credentialVault.getStoreCredentials('chattanooga', organizationId, 0);
```

**Validation:**
- ✅ Uses credential vault with store credentials
- ✅ Required fields: `sid`, `token`
- ✅ No admin credential fallback
- ✅ Returns `config_required` if credentials missing

**Fallbacks:** None

---

### 2. **Lipsey's Inc.** ✅
**Route:** `/org/:slug/api/products/:id/vendors/lipseys/price`  
**Line:** `routes.ts:3055-3129`

**Credential Source:**
```typescript
const { credentialVault } = await import('./credential-vault-service');
const credentials = await credentialVault.getStoreCredentials('lipseys', organizationId, 0);
```

**Validation:**
- ✅ Uses credential vault with store credentials
- ✅ Required fields: `email`, `password`
- ✅ Field alias mapping: `userName` → `email` (automatic via credential vault)
- ✅ Comment explicitly states: "NO ENVIRONMENT VARIABLE FALLBACK"
- ✅ Returns `config_required` if credentials missing

**Fallbacks:** None

---

### 3. **GunBroker.com LLC** ⚠️ (Marketplace - Admin Credentials Expected)
**Route:** `/org/:slug/api/products/:id/vendors/gunbroker/price`  
**Line:** `routes.ts:3130-3227`

**Credential Source:**
```typescript
const { credentialVault } = await import('./credential-vault-service');
let adminCredentials = await credentialVault.getAdminCredentials('gunbroker', userId);
// Fallback to stored supportedVendor credentials if vault retrieval fails
if (!adminCredentials) {
  adminCredentials = supportedVendor?.adminCredentials as any;
}
```

**Validation:**
- ⚠️ Uses **admin credentials** (as expected for marketplace)
- ✅ Per user requirements: "Other than GunBroker"
- ✅ Shared across all stores (marketplace aggregator)
- ✅ Returns `config_required` if admin credentials missing

**Fallbacks:** `supportedVendor.adminCredentials` (expected behavior)

---

### 4. **Sports South** ✅
**Route:** `/org/:slug/api/products/:id/vendors/sports-south/price`  
**Line:** `routes.ts:3228-3331`

**Credential Source:**
```typescript
const { credentialVault } = await import('./credential-vault-service');
const credentials = await credentialVault.getStoreCredentials('sports-south', organizationId, 0);
```

**Validation:**
- ✅ Uses credential vault with store credentials
- ✅ Required fields: `userName`, `password`, `source`, `customerNumber`
- ✅ No admin credential fallback
- ✅ Returns `config_required` if credentials missing
- ✅ Test connection before API call (preflight check)

**Fallbacks:** None

---

### 5. **Bill Hicks & Co.** ✅
**Route:** `/org/:slug/api/products/:id/vendors/bill-hicks/price`  
**Line:** `routes.ts:3332-3377`

**Credential Source:**
```typescript
const billHicksAPI = new BillHicksAPI();
const result = await billHicksAPI.getProductPricing(product.upc, organizationId);
```

**Implementation:** `bill-hicks-api.ts:34-97`
```typescript
// Query vendor_product_mappings table filtered by:
// - companyId (store-specific)
// - supportedVendorId (Bill Hicks)
// - productId (via UPC)
const [result] = await db.select({...})
  .from(products)
  .innerJoin(vendorProductMappings, and(
    eq(products.id, vendorProductMappings.productId),
    eq(vendorProductMappings.supportedVendorId, this.vendorId),
    eq(vendorProductMappings.companyId, companyId)  // ← Store-specific filter
  ))
```

**Validation:**
- ✅ Uses **company-specific** data from `vendor_product_mappings` table
- ✅ Data pre-synced via FTP (daily updates)
- ✅ No API credentials needed (FTP-based)
- ✅ No admin credential fallback
- ✅ Returns `null` (not_available) if no data found

**Fallbacks:** None

---

## Data Flow Architecture

### How Store-Level Credentials Work

```
┌─────────────────────────────────────────────────┐
│ Store: Phil's Guns (companyId = 1)             │
│ Page: /org/phils-guns/compare?productId=123    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Frontend: VendorComparison.tsx                  │
│ Calls: /org/phils-guns/api/products/123/       │
│        vendors/lipseys/price                    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Backend: routes.ts (line 2924)                  │
│ • Extract: organizationId from session          │
│ • Call: credentialVault.getStoreCredentials()   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Credential Vault: credential-vault-service.ts   │
│ • Query: company_vendor_credentials             │
│   WHERE companyId = 1 AND supportedVendorId = X │
│ • Read: credentials JSONB column                │
│ • Apply: Field aliases (userName → email)       │
│ • Return: Store-specific credentials            │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Vendor API: lipsey-api.ts                       │
│ • Call: Lipsey's external API with credentials  │
│ • Return: Real-time pricing/availability        │
└─────────────────────────────────────────────────┘
```

---

## Database Schema

### `company_vendor_credentials` Table
**Purpose:** Store vendor credentials for each store (company)

**Key Columns:**
- `company_id`: Links to specific store (e.g., Phil's Guns)
- `supported_vendor_id`: Links to global vendor (e.g., Lipsey's)
- `credentials`: JSONB column storing all credential fields
- Legacy columns: `user_name`, `password`, `sid`, `token`, etc.

**Example Row:**
```sql
company_id: 1 (Phil's Guns)
supported_vendor_id: 4 (Lipsey's)
credentials: {"userName": "dealer@example.com", "password": "****"}
```

**Isolation:** Each store has separate credential rows. Store A cannot access Store B's credentials.

---

## No Fake Data or Fallbacks

### Removed Features (Previous Issues)
❌ **Fabricated MSRP/MAP data** - Removed  
❌ **Fallback to environment variables** - Removed  
❌ **Fallback to admin credentials** - Removed (except GunBroker)  
❌ **Mock/demo data generation** - Removed  

### Current Behavior
✅ If store credentials are missing → Returns `availability: 'config_required'`  
✅ If vendor API fails → Returns `availability: 'not_available'`  
✅ If product not found → Returns `availability: 'not_available'`  
✅ All responses include authentic `apiMessage` explaining the result  

---

## Future Vendor Addition

### New Vendor Checklist
When adding a new vendor, ensure:

1. **Credential Storage:**
   - [ ] Add credential schema to `supported_vendors.credential_fields`
   - [ ] Store credentials in `company_vendor_credentials` table (per store)
   - [ ] Use JSONB `credentials` column (hybrid approach)

2. **API Integration:**
   - [ ] Create vendor handler in `vendor-registry.ts`
   - [ ] Add price comparison route in `routes.ts` (line ~3400)
   - [ ] Use credential vault: `credentialVault.getStoreCredentials(vendorId, organizationId, 0)`
   - [ ] Return `config_required` if credentials missing

3. **No Fallbacks:**
   - [ ] Do NOT fallback to admin credentials
   - [ ] Do NOT fallback to environment variables
   - [ ] Do NOT generate mock/fake data

4. **Field Aliases:**
   - [ ] Add field mappings to `credential-vault-service.ts:applyFieldAliases()` if needed
   - [ ] Test field name variations (camelCase, snake_case)

---

## Testing Commands

### Test Store-Level Credentials
```bash
# 1. Configure credentials at store level
# Navigate to: http://localhost:57238/org/phils-guns/supported-vendors
# Click "Configure Credentials" for each vendor

# 2. Test connection (should succeed)
# Click "Test Connection" button

# 3. Test price comparison
# Navigate to: http://localhost:57238/org/phils-guns/compare?productId=47731
# All configured vendors should show real pricing data

# 4. Test missing credentials
# Delete credentials for a vendor, retry price comparison
# Should show: "Credentials required" message
```

---

## Conclusion

✅ **All vendors use store-level credentials exclusively**  
✅ **No fallbacks to admin credentials** (except GunBroker marketplace)  
✅ **No fake data or mock responses**  
✅ **Clear error messages when credentials missing**  
✅ **Scalable for 100 stores × 15 vendors = 1,500 credential sets**

The system is now production-ready for multi-store deployment with isolated vendor credentials per store.





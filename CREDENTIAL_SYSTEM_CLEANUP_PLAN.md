# Credential System Cleanup Plan

## 🚨 **Current Problem**

You're experiencing the **exact issue** that happens when multiple credential systems run simultaneously:

1. **You save credentials** → Goes to NEW system (credential vault)
2. **System retrieves credentials** → Falls back to OLD system (legacy database)
3. **Result**: Wrong token `0145d5fa...` instead of your `A3B1F814A833F40CFD2A800E0EE4CA81`

## 🔍 **Root Cause Analysis**

### Multiple Active Systems
Despite documentation claiming "consolidation complete", there are **3 active credential systems**:

1. **New Credential Vault** (`FEATURE_NEW_CREDENTIAL_VAULT=true`)
   - Route: `/org/:slug/api/vendors/:vendorId/credentials`
   - Storage: Encrypted in `supported_vendors.adminCredentials` + `company_vendor_credentials`
   - Status: ✅ **ENABLED** but not fully working

2. **Legacy Database System** 
   - Storage: Plain text in `company_vendor_credentials` table
   - Status: ❌ **STILL ACTIVE** as fallback

3. **Vendor-Specific Mappings**
   - File: `vendor-credential-manager.ts`
   - Status: ❌ **CONFLICTING** with new system

### The Conflict Code
```typescript
// vendor-credential-manager.ts line 74-93
async load(companyId: number, supportedVendorId: number, vendorName: string) {
  // Try new system first
  if (this.featureFlags.useNewVault) {
    try {
      const credentials = await credentialVault.getStoreCredentials(vendorName, companyId, 0);
      return credentials;
    } catch (error) {
      console.error('Failed to load credentials from vault, falling back to legacy:', error);
    }
  }

  // FALLBACK TO LEGACY - This is where your old token comes from!
  if (this.featureFlags.chattanooga && this.isChattanooga(vendorName)) {
    const row = await storage.getCompanyVendorCredentials(companyId, supportedVendorId);
    if (!row) return null;
    return chattanoogaMapping.toFrontend(row);
  }
}
```

## 🎯 **Cleanup Solution**

### Phase 1: Immediate Fix (5 minutes)
1. **Delete old Chattanooga credentials** from `company_vendor_credentials` table
2. **Force new system only** - remove fallback logic
3. **Test connection** with your correct token

### Phase 2: Complete Cleanup (15 minutes)
1. **Remove vendor-credential-manager.ts** entirely
2. **Remove legacy routes** and fallback code
3. **Consolidate to single credential vault**
4. **Update all references** to use new system only

### Phase 3: Verification (5 minutes)
1. **Test all vendor connections**
2. **Verify no fallbacks exist**
3. **Clean build and restart**

## 📋 **Execution Steps**

### Step 1: Database Cleanup
```sql
-- Delete old Chattanooga credentials that are causing conflicts
DELETE FROM company_vendor_credentials 
WHERE supported_vendor_id = (
  SELECT id FROM supported_vendors 
  WHERE name ILIKE '%chattanooga%'
);
```

### Step 2: Code Cleanup
- Remove `vendor-credential-manager.ts`
- Remove legacy fallback logic in routes
- Update all credential access to use vault only

### Step 3: Test
- Save your correct Chattanooga token
- Test connection - should work immediately

## ⚠️ **Why This Happened**

The "consolidation" was **incomplete**. The documentation was updated but:
- Legacy fallback code remained active
- Multiple storage systems still running
- No cleanup of old data
- Feature flags created parallel systems instead of replacing them

## ✅ **Expected Result**

After cleanup:
- ✅ Single credential system (vault only)
- ✅ Your token `A3B1F814A833F40CFD2A800E0EE4CA81` works
- ✅ No more `0145d5fa...` conflicts
- ✅ Maintainable codebase
- ✅ No duplicate systems






















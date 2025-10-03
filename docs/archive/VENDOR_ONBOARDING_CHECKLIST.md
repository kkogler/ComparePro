# New Vendor Onboarding Checklist ✅

Use this checklist when adding a new vendor to the system to ensure everything is configured correctly and consistently.

## 📝 Pre-Implementation Planning

- [ ] **Choose Vendor Short Code**
  - Must be **lowercase** (enforced by code)
  - Use hyphens for multi-word vendors (e.g., `bill-hicks`, `sports-south`)
  - Verify it's unique (check `supported_vendors` table)
  - Document it in `VENDOR_NAMING_STANDARD.md`

- [ ] **Determine Vendor Capabilities**
  - [ ] Authentication type (Basic Auth, OAuth, API Key, FTP, etc.)
  - [ ] Real-time pricing support
  - [ ] Inventory sync
  - [ ] Product catalog
  - [ ] Electronic ordering
  - [ ] Image sync

- [ ] **Identify Required Credentials**
  - List all credential fields needed (username, password, API key, etc.)
  - Determine if they're admin-level, store-level, or both
  - Document any environment-specific requirements (sandbox vs production)

---

## 🏗️ Implementation Steps

### Step 1: Create Vendor Handler
**File**: `server/vendor-registry.ts` or `server/[vendor-name]-api.ts`

- [ ] Create vendor API class (if needed)
  ```typescript
  // Example: server/newvendor-api.ts
  export class NewVendorAPI {
    async testConnection(): Promise<{ success: boolean; message: string }> {
      // Implement connection test
    }
    
    async searchProducts(params): Promise<any> {
      // Implement product search
    }
  }
  ```

- [ ] Register handler in vendor registry
  ```typescript
  // In server/vendor-registry.ts
  const { NewVendorAPI } = await import('./newvendor-api');
  this.register({
    vendorId: 'newvendor',  // ← MUST match vendorShortCode
    vendorName: 'New Vendor Inc.',
    apiType: 'rest_api',
    testConnection: async (creds) => {
      const api = new NewVendorAPI(creds);
      return await api.testConnection();
    },
    searchProducts: async (creds, params) => {
      const api = new NewVendorAPI(creds);
      return await api.searchProducts(params);
    }
  });
  ```

- [ ] **VERIFY**: `vendorId` is lowercase and matches chosen short code
- [ ] Implement `testConnection()` method
- [ ] Implement `searchProducts()` method (if applicable)
- [ ] Test handler in isolation

### Step 2: Create Supported Vendor Record
**Method**: Use admin panel OR create database script

#### Option A: Admin Panel (Recommended)
- [ ] Navigate to `/dev/admin/supported-vendors`
- [ ] Click "Add New Vendor"
- [ ] Fill in vendor details:
  - Name: Full vendor name
  - **Vendor Short Code**: Same as `vendorId` from handler (will auto-lowercase)
  - Description: Brief description
  - API Type: rest_api, ftp, excel, etc.
  - Credential Fields: Define required credentials as JSON
  - Features: Check applicable features

#### Option B: Database Script
- [ ] Create script `create-[vendor]-vendor.ts`
  ```typescript
  import { storage } from './server/storage.js';
  
  const newVendor = {
    name: 'New Vendor Inc.',
    vendorShortCode: 'newvendor',  // Auto-lowercased by storage layer
    description: 'Description of vendor',
    apiType: 'rest_api',
    credentialFields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true },
      { name: 'accountId', label: 'Account ID', type: 'text', required: true }
    ],
    features: {
      electronicOrdering: false,
      realTimePricing: true,
      inventorySync: true,
      productCatalog: true
    },
    isEnabled: true,
    sortOrder: 10,
    productRecordPriority: 5
  };
  
  await storage.createSupportedVendor(newVendor);
  ```
- [ ] Run script: `npx tsx create-[vendor]-vendor.ts`

- [ ] **VERIFY**: `vendorShortCode` is lowercase in database

### Step 3: Add Vendor Config (Optional)
**File**: `shared/vendor-config.ts`

- [ ] Add vendor to `VENDOR_CONFIGS` object
  ```typescript
  'newvendor': {
    id: 'newvendor',  // Same as vendorId and vendorShortCode
    name: 'New Vendor Inc.',
    shortCode: 'newvendor',
    displayName: 'New Vendor',
    capabilities: {
      supportsAuth: true,
      supportsSync: true,
      supportsOrdering: false,
      supportsFTP: false
    },
    requiredCredentials: ['apiKey', 'accountId'],
    imagePriority: 3,
    completenessInfo: {
      strengths: ['Basic data', 'Images'],
      completenessLevel: 'Medium'
    }
  }
  ```

### Step 4: Create Frontend Config Component (If Needed)
**File**: `client/src/components/[VendorName]Config.tsx`

- [ ] Create configuration modal component
- [ ] Import and use in `SupportedVendors.tsx`
- [ ] Handle credential input and validation
- [ ] Implement test connection button
- [ ] Use `vendor.slug || vendor.vendorShortCode || vendor.id` for API calls

### Step 5: Admin Credentials Setup
**UI**: Admin Panel → Supported Vendors

- [ ] Navigate to vendor in admin panel
- [ ] Click "Configure Admin Credentials"
- [ ] Enter admin-level credentials
- [ ] Click "Test Connection" to verify
- [ ] Save credentials

### Step 6: Testing

#### Backend Testing
- [ ] Test handler registration
  ```bash
  # Check logs for:
  # ✅ Vendor handler registered: newvendor
  ```
- [ ] Test credential retrieval
- [ ] Test connection with admin credentials
- [ ] Test API calls (searchProducts, etc.)

#### Frontend Testing
- [ ] Admin panel shows vendor correctly
- [ ] Vendor appears in org settings
- [ ] Test connection works from admin panel
- [ ] Store-level credential management works
- [ ] Price comparison works (if applicable)

#### End-to-End Testing
- [ ] Create test organization
- [ ] Configure vendor for organization
- [ ] Test real-time price lookup
- [ ] Test catalog sync (if applicable)
- [ ] Test ordering (if applicable)

### Step 7: Documentation

- [ ] Add vendor to `VENDOR_NAMING_STANDARD.md` reference table
- [ ] Document any vendor-specific quirks or requirements
- [ ] Update API documentation if needed
- [ ] Add vendor to README or main documentation

---

## 🚨 Common Pitfalls to Avoid

### ❌ WRONG: Case Mismatch
```typescript
// Handler registered as:
vendorId: 'newvendor'

// But you create with:
vendorShortCode: 'NewVendor'  // ← Will auto-correct but shows inconsistency
```

### ❌ WRONG: Different Identifiers
```typescript
// Handler uses:
vendorId: 'new-vendor'

// But supported vendor has:
vendorShortCode: 'newvendor'  // ← Different! Will break lookups
```

### ❌ WRONG: Underscore vs Hyphen
```typescript
// Be consistent with multi-word vendors:
vendorId: 'new-vendor'  // ✅ Good
vendorId: 'new_vendor'  // ❌ Inconsistent with other vendors
```

### ❌ WRONG: Missing Handler
```typescript
// Created supported vendor but forgot to register handler
// Result: "No handler found for vendor: newvendor"
```

---

## ✅ Validation Checklist

Before marking vendor as complete, verify:

- [ ] **Handler registered** in `vendor-registry.ts`
- [ ] **Supported vendor** created in database
- [ ] **vendorShortCode** matches **vendorId** exactly
- [ ] **Both are lowercase**
- [ ] **Test connection** works in admin panel
- [ ] **Admin credentials** saved and tested
- [ ] **Store credentials** can be configured
- [ ] **Logs show no errors** when vendor is accessed
- [ ] **Price comparison** works (if applicable)

---

## 📚 Reference Files

| File | Purpose |
|------|---------|
| `server/vendor-registry.ts` | Register vendor handler |
| `shared/schema.ts` | Database schema for vendors table |
| `shared/vendor-config.ts` | Frontend vendor configuration |
| `client/src/pages/SupportedVendorsAdmin.tsx` | Admin UI for vendor management |
| `VENDOR_NAMING_STANDARD.md` | Naming conventions and rules |

---

## 🆘 Troubleshooting

### "No handler found for vendor: [vendor]"
- Check that `vendorId` in handler registration matches `vendorShortCode`
- Verify handler is registered in `vendor-registry.ts`
- Check console logs for handler registration messages

### "Vendor not found: [vendor]"
- Check `supported_vendors` table has record
- Verify `vendorShortCode` is correct
- Check for typos in vendor identifier

### "No credentials found"
- Configure admin credentials in admin panel
- Verify credentials are saved correctly
- Check credential field names match handler expectations

### Test connection fails
- Verify credentials are correct
- Check API endpoints are accessible
- Review vendor API handler implementation
- Check for authentication method mismatches

---

**Last Updated**: 2025-10-03  
**Version**: 1.0



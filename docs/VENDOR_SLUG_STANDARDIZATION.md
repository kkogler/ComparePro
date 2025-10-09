# Vendor Slug Standardization

## 🎯 Problem

**Issue**: Vendor slugs were generated inconsistently across different parts of the codebase, causing API routing failures.

### Historical Slug Generation Methods

| Code Location | Slug Format | Example |
|--------------|-------------|---------|
| `billing-service.ts` (Zoho onboarding) | `{vendorShortCode}-{companyId}` | `chattanooga-5` |
| `storage.createVendorsFromSupported()` | `{vendorShortCode}` | `chattanooga` |

### Why This Caused Problems

```
Frontend API Call:
  buildVendorApiUrl('phils-guns', vendor, 'test-connection')
  → /org/phils-guns/api/vendors/chattanooga/test-connection
  (Uses vendorShortCode from vendor object)

Backend Lookup (OLD):
  getVendorBySlug('chattanooga', companyId)
  → SELECT * FROM vendors WHERE slug='chattanooga' AND company_id=5
  → Production database has: slug='chattanooga-5'
  → NO MATCH → 404 ERROR
```

## ✅ Solution

### 1. Database Migration
**File**: `migrations/0031_normalize_vendor_slugs.sql`

Updates all existing vendor records to use the standardized slug format:
```sql
UPDATE vendors
SET slug = vendor_short_code
WHERE slug != vendor_short_code 
  AND vendor_short_code IS NOT NULL;
```

**Before**:
```
id | name                 | slug           | vendor_short_code | company_id
1  | Chattanooga...      | chattanooga-5  | chattanooga       | 5
2  | Bill Hicks & Co.    | bill-hicks-5   | bill-hicks        | 5
```

**After**:
```
id | name                 | slug         | vendor_short_code | company_id
1  | Chattanooga...      | chattanooga  | chattanooga       | 5
2  | Bill Hicks & Co.    | bill-hicks   | bill-hicks        | 5
```

### 2. Code Standardization

#### Backend API Lookup (routes.ts)
Changed from slug-based lookup to vendorShortCode-based lookup:

```typescript
// OLD (broke with different slug formats):
const vendor = await storage.getVendorBySlug(vendorSlug, organizationId);

// NEW (works with any historical slug format):
const supportedVendor = await storage.getSupportedVendorByShortCode(vendorIdentifier);
const allCompanyVendors = await storage.getVendorsByCompany(organizationId);
const vendor = allCompanyVendors.find(v => v.supportedVendorId === supportedVendor.id);
```

#### Billing Service (billing-service.ts)
Fixed slug generation for new vendor provisioning:

```typescript
// OLD (created non-standard slugs):
const slug = `${baseSlug}-${companyId}`; // Result: "chattanooga-5"

// NEW (creates standard slugs):
const slug = vendorShortCode
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');
// Result: "chattanooga"
```

#### Storage Service (storage.ts)
Added new lookup method:

```typescript
async getSupportedVendorByShortCode(shortCode: string): Promise<SupportedVendor | undefined> {
  const [result] = await db.select()
    .from(supportedVendors)
    .where(eq(supportedVendors.shortCode, shortCode));
  return result || undefined;
}
```

### 3. Frontend Standardization

**File**: `client/src/lib/vendor-utils.ts`

Already standardized in previous work:
- `getVendorIdentifier()`: Always returns `vendorShortCode`
- `buildVendorApiUrl()`: Always uses `vendorShortCode` in URLs

## 📋 Deployment Checklist

### Pre-Deployment
- [x] Create migration file: `0031_normalize_vendor_slugs.sql`
- [x] Update `billing-service.ts` slug generation
- [x] Update API endpoints to use shortCode lookup
- [x] Add `getSupportedVendorByShortCode()` method
- [x] Test in development environment

### Deployment
- [ ] Deploy to production
- [ ] Migration will run automatically
- [ ] Verify in Replit logs: "AFTER MIGRATION: Updated X vendor records"

### Post-Deployment Verification
1. Check migration output in logs
2. Test Chattanooga credentials at: `https://pricecomparehub.com/org/phils-guns/supported-vendors`
   - Should save successfully
   - Should load when reopening modal
   - Test connection should work
3. Verify vendor API calls work: `/org/{slug}/api/vendors/{vendorShortCode}/credentials`

## 🔍 Database Schema

### Vendors Table
```sql
CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  supported_vendor_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,  -- ✅ STANDARDIZED: Always matches vendor_short_code
  vendor_short_code TEXT,  -- ✅ SOURCE OF TRUTH for API routing
  -- ... other fields
);

-- Slug is unique per company (not globally unique)
-- Multiple companies can have the same slug (e.g., "chattanooga")
```

### Supported Vendors Table
```sql
CREATE TABLE supported_vendors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT UNIQUE NOT NULL,  -- ✅ MASTER identifier
  vendor_short_code TEXT,
  -- ... other fields
);
```

## 🎓 Key Principles

1. **Single Source of Truth**: `vendorShortCode` is the canonical identifier for all API operations
2. **Slug is Derived**: `vendor.slug` should always equal `vendor.vendorShortCode`
3. **Company Scoping**: Slugs are unique per company, not globally unique
4. **API Routing**: Frontend always uses `vendorShortCode` to build API URLs
5. **Backend Lookup**: Backend looks up by `supportedVendor.shortCode` → finds company's vendor instance

## 🚫 Anti-Patterns (DO NOT DO)

```typescript
// ❌ BAD: Appending companyId to slug
const slug = `${vendorShortCode}-${companyId}`;

// ❌ BAD: Using vendor.slug in API URLs
const url = `/api/vendors/${vendor.slug}/credentials`;

// ❌ BAD: Looking up vendor by slug parameter
const vendor = await storage.getVendorBySlug(slugParam, companyId);

// ✅ GOOD: Use vendorShortCode
const slug = vendorShortCode.toLowerCase().replace(/\s+/g, '-');

// ✅ GOOD: Use buildVendorApiUrl utility
const url = buildVendorApiUrl(orgSlug, vendor, 'credentials');

// ✅ GOOD: Lookup by shortCode → find vendor instance
const supportedVendor = await storage.getSupportedVendorByShortCode(shortCode);
const vendor = companyVendors.find(v => v.supportedVendorId === supportedVendor.id);
```

## 📚 Related Documentation

- `docs/VENDOR_IDENTIFIER_STANDARDIZATION.md` - Frontend vendor identifier utilities
- `client/src/lib/vendor-utils.ts` - Frontend vendor utility functions
- `migrations/0031_normalize_vendor_slugs.sql` - Data normalization migration

## 🔗 Related Issues

- Fixed: Chattanooga credentials not saving (404 error)
- Fixed: Test connection failing in production
- Fixed: Vendor API routing inconsistencies between dev and production


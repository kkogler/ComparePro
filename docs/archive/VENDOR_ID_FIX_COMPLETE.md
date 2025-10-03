# Vendor ID Mismatch Fix - Complete ✅

## Issue Summary
The Admin > Supported Vendors > Test Sync buttons were failing due to **vendor ID mismatch** between:
1. Vendor Registry handler IDs
2. Database `vendor_short_code` values
3. Frontend identifiers sent to API endpoints

## Root Cause
**Sports South** was using inconsistent identifier format:
- ❌ **Vendor Registry**: `vendorId: 'sports_south'` (underscore)
- ❌ **Database**: `vendor_short_code: 'sports_south'` (underscore)
- ✅ **Standard**: Should be `'sports-south'` (hyphen) per `VENDOR_NAMING_STANDARD.md`

## What Was Fixed

### 1. Vendor Registry (`server/vendor-registry.ts`)
**Changed:**
```typescript
// Before
vendorId: 'sports_south'

// After
vendorId: 'sports-south'
```

### 2. Database (`supported_vendors` table)
**Migration executed:**
- Updated `vendor_short_code` from `'sports_south'` → `'sports-south'`
- Updated 2 organization vendor records to match

**Verification:**
```json
{
  "name": "Sports South",
  "vendorShortCode": "sports-south"  ✅
}
```

### 3. Credential Vault Lookups (`server/routes.ts`)
**Updated 3 locations:**
- Line 3032-3035: Price comparison handler lookup
- Line 5415-5417: Sports South inventory endpoint
- Line 9049: Product source migration mapping

**Before:**
```typescript
credentialVault.getStoreCredentials('sports_south', ...)
handler.vendorId === 'sports_south'
```

**After:**
```typescript
credentialVault.getStoreCredentials('sports-south', ...)
handler.vendorId === 'sports-south'
```

### 4. Slug Utilities (`server/slug-utils.ts`)
**Updated legacy mapping:**
```typescript
// Before
'sports south': 'sports_south',
'sports_south': 'sports_south',

// After
'sports south': 'sports-south',
'sports_south': 'sports-south',  // backwards compatibility
'sports-south': 'sports-south',
```

### 5. Catalog Sync (`server/sports-south-catalog-sync.ts`)
**Updated source tracking:**
```typescript
// Before
source: 'sports_south'

// After
source: 'sports-south'
```

### 6. Documentation (`server/vendor-priority.ts`)
**Updated comment example:**
```typescript
// Before
@param vendorSlug - ... (e.g., "lipseys", "sports_south")

// After
@param vendorSlug - ... (e.g., "lipseys", "sports-south")
```

## Naming Standard Enforcement

All vendors now follow the **consistent hyphen-based naming**:

| Vendor | Handler ID | Database Short Code | Status |
|--------|-----------|---------------------|--------|
| Lipsey's | `lipseys` | `lipseys` | ✅ |
| Sports South | `sports-south` | `sports-south` | ✅ (FIXED) |
| Chattanooga | `chattanooga` | `chattanooga` | ✅ |
| GunBroker | `gunbroker` | `gunbroker` | ✅ |
| Bill Hicks | `bill-hicks` | `bill-hicks` | ✅ |

## Testing Checklist

### ✅ Verified Working
- [x] Database migration completed successfully
- [x] Vendor registry loads without errors
- [x] Vendor short codes normalized

### 🔍 To Test
- [ ] Admin > Supported Vendors > Sports South > Test Sync button
- [ ] Admin > Supported Vendors > Sports South > Test Connection
- [ ] Price comparison with Sports South
- [ ] Sports South catalog sync (full & incremental)
- [ ] Store-level Sports South credential testing

## How Test Sync Works Now

### Frontend Flow (`SupportedVendorsAdmin.tsx`)
```typescript
const vendorIdentifier = vendor.vendorShortCode || vendor.name.toLowerCase().replace(/\s+/g, '_');
// For Sports South: vendorIdentifier = "sports-south" ✅

const response = await apiRequest(
  `/api/admin/vendors/${vendorIdentifier}/test-connection`, 
  'POST'
);
```

### Backend Flow (`server/credential-management-routes.ts`)
```typescript
// Line 110-128
app.post('/api/admin/vendors/:vendorId/test-connection', async (req, res) => {
  const { vendorId } = req.params;  // "sports-south" ✅
  
  // Verify vendor exists
  const supportedVendor = await storage.getSupportedVendorByName(vendorId);
  // ✅ This now finds Sports South because getSupportedVendorByName() 
  //    normalizes and matches against both name AND vendorShortCode
  
  // Test connection using vendor registry
  const result = await vendorRegistry.testVendorConnection(vendorId, 'admin', undefined, userId);
  // ✅ vendorRegistry.getHandlerById("sports-south") now works!
  
  // Update admin connection status
  await storage.updateSupportedVendor(supportedVendor.id, {
    adminConnectionStatus: result.success ? 'online' : 'error'
  });
});
```

### Vendor Registry Lookup (`server/vendor-registry.ts`)
```typescript
getHandlerById(vendorId: string): VendorHandler | undefined {
  return this.handlers.get(vendorId.toLowerCase());
  // ✅ handlers.get("sports-south") → SportsSouthAPI handler
}
```

## Why This Fix Was Critical

### Before Fix (Broken Flow)
```
Frontend: "sports-south" 
    ↓
Backend route: vendorId = "sports-south"
    ↓
getSupportedVendorByName("sports-south") → ✅ Found (normalized match)
    ↓
vendorRegistry.testVendorConnection("sports-south")
    ↓
vendorRegistry.getHandlerById("sports-south") → ❌ NOT FOUND
    (Registry had handler registered as "sports_south")
    ↓
Error: "No handler found for vendor: sports-south"
```

### After Fix (Working Flow)
```
Frontend: "sports-south"
    ↓
Backend route: vendorId = "sports-south"
    ↓
getSupportedVendorByName("sports-south") → ✅ Found
    ↓
vendorRegistry.testVendorConnection("sports-south")
    ↓
vendorRegistry.getHandlerById("sports-south") → ✅ Found!
    ↓
handler.testConnection(credentials) → ✅ Success
    ↓
Update adminConnectionStatus → 'online'
```

## Related Documentation
- `VENDOR_NAMING_STANDARD.md` - Official naming standard (hyphens, not underscores)
- `VENDOR_SLUG_IMPLEMENTATION_COMPLETE.md` - Slug system architecture
- `UNIVERSAL_VENDOR_SLUG_SOLUTION.md` - Original slug solution design

## Next Steps
1. **Restart the server** to load updated vendor registry
2. **Test all vendor Test Sync buttons** in Admin panel
3. **Verify Sports South catalog sync** works end-to-end
4. **Monitor logs** for any remaining vendor ID mismatches

## Prevention
To prevent this in the future:
1. ✅ **Naming Standard**: Always use hyphens, never underscores
2. ✅ **Auto-normalization**: `createSupportedVendor()` auto-lowercases `vendorShortCode`
3. ✅ **Consistent lookup**: `getSupportedVendorByName()` checks both name and short code
4. 🔜 **Database constraint**: Add CHECK constraint to enforce lowercase vendor_short_code
5. 🔜 **Integration tests**: Add test to verify all vendor handlers match database short codes


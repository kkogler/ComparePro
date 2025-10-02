# Lipsey's Store-Level Credentials Fix - Complete Summary

## Problem Statement
Store-level credentials for Lipsey's were not persisting when the configuration modal was closed and reopened. The username field would show as 'missing' even though credentials were successfully saved.

## Root Cause Analysis

### Admin-Level vs Store-Level Architecture

**Admin-Level Credentials (Working):**
```
Frontend → /api/admin/vendors/:vendorId/credentials
Backend  → credentialVault.storeAdminCredentials()
Database → supported_vendors.adminCredentials JSON field
Storage  → Direct JSON storage (no field mapping)
```

**Store-Level Credentials (Was Broken):**
```
Frontend → /org/:slug/api/vendors/:vendorSlug/credentials
Backend  → credentialVault.storeStoreCredentials()
         → storage.saveCompanyVendorCredentials()
         → FIELD MAPPING LAYER ❌ (missing email mapping)
Database → company_vendor_credentials table with typed columns
```

**The Key Difference:**
- **Admin credentials**: Stored as pure JSON `{ email, password }` - no transformation
- **Store credentials**: Go through field mapping layer to map to database columns
- **The Problem**: Mapping layer didn't know `email` field maps to `userName` column

## Fixes Implemented

### 1. Storage Layer - Save Operation
**File:** `server/storage.ts:2423-2432`

**Before:**
```typescript
if (credentials.user_name !== undefined) mappedCredentials.userName = credentials.user_name;
if (credentials.email !== undefined) mappedCredentials.userName = credentials.email; // Would overwrite!
```

**After:**
```typescript
// Priority: email > user_name (Lipsey's uses email, Sports South uses user_name)
if (credentials.email !== undefined) {
  mappedCredentials.userName = credentials.email;
  console.log('💾 STORAGE: Mapped email to userName:', credentials.email);
} else if (credentials.user_name !== undefined) {
  mappedCredentials.userName = credentials.user_name;
  console.log('💾 STORAGE: Mapped user_name to userName:', credentials.user_name);
}
```

**What this fixes:**
- Prevents field overwriting when both fields exist
- Prioritizes `email` for Lipsey's
- Adds debug logging to track mapping

### 2. Credential Vault - Retrieval Operation
**File:** `server/credential-vault-service.ts:623-641`

**Added:**
```typescript
// ✅ LIPSEY'S: Map userName ↔ email (Lipsey's uses email as username)
if (vendorId.toLowerCase().includes('lipsey')) {
  console.log('🔧 LIPSEYS: Applying field aliases');
  
  // Map database userName field back to email for frontend
  if (result['userName'] && !result['email']) {
    result['email'] = result['userName'];
    console.log('🔧 ALIAS: userName → email');
  }
  // Also support reverse mapping
  if (result['email'] && !result['userName']) {
    result['userName'] = result['email'];
    console.log('🔧 ALIAS: email → userName');
  }
}
```

**What this fixes:**
- Bidirectional field mapping: `userName` (DB) ↔ `email` (Frontend)
- Ensures retrieved `userName` from database is returned as `email` to frontend
- Maintains compatibility with Lipsey's API which expects `email` field

### 3. Database Schema Update
**File:** Database `supported_vendors` table, ID=3

**Before:**
```json
{
  "name": "email",
  "type": "email",
  "label": "Email",
  "required": true
}
```

**After:**
```json
{
  "name": "email",
  "type": "text",
  "label": "Username",
  "required": true
}
```

**What this fixes:**
- Correct label: "Username" (not "Email")
- Correct type: "text" (allows any username format, not just email)
- Maintains consistency between database schema and UI

### 4. Frontend Form Updates
**File:** `client/src/components/LipseyConfig.tsx:243-251`

**Changes:**
```typescript
<Label htmlFor="email">Username</Label>  // Was: "Email Address"
<Input
  type="text"                             // Was: type="email"
  placeholder="Enter username"            // Was: "dealer@yourstore.com"
  ...
/>
```

**What this fixes:**
- Correct field label for users
- Accepts any username format (not just email format validation)
- Better user experience with clear placeholder

## Data Flow After Fix

### Save Operation:
```
1. User enters: { email: "dealer@store.com", password: "pass123" }
2. Frontend sends: POST /org/demo-gun-store/api/vendors/lipseys/credentials
3. Backend receives: { email: "dealer@store.com", password: "pass123" }
4. Storage maps: email → userName
5. Database stores: userName="dealer@store.com", password="pass123"
6. Success ✅
```

### Load Operation:
```
1. Frontend requests: GET /org/demo-gun-store/api/vendors/lipseys/credentials
2. Backend retrieves: userName="dealer@store.com", password="pass123"
3. Vault applies aliases: userName → email
4. Vault redacts: { email: "dealer@store.com", password: "••••••••" }
5. Frontend displays: Username field shows "dealer@store.com" ✅
```

## Testing Verification

### Console Output to Expect:

**On Save:**
```
💾 STORAGE: Saving company vendor credentials
💾 STORAGE: Mapped email to userName: dealer@store.com
✅ Store credentials stored for vendor: lipseys, company: 5
```

**On Load:**
```
🔧 LIPSEYS: Applying field aliases
🔧 ALIAS: userName → email
🔍 CREDENTIAL DEBUG: Aliased fields for lipseys: email, password
```

### Database Verification:
```sql
SELECT userName, password 
FROM company_vendor_credentials 
WHERE supportedVendorId = 3 AND companyId = 5;

-- Should return:
-- userName: "dealer@store.com"
-- password: "pass123"
```

## Why Admin Credentials Worked But Store Didn't

| Aspect | Admin Credentials | Store Credentials |
|--------|------------------|-------------------|
| Storage | JSON field (direct) | Typed table columns |
| Mapping | None (stored as-is) | Field mapping layer |
| Retrieval | Direct JSON access | Column to field mapping |
| Issue | ✅ No transformation | ❌ Missing email mapping |

The admin credentials worked because they're stored as pure JSON without any field transformation. Store credentials go through a mapping layer that didn't know about the `email` field.

## Files Modified

1. ✅ `server/storage.ts` - Added email → userName mapping with priority
2. ✅ `server/credential-vault-service.ts` - Added bidirectional field aliasing for Lipsey's
3. ✅ `client/src/components/LipseyConfig.tsx` - Updated label and input type
4. ✅ Database `supported_vendors` table - Updated credential field schema

## Deployment Notes

- ✅ Server restart required for backend changes
- ✅ Frontend rebuild will happen automatically
- ✅ Database schema updated (no migration needed - JSON field update)
- ✅ Existing credentials will work after fix (backward compatible)

## Related Vendors

This fix is specific to Lipsey's which uses `email` as the username field. Other vendors use different fields:

- **Sports South**: Uses `user_name` and `customer_number` (already working)
- **Chattanooga**: Uses `sid` and `token` (already working)
- **Bill Hicks**: Uses FTP credentials with different field names (already working)

The fix maintains compatibility with all existing vendors while adding proper support for Lipsey's.


# Lipsey's Store Credentials - Final Fix Applied

## **Issue Identified**

The credentials were being saved correctly but not retrieved properly. The problem was in the `getRedactedCredentials()` method.

## **Root Cause**

**Two separate code paths existed:**

1. **`getStoreCredentials()`** (Used by Test Connection)
   - ✅ Had field aliasing: `userName` → `email`
   - ✅ Working correctly

2. **`getRedactedCredentials()`** (Used by frontend to load credentials)
   - ❌ Missing field aliasing
   - ❌ Looked for `email` field directly in database results
   - ❌ Database has `userName`, not `email`
   - Result: Field shows as 'missing'

## **The Fix**

**File:** `server/credential-vault-service.ts:792-796`

**Added field aliasing to `getRedactedCredentials()` for store-level credentials:**

```typescript
storedCredentials = await storage.getCompanyVendorCredentials(companyId, supportedVendor.id);

// ✅ FIX: Apply field aliases for store credentials (userName → email for Lipsey's)
if (storedCredentials) {
  storedCredentials = await this.applyFieldAliases(vendorId, storedCredentials);
  console.log('🔧 REDACTED CREDS: Applied field aliases for', vendorId, 'Fields:', Object.keys(storedCredentials));
}
```

## **How It Works Now**

### **Save Flow:**
```
1. User enters: { email: "dealer@example.com", password: "pass123" }
2. Frontend sends to: /org/demo-gun-store/api/vendors/lipseys/credentials
3. Backend maps: email → userName
4. Database stores: userName="dealer@example.com", password="pass123"
   Console: "💾 STORAGE: Mapped email to userName: dealer@example.com"
```

### **Load Flow (FIXED):**
```
1. Frontend requests: GET /org/demo-gun-store/api/vendors/lipseys/credentials
2. Backend retrieves from DB: { userName: "dealer@example.com", password: "pass123" }
3. applyFieldAliases() maps: userName → email
   Console: "🔧 REDACTED CREDS: Applied field aliases for lipseys"
4. Result: { email: "dealer@example.com", userName: "...", password: "pass123" }
5. Redaction: { email: "dealer@example.com", password: "••••••••" }
6. Frontend displays: Username field = "dealer@example.com" ✅
```

## **Complete Fix Summary**

### **All Changes Made:**

1. ✅ **Storage Layer** (`server/storage.ts:2425-2431`)
   - Maps `email` → `userName` when saving

2. ✅ **Field Aliasing** (`server/credential-vault-service.ts:627-641`)
   - Bidirectional mapping: `userName` ↔ `email`

3. ✅ **Redacted Credentials** (`server/credential-vault-service.ts:792-796`) **← NEW FIX**
   - Applies field aliasing when retrieving for display

4. ✅ **Database Schema** (updated via script)
   - Label: "Username" (not "Email")
   - Type: "text" (not "email")

5. ✅ **Frontend Form** (`client/src/components/LipseyConfig.tsx`)
   - Label: "Username"
   - Input type: "text"

## **Testing Steps**

### **1. Clear Any Existing Test Data**
```sql
DELETE FROM company_vendor_credentials 
WHERE supportedVendorId = 3 AND companyId = 5;
```

### **2. Save New Credentials**
1. Go to Store → Supported Vendors → Lipsey's
2. Click "Configure"
3. Enter username: `test@example.com`
4. Enter password: `testpass123`
5. Click "Save Credentials"

**Expected Console Output:**
```
💾 STORAGE: Saving company vendor credentials
💾 STORAGE: Mapped email to userName: test@example.com
✅ Store credentials stored for vendor: lipseys, company: 5
```

### **3. Verify Database Storage**
```sql
SELECT id, companyId, supportedVendorId, userName, password 
FROM company_vendor_credentials 
WHERE supportedVendorId = 3;
```

**Expected Result:**
```
userName: "test@example.com"
password: "testpass123"
```

### **4. Test Credential Retrieval**
1. Close the Lipsey's modal
2. Reopen it by clicking "Configure"

**Expected Console Output:**
```
🔧 LIPSEYS: Applying field aliases
🔧 ALIAS: userName → email
🔧 REDACTED CREDS: Applied field aliases for lipseys Fields: userName, email, password
```

**Expected UI:**
- Username field shows: `test@example.com` ✅
- Password field shows: empty (security) ✅

### **5. Test Connection**
1. Click "Test Connection" button
2. Should use stored credentials
3. Success or failure message appears

**Expected Console Output:**
```
🔍 LIPSEY TEST: Starting connection test
🔧 LIPSEYS: Applying field aliases
🔧 ALIAS: userName → email
```

## **What Was Missing**

The previous implementation had field aliasing in `getStoreCredentials()` but **NOT** in `getRedactedCredentials()`.

- `getStoreCredentials()` is used by Test Connection ✅
- `getRedactedCredentials()` is used by the frontend form ❌ (was missing)

Both code paths now have field aliasing applied, ensuring credentials are properly mapped in all scenarios.

## **Files Modified (Complete List)**

1. `server/storage.ts:2425-2431` - Save mapping
2. `server/credential-vault-service.ts:627-641` - Field aliasing function
3. `server/credential-vault-service.ts:792-796` - Apply aliasing in getRedactedCredentials (**NEW**)
4. `client/src/components/LipseyConfig.tsx:243-251` - Frontend form
5. Database `supported_vendors` table - Credential schema

## **Deployment**

1. Server restart required (backend changes)
2. Frontend will rebuild automatically
3. No database migration needed (JSON field updates only)
4. Backward compatible with existing credentials

---

**Status:** ✅ **COMPLETE - Ready for Testing**


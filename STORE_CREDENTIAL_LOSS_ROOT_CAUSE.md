# Store Credential Loss - Root Cause Analysis & Fix

## Problem

Store-level vendor credentials (Bill Hicks, Chattanooga, Sports South, etc.) are not saving reliably or are being lost when other vendors are configured. Users are spending hours re-entering credentials.

## Root Cause

After extensive code review, I've identified **THREE CRITICAL ISSUES**:

### Issue #1: onConflictDoUpdate Overwrites ALL Fields

**Location**: `server/storage.ts:2611-2618`

```typescript
const [result] = await db
  .insert(companyVendorCredentials)
  .values(saveData)
  .onConflictDoUpdate({
    target: [companyVendorCredentials.companyId, companyVendorCredentials.supportedVendorId],
    set: saveData  // ❌ THIS OVERWRITES EVERYTHING, INCLUDING NULL VALUES
  })
  .returning();
```

**What's happening:**
- When saving Bill Hicks credentials, the `saveData` object contains Bill Hicks fields (ftpServer, ftpUsername, etc.)
- But it does NOT contain Chattanooga fields (sid, token, etc.) - those are `undefined`
- `onConflictDoUpdate` with `set: saveData` **overwrites ALL columns** with the new data
- Fields that are `undefined` in `saveData` get set to `NULL` in the database
- This **WIPES OUT** credentials for other vendors on the same row

**Example:**
1. User saves Chattanooga credentials → `sid: "123", token: "abc"` saved to DB
2. User saves Bill Hicks credentials → `ftpServer: "ftp.example.com", ftpUsername: "user"` 
3. The `saveData` has `sid: undefined, token: undefined` (not set)
4. `onConflictDoUpdate` sets `sid = NULL, token = NULL` in the database
5. Chattanooga credentials are **GONE**

### Issue #2: JSON Column "credentials" is Overwritten Entirely

**Location**: `server/storage.ts:2567`

```typescript
const saveData: any = {
  companyId: companyId,
  supportedVendorId: supportedVendorId,
  credentials: credentialFields,  // ❌ This REPLACES the entire JSON object
  ...operationalFields
};
```

**What's happening:**
- The `credentials` JSON column is designed to store ALL vendor credentials
- But each save operation **REPLACES** the entire JSON object with only the current vendor's fields
- There's no merging with existing JSON data
- This causes the same credential loss as Issue #1, but in the JSON column

### Issue #3: Incorrect Composite Key Design

**The Real Problem:**
The table uses `(companyId, supportedVendorId)` as a composite unique key. This means:
- **One row per company + vendor combination**
- Bill Hicks credentials go in one row
- Chattanooga credentials go in a different row
- Sports South credentials go in yet another row

**But the code is treating it as if:**
- One row per company
- All vendor credentials in the same row's JSON column

**The Mismatch:**
- Database schema: **One row per vendor** (correct design for security and separation)
- Code behavior: Tries to store **multiple vendors in one row** (incorrect)

## Why This is So Confusing

The system has **TWO storage patterns** mixed together:

1. **Legacy Columns** (ftpServer, ftpUsername, sid, token, etc.)
   - Designed for one vendor per row
   - Works correctly for isolation

2. **New JSON Column** ("credentials")
   - Added later for flexibility
   - Being used incorrectly as if it holds multiple vendors

## Impact

- **Every vendor save operation risks wiping out other vendors' credentials**
- **Affects all multi-vendor stores** (dozens of stores × dozens of vendors = major data loss risk)
- **No atomic safety** - credentials are constantly at risk

## Solution

### Option A: Fix the JSON Merging (Quick Fix)

Modify `saveCompanyVendorCredentials` to:
1. Load existing credentials for this vendor
2. Merge new credentials with existing
3. Only update changed fields

**Pros:**  
- Quick to implement
- Maintains current schema

**Cons:**  
- Still complex with two storage systems
- Legacy columns still overwrite

### Option B: Proper Per-Vendor Rows (Recommended)

Keep the current schema (one row per vendor) but:
1. Remove the JSON "credentials" column (it's confusing and redundant)
2. Use only legacy columns (already vendor-specific)
3. Add new columns as needed per vendor
4. **Never share rows between vendors**

**Pros:**  
- Clean, simple design
- Database-level isolation
- No credential mixing
- Easier to audit

**Cons:**  
- Need to add columns for new vendors (acceptable tradeoff)

### Option C: Separate Tables Per Vendor (Enterprise)

Create separate tables:
- `bill_hicks_credentials`
- `chattanooga_credentials`
- `sports_south_credentials`

**Pros:**  
- Complete isolation
- Vendor-specific validation
- Easiest to understand

**Cons:**  
- Most code changes
- More tables to manage

## Recommended Fix: Option A (Immediate) + Option B (Long-term)

### Phase 1: Emergency Fix (Now)

**File**: `server/storage.ts:2500-2622`

Change the `onConflictDoUpdate` to only update provided fields:

```typescript
// Build the update object (only include non-undefined fields)
const updateFields: any = {};

if (saveData.credentials !== undefined) updateFields.credentials = saveData.credentials;
if (saveData.ftpServer !== undefined) updateFields.ftpServer = saveData.ftpServer;
if (saveData.ftpPort !== undefined) updateFields.ftpPort = saveData.ftpPort;
if (saveData.ftpUsername !== undefined) updateFields.ftpUsername = saveData.ftpUsername;
if (saveData.ftpPassword !== undefined) updateFields.ftpPassword = saveData.ftpPassword;
if (saveData.ftpBasePath !== undefined) updateFields.ftpBasePath = saveData.ftpBasePath;
if (saveData.userName !== undefined) updateFields.userName = saveData.userName;
if (saveData.password !== undefined) updateFields.password = saveData.password;
if (saveData.source !== undefined) updateFields.source = saveData.source;
if (saveData.customerNumber !== undefined) updateFields.customerNumber = saveData.customerNumber;
if (saveData.apiKey !== undefined) updateFields.apiKey = saveData.apiKey;
if (saveData.apiSecret !== undefined) updateFields.apiSecret = saveData.apiSecret;
if (saveData.sid !== undefined) updateFields.sid = saveData.sid;
if (saveData.token !== undefined) updateFields.token = saveData.token;

// Always update these fields
updateFields.updatedAt = new Date();
if (saveData.catalogSyncEnabled !== undefined) updateFields.catalogSyncEnabled = saveData.catalogSyncEnabled;
if (saveData.catalogSyncSchedule !== undefined) updateFields.catalogSyncSchedule = saveData.catalogSyncSchedule;
if (saveData.inventorySyncEnabled !== undefined) updateFields.inventorySyncEnabled = saveData.inventorySyncEnabled;
if (saveData.inventorySyncSchedule !== undefined) updateFields.inventorySyncSchedule = saveData.inventorySyncSchedule;

const [result] = await db
  .insert(companyVendorCredentials)
  .values(saveData)
  .onConflictDoUpdate({
    target: [companyVendorCredentials.companyId, companyVendorCredentials.supportedVendorId],
    set: updateFields  // ✅ Only update provided fields
  })
  .returning();
```

### Phase 2: Clean Up (Next Sprint)

1. Remove the JSON "credentials" column (it's causing confusion)
2. Standardize on legacy columns only
3. Add columns as needed per vendor
4. Update documentation to clarify one-row-per-vendor design

## Testing Plan

### Test Case 1: Multi-Vendor Save
1. Save Chattanooga credentials
2. Verify Chattanooga credentials are saved
3. Save Bill Hicks credentials
4. Verify BOTH Chattanooga AND Bill Hicks credentials still exist
5. Save Sports South credentials
6. Verify ALL THREE vendors' credentials still exist

### Test Case 2: Credential Update
1. Save Bill Hicks with password "test123"
2. Update Bill Hicks with new password "test456"
3. Verify password updated but other fields unchanged

### Test Case 3: Multiple Stores
1. Store A: Save Bill Hicks credentials
2. Store B: Save Bill Hicks credentials (different values)
3. Verify Store A credentials unchanged
4. Verify Store B credentials saved correctly

## Long-Term Maintainability

To prevent future credential loss:

1. **Add database constraints**: NOT NULL on critical fields
2. **Add audit logging**: Track all credential changes with before/after values
3. **Add automated tests**: Test multi-vendor saves
4. **Add UI warnings**: Warn users before any credential update
5. **Add backup/restore**: Allow users to restore previous credentials
6. **Simplify architecture**: Remove hybrid JSON approach

## Priority

**CRITICAL** - This affects production data and user trust. Every configuration change risks data loss.

## Estimated Time to Fix

- Phase 1 (Emergency Fix): **2 hours** - Fix onConflictDoUpdate logic
- Testing: **1 hour** - Verify multi-vendor saves work
- Phase 2 (Clean Up): **4 hours** - Remove JSON column, update docs

**Total: 7 hours for complete fix**



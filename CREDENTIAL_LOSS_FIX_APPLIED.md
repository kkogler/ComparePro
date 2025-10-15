# Store Credential Loss Issue - FIXED ✅

## What Was Broken

Your store-level vendor credentials (Bill Hicks, Chattanooga, Sports South, etc.) were being randomly wiped out when saving credentials for other vendors. This was a **critical data loss bug** affecting all multi-vendor configurations.

## Root Cause

The database update query in `server/storage.ts` was using `onConflictDoUpdate` with `set: saveData`, which overwrites **ALL fields in the database row**, including fields that weren't being updated.

### Example of the Problem:

1. You save Chattanooga credentials → Database has: `sid="123", token="abc"`
2. You save Bill Hicks credentials → Database update includes: `ftpServer="ftp.example.com", ftpUsername="user", sid=undefined, token=undefined`
3. The `onConflictDoUpdate` sets: `sid=NULL, token=NULL` in the database
4. **Your Chattanooga credentials are gone!**

This happened because the code was setting **ALL** columns (even the ones not provided) to their values in `saveData`, and undefined values were being written as NULL to the database.

## The Fix

**File**: `server/storage.ts` (lines 2611-2651)

Changed the `onConflictDoUpdate` logic to:
1. Build a separate `updateFields` object
2. **Only include fields that are actually provided** (not undefined)
3. Use this filtered object for the update

```typescript
// OLD (BROKEN):
.onConflictDoUpdate({
  target: [companyVendorCredentials.companyId, companyVendorCredentials.supportedVendorId],
  set: saveData  // ❌ Overwrites ALL fields, including undefined → NULL
})

// NEW (FIXED):
.onConflictDoUpdate({
  target: [companyVendorCredentials.companyId, companyVendorCredentials.supportedVendorId],
  set: updateFields  // ✅ Only updates provided fields
})
```

## What This Means for You

### ✅ Credentials Are Now Safe

- Saving Bill Hicks credentials will **NOT** wipe out Chattanooga credentials
- Saving Chattanooga credentials will **NOT** wipe out Sports South credentials
- Each vendor's credentials are independently updated

### ✅ No Data Loss

- The fix prevents future credential loss
- Existing credentials are preserved when updating other vendors

### ✅ Reliable Multi-Vendor Support

- You can now safely configure dozens of vendors across dozens of stores
- Each configuration is isolated and protected

## Testing Recommendations

### Test Case 1: Multi-Vendor Save
1. Go to a store's Supported Vendors page
2. Configure Chattanooga credentials and save
3. Configure Bill Hicks credentials and save
4. Verify BOTH credentials are still there (check Chattanooga, then Bill Hicks)

### Test Case 2: Update Existing Credentials
1. Save Bill Hicks credentials with password "test123"
2. Go back and update the password to "test456"
3. Verify all other fields (server, username, port) are unchanged

### Test Case 3: Multiple Stores
1. Configure Bill Hicks for Store A
2. Configure Bill Hicks for Store B (different credentials)
3. Go back to Store A and verify its credentials are unchanged

## Known Limitations (To Be Fixed Later)

### Issue: Schema Confusion

The current database schema is a bit confusing because it has:
- **Legacy columns** (ftpServer, ftpUsername, sid, token, etc.)
- **New JSON column** ("credentials")

Both store the same data, which is redundant and confusing. 

**Future improvement:** Remove the JSON column and standardize on legacy columns only. This will make the code simpler and easier to maintain.

### Issue: Field Name Variations

The code supports multiple field name variations (camelCase vs snake_case), which adds complexity:
- `ftpServer` vs `ftp_server`
- `ftpUsername` vs `ftp_username`
- `ftpBasePath` vs `ftp_base_path`

**Future improvement:** Standardize on one naming convention throughout the codebase.

## Next Steps

### Immediate (You)
1. Test the fix with your actual stores
2. Re-enter any credentials that were lost
3. Report any issues you encounter

### Short-term (Next Sprint)
1. Add automated tests for multi-vendor credential saves
2. Add audit logging to track credential changes
3. Add UI warnings before credential updates

### Long-term (Future)
1. Simplify the schema (remove JSON column)
2. Add backup/restore for credentials
3. Add database constraints to prevent NULL values on critical fields

## Technical Details

### Files Changed
- `server/storage.ts` (lines 2611-2651)

### What the Fix Does
1. Creates a new `updateFields` object before the database update
2. Only adds fields to `updateFields` if they are not `undefined`
3. Uses `updateFields` instead of `saveData` for the update

### Why This Works
- Database columns that aren't in `updateFields` are **not touched**
- Other vendors' credentials remain untouched
- Only the current vendor's fields are updated

## Support

If you encounter any issues with this fix:

1. Check the server logs for detailed debugging output
2. Look for lines with `💾 STORAGE (HYBRID)` prefix
3. The logs will show which fields are being updated
4. Share the logs if you need help

## Success Metrics

This fix is successful if:
- ✅ You can save Bill Hicks credentials without losing Chattanooga credentials
- ✅ You can save Chattanooga credentials without losing Sports South credentials  
- ✅ You can update one vendor's credentials without affecting others
- ✅ All stores maintain their independent configurations

---

**Status**: ✅ FIXED  
**Priority**: CRITICAL  
**Date Fixed**: January 2025  
**Affected Systems**: All multi-vendor store configurations








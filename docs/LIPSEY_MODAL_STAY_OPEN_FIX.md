# Lipsey's Credentials Modal - Keep Open After Save

**Date:** October 15, 2025  
**Issue:** Modal closes automatically after saving credentials  
**Status:** ✅ Fixed  

---

## Problem

In **Store > Supported Vendors > Lipsey's**, when editing credentials:

1. User opens the modal
2. User enters/edits credentials
3. User clicks **"Save Credentials"**
4. ❌ **Modal closes automatically**
5. User has to reopen the modal to click **"Test Connection"**

This creates a poor user experience, requiring multiple clicks to perform the common workflow: save → test.

---

## Solution

Modified the `handleSave` function to **keep the modal open** after successfully saving credentials.

### Changes Made

**File:** `client/src/components/LipseyConfig.tsx` (line 210)

#### Before:
```typescript
if (response.ok) {
  toast({
    title: "Credentials Saved",
    description: "Lipsey's API credentials have been saved successfully.",
  });
  
  setHasExistingCredentials(true);
  onSuccess?.();
  onOpenChange(false);  // ❌ This closes the modal
}
```

#### After:
```typescript
if (response.ok) {
  toast({
    title: "Credentials Saved",
    description: "Lipsey's API credentials have been saved successfully. You can now test the connection.",
  });
  
  setHasExistingCredentials(true);
  onSuccess?.();
  // Modal stays open so user can test connection ✅
}
```

---

## User Workflow (After Fix)

1. ✅ User opens Lipsey's credentials modal
2. ✅ User enters/edits username and password
3. ✅ User clicks **"Save Credentials"**
   - Success toast appears: "Credentials saved. You can now test the connection."
   - **Modal remains open** ✅
4. ✅ User clicks **"Test Connection"** button (no need to reopen)
5. ✅ Connection test runs and displays result
6. ✅ User clicks **"Cancel"** to close modal when done

---

## Benefits

1. ✅ **Better UX** - No need to reopen the modal
2. ✅ **Faster workflow** - Save and test in one session
3. ✅ **Clearer intent** - Toast message guides user to test connection
4. ✅ **Consistent with best practices** - Modal only closes on explicit user action (Cancel/X)

---

## Consistent with Other Modals

This behavior now matches other vendor credential modals like:
- Sports South Config
- Chattanooga Config  
- Bill Hicks Config

All of these keep the modal open after saving to allow immediate testing.

---

## Testing

1. Go to **Store > Supported Vendors**
2. Click **Lipsey's**
3. Enter credentials
4. Click **"Save Credentials"**
5. ✅ Verify modal **stays open**
6. ✅ Verify toast says "You can now test the connection"
7. Click **"Test Connection"**
8. ✅ Verify test runs without reopening modal
9. Click **"Cancel"** to close

---

## Files Changed

- `client/src/components/LipseyConfig.tsx` - Removed automatic modal close on save


# Quick Error Reference

## Your Current Errors Explained

### Error 1: 401 (Unauthorized)
```
Failed to load resource: the server responded with a status of 401 ()
```

**What's happening:**
- An API endpoint requires authentication/authorization
- You're either not logged in or not logged in as an admin user

**Immediate fix:**
1. Open browser console and check authentication:
   ```javascript
   fetch('/api/admin/user')
     .then(r => r.json())
     .then(console.log);
   ```
2. If not authenticated, log in as admin user
3. Admin users must have `companyId: null` in the database

---

### Error 2: 500 on `/api/admin/supported-vendors/4`
```
/api/admin/supported-vendors/4:1  Failed to load resource: the server responded with a status of 500 ()
```

**What's happening:**
- Server-side exception in the PATCH endpoint for updating a supported vendor
- The error is being caught but details weren't being logged properly

**What I fixed:**
✅ **Enhanced error logging** in `/server/routes.ts`
- Now logs full error message and stack trace
- Logs request parameters (vendor ID, update keys)
- Returns error details in development mode

**How to debug now:**

1. **Check browser console** - In development, you'll now see the actual error message in the API response

2. **Check server logs:**
   ```bash
   tail -f logs/web-error.log
   # Or check the terminal where the server is running
   ```

3. **Look for these in logs:**
   ```
   === PATCH SUPPORTED VENDOR START ===
   Vendor ID: 4
   Updates keys: [...]
   Error updating supported vendor: <actual error>
   Error details: {
     message: "...",
     stack: "...",
     vendorId: 4,
     updateKeys: [...]
   }
   ```

4. **Test with curl to see full error:**
   ```bash
   curl -X PATCH http://localhost:5000/api/admin/supported-vendors/4 \
     -H "Content-Type: application/json" \
     -H "Cookie: connect.sid=<your-session-cookie>" \
     -d '{"name":"Test"}' \
     | jq .
   ```

---

### Error 3: Uppy Instance Messages (Informational)
```
MODAL: Creating Uppy instance
MODAL: Uppy instance created, adding AwsS3 plugin
MODAL: Uppy instance fully configured
MODAL: showModal state changed to: false
```

**What's happening:**
- These are **not errors** - they're informational console logs
- Uppy is your file upload library initializing correctly
- The logs show the upload modal is working as expected

**No action needed** unless uploads are actually failing.

---

## Common Root Causes for 500 Errors

### 1. Database Field Type Mismatch
```javascript
// ❌ Wrong
{ productRecordPriority: "5" }  // String instead of number

// ✅ Correct
{ productRecordPriority: 5 }
```

### 2. Invalid Priority Value
```javascript
// ❌ Wrong - priority out of range or already taken
{ productRecordPriority: 999 }

// ✅ Correct - must be 1 to N (where N = total vendors)
{ productRecordPriority: 5 }
```

### 3. Missing Required Fields
```javascript
// Some fields might be required depending on vendor state
// Check server logs for "NOT NULL constraint" errors
```

### 4. Retail Vertical Assignment Issues
```javascript
// If you're updating retail verticals
{
  retailVerticalIds: [1, 2, 3]  // Array of valid retail vertical IDs
}
```

---

## Quick Debugging Steps

**Step 1:** Check authentication
```javascript
// Run in browser console
fetch('/api/admin/user').then(r => r.json()).then(console.log);
```

**Step 2:** Check if vendor exists
```javascript
fetch('/api/admin/supported-vendors/4')
  .then(r => r.json())
  .then(console.log);
```

**Step 3:** Try a minimal update
```javascript
fetch('/api/admin/supported-vendors/4', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test Vendor Update' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Step 4:** Check server terminal for detailed error logs

---

## Next Steps

1. **Restart server** to load the new error handling:
   ```bash
   npm run dev
   # or
   ./restart-server.sh
   ```

2. **Try the failing request again** - you should now see detailed error information

3. **Check server logs** - look for the enhanced error details

4. **Report back** with the actual error message from the logs if still failing

---

## Files Modified

- ✅ `/server/routes.ts` - Enhanced error logging for supported vendor endpoints
- ✅ `/DEBUGGING_GUIDE.md` - Comprehensive debugging documentation
- ✅ `/ERROR_REFERENCE.md` - This quick reference guide

The enhanced error handling will help identify the exact cause of the 500 errors!


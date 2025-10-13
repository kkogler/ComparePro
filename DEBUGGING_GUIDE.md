# Debugging Guide for API Errors

## Understanding the Console Errors

### 401 Errors (Unauthorized)
**What it means:** Authentication or authorization failure

**Common causes:**
1. **Not logged in** - Session expired or user not authenticated
2. **Insufficient permissions** - User is not an admin (for `/api/admin/*` endpoints)
3. **Session cookie issues** - Cookie not being sent with request

**How to debug:**
```javascript
// In browser console, check authentication status
fetch('/api/admin/user')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**Solutions:**
- Log in again as an admin user
- Check that cookies are enabled
- Verify admin user has `companyId: null` in database
- Check browser dev tools → Application → Cookies

### 500 Errors (Internal Server Error)
**What it means:** Server-side exception occurred

**Where to look:**
1. **Server console logs** - Check terminal where server is running
2. **Log files** - Check `/home/runner/workspace/logs/*.log`
3. **Network tab** - Check response body for error details (in development)

**How to debug:**

#### 1. Check Server Logs
```bash
# View recent errors
tail -f logs/web-error.log

# Or check server console output directly
```

#### 2. Check Network Tab
- Open browser Dev Tools → Network
- Click on the failed request
- Look at "Response" tab for error details
- In development mode, you'll see the actual error message

#### 3. Enable Detailed Logging
The error handler now logs:
- Error message
- Stack trace
- Request parameters
- Update keys being sent

#### 4. Test the API Directly
```javascript
// Test in browser console
fetch('/api/admin/supported-vendors/4', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    // Your update data
    name: 'Test Vendor'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## Common Issues with `/api/admin/supported-vendors/:id`

### Issue 1: Priority Validation Errors
**Symptoms:** 400 or 500 error when updating vendor priority

**Causes:**
- Priority value outside valid range (1-N where N is total vendors)
- Priority already assigned to another vendor
- NULL priority value

**Solution:**
```javascript
// Check current vendors and priorities
fetch('/api/admin/supported-vendors')
  .then(r => r.json())
  .then(vendors => {
    console.log('Total vendors:', vendors.length);
    console.log('Priorities:', vendors.map(v => ({ name: v.name, priority: v.productRecordPriority })));
  });
```

### Issue 2: Database Constraint Violations
**Symptoms:** 500 error with database constraint error in logs

**Common causes:**
- Duplicate unique values (e.g., `vendorShortCode`)
- Foreign key constraint violations
- NOT NULL constraint violations

**Solution:** Check the error message in server logs for specific constraint

### Issue 3: Invalid Update Fields
**Symptoms:** 500 error, possibly with type errors

**Causes:**
- Sending fields that don't exist in schema
- Wrong data types (e.g., string instead of number)
- Invalid JSON structure

**Solution:**
```javascript
// Valid supported vendor update fields:
const validUpdates = {
  name: "string",
  slug: "string",
  vendorShortCode: "string",
  logoUrl: "string | null",
  apiType: "string",
  productRecordPriority: "number",
  adminCredentials: "object",
  retailVerticalIds: "number[]",
  // ... see schema for full list
};
```

## Uppy Upload Errors

The "MODAL: Creating Uppy instance" messages are informational, not errors. However, if uploads fail:

### Check S3 Configuration
```javascript
// In browser console
console.log('Checking S3 config...');
// S3 credentials should be configured server-side
```

### Common Upload Issues:
1. **CORS issues** - S3 bucket CORS not configured
2. **Credentials expired** - Presigned URL expired
3. **File size limits** - File too large
4. **Network issues** - Slow connection or timeout

## Quick Diagnostic Checklist

- [ ] Check browser console for full error messages
- [ ] Check Network tab for request/response details
- [ ] Verify authentication (admin user logged in)
- [ ] Check server logs for detailed error messages
- [ ] Verify request payload is valid JSON
- [ ] Confirm vendor ID exists in database
- [ ] Check database constraints aren't violated
- [ ] Verify all required fields are provided

## Database Queries for Debugging

```sql
-- Check if vendor exists
SELECT * FROM supported_vendors WHERE id = 4;

-- Check admin user authentication
SELECT id, username, "companyId" FROM users WHERE "companyId" IS NULL;

-- Check vendor priorities
SELECT id, name, "productRecordPriority" FROM supported_vendors ORDER BY "productRecordPriority";

-- Check retail vertical assignments
SELECT sv.name, rv.name 
FROM supported_vendor_retail_verticals svrv
JOIN supported_vendors sv ON sv.id = svrv.supported_vendor_id
JOIN retail_verticals rv ON rv.id = svrv.retail_vertical_id
WHERE svrv.supported_vendor_id = 4;
```

## Environment-Specific Debugging

### Development
- Error details included in API responses
- Full stack traces in logs
- Detailed console logging enabled

### Production
- Generic error messages only
- Stack traces logged server-side only
- Security-focused error handling

## Getting More Help

If errors persist:
1. Copy the full error from server logs
2. Note the exact request being made (URL, method, body)
3. Check database state for the relevant records
4. Review recent code changes that might have affected the endpoint


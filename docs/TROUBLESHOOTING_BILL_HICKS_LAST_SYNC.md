# Troubleshooting: Bill Hicks Last Sync Not Showing

**Issue:** Last Sync statistics showing "Status: Never" and "Last Sync: Never" in the Bill Hicks configuration modal.

---

## Most Likely Cause

**No sync has been run yet for this store.** The Last Sync section will show "Status: Never" until the first sync completes successfully.

---

## Diagnostic Steps

### Step 1: Check Browser Console

1. Open the Bill Hicks configuration modal at `/org/yonkers-guns/supported-vendors`
2. Open browser DevTools (F12)
3. Go to the Console tab
4. Look for these log messages:

```
🔍 BILL HICKS MODAL OPENED
🔍 BILL HICKS vendor object: {...}
🔍 BILL HICKS vendor?.credentials: {...}
🔍 BILL HICKS vendorData: {...}
🔍 BILL HICKS SYNC DATA: {
  catalogSyncStatus: undefined,
  lastCatalogSync: null,
  lastCatalogRecordsCreated: undefined,
  ...
}
```

**If all values are `undefined` or `null`:**
- This confirms no sync has been run yet
- Proceed to Step 2

**If values are present but not showing in UI:**
- There's a display issue
- Take a screenshot of the console logs and report the issue

### Step 2: Run a Manual Sync

1. In the Bill Hicks modal, click the **"Manual Sync"** button
2. Wait for the sync to complete (watch for toast notification)
3. **Close and reopen** the Bill Hicks modal
4. Check if the Last Sync section now shows data

Expected console output after sync:
```
✅ BILL HICKS MANUAL SYNC: Success!
🔄 BILL HICKS MANUAL SYNC: Refreshing vendor data...
🔄 BILL HICKS MANUAL SYNC: Data refresh complete
```

### Step 3: Verify Database Has Data

If the sync completed but data still doesn't show, check the database:

**Query the database:**
```sql
SELECT 
  catalog_sync_status,
  last_catalog_sync,
  last_catalog_records_created,
  last_catalog_records_updated,
  last_catalog_records_skipped,
  last_catalog_records_failed,
  last_catalog_records_processed
FROM company_vendor_credentials
WHERE company_id = 14  -- Yonkers Guns
  AND supported_vendor_id = 5;  -- Bill Hicks
```

**Expected result after successful sync:**
```
catalog_sync_status: 'success'
last_catalog_sync: '2025-10-15 18:04:37.069'
last_catalog_records_created: 1
last_catalog_records_updated: 0
last_catalog_records_skipped: 654
last_catalog_records_failed: 0
last_catalog_records_processed: 655
```

**If no row exists:**
- FTP credentials haven't been saved yet
- Save credentials first, then run sync

**If row exists but sync fields are NULL:**
- Sync hasn't been run yet
- Run Manual Sync

### Step 4: Check Server Logs

If sync is running but failing silently, check server logs:

```bash
# Look for Bill Hicks sync messages
grep "BILL HICKS" logs.txt

# Look for sync errors
grep "error" logs.txt | grep -i "bill hicks"
```

Expected successful sync log:
```
🔄 BILL HICKS STORE: Starting pricing sync for company 14...
📥 Downloading store pricing from FTP for company 14...
✅ Store pricing sync completed: 0 updated, 1 added, 654 skipped, 0 errors
```

---

## Common Issues

### Issue 1: FTP Credentials Not Saved

**Symptoms:**
- Modal shows fields but Last Sync shows "Never"
- Manual Sync button doesn't work or shows error

**Solution:**
1. Enter FTP credentials (Host, Username, Password, Port, Base Path)
2. Click "Test FTP Connection" to verify
3. Click "Save Configuration"
4. Then click "Manual Sync"

### Issue 2: Sync Stuck in "In Progress"

**Symptoms:**
- Status shows "In Progress" indefinitely
- No error message displayed

**Solution:**
1. Check server logs for errors
2. Restart the server (will auto-recover stuck syncs)
3. Run Manual Sync again

### Issue 3: Data Not Refreshing After Sync

**Symptoms:**
- Sync completes successfully
- Console shows success messages
- But Last Sync still shows "Never"

**Solution:**
1. **Force refresh the page** (Ctrl+Shift+R / Cmd+Shift+R)
2. Reopen the Bill Hicks modal
3. Check if data now appears

If still not showing:
```javascript
// In browser console, check the React Query cache:
queryClient.getQueryData(['/org/yonkers-guns/api/supported-vendors'])
```

Look for the Bill Hicks vendor object and check if it has the sync fields.

### Issue 4: Wrong Vendor Being Updated

**Symptoms:**
- Sync completes but stats don't appear
- Other vendor's stats update instead

**Solution:**
This is a database integrity issue. Verify:
```sql
-- Check if company_vendor_credentials record exists
SELECT * FROM company_vendor_credentials
WHERE company_id = 14 AND supported_vendor_id = 5;

-- Check if vendor mapping is correct
SELECT id, name, supported_vendor_id 
FROM vendors
WHERE company_id = 14 AND name = 'Bill Hicks & Co.';
```

---

## Quick Test Procedure

1. **Clear cache and refresh page**
   - Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

2. **Open Bill Hicks modal**
   - Go to `/org/yonkers-guns/supported-vendors`
   - Click "Configure" on Bill Hicks

3. **Check console logs**
   - F12 → Console tab
   - Should see "🔍 BILL HICKS MODAL OPENED"

4. **Run Manual Sync**
   - Click "Manual Sync" button
   - Wait for completion (10-30 seconds)
   - Watch for "✅ BILL HICKS MANUAL SYNC: Success!"

5. **Close and reopen modal**
   - Click X to close
   - Click "Configure" again
   - Last Sync section should now show data

---

## Expected Behavior

### Before First Sync:
```
Last Sync
┌─────────────────────────────────────────────────┐
│ Status: Never                                   │
│ Last Sync: Never                                │
│                                                  │
│ (No statistics box)                            │
└─────────────────────────────────────────────────┘
```

### After Successful Sync:
```
Last Sync
┌─────────────────────────────────────────────────┐
│ Status: Success                                 │
│ Last Sync: 10/15/2025 at 12:09 AM PDT          │
│                                                  │
│ ┌─────────────────────────────────────────────┐│
│ │ Added: 1         Updated: 0                 ││
│ │ Skipped: 654     Failed: 0                  ││
│ │ ───────────────────────────────────────────  ││
│ │           Processed: 655                    ││
│ └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

---

## Still Not Working?

If you've tried all the above and the Last Sync stats still don't appear:

1. **Collect diagnostic information:**
   - Screenshot of the Bill Hicks modal
   - Browser console logs (all messages)
   - Server logs showing the sync attempt
   - Result of database query (Step 3)

2. **Check the API response directly:**
   ```javascript
   // In browser console:
   fetch('/org/yonkers-guns/api/supported-vendors', {
     credentials: 'include'
   })
     .then(r => r.json())
     .then(data => {
       const billHicks = data.find(v => v.name === 'Bill Hicks & Co.');
       console.log('Bill Hicks vendor data:', billHicks);
       console.log('Bill Hicks credentials:', billHicks?.credentials);
     });
   ```

3. **Verify the backend is returning data:**
   - Check server logs for "BILL HICKS CREDENTIALS: Creating vendor credentials object"
   - Should show all the sync statistics fields being added

4. **Report the issue** with:
   - All diagnostic information collected
   - Steps you've tried
   - Expected vs actual behavior


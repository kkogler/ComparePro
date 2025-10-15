# Store Credential Save - Testing Plan

## Quick Test (5 minutes)

Test that credentials are no longer being wiped out when saving other vendors.

### Prerequisites
- Dev server running: `npm run dev`
- Access to at least one store
- Test credentials for at least 2 vendors

### Test Steps

#### Step 1: Save First Vendor (Chattanooga)
1. Go to: `http://localhost:3001/org/beverly-hills-ammo/supported-vendors`
2. Click "Configure" on Chattanooga
3. Enter credentials:
   - SID: `TEST_SID_123`
   - Token: `TEST_TOKEN_456`
4. Click "Save Configuration"
5. **Expected**: Success message
6. Close the modal and re-open it
7. **Expected**: SID and Token are still there

#### Step 2: Save Second Vendor (Bill Hicks)
1. On the same page, click "Configure" on Bill Hicks
2. Enter credentials:
   - FTP Host: `billhicksco.hostedftp.com`
   - FTP Username: `testuser`
   - FTP Password: `testpass123`
   - FTP Port: `21`
   - FTP Base Path: `/MicroBiz/Feeds`
3. Click "Save Configuration"  
4. **Expected**: Success message

#### Step 3: Verify First Vendor NOT Lost
1. Go back to Chattanooga and click "Configure"
2. **CRITICAL CHECK**: Verify the SID and Token are STILL THERE
3. **Expected**: SID = `TEST_SID_123`, Token = `TEST_TOKEN_456`
4. **If EMPTY or NULL**: ❌ The fix didn't work - credentials were wiped

#### Step 4: Verify Second Vendor Saved
1. Go to Bill Hicks and click "Configure"
2. **Expected**: All fields are populated with the values you entered
3. **If EMPTY**: ❌ Save didn't work

### Success Criteria

✅ **PASS** if:
- Chattanooga credentials are preserved after saving Bill Hicks
- Bill Hicks credentials are saved correctly
- Both vendors show their credentials when re-opening the config modals

❌ **FAIL** if:
- Chattanooga credentials disappear after saving Bill Hicks
- Bill Hicks credentials don't save
- Any credentials become NULL or empty

## Full Test (15 minutes)

Test multiple vendors and multiple updates to ensure robustness.

### Test Matrix

| Step | Action | Verify |
|------|--------|--------|
| 1 | Save Chattanooga | Credentials saved |
| 2 | Save Bill Hicks | Chattanooga still exists |
| 3 | Save Sports South | Both Chattanooga and Bill Hicks still exist |
| 4 | Update Chattanooga (change SID) | Bill Hicks and Sports South unchanged |
| 5 | Update Bill Hicks (change password) | Chattanooga and Sports South unchanged |
| 6 | Save Lipsey's | All 3 previous vendors unchanged |

### Detailed Steps

#### 1. Save Chattanooga
- SID: `CHATT_001`
- Token: `TOKEN_001`
- **Check**: Saved successfully

#### 2. Save Bill Hicks
- Server: `billhicksco.hostedftp.com`
- Username: `billuser`
- Password: `billpass`
- **Check**: Chattanooga SID still = `CHATT_001`

#### 3. Save Sports South
- Customer Number: `12345`
- Username: `sportsuser`
- Password: `sportspass`
- Source: `WEBSYNC`
- **Check**: Chattanooga SID still = `CHATT_001`, Bill Hicks server still = `billhicksco.hostedftp.com`

#### 4. Update Chattanooga
- Change SID to: `CHATT_002`
- **Check**: Bill Hicks and Sports South unchanged

#### 5. Update Bill Hicks
- Change password to: `newbillpass`
- **Check**: Chattanooga and Sports South unchanged

#### 6. Save Lipsey's
- Email: `test@example.com`
- Password: `lipseypass`
- **Check**: All 3 previous vendors unchanged

## Server Log Verification

Watch the server logs while saving credentials. You should see:

```
💾 STORAGE (HYBRID): Saving company vendor credentials
💾 STORAGE (HYBRID): Update fields (excluding undefined): [list of fields]
✅ STORAGE (HYBRID): Successfully saved credentials to JSON + legacy columns
```

**Key thing to check**: The "Update fields" should only list the fields for the vendor you're saving, not ALL fields.

### Good Log Example (Bill Hicks Save):
```
Update fields (excluding undefined): ['companyId', 'supportedVendorId', 'updatedAt', 'credentials', 'ftpServer', 'ftpPort', 'ftpUsername', 'ftpPassword', 'ftpBasePath', 'catalogSyncEnabled', 'catalogSyncSchedule', 'inventorySyncEnabled']
```
✅ Only Bill Hicks fields (ftpServer, ftpUsername, etc.)

### Bad Log Example (Before Fix):
```
Update fields: ['companyId', 'supportedVendorId', 'updatedAt', 'credentials', 'ftpServer', 'ftpPort', 'ftpUsername', 'ftpPassword', 'ftpBasePath', 'sid', 'token', 'userName', 'password', 'apiKey', 'apiSecret', ...]
```
❌ ALL fields listed (including sid, token from other vendors)

## Database Verification (Optional)

If you want to check the database directly:

```sql
SELECT 
  c.name as company_name,
  sv.name as vendor_name,
  cvc.ftp_server,
  cvc.ftp_username,
  cvc.sid,
  cvc.token,
  cvc.user_name,
  cvc.customer_number,
  cvc.credentials::text as json_credentials
FROM company_vendor_credentials cvc
JOIN companies c ON c.id = cvc.company_id
JOIN supported_vendors sv ON sv.id = cvc.supported_vendor_id
WHERE c.slug = 'beverly-hills-ammo'
ORDER BY sv.name;
```

**Expected**: Each row should have only the fields for that specific vendor populated. Other vendor fields should be NULL.

**Example:**
- Bill Hicks row: `ftp_server`, `ftp_username` populated; `sid`, `token` are NULL
- Chattanooga row: `sid`, `token` populated; `ftp_server`, `ftp_username` are NULL

## Reporting Issues

If the test fails, provide:

1. Which step failed
2. What you expected vs. what happened
3. Server logs (look for `💾 STORAGE (HYBRID)` lines)
4. Screenshots of the credential modals showing empty fields

## Recovery

If credentials are lost during testing:

1. Stop the test
2. Re-enter the credentials manually
3. Report the issue with details above
4. Do NOT continue testing until the fix is verified








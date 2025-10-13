# Chattanooga Admin Credentials Modal Fix

## Problem
The "Configure Admin Credentials" modal for Chattanooga Shooting Supplies Inc. was displaying **Bill Hicks FTP fields** instead of Chattanooga's REST API fields.

### What the User Saw
When opening Admin > Supported Vendors > Chattanooga > Edit Credentials, the form displayed:
- FTP Server
- FTP Username  
- FTP Password
- FTP Port
- FTP Base Path

This was incorrect - Chattanooga uses a REST API, not FTP.

## Root Cause
The `credential_fields` column in the `supported_vendors` table had **incorrect data** for Chattanooga (vendor_short_code = 'chattanooga'). 

The database showed:
```json
[
  {"name": "ftpServer", "type": "text", "label": "FTP Server", "required": true},
  {"name": "ftpUsername", "type": "text", "label": "FTP Username", "required": true},
  {"name": "ftpPassword", "type": "password", "label": "FTP Password", "required": true},
  {"name": "ftpPort", "type": "number", "label": "FTP Port", "default": "21", "required": false},
  {"name": "ftpBasePath", "type": "text", "label": "FTP Base Path", "required": false}
]
```

These are Bill Hicks fields, not Chattanooga fields.

## How the Modal Works
The `AdminCredentialsModal` component in `client/src/pages/SupportedVendorsAdmin.tsx` (line 1479) renders form fields by mapping over `vendor.credentialFields`:

```typescript
{vendor.credentialFields.map((field) => (
  <div key={field.name}>
    <Label htmlFor={field.name}>{field.label}</Label>
    <Input ... />
  </div>
))}
```

This data comes from the API endpoint `/api/admin/supported-vendors`, which returns vendors directly from the database including the `credential_fields` column.

## Solution
Updated the `credential_fields` for Chattanooga to match their REST API requirements per their documentation:

```sql
UPDATE supported_vendors SET credential_fields = '[
  {"name": "accountNumber", "type": "text", "label": "Account Number", "required": true, "placeholder": "Your Chattanooga account number", "description": "Your Chattanooga Shooting Supplies account number"},
  {"name": "username", "type": "text", "label": "Portal Username", "required": true, "placeholder": "Your dealer portal username", "description": "Your Chattanooga dealer portal username"},
  {"name": "password", "type": "password", "label": "Portal Password", "required": true, "placeholder": "Your dealer portal password", "description": "Your Chattanooga dealer portal password"},
  {"name": "sid", "type": "text", "label": "API SID", "required": true, "placeholder": "D1EEB7BB0C58A27C6FEA7B4339F5251C", "description": "Your Chattanooga API SID for authentication"},
  {"name": "token", "type": "password", "label": "API Token", "required": true, "placeholder": "D1EEB7BCB4D5D2134BE37393811FADDA", "description": "Your Chattanooga API Token for authentication"}
]'::json 
WHERE vendor_short_code = 'chattanooga';
```

### Correct Chattanooga API Credentials
Based on the user-provided API documentation, Chattanooga requires:

**Account Information:**
- `accountNumber` - Account #: 9502500000

**API Credentials:**
- `sid` - API SID: D1EEB7BB0C58A27C6FEA7B4339F5251C
- `token` - API Token: D1EEB7BCB4D5D2134BE37393811FADDA

**Portal Access:**
- `username` - Dealer portal username
- `password` - Dealer portal password

### API Authentication Method
Chattanooga uses a specific authentication format:
- **Format:** `Basic SID:MD5(Token)`
- **Method:** Direct format (no Base64 encoding)
- **Example:** `Basic D1EEB7BB0C58A27C6FEA7B4339F5251C:6D7012A0C5AC75A7252684A0ACE91579`

## Additional Fixes

### 1. Bill Hicks API Type
Corrected Bill Hicks `api_type` from `'rest'` to `'ftp'` for accuracy:

```sql
UPDATE supported_vendors SET api_type = 'ftp' WHERE vendor_short_code = 'bill-hicks';
```

### 2. Seed File Correction
Updated `/migrations/seed-supported-vendors.sql` to prevent this issue from recurring:

**Line 16:** Changed Bill Hicks from `'rest'` to `'ftp'`
**Lines 32-41:** Updated Chattanooga credential fields from FTP fields to correct REST API fields

This ensures that if the seed file is run again (during database resets or new deployments), the correct credential fields will be set.

## Verification
After the fix:
```sql
SELECT vendor_short_code, jsonb_pretty(credential_fields::jsonb) 
FROM supported_vendors 
WHERE vendor_short_code = 'chattanooga';
```

Now correctly shows:
- accountNumber
- username  
- password
- sid
- token

## Testing
To verify the fix works:

1. Navigate to: **Admin > Supported Vendors**
2. Find **Chattanooga Shooting Supplies Inc.** in the table
3. Click **Edit Credentials** button
4. Verify the modal now shows:
   - Account Number
   - Portal Username
   - Portal Password
   - API SID
   - API Token

## Why This Happened
The credential fields were likely copied from Bill Hicks during initial setup or a migration script that applied the wrong template to Chattanooga.

## How to Prevent This
1. **Schema Validation:** Add database constraints or application-level validation to ensure vendors have the correct credential fields based on their `api_type`
2. **Seed Data Review:** Review `migrations/seed-supported-vendors.sql` to ensure initial data is correct
3. **Type Safety:** Consider using TypeScript discriminated unions to enforce vendor-specific credential schemas

## Files Changed
1. **Database:** Updated `supported_vendors` table directly via SQL
2. **Seed File:** `/migrations/seed-supported-vendors.sql` - Updated Chattanooga and Bill Hicks entries

## Status
✅ **FIXED** - Chattanooga credential fields corrected in database  
✅ **VERIFIED** - Database query confirms correct fields are now stored  
✅ **BONUS FIX #1** - Bill Hicks api_type corrected from 'rest' to 'ftp'  
✅ **BONUS FIX #2** - Seed file updated to prevent issue from recurring  

The modal should now display the correct Chattanooga REST API fields.


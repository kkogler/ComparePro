# Bill Hicks Credential Field Name Fix

## Issue Summary

When trying to save Bill Hicks credentials in Production (Store > Supported Vendors > Bill Hicks), the system returned a **400 error**:

```
Required field missing: FTP Server
```

But the console showed the frontend was sending the correct data:
```javascript
{
  ftpServer: 'ftp.billhicks.com',
  ftpUsername: 'kevin@thegunbarnes.com',
  ftpPassword: 'MicroBiz01',
  inventorySyncEnabled: true
}
```

## Root Cause

The issue was a **field name mismatch** between three different naming conventions:

1. **Database schema** (`supported_vendors.credential_fields` JSON): `FTP_Server` (uppercase with underscore)
2. **Database columns** (`company_vendor_credentials` table): `ftp_server` (lowercase with underscore) 
3. **Frontend/API**: `ftpServer` (camelCase)

### The Problem Flow

```
Frontend sends: { ftpServer: 'ftp.billhicks.com' }
    ↓
Credential Vault reads schema from DB: { name: 'FTP_Server', label: 'FTP Server', required: true }
    ↓
Validation tries to map field names:
  - snakeToCamel('FTP_Server') → 'fTPServer' ❌ (wrong!)
  - Looks for credentials['FTP_Server'] → undefined
  - Looks for credentials['fTPServer'] → undefined  
  - Looks for credentials['ftpServer'] → exists but not matched!
    ↓
Validation fails: "Required field missing: FTP Server"
```

### Why It Failed

1. The field name mapping logic only checked exact matches for `ftpHost`
2. The `snakeToCamel()` function didn't handle uppercase letters correctly
3. No case-insensitive fallback matching existed

## The Fix

### 1. Robust Field Name Normalization (Lines 156-199)

Updated the Bill Hicks field mapping to normalize field names regardless of case or format:

```typescript
// Normalize by removing underscores and converting to lowercase
const normalizedName = field.name.toLowerCase().replace(/_/g, '');

// Map any variation (FTP_Server, ftp_server, ftpServer, ftpHost) to correct format
if (normalizedName === 'ftphost' || normalizedName === 'ftpserver') {
  return { ...field, name: 'ftp_server' }; // Use DB column name
}
```

Now handles:
- `FTP_Server` → `ftp_server` ✅
- `ftp_server` → `ftp_server` ✅  
- `ftpServer` → `ftp_server` ✅
- `ftpHost` → `ftp_server` ✅

### 2. Enhanced Validation Logic (Lines 498-548)

Improved the credential validation to try multiple matching strategies:

```typescript
// 1. Try exact match (snake_case and camelCase)
let value = credentials[snakeCaseName] || credentials[camelCaseName];

// 2. If not found, try case-insensitive match
if (!value) {
  const credentialKey = Object.keys(credentials).find(key => 
    key.toLowerCase() === lowerCaseName || 
    key.toLowerCase().replace(/_/g, '') === lowerCaseName.replace(/_/g, '')
  );
  if (credentialKey) {
    value = credentials[credentialKey];
  }
}
```

This handles cases where:
- Schema expects: `ftp_server`
- Frontend sends: `ftpServer`
- Validation now finds it!  ✅

## Files Modified

- `server/credential-vault-service.ts`
  - Lines 156-199: Enhanced Bill Hicks field name mapping
  - Lines 498-548: Improved validation with case-insensitive matching

## Testing

To verify the fix:

1. **Navigate to**: Store > Supported Vendors > Bill Hicks
2. **Enter credentials**:
   - FTP Server: `ftp.billhicks.com`
   - FTP Username: `your-email@domain.com`
   - FTP Password: `your-password`
3. **Click Save**
4. **Expected**: ✅ "Credentials saved successfully"
5. **Previously**: ❌ "Required field missing: FTP Server"

## Why This Happened

The `supported_vendors` table in Production likely has Bill Hicks credential fields defined with uppercase names like:

```json
{
  "credentialFields": [
    { "name": "FTP_Server", "label": "FTP Server", "required": true },
    { "name": "FTP_Username", "label": "FTP Username", "required": true },
    ...
  ]
}
```

Instead of the expected lowercase:

```json
{
  "credentialFields": [
    { "name": "ftp_server", "label": "FTP Server", "required": true },
    { "name": "ftp_username", "label": "FTP Username", "required": true },
    ...
  ]
}
```

The fix makes the system **resilient to any field name format**.

## Additional Benefits

This fix also improves credential handling for all vendors by:
- Supporting mixed-case field names
- Handling typos/inconsistencies in credential schemas
- Making the system more forgiving of database schema variations
- Preventing similar issues with other vendors

## Database Cleanup (Optional)

To standardize the Bill Hicks credential schema in the database:

```sql
UPDATE supported_vendors
SET credential_fields = '[
  {"name": "ftp_server", "label": "FTP Server", "type": "text", "required": true},
  {"name": "ftp_username", "label": "FTP Username", "type": "text", "required": true},
  {"name": "ftp_password", "label": "FTP Password", "type": "password", "required": true},
  {"name": "ftp_port", "label": "FTP Port", "type": "text", "required": false},
  {"name": "ftp_base_path", "label": "Base Directory", "type": "text", "required": false}
]'::jsonb
WHERE name = 'Bill Hicks & Co.';
```

**Note**: This cleanup is optional since the code now handles any format.


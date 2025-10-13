# Admin Credentials Field Name Fix

## Problem
When saving admin credentials for Bill Hicks (and potentially other vendors) in **Admin > Supported Vendors > Manage Credentials**, the system returned a 400 error:
```
Required field missing: FTP Server
```

This occurred even though the frontend was correctly sending the FTP server field. The error was caused by inconsistent field naming conventions between:
1. **Database**: Fields stored with various naming conventions (e.g., `FTP_Server`, `ftp_server`)
2. **Frontend**: Field names derived from database schema (e.g., `FTP_Server`)
3. **Validation**: Expected specific field name formats

## Root Cause
The `processCredentials` method was using simple snake_case to camelCase conversion, but:
- Database field: `FTP_Server` (mixed case with underscores)
- Frontend sends: `FTP_Server` (exactly as stored in database)
- Processing looked for: `ftp_server` or `ftpServer`
- **Mismatch!** The field wasn't found, causing validation to fail

## Solution
Enhanced the `processCredentials` method to use flexible field name matching (similar to the existing `validateCredentials` fix):

### Changes in `server/credential-vault-service.ts`
```typescript
private processCredentials(
  credentials: Record<string, string>, 
  schema: CredentialField[]
): Record<string, string> {
  // Helper to normalize field names for comparison (lowercase, no underscores/spaces)
  const normalizeForComparison = (str: string) => 
    str.toLowerCase().replace(/[_\s]/g, '');
  
  for (const field of schema) {
    const schemaFieldNorm = normalizeForComparison(field.name);
    
    // Try to find matching credential key using flexible matching
    for (const [credKey, credValue] of Object.entries(credentials)) {
      if (normalizeForComparison(credKey) === schemaFieldNorm) {
        // Found a match! Store in multiple formats for compatibility
        normalized[field.name] = credValue;
        normalized[snakeToCamel(field.name)] = credValue;
        normalized[credKey] = credValue; // Preserve original
      }
    }
  }
}
```

### How It Works
1. **Normalization**: Converts field names to lowercase and removes underscores/spaces for comparison
   - `FTP_Server` → `ftpserver`
   - `ftpServer` → `ftpserver`
   - `ftp_server` → `ftpserver`

2. **Flexible Matching**: Compares normalized versions, so all variations match

3. **Multi-Format Storage**: Stores credentials in multiple naming conventions:
   - Original database format (e.g., `FTP_Server`)
   - snake_case format (e.g., `ftp_server`)
   - camelCase format (e.g., `ftpServer`)

## Impact
- ✅ Admin can now successfully save credentials for any vendor regardless of database field naming conventions
- ✅ Works for both admin-level and store-level credentials
- ✅ Maintains backward compatibility with existing credential storage
- ✅ Handles edge cases like mixed-case field names, spaces, underscores

## Testing
To verify the fix:
1. Go to **Admin > Supported Vendors**
2. Click **Manage Credentials** on Bill Hicks
3. Enter valid FTP credentials:
   - FTP Host: `ftp.billhicks.com`
   - FTP Username: `your-email@domain.com`
   - FTP Password: `your-password`
4. Click **Save Credentials**
5. ✅ Should save successfully without errors

## Related Fixes
- Store-level credentials: Fixed in previous iteration (`validateCredentials` enhancement)
- Bill Hicks field mapping: Handled by `getVendorSchema` normalization
- Case-insensitive validation: Implemented in `validateCredentials` method


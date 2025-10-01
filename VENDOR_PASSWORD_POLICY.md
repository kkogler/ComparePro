# Vendor Password Storage Policy

## 🔓 **NO ENCRYPTION - PLAIN TEXT ONLY**

**CRITICAL POLICY**: All vendor credentials (passwords, API keys, tokens) are stored as **PLAIN TEXT** in the database. **NO ENCRYPTION IS USED OR SHOULD BE USED**.

## 📋 Why Plain Text?

1. **Reliability**: Encryption keys can be lost, corrupted, or change between deployments
2. **Consistency**: Prevents passwords from becoming "corrupted" or undecryptable
3. **Debugging**: Allows verification of actual password values in database
4. **Multi-tenant**: Avoids key management complexity across multiple organizations
5. **Development**: Simplifies testing and troubleshooting

## ✅ Current Implementation

### Code Location: `server/credential-vault-service.ts`

```typescript
export class CredentialVaultService {
  constructor() {
    // No encryption - credentials stored as plain text for reliability
    console.log('✅ CREDENTIAL VAULT: Using plain text storage (no encryption)');
  }

  // Encryption/decryption methods removed - using plain text storage for reliability
```

### Key Functions:

1. **`processCredentials()`** - Lines 469-477
   ```typescript
   /**
    * Process credentials (no encryption - pass through)
    */
   private processCredentials(
     credentials: Record<string, string>, 
     schema: CredentialField[]
   ): Record<string, string> {
     // No encryption - return credentials as-is
     return { ...credentials };
   }
   ```

2. **`unprocessCredentials()`** - Lines 479-497
   ```typescript
   /**
    * Unprocess credentials (no decryption - pass through)
    */
   private unprocessCredentials(
     storedCredentials: Record<string, string>, 
     schema: CredentialField[]
   ): Record<string, string> {
     // No decryption - return credentials as-is, but filter out metadata
     const unprocessed: Record<string, string> = {};

     for (const [key, value] of Object.entries(storedCredentials)) {
       if (key === 'lastUsed' || key === 'createdAt' || key === 'updatedAt') {
         continue; // Skip metadata fields
       }
       unprocessed[key] = value;
     }

     return unprocessed;
   }
   ```

## 🗄️ Database Storage

### Admin-Level Credentials
- **Table**: `supported_vendors`
- **Column**: `admin_credentials` (JSONB)
- **Example**:
  ```json
  {
    "ftpServer": "billhicksco.hostedftp.com",
    "ftpUsername": "kevin@thegunbarnes.com",
    "ftpPassword": "MicroBiz01",
    "ftpPort": 21
  }
  ```

### Store-Level Credentials
- **Table**: `company_vendor_credentials`
- **Columns**: Individual columns for each credential field
- **Example**:
  - `ftp_server`: `billhicksco.hostedftp.com`
  - `ftp_username`: `kevin@thegunbarnes.com`
  - `ftp_password`: `MicroBiz01`
  - `ftp_port`: `21`

## ⚠️ Common Issues

### Issue #1: Legacy Encrypted Credentials
**Problem**: Old credentials may have been encrypted with a lost/changed key

**Example**:
```json
{
  "password": "d9a4d5bb3f211c7c374ce09b55355730:de6ccc3ff39124b07604f78dcf097d21"
}
```

**Solution**: Replace with plain text
```sql
UPDATE supported_vendors 
SET admin_credentials = jsonb_set(
  admin_credentials::jsonb,
  '{password}',
  '"MicroBiz01"'
)
WHERE name = 'Bill Hicks & Co.';
```

### Issue #2: Placeholder Credentials
**Problem**: Credentials set to `"NEEDS_UPDATE"` after encryption issues

**Example**:
```json
{
  "ftpUsername": "NEEDS_UPDATE",
  "ftpPassword": "NEEDS_UPDATE"
}
```

**Solution**: Update with actual values via Admin UI or SQL

## 🔍 How to Verify Credentials

### Check Admin-Level Credentials:
```sql
SELECT 
  name,
  admin_credentials
FROM supported_vendors
WHERE name = 'Bill Hicks & Co.';
```

### Check Store-Level Credentials:
```sql
SELECT 
  cv.company_id,
  o.name as organization_name,
  cv.ftp_server,
  cv.ftp_username,
  cv.ftp_password,
  cv.ftp_port
FROM company_vendor_credentials cv
JOIN organizations o ON cv.company_id = o.id
JOIN supported_vendors sv ON cv.supported_vendor_id = sv.id
WHERE sv.name = 'Bill Hicks & Co.';
```

## 🚫 What NOT to Do

1. ❌ **DO NOT** add encryption logic to `credential-vault-service.ts`
2. ❌ **DO NOT** set `CREDENTIAL_ENCRYPTION_KEY` environment variable
3. ❌ **DO NOT** use encrypted password formats (with colons or hex strings)
4. ❌ **DO NOT** use `crypto.createCipheriv()` or similar encryption methods
5. ❌ **DO NOT** use bcrypt, scrypt, or hashing for vendor passwords (those are for user passwords only)

## ✅ What TO Do

1. ✅ **DO** store passwords as plain text strings
2. ✅ **DO** verify passwords are readable in database
3. ✅ **DO** test connections after saving credentials
4. ✅ **DO** use the Admin UI or SQL to update credentials
5. ✅ **DO** keep this policy documented and enforced

## 🔐 Security Considerations

**For Production Deployments:**
- Ensure database access is properly restricted
- Use database-level encryption at rest if required
- Control API access with proper authentication
- Use environment-specific databases
- Consider network-level security (VPN, private networks)

**Database security is sufficient** - application-level encryption adds complexity without meaningful security improvement in this context.

## 📝 Bill Hicks Example

### Correct Admin Credentials:
```json
{
  "ftpServer": "billhicksco.hostedftp.com",
  "ftpUsername": "kevin@thegunbarnes.com",
  "ftpPassword": "MicroBiz01",
  "ftpPort": 21
}
```

### How to Update:
1. Go to **Admin > Supported Vendors**
2. Find **Bill Hicks & Co.**
3. Click **Edit Admin Credentials**
4. Enter the exact password: `MicroBiz01`
5. Click **Save**
6. Click **Test Connection** to verify

## 🛠️ Troubleshooting

### Password Changed or Corrupted?
```sql
-- Check current value
SELECT admin_credentials->>'ftpPassword' as current_password
FROM supported_vendors
WHERE name = 'Bill Hicks & Co.';

-- If it's wrong, fix it
UPDATE supported_vendors
SET admin_credentials = jsonb_set(
  admin_credentials::jsonb,
  '{ftpPassword}',
  '"MicroBiz01"'
)
WHERE name = 'Bill Hicks & Co.';
```

### Verify It's Not Encrypted:
- Plain text: `MicroBiz01` ✅
- Encrypted (BAD): `a1b2c3d4e5:f6g7h8i9` ❌
- Placeholder (BAD): `NEEDS_UPDATE` ❌

## 📚 Related Documentation

- `ADMIN_CREDENTIAL_DECRYPTION_FIX.md` - History of encryption issues
- `CREDENTIAL_PERSISTENCE_FIX.md` - Why encryption was removed
- `server/credential-vault-service.ts` - Implementation code

## 📅 Last Updated

**Date**: 2025-10-01  
**Policy**: Plain text storage for all vendor credentials  
**Status**: Active and enforced


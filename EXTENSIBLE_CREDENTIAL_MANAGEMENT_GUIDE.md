# Extensible Credential Management System

## Overview

This document describes the new extensible credential management system designed to handle vendor credentials securely and scalably. The system supports both admin-level and store-level credentials for unlimited vendors without breaking existing functionality.

## Key Features

### 🔐 **Secure by Design**
- **AES-256-GCM encryption** for sensitive credential fields
- **Field-level encryption** based on credential type
- **Audit logging** for all credential operations
- **Secure credential redaction** for logs and displays

### 🚀 **Extensible Architecture**
- **Vendor-agnostic design** - add new vendors without code changes
- **Auto-discovery** of vendor handlers
- **Dynamic vendor registration** through admin UI
- **Backward compatibility** with existing credential system

### 🏢 **Multi-Tenant Support**
- **Admin-level credentials** for system-wide operations
- **Store-level credentials** for tenant-specific operations
- **Credential isolation** between organizations
- **Scalable to 400+ credential sets**

### 📊 **Comprehensive Management**
- **Unified admin interface** for all vendor credentials
- **Connection testing** for all vendor types
- **Health monitoring** and status tracking
- **Credential lifecycle management**

## Architecture Components

### 1. Credential Vault Service (`credential-vault-service.ts`)

The core service that handles credential storage, encryption, and retrieval.

```typescript
// Store admin credentials
await credentialVault.storeAdminCredentials(vendorId, credentials, userId, auditInfo);

// Store store credentials
await credentialVault.storeStoreCredentials(vendorId, companyId, credentials, userId, auditInfo);

// Test connections
await credentialVault.testConnection(vendorId, 'admin');
```

**Key Features:**
- Automatic encryption of sensitive fields
- Credential validation against vendor schemas
- Audit logging for all operations
- Secure credential retrieval with decryption

### 2. Vendor Registry (`vendor-registry.ts`)

Manages vendor handlers and provides unified access to vendor operations.

```typescript
// Register a new vendor
await vendorRegistry.registerNewVendor('new_vendor', 'New Vendor Inc.', 'rest_api');

// Test any vendor connection
await vendorRegistry.testVendorConnection('vendor_id', 'admin');

// Auto-discover new handlers
await vendorRegistry.initialize();
```

**Key Features:**
- Dynamic vendor registration
- Auto-discovery of vendor handlers
- Unified connection testing
- Flexible vendor matching

### 3. Enhanced Credential Manager (`vendor-credential-manager.ts`)

Updated to work with both legacy and new credential systems.

```typescript
const credManager = createVendorCredentialManager();

// Load credentials (uses new vault if enabled)
const creds = await credManager.load(companyId, vendorId, vendorName);

// Save credentials (uses new vault if enabled)
await credManager.save(companyId, vendor, credentials, userId);
```

**Key Features:**
- Feature flag support for gradual migration
- Backward compatibility with existing system
- Unified API for credential operations
- Automatic fallback to legacy system

## Adding New Vendors

> **📖 For detailed vendor onboarding instructions, see [VENDOR_ONBOARDING_GUIDE.md](./VENDOR_ONBOARDING_GUIDE.md)**

### Quick Overview: Automatic Discovery

1. **Create Vendor API Handler** (`server/vendor-name-api.ts`)
2. **Add to Database** (supported_vendors table)
3. **System Auto-Discovery** (automatic on restart)
4. **Test Integration** (admin interface)
5. **Deploy** (zero code changes)

### Method 2: Manual Registration

1. **Use Admin UI**
   - Go to Credential Management → Vendor Handlers
   - Click "Register New Vendor"
   - Fill in vendor details
   - System creates handler automatically

2. **Use API**
   ```typescript
   POST /api/admin/vendors/register
   {
     "vendorId": "new_vendor",
     "vendorName": "New Vendor Inc.",
     "apiType": "rest_api",
     "handlerModule": "./new-vendor-api"
   }
   ```

### Method 3: Database Configuration

1. **Add to Supported Vendors**
   ```sql
   INSERT INTO supported_vendors (
     name, description, api_type, credential_fields, features
   ) VALUES (
     'New Vendor Inc.',
     'Description of new vendor',
     'rest_api',
     '[{"name":"apiKey","label":"API Key","type":"apiKey","required":true,"encrypted":true}]',
     '{"electronicOrdering":true,"realTimePricing":true}'
   );
   ```

2. **System Integration**
   - Vendor automatically appears in admin interface
   - Credential schema is dynamically loaded
   - Connection testing works immediately

## Credential Field Types

The system supports various credential field types with automatic encryption:

```typescript
type CredentialFieldType = 
  | 'text'        // Plain text (not encrypted)
  | 'password'    // Encrypted password
  | 'email'       // Email address (not encrypted)
  | 'url'         // URL (not encrypted)
  | 'number'      // Numeric value (not encrypted)
  | 'apiKey'      // Encrypted API key
  | 'secret'      // Encrypted secret
  | 'token'       // Encrypted token
  | 'certificate' // Encrypted certificate
  | 'privateKey'; // Encrypted private key
```

**Automatic Encryption Rules:**
- `password`, `apiKey`, `secret`, `token`, `certificate`, `privateKey` → **Encrypted**
- `text`, `email`, `url`, `number` → **Not encrypted**

## API Endpoints

### Admin-Level Credentials
```
GET    /api/admin/vendors/:vendorId/credential-schema
POST   /api/admin/vendors/:vendorId/credentials
GET    /api/admin/vendors/:vendorId/credentials
POST   /api/admin/vendors/:vendorId/test-connection
```

### Store-Level Credentials
```
POST   /org/:slug/api/vendors/:vendorId/credentials
GET    /org/:slug/api/vendors/:vendorId/credentials
POST   /org/:slug/api/vendors/:vendorId/test-connection
```

**Important**: See [CREDENTIAL_FIELD_MAPPING_FIX.md](./CREDENTIAL_FIELD_MAPPING_FIX.md) for field name mapping requirements between frontend (camelCase) and database (snake_case).

### Vendor Management
```
GET    /api/admin/vendors/configured
GET    /api/admin/vendors/handlers
POST   /api/admin/vendors/register
GET    /api/admin/credentials/health
```

## Security Features

### Encryption
- **Algorithm:** AES-256-GCM
- **Key Management:** Environment variable `CREDENTIAL_ENCRYPTION_KEY`
- **Field-Level:** Only sensitive fields are encrypted
- **Format:** `iv:authTag:encryptedData`

### Audit Logging
```typescript
interface AuditLogEntry {
  action: 'created' | 'updated' | 'accessed' | 'deleted' | 'rotated' | 'test_connection';
  vendorId: string;
  level: 'admin' | 'store';
  companyId?: number;
  userId: number;
  timestamp: Date;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}
```

### Access Control
- **Admin credentials:** Require admin authentication
- **Store credentials:** Require organization access
- **Credential isolation:** Company-specific access only
- **Audit trails:** All operations logged

## Migration Strategy

### Phase 1: Feature Flag Rollout
```bash
# Enable new credential vault (optional)
export FEATURE_NEW_CREDENTIAL_VAULT=true

# Keep existing Chattanooga support
export FEATURE_VCM_CHATTANOOGA=true
```

### Phase 2: Gradual Migration
1. **New vendors** automatically use new system
2. **Existing vendors** continue using legacy system
3. **Admin choice** to migrate specific vendors
4. **Zero downtime** migration process

### Phase 3: Full Migration
1. **Migrate all existing credentials** to new vault
2. **Deprecate legacy system** after validation
3. **Remove feature flags** and legacy code

## Monitoring & Health Checks

### Credential Health Dashboard
- **Total vendors** configured
- **Admin credentials** status
- **Store credentials** count
- **Connection status** per vendor
- **Last successful sync** timestamps

### Connection Testing
- **Automated testing** of all vendor connections
- **Real-time status updates** in admin interface
- **Error reporting** and alerting
- **Connection retry** logic

## Performance Considerations

### Scalability
- **Encryption overhead:** ~1ms per credential field
- **Database queries:** Optimized with proper indexing
- **Memory usage:** Credentials decrypted on-demand only
- **Concurrent access:** Thread-safe operations

### Caching
- **Credential schemas** cached in memory
- **Vendor handlers** cached after discovery
- **Connection status** cached with TTL
- **Audit logs** batched for performance

## Best Practices

### For Developers
1. **Always use the credential vault** for new vendors
2. **Implement testConnection()** method in vendor APIs
3. **Follow naming conventions** for auto-discovery
4. **Use proper credential field types** for encryption
5. **Log credential access** for audit purposes

### For Administrators
1. **Set encryption key** in production environment
2. **Monitor credential health** regularly
3. **Test connections** after credential updates
4. **Review audit logs** periodically
5. **Use secure credential storage** practices

### For Store Owners
1. **Keep credentials up-to-date** with vendors
2. **Test connections** before relying on integrations
3. **Monitor vendor status** in store dashboard
4. **Report credential issues** promptly
5. **Follow vendor-specific** credential requirements

## Troubleshooting

### Common Issues

**Credential Decryption Fails**
- Check `CREDENTIAL_ENCRYPTION_KEY` environment variable
- Verify credential was encrypted with same key
- Check for database corruption

**Vendor Not Found**
- Ensure vendor is registered in system
- Check vendor ID spelling and case
- Verify handler module exists

**Connection Test Fails**
- Verify credentials are correct
- Check vendor API status
- Review network connectivity
- Examine audit logs for details

**Auto-Discovery Not Working**
- Check file naming convention (`*-api.ts`)
- Verify export naming (`VendorNameAPI`)
- Check for syntax errors in handler
- Review server logs for errors

### Debug Commands

```bash
# Check credential health
curl -X GET "/api/admin/credentials/health"

# Test specific vendor connection
curl -X POST "/api/admin/vendors/vendor_id/test-connection"

# List available handlers
curl -X GET "/api/admin/vendors/handlers"

# Check vendor configuration
curl -X GET "/api/admin/vendors/configured"
```

## Future Enhancements

### Planned Features
- **Credential rotation** automation
- **Multi-environment** credential management
- **Credential sharing** between organizations
- **Advanced audit** reporting
- **Integration monitoring** dashboards

### Potential Integrations
- **HashiCorp Vault** for enterprise key management
- **AWS Secrets Manager** for cloud deployments
- **Azure Key Vault** for Microsoft environments
- **External audit** systems integration
- **SIEM integration** for security monitoring

This system provides a robust, secure, and scalable foundation for managing vendor credentials across your entire platform, with the flexibility to grow as you add new vendors and expand your business.

# Vendor Onboarding Guide - Updated Process

## Overview

This guide describes the **actual** process for adding new vendors to the system. The system has been designed to minimize code changes and maximize automation.

## 🎯 **Current System Architecture**

### **Existing Vendors (Hardcoded Registration)**
- **Lipsey's, Sports South, Chattanooga, GunBroker, Bill Hicks**
- Use hardcoded registration in `vendor-registry.ts` for **reliability and vendor-specific logic**
- This is **intentional and correct** - not a bug to fix

### **New Vendors (Auto-Discovery)**
- **All new vendors** use the auto-discovery system
- **No code changes** required for new vendor addition
- System automatically registers vendors on startup

## 📋 **Adding New Vendors - Step by Step**

### **Step 1: Create Vendor API Handler** ⭐ **REQUIRED**

Create a new file: `server/[vendor-name]-api.ts`

```typescript
// server/acme-vendor-api.ts
export class AcmeVendorAPI {
  constructor(private credentials: any) {}
  
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Test vendor API connection
      // Return { success: true, message: 'Connected successfully' }
    } catch (error) {
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }
  
  async searchProducts(params: any): Promise<any> {
    // Implement product search
  }
  
  async getProduct(productId: string): Promise<any> {
    // Implement single product lookup
  }
}
```

**Naming Convention**: 
- File: `[vendor-name]-api.ts` (lowercase, hyphens)
- Class: `[VendorName]API` (PascalCase)

### **Step 2: Add Vendor to Database** ⭐ **REQUIRED**

Insert vendor into `supported_vendors` table:

```sql
INSERT INTO supported_vendors (
  name,
  vendor_short_code,
  description,
  api_type,
  credential_fields,
  features,
  name_aliases,
  is_enabled,
  sort_order,
  product_record_priority
) VALUES (
  'Acme Vendor Inc.',
  'acme_vendor',
  'Firearms and accessories distributor',
  'rest_api',
  '[
    {
      "name": "apiKey",
      "label": "API Key",
      "type": "password",
      "required": true,
      "aliases": ["api_key", "key"]
    },
    {
      "name": "username",
      "label": "Username",
      "type": "text",
      "required": true
    }
  ]',
  '{
    "electronicOrdering": true,
    "realTimePricing": true,
    "inventorySync": true,
    "productCatalog": true
  }',
  ARRAY['Acme', 'ACME', 'Acme Vendor', 'acme-vendor'],
  true,
  100,
  6
);
```

### **Step 3: System Auto-Discovery** ✅ **AUTOMATIC**

On server restart, the system will:
1. **Scan** for `*-api.ts` files
2. **Import** the API class
3. **Register** the vendor handler automatically
4. **Log** successful registration

**No manual registration needed!**

### **Step 4: Test Integration** 🧪 **MANUAL**

1. **Restart server** to trigger auto-discovery
2. **Admin > Supported Vendors** - verify vendor appears
3. **Edit Credentials** - enter test credentials
4. **Test Connection** - verify API integration works
5. **Store > Vendor Price Comparison** - test in store interface

### **Step 5: Deploy** 🚀 **AUTOMATIC**

- **No code changes** to existing files
- **No merge conflicts** with other developers
- **Zero downtime** deployment

## 🔧 **Advanced Configuration**

### **Field Aliases** (Schema-Based)

If your vendor API expects different field names, use aliases in the credential schema:

```json
{
  "name": "ftpServer",
  "label": "FTP Server",
  "type": "text",
  "required": true,
  "aliases": ["ftpHost", "server", "hostname"]
}
```

The system will automatically provide all aliases to your API handler.

### **Name Variations** (Database-Based)

If your vendor has multiple name variations, add them to `name_aliases`:

```sql
UPDATE supported_vendors 
SET name_aliases = ARRAY['Acme', 'ACME Corp', 'Acme Vendor', 'acme-api']
WHERE name = 'Acme Vendor Inc.';
```

### **Credential Field Types**

Supported field types with automatic encryption:

| Type | Encrypted | Description |
|------|-----------|-------------|
| `text` | ❌ | Plain text |
| `email` | ❌ | Email address |
| `url` | ❌ | Website URL |
| `password` | ✅ | Encrypted password |
| `apiKey` | ✅ | Encrypted API key |
| `secret` | ✅ | Encrypted secret |
| `token` | ✅ | Encrypted token |

## 🚫 **What NOT to Do**

### ❌ **Don't Modify These Files**
- `server/vendor-registry.ts` - Only for existing vendors
- `server/credential-vault-service.ts` - Core system, no vendor-specific logic
- `shared/schema.ts` - Only for schema changes

### ❌ **Don't Add Hardcoded Logic**
- No vendor-specific `if` statements
- No hardcoded credential field mappings
- No hardcoded name variations

### ❌ **Don't Skip Testing**
- Always test connection before deploying
- Verify credentials work in both admin and store interfaces
- Test error handling with invalid credentials

## 📊 **System Capacity**

### **Current Status**
- **5 existing vendors** (hardcoded registration)
- **Unlimited new vendors** (auto-discovery)
- **Designed for 20+ vendors** without performance issues

### **Scalability Features**
- ✅ **Auto-discovery** - no code changes needed
- ✅ **Schema-based configuration** - database-driven
- ✅ **Encrypted credential storage** - secure by default
- ✅ **Connection testing** - built-in validation
- ✅ **Audit logging** - compliance ready

## 🔍 **Troubleshooting**

### **Vendor Not Auto-Discovered**

**Check:**
1. File naming: `[vendor-name]-api.ts`
2. Class naming: `[VendorName]API`
3. Class is exported: `export class VendorAPI`
4. Server restarted after file creation

**Debug:**
```bash
# Check server logs for auto-discovery
grep "Auto-registered vendor" server.log
grep "Failed to auto-register" server.log
```

### **Connection Test Fails**

**Check:**
1. Credentials are correct in admin interface
2. API handler `testConnection()` method works
3. Network connectivity to vendor API
4. Credential field names match API expectations

### **Store Credentials Not Saving**

**Common Issue**: Field name mismatch between frontend (camelCase) and database (snake_case)

**Check:**
1. Frontend form field names (e.g., `userName`, `customerNumber`)
2. Database column names (e.g., `user_name`, `customer_number`)
3. Add field mapping if needed (see [CREDENTIAL_FIELD_MAPPING_FIX.md](./CREDENTIAL_FIELD_MAPPING_FIX.md))

**Example Fix:**
```typescript
// In frontend component
const mappedCreds = {
  user_name: creds.userName,
  customer_number: creds.customerNumber,
  // ... other fields
};
```

### **Vendor Not Appearing in Store**

**Check:**
1. Vendor `is_enabled = true` in database
2. Store has vendor configured in their vendor list
3. Vendor has proper `features` configuration
4. No errors in browser console

## 📚 **Examples**

### **REST API Vendor**
```typescript
// server/example-vendor-api.ts
export class ExampleVendorAPI {
  constructor(private credentials: { apiKey: string; baseUrl: string }) {}
  
  async testConnection() {
    const response = await fetch(`${this.credentials.baseUrl}/test`, {
      headers: { 'Authorization': `Bearer ${this.credentials.apiKey}` }
    });
    return { 
      success: response.ok, 
      message: response.ok ? 'Connected' : 'Failed to connect' 
    };
  }
}
```

### **FTP Vendor**
```typescript
// server/ftp-vendor-api.ts
export class FtpVendorAPI {
  constructor(private credentials: { ftpHost: string; ftpUsername: string; ftpPassword: string }) {}
  
  async testConnection() {
    const { testFtpConnection } = await import('./ftp-utils');
    return await testFtpConnection({
      host: this.credentials.ftpHost,
      username: this.credentials.ftpUsername,
      password: this.credentials.ftpPassword
    });
  }
}
```

## ✅ **Success Criteria**

A vendor is successfully onboarded when:

1. ✅ **Auto-discovery works** - vendor appears in logs
2. ✅ **Admin interface works** - vendor appears in supported vendors
3. ✅ **Credential entry works** - form validates and saves
4. ✅ **Connection test works** - test button returns success
5. ✅ **Store integration works** - vendor appears in price comparison
6. ✅ **Error handling works** - graceful failure with invalid credentials

---

## 📈 **Migration Notes**

### **From Old System**
If migrating from the old hardcoded system:

1. **Keep existing vendors** as hardcoded (they work reliably)
2. **Use auto-discovery** for all new vendors
3. **Don't migrate existing vendors** unless there's a specific need

### **Database Schema Updates**
Recent improvements include:
- ✅ **Field aliases** support in credential schema
- ✅ **Name aliases** for vendor lookup variations
- ✅ **Schema-based field aliasing** (no more hardcoded logic)

---

**Last Updated**: September 27, 2025  
**System Version**: Auto-Discovery v2.0  
**Status**: Production Ready

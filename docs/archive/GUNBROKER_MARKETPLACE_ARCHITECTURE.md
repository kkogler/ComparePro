# GunBroker Marketplace Architecture Documentation

## Overview
GunBroker is implemented as a **marketplace** rather than a traditional **vendor**, requiring a fundamentally different credential and access architecture compared to other integrated vendors.

## Marketplace vs Vendor Architecture

### 🏪 **Traditional Vendors** (Chattanooga, Sports South, Bill Hicks, Lipsey's)

**Business Model**: Direct dealer relationships
- Each store has individual dealer accounts with the vendor
- Store-specific pricing based on dealer terms and volume
- Store-specific inventory allocation and credit terms

**Technical Implementation**:
- **Credentials**: Store-level (50 stores = 50 credential sets)
- **Database**: `companyVendorCredentials` table
- **API Calls**: Each store uses their own credentials
- **Pricing**: Dealer-specific pricing returned by vendor APIs

**Required Fields per Store**:
```typescript
// Chattanooga
{ sid: "store-specific", token: "store-specific" }

// Sports South  
{ userName: "store-account", password: "store-password", customerNumber: "store-number", source: "store-source" }

// Bill Hicks
{ ftpServer: "store-ftp", ftpUsername: "store-user", ftpPassword: "store-pass" }

// Lipsey's
{ email: "store@email.com", password: "store-password" }
```

### 🏛️ **GunBroker Marketplace**

**Business Model**: Public marketplace aggregator
- Single API access serves all stores
- Public marketplace pricing (not dealer-specific)
- No individual dealer relationships required
- Stores control visibility via enable/disable toggles

**Technical Implementation**:
- **Credentials**: Admin-level only (50 stores = 1 credential set)
- **Database**: `supportedVendors.adminCredentials` 
- **API Calls**: Single admin credentials for all requests
- **Store Control**: Per-store `enabledForPriceComparison` toggle

**Required Fields (Admin-Only)**:
```typescript
// GunBroker Admin Credentials
{
  devKey: "shared-admin-dev-key",
  environment: "production" | "sandbox", 
  buyNowOnly: true
}
```

## Current vs Intended Architecture

### ❌ **Current Implementation (Incorrect)**

**Location**: Store > Supported Vendors > GunBroker > Configure
**Storage**: `companyVendorCredentials` table (per-store)
**Workflow**:
1. Each store must enter their own GunBroker DevKey
2. Store-level credential storage and management
3. 50 stores = 50 separate DevKey configurations

**Problems**:
- Treats marketplace like a vendor
- Unnecessary credential duplication across stores
- Administrative overhead for credential management
- Inconsistent with marketplace business model

### ✅ **Intended Implementation (Correct)**

**Admin Configuration**: Admin > Supported Vendors > GunBroker Sync Settings
**Storage**: `supportedVendors.adminCredentials` (system-wide)
**Store Control**: Store > Supported Vendors > GunBroker > Enable/Disable Toggle

**Workflow**:
1. **Admin configures once**: Single DevKey in admin panel
2. **Stores control visibility**: Enable/disable toggle per store
3. **Price comparison**: Uses admin credentials + store toggle check
4. **50 stores = 1 credential + 50 toggles**

## Implementation Architecture

### 🔧 **Admin-Level Configuration**

**Location**: `Admin > Supported Vendors > GunBroker Sync Settings`

**Required Fields**:
- `devKey` - GunBroker Developer API Key
- `environment` - "sandbox" or "production"  
- `buyNowOnly` - Filter to Buy Now items only (boolean)

**Storage**:
```sql
-- supportedVendors table
UPDATE supported_vendors 
SET admin_credentials = '{
  "devKey": "your-admin-dev-key",
  "environment": "production",
  "buyNowOnly": true
}'
WHERE name ILIKE '%gunbroker%';
```

### 🏪 **Store-Level Control**

**Location**: `Store > Supported Vendors > GunBroker Tile`

**Available Controls**:
- **Enable/Disable Toggle**: Controls `enabledForPriceComparison` flag
- **Status Display**: Shows "Uses Admin Credentials" instead of credential form
- **Test Connection**: Tests using admin credentials

**Storage**:
```sql
-- vendors table (per-store)
UPDATE vendors 
SET enabled_for_price_comparison = true/false
WHERE company_id = ? AND supported_vendor_id = ?;
```

### 🔍 **Price Comparison Flow**

**Vendor Price Lookup Process**:
1. **Check Store Toggle**: Verify `enabledForPriceComparison = true`
2. **Get Admin Credentials**: Retrieve from `supportedVendors.adminCredentials`
3. **API Call**: Use admin DevKey for GunBroker API
4. **Return Results**: Standard marketplace pricing data

**Code Flow**:
```typescript
// Check if store has GunBroker enabled
if (!vendor.enabledForPriceComparison) {
  return { availability: 'disabled', message: 'GunBroker disabled for this store' };
}

// Get admin credentials (not store credentials)
const adminCredentials = supportedVendor.adminCredentials;
if (!adminCredentials?.devKey) {
  return { availability: 'config_required', message: 'Admin DevKey not configured' };
}

// Make API call with admin credentials
const gunbrokerAPI = new GunBrokerAPI(adminCredentials);
const results = await gunbrokerAPI.searchProducts(searchParams);
```

## Security Considerations

### ✅ **Admin Credential Security**
- **Encryption**: Admin DevKey encrypted in database
- **Access Control**: Only platform admins can configure
- **Audit Logging**: All admin credential changes logged
- **Key Rotation**: Centralized key management

### ✅ **Store-Level Security**  
- **No Sensitive Data**: Stores only control enable/disable
- **No Credential Access**: Stores cannot view or modify DevKey
- **Audit Trail**: Store toggle changes logged per organization

## Migration Strategy

### Phase 1: Admin Configuration
1. **Create admin DevKey field** in GunBroker supported vendor
2. **Admin UI updates** to configure marketplace credentials
3. **Test admin credential storage** and encryption

### Phase 2: Store UI Updates  
1. **Remove credential configuration** from store GunBroker tile
2. **Add enable/disable toggle** with clear messaging
3. **Update status displays** to show "Uses Admin Credentials"

### Phase 3: API Integration
1. **Update price comparison logic** to use admin credentials
2. **Add store toggle validation** before API calls
3. **Test end-to-end flow** with admin credentials + store toggles

### Phase 4: Data Migration
1. **Migrate existing store DevKeys** to admin level (if applicable)
2. **Clean up store-level credentials** from database
3. **Update documentation** and user guides

## Benefits of Marketplace Architecture

### 🎯 **Operational Benefits**
- **Reduced Admin Overhead**: Single credential to manage vs 50
- **Consistent API Access**: No store-specific credential issues
- **Simplified Onboarding**: New stores automatically get GunBroker access
- **Centralized Control**: Admin can disable GunBroker system-wide if needed

### 🔒 **Security Benefits**
- **Credential Consolidation**: Single point of credential management
- **Reduced Attack Surface**: Fewer credentials stored in system
- **Centralized Monitoring**: Single API key to monitor for usage/abuse
- **Simplified Rotation**: One key to rotate instead of many

### 💰 **Business Benefits**
- **Accurate Business Model**: Reflects marketplace vs dealer relationship
- **Scalability**: Easy to add new stores without credential setup
- **Cost Efficiency**: Potential API usage optimization
- **User Experience**: Simpler store configuration process

## Comparison Summary

| Aspect | Traditional Vendors | GunBroker Marketplace |
|--------|-------------------|---------------------|
| **Business Model** | Dealer relationships | Public marketplace |
| **Credentials** | Store-level (50 sets) | Admin-level (1 set) |
| **Pricing** | Dealer-specific | Public marketplace |
| **Store Setup** | Credential configuration | Enable/disable toggle |
| **Admin Overhead** | High (manage 50 accounts) | Low (manage 1 account) |
| **API Usage** | Store-specific calls | Shared admin calls |
| **Security Model** | Distributed credentials | Centralized credentials |

## Conclusion

The GunBroker marketplace architecture correctly distinguishes between vendor relationships (requiring individual dealer credentials) and marketplace access (requiring only shared API access with per-store visibility controls). This architecture reduces administrative overhead, improves security, and accurately reflects the business relationship model.

The implementation should prioritize admin-level credential management with store-level visibility controls, ensuring both operational efficiency and appropriate access control for each store's price comparison needs.

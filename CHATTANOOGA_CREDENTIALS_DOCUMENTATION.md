# Chattanooga Credentials Documentation

## Overview
Chattanooga Shooting Supplies Inc. uses two different credential systems depending on the use case:

1. **Admin Credentials** - For Master Product Catalog synchronization
2. **Store Credentials** - For Vendor Price Comparison searches

## Admin Credentials (Master Product Catalog Sync)

**Purpose**: Used by the system to sync the Master Product Catalog with Chattanooga's full product database.

**Location**: Admin > Supported Vendors > Chattanooga Sync Settings

**Required Fields**:
- `accountNumber` - Chattanooga account number
- `username` - Chattanooga dealer portal username  
- `password` - Chattanooga dealer portal password
- `sid` - Chattanooga API SID
- `token` - Chattanooga API Token

**Usage**: These credentials are used for:
- Full catalog synchronization
- Product data import
- Master Product Catalog updates

## Store Credentials (Vendor Price Comparison)

**Purpose**: Used by individual stores for real-time pricing and availability during Vendor Price Comparison searches.

**Location**: Store > Demo Gun Store > Supported Vendors > Configure Chattanooga Shooting Supplies Inc.

**Required Fields**:
- `sid` - Chattanooga API SID
- `token` - Chattanooga API Token

**Usage**: These credentials are used for:
- Real-time product searches
- Store-specific pricing
- Inventory availability checks
- Vendor Price Comparison results

## API Authentication

The Chattanooga API uses a specific authentication format:
- **Format**: `Basic SID:MD5(Token)`
- **Method**: Direct format (no Base64 encoding)
- **Example**: `Basic D1EEB7BB0C58A27C6FEA7B4339F5251C:6D7012A0C5AC75A7252684A0ACE91579`

## Store-Level API Calls

When a store performs a Vendor Price Comparison search:

1. **Credential Check**: System verifies store has `sid` and `token`
2. **API Call**: Uses store credentials to call Chattanooga API
3. **Store-Specific Results**: Returns pricing specific to that store's dealer terms
4. **Real-Time Data**: Gets current inventory and pricing

## Error Handling

If store credentials are missing or invalid:
- **Status**: `config_required`
- **Message**: "Chattanooga API credentials required (SID and Token)"
- **Action**: Store must configure credentials in Store > Supported Vendors

## Security Notes

- Store credentials are stored encrypted in the database
- Each store has its own credentials for store-specific pricing
- Admin credentials are separate and used only for system-level operations
- Store credentials are not shared between organizations

## Troubleshooting

### Store Credentials Not Working
1. Verify SID and Token are correct
2. Check that credentials are saved in Store > Supported Vendors
3. Test connection using "Test Connection" button
4. Ensure credentials are not expired

### Admin Credentials Not Working  
1. Verify all 5 fields are provided (accountNumber, username, password, sid, token)
2. Check credentials in Admin > Supported Vendors
3. Test connection using admin test function
4. Contact Chattanooga support if API access issues persist

## Implementation Details

The system automatically:
- Uses store credentials for Vendor Price Comparison
- Uses admin credentials for Master Product Catalog sync
- Handles credential validation and error messages
- Provides appropriate API authentication for each use case

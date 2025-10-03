# Pricing Architecture: Real-Time Vendor API System

## Overview

This document defines the critical pricing architecture for the multi-tenant retail management platform. **ALL PRICING DATA MUST COME FROM REAL-TIME VENDOR API CALLS** - no stored pricing is allowed in the Master Product Catalog.

## Master Product Catalog: Identification Only

The Master Product Catalog serves as a **universal product identification system** shared across all organizations. It contains:

### ✅ ALLOWED Data
- **Product Identification**: UPC, manufacturer part numbers, SKUs
- **Product Information**: Name, brand, model, description, specifications
- **Universal Compliance Data**: FFL required, serialized flags (industry-wide standards)
- **Physical Attributes**: Weight, dimensions, category, caliber
- **Images**: Product images with source tracking

### ❌ PROHIBITED Data
- **MSRP** (Manufacturer Suggested Retail Price)
- **MAP** (Minimum Advertised Price) 
- **Cost/Price** from any vendor
- **Availability/Stock** quantities
- **Drop shipping availability** (vendor-specific)
- **Vendor-specific pricing** or fulfillment data of any kind

## Real-Time Pricing System

### Organization-Specific Pricing
Organizations only see pricing for products from their **connected vendors** via live API calls:

1. **Universal Search**: All organizations search the same Master Product Catalog
2. **Vendor Filtering**: Results show which connected vendors carry each product
3. **Live API Calls**: Pricing fetched in real-time using UPC or part number
4. **Dynamic Display**: Current pricing, availability, and vendor-specific details

### API Call Architecture
```javascript
// Vendor comparison endpoint calls live APIs
app.get("/org/:slug/api/products/:id/vendors", async (req, res) => {
  // 1. Get product from Master Catalog (identification only)
  const product = await storage.getProduct(productId);
  
  // 2. Get organization's connected vendors
  const vendors = await storage.getVendorsByOrganization(organizationId);
  
  // 3. Make real-time API calls to each vendor
  for (const vendor of vendors) {
    const apiResult = await vendorAPI.searchProduct({
      upc: product.upc,
      partNumber: product.partNumber,
      brand: product.brand
    });
    // Return live pricing data
  }
});
```

## Error Handling: No Fallback Pricing

When vendor API calls fail, the system displays **clear error states** without fallback pricing:

### API Error Categories
- **Authentication Failed**: Credentials invalid or need activation
- **Access Required**: Account needs API access activation
- **Product Not Found**: Product not in vendor's catalog
- **API Error**: Technical issue with vendor API
- **Rate Limited**: Too many API calls

### Example Error Display
```
Chattanooga Shooting Supplies
❌ API Access Required
Contact your sales representative to activate API access
```

## Benefits of Real-Time Pricing

1. **Accuracy**: Current pricing, never stale
2. **Vendor-Specific**: Organizations see only their negotiated pricing
3. **Inventory Sync**: Live availability data
4. **Compliance**: Prevents pricing data from being exposed to unauthorized organizations
5. **Scalability**: New vendors can be added without changing stored pricing data

## Implementation Status

### ✅ Completed (January 9, 2025)
- Removed `msrp`, `map_price`, `retail_price` columns from products table
- Updated schema documentation to reflect identification-only approach
- Added critical architecture rules prohibiting stored pricing
- Vendor comparison endpoint uses real-time API calls

### ⚠️ Pending
- Chattanooga API credentials need activation (Error 4001)
- Other vendor API integrations need credential configuration
- Error state UI improvements for better user feedback

## Database Schema Changes

```sql
-- REMOVED: These vendor-specific columns have been dropped from products table
-- msrp DECIMAL(10,2)
-- map_price DECIMAL(10,2) 
-- retail_price DECIMAL(10,2)
-- drop_ship_available BOOLEAN
-- drop_ship_options TEXT[]

-- KEPT: Universal product identification and compliance only
-- upc, name, brand, model, part_number
-- serialized, serialized (industry-wide compliance)
-- description, specifications, category, weight
```

## Critical Rules Summary

1. **NO PRICING IN MASTER CATALOG**: Products table contains zero pricing fields
2. **REAL-TIME API ONLY**: All pricing comes from live vendor API calls
3. **NO FALLBACK PRICING**: Display clear error states when APIs fail
4. **ORGANIZATION-SPECIFIC**: Pricing only visible for connected vendors
5. **AUTHENTIC DATA ONLY**: No mock, dummy, or placeholder pricing data

This architecture ensures data integrity, pricing accuracy, and proper multi-tenant isolation while maintaining the universal product search capability that is core to the platform's value proposition.
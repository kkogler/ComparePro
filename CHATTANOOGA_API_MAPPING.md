# Chattanooga API Response Mapping to PriceCompare Pro

## Sample Chattanooga API Product Response

Based on the official Chattanooga Shooting Supplies API v5 documentation, here's a typical product response:

```json
{
  "cssi_id": "GLK-G19-G5-FS",
  "name": "GLOCK 19 Gen5 FS Front Serrations 9mm Luger 4.02\" 15+1 Black Polymer Grip Black nDLC Finish",
  "upc": "764503913051",
  "manufacturer": "GLOCK",
  "model": "G19 Gen5 FS",

  
  // Pricing fields (real-time from API)
  "custom_price": 425.50,
  "retail_price": 559.00,
  "map_price": 540.00,
  "retail_map_price": 540.00,
  "msrp": 649.00,
  "drop_ship_price": 445.75,
  
  // Inventory status
  "inventory": 12,
  "in_stock_flag": 1,
  
  // Firearms compliance
  "serialized_flag": 1,
  "ffl_flag": 1,
  "allocated": 0,
  
  // Drop shipping
  "drop_ship_flag": 1,
  "available_drop_ship_delivery_options": "Standard Ground,2-Day,Next Day",
  
  // Additional details
  "weight": 1.85,
  "specifications": {
    "action": "Striker Fired",
    "barrel_length": "4.02",
    "overall_length": "7.36",
    "capacity": "15+1",
    "finish": "nDLC"
  },
  "custom_properties": {
    "generation": "5",
    "frame_size": "Compact",
    "safety_features": "Safe Action System"
  }
}
```

## Field Mapping to PriceCompare Pro Database

| Chattanooga API Field | PriceCompare Pro Field | Type | Notes |
|----------------------|------------------------|------|-------|
| `cssi_id` | `partNumber` | text | Chattanooga's internal product ID |
| `name` | `name` | text | Full product name |
| `upc` | `upc` | text | Universal Product Code (unique) |
| `manufacturer` | `brand` | text | Brand/manufacturer name |
| `model` | `model` | text | Product model number |

| `weight` | `weight` | decimal | Product weight in pounds |
| `specifications` | `specifications` | json | Technical specifications object |
| `custom_properties` | `customProperties` | json | Additional vendor-specific data |

### Firearms Compliance Fields

| Chattanooga API Field | PriceCompare Pro Field | Type | Notes |
|----------------------|------------------------|------|-------|
| `serialized_flag` | `serialized` | boolean | Product has serial number |
| `allocated` | `allocated` | boolean | Special ordering requirements |

### Pricing Fields (Real-time from API)

| Chattanooga API Field | PriceCompare Pro Field | Type | Storage |
|----------------------|------------------------|------|---------|
| `retail_price` | `retailPrice` | decimal | Master catalog reference |
| `map_price` | `mapPrice` | decimal | Master catalog reference |
| `custom_price` | N/A | decimal | Real-time vendor pricing only |
| `drop_ship_price` | N/A | decimal | Real-time vendor pricing only |
| `msrp` | N/A | decimal | Real-time vendor pricing only |

### Drop Shipping Fields

| Chattanooga API Field | PriceCompare Pro Field | Type | Notes |
|----------------------|------------------------|------|-------|
| `drop_ship_flag` | `dropShipAvailable` | boolean | Can be drop shipped |
| `available_drop_ship_delivery_options` | `dropShipOptions` | text[] | Array of shipping options |

### Inventory Fields (Real-time only)

| Chattanooga API Field | Usage | Notes |
|----------------------|-------|-------|
| `inventory` | Real-time display | Not stored in database |
| `in_stock_flag` | Real-time display | Not stored in database |

## Data Processing Logic

### 1. Master Product Catalog Population
```typescript
// When importing to Master Catalog from Chattanooga CSV/API
const productData = {
  upc: chattanoogaProduct.upc,
  name: chattanoogaProduct.name,
  brand: chattanoogaProduct.manufacturer,
  model: chattanoogaProduct.model,
  partNumber: chattanoogaProduct.cssi_id,
  source: "Chattanooga Shooting Supplies",
  
  // Firearms compliance
  fflRequired: Boolean(chattanoogaProduct.ffl_flag),
  serialized: Boolean(chattanoogaProduct.serialized_flag),
  allocated: Boolean(chattanoogaProduct.allocated),
  
  // Reference pricing (not real-time)
  mapPrice: chattanoogaProduct.map_price,
  retailPrice: chattanoogaProduct.retail_price,
  
  // Drop shipping capabilities
  dropShipAvailable: Boolean(chattanoogaProduct.drop_ship_flag),
  dropShipOptions: chattanoogaProduct.available_drop_ship_delivery_options?.split(',') || [],
  
  // Enhanced data
  weight: chattanoogaProduct.weight,
  specifications: chattanoogaProduct.specifications,
  customProperties: chattanoogaProduct.custom_properties,

};
```

### 2. Real-time Pricing API Calls
```typescript
// When organization requests current pricing
const realtimeData = {
  productId: product.id,
  vendorPrice: chattanoogaResponse.custom_price,
  mapPrice: chattanoogaResponse.map_price,
  msrp: chattanoogaResponse.msrp,
  dropShipPrice: chattanoogaResponse.drop_ship_price,
  inventory: chattanoogaResponse.inventory,
  inStock: Boolean(chattanoogaResponse.in_stock_flag),
  lastUpdated: new Date()
};
```

## Authentication Requirements

Chattanooga API uses Basic Authentication with a specific format:
- **Header**: `Authorization: Basic SID:MD5(Token)`
- **Note**: Direct format, NO Base64 encoding
- **Example**: `Basic 12345:a1b2c3d4e5f6789...`

## Data Source Verification

All products imported from Chattanooga API are tagged with:
- `source: "Chattanooga Shooting Supplies"`
- `createdAt`: Import timestamp
- `updatedAt`: Last modification

This ensures full data lineage and authenticity tracking for commercial deployment.
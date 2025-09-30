# Vendor Image URL Management Guide

## Overview

All vendor image URLs are now managed centrally through the `VendorImageService` in `/server/vendor-image-urls.ts`. This ensures consistency and makes adding new vendors simple.

## Current Supported Vendors

### Image URL Generation (Dynamic)
These vendors have predictable URL patterns that we generate:

- **Sports South**: `https://media.server.theshootingwarehouse.com/hires/{identifier}.png`
  - Uses PICREF if available, falls back to ITEMNO
  - High-resolution PNG format

- **Bill Hicks**: `https://billhicksco.hostedftp.com/files/path/BHC+Digital+Images+ALL/Website/{encoded_sku}.jpg`
  - Uses product name as filename with URL encoding
  - Standard JPG format

### Image URL from API/CSV (Provided)
These vendors provide image URLs in their data:

- **Chattanooga Shooting Supplies**: URLs provided in CSV data
- **Lipsey's**: URLs provided in API responses  
- **GunBroker**: URLs provided in API responses

## Adding a New Vendor

### For Vendors with Predictable URL Patterns:

1. **Add to the switch statement** in `VendorImageService.getImageUrl()`:

```typescript
case 'new vendor name':
case 'new vendor alias':
  return `https://newvendor.com/images/${cleanSku}.jpg`;
```

2. **Add vendor info** in `VendorImageService.getVendorImageInfo()`:

```typescript
case 'new vendor name':
  return {
    format: 'JPG',
    quality: 'Standard',
    notes: 'Uses SKU as filename'
  };
```

3. **Add to supports generation** in `VendorImageService.supportsImageGeneration()`:

```typescript
return ['sports south', 'bill hicks', 'new vendor name'].includes(normalizedVendorName);
```

### For Vendors that Provide URLs:

Simply add a case that returns `null` - the sync process will use the provided URLs:

```typescript
case 'vendor that provides urls':
  // URLs provided in API/CSV data during sync
  return null;
```

## Testing New Vendors

Use the test script to verify URL generation:

```bash
npx tsx -e "
import { VendorImageService } from './server/vendor-image-urls';
const url = VendorImageService.getImageUrl('New Vendor', 'TEST-SKU');
console.log('Generated URL:', url);
"
```

## Benefits of This Approach

- **Single Source of Truth**: All URL generation in one place
- **Consistency**: Same format across all sync services
- **Maintainability**: Adding vendors requires minimal code changes
- **Reliability**: Centralized logic reduces bugs and inconsistencies
- **Scalability**: Easy to add 10+ new vendors

## Migration Status

✅ **Completed**:
- Created centralized `VendorImageService`
- Updated `sports-south-simple-sync.ts`
- Updated `sports-south-catalog-sync.ts`  
- Updated `sports-south-api.ts`
- Updated `image-fallback-service.ts`
- All services now use consistent URL generation

The old URL generation methods are marked as `@deprecated` but still work as fallbacks for safety.

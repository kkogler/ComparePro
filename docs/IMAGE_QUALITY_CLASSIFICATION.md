# Image Quality Classification System

**Date:** October 15, 2025  
**Status:** ✅ Active  

---

## Overview

The Master Product Catalog uses an **Image Quality Classification System** to ensure products always display the best available images. Vendors are classified as either **High Quality Image Vendors** or **Low Quality Image Vendors**.

---

## Vendor Classifications

### High Quality Image Vendors

Vendors that provide professional product photography with high resolution and consistent quality:

| Vendor | Image Quality | Data Quality | Description |
|--------|---------------|--------------|-------------|
| **Sports South** | High | High | Major firearms distributor with high-resolution images and detailed specifications |
| **Lipsey's** | High | High | Premium firearms distributor with high-quality professional product photography |
| **Bill Hicks & Co.** | High | High | Established firearms distributor with professional product images |

### Low Quality Image Vendors

Vendors with variable image quality, lower resolution, or user-generated content:

| Vendor | Image Quality | Data Quality | Description |
|--------|---------------|--------------|-------------|
| **Chattanooga Shooting Supplies** | Low | High | Firearms distributor with variable image quality |
| **GunBroker API** | Low | Medium | Online marketplace with user-generated content and variable image quality |

---

## Image Update Rules

The system automatically manages product images based on quality levels:

### Rule Matrix

| Current Image State | Incoming Image | Action | Result |
|---------------------|----------------|--------|--------|
| **No image** | High quality | ✅ Add | High quality image added |
| **No image** | Low quality | ✅ Add | Low quality image added (fallback) |
| **Low quality** | High quality | ✅ Upgrade | Low quality replaced with high quality |
| **Low quality** | Low quality | ❌ Skip | Keep existing (no replacement) |
| **High quality** | High quality | ❌ Skip | Keep existing (no replacement) |
| **High quality** | Low quality | ❌ Skip | Keep existing (no downgrade) |

### Key Principles

1. **High quality images are preserved** - Never replaced by another image (high or low quality)
2. **Low quality images can be upgraded** - Replaced only by high quality images
3. **Always add to empty products** - Both quality levels can fill empty image slots
4. **No lateral replacements** - Same quality level cannot replace same quality level

---

## Code Configuration

### File: `shared/vendor-type-config.ts`

```typescript
export const VENDOR_TYPE_CONFIG: Record<string, VendorTypeConfig> = {
  // High Quality Image Vendors
  'Lipsey\'s': {
    imageQuality: 'high',
    dataQuality: 'high',
    description: 'Premium firearms distributor with high-quality professional product photography'
  },
  
  'Sports South': {
    imageQuality: 'high',
    dataQuality: 'high',
    description: 'Major firearms distributor with high-resolution images'
  },
  
  'Bill Hicks': {
    imageQuality: 'high',
    dataQuality: 'high',
    description: 'Established firearms distributor with professional product images'
  },
  
  // Low Quality Image Vendors
  'Chattanooga Shooting Supplies': {
    imageQuality: 'low',
    dataQuality: 'high',
    description: 'Firearms distributor with variable image quality'
  },
  
  'GunBroker API': {
    imageQuality: 'low',
    dataQuality: 'medium',
    description: 'Online marketplace with variable image quality'
  }
};
```

### Helper Functions

```typescript
// Check if vendor has high quality images
hasHighQualityImages(vendorName: string): boolean

// Check if vendor has low quality images
hasLowQualityImages(vendorName: string): boolean
```

---

## Sync Behavior Examples

### Example 1: Empty Product

1. **GunBroker** (low quality) syncs first
   - No existing image
   - ✅ GunBroker image added
   - `imageSource: "GunBroker API"`

2. **Lipsey's** (high quality) syncs later
   - Existing image is low quality (GunBroker)
   - ✅ Image upgraded to Lipsey's
   - `imageSource: "Lipsey's"` (replaced)

### Example 2: High Quality Image Protection

1. **Lipsey's** (high quality) syncs first
   - No existing image
   - ✅ Lipsey's image added
   - `imageSource: "Lipsey's"`

2. **Sports South** (high quality) syncs later
   - Existing image is high quality (Lipsey's)
   - ❌ Keep existing Lipsey's image
   - `imageSource: "Lipsey's"` (unchanged)

3. **GunBroker** (low quality) syncs later
   - Existing image is high quality (Lipsey's)
   - ❌ Keep existing Lipsey's image
   - `imageSource: "Lipsey's"` (unchanged)

### Example 3: Low Quality Protection

1. **Chattanooga** (low quality) syncs first
   - No existing image
   - ✅ Chattanooga image added
   - `imageSource: "Chattanooga Shooting Supplies"`

2. **GunBroker** (low quality) syncs later
   - Existing image is low quality (Chattanooga)
   - ❌ Keep existing Chattanooga image
   - `imageSource: "Chattanooga Shooting Supplies"` (unchanged)

---

## Database Schema

### Products Table

```sql
image_url          TEXT      -- URL to the product image
image_source       TEXT      -- Vendor name that provided the image
source             TEXT      -- Vendor that provided the product data (may differ from imageSource)
```

**Note:** `imageSource` can be different from `source`:
- **`source`** = Vendor that provided product info (name, caliber, specs)
- **`imageSource`** = Vendor that provided the image (may be upgraded later)

---

## Migration Notes

### Previous System

Previously used "vendor" vs "marketplace" terminology:
- Vendors = High quality
- Marketplaces = Low quality

### Current System

Now uses explicit "High Quality" vs "Low Quality" terminology for clarity:
- High Quality Image Vendors
- Low Quality Image Vendors

### Backward Compatibility

The `isMarketplace()` function is deprecated but remains for backward compatibility:

```typescript
// @deprecated Use hasLowQualityImages() instead
export function isMarketplace(vendorName: string): boolean {
  return hasLowQualityImages(vendorName);
}
```

---

## Testing Verification

To verify image quality classification:

```bash
# Query a product's image source
SELECT upc, name, image_source, source 
FROM products 
WHERE upc = '123456789012';
```

Expected behavior:
- `image_source` should always be from high quality vendor if available
- `image_source` can differ from `source` (upgraded images)
- Low quality images only exist when no high quality alternative available

---

## Adding New Vendors

When adding a new vendor, classify their image quality in `vendor-type-config.ts`:

```typescript
'New Vendor Name': {
  imageQuality: 'high' | 'low',  // Classify based on image quality
  dataQuality: 'high' | 'medium' | 'low',
  description: 'Description of vendor and image quality'
}
```

**Classification Guidelines:**
- **High Quality**: Professional product photography, consistent lighting, high resolution (1000px+)
- **Low Quality**: Variable quality, user-generated, lower resolution, inconsistent backgrounds

---

## Related Files

- `shared/vendor-type-config.ts` - Vendor classification configuration
- `server/sports-south-simple-sync.ts` - Sports South image sync logic
- `server/image-service.ts` - Image update service
- `server/image-fallback-service.ts` - Image fallback logic


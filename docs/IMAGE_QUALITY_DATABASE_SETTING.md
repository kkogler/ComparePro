# Image Quality - Database Configuration

**Date:** October 15, 2025  
**Status:** ✅ Implemented  

---

## Overview

Image quality classification has been moved from hardcoded configuration to a database field (`imageQuality`) on the `supported_vendors` table. This allows dynamic configuration per vendor without code changes.

---

## Database Changes

### New Field

**Table:** `supported_vendors`  
**Column:** `image_quality`  
**Type:** `TEXT`  
**Default:** `'high'`  
**Values:** `'high'` or `'low'`

### Migration

Migration file created: `migrations/0001_flippant_dark_beast.sql`

```sql
ALTER TABLE "supported_vendors" 
ADD COLUMN "image_quality" TEXT DEFAULT 'high';
```

### Current Settings

| Vendor | Image Quality |
|--------|---------------|
| **Sports South** | HIGH 🌟 |
| **Lipsey's Inc.** | HIGH 🌟 |
| **Bill Hicks & Co.** | HIGH 🌟 |
| **Chattanooga Shooting Supplies Inc.** | LOW 📷 |
| **GunBroker.com LLC** | LOW 📷 |

---

## Code Updates

### 1. Schema (`shared/schema.ts`)

Added `imageQuality` field to schema:

```typescript
export const supportedVendors = pgTable("supported_vendors", {
  // ... existing fields ...
  
  // Image quality classification for Master Product Catalog
  imageQuality: text("image_quality").default("high"), // 'high' or 'low' - controls image replacement priority
  
  // ... rest of fields ...
});
```

### 2. Config Module (`shared/vendor-type-config.ts`)

Added database lookup function:

```typescript
/**
 * Get vendor image quality from database (for dynamic configuration)
 * This is now the preferred method - reads from supported_vendors.imageQuality
 * Falls back to hardcoded config if database value not available
 */
export async function getVendorImageQualityFromDB(vendorName: string): Promise<'high' | 'low'> {
  try {
    const { db } = await import('../server/db');
    const { supportedVendors } = await import('./schema');
    const { eq } = await import('drizzle-orm');
    
    const [vendor] = await db
      .select({ imageQuality: supportedVendors.imageQuality })
      .from(supportedVendors)
      .where(eq(supportedVendors.name, vendorName))
      .limit(1);
    
    if (vendor && vendor.imageQuality) {
      return vendor.imageQuality as 'high' | 'low';
    }
    
    // Fallback to hardcoded config
    const config = VENDOR_TYPE_CONFIG[vendorName];
    return config?.imageQuality || 'high'; // Default to high quality
    
  } catch (error) {
    console.warn(`Failed to get image quality from DB for ${vendorName}, using fallback:`, error);
    const config = VENDOR_TYPE_CONFIG[vendorName];
    return config?.imageQuality || 'high';
  }
}
```

### 3. Sports South Sync (`server/sports-south-simple-sync.ts`)

Updated to use database lookup:

```typescript
// Before (hardcoded):
const isSportsSouthHighQuality = hasHighQualityImages('Sports South');
const existingImageIsLowQuality = product.imageSource && hasLowQualityImages(product.imageSource);

// After (database):
const sportsSouthQuality = await getVendorImageQualityFromDB('Sports South');
const isSportsSouthHighQuality = sportsSouthQuality === 'high';

const existingImageQuality = product.imageSource ? await getVendorImageQualityFromDB(product.imageSource) : null;
const existingImageIsLowQuality = existingImageQuality === 'low';
```

---

## How to Update Image Quality

### Option 1: Direct SQL

```sql
-- Set Chattanooga as low quality
UPDATE supported_vendors 
SET image_quality = 'low' 
WHERE name = 'Chattanooga Shooting Supplies Inc.';

-- Set GunBroker as low quality
UPDATE supported_vendors 
SET image_quality = 'low' 
WHERE name = 'GunBroker.com LLC';

-- Set Sports South as high quality
UPDATE supported_vendors 
SET image_quality = 'high' 
WHERE name = 'Sports South';
```

### Option 2: Script (Provided)

```bash
npx tsx scripts/upgrade-chattanooga-images.ts
```

This script:
- Shows current image quality settings
- Lists products with low quality images
- Provides instructions for upgrading images

---

## Upgrading Chattanooga Images

### Automatic Upgrade (Recommended)

1. Go to **Admin > Supported Vendors > Lipsey's > Sync Settings**
2. Click **"Manual Sync"** to trigger catalog sync
3. Go to **Admin > Supported Vendors > Sports South > Sync Settings**
4. Click **"Manual Sync"** to trigger catalog sync

During the sync, the system will:
- ✅ Detect Chattanooga images (now classified as low quality)
- ✅ Replace them with high quality images from Lipsey's/Sports South
- ✅ Update `imageSource` field automatically

### Progress Tracking

**Before sync:**
```sql
SELECT COUNT(*) FROM products 
WHERE image_source = 'Chattanooga Shooting Supplies Inc.';
-- Result: 5,564 products
```

**After sync (expected):**
```sql
SELECT COUNT(*) FROM products 
WHERE image_source = 'Chattanooga Shooting Supplies Inc.';
-- Result: Much lower (only products not available from high quality vendors)
```

---

## Benefits

### 1. **Dynamic Configuration**
- Change image quality classification without code changes
- No redeployment needed

### 2. **Per-Vendor Control**
- Fine-grained control over each vendor's image quality
- Easy to reclassify vendors based on actual image quality

### 3. **Automatic Image Upgrades**
- Low quality images automatically replaced during catalog syncs
- High quality images protected from being downgraded

### 4. **Backward Compatibility**
- Hardcoded config still available as fallback
- Existing code continues to work

---

## Future Enhancements

### Add UI Control (Pending)

Add image quality selector to Admin > Supported Vendors interface:

```typescript
// In SupportedVendorsAdmin.tsx
<Select 
  value={vendor.imageQuality || 'high'}
  onValueChange={(value) => updateVendorImageQuality(vendor.id, value)}
>
  <SelectItem value="high">High Quality 🌟</SelectItem>
  <SelectItem value="low">Low Quality 📷</SelectItem>
</Select>
```

### Add API Endpoint

```typescript
// PATCH /api/admin/supported-vendors/:id/image-quality
app.patch('/api/admin/supported-vendors/:id/image-quality', async (req, res) => {
  const { id } = req.params;
  const { imageQuality } = req.body;
  
  await db
    .update(supportedVendors)
    .set({ imageQuality })
    .where(eq(supportedVendors.id, parseInt(id)));
  
  res.json({ success: true });
});
```

---

## Testing

### Verify Current Settings

```sql
SELECT name, image_quality, vendor_slug
FROM supported_vendors
ORDER BY image_quality DESC, name;
```

### Test Image Upgrade Logic

1. Find a product with Chattanooga image:
```sql
SELECT upc, name, image_source, image_url
FROM products
WHERE image_source = 'Chattanooga Shooting Supplies Inc.'
LIMIT 1;
```

2. Run Lipsey's or Sports South sync

3. Verify image was upgraded:
```sql
SELECT upc, name, image_source, image_url
FROM products
WHERE upc = '<upc_from_step_1>';
```

---

## Related Files

- `shared/schema.ts` - Database schema with imageQuality field
- `shared/vendor-type-config.ts` - Config module with DB lookup function
- `server/sports-south-simple-sync.ts` - Updated to use DB lookup
- `migrations/0001_flippant_dark_beast.sql` - Database migration
- `scripts/upgrade-chattanooga-images.ts` - Image upgrade tool
- `docs/IMAGE_QUALITY_CLASSIFICATION.md` - Image quality rules documentation

---

## Summary

✅ Image quality is now **database-configured** instead of hardcoded  
✅ **5,564 Chattanooga images** ready to be upgraded  
✅ Automatic upgrades during catalog syncs  
✅ Easy to reclassify vendors  
✅ UI control can be added later  

**Next Step:** Run Lipsey's and Sports South catalog syncs to upgrade images! 🚀


# Vendor Slug Standardization

**Date**: 2025-10-16 (Updated: 2025-10-16)  
**Status**: ✅ Completed & Enforced

## Problem

The system was inconsistently using vendor names vs vendor slugs for internal references, causing:
1. Duplicate filter options (e.g., "Lipsey's" and "Lipsey's Inc." appearing separately)
2. Inconsistent data storage across the database
3. Potential lookup failures due to name variations
4. **Hardcoded vendor names in `imageSource` fields** breaking when vendor short codes changed

## Solution

Implemented a standardized three-tier naming approach:

### 1. Vendor Slugs (Internal/Database)
**Used for**: All internal database fields (`imageSource`, `source`), API lookups, priority matching

**Format**: `lowercase-with-hyphens` (immutable)

**Examples**:
- `lipseys` (single word)
- `sports-south` (multi-word with hyphen)
- `bill-hicks`
- `chattanooga`
- `gunbroker`

### 2. Vendor Short Codes (UI Display)
**Used for**: User-facing displays, filter labels, badges

**Format**: User-editable string in `supportedVendors.vendorShortCode` field

**Examples** (as of 2025-10-16):
- `Lipsey'sX`
- `ChattanoogaX`
- `Bill HicksX`
- `Sports SouthX`

**Conversion**: Frontend uses `getVendorShortName(slug)` to convert slugs to display names

### 3. Vendor Full Names (Documentation Only)
**Used for**: Comments, documentation, user-facing long-form descriptions

**Examples**:
- "Lipsey's Inc."
- "Chattanooga Shooting Supplies"
- "Bill Hicks & Co."
- "Sports South LLC"

## Critical Rule

**🚨 NEVER use Vendor Short Codes or Full Names for internal logic!**

✅ **Correct**:
```typescript
imageSource: 'sports-south'  // Vendor slug
source: 'bill-hicks'          // Vendor slug
```

❌ **Incorrect**:
```typescript
imageSource: 'Sports South'           // Short code - BREAKS on edits
imageSource: 'Bill Hicks & Co.'      // Full name - BREAKS on edits
```

**Why**: Short codes are user-editable. If a user changes "Sports South" to "Sports SouthX", all hardcoded references break.

## Changes Made

### Phase 1: Initial Slug Implementation (October 2025)

#### 1. Configuration Files
- **`shared/lipseys-config.ts`**: Changed `IMAGE_SOURCE_NAME` from `"Lipsey's Inc."` to `"lipseys"`
- **`server/lipsey-api.ts`**: Updated `imageSource` to use `"lipseys"`
- **`server/image-conversion-service.ts`**: Updated `imageSource` references to use `"lipseys"`

#### 2. Database Migration (Initial)
Updated all existing products to use vendor slugs:
```sql
UPDATE products SET image_source = 'lipseys' WHERE image_source = 'Lipsey''s Inc.';
UPDATE products SET image_source = 'sports-south' WHERE image_source = 'Sports South';
UPDATE products SET image_source = 'bill-hicks' WHERE image_source = 'Bill Hicks & Co.';
UPDATE products SET image_source = 'chattanooga' WHERE image_source IN ('Chattanooga Shooting Supplies', 'Chattanooga Shooting Supplies Inc.');
UPDATE products SET image_source = 'gunbroker' WHERE image_source = 'GunBroker.com LLC';
```

**Results**:
- 14,152 products: `lipseys`
- 44,101 products: `sports-south`
- 7,687 products: `bill-hicks`
- 3,881 products: `chattanooga`

#### 3. Frontend Updates
**`client/src/pages/MasterProductCatalog.tsx`**:
- Updated `getVendorShortName()` to accept slugs or names, preferring slugs
- Modified `imageSource` display to use `getVendorShortName()` for UI rendering
- Updated image source filter dropdown to display vendor short codes

### Phase 2: Hardcoded Reference Cleanup (October 16, 2025)

**Problem Discovered**: After user changed vendor short codes (added 'X' suffix), 11 hardcoded vendor names in `imageSource` assignments broke.

#### 4. Catalog Sync Files
Updated all new product imports to use slugs:

**`server/sports-south-simple-sync.ts`** (7 occurrences):
```typescript
// Before
imageSource: 'Sports South'

// After
imageSource: 'sports-south' // Use vendor slug
```

**`server/bill-hicks-simple-sync.ts`** (2 occurrences):
```typescript
// Before
imageSource: 'Bill Hicks & Co.'

// After
imageSource: 'bill-hicks' // Use vendor slug
```

**`server/chattanooga-csv-importer.ts`** (1 occurrence):
```typescript
// Before
imageSource: 'Chattanooga Shooting Supplies'

// After
imageSource: 'chattanooga' // Use vendor slug
```

**`server/image-conversion-service.ts`** (2 occurrences):
```typescript
// Before
imageSource: 'Chattanooga Shooting Supplies'

// After
imageSource: 'chattanooga' // Use vendor slug
```

#### 5. Database Migration (Cleanup)
Updated remaining products with hardcoded names:
```typescript
Updated Lipsey's -> lipseys
Updated Lipsey's Inc. -> lipseys
Updated Sports South -> sports-south
Updated Bill Hicks & Co. -> bill-hicks
Updated Chattanooga Shooting Supplies -> chattanooga
```

**Final Results** (69,964 products updated):
- 44,006 products: `sports-south`
- 14,152 products: `lipseys`
- 7,662 products: `bill-hicks`
- 4,144 products: `chattanooga`

## Benefits

1. **Consistency**: All internal references use slugs, all UI displays use short codes
2. **Maintainability**: Vendor name changes only need to update `supportedVendors` table
3. **Data Integrity**: No more duplicate filter options or mismatched references
4. **Scalability**: Easy to add new vendors with consistent naming

## Testing

Verified:
- ✅ No duplicate "Lipsey's" entries in Image Source filter
- ✅ All 14,152 Lipsey's products now use `lipseys` slug internally
- ✅ UI correctly displays vendor short codes instead of slugs
- ✅ Filter functionality works with slug-based filtering

## Future Sync Behavior

All future vendor syncs will:
- Store `imageSource` using vendor slug (e.g., `lipseys`)
- Display using vendor short code in UI (e.g., "Lipsey's")
- Maintain consistency across all products and vendors

## Developer Reference

### Quick Reference: Vendor Naming Tiers

| Tier | Purpose | Format | Example | Editable? | Used In |
|------|---------|--------|---------|-----------|---------|
| **Vendor Slug** | Internal logic | `lowercase-hyphens` | `sports-south` | ❌ No (immutable) | `source`, `imageSource`, API lookups, priority matching |
| **Vendor Short Code** | UI display | User-defined string | `Sports SouthX` | ✅ Yes | Badges, filters, dropdowns, labels |
| **Vendor Full Name** | Documentation | Full company name | `Sports South LLC` | ✅ Yes | Comments, docs, invoices |

### Code Examples

#### ✅ Correct Usage

```typescript
// Creating a new product
await db.insert(products).values({
  upc: '123456789',
  name: 'Product Name',
  source: 'sports-south',        // ✅ Vendor slug
  imageSource: 'sports-south',    // ✅ Vendor slug
  // ... other fields
});

// Updating imageSource
updateData.imageSource = 'bill-hicks'; // ✅ Vendor slug

// Priority comparison
const priority = await getVendorRecordPriority('chattanooga'); // ✅ Vendor slug

// UI Display
const displayName = getVendorShortName('lipseys'); // ✅ Converts slug to short code
```

#### ❌ Incorrect Usage (DO NOT DO THIS)

```typescript
// ❌ WRONG: Using vendor short code or full name
imageSource: 'Sports South'                    // Breaks when user edits short code
imageSource: 'Sports South LLC'                // Breaks on any name change
source: 'Bill Hicks'                           // Inconsistent with database

// ❌ WRONG: Comparing with short codes
if (product.source === 'Sports SouthX') { }   // Will break, use slug instead

// ❌ WRONG: Hardcoding display names
<Badge>{product.imageSource}</Badge>           // Shows 'sports-south' to user
// ✅ CORRECT:
<Badge>{getVendorShortName(product.imageSource)}</Badge> // Shows 'Sports SouthX'
```

### Audit Checklist

When adding/modifying vendor code, verify:

- [ ] All `source` field assignments use vendor slugs
- [ ] All `imageSource` field assignments use vendor slugs  
- [ ] No conditionals compare against vendor short codes or full names
- [ ] Frontend displays convert slugs to short codes using `getVendorShortName()`
- [ ] No new alias/fallback logic for vendor identification
- [ ] Database migration script updates both new and existing records

### Files to Check

When modifying vendor-related code, audit these files:

**Sync/Import Files** (must use slugs):
- `server/*-simple-sync.ts` (all vendor syncs)
- `server/*-csv-importer.ts` (CSV imports)
- `server/*-catalog-sync.ts` (catalog syncs)
- `server/image-conversion-service.ts`

**Frontend Display Files** (must use `getVendorShortName()`):
- `client/src/pages/MasterProductCatalog.tsx`
- `client/src/pages/VendorComparison.tsx`
- Any component displaying vendor names/badges

**Configuration Files** (must define slugs):
- `shared/*-config.ts` (vendor configs)
- `server/vendor-registry.ts` (vendor handlers)

## Related Documentation

- **`VENDOR_CODE_STANDARD_FINAL.md`**: Comprehensive vendor code standards and alignment rules
- **`VENDOR_IDENTIFIER_STANDARDIZATION.md`**: Original vendor identifier standardization plan
- **`ARCHITECTURE.md`**: Overall system architecture including vendor management

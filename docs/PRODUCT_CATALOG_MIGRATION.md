# Product Catalog Migration Guide: Dev → Production

## Overview
This guide covers migrating the master product catalog from development to production database.

## Database Tables Involved

### Core Product Tables
1. **`products`** - Master product catalog (UPC-based, universal)
2. **`vendor_product_mappings`** - Vendor SKU mappings and pricing
3. **`vendor_inventory`** - Real-time inventory levels per vendor

### Dependencies
- `retail_verticals` - Product categories (reference data)
- `supported_vendors` - Vendor definitions (must exist in prod)
- `companies` - For company-scoped Bill Hicks pricing

## Migration Options

### Option 1: PostgreSQL Dump/Restore (Recommended for Full Migration)

```bash
# On DEV: Export product tables
pg_dump -h $DEV_DB_HOST \
  -U $DEV_DB_USER \
  -d $DEV_DB_NAME \
  --table=products \
  --table=vendor_product_mappings \
  --table=vendor_inventory \
  --data-only \
  --column-inserts \
  > product_catalog_export.sql

# On PROD: Import (after backing up)
psql -h $PROD_DB_HOST \
  -U $PROD_DB_USER \
  -d $PROD_DB_NAME \
  < product_catalog_export.sql
```

**Pros:** Fast, preserves all data types and relationships  
**Cons:** May conflict with existing data (UPC uniqueness)

---

### Option 2: Selective Migration Script (Recommended for Merge)

See `migrate-products.ts` script below - handles UPC conflicts and merges data intelligently.

**Pros:** Handles conflicts, can update existing products, provides detailed logging  
**Cons:** Slower for large datasets

---

### Option 3: CSV Export/Import

```bash
# Export from DEV
psql -h $DEV_DB_HOST -U $DEV_DB_USER -d $DEV_DB_NAME \
  -c "\COPY (SELECT * FROM products) TO 'products.csv' CSV HEADER"

psql -h $DEV_DB_HOST -U $DEV_DB_USER -d $DEV_DB_NAME \
  -c "\COPY (SELECT * FROM vendor_product_mappings) TO 'vendor_mappings.csv' CSV HEADER"

# Import to PROD
psql -h $PROD_DB_HOST -U $PROD_DB_USER -d $PROD_DB_NAME \
  -c "\COPY products FROM 'products.csv' CSV HEADER"
```

**Pros:** Simple, readable format  
**Cons:** Doesn't handle conflicts, loses data types for JSON columns

---

## Important Considerations

### 1. **Foreign Key Dependencies**
Ensure these exist in PROD before migration:
- `retail_verticals` - Product categories
- `supported_vendors` - Vendor definitions (Lipsey's, Sports South, etc.)
- `companies` - For Bill Hicks company-specific pricing

### 2. **UPC Uniqueness**
The `products.upc` field has a UNIQUE constraint. Choose strategy:
- **Replace**: Delete existing PROD products first
- **Merge**: Update existing, insert new (recommended - see script below)
- **Skip**: Only insert products that don't exist

### 3. **Company-Specific Data**
`vendor_product_mappings` can have `companyId` (Bill Hicks store-specific pricing):
- Decide if company-specific pricing should transfer
- May need to remap company IDs between dev/prod

### 4. **Auto-Increment IDs**
Product IDs will change in PROD. The migration script handles this by:
1. Creating a mapping of old ID → new ID
2. Updating foreign keys in `vendor_product_mappings`

---

## Pre-Migration Checklist

- [ ] Backup production database
- [ ] Verify `supported_vendors` exist in PROD
- [ ] Verify `retail_verticals` exist in PROD
- [ ] Test migration on staging environment
- [ ] Plan downtime window (if needed)
- [ ] Decide on conflict resolution strategy

---

## Post-Migration Verification

```sql
-- Check product counts
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM vendor_product_mappings;
SELECT COUNT(*) FROM vendor_inventory;

-- Verify no orphaned mappings
SELECT COUNT(*) FROM vendor_product_mappings vpm
LEFT JOIN products p ON vpm.product_id = p.id
WHERE p.id IS NULL;

-- Check vendor mapping distribution
SELECT sv.name, COUNT(*) as mapping_count
FROM vendor_product_mappings vpm
JOIN supported_vendors sv ON vpm.supported_vendor_id = sv.id
GROUP BY sv.name
ORDER BY mapping_count DESC;
```

---

## Rollback Plan

If migration fails:
1. Restore from pre-migration backup
2. Check logs for specific errors
3. Fix data issues and retry

```bash
# Restore backup (if using pg_dump)
psql -h $PROD_DB_HOST -U $PROD_DB_USER -d $PROD_DB_NAME < backup_pre_migration.sql
```






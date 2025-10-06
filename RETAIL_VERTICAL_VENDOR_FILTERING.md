# Retail Vertical Vendor Filtering

## Feature Summary

Vendors in Store > Supported Vendors are now **filtered by the company's Retail Vertical**. Only vendors that match the company's retail vertical will be shown and created for that company.

## Use Cases

### Example 1: Firearms Company
- **Company**: Johnson's Firearms
- **Retail Vertical**: Firearms (ID: 1)
- **Vendors Shown**: All 5 current vendors
  - Bill Hicks & Co.
  - Chattanooga Shooting Supplies
  - Sports South
  - Lipsey's
  - GunBroker
  
✅ **All current vendors have Retail Vertical = Firearms**, so all 5 appear

### Example 2: Appliances Company
- **Company**: Best Appliances
- **Retail Vertical**: Appliances (ID: 2)
- **Vendors Shown**: None (empty list)

✅ **No current vendors have Retail Vertical = Appliances**, so none appear

### Example 3: Multi-Vertical Vendor (Future)
If a vendor supports multiple retail verticals:
- **Vendor**: Universal Distributor
- **Retail Verticals**: Firearms, Sporting Goods, Outdoor

Then:
- Firearms company → ✅ Sees Universal Distributor
- Appliances company → ❌ Doesn't see Universal Distributor
- Sporting Goods company → ✅ Sees Universal Distributor

## Implementation

### 1. Database Schema

Vendors are linked to retail verticals via the `supported_vendor_retail_verticals` junction table:

```sql
CREATE TABLE supported_vendor_retail_verticals (
  id serial PRIMARY KEY,
  supported_vendor_id integer REFERENCES supported_vendors(id),
  retail_vertical_id integer REFERENCES retail_verticals(id),
  CONSTRAINT vendor_vertical_unique UNIQUE(supported_vendor_id, retail_vertical_id)
);
```

Companies have a `retail_vertical_id` field:

```sql
-- In companies table
retail_vertical_id integer REFERENCES retail_verticals(id)
```

### 2. API Endpoint Changes

**Endpoint**: `GET /org/:slug/api/supported-vendors`

**Before**:
- Returned all supported vendors regardless of company's retail vertical
- Created all enabled vendors for new companies

**After**:
- Filters vendors by company's retail vertical
- Only creates vendors matching the company's retail vertical
- If no retail vertical set, shows all vendors (backward compatible)

**Code Flow**:
```typescript
// 1. Get company's retail vertical
const company = await storage.getCompany(organizationId);
const companyRetailVerticalId = company?.retailVerticalId;

// 2. Create vendors (filtered by retail vertical)
await storage.createVendorsFromSupported(organizationId, companyRetailVerticalId || undefined);

// 3. Get supported vendors (filtered by retail vertical)
const supportedVendors = companyRetailVerticalId 
  ? allSupportedVendors.filter(sv => 
      sv.retailVerticals && sv.retailVerticals.some(rv => rv.id === companyRetailVerticalId)
    )
  : allSupportedVendors;

// 4. Filter organization vendors to only show matching ones
const filteredOrganizationVendors = companyRetailVerticalId
  ? organizationVendors.filter(orgVendor => {
      const supportedVendor = allSupportedVendors.find(sv => sv.id === orgVendor.supportedVendorId);
      return supportedVendor?.retailVerticals && supportedVendor.retailVerticals.some(rv => rv.id === companyRetailVerticalId);
    })
  : organizationVendors;
```

### 3. Storage Method Changes

**Method**: `storage.createVendorsFromSupported(companyId, retailVerticalId?)`

**Updated Signature**:
```typescript
async createVendorsFromSupported(companyId: number, retailVerticalId?: number): Promise<void>
```

**Filtering Logic**:
```typescript
// Get all enabled vendors
let enabledVendors = supportedVendorsList.filter(v => v.isEnabled);

// Filter by retail vertical if specified
if (retailVerticalId) {
  enabledVendors = enabledVendors.filter(v => 
    v.retailVerticals && v.retailVerticals.some(rv => rv.id === retailVerticalId)
  );
}
```

## Admin Configuration

### Assigning Retail Verticals to Vendors

In **Admin > Supported Vendors**, each vendor can be assigned to one or more retail verticals:

1. Navigate to Admin > Supported Vendors
2. Click Edit on a vendor
3. Select applicable retail verticals
4. Save

**Current State** (All vendors assigned to Firearms):
```sql
INSERT INTO supported_vendor_retail_verticals (supported_vendor_id, retail_vertical_id)
VALUES
  (1, 1),  -- Sports South → Firearms
  (2, 1),  -- Chattanooga → Firearms
  (3, 1),  -- Lipsey's → Firearms
  (4, 1),  -- Bill Hicks → Firearms
  (5, 1);  -- GunBroker → Firearms
```

### Adding Vendors for New Retail Verticals

To add vendors for a new retail vertical (e.g., Appliances):

1. **Add Retail Vertical**:
   ```sql
   INSERT INTO retail_verticals (name, slug)
   VALUES ('Appliances', 'appliances');
   ```

2. **Add Supported Vendor**:
   ```sql
   INSERT INTO supported_vendors (name, description, ...)
   VALUES ('Appliance Distributor', 'Leading appliance supplier', ...);
   ```

3. **Link Vendor to Retail Vertical**:
   ```sql
   INSERT INTO supported_vendor_retail_verticals (supported_vendor_id, retail_vertical_id)
   VALUES (6, 2);  -- New vendor → Appliances
   ```

4. **Assign to Company** (during subscription creation):
   ```sql
   -- In billing-service.ts during subscription creation
   retailVerticalId: 2  -- Appliances
   ```

## Testing

### Test Case 1: Firearms Company
1. Create subscription with Retail Vertical = Firearms
2. Navigate to Store > Supported Vendors
3. **Expected**: See all 5 vendors (Bill Hicks, Chattanooga, Sports South, Lipsey's, GunBroker)

### Test Case 2: Appliances Company
1. Create subscription with Retail Vertical = Appliances
2. Navigate to Store > Supported Vendors
3. **Expected**: See no vendors (empty state)

### Test Case 3: No Retail Vertical Set
1. Create subscription without setting Retail Vertical (legacy)
2. Navigate to Store > Supported Vendors
3. **Expected**: See all enabled vendors (backward compatible)

## Backward Compatibility

- ✅ **Existing companies without retail vertical**: Will see all vendors
- ✅ **Existing vendors already created**: Will be filtered on display
- ✅ **API still works if retail vertical is null**: Shows all vendors
- ✅ **No database migrations required**: Feature works with existing schema

## Console Logging

When debugging, look for these console logs:

```javascript
'SUPPORTED VENDORS: Company retail vertical ID: 1'
'VENDOR CREATION: Filtering vendors by retail vertical ID: 1'
'VENDOR CREATION: 5 vendors match retail vertical (before subscription limits)'
'SUPPORTED VENDORS: Filtered supported vendors count: 5'
'SUPPORTED VENDORS: Filtering by retail vertical ID: 1'
'SUPPORTED VENDORS: Filtered organization vendors count: 5'
```

If filtering is not working:
- Check `companies.retail_vertical_id` is set
- Check `supported_vendor_retail_verticals` table has correct mappings
- Check `supported_vendors.is_enabled = true`

## Files Modified

- `server/routes.ts` (lines 3334-3422): API endpoint filtering
- `server/storage.ts` (lines 104, 1746-1761): Storage method filtering
- Interface definition for `createVendorsFromSupported`

## Future Enhancements

1. **Multi-Vertical Vendors**: Allow vendors to serve multiple verticals
2. **Vertical-Specific Credentials**: Different credentials per vertical
3. **Vertical-Specific Pricing**: Different pricing rules per vertical
4. **Admin UI**: Manage vendor-vertical assignments in Admin UI
5. **Vendor Search**: Filter vendors by vertical in admin vendor list


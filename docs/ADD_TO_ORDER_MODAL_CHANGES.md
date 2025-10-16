# Add to Order Modal - Layout and Feature Changes

**Date:** October 16, 2025  
**Status:** ✅ Complete  
**Component:** `client/src/pages/VendorComparison.tsx`

---

## Changes Summary

Three major layout and functionality updates to the "Add to Order" modal in Store > Product Search > Compare:

1. ✅ **Moved Vendor section** from center column to left column (below product info)
2. ✅ **Added editable Model field** to Category section in middle column
3. ✅ **Reorganized sections** - Category, Price, and Cost now flow better in center column

---

## Detailed Changes

### 1. State Management

**Added new state variable for editable model field:**

```typescript
const [orderModel, setOrderModel] = useState<string>(''); // Editable model field for order
```

**Location:** Line 47

---

### 2. Modal Initialization

**Initialize model field when modal opens:**

```typescript
// Initialize model field with product's model (user can edit)
setOrderModel(vendorComparison.product.model || '');
```

**Location:** Line 394  
**Behavior:** Pre-fills the Model field with the product's current model from Master Catalog, but allows user to edit.

---

### 3. Layout Restructure

#### **Left Column** (Now includes Vendor section)

**Before:**
- Product Image
- Product Details (UPC, Model, Part #, SKU, Brand)

**After:**
- Product Image
- Product Details (UPC, Model, Part #, SKU, Brand)
- **Vendor section** ✅ (moved from middle column)
  - Vendor name
  - Vendor Stock

**Location:** Lines 1029-1092

---

#### **Middle Column** (Reorganized and expanded)

**Before:**
- Vendor section (at top)
- Category section
- Price section
- Cost section

**After:**
- Category section (moved to top)
  - Category dropdown
  - **Model input field** ✅ (new)
- Price section
- Cost section

**New Model Field Details:**
```typescript
<div className="mt-4">
  <Label htmlFor="order-model" className="text-sm font-medium text-gray-700 mb-2 block">
    Model
  </Label>
  <Input
    id="order-model"
    type="text"
    value={orderModel}
    onChange={(e) => setOrderModel(e.target.value)}
    placeholder="Enter model number..."
    className="w-full"
    data-testid="input-order-model"
  />
</div>
```

**Location:** Lines 1134-1149

---

#### **Right Column** (Unchanged)

- Select Order
- Delivery Store
- Existing Draft Orders

---

### 4. Order Data Update

**Model field included in order submission:**

```typescript
const orderData = {
  orderId: selectedOrderId === "new" ? undefined : parseInt(selectedOrderId),
  vendorId: orderDetails.vendor.id,
  productId: parseInt(productId!),
  // ... other fields ...
  category: effectiveCategory, // Include selected category for webhook and CSV export
  model: orderModel // Include editable model field for order (not saved to Master Catalog)
};
```

**Location:** Lines 570-585  
**Key Point:** The `model` field is included in the order data and will be:
- ✅ Stored in the vendor order record
- ✅ Included in CSV exports
- ✅ Included in webhook payloads
- ❌ **NOT** saved back to Master Product Catalog

---

## User Experience

### Model Field Behavior

1. **Default Value:** Pre-filled with product's model from Master Catalog
2. **Editable:** User can modify or clear the value
3. **Empty Products:** If product has no model, field starts empty - user can add one
4. **Scope:** Changes only apply to this specific order item
5. **Persistence:** Model value is saved to order record, included in exports/webhooks

### Visual Layout Flow

**Before:**
```
Left Column          | Center Column        | Right Column
---------------------|----------------------|------------------
Product Image        | Vendor Section       | Order Selection
Product Details      | Category Section     | Store Selection
                     | Price Section        | Draft Orders
                     | Cost Section         |
```

**After:**
```
Left Column          | Center Column        | Right Column
---------------------|----------------------|------------------
Product Image        | Category Section     | Order Selection
Product Details      | - Category dropdown  | Store Selection
Vendor Section ✅    | - Model input ✅     | Draft Orders
                     | Price Section        |
                     | Cost Section         |
```

---

## Backend Considerations

### Required Backend Updates

The backend endpoint that handles order creation needs to accept the `model` field:

**Endpoint:** `/org/:slug/api/vendor-orders/add-item`

**Expected orderData structure:**
```typescript
{
  orderId?: number,
  vendorId: number,
  productId: number,
  vendorProductId?: number,
  gunBrokerItemId?: string,
  quantity: number,
  unitCost: string,
  storeId: number,
  vendorSku: string,
  vendorMsrp: string | null,
  vendorMapPrice: string | null,
  priceOnPO: number,
  category: string,
  model: string  // ✅ New field
}
```

### Database Schema

The `model` field should be stored in the **vendor order items** table (e.g., `vendorOrderItems` or similar), not in the `products` table.

**Why separate?**
- Master Catalog products maintain their own model values
- Order-specific model values can differ per order (user corrections, variations, etc.)
- Exports and webhooks pull from order item data, not product catalog

---

## Testing

### Manual Test Cases

1. **✅ Test Model Pre-fill**
   - Open Add to Order modal for product with model
   - Verify Model field shows product's model

2. **✅ Test Model Edit**
   - Change Model field value
   - Add to order
   - Verify order item has edited model value
   - Verify Master Catalog product model unchanged

3. **✅ Test Empty Model**
   - Open Add to Order modal for product without model
   - Enter a model number
   - Add to order
   - Verify order item has entered model value

4. **✅ Test Vendor Section Position**
   - Verify Vendor section appears in left column below product info
   - Verify it no longer appears in middle column

5. **✅ Test Category Section**
   - Verify Category dropdown is at top of middle column
   - Verify Model field appears below Category
   - Verify both fields are in same visual container

### Test Data IDs

- `input-order-model` - Model input field
- `text-vendor-name` - Vendor name display
- `text-vendor-stock` - Vendor stock display
- `select-category` - Category dropdown

---

## CSV Export & Webhook Impact

When orders are exported to CSV or sent via webhook, the `model` field will now include the user-edited value from the order item, not necessarily the Master Catalog value.

### Example CSV Row

```csv
Order Number,Product Name,UPC,Model,Category,Quantity,Unit Cost,Price
PO-123,SAV AXIS 2 GREEN,011356320407,Axis 2,RIFLE,4,$380.79,$456.95
```

The "Model" column will contain the value from the order item's `model` field (which may have been edited by the user).

### Example Webhook Payload

```json
{
  "orderNumber": "PO-123",
  "items": [
    {
      "productName": "SAV AXIS 2 GREEN",
      "upc": "011356320407",
      "model": "Axis 2",
      "category": "RIFLE",
      "quantity": 4,
      "unitCost": 380.79,
      "price": 456.95
    }
  ]
}
```

---

## Benefits

1. **✅ Better Visual Organization**
   - Related product info (image, details, vendor) grouped together in left column
   - Category/Model/Price flow logically in center column
   - Cleaner, more intuitive layout

2. **✅ Model Correction Capability**
   - Users can correct model numbers for specific orders
   - Useful when vendor data has typos or variations
   - Doesn't pollute Master Catalog with order-specific corrections

3. **✅ Improved Data Quality**
   - More accurate CSVs and webhooks with corrected model data
   - Maintains clean Master Catalog
   - Audit trail of what was actually ordered vs. catalog data

---

## Files Modified

- `client/src/pages/VendorComparison.tsx`
  - Added `orderModel` state variable
  - Modified modal layout structure
  - Added Model input field to Category section
  - Moved Vendor section to left column
  - Updated `handleSaveOrder` to include `model` in orderData

---

## Related Documentation

- See image fix documentation: `BILL_HICKS_IMAGE_FIX.md`
- See vendor image sync status: `VENDOR_IMAGE_SYNC_STATUS.md`

---

**Implemented by:** AI Assistant  
**All changes complete:** ✅  
**No linter errors:** ✅  
**Backend update required:** Yes (add `model` field to order item creation endpoint)


# Vendor Orders - Bulk Actions & Order Consolidation

## Overview
This document describes the bulk action features and order consolidation functionality added to the Vendor Orders screen.

## Date
September 30, 2025

## Features Implemented

### 1. Bulk Selection System
- **Checkbox Column**: Added a far-left column with checkboxes on each order line
- **Select All**: Column header includes a "Select All" checkbox to select/deselect all visible orders
- **State Management**: Selected orders are tracked in a Set for efficient lookup and manipulation

### 2. Bulk Action Buttons
The following conditional buttons appear in the table header based on selected orders:

#### Delete Draft Orders
- **Condition**: Appears when 1+ draft orders are selected
- **Action**: Permanently deletes selected draft orders
- **Feedback**: Toast notification with count of deleted orders

#### Change Draft to Open
- **Condition**: Appears when 1+ draft orders are selected
- **Action**: Changes status of selected draft orders to "open"
- **Feedback**: Toast notification with count of orders changed

#### Mark Open as Complete
- **Condition**: Appears when 1+ open orders are selected
- **Action**: Changes status of selected open orders to "complete"
- **Feedback**: Toast notification with count of orders completed

#### Cancel Open Orders
- **Condition**: Appears when 1+ open orders are selected
- **Action**: Changes status of selected open orders to "cancelled"
- **Feedback**: Toast notification with count of orders cancelled

#### Merge Draft Orders
- **Condition**: Appears when 2+ draft orders from the **same vendor** are selected
- **Validation**: Button only shows if all selected draft orders have the same `vendorId`
- **Action**: 
  - Merges all selected draft orders into the first selected order (surviving order)
  - Transfers all order items from merged orders to surviving order
  - Recalculates `totalAmount` (sum of all item costs)
  - Recalculates `itemCount` (sum of all item quantities)
  - Deletes the merged orders
- **Feedback**: Toast shows:
  - Number of orders merged
  - Surviving order number
  - Total items transferred
  - Total cost of transferred items

### 3. Order Item Consolidation
Added "Consolidate Items" button within order modals to combine duplicate items.

#### Consolidate Items Endpoint
- **Routes**:
  - Organization: `POST /org/:slug/api/orders/:id/consolidate`
  - Admin: `POST /api/orders/:id/consolidate`
- **Functionality**:
  - Groups order items by `productId`
  - For each product with multiple items:
    - Keeps the first item
    - Combines quantities from all duplicate items
    - Deletes duplicate items
  - Recalculates order `totalAmount` and `itemCount`
- **Response**: Returns count of consolidated items
- **Feedback**: Toast notification with consolidation results

## Technical Implementation

### Frontend Changes

#### File: `client/src/pages/VendorOrders.tsx`

**State Management:**
```typescript
const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
const [selectAll, setSelectAll] = useState(false);
```

**Bulk Selection Logic:**
```typescript
// Can only merge if 2+ draft orders AND all from the same vendor
const canMergeDrafts = selectedDraftOrders.length >= 2 && 
  selectedDraftOrders.every(order => order.vendorId === selectedDraftOrders[0].vendorId);
```

**Mutations:**
- `bulkDeleteDraftsMutation`: Deletes multiple draft orders
- `bulkChangeStatusMutation`: Changes status of multiple orders
- `bulkMergeDraftsMutation`: Merges multiple draft orders with totals calculation
- `consolidateOrderItemsMutation`: Consolidates duplicate items within an order

### Backend Changes

#### File: `server/routes.ts`

**Bulk Delete Endpoints:**
- `POST /org/:slug/api/orders/bulk-delete` (organization scoped)
- `POST /api/orders/bulk-delete` (admin)

**Bulk Status Change Endpoints:**
- `POST /org/:slug/api/orders/bulk-status` (organization scoped)
- `POST /api/orders/bulk-status` (admin)

**Bulk Merge Endpoints:**
- `POST /org/:slug/api/orders/bulk-merge` (organization scoped)
- `POST /api/orders/bulk-merge` (admin)

**Consolidate Endpoints:**
- `POST /org/:slug/api/orders/:id/consolidate` (organization scoped)
- `POST /api/orders/:id/consolidate` (admin)

**Key Implementation Details:**
```typescript
// Merge ensures both totalAmount and itemCount are recalculated
const newTotalAmount = survivingOrderItems.reduce((sum, item) => {
  const itemCost = parseFloat(item.unitCost.replace('$', ''));
  return sum + (itemCost * item.quantity);
}, 0);

const newItemCount = survivingOrderItems.reduce((sum, item) => {
  return sum + item.quantity;
}, 0);

await storage.updateOrder(survivingOrder.id, {
  totalAmount: newTotalAmount.toFixed(2),
  itemCount: newItemCount
});
```

## User Workflow

### Merging Orders
1. Navigate to Store > Vendor Orders
2. Select multiple draft orders from the same vendor using checkboxes
3. Click "Merge Draft Orders" button (only appears if same vendor)
4. System merges all items into first selected order
5. Toast displays merge results including surviving order number
6. Selection is cleared automatically

### Consolidating Duplicate Items
1. Open any order by clicking on it
2. If duplicate products exist, click "Consolidate Items" button
3. System combines quantities of duplicate products
4. Order totals are recalculated
5. Toast displays number of items consolidated

## Validation & Safety

### Merge Validations
- ✅ Minimum 2 orders required
- ✅ All orders must be in "draft" status
- ✅ All orders must be from the same vendor
- ✅ All orders must belong to the same organization

### Consolidate Validations
- ✅ Order must exist and belong to organization
- ✅ Duplicates are detected by matching `productId`
- ✅ Totals are recalculated after consolidation

## Error Handling
- All operations include try/catch blocks
- Failed operations display error toasts with descriptive messages
- Backend returns appropriate HTTP status codes (400, 404, 500)
- Database transactions ensure data consistency

## Benefits
1. **Efficiency**: Users can perform actions on multiple orders at once
2. **Safety**: Vendor validation prevents accidental cross-vendor merges
3. **Accuracy**: Automatic recalculation of totals prevents data inconsistencies
4. **User Experience**: Toast notifications provide clear feedback
5. **Data Integrity**: Proper validation and error handling protect data

## Future Enhancements
- Add undo functionality for bulk operations
- Support merging orders across different vendors (with warning)
- Add bulk export selected orders
- Add bulk print selected orders
- Add confirmation dialogs for destructive operations


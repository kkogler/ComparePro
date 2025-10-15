# Vendor Orders Table - Icon Buttons Update

**Date:** October 15, 2025  
**Status:** ✅ Completed  
**Page:** Store > Vendor Orders (`/org/:slug/orders`)

---

## Changes Made

### 1. Webhook Icon Repositioned ✅

**Before:**
- Webhook icon was in the "Actions" column (between Edit button and Delete button)

**After:**
- Webhook icon moved to the "MicroBiz" column
- Positioned as the 4th button (after CSV, Order, and Email icons)
- All four MicroBiz icons now centered under the column heading

**Button Order in MicroBiz Column:**
1. 🟢 Green - Download Product Import CSV
2. 🔵 Blue - Download Order Quantity Export CSV  
3. 🟣 Purple - Email Both CSV Files
4. 🟠 Orange - Display Webhook (for Open orders only)

---

### 2. Icons Converted to Proper Buttons ✅

**Changed all icon buttons from `variant="ghost"` to `variant="outline"`** to make them more prominent and button-like.

#### MicroBiz Column Buttons:
All buttons now have:
- ✅ Visible borders (outline variant)
- ✅ Colored borders matching icon color
- ✅ Hover states with darker borders
- ✅ Light background on hover

**Before (Ghost):**
```tsx
<Button variant="ghost" className="text-green-600 hover:bg-green-50">
```

**After (Outline with colored borders):**
```tsx
<Button variant="outline" className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 hover:bg-green-50">
```

#### SwipeSimple Column Buttons:
Same styling updates applied:
- Download CSV button (green with green border)
- Email CSV button (purple with purple border)

#### Actions Column:
- Delete button updated to outline variant with red border
- Edit button already had outline variant (unchanged)

---

## Button Styling Details

### Color-Coded Borders:

| Button | Icon | Border Color | Hover Border | Text Color |
|--------|------|--------------|--------------|------------|
| Download CSV | `Download` | `border-green-200` | `border-green-300` | `text-green-600` → `text-green-700` |
| Order Export | `FileSpreadsheet` | `border-blue-200` | `border-blue-300` | `text-blue-600` → `text-blue-700` |
| Email | `Mail` | `border-purple-200` | `border-purple-300` | `text-purple-600` → `text-purple-700` |
| Webhook | `Link2` | `border-orange-200` | `border-orange-300` | `text-orange-600` → `text-orange-700` |
| Delete | `Trash2` | `border-red-200` | `border-red-300` | `text-red-600` → `text-red-700` |

---

## Visual Layout

### MicroBiz Column (4 buttons centered):
```
┌────────────────────────────────────────┐
│           [MicroBiz Logo]              │
│              Exports                    │
├────────────────────────────────────────┤
│  [📥] [📊] [✉️] [🔗]                  │
│  CSV  Order Email Webhook              │
└────────────────────────────────────────┘
```

### SwipeSimple Column (2 buttons centered):
```
┌────────────────────────────────────────┐
│        [SwipeSimple Logo]              │
│             Export                      │
├────────────────────────────────────────┤
│         [📥] [✉️]                      │
│         CSV  Email                      │
└────────────────────────────────────────┘
```

---

## Conditional Display Logic

### MicroBiz Buttons:
- **CSV, Order, Email**: Show for `open` OR `complete` orders
- **Webhook**: Only shows for `open` orders AND when `createPOInMicroBiz` is true

### SwipeSimple Buttons:
- **CSV, Email**: Show for `open` OR `complete` orders

### Actions Column:
- **Edit**: Always visible for all orders
- **Delete**: Only visible for `draft` orders

---

## File Modified

**`client/src/pages/VendorOrders.tsx`**

### Line Changes:

1. **Lines 1479-1504**: Actions column - removed webhook button, updated delete button styling
2. **Lines 1507-1572**: MicroBiz column - added webhook button, converted all to outline variant with colored borders
3. **Lines 1575-1602**: SwipeSimple column - converted buttons to outline variant with colored borders

---

## Testing Checklist

- ✅ Webhook icon appears in MicroBiz column (4th position)
- ✅ Webhook icon only shows for Open orders
- ✅ All buttons have visible borders
- ✅ Buttons have color-coded borders matching icons
- ✅ Hover states work correctly (darker borders, light background)
- ✅ All buttons are properly centered under column headings
- ✅ Button tooltips display correctly
- ✅ Button click handlers work as expected
- ✅ Disabled states work properly during loading
- ✅ Delete button only shows for draft orders

---

## Benefits

1. **Better Visual Hierarchy**: Outlined buttons are more prominent than ghost buttons
2. **Clearer Actions**: Users can immediately identify interactive elements
3. **Logical Grouping**: All MicroBiz-related actions together in one column
4. **Color Consistency**: Border colors match icon colors for better visual association
5. **Professional Appearance**: Outlined buttons look more polished and intentional

---

## Notes

- The webhook button uses orange color to distinguish it from the other MicroBiz buttons
- The button only appears for "open" orders, so the MicroBiz column width adjusts dynamically
- All existing functionality (downloads, emails, webhooks) remains unchanged
- Button `data-testid` attributes preserved for automated testing


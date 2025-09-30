# Lipsey's API to ASN Example

This document demonstrates how BestPrice processes Lipsey's API order responses to create Advanced Ship Notice (ASN) records.

## Lipsey's API Response Structure

When an order is submitted to Lipsey's via their API, they return a response with the following structure:

```json
{
  "success": true,
  "authorized": true,
  "errors": [],
  "data": [
    {
      "itemNumber": "GLK-19X-FDE",
      "lipseysItemNumber": "GLK19XFDE", 
      "note": "Standard processing",
      "requestedQuantity": 2,
      "fulfilledQuantity": 2,
      "errors": [],
      "exists": true,
      "blocked": false,
      "allocated": false,
      "validForCart": true,
      "validForShipTo": true,
      "orderError": false,
      "orderNumber": 1234567,
      "price": 465.20,
      "totalPrice": 930.40
    },
    {
      "itemNumber": "GLK-17-G5",
      "lipseysItemNumber": "GLK17G5",
      "note": "Partial fulfillment", 
      "requestedQuantity": 3,
      "fulfilledQuantity": 1,
      "errors": ["Insufficient inventory"],
      "exists": true,
      "blocked": false,
      "allocated": true,
      "validForCart": true,
      "validForShipTo": true,
      "orderError": false,
      "orderNumber": 1234567,
      "price": 455.20,
      "totalPrice": 455.20
    }
  ]
}
```

## Generated ASN Record

BestPrice's ASN Processor automatically creates the following ASN record from the Lipsey's response:

### ASN Header
```json
{
  "asnNumber": "ASN-LIPSEY-1234567",
  "orderId": 2,
  "vendorId": 2,
  "status": "partial",
  "shipDate": "2024-01-20T00:00:00.000Z",
  "trackingNumber": null,
  "itemsShipped": 3,
  "itemsTotal": 5,
  "shippingCost": "0.00",
  "notes": "Lipsey's Order Confirmation: 2/2 items processed successfully\nLipsey's Order Number(s): 1234567\nIssues encountered:\nGLK-17-G5: Insufficient inventory\nGLK-17-G5: Item allocated",
  "rawData": {
    "lipseyOrderResponse": { /* full API response */ },
    "processedAt": "2024-01-20T10:30:00.000Z",
    "vendor": "Lipsey's",
    "originalOrderNumber": "BP-2024-002"
  }
}
```

### ASN Items
```json
[
  {
    "asnId": 3,
    "orderItemId": 3,
    "quantityShipped": 2,
    "quantityBackordered": 0
  },
  {
    "asnId": 3, 
    "orderItemId": 4,
    "quantityShipped": 1,
    "quantityBackordered": 2
  }
]
```

## Key Processing Logic

1. **ASN Number Generation**: Uses Lipsey's order number when available: `ASN-LIPSEY-{orderNumber}`

2. **Status Determination**:
   - `complete`: All requested items fulfilled
   - `partial`: Some items fulfilled, some backordered
   - `cancelled`: No items fulfilled

3. **Item Matching**: Maps Lipsey's response items to original order items by sequence

4. **Error Handling**: Captures all errors, blocking status, and allocation issues in ASN notes

5. **Raw Data Preservation**: Stores complete Lipsey's response for audit trail and future reference

## Integration Points

- **Order Submission**: ASN automatically created when Lipsey's order succeeds
- **Inventory Management**: Quantity shipped/backordered tracked per item
- **Status Updates**: ASN status reflects fulfillment completeness
- **Audit Trail**: Full API response preserved for troubleshooting
- **UI Display**: ASN data displayed in Advanced Ship Notices page

This automated ASN creation provides dealers with immediate visibility into order confirmations from Lipsey's without manual data entry.
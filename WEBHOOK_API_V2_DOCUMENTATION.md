# Industry-Standard Webhook API v2 Documentation

## Overview
This webhook service provides comprehensive order event notifications following industry REST API standards. The webhook includes complete order information, detailed product data, and all available metadata without forcing data into third-party API formats.

## Webhook Events
- `order.created` - New order created in draft status
- `order.updated` - Order information updated
- `order.submitted` - Order submitted to vendor
- `order.cancelled` - Order cancelled
- `order.completed` - Order fulfilled and completed

## Payload Structure

### Event Metadata
```json
{
  "event": "order.submitted",
  "timestamp": "2025-08-11T04:43:13.619Z",
  "webhook_id": "wh_1754887393619_abc123def",
  "api_version": "v1",
  "data": { ... }
}
```

### Complete Order Data
The `data` object contains comprehensive order information:

#### Basic Order Information
```json
{
  "order": {
    "id": 32,
    "order_number": "MAIN-0005",
    "status": "open",
    "order_date": "2025-08-11T00:00:00.000Z",
    "expected_date": "2025-08-15T00:00:00.000Z",
    "total_amount": "47.94",
    "item_count": 1,
    "shipping_cost": "0.00",
    "notes": "Special handling required",
    "external_order_number": "EXT-123456",
    "order_type": "standard",
    "created_at": "2025-08-11T03:57:00.533Z"
  }
}
```

#### Vendor Information
```json
{
  "vendor": {
    "id": 13,
    "name": "Chattanooga Shooting Supplies Inc.",
    "type": "csv"
  }
}
```

#### Company Information
```json
{
  "company": {
    "id": 5,
    "name": "Demo Gun Store1",
    "slug": "demo-gun-store"
  }
}
```

#### Store Information (if available)
```json
{
  "store": {
    "id": 1,
    "name": "Main Store1",
    "short_code": "MAIN",
    "timezone": "America/New_York",
    "ffl_number": "12345678",
    "phone": "+1-555-123-4567",
    "address": {
      "line_1": "123 Main St",
      "line_2": "Suite 100",
      "city": "Nashville",
      "state": "TN",
      "zip": "37203",
      "country": "US"
    }
  }
}
```

#### Shipping Information (if available)
```json
{
  "shipping": {
    "delivery_option": "ground",
    "drop_ship_flag": false,
    "insurance_flag": true,
    "adult_signature_flag": false,
    "delay_shipping": false,
    "overnight": false,
    "ship_to_name": "John Doe",
    "ship_to_address": {
      "line_1": "456 Oak Ave",
      "line_2": "Apt 2B",
      "city": "Memphis",
      "state": "TN",
      "zip": "38103"
    }
  }
}
```

#### Billing Information (if available)
```json
{
  "billing": {
    "billing_name": "Demo Gun Store Inc.",
    "billing_address": {
      "line_1": "789 Commerce Blvd",
      "city": "Knoxville",
      "state": "TN",
      "zip": "37902"
    }
  }
}
```

#### Order Items with Complete Product Information
```json
{
  "items": [
    {
      "id": 123,
      "quantity": 1,
      "unit_cost": "47.94",
      "total_cost": "47.94",
      "customer_reference": "Internal SKU: INT-001",
      
      "product": {
        "id": 5469,
        "name": "X-TAC 30MM RINGS X-HIGH BLK",
        "upc": "000381201669",
        "part_number": "XT-RINGS-30-XH",
        "sku": "XTAC-30-XH-BLK",
        "manufacturer": "Primary Arms",
        "model": "Xtreme Tactical Rings",
        "caliber": "30MM",
        "category": "Optics",
        "subcategory": "Rings & Mounts",
        "description": "High-quality 30mm scope rings",
        "msrp": "59.99",
        "map_price": "49.99",
        "retail_price": "54.99",
        "weight": 4.2,
        "dimensions": {
          "length": 3.5,
          "width": 1.2,
          "height": 1.8
        },
        "is_serialized": false,
        "is_restricted": false,
        "discontinued": false,
        "image_url": "https://example.com/product-images/xtac-rings.jpg"
      },
      
      "vendor_product": {
        "vendor_id": 13,
        "vendor_sku": "CHAT-XT-30-XH",
        "vendor_part_number": "CH-123456",
        "vendor_price": "47.94",
        "vendor_cost": "38.35",
        "vendor_msrp": "59.99",
        "vendor_map_price": "49.99",
        "available_quantity": 25,
        "minimum_order_quantity": 1,
        "discontinued": false,
        "last_updated": "2025-08-10T08:30:00.000Z"
      }
    }
  ]
}
```

#### Created By User Information (if available)
```json
{
  "created_by": {
    "id": 42,
    "username": "john.doe",
    "email": "john.doe@example.com"
  }
}
```

#### Vendor-Specific Fields (if available)
```json
{
  "vendor_specific": {
    "ffl_number": "12345678",
    "customer": "Demo Gun Store",
    "customer_phone": "615-555-0123",
    "warehouse": "TN-MAIN",
    "message_for_sales_exec": "Rush order - customer pickup Friday"
  }
}
```

## Data Authenticity
- All fields contain only authentic data from the database
- Fields with no data are omitted entirely (not filled with placeholder values)
- Optional objects (shipping, billing, store) are excluded if no relevant data exists
- No synthetic or hardcoded fallback values are used

## Security

### HMAC Signature Verification
Webhooks include an HMAC-SHA256 signature in the `X-Webhook-Signature-256` header:
```
X-Webhook-Signature-256: sha256=a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
```

To verify the signature:
1. Get your webhook secret from environment variable
2. Create HMAC-SHA256 hash of the raw request body using your secret
3. Compare with the signature provided in the header

### Headers
```
Content-Type: application/json
User-Agent: BestPrice-Webhook/2.0
X-Webhook-Event: order.submitted
X-Webhook-ID: wh_1754887393619_abc123def
X-Webhook-Timestamp: 2025-08-11T04:43:13.619Z
X-Webhook-Signature-256: sha256=...
```

## Configuration

### Environment Variables
```bash
# Webhook endpoint URL
WEBHOOK_URL=https://your-system.com/webhooks/bestprice

# Optional webhook secret for HMAC signature verification
WEBHOOK_SECRET=your-webhook-secret-key
```

## Response Requirements
Your webhook endpoint should:
- Respond with HTTP 200-299 status code for successful processing
- Respond within 30 seconds
- Return any status code outside 200-299 for failed processing (will trigger retry)

## Error Handling
- Failed webhook deliveries are logged but do not retry automatically
- Webhook failures do not affect order processing
- Monitor webhook delivery logs for troubleshooting

## Example Payloads

### Minimal Order (Required Fields Only)
```json
{
  "event": "order.created",
  "timestamp": "2025-08-11T04:43:13.619Z",
  "webhook_id": "wh_1754887393619_abc123def",
  "api_version": "v1",
  "data": {
    "order": {
      "id": 32,
      "order_number": "MAIN-0005",
      "status": "draft",
      "order_date": "2025-08-11T00:00:00.000Z",
      "total_amount": "47.94",
      "item_count": 1,
      "shipping_cost": "0.00",
      "created_at": "2025-08-11T03:57:00.533Z",
      "vendor": {
        "id": 13,
        "name": "Chattanooga Shooting Supplies Inc.",
        "short_code": "CH"
      },
      "company": {
        "id": 5,
        "name": "Demo Gun Store1"
      },
      "items": [
        {
          "id": 123,
          "quantity": 1,
          "unit_cost": "47.94",
          "total_cost": "47.94",
          "product": {
            "id": 5469,
            "name": "X-TAC 30MM RINGS X-HIGH BLK"
          }
        }
      ]
    }
  }
}
```

### Complete Order (All Available Fields)
See the individual sections above for complete field documentation.

## Integration Tips

1. **Handle Missing Fields**: Always check for field existence before accessing data
2. **Use Webhook ID**: Store `webhook_id` to prevent duplicate processing
3. **Verify Signatures**: Always verify HMAC signature if using webhook secrets
4. **Process Idempotently**: Design your webhook handler to be idempotent
5. **Log for Debugging**: Log incoming webhooks for troubleshooting

## Testing
Use the `/org/{slug}/api/orders/{id}/webhook-preview` endpoint to generate sample webhook payloads for testing your integration.
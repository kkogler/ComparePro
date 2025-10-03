# Webhook API Documentation

## Overview

The BestPrice system provides a webhook notification service that triggers when orders are successfully submitted to vendors. This enables 3rd party applications (like MicroBiz) to automatically create Purchase Orders (POs) based on the vendor order data.

## Webhook Event: `order_submitted`

When an order is successfully submitted to a vendor through the BestPrice system, a webhook payload is sent to configured endpoints.

### Environment Configuration

Configure webhook endpoints using environment variables:

```bash
MICROBIZ_WEBHOOK_URL=https://your-app.com/api/purchase-orders
MICROBIZ_WEBHOOK_SECRET=your-webhook-secret-key
```

### Webhook Payload Structure

```json
{
  "event": "order_submitted",
  "timestamp": "2025-01-11T08:41:00.000Z",
  "order_data": {
    "vendor_id": "string - ID of vendor",
    "store_id": "string - ID of Store",
    "store_display_name": "string - Store short name/code",
    "customer_location_id": "string - ID of customer location",
    "start_ship": "string - Date when shipment starts (YYYY-MM-DD)",
    "expected_date": "string - Expected delivery date (YYYY-MM-DD)",
    "payment_date": "string - Date when payment would be done (YYYY-MM-DD)",
    "buyer_id": "string - ID of user who purchased from vendor",
    "ship_to": "string - One of: store/company/customer",
    "bill_to": "string - One of: store/company",
    "ship_via": "string - Shipping method ID or name",
    "notes": "string - Order notes",
    "free_on_board": "string - FOB type: shipping_point/destination",
    "vendor_purchase_order_number": "string - PO number from BestPrice system",
    "payment_term_id": "string - ID of vendor payment term",
    "customer_id": "string - Customer ID if ship_to is customer, null otherwise",
    "order_placed_via": "string - One of: na/email/fax/phone/web_site",
    "cancel_date": "string - Cancel date if applicable, null otherwise",
    "order_lines": [
      {
        "product_id": "string - Line product ID",
        "sku_id": "string - Product SKU identifier", 
        "line_note": "string - Note for current line and SKU",
        "front_key": "string - Frontend identifier for response tracking",
        "order_items": [
          {
            "sku_id": "string - Product SKU identifier",
            "item_cost": "string - Cost of item (decimal string)",
            "order_quantity": "string - Quantity of items",
            "front_key": "string - Frontend identifier for response tracking"
          }
        ],
        "product_info": {
          "product_name": "string - Product display name",
          "base_sku": "string - Base product SKU/part number",
          "product_type": "simple|configurable - Product type",
          "short_description": "string - Product description",
          "track_inventory": "yes|no - Whether to track inventory",
          "retail_price": "string - Retail price (decimal)",
          "replacement_cost": "string - Replacement/wholesale cost (decimal)",
          "manufacturer_suggested_retail_price": "string - MSRP (decimal)",
          "min_advertised_price": "string - MAP price (decimal)",
          "discontinued": "yes|no - Whether product is discontinued",
          "allow_discounts": "yes|no - Whether discounts are allowed",
          "allow_returns": "yes|no - Whether returns are allowed", 
          "is_firearm": "yes|no - Whether product is a firearm",
          "product_sku": [
            {
              "sku": "string - Product SKU",
              "upc": "string - Universal Product Code",
              "item_number": "string - Item/part number",
              "vendor_product_code": "string - Vendor's product code",
              "weight": "string - Product weight",
              "weight_uom": "string - Weight unit of measure",
              "replacement_cost": "string - Cost (decimal)",
              "retail_price": "string - Price (decimal)",
              "optional_fields": {
                "manufacturer": "string - Manufacturer name",
                "model": "string - Product model",
                "caliber": "string - Firearm caliber",
                "type": "string - Product type/category",
                "condition": "string - Product condition",
                "mpn": "string - Manufacturer part number",
                "location": "string - Storage location",
                "note": "string - Additional notes"
              }
            }
          ],
          "vendor_stock": [
            {
              "vendor_id": "string - Vendor identifier",
              "min_order_quantity": "string - Minimum order quantity",
              "discontinued": "yes|no - Vendor discontinuation status",
              "manufacturer_suggested_retail_price": "string - MSRP from vendor",
              "min_advertised_price": "string - MAP from vendor",
              "available_stock": "string - Available quantity",
              "replacement_cost": "string - Vendor cost (decimal)"
            }
          ]
        }
      }
    ]
  }
}
```

### Example Webhook Payload

```json
{
  "event": "order_submitted",
  "timestamp": "2025-01-11T08:41:00.000Z",
  "order_data": {
    "vendor_id": "2",
    "store_id": "1", 
    "store_display_name": "MAIN",
    "customer_location_id": "1",
    "start_ship": "2025-01-11",
    "expected_date": "2025-01-18", 
    "payment_date": "2025-02-10",
    "buyer_id": "1",
    "ship_to": "store",
    "bill_to": "company", 
    "ship_via": "ground",
    "notes": "Electronic order from BestPrice system",
    "free_on_board": "shipping_point",
    "vendor_purchase_order_number": "MAIN-0004",
    "payment_term_id": "1",
    "customer_id": null,
    "order_placed_via": "web_site",
    "cancel_date": null,
    "order_lines": [
      {
        "product_id": "12345",
        "sku_id": "BURRIS-420200",
        "line_note": "Special handling required",
        "front_key": "line_0",
        "order_items": [
          {
            "sku_id": "BURRIS-420200", 
            "item_cost": "189.99",
            "order_quantity": "2",
            "front_key": "item_0"
          }
        ],
        "product_info": {
          "product_name": "Burris Fullfield E1 3-9x40mm Riflescope",
          "base_sku": "BURRIS-420200",
          "product_type": "simple",
          "short_description": "Burris 3-9x40mm rifle scope with ballistic plex reticle",
          "track_inventory": "yes",
          "retail_price": "229.99",
          "replacement_cost": "189.99",
          "manufacturer_suggested_retail_price": "259.99",
          "min_advertised_price": "199.99",
          "discontinued": "no",
          "allow_discounts": "yes",
          "allow_returns": "yes",
          "is_firearm": "no",
          "product_sku": [
            {
              "sku": "BURRIS-420200",
              "upc": "000381420200",
              "item_number": "420200",
              "vendor_product_code": "CHT-BURRIS-420200",
              "weight": "1.2",
              "weight_uom": "lbs",
              "replacement_cost": "189.99",
              "retail_price": "229.99",
              "optional_fields": {
                "manufacturer": "Burris",
                "model": "Fullfield E1",
                "caliber": "",
                "type": "Riflescope",
                "condition": "new",
                "mpn": "420200",
                "location": "A1-B2",
                "note": "3-9x40mm magnification with ballistic plex reticle"
              }
            }
          ],
          "vendor_stock": [
            {
              "vendor_id": "2",
              "min_order_quantity": "1",
              "discontinued": "no",
              "manufacturer_suggested_retail_price": "259.99",
              "min_advertised_price": "199.99",
              "available_stock": "25",
              "replacement_cost": "189.99"
            }
          ]
        }
      }
    ]
  }
}
```

## Security

### Signature Verification

If a webhook secret is configured, each request includes a signature header:

```
X-Webhook-Signature-256: sha256=<hmac_hex_digest>
```

To verify the signature:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const expectedSignature = `sha256=${computedSignature}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Request Headers

```
Content-Type: application/json
User-Agent: BestPrice-Webhook/1.0
X-Webhook-Signature-256: sha256=<signature> (if secret configured)
```

## API Endpoints

### Test Webhook Endpoint

Test connectivity to your webhook endpoint:

```http
POST /org/{slug}/api/webhooks/test

Request Body:
{
  "url": "https://your-app.com/api/webhook",
  "secret": "optional-secret-key"
}

Response:
{
  "success": true,
  "message": "Webhook endpoint is reachable (200)",
  "responseTime": 150
}
```

### Get Webhook Configuration

Get current webhook settings:

```http
GET /org/{slug}/api/webhooks/config

Response:
{
  "configured": true,
  "url": "https://your-app.com/api/webhook",
  "hasSecret": true,
  "events": ["order_submitted"]
}
```

## Integration Flow

1. **Order Submission**: User submits order to vendor via BestPrice system
2. **Vendor Processing**: Order is sent to vendor API (Chattanooga/Lipsey's)
3. **Success Response**: Vendor confirms order receipt and assigns order number
4. **Webhook Trigger**: BestPrice sends webhook notification to configured endpoint
5. **3rd Party Processing**: Your application receives webhook and:
   - Creates PO using the order data
   - Checks if products exist in your catalog using `base_sku` or `upc`
   - Creates new product records using `product_info` if products don't exist
   - Updates inventory and pricing from vendor data
6. **Response**: Your endpoint responds with 200 status to acknowledge receipt

## Product Catalog Integration

The webhook includes comprehensive `product_info` for each order line item to enable automatic product creation in your system:

### Product Creation Workflow

When your system receives a webhook:

1. **Check Product Exists**: Look up products by `base_sku`, `upc`, or `vendor_product_code`
2. **Create Missing Products**: Use `product_info` to create new product records
3. **Update Vendor Information**: Add/update vendor-specific pricing and availability
4. **Link to Purchase Order**: Associate products with the incoming PO

### Key Product Information Provided

- **Basic Product Data**: name, description, SKU, UPC, part numbers
- **Pricing Information**: retail price, cost, MSRP, MAP pricing
- **Physical Properties**: weight, dimensions, manufacturer details
- **Compliance Data**: firearm classification, serial tracking requirements
- **Vendor-Specific Data**: vendor SKUs, costs, availability, minimum quantities
- **Inventory Settings**: tracking preferences, reorder levels, storage locations

### MicroBiz API Mapping

The webhook payload structure directly maps to MicroBiz Product API fields:

```javascript
// Webhook product_info maps to MicroBiz Product API
const microbizProduct = {
  product_name: webhook.product_info.product_name,
  base_sku: webhook.product_info.base_sku,
  product_type: webhook.product_info.product_type,
  track_inventory: webhook.product_info.track_inventory,
  retail_price: webhook.product_info.retail_price,
  replacement_cost: webhook.product_info.replacement_cost,
  is_firearm: webhook.product_info.is_firearm,
  // ... additional field mappings
};
```

## Error Handling

- Webhook failures do not affect order submission success
- System will retry failed webhooks with exponential backoff
- 10-second timeout for webhook requests
- Failed webhooks are logged but don't break the order flow

## Response Requirements

Your webhook endpoint should:

- Respond with HTTP 200-299 status codes for successful processing
- Process requests within 10 seconds  
- Return JSON response (optional, but recommended for logging)
- Handle duplicate webhook deliveries idempotently

```json
{
  "received": true,
  "po_created": true,
  "po_number": "PO-2025-001234"
}
```

## Webhook Delivery Guarantee

- **At-least-once delivery**: Webhooks may be delivered multiple times
- **Idempotency**: Design your endpoint to handle duplicate deliveries
- **Ordering**: Webhooks are delivered in order of event occurrence
- **Timeout**: 10-second request timeout with no retries on timeout

## Testing

Use the webhook test endpoint to verify your integration:

```bash
curl -X POST "https://your-bestprice-domain.com/org/demo-gun-store/api/webhooks/test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "url": "https://your-app.com/api/webhook",
    "secret": "your-secret-key"
  }'
```

## Troubleshooting

### Common Issues

1. **Webhook not received**: Check URL accessibility and firewall settings
2. **Signature verification failed**: Ensure secret matches configuration
3. **Timeout errors**: Optimize webhook endpoint response time
4. **Duplicate processing**: Implement idempotency using `vendor_purchase_order_number`

### Debug Information

Webhook payloads include these fields for debugging:
- `timestamp`: Exact time webhook was sent
- `front_key`: Unique identifiers for request/response correlation
- `vendor_purchase_order_number`: Order tracking across systems

Contact BestPrice support if you need assistance with webhook integration.
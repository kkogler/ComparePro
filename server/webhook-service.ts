// Use built-in fetch in Node.js 18+ instead of node-fetch
import { db } from './db';
import { products, vendorProducts } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';

export interface WebhookPayload {
  event: 'order_submitted';
  timestamp: string;
  order_data: {
    vendor_id: string;
    store_id: string;
    store_display_name: string;
    customer_location_id?: string;
    start_ship?: string;
    expected_date?: string;
    payment_date?: string;
    buyer_id: string;
    ship_to: 'store' | 'company' | 'customer';
    bill_to: 'store' | 'company';
    ship_via?: string;
    notes?: string;
    free_on_board?: 'shipping_point' | 'destination';
    vendor_purchase_order_number: string;
    payment_term_id?: string;
    customer_id?: string;
    order_placed_via: 'na' | 'email' | 'fax' | 'phone' | 'web_site';
    cancel_date?: string;
    order_lines: Array<{
      product_id: string;
      sku_id: string;
      line_note?: string;
      front_key: string;
      order_items: Array<{
        sku_id: string;
        item_cost: string;
        order_quantity: string;
        front_key: string;
      }>;
      product_info?: {
        product_name: string;
        base_sku: string;
        product_type: 'simple' | 'configurable';
        short_description?: string;
        track_inventory: 'yes' | 'no';
        retail_price?: string;
        replacement_cost?: string;
        manufacturer_suggested_retail_price?: string;
        min_advertised_price?: string;
        discontinued: 'yes' | 'no';
        allow_discounts: 'yes' | 'no';
        allow_returns: 'yes' | 'no';
        is_firearm: 'yes' | 'no';
        product_sku: Array<{
          sku: string;
          upc?: string;
          item_number?: string;
          vendor_product_code?: string;
          weight?: string;
          weight_uom?: string;
          replacement_cost?: string;
          retail_price?: string;
          image_url?: string;
          image_urls?: {
            hires?: string;
            large?: string;
            small?: string;
            thumbnail?: string;
          };
          optional_fields?: {
            manufacturer?: string;
            model?: string;
            caliber?: string;
            type?: string;
            barrelLength?: string;
            totalLength?: string;
            condition?: string;
            mpn?: string;
            location?: string;
            note?: string;
          };
        }>;
        vendor_stock?: Array<{
          vendor_id: string;
          min_order_quantity?: string;
          discontinued: 'yes' | 'no';
          manufacturer_suggested_retail_price?: string;
          min_advertised_price?: string;
          available_stock?: string;
          replacement_cost?: string;
        }>;
      };
    }>;
  };
}

export interface WebhookEndpoint {
  id: number;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  companyId: number;
}

export class WebhookService {
  /**
   * Send webhook notification when an order is submitted to a vendor
   */
  static async sendOrderSubmittedWebhook(
    orderData: any,
    vendorData: any,
    storeData: any,
    userData: any,
    companyId: number
  ): Promise<void> {
    try {
      // Get active webhook endpoints for this company
      const webhookEndpoints = await this.getActiveWebhookEndpoints(companyId, 'order_submitted');
      
      if (webhookEndpoints.length === 0) {
        console.log('No active webhook endpoints found for order_submitted event');
        return;
      }

      // Transform order data to webhook payload format
      const webhookPayload: WebhookPayload = {
        event: 'order_submitted',
        timestamp: new Date().toISOString(),
        order_data: {
          vendor_id: vendorData.id?.toString() || vendorData.vendorId?.toString() || '0',
          store_id: storeData?.id?.toString() || orderData.storeId?.toString() || '1',
          store_display_name: storeData?.shortCode || storeData?.name || 'MAIN',
          customer_location_id: storeData?.id?.toString(),
          start_ship: this.formatDate(orderData.orderDate),
          expected_date: this.formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days from now
          payment_date: this.formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days from now
          buyer_id: userData?.id?.toString() || '1',
          ship_to: orderData.dropShipFlag ? 'customer' : 'store',
          bill_to: 'company',
          ship_via: orderData.deliveryOption || 'ground',
          notes: orderData.notes || '',
          free_on_board: 'shipping_point',
          vendor_purchase_order_number: orderData.orderNumber || orderData.externalOrderNumber || '',
          payment_term_id: '1', // Default payment terms
          customer_id: orderData.dropShipFlag ? orderData.customer : undefined,
          order_placed_via: 'web_site',
          cancel_date: undefined,
          order_lines: await this.transformOrderItemsWithProductInfo(orderData.items || [], vendorData.id)
        }
      };

      // Send webhook to all active endpoints
      const webhookPromises = webhookEndpoints.map(endpoint => 
        this.sendWebhookToEndpoint(endpoint, webhookPayload)
      );

      await Promise.allSettled(webhookPromises);
      
      console.log(`Webhook notifications sent for order ${orderData.orderNumber}`);
    } catch (error) {
      console.error('Error sending webhook notification:', error);
      // Don't throw error - webhook failures shouldn't break order submission
    }
  }

  /**
   * Transform order items to webhook format with comprehensive product information
   */
  private static async transformOrderItemsWithProductInfo(items: any[], vendorId: number): Promise<Array<any>> {
    // Get all product IDs from the order items
    const productIds = items
      .map(item => item.productId || item.id)
      .filter(id => id !== null && id !== undefined);

    // Fetch product information from database
    let productData: any[] = [];
    let vendorProductData: any[] = [];

    if (productIds.length > 0) {
      // Get master product catalog information
      productData = await db
        .select()
        .from(products)
        .where(inArray(products.id, productIds));

      // Get vendor-specific product information
      vendorProductData = await db
        .select()
        .from(vendorProducts)
        .where(
          inArray(vendorProducts.productId, productIds)
        );

      // Filter vendor products for this specific vendor if available using vendor registry
      const currentVendorProducts = vendorProductData.filter(vp => vp.vendorId === vendorId);
      if (currentVendorProducts.length > 0) {
        vendorProductData = currentVendorProducts;
      }
    }

    return items.map((item, index) => {
      const product = productData.find(p => p.id === (item.productId || item.id));
      const vendorProduct = vendorProductData.find(vp => vp.productId === (item.productId || item.id));

      const orderLine: any = {
        product_id: item.productId?.toString() || item.id?.toString() || index.toString(),
        sku_id: item.sku || item.partNumber || item.upc || '',
        line_note: item.customerReference || '',
        front_key: `line_${index}`,
        order_items: [{
          sku_id: item.sku || item.partNumber || item.upc || '',
          item_cost: item.unitCost?.toString() || '0.00',
          order_quantity: item.quantity?.toString() || '1',
          front_key: `item_${index}`
        }]
      };

      // Add comprehensive product information if product exists in database
      if (product) {
        orderLine.product_info = {
          product_name: product.name || item.name || 'Unknown Product',
          base_sku: product.partNumber || product.sku || item.sku || item.partNumber || '',
          product_type: 'simple' as const,
          short_description: product.description || item.description || '',
          track_inventory: 'yes' as const,
          retail_price: vendorProduct?.price?.toString() || '0.00',
          replacement_cost: vendorProduct?.cost?.toString() || '0.00',
          manufacturer_suggested_retail_price: product.msrp?.toString() || '',
          min_advertised_price: product.mapPrice?.toString() || '',
          discontinued: product.discontinued ? 'yes' : 'no',
          allow_discounts: 'yes' as const,
          allow_returns: 'yes' as const,
          is_firearm: product.serialized ? 'yes' : 'no',
          product_sku: [{
            sku: product.partNumber || product.sku || item.sku || item.partNumber || '',
            upc: product.upc || item.upc || '',
            item_number: product.partNumber || product.sku || '',
            vendor_product_code: vendorProduct?.vendorPartNumber || vendorProduct?.sku || '',
            weight: product.weight?.toString() || '',
            weight_uom: product.weight ? 'lbs' : '',
            replacement_cost: vendorProduct?.cost?.toString() || '0.00',
            retail_price: vendorProduct?.price?.toString() || '0.00',
            image_url: product.imageUrl || '',
            optional_fields: {
              manufacturer: product.manufacturer || vendorProduct?.manufacturer || '',
              model: product.model || vendorProduct?.model || '',
              caliber: product.caliber || vendorProduct?.caliber || '',
              type: item.category || '', // Use manually selected category from order item (NOT from Master Product Catalog)
              condition: 'new',
              mpn: product.partNumber || product.sku || '',
              location: '',
              note: product.description || ''
            }
          }],
          vendor_stock: vendorProduct ? [{
            vendor_id: vendorId.toString(),
            min_order_quantity: '1',
            discontinued: product.discontinued ? 'yes' : 'no',
            manufacturer_suggested_retail_price: product.msrp?.toString() || '',
            min_advertised_price: product.mapPrice?.toString() || '',
            available_stock: vendorProduct.quantity?.toString() || '0',
            replacement_cost: vendorProduct.cost?.toString() || '0.00'
          }] : []
        };
      }

      return orderLine;
    });
  }

  /**
   * Legacy transform method for backwards compatibility
   */
  private static transformOrderItems(items: any[]): Array<any> {
    return items.map((item, index) => ({
      product_id: item.productId?.toString() || item.id?.toString() || index.toString(),
      sku_id: item.sku || item.partNumber || item.upc || '',
      line_note: item.customerReference || '',
      front_key: `line_${index}`,
      order_items: [{
        sku_id: item.sku || item.partNumber || item.upc || '',
        item_cost: item.unitCost?.toString() || item.price?.toString() || '0.00',
        order_quantity: item.quantity?.toString() || '1',
        front_key: `item_${index}`
      }]
    }));
  }

  /**
   * Format date to YYYY-MM-DD format
   */
  private static formatDate(date: Date | string | null): string | undefined {
    if (!date) return undefined;
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }

  /**
   * Send webhook to a specific endpoint
   */
  private static async sendWebhookToEndpoint(
    endpoint: WebhookEndpoint,
    payload: WebhookPayload
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'BestPrice-Webhook/1.0'
      };

      // Add signature header if secret is configured
      if (endpoint.secret) {
        const crypto = require('crypto');
        const signature = crypto
          .createHmac('sha256', endpoint.secret)
          .update(JSON.stringify(payload))
          .digest('hex');
        headers['X-Webhook-Signature-256'] = `sha256=${signature}`;
      }

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
        // Note: timeout is not supported in standard fetch, use AbortController if needed
      });

      if (!response.ok) {
        throw new Error(`Webhook endpoint responded with status ${response.status}`);
      }

      console.log(`Webhook successfully sent to ${endpoint.url}`);
    } catch (error) {
      console.error(`Failed to send webhook to ${endpoint.url}:`, error);
      // Log the failure but don't throw - continue with other endpoints
    }
  }

  /**
   * Get active webhook endpoints for a company and event type
   */
  private static async getActiveWebhookEndpoints(
    companyId: number,
    eventType: string
  ): Promise<WebhookEndpoint[]> {
    // This would typically query the database for webhook endpoints
    // For now, return a configurable endpoint from environment variables
    const webhookUrl = process.env.MICROBIZ_WEBHOOK_URL;
    const webhookSecret = process.env.MICROBIZ_WEBHOOK_SECRET;
    
    if (!webhookUrl) {
      return [];
    }

    return [{
      id: 1,
      url: webhookUrl,
      secret: webhookSecret,
      events: ['order_submitted'],
      active: true,
      companyId: companyId
    }];
  }

  /**
   * Generate webhook payload for preview purposes
   */
  static async generateWebhookPayload(
    orderData: any,
    orderItems: any[],
    storeData: any,
    companyData: any,
    vendorData: any
  ): Promise<WebhookPayload> {
    console.log(`WebhookService.generateWebhookPayload called for order:`, orderData?.orderNumber);
    console.log(`Order items count:`, orderItems?.length);
    console.log(`Store data:`, storeData?.name);
    console.log(`Company data:`, companyData?.name);
    console.log(`Vendor data:`, vendorData?.name);
    
    // Transform order items with comprehensive product information
    const orderLines = await this.transformOrderItemsWithProductInfo(
      orderItems,
      vendorData?.id || 1
    );

    console.log(`Order lines generated:`, orderLines?.length);

    const payload = {
      event: 'order_submitted' as const,
      timestamp: new Date().toISOString(),
      order_data: {
        vendor_id: vendorData?.id?.toString(),
        store_id: storeData?.id?.toString() || orderData.storeId?.toString(),
        store_display_name: storeData?.shortCode || storeData?.name || undefined,
        customer_location_id: storeData?.id?.toString(),
        start_ship: this.formatDate(orderData.orderDate),
        expected_date: this.formatDate(orderData.expectedDate),
        payment_date: this.formatDate(orderData.paymentDate),
        buyer_id: companyData?.id?.toString() || orderData.companyId?.toString(),
        ship_to: 'store' as const,
        bill_to: 'company' as const,
        ship_via: orderData.deliveryOption || undefined,
        notes: orderData.notes || '',
        free_on_board: 'shipping_point' as const,
        vendor_purchase_order_number: orderData.orderNumber || '',
        payment_term_id: orderData.paymentTermId?.toString(),
        customer_id: companyData?.id?.toString() || orderData.companyId?.toString(),
        order_placed_via: 'web_site' as const,
        cancel_date: orderData.status === 'cancelled' ? this.formatDate(new Date()) : undefined,
        order_lines: orderLines
      }
    };

    console.log(`Generated webhook payload:`, JSON.stringify(payload, null, 2));
    return payload;
  }

  /**
   * Test webhook endpoint connectivity
   */
  static async testWebhookEndpoint(url: string, secret?: string): Promise<{
    success: boolean;
    message: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        test: true
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'BestPrice-Webhook/1.0'
      };

      if (secret) {
        const crypto = require('crypto');
        const signature = crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(testPayload))
          .digest('hex');
        headers['X-Webhook-Signature-256'] = `sha256=${signature}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload)
        // Note: timeout is not supported in standard fetch, use AbortController if needed
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          message: `Webhook endpoint is reachable (${response.status})`,
          responseTime
        };
      } else {
        return {
          success: false,
          message: `Webhook endpoint responded with status ${response.status}`,
          responseTime
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to reach webhook endpoint: ${error.message}`,
        responseTime: Date.now() - startTime
      };
    }
  }


}
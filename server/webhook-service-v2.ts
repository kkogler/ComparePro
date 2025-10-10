import { db } from './db';
import { products, vendorProducts, companies, pricingConfigurations } from '@shared/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { getCategoryDisplayName } from '../shared/category-config';
// PricingService removed - no calculated values allowed, only authentic vendor API data
// import { PricingService, type PricingInputs } from './pricing-service';

// Industry standard webhook payload structure
export interface OrderWebhookPayload {
  // Event metadata
  event: 'order.created' | 'order.updated' | 'order.submitted' | 'order.cancelled' | 'order.completed';
  timestamp: string;
  webhook_id: string;
  api_version: string;
  
  // Order data with complete information
  data: {
    order: {
      id: number;
      order_number: string;
      status: string;
      order_date: string;
      expected_date?: string;
      total_amount: string;
      item_count: number;
      shipping_cost: string;
      notes?: string;
      external_order_number?: string;
      order_type?: string;
      created_at: string;
      
      // Vendor information
      vendor: {
        id: number;
        name: string;
        short_code?: string;
        type?: string;
      };
      
      // Company information
      company: {
        id: number;
        name: string;
        slug?: string;
      };
      
      // Store information
      store?: {
        id: number;
        name: string;
        short_code?: string;
        timezone?: string;
        ffl_number?: string;
        phone?: string;
        address?: {
          line_1?: string;
          line_2?: string;
          city?: string;
          state?: string;
          zip?: string;
          country?: string;
        };
      };
      
      // Shipping information (if available)
      shipping?: {
        delivery_option?: string;
        drop_ship_flag?: boolean;
        insurance_flag?: boolean;
        adult_signature_flag?: boolean;
        delay_shipping?: boolean;
        overnight?: boolean;
        ship_to_name?: string;
        ship_to_address?: {
          line_1?: string;
          line_2?: string;
          city?: string;
          state?: string;
          zip?: string;
        };
      };
      
      // Billing information (if available)
      billing?: {
        billing_name?: string;
        billing_address?: {
          line_1?: string;
          line_2?: string;
          city?: string;
          state?: string;
          zip?: string;
        };
      };
      
      // Order items with comprehensive product information
      items: Array<{
        id: number;
        quantity: number;
        unit_cost: string;
        total_cost: string;
        customer_reference?: string;
        
        // Product information from master catalog
        product: {
          id: number;
          name: string;
          upc?: string;
          part_number?: string;
          sku?: string;
          manufacturer?: string;
          model?: string;
          caliber?: string;
          category?: string;
          subcategory?: string;
          description?: string;
          msrp?: string;
          map_price?: string;
          retail_price?: string; // Calculated using pricing configuration
          weight?: number;
          dimensions?: {
            length?: number;
            width?: number;
            height?: number;
          };
          is_serialized?: boolean;
          is_restricted?: boolean;
          discontinued?: boolean;
          image_url?: string;
        };
        
        // Vendor-specific product information (if available)
        vendor_product?: {
          vendor_id: number;
          vendor_sku?: string;
          vendor_part_number?: string;
          vendor_price?: string;
          vendor_cost?: string;
          vendor_msrp?: string;
          vendor_map_price?: string;
          available_quantity?: number;
          minimum_order_quantity?: number;
          discontinued?: boolean;
          last_updated?: string;
        };
      }>;
      
      // Created by user information (if available)
      created_by?: {
        id: number;
        username?: string;
        email?: string;
      };
      
      // Additional vendor-specific fields for API integrations
      vendor_specific?: {
        ffl_number?: string;
        customer?: string;
        customer_phone?: string;
        warehouse?: string;
        message_for_sales_exec?: string;
        [key: string]: any; // Allow additional vendor-specific fields
      };
    };
  };
}

export interface WebhookEndpoint {
  id: number;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  company_id: number;
}

export class WebhookServiceV2 {
  /**
   * Generate comprehensive webhook payload with all available order data
   */
  static async generateOrderWebhook(
    orderData: any,
    orderItems: any[],
    storeData?: any,
    companyData?: any,
    vendorData?: any,
    userData?: any,
    eventType: 'order.created' | 'order.updated' | 'order.submitted' | 'order.cancelled' | 'order.completed' = 'order.submitted'
  ): Promise<OrderWebhookPayload> {
    
    // Get comprehensive product information for all order items with calculated retail pricing
    const enrichedItems = await this.enrichOrderItems(orderItems, vendorData?.id, companyData?.id);
    
    const payload: OrderWebhookPayload = {
      // Event metadata
      event: eventType,
      timestamp: new Date().toISOString(),
      webhook_id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      api_version: 'v1',
      
      data: {
        order: {
          // Basic order information
          id: orderData.id,
          order_number: orderData.orderNumber,
          status: orderData.status,
          order_date: orderData.orderDate ? new Date(orderData.orderDate).toISOString() : new Date().toISOString(),
          expected_date: orderData.expectedDate ? new Date(orderData.expectedDate).toISOString() : undefined,
          total_amount: orderData.totalAmount?.toString() || '0.00',
          item_count: orderData.itemCount || orderItems.length,
          shipping_cost: orderData.shippingCost?.toString() || '0.00',
          notes: orderData.notes || undefined,
          external_order_number: orderData.externalOrderNumber || undefined,
          order_type: orderData.orderType || undefined,
          created_at: orderData.createdAt ? new Date(orderData.createdAt).toISOString() : new Date().toISOString(),
          
          // Vendor information
          vendor: {
            id: vendorData?.id || orderData.vendorId,
            name: vendorData?.name || 'Unknown Vendor',
            short_code: vendorData?.vendorShortCode || undefined,
            type: vendorData?.type || undefined,
          },
          
          // Company information  
          company: {
            id: companyData?.id || orderData.companyId,
            name: companyData?.name || 'Unknown Company',
            slug: companyData?.slug || undefined,
          },
          
          // Store information (if available)
          store: storeData ? {
            id: storeData.id,
            name: storeData.name,
            short_code: storeData.shortCode || undefined,
            timezone: storeData.timezone || undefined,
            ffl_number: storeData.fflNumber || undefined,
            phone: storeData.phone || undefined,
            address: storeData.address1 ? {
              line_1: storeData.address1,
              line_2: storeData.address2 || undefined,
              city: storeData.city || undefined,
              state: storeData.state || undefined,
              zip: storeData.zipCode || undefined,
              country: storeData.country || 'US', // Default to US if not specified
            } : undefined,
          } : undefined,
          
          // Shipping information (if available)
          shipping: this.buildShippingInfo(orderData),
          
          // Billing information (if available)
          billing: this.buildBillingInfo(orderData),
          
          // Enriched order items
          items: enrichedItems,
          
          // Created by user (if available)
          created_by: userData ? {
            id: userData.id,
            username: userData.username || undefined,
            email: userData.email || undefined,
          } : undefined,
          
          // Vendor-specific fields
          vendor_specific: this.buildVendorSpecificFields(orderData),
        }
      }
    };
    
    return payload;
  }
  
  /**
   * Extract pricing information from authentic database sources only
   */
  private static extractPricingInfo(product: any, specifications: any, customProperties: any): any {
    const pricing: any = {};
    
    // Only extract actual values from database, no defaults or fallbacks
    if (product?.msrp) pricing.msrp = product.msrp.toString();
    if (product?.mapPrice) pricing.map_price = product.mapPrice.toString();
    
    // Parse specifications JSON if it exists and contains pricing
    if (specifications && typeof specifications === 'object') {
      if (specifications.msrp) pricing.msrp = specifications.msrp.toString();
      // REMOVED: retailPrice mapping to prevent fabrication
      if (specifications.suggestedRetailPrice) pricing.msrp = specifications.suggestedRetailPrice.toString();
      if (specifications.mapPrice) pricing.map_price = specifications.mapPrice.toString();
      if (specifications.minimumAdvertisedPrice) pricing.map_price = specifications.minimumAdvertisedPrice.toString();
    }
    
    // Parse customProperties JSON if it exists and contains pricing
    if (customProperties && typeof customProperties === 'object') {
      if (customProperties.msrp) pricing.msrp = customProperties.msrp.toString();
      if (customProperties.mapPrice) pricing.map_price = customProperties.mapPrice.toString();
    }
    
    // Only return pricing object if it contains actual data
    return Object.keys(pricing).length > 0 ? pricing : {};
  }

  /**
   * Enrich order items with comprehensive product information and calculated retail pricing
   */
  private static async enrichOrderItems(orderItems: any[], vendorId?: number, companyId?: number): Promise<any[]> {
    if (!orderItems || orderItems.length === 0) {
      return [];
    }
    
    // Get all product IDs - fix database column naming mismatch
    const productIds = orderItems
      .map(item => item.product_id || item.productId || item.id)
      .filter(id => id !== null && id !== undefined);
    
    let productData: any[] = [];
    let vendorProductData: any[] = [];
    let pricingConfig: any = null;
    
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
        .where(inArray(vendorProducts.productId, productIds));
    }

    // Get company's default pricing configuration if companyId is available
    if (companyId) {
      const pricingConfigs = await db
        .select()
        .from(pricingConfigurations)
        .where(and(
          eq(pricingConfigurations.companyId, companyId),
          eq(pricingConfigurations.isDefault, true),
          eq(pricingConfigurations.isActive, true)
        ));
      pricingConfig = pricingConfigs[0] || null;
    }
    
    return Promise.all(orderItems.map(async (item) => {
      const productId = item.product_id || item.productId || item.id;
      const product = productData.find(p => p.id === productId);
      // Use vendor registry for proper vendor matching
      const vendorProduct = vendorProductData.find(vp => 
        vp.productId === productId && 
        (vendorId ? vp.vendorId === vendorId : true)
      );
      
      
      const unitCost = parseFloat(item.unitCost?.toString() || '0');
      const quantity = parseInt(item.quantity?.toString() || '1');
      const totalCost = (unitCost * quantity).toFixed(2);

      // Use vendor pricing data stored at order time (authentic vendor API response data)
      const vendorPricing: any = {};
      
      // Always include MAP and MSRP fields in webhook, even if null
      vendorPricing.msrp = item.vendor_msrp !== null && item.vendor_msrp !== undefined 
        ? item.vendor_msrp.toString() 
        : null;
      vendorPricing.map_price = item.vendor_map_price !== null && item.vendor_map_price !== undefined 
        ? item.vendor_map_price.toString() 
        : null;
      
      // NO CALCULATED VALUES ALLOWED - User requires 100% authentic vendor API data only
      // Removed all calculated retail pricing to prevent fabricated data
      let calculatedRetailPrice: number | undefined = undefined;
      let isPriceCalculated = false;
      
      // Fallback to database pricing only if no vendor pricing stored
      const extractedPricing = (vendorPricing.msrp || vendorPricing.map_price)
        ? vendorPricing 
        : WebhookServiceV2.extractPricingInfo(product, product?.specifications, product?.customProperties);
      
      // Always include MAP and MSRP in final pricing, even if null
      const finalPricing = {
        msrp: vendorPricing.msrp,
        map_price: vendorPricing.map_price
      };
      
      // Check if MAP or MSRP is available (for legacy compatibility checks)
      const hasMapOrMsrp = Boolean(vendorPricing.msrp || vendorPricing.map_price);
      
      return {
        id: item.id,
        quantity: quantity,
        unit_cost: unitCost.toFixed(2),
        total_cost: totalCost,
        customer_reference: item.customerReference || undefined,
        
        // Master product catalog information (only authentic database values)
        product: {
          name: product?.name || undefined,
          upc: product?.upc || null, // Always include UPC field
          brand: product?.brand || undefined,
          model: product?.model || null, // Always include Model field
          manufacturer_part_number: product?.manufacturerPartNumber || null, // Always include MFG Part Number field
          caliber: product?.caliber || undefined,
          category: item.category ? getCategoryDisplayName(item.category) : (product?.category || undefined), // Convert slug to display name
          subcategory1: product?.subcategory1 || undefined,
          subcategory2: product?.subcategory2 || undefined,
          subcategory3: product?.subcategory3 || undefined,
          description: product?.description || undefined,
          barrel_length: product?.barrelLength || undefined,
          is_serialized: product?.serialized || undefined,
          discontinued: product?.discontinued || undefined,
          image_url: product?.imageUrl || undefined,
          // Include pricing data (always show MAP and MSRP, even if null)
          ...finalPricing,
          // Use the configured retail price from Add to Order modal (pricing rules or manual entry)
          retail_price: item.retailPrice ? parseFloat(item.retailPrice).toFixed(2) : '0.00',
          // Indicate if price was calculated using store pricing rules
          price_calculated_by_rule: isPriceCalculated ? true : undefined,
          // Raw specifications and custom properties for additional data
          specifications: product?.specifications || undefined,
          custom_properties: product?.customProperties || undefined,
        },
        
        // Vendor-specific product information (always include vendor_sku field)
        vendor_product: {
          vendor_id: vendorProduct?.vendorId || undefined,
          vendor_sku: item.vendorSku || item.vendor_sku || vendorProduct?.vendorSku || null, // Get vendor SKU from order item (stored at order creation time)
          last_updated: vendorProduct?.lastUpdated ? new Date(vendorProduct.lastUpdated).toISOString() : undefined,
        },
      };
    }));
  }
  
  /**
   * Build shipping information object
   */
  private static buildShippingInfo(orderData: any): any {
    const hasShippingData = orderData.deliveryOption || 
                           orderData.dropShipFlag || 
                           orderData.shipToName || 
                           orderData.shipToLine1;
    
    if (!hasShippingData) {
      return undefined;
    }
    
    return {
      delivery_option: orderData.deliveryOption || undefined,
      drop_ship_flag: orderData.dropShipFlag || undefined,
      insurance_flag: orderData.insuranceFlag || undefined,
      adult_signature_flag: orderData.adultSignatureFlag || undefined,
      delay_shipping: orderData.delayShipping || undefined,
      overnight: orderData.overnight || undefined,
      ship_to_name: orderData.shipToName || undefined,
      ship_to_address: orderData.shipToLine1 ? {
        line_1: orderData.shipToLine1,
        line_2: orderData.shipToLine2 || undefined,
        city: orderData.shipToCity || undefined,
        state: orderData.shipToStateCode || undefined,
        zip: orderData.shipToZip || undefined,
      } : undefined,
    };
  }
  
  /**
   * Build billing information object
   */
  private static buildBillingInfo(orderData: any): any {
    const hasBillingData = orderData.billingName || orderData.billingLine1;
    
    if (!hasBillingData) {
      return undefined;
    }
    
    return {
      billing_name: orderData.billingName || undefined,
      billing_address: orderData.billingLine1 ? {
        line_1: orderData.billingLine1,
        line_2: orderData.billingLine2 || undefined,
        city: orderData.billingCity || undefined,
        state: orderData.billingStateCode || undefined,
        zip: orderData.billingZip || undefined,
      } : undefined,
    };
  }
  
  /**
   * Build vendor-specific fields object
   */
  private static buildVendorSpecificFields(orderData: any): any {
    const fields: any = {};
    
    // Add vendor-specific fields if they exist
    if (orderData.fflNumber) fields.ffl_number = orderData.fflNumber;
    if (orderData.customer) fields.customer = orderData.customer;
    if (orderData.customerPhone) fields.customer_phone = orderData.customerPhone;
    if (orderData.warehouse) fields.warehouse = orderData.warehouse;
    if (orderData.messageForSalesExec) fields.message_for_sales_exec = orderData.messageForSalesExec;
    
    // Return undefined if no vendor-specific fields
    return Object.keys(fields).length > 0 ? fields : undefined;
  }
  
  /**
   * Send webhook to external endpoints
   */
  static async sendWebhook(
    payload: OrderWebhookPayload,
    companyId: number
  ): Promise<void> {
    try {
      const endpoints = await this.getActiveWebhookEndpoints(companyId, payload.event);
      
      if (endpoints.length === 0) {
        console.log(`No active webhook endpoints found for event: ${payload.event}`);
        return;
      }
      
      const webhookPromises = endpoints.map(endpoint => 
        this.sendWebhookToEndpoint(endpoint, payload)
      );
      
      await Promise.allSettled(webhookPromises);
      console.log(`Webhook sent for event: ${payload.event}, order: ${payload.data.order.order_number}`);
      
    } catch (error) {
      console.error('Error sending webhook:', error);
    }
  }
  
  /**
   * Send webhook to specific endpoint with proper headers and signature
   */
  private static async sendWebhookToEndpoint(
    endpoint: WebhookEndpoint,
    payload: OrderWebhookPayload
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'BestPrice-Webhook/2.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-ID': payload.webhook_id,
        'X-Webhook-Timestamp': payload.timestamp,
      };
      
      // Add HMAC signature if secret is configured
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
        body: JSON.stringify(payload, null, 2), // Pretty print for debugging
      });
      
      if (!response.ok) {
        throw new Error(`Webhook endpoint returned status ${response.status}: ${response.statusText}`);
      }
      
      console.log(`Webhook successfully sent to ${endpoint.url} for event ${payload.event}`);
      
    } catch (error) {
      console.error(`Failed to send webhook to ${endpoint.url}:`, error);
    }
  }
  
  /**
   * Get active webhook endpoints for company and event
   */
  private static async getActiveWebhookEndpoints(
    companyId: number,
    eventType: string
  ): Promise<WebhookEndpoint[]> {
    // Use environment variables for webhook configuration
    const webhookUrl = process.env.WEBHOOK_URL;
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    if (!webhookUrl) {
      return [];
    }
    
    return [{
      id: 1,
      url: webhookUrl,
      secret: webhookSecret,
      events: [eventType],
      active: true,
      company_id: companyId,
    }];
  }
}
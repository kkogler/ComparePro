import { storage } from './storage';

export interface ShipNoticeItem {
  sku: string;
  upc?: string;
  partNumber?: string;
  quantityShipped: number;
  quantityBackordered?: number;
  unitCost?: number;
  lineNumber?: number;
  notes?: string;
}

export interface ShipNoticeData {
  vendorOrderNumber: string;
  shipNoticeNumber: string;
  trackingNumber?: string;
  carrier?: string;
  shipDate: string;
  estimatedDelivery?: string;
  items: ShipNoticeItem[];
  shippingCost?: number;
  notes?: string;
  vendorId?: number;
  organizationId?: number;
  
  // Enhanced order-level fields (optional for backward compatibility)
  shipmentId?: string;
  purchaseOrderId?: string;
  totalUnitsShipped?: number;
  totalUnitsBackordered?: number;
  poShippingCost?: number;
  poOtherCost?: number;
  totalPoAmount?: number;
  poNote?: string;
}

export class ShipNoticeProcessor {
  /**
   * Process incoming ship notice from vendor webhook
   */
  static async processShipNotice(data: ShipNoticeData): Promise<{
    success: boolean;
    asnId?: number;
    message: string;
    errors?: string[];
  }> {
    try {
      console.log('SHIP NOTICE: Processing ship notice:', data.shipNoticeNumber);
      
      // Find the order by vendor order number
      const order = await storage.getOrderByExternalNumber(data.vendorOrderNumber);
      if (!order) {
        return {
          success: false,
          message: `Order not found for vendor order number: ${data.vendorOrderNumber}`
        };
      }

      // Get vendor information
      const vendor = await storage.getVendor(order.vendorId);
      if (!vendor) {
        return {
          success: false,
          message: `Vendor not found for order: ${order.orderNumber}`
        };
      }

      // Create the ASN record using enhanced schema
      const asnData = {
        asnNumber: data.shipNoticeNumber,
        orderId: order.id,
        vendorId: order.vendorId,
        status: 'open',
        
        // Enhanced order-level fields
        shipDate: new Date(data.shipDate),
        shipmentId: data.shipmentId || null,
        purchaseOrderId: data.purchaseOrderId || order.orderNumber,
        totalUnitsShipped: data.totalUnitsShipped || data.items.reduce((sum, item) => sum + item.quantityShipped, 0),
        totalUnitsBackordered: data.totalUnitsBackordered || data.items.reduce((sum, item) => sum + (item.quantityBackordered || 0), 0),
        poShippingCost: data.poShippingCost?.toString() || '0',
        poOtherCost: data.poOtherCost?.toString() || '0',
        totalPoAmount: data.totalPoAmount?.toString() || '0',
        poNote: data.poNote || null,
        trackingNumber: data.trackingNumber,
        carrier: data.carrier || null,
        
        // Legacy fields for backward compatibility
        itemsShipped: data.items.reduce((sum, item) => sum + item.quantityShipped, 0),
        itemsTotal: data.items.length,
        shippingCost: data.shippingCost?.toString() || '0',
        notes: data.notes,
        rawData: data
      };

      const asn = await storage.createASN(asnData);
      console.log('SHIP NOTICE: Created ASN:', asn.id);

      // Process each shipped item
      const orderItems = await storage.getOrderItemsByOrderId(order.id);
      const errors: string[] = [];
      let processedItems = 0;

      for (const shipItem of data.items) {
        try {
          // Find matching order item by SKU, UPC, or part number
          let matchedOrderItem = null;
          
          // First try to match by vendor SKU
          if (shipItem.sku) {
            const vendorProduct = await storage.getVendorProductBySku(order.vendorId, shipItem.sku);
            if (vendorProduct) {
              matchedOrderItem = orderItems.find(oi => oi.vendorProductId === vendorProduct.id);
            }
          }

          // If no match by SKU, try UPC
          if (!matchedOrderItem && shipItem.upc) {
            const product = await storage.getProductByUPC(shipItem.upc);
            if (product) {
              matchedOrderItem = orderItems.find(oi => oi.productId === product.id);
            }
          }

          // If no match by UPC, try part number
          if (!matchedOrderItem && shipItem.partNumber) {
            const product = await storage.getProductByPartNumber(shipItem.partNumber);
            if (product) {
              matchedOrderItem = orderItems.find(oi => oi.productId === product.id);
            }
          }

          if (!matchedOrderItem) {
            errors.push(`No matching order item found for SKU: ${shipItem.sku || shipItem.upc || shipItem.partNumber}`);
            continue;
          }

          // Create ASN item record
          const asnItemData = {
            asnId: asn.id,
            orderItemId: matchedOrderItem.id,
            quantityShipped: shipItem.quantityShipped,
            quantityBackordered: shipItem.quantityBackordered || 0
          };

          await storage.createASNItem(asnItemData);
          processedItems++;

        } catch (itemError: any) {
          errors.push(`Error processing item ${shipItem.sku}: ${itemError.message}`);
        }
      }

      // Update order status if all items shipped
      const totalShipped = data.items.reduce((sum, item) => sum + item.quantityShipped, 0);
      const totalOrdered = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      
      if (totalShipped >= totalOrdered) {
        await storage.updateOrder(order.id, { status: 'complete' });
        console.log('SHIP NOTICE: Order marked as complete');
      }

      return {
        success: true,
        asnId: asn.id,
        message: `Ship notice processed: ${processedItems} items matched, ${errors.length} errors`,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error: any) {
      console.error('SHIP NOTICE: Processing error:', error);
      return {
        success: false,
        message: `Failed to process ship notice: ${error.message}`
      };
    }
  }

  /**
   * Create ship notice from Chattanooga order tracking response
   */
  static async createChattanoogaASN(orderNumber: string, trackingData: any): Promise<{
    success: boolean;
    asnId?: number;
    message: string;
  }> {
    try {
      // Find order by Chattanooga order number
      const order = await storage.getOrderByExternalNumber(orderNumber);
      if (!order) {
        return {
          success: false,
          message: `Order not found for Chattanooga order: ${orderNumber}`
        };
      }

      // Create ASN from tracking data
      const shipNoticeData: ShipNoticeData = {
        vendorOrderNumber: orderNumber,
        shipNoticeNumber: `CH-ASN-${orderNumber}`,
        trackingNumber: trackingData.trackingNumber,
        carrier: trackingData.carrier || 'FedEx',
        shipDate: trackingData.shipDate || new Date().toISOString(),
        items: [], // Will be populated from order items
        vendorId: order.vendorId,
        organizationId: order.organizationId
      };

      // Get order items and create ship notice items
      const orderItems = await storage.getOrderItemsByOrderId(order.id);
      for (const orderItem of orderItems) {
        const vendorProduct = orderItem.vendorProductId ? await storage.getVendorProduct(orderItem.vendorProductId) : null;
        const product = await storage.getProduct(orderItem.productId);

        shipNoticeData.items.push({
          sku: vendorProduct?.vendorSku || product?.upc || '',
          upc: product?.upc,
          partNumber: product?.partNumber,
          quantityShipped: orderItem.quantity, // Assume full shipment
          quantityBackordered: 0
        });
      }

      return await this.processShipNotice(shipNoticeData);

    } catch (error: any) {
      console.error('CHATTANOOGA ASN: Creation error:', error);
      return {
        success: false,
        message: `Failed to create Chattanooga ASN: ${error.message}`
      };
    }
  }

  /**
   * Create ship notice from GunBroker marketplace order confirmation
   */
  static async createGunBrokerASN(orderData: any, trackingInfo?: any): Promise<{
    success: boolean;
    asnId?: number;
    message: string;
  }> {
    try {
      // GunBroker marketplace orders use different structure
      const shipNoticeData: ShipNoticeData = {
        vendorOrderNumber: orderData.orderNumber || orderData.itemID,
        shipNoticeNumber: `GB-ASN-${orderData.orderNumber || orderData.itemID}`,
        trackingNumber: trackingInfo?.trackingNumber,
        carrier: trackingInfo?.carrier || 'USPS',
        shipDate: trackingInfo?.shipDate || new Date().toISOString(),
        items: [{
          sku: orderData.sku || orderData.itemID,
          upc: orderData.gtin || orderData.upc,
          quantityShipped: 1, // GunBroker typically single items
          quantityBackordered: 0
        }],
        vendorId: orderData.vendorId,
        organizationId: orderData.organizationId
      };

      return await this.processShipNotice(shipNoticeData);

    } catch (error: any) {
      console.error('GUNBROKER ASN: Creation error:', error);
      return {
        success: false,
        message: `Failed to create GunBroker ASN: ${error.message}`
      };
    }
  }
}
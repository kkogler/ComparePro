import { storage } from './storage';
import { InsertASN, InsertASNItem, Order, OrderItem } from '@shared/schema';

/**
 * Lipsey's API Response structure for order submission
 */
interface LipseyOrderResponseItem {
  itemNumber: string;
  lipseysItemNumber: string;
  note: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
  errors: string[];
  exists: boolean;
  blocked: boolean;
  allocated: boolean;
  validForCart: boolean;
  validForShipTo: boolean;
  orderError: boolean;
  orderNumber: number;
  price: number;
  totalPrice: number;
}

interface LipseyOrderResponse {
  success: boolean;
  authorized: boolean;
  errors: string[];
  data: LipseyOrderResponseItem[];
}

/**
 * Process Lipsey's API order response and create ASN records
 */
export class ASNProcessor {
  /**
   * Creates an ASN from a successful Lipsey's order response
   */
  static async createASNFromLipseyResponse(
    originalOrder: Order,
    lipseyResponse: LipseyOrderResponse,
    originalOrderItems: OrderItem[]
  ): Promise<{ asn: any; asnItems: any[] } | null> {
    try {
      if (!lipseyResponse.success || !lipseyResponse.authorized) {
        console.error('Lipsey response not successful or not authorized:', lipseyResponse.errors);
        return null;
      }

      // Generate ASN number using Lipsey's order number if available
      const lipseyOrderNumber = lipseyResponse.data[0]?.orderNumber;
      const asnNumber = `ASN-LIPSEY-${lipseyOrderNumber || Date.now()}`;

      // Calculate totals from response
      let totalItemsShipped = 0;
      let totalItemsOrdered = 0;
      let hasErrors = false;
      let shipmentNotes: string[] = [];

      // Process each item in the response
      const processedItems = lipseyResponse.data.map(responseItem => {
        totalItemsOrdered += responseItem.requestedQuantity;
        totalItemsShipped += responseItem.fulfilledQuantity;

        // Track issues
        if (responseItem.orderError || responseItem.errors.length > 0) {
          hasErrors = true;
          shipmentNotes.push(`${responseItem.itemNumber}: ${responseItem.errors.join(', ')}`);
        }

        if (responseItem.blocked) {
          shipmentNotes.push(`${responseItem.itemNumber}: Item blocked`);
        }

        if (responseItem.allocated) {
          shipmentNotes.push(`${responseItem.itemNumber}: Item allocated`);
        }

        // Find matching order item
        const matchingOrderItem = originalOrderItems.find(item => {
          // Try to match by vendor SKU (stored in vendorProduct)
          // This would require fetching the vendor product to get the SKU
          return true; // For now, match in order
        });

        return {
          responseItem,
          matchingOrderItem,
          quantityShipped: responseItem.fulfilledQuantity,
          quantityBackordered: responseItem.requestedQuantity - responseItem.fulfilledQuantity
        };
      });

      // Determine ASN status
      let asnStatus = 'complete';
      if (totalItemsShipped === 0) {
        asnStatus = 'cancelled';
      } else if (totalItemsShipped < totalItemsOrdered) {
        asnStatus = 'partial';
      }

      // Create ASN record
      const asnData: InsertASN = {
        asnNumber,
        orderId: originalOrder.id,
        vendorId: originalOrder.vendorId,
        status: asnStatus,
        shipDate: new Date(), // Lipsey's doesn't provide ship date, use current date
        trackingNumber: undefined, // Lipsey's doesn't provide tracking in order response
        itemsShipped: totalItemsShipped,
        itemsTotal: totalItemsOrdered,
        shippingCost: '0.00', // Lipsey's doesn't provide shipping cost in order response
        notes: this.generateASNNotes(lipseyResponse, shipmentNotes, hasErrors),
        rawData: {
          lipseyOrderResponse: lipseyResponse,
          processedAt: new Date().toISOString(),
          vendor: 'Lipsey\'s',
          originalOrderNumber: originalOrder.orderNumber
        }
      };

      // Create ASN
      const createdASN = await storage.createASN(asnData);

      // Create ASN Items
      const asnItems = [];
      for (let i = 0; i < processedItems.length && i < originalOrderItems.length; i++) {
        const processedItem = processedItems[i];
        const orderItem = originalOrderItems[i];

        const asnItemData: InsertASNItem = {
          asnId: createdASN.id,
          orderItemId: orderItem.id,
          quantityShipped: processedItem.quantityShipped,
          quantityBackordered: processedItem.quantityBackordered
        };

        const createdASNItem = await storage.createASNItem(asnItemData);
        asnItems.push(createdASNItem);
      }

      return {
        asn: createdASN,
        asnItems
      };

    } catch (error) {
      console.error('Error creating ASN from Lipsey response:', error);
      return null;
    }
  }

  /**
   * Generate detailed notes for the ASN based on Lipsey's response
   */
  private static generateASNNotes(
    response: LipseyOrderResponse,
    shipmentNotes: string[],
    hasErrors: boolean
  ): string {
    const notes: string[] = [];

    // Add order summary
    const totalItems = response.data.length;
    const successfulItems = response.data.filter(item => !item.orderError && item.fulfilledQuantity > 0).length;
    notes.push(`Lipsey's Order Confirmation: ${successfulItems}/${totalItems} items processed successfully`);

    // Add Lipsey's order numbers
    const orderNumbers = [...new Set(response.data.map(item => item.orderNumber).filter(Boolean))];
    if (orderNumbers.length > 0) {
      notes.push(`Lipsey's Order Number(s): ${orderNumbers.join(', ')}`);
    }

    // Add error summary if any
    if (hasErrors) {
      notes.push('Issues encountered:');
      notes.push(...shipmentNotes);
    }

    // Add general response info
    if (response.errors && response.errors.length > 0) {
      notes.push('General errors: ' + response.errors.join(', '));
    }

    return notes.join('\n');
  }

  /**
   * Example usage with sample Lipsey's response
   */
  static createSampleASN(): { asn: InsertASN; asnItems: InsertASNItem[]; responseData: LipseyOrderResponse } {
    // Sample Lipsey's response based on the provided structure
    const sampleLipseyResponse: LipseyOrderResponse = {
      success: true,
      authorized: true,
      errors: [],
      data: [
        // NOTE: This is test data only - in production, this data comes from actual Lipsey's API responses
        // Real ASN processing uses authentic vendor responses with actual SKUs and order data
        {
          itemNumber: "VENDOR-ITEM-001",
          lipseysItemNumber: "VENDOR-SKU-001",
          note: "Standard processing",
          requestedQuantity: 2,
          fulfilledQuantity: 2,
          errors: [],
          exists: true,
          blocked: false,
          allocated: false,
          validForCart: true,
          validForShipTo: true,
          orderError: false,
          orderNumber: 1234567,
          price: 465.20,
          totalPrice: 930.40
        },
        {
          itemNumber: "VENDOR-ITEM-002", 
          lipseysItemNumber: "VENDOR-SKU-002",
          note: "Partial fulfillment",
          requestedQuantity: 3,
          fulfilledQuantity: 1,
          errors: ["Insufficient inventory"],
          exists: true,
          blocked: false,
          allocated: true,
          validForCart: true,
          validForShipTo: true,
          orderError: false,
          orderNumber: 1234567,
          price: 455.20,
          totalPrice: 455.20
        }
      ]
    };

    // Sample ASN based on the response
    const sampleASN: InsertASN = {
      asnNumber: `ASN-VENDOR-${Date.now()}`, // Dynamic ASN number generation
      orderId: 4, // Reference to existing order (use actual order ID)
      vendorId: 2, // Sample vendor ID - should be dynamic in production
      status: 'partial', // Some items backordered
      shipDate: new Date(),
      trackingNumber: undefined, // Not provided by Lipsey's in order response
      itemsShipped: 3, // 2 + 1 fulfilled
      itemsTotal: 5, // 2 + 3 requested
      shippingCost: '0.00',
      notes: `Vendor Order Confirmation: 2/2 items processed successfully
Vendor Order Number(s): ${Date.now()}
Issues encountered:
VENDOR-ITEM-002: Insufficient inventory
VENDOR-ITEM-002: Item allocated`,
      rawData: {
        lipseyOrderResponse: sampleLipseyResponse,
        processedAt: new Date().toISOString(),
        vendor: 'Lipsey\'s',
        originalOrderNumber: `ORD-${Date.now()}` // Dynamic order number for testing
      }
    };

    // Sample ASN Items
    const sampleASNItems: InsertASNItem[] = [
      {
        asnId: 1, // Will be set after ASN creation
        orderItemId: 4, // Reference to order item (use actual order item ID)
        quantityShipped: 2,
        quantityBackordered: 0
      },
      {
        asnId: 1, // Will be set after ASN creation
        orderItemId: 5, // Reference to order item (use actual order item ID)
        quantityShipped: 1,
        quantityBackordered: 2
      }
    ];

    return {
      asn: sampleASN,
      asnItems: sampleASNItems,
      responseData: sampleLipseyResponse
    };
  }
}
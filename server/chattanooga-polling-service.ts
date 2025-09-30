import { ChattanoogaAPI } from './chattanooga-api';
import { storage } from './storage';
import cron from 'node-cron';

interface ChattanoogaShipment {
  order_number: number;
  purchase_order_number: string;
  marked_as_received_flag: number;
  items: {
    ship_quantity: number;
    order_quantity: number;
    item_number: string;
    customer_reference?: string;
  }[];
  packages: {
    carrier_name: string;
    tracking_number: string;
  }[];
}

interface ChattanoogaShipmentResponse {
  shipments: ChattanoogaShipment[];
  pagination: {
    page: number;
    page_count: number;
    per_page: number;
  };
}

export class ChattanoogaPollingService {
  private isRunning = false;
  private cronJob: any = null;

  constructor() {
    // Poll every 15 minutes during business hours (8 AM - 6 PM EST)
    this.cronJob = cron.schedule('*/15 8-18 * * 1-5', () => {
      this.pollAllChattanoogaVendors();
    }, {
      scheduled: false
    });
  }

  start() {
    if (!this.isRunning) {
      this.cronJob.start();
      this.isRunning = true;
      console.log('Chattanooga polling service started - checking every 15 minutes during business hours');
    }
  }

  stop() {
    if (this.isRunning) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('Chattanooga polling service stopped');
    }
  }

  async pollAllChattanoogaVendors() {
    try {
      console.log('Starting Chattanooga shipment polling...');
      
      // Get all organizations with Chattanooga vendors
      const organizations = await storage.getAllOrganizations();
      
      for (const org of organizations) {
        await this.pollOrganizationShipments(org.id);
      }
      
      console.log('Completed Chattanooga shipment polling');
    } catch (error) {
      console.error('Error in Chattanooga polling service:', error);
    }
  }

  async pollOrganizationShipments(organizationId: number) {
    try {
      // Get Chattanooga vendors for this organization
      const vendors = await storage.getVendorsByOrganization(organizationId);
      const chattanoogaVendors = vendors.filter(v => 
        v.name.toLowerCase().includes('chattanooga') && 
        v.credentials &&
        (v.credentials as any).account &&
        (v.credentials as any).sid &&
        (v.credentials as any).token
      );

      if (chattanoogaVendors.length === 0) {
        return;
      }

      // Get recent orders that might have shipments
      const orders = await storage.getOrdersByOrganization(organizationId);
      const recentOrders = orders.filter(order => 
        order.status === 'open' && 
        order.externalOrderNumber &&
        chattanoogaVendors.some(v => v.id === order.vendorId)
      );

      if (recentOrders.length === 0) {
        return;
      }

      console.log(`Polling shipments for ${recentOrders.length} Chattanooga orders in org ${organizationId}`);

      for (const vendor of chattanoogaVendors) {
        await this.pollVendorShipments(vendor, recentOrders);
      }
    } catch (error) {
      console.error(`Error polling shipments for organization ${organizationId}:`, error);
    }
  }

  async pollVendorShipments(vendor: any, orders: any[]) {
    try {
      const api = new ChattanoogaAPI(vendor.credentials as any);
      
      // Get order numbers to check
      const orderNumbers = orders
        .filter(o => o.vendorId === vendor.id)
        .map(o => o.externalOrderNumber)
        .filter(Boolean);

      if (orderNumbers.length === 0) {
        return;
      }

      // Check for unreceived shipments
      const response = await api.getShipmentsByOrder(orderNumbers, {
        only_return_unreceived_shipments: true
      });

      if (response.shipments && response.shipments.length > 0) {
        console.log(`Found ${response.shipments.length} new shipments from Chattanooga`);
        
        for (const shipment of response.shipments) {
          await this.processShipment(vendor, shipment);
        }

        // Mark shipments as received
        const processedOrderNumbers = response.shipments.map((s: ChattanoogaShipment) => s.order_number);
        await api.markShipmentsAsReceived(processedOrderNumbers);
      }
    } catch (error) {
      console.error(`Error polling shipments for vendor ${vendor.name}:`, error);
    }
  }

  async processShipment(vendor: any, shipment: ChattanoogaShipment) {
    try {
      // Find the internal order
      const order = await storage.getOrderByExternalNumber(shipment.order_number.toString());
      if (!order) {
        console.warn(`No internal order found for Chattanooga order ${shipment.order_number}`);
        return;
      }

      // Create ASN record
      const asnNumber = `CHAT-${shipment.order_number}-${Date.now()}`;
      const trackingNumbers = shipment.packages.map(p => p.tracking_number).join(', ');
      
      const asn = await storage.createASN({
        vendorId: vendor.id,
        asnNumber: asnNumber,
        orderId: order.id,
        status: 'open',
        trackingNumber: trackingNumbers,
        itemsShipped: shipment.items.reduce((sum, item) => sum + item.ship_quantity, 0),
        notes: `Polled from Chattanooga API at ${new Date().toISOString()}`
      });

      // Create ASN items
      for (const item of shipment.items) {
        // Find the order item for this product
        const orderItems = await storage.getOrderItems(order.id);
        const matchingOrderItem = orderItems.find(oi => {
          // Try to match by vendor SKU or other criteria
          return oi.notes === item.item_number || oi.id.toString() === item.customer_reference;
        });

        if (matchingOrderItem) {
          await storage.createASNItem({
            asnId: asn.id,
            orderItemId: matchingOrderItem.id,
            quantityShipped: item.ship_quantity,
            quantityBackordered: Math.max(0, item.order_quantity - item.ship_quantity)
          });
        }
      }

      console.log(`Created ASN ${asnId} for Chattanooga order ${shipment.order_number} with ${shipment.items.length} items`);
    } catch (error) {
      console.error(`Error processing Chattanooga shipment ${shipment.order_number}:`, error);
    }
  }

  // Manual trigger for testing
  async triggerManualPoll() {
    console.log('Manual Chattanooga polling triggered');
    await this.pollAllChattanoogaVendors();
  }
}

// Export singleton instance
export const chattanoogaPollingService = new ChattanoogaPollingService();
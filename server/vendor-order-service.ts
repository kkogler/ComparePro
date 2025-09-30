import { Order, OrderItem, Vendor } from "@shared/schema";
import { vendorRegistry } from "./vendor-registry";
import { WebhookService } from "./webhook-service";

// Unified vendor order interface
export interface VendorOrderRequest {
  order: Order;
  items: OrderItem[];
  vendor: Vendor;
}

export interface VendorOrderResponse {
  success: boolean;
  externalOrderNumber?: string;
  totalAmount?: number;
  freight?: number;
  tax?: number;
  errors?: string[];
  lineItems?: VendorLineItemResponse[];
}

export interface VendorLineItemResponse {
  itemNumber: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
  price: number;
  totalPrice: number;
  errors?: string[];
}

// Base vendor order handler
export abstract class BaseVendorOrderHandler {
  abstract submitOrder(request: VendorOrderRequest): Promise<VendorOrderResponse>;
  abstract validateOrder(request: VendorOrderRequest): Promise<boolean>;
  
  // Common validation logic
  protected validateShippingAddress(order: Order): string[] {
    const errors: string[] = [];
    if (!order.shipToName) errors.push("Ship-to name is required");
    if (!order.shipToLine1) errors.push("Ship-to address line 1 is required");
    if (!order.shipToCity) errors.push("Ship-to city is required");
    if (!order.shipToStateCode) errors.push("Ship-to state is required");
    if (!order.shipToZip) errors.push("Ship-to ZIP code is required");
    return errors;
  }
  
  protected validateDropShipOrder(order: Order): string[] {
    const errors: string[] = [];
    if (order.dropShipFlag && !order.customer) {
      errors.push("Customer name is required for drop-ship orders");
    }
    return errors;
  }
}

// Chattanooga order handler
export class ChattanoogaOrderHandler extends BaseVendorOrderHandler {
  private apiEndpoint: string;
  private credentials: any;
  
  constructor(vendor: Vendor) {
    super();
    this.apiEndpoint = vendor.apiEndpoint || 'https://api.chattanoogashooting.com/rest/v5';
    this.credentials = vendor.credentials;
  }
  
  async validateOrder(request: VendorOrderRequest): Promise<boolean> {
    const { order, items } = request;
    const errors = [
      ...this.validateShippingAddress(order),
      ...this.validateDropShipOrder(order)
    ];
    
    // Chattanooga-specific validations
    if (order.dropShipFlag && order.deliveryOption && 
        !['best', 'fastest', 'economy', 'ground', 'next_day_air', 'second_day_air'].includes(order.deliveryOption)) {
      errors.push("Invalid delivery option for Chattanooga");
    }
    
    // FFL validation for drop-ship firearms
    if (order.dropShipFlag && order.fflNumber) {
      const fflRegex = /^\d{1}-\d{2}-\d{3}-\d{2}-\d{2}-\d{3}$/;
      if (!fflRegex.test(order.fflNumber.replace(/-/g, ''))) {
        errors.push("Invalid FFL format - hyphens must be removed");
      }
    }
    
    return errors.length === 0;
  }
  
  async submitOrder(request: VendorOrderRequest): Promise<VendorOrderResponse> {
    const { order, items } = request;
    
    // Map our order to Chattanooga API format
    const chattanoogaOrder = {
      purchase_order_number: order.orderNumber,
      drop_ship_flag: order.dropShipFlag ? 1 : 0,
      customer: order.customer,
      delivery_option: order.deliveryOption,
      insurance_flag: order.insuranceFlag ? 1 : 0,
      adult_signature_flag: order.adultSignatureFlag ? 1 : 0,
      federal_firearms_license_number: order.fflNumber?.replace(/-/g, ''),
      ship_to_address: {
        name: order.shipToName,
        line_1: order.shipToLine1,
        line_2: order.shipToLine2 || '',
        city: order.shipToCity,
        state_code: order.shipToStateCode,
        zip: parseInt(order.shipToZip || '0')
      },
      order_items: items.map(item => ({
        item_number: item.productId.toString(), // Will need to map to vendor SKU via vendorProducts table
        order_quantity: item.quantity,
        customer_reference: item.customerReference
      }))
    };
    
    try {
      const response = await fetch(`${this.apiEndpoint}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.credentials?.apiKey}`
        },
        body: JSON.stringify(chattanoogaOrder)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          errors: errorData.errors?.map((e: any) => e.message) || ['Order submission failed']
        };
      }
      
      const result = await response.json();
      const createdOrder = result.orders[0];
      
      return {
        success: true,
        externalOrderNumber: createdOrder.order_number.toString(),
        totalAmount: createdOrder.total_amount,
        freight: createdOrder.shipping_amount,
        lineItems: createdOrder.order_items.map((item: any) => ({
          itemNumber: item.item_number,
          requestedQuantity: item.order_quantity,
          fulfilledQuantity: item.order_quantity, // Chattanooga doesn't return fulfilled qty
          price: item.price,
          totalPrice: item.price * item.order_quantity
        }))
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}

// Lipsey's order handler
export class LipseysOrderHandler extends BaseVendorOrderHandler {
  private apiEndpoint: string;
  private credentials: any;
  private authToken?: string;
  
  constructor(vendor: Vendor) {
    super();
    this.apiEndpoint = vendor.apiEndpoint || 'https://api.lipseys.com';
    this.credentials = vendor.credentials;
  }
  
  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/Integration/Authentication/Login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Email: this.credentials?.email,
          Password: this.credentials?.password
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        this.authToken = result.token;
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
  
  async validateOrder(request: VendorOrderRequest): Promise<boolean> {
    const { order } = request;
    const errors = this.validateShippingAddress(order);
    
    // Lipsey's-specific validations
    if (order.orderType === 'dropship_firearm') {
      if (!order.fflNumber || order.fflNumber.length !== 15) {
        errors.push("Valid 15-digit FFL number required for firearm drop-ship");
      }
      if (!order.customerPhone) {
        errors.push("Customer phone number required for firearm drop-ship");
      }
    }
    
    if (order.orderType === 'dropship_accessory') {
      if (!order.billingName || !order.billingLine1 || !order.billingCity || 
          !order.billingStateCode || !order.billingZip) {
        errors.push("Complete billing address required for accessory drop-ship");
      }
    }
    
    return errors.length === 0;
  }
  
  async submitOrder(request: VendorOrderRequest): Promise<VendorOrderResponse> {
    const { order, items } = request;
    
    // Ensure authentication
    if (!this.authToken && !(await this.authenticate())) {
      return { success: false, errors: ['Authentication failed'] };
    }
    
    const lipseysItems = items.map(item => ({
      ItemNo: item.productId.toString(), // Will need to map to vendor SKU via vendorProducts table
      Quantity: item.quantity,
      Note: item.customerReference || ''
    }));
    
    try {
      let endpoint: string;
      let payload: any;
      
      // Determine endpoint and payload based on order type
      switch (order.orderType) {
        case 'dropship_firearm':
          endpoint = '/api/Integration/Order/DropShipFirearm';
          payload = {
            Ffl: order.fflNumber,
            Po: order.orderNumber,
            Name: order.customer,
            Phone: order.customerPhone,
            DelayShipping: order.delayShipping,
            DisableEmail: false,
            Items: lipseysItems
          };
          break;
          
        case 'dropship_accessory':
          endpoint = '/api/Integration/Order/DropShip';
          payload = {
            Warehouse: order.warehouse,
            PoNumber: order.orderNumber,
            BillingName: order.billingName,
            BillingAddressLine1: order.billingLine1,
            BillingAddressLine2: order.billingLine2 || '',
            BillingAddressCity: order.billingCity,
            BillingAddressState: order.billingStateCode,
            BillingAddressZip: order.billingZip,
            ShippingName: order.shipToName,
            ShippingAddressLine1: order.shipToLine1,
            ShippingAddressLine2: order.shipToLine2 || '',
            ShippingAddressCity: order.shipToCity,
            ShippingAddressState: order.shipToStateCode,
            ShippingAddressZip: order.shipToZip,
            MessageForSalesExec: order.messageForSalesExec || '',
            Overnight: order.overnight,
            DisableEmail: false,
            Items: lipseysItems
          };
          break;
          
        default: // standard order
          endpoint = '/api/Integration/Order/APIOrder';
          payload = {
            PONumber: order.orderNumber,
            DisableEmail: false,
            Items: lipseysItems
          };
      }
      
      const response = await fetch(`${this.apiEndpoint}${endpoint}`, {
        method: 'POST',
        headers: {
          'Token': this.authToken!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        return { success: false, errors: ['Order submission failed'] };
      }
      
      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          errors: result.errors || ['Unknown error']
        };
      }
      
      // Handle different response formats
      const responseData = result.data;
      const lineItems = Array.isArray(responseData) ? responseData : responseData?.lineItems || [];
      
      return {
        success: true,
        externalOrderNumber: responseData?.orderNumber?.toString() || 
                           lineItems[0]?.orderNumber?.toString(),
        totalAmount: responseData?.total,
        freight: responseData?.freight,
        tax: responseData?.tax,
        lineItems: lineItems.map((item: any) => ({
          itemNumber: item.itemNumber,
          requestedQuantity: item.requestedQuantity,
          fulfilledQuantity: item.fulfilledQuantity,
          price: item.price,
          totalPrice: item.totalPrice,
          errors: item.errors
        }))
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}

// Unified order service
export class VendorOrderService {
  private handlers: Map<string, BaseVendorOrderHandler> = new Map();
  
  constructor() {
    // Handlers are instantiated dynamically in getHandler method
  }
  
  private getHandler(vendor: Vendor): BaseVendorOrderHandler | null {
    const vendorHandler = vendorRegistry.getHandlerByVendorName(vendor.name);
    if (!vendorHandler) return null;
    
    // Match vendors by name patterns using vendorRegistry - follows architectural rule
    if (vendorHandler.name.toLowerCase().includes('chattanooga')) {
      return new ChattanoogaOrderHandler(vendor);
    } else if (vendorHandler.name.toLowerCase().includes('lipsey')) {
      return new LipseysOrderHandler(vendor);
    } else {
      return null;
    }
  }
  
  async submitOrder(
    request: VendorOrderRequest, 
    storeData?: any, 
    userData?: any, 
    companyId?: number
  ): Promise<VendorOrderResponse> {
    const handler = this.getHandler(request.vendor);
    
    if (!handler) {
      return {
        success: false,
        errors: [`Unsupported vendor: ${request.vendor.name}`]
      };
    }
    
    // Validate order before submission
    const isValid = await handler.validateOrder(request);
    if (!isValid) {
      return {
        success: false,
        errors: ['Order validation failed']
      };
    }
    
    // Submit the order to the vendor
    const response = await handler.submitOrder(request);
    
    // If order was successfully submitted, send webhook notification
    if (response.success && companyId) {
      try {
        await WebhookService.sendOrderSubmittedWebhook(
          request.order,
          request.vendor,
          storeData,
          userData,
          companyId
        );
      } catch (error) {
        console.error('Webhook notification failed, but order was successful:', error);
        // Don't fail the order if webhook fails
      }
    }
    
    return response;
  }
  
  async validateOrder(request: VendorOrderRequest): Promise<{valid: boolean; errors: string[]}> {
    const handler = this.getHandler(request.vendor);
    
    if (!handler) {
      return {
        valid: false,
        errors: [`Unsupported vendor: ${request.vendor.name}`]
      };
    }
    
    const valid = await handler.validateOrder(request);
    return { valid, errors: valid ? [] : ['Order validation failed'] };
  }
}

export const vendorOrderService = new VendorOrderService();
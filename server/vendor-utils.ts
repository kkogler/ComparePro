/**
 * Vendor utility functions for consistent vendor state handling
 */

/**
 * Check if a vendor is enabled for price comparison
 * Treats null/undefined as enabled (true) for backward compatibility
 * Only explicit false disables the vendor
 */
export function isVendorEnabledForPriceComparison(vendor: any): boolean {
  return vendor.enabledForPriceComparison !== false;
}

/**
 * Standard vendor error response format
 */
export function createVendorErrorResponse(vendor: any, availability: string, apiMessage: string) {
  return {
    vendor: {
      id: vendor.id,
      name: vendor.name,
      vendorShortCode: vendor.vendorShortCode,
      logoUrl: vendor.logoUrl || null,
      electronicOrders: vendor.electronicOrders || false
    },
    sku: null,
    cost: null,
    stock: 0,
    availability,
    apiMessage
  };
}

/**
 * Standard vendor success response format
 */
export function createVendorSuccessResponse(
  vendor: any, 
  productData: {
    sku?: string;
    cost?: string | number;
    stock?: number;
    availability?: string;
    msrp?: string | number;
    map?: string | number;
    apiMessage?: string;
  }
) {
  return {
    vendor: {
      id: vendor.id,
      name: vendor.name,
      vendorShortCode: vendor.vendorShortCode,
      logoUrl: vendor.logoUrl || null,
      electronicOrders: vendor.electronicOrders || false
    },
    sku: productData.sku || null,
    cost: productData.cost ? productData.cost.toString() : null,
    stock: productData.stock || 0,
    availability: productData.availability || 'unknown',
    msrp: productData.msrp ? productData.msrp.toString() : null,
    map: productData.map ? productData.map.toString() : null,
    calculatedRetailPrice: null,
    margin: null,
    isRealTime: true,
    apiMessage: productData.apiMessage || 'Success'
  };
}















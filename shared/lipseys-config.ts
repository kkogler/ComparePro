/**
 * Lipsey's Configuration
 * 
 * Centralized configuration for Lipsey's vendor-specific constants
 * to eliminate hardcoded references throughout the codebase.
 * 
 * Architectural Rule: All Lipsey's logic must use this configuration
 * instead of hardcoded values.
 */

export const LIPSEYS_CONFIG = {
  /**
   * Vendor identification for registry lookups
   */
  VENDOR_IDENTIFIER: 'lipseys',
  
  /**
   * Image source identifier for product records
   */
  IMAGE_SOURCE_NAME: "Lipsey's",
  
  /**
   * Image base URL for constructing product image URLs
   */
  IMAGE_BASE_URL: 'https://www.lipseyscloud.com/images',
  
  /**
   * Default product name prefix for items without descriptions
   */
  DEFAULT_PRODUCT_PREFIX: "Lipsey's Item",

  // Field mapping rules for catalog imports and syncs
  FIELD_MAPPINGS: {
    // Reference the centralized vendor field mappings
    VENDOR_ID: 'lipseys',
    
    // High quality fields for validation
    HIGH_QUALITY_FIELDS: {
      PRODUCT_NAME: 'description1',        // Primary product description
      PRODUCT_NAME_ALT: 'description2',    // Secondary detailed description
      BRAND: 'manufacturer',               // Manufacturer name
      UPC: 'upc',                          // Universal Product Code
      MANUFACTURER_PART_NUMBER: 'manufacturerModelNo', // Manufacturer part number
      MODEL: 'model'                       // Product model
    },
    
    // Medium quality fields
    MEDIUM_QUALITY_FIELDS: {
      CATEGORY: 'type',                    // Main category
      ITEM_TYPE: 'itemType',               // Item type subcategory
      CALIBER: 'caliberGauge',             // Caliber or gauge
      BARREL_LENGTH: 'barrelLength',       // Barrel length
      ACTION: 'action'                     // Action type
    },
    
    // Specification fields for detailed product data
    SPECIFICATION_FIELDS: {
      CAPACITY: 'capacity',
      FINISH: 'finish',
      FINISH_TYPE: 'finishType',
      OVERALL_LENGTH: 'overallLength',
      WEIGHT: 'weight',
      RECEIVER: 'receiver',
      FRAME: 'frame',
      STOCK_GRIPS: 'stockFrameGrips',
      GRIP_TYPE: 'gripType',
      SIGHTS: 'sights',
      SIGHTS_TYPE: 'sightsType',
      MAGAZINE: 'magazine',
      SAFETY: 'safety',
      CHAMBER: 'chamber',
      DRILLED_TAPPED: 'drilledAndTapped',
      RATE_OF_TWIST: 'rateOfTwist',
      CHOKE: 'choke',
      FAMILY: 'family',
      SHIPPING_WEIGHT: 'shippingWeight'
    },
    
    // Compliance and tracking fields
    COMPLIANCE_FIELDS: {
      FFL_REQUIRED: 'fflRequired',         // Requires FFL transfer
      SOT_REQUIRED: 'sotRequired',         // Requires SOT
      ALLOCATED: 'allocated',              // Special allocation
      BOUND_BOOK_MFG: 'boundBookManufacturer',
      BOUND_BOOK_MODEL: 'boundBookModel',
      BOUND_BOOK_TYPE: 'boundBookType'
    },
    
    // Vendor-specific fields (for vendor_product_mappings)
    VENDOR_SPECIFIC_FIELDS: {
      ITEM_NUMBER: 'itemNo',               // Lipsey's item number (SKU)
      PRICE: 'price',                      // Dealer cost
      CURRENT_PRICE: 'currentPrice',       // Current dealer cost
      RETAIL_MAP: 'retailMAP',             // Minimum Advertised Price
      MSRP: 'msrp',                        // Manufacturer's Suggested Retail
      QUANTITY: 'quantity',                // Available quantity
      ON_SALE: 'onSale',                   // Sale status
      EXCLUSIVE: 'exclusive',              // Lipsey's exclusive
      CAN_DROPSHIP: 'canDropship'          // Drop ship availability
    },
    
    // Image field
    IMAGE_FIELD: 'imageName',
    
    // Processing rules
    PROCESSING: {
      TRIM_WHITESPACE: ['description1', 'description2', 'manufacturer', 'model', 'manufacturerModelNo'],
      CONSTRUCT_IMAGE_URL: true,           // Construct full image URL from imageName
      COMBINE_SPECIFICATIONS: true         // Combine spec fields into JSON object
    }
  }
} as const;

/**
 * Get the Lipsey's vendor identifier for registry lookups
 */
export function getLipseysVendorId(): string {
  return LIPSEYS_CONFIG.VENDOR_IDENTIFIER;
}

/**
 * Get the image source name for Lipsey's products
 */
export function getLipseysImageSource(): string {
  return LIPSEYS_CONFIG.IMAGE_SOURCE_NAME;
}

/**
 * Construct full image URL from Lipsey's imageName
 * @param imageName - The image filename from Lipsey's API
 * @returns Full image URL or null if no image
 */
export function constructLipseysImageUrl(imageName?: string): string | null {
  if (!imageName) return null;
  return `${LIPSEYS_CONFIG.IMAGE_BASE_URL}/${imageName}`;
}

/**
 * Generate descriptive product name for Lipsey's items
 * Priority: description1 > description2 > Fallback
 */
export function generateLipseysProductName(product: {
  description1?: string;
  description2?: string;
  manufacturer?: string;
  model?: string;
  itemNo: string;
}): string {
  // Priority 1: Use description1 (primary description)
  if (product.description1?.trim()) {
    return product.description1.trim();
  }
  
  // Priority 2: Use description2 (secondary description)
  if (product.description2?.trim()) {
    return product.description2.trim();
  }
  
  // Priority 3: Construct from manufacturer + model
  if (product.manufacturer?.trim() && product.model?.trim()) {
    return `${product.manufacturer.trim()} ${product.model.trim()}`;
  }
  
  // Priority 4: Use manufacturer only
  if (product.manufacturer?.trim()) {
    return product.manufacturer.trim();
  }
  
  // Fallback: Use item number with prefix
  return `${LIPSEYS_CONFIG.DEFAULT_PRODUCT_PREFIX} ${product.itemNo}`;
}

/**
 * Build specifications JSON object from Lipsey's product data
 */
export function buildLipseysSpecifications(product: any): Record<string, any> {
  const specs: Record<string, any> = {};
  
  // Add all non-null specification fields
  const specFields = LIPSEYS_CONFIG.FIELD_MAPPINGS.SPECIFICATION_FIELDS;
  
  for (const [key, fieldName] of Object.entries(specFields)) {
    const value = product[fieldName];
    if (value !== null && value !== undefined && value !== '') {
      // Convert key from SCREAMING_SNAKE_CASE to camelCase
      const camelKey = key.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      specs[camelKey] = value;
    }
  }
  
  // Add additional spec fields
  if (product.caliberGauge) specs.caliber = product.caliberGauge;
  if (product.action) specs.action = product.action;
  if (product.barrelLength) specs.barrelLength = product.barrelLength;
  
  return Object.keys(specs).length > 0 ? specs : {};
}



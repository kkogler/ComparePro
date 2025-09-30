/**
 * Sports South Configuration
 * 
 * Centralized configuration for Sports South vendor-specific constants
 * to eliminate hardcoded references throughout the codebase.
 * 
 * Architectural Rule: All Sports South logic must use this configuration
 * instead of hardcoded values.
 */

export const SPORTS_SOUTH_CONFIG = {
  /**
   * Sports South firearm category identifiers
   * Categories that indicate a product is a firearm requiring special handling
   */
  FIREARM_CATEGORIES: ['1', '2', '3'], // Handguns, Rifles, Shotguns
  
  /**
   * Vendor identification for registry lookups
   */
  VENDOR_IDENTIFIER: 'sports-south',
  
  /**
   * Image source identifier for product records
   */
  IMAGE_SOURCE_NAME: 'Sports South',
  
  /**
   * Default product name prefix for items without descriptions
   */
  DEFAULT_PRODUCT_PREFIX: 'Sports South Item',

  // Field mapping rules for CSV imports and syncs
  FIELD_MAPPINGS: {
    // Reference the centralized vendor field mappings
    VENDOR_ID: 'sports-south',
    
    // Quality indicators for validation
    HIGH_QUALITY_FIELDS: {
      PRODUCT_NAME: 'TXTREF',              // Contains SHDESC (80-char high-quality descriptions)
      BRAND: 'MFGR_NAME',                  // Manufacturer name
      UPC: 'UPC',                          // Universal Product Code
      MANUFACTURER_PART_NUMBER: 'MFGINO',  // Manufacturer part number
      MODEL: 'IMODEL'                      // Product model
    },
    
    // Medium quality fields
    MEDIUM_QUALITY_FIELDS: {
      DESCRIPTION: 'IDESC',                // Product description
      CATEGORY: 'CATNO',                   // Category number
      SERIES: 'SERIES'                     // Product series
    },
    
    // Low quality fields (last resort)
    LOW_QUALITY_FIELDS: {
      PRODUCT_NAME: 'ITEMNO',              // Item number (SKU)
    },
    
    // Processing rules
    PROCESSING: {
      TRIM_WHITESPACE: ['TXTREF', 'IDESC', 'MFGR_NAME', 'IMODEL', 'MFGINO'],
      CUSTOM_NAME_GENERATION: true         // Use generateSportsSouthProductName function
    }
  }
} as const;

/**
 * Helper function to check if a Sports South category indicates a firearm
 */
export function isSportsSouthFirearmCategory(categoryId: string): boolean {
  return (SPORTS_SOUTH_CONFIG.FIREARM_CATEGORIES as readonly string[]).includes(categoryId);
}

/**
 * Get the Sports South vendor identifier for registry lookups
 */
export function getSportsSouthVendorId(): string {
  return SPORTS_SOUTH_CONFIG.VENDOR_IDENTIFIER;
}

/**
 * Get the image source name for Sports South products
 */
export function getSportsSouthImageSource(): string {
  return SPORTS_SOUTH_CONFIG.IMAGE_SOURCE_NAME;
}

/**
 * Generate descriptive product name for Sports South items
 * Priority: SHDESC (in TXTREF) > Constructed Name > IDESC > Fallback
 * 
 * CRITICAL: TXTREF now contains SHDESC (80-char high-quality descriptions)
 * Always use SHDESC when available regardless of length
 */
export function generateSportsSouthProductName(product: {
  ITEMNO: string;
  IDESC?: string;
  TXTREF?: string;
  IMODEL?: string;
  SERIES?: string;
  MFGINO?: string;
}, brandName?: string): string {
  // FIRST PRIORITY: Use TXTREF (contains SHDESC - high-quality 80-char descriptions)
  // Remove length restriction - SHDESC is always high quality regardless of length
  if (product.TXTREF && product.TXTREF.trim()) {
    return product.TXTREF.trim();
  }
  
  // Third priority: Construct descriptive name from available parts
  const parts: string[] = [];
  
  // Add brand if provided
  if (brandName && brandName.trim()) {
    parts.push(brandName.trim());
  }
  
  // Add model if available and different from item number
  if (product.IMODEL && product.IMODEL.trim() && product.IMODEL !== product.ITEMNO) {
    parts.push(product.IMODEL.trim());
  }
  
  // Add series if available
  if (product.SERIES && product.SERIES.trim()) {
    parts.push(product.SERIES.trim());
  }
  
  // Add manufacturer part number if different from others
  if (product.MFGINO && product.MFGINO.trim() && 
      product.MFGINO !== product.ITEMNO && 
      product.MFGINO !== product.IMODEL) {
    parts.push(`(${product.MFGINO.trim()})`);
  }
  
  // If we have constructed parts, use them
  if (parts.length > 0) {
    return parts.join(' ');
  }
  
  // Fourth priority: Use IDESC if it looks descriptive (not just a part number)
  if (product.IDESC && product.IDESC.trim() && product.IDESC.length > 10) {
    return product.IDESC.trim();
  }
  
  // Last resort: Fallback with item number
  return `${SPORTS_SOUTH_CONFIG.DEFAULT_PRODUCT_PREFIX} ${product.ITEMNO}`;
}
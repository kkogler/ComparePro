/**
 * Vendor Type Configuration
 * 
 * Defines which vendors are considered "vendors" vs "marketplaces"
 * for Master Product Catalog data preservation rules.
 * 
 * RULES:
 * - Vendors: High quality images and data, equal priority among vendors
 * - Marketplaces: Lower quality images, only used as fallback
 */

export interface VendorTypeConfig {
  vendorType: 'vendor' | 'marketplace';
  imageQuality: 'high' | 'low';
  dataQuality: 'high' | 'medium' | 'low';
  description: string;
}

export const VENDOR_TYPE_CONFIG: Record<string, VendorTypeConfig> = {
  // High Quality Vendors
  'Lipsey\'s': {
    vendorType: 'vendor',
    imageQuality: 'high',
    dataQuality: 'high',
    description: 'Premium firearms distributor with high-quality product data and images'
  },
  
  'Chattanooga Shooting Supplies': {
    vendorType: 'vendor',
    imageQuality: 'high',
    dataQuality: 'high',
    description: 'Established firearms distributor with comprehensive product catalog'
  },
  
  'Sports South': {
    vendorType: 'vendor',
    imageQuality: 'high',
    dataQuality: 'high',
    description: 'Major firearms distributor with high-resolution images and detailed specifications'
  },
  
  'MicroBiz Product API': {
    vendorType: 'vendor',
    imageQuality: 'high',
    dataQuality: 'medium',
    description: 'POS system with quality product data integration'
  },
  
  // Marketplaces (Lower Quality)
  'GunBroker API': {
    vendorType: 'marketplace',
    imageQuality: 'low',
    dataQuality: 'medium',
    description: 'Online marketplace with user-generated content and variable image quality'
  }
};

/**
 * Check if a vendor is a marketplace (lower image quality)
 */
export function isMarketplace(vendorName: string): boolean {
  const config = VENDOR_TYPE_CONFIG[vendorName];
  return config?.vendorType === 'marketplace';
}

/**
 * Check if a vendor has high quality images
 */
export function hasHighQualityImages(vendorName: string): boolean {
  const config = VENDOR_TYPE_CONFIG[vendorName];
  return config?.imageQuality === 'high';
}

/**
 * Get vendor type configuration
 */
export function getVendorTypeConfig(vendorName: string): VendorTypeConfig | null {
  return VENDOR_TYPE_CONFIG[vendorName] || null;
}

/**
 * Master Product Catalog Data Update Rules
 * 
 * For existing products in Master Product Catalog:
 * 
 * DATA FIELDS (descriptions, part numbers, calibers, etc.):
 * - Only fill in EMPTY/MISSING fields
 * - Never replace existing data from one vendor with another vendor's data
 * 
 * CATEGORIES:
 * - Only update if BOTH category AND subcategory are empty
 * - Do not fill in subcategory if category exists but subcategory is empty
 * 
 * IMAGES:
 * - Vendors: Only update if (1) no existing image OR (2) existing image is from marketplace
 * - Marketplaces: Only update if no existing image at all
 * - Never replace vendor image with another vendor image
 * - Never replace vendor image with marketplace image
 */
export const DATA_UPDATE_RULES = {
  // Fields that can be filled if empty, but never replaced
  FILL_IF_EMPTY: [
    'description',
    'manufacturerPartNumber', 
    'brand',
    'model',
    'caliber',
    'barrelLength',
    'specifications'
  ],
  
  // Category fields - only update if ALL are empty
  CATEGORY_FIELDS: [
    'category',
    'subcategory1',
    'subcategory2', 
    'subcategory3'
  ],
  
  // Image update priority rules
  IMAGE_PRIORITY: {
    VENDOR_TO_EMPTY: true,      // Vendor can add image to empty product
    VENDOR_TO_MARKETPLACE: true, // Vendor can replace marketplace image
    VENDOR_TO_VENDOR: false,    // Vendor cannot replace other vendor image
    MARKETPLACE_TO_EMPTY: true, // Marketplace can add image to empty product
    MARKETPLACE_TO_VENDOR: false, // Marketplace cannot replace vendor image
    MARKETPLACE_TO_MARKETPLACE: false // Marketplace cannot replace other marketplace image
  }
} as const;
/**
 * Vendor Image Quality Configuration
 * 
 * Defines which vendors provide high-quality vs low-quality images
 * for Master Product Catalog image preservation rules.
 * 
 * RULES:
 * - High Quality Image Vendors: Professional product photography, high resolution
 * - Low Quality Image Vendors: Variable quality, lower resolution, used as fallback only
 */

export interface VendorTypeConfig {
  imageQuality: 'high' | 'low';
  dataQuality: 'high' | 'medium' | 'low';
  description: string;
}

export const VENDOR_TYPE_CONFIG: Record<string, VendorTypeConfig> = {
  // High Quality Image Vendors
  'Lipsey\'s': {
    imageQuality: 'high',
    dataQuality: 'high',
    description: 'Premium firearms distributor with high-quality professional product photography'
  },
  
  'Sports South': {
    imageQuality: 'high',
    dataQuality: 'high',
    description: 'Major firearms distributor with high-resolution images and detailed specifications'
  },
  
  'Bill Hicks': {
    imageQuality: 'high',
    dataQuality: 'high',
    description: 'Established firearms distributor with professional product images'
  },
  
  'Bill Hicks & Co.': {
    imageQuality: 'high',
    dataQuality: 'high',
    description: 'Established firearms distributor with professional product images'
  },
  
  // Low Quality Image Vendors
  'Chattanooga Shooting Supplies': {
    imageQuality: 'low',
    dataQuality: 'high',
    description: 'Firearms distributor with variable image quality'
  },
  
  'GunBroker API': {
    imageQuality: 'low',
    dataQuality: 'medium',
    description: 'Online marketplace with user-generated content and variable image quality'
  }
};

/**
 * Check if a vendor has low quality images
 */
export function hasLowQualityImages(vendorName: string): boolean {
  const config = VENDOR_TYPE_CONFIG[vendorName];
  return config?.imageQuality === 'low';
}

/**
 * Check if a vendor has high quality images
 */
export function hasHighQualityImages(vendorName: string): boolean {
  const config = VENDOR_TYPE_CONFIG[vendorName];
  return config?.imageQuality === 'high';
}

/**
 * @deprecated Use hasLowQualityImages() instead
 * Check if a vendor is a marketplace (lower image quality)
 */
export function isMarketplace(vendorName: string): boolean {
  return hasLowQualityImages(vendorName);
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
 * - High Quality Image Vendors: Can add to empty products OR replace low quality images
 * - Low Quality Image Vendors: Can ONLY add to empty products (never replace existing)
 * - High quality images are never replaced by other images (high or low quality)
 * - Low quality images can be upgraded by high quality vendors
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
    HIGH_QUALITY_TO_EMPTY: true,           // High quality vendor can add image to empty product
    HIGH_QUALITY_TO_LOW_QUALITY: true,     // High quality vendor can replace low quality image
    HIGH_QUALITY_TO_HIGH_QUALITY: false,   // High quality vendor cannot replace other high quality image
    LOW_QUALITY_TO_EMPTY: true,            // Low quality vendor can add image to empty product
    LOW_QUALITY_TO_HIGH_QUALITY: false,    // Low quality vendor cannot replace high quality image
    LOW_QUALITY_TO_LOW_QUALITY: false      // Low quality vendor cannot replace other low quality image
  }
} as const;
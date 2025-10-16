/**
 * Vendor Field Mapping Configuration
 * 
 * Centralized permanent mapping rules for all vendor CSV imports and syncs.
 * This prevents field mapping rules from being lost or scattered across the codebase.
 * 
 * ARCHITECTURAL RULE: All vendor imports and syncs MUST use these mappings
 * instead of hardcoded field references.
 */

export interface FieldMapping {
  /** Primary field to use (highest quality) */
  primary: string;
  /** Fallback fields in priority order */
  fallbacks: string[];
  /** Quality indicator for validation */
  quality: 'high' | 'medium' | 'low';
  /** Description of this field's purpose */
  description: string;
}

export interface VendorFieldMapping {
  /** Vendor identifier for lookups */
  vendorId: string;
  /** Human-readable vendor name */
  vendorName: string;
  /** Field mappings for product data */
  fields: {
    /** Product name mapping (most critical for naming quality) */
    productName: FieldMapping;
    /** Product description mapping */
    description: FieldMapping;
    /** Brand/manufacturer mapping */
    brand: FieldMapping;
    /** Product model mapping */
    model?: FieldMapping;
    /** UPC/Universal Product Code mapping */
    upc: FieldMapping;
    /** Manufacturer part number mapping */
    manufacturerPartNumber?: FieldMapping;
    /** Category mapping */
    category?: FieldMapping;
    /** Price mapping */
    price?: FieldMapping;
  };
  /** Special field processing rules */
  processing?: {
    /** HTML entity decoding needed */
    htmlDecode?: string[];
    /** Trim whitespace */
    trim?: string[];
    /** Custom processing functions */
    custom?: Record<string, (value: any, ...args: any[]) => string | null>;
  };
}

/**
 * VENDOR FIELD MAPPINGS
 * 
 * Permanent configuration for all vendors to prevent mapping loss during development.
 * These rules must be maintained and never hardcoded in sync files.
 */
export const VENDOR_FIELD_MAPPINGS: Record<string, VendorFieldMapping> = {
  
  /** BILL HICKS & CO. MAPPING RULES */
  'bill-hicks': {
    vendorId: 'bill-hicks',
    vendorName: 'Bill Hicks & Co.',
    fields: {
      productName: {
        primary: 'short_description',
        fallbacks: ['long_description', 'product_name'],
        quality: 'high',
        description: 'short_description contains high-quality product names, product_name contains vendor SKUs'
      },
      description: {
        primary: 'long_description',
        fallbacks: ['short_description'],
        quality: 'high',
        description: 'long_description provides detailed product information'
      },
      brand: {
        primary: 'MFG_product',
        fallbacks: [],
        quality: 'high',
        description: 'Manufacturer/brand name from MFG_product field'
      },
      upc: {
        primary: 'universal_product_code',
        fallbacks: [],
        quality: 'high',
        description: 'UPC from universal_product_code field'
      },
      manufacturerPartNumber: {
        primary: 'product_name',
        fallbacks: [],
        quality: 'medium',
        description: 'Extract part number from product_name field (format: BRAND PARTNUMBER)'
      },
      category: {
        primary: 'category_description',
        fallbacks: [],
        quality: 'medium',
        description: 'Product category from category_description field'
      }
    },
    processing: {
      htmlDecode: ['short_description', 'long_description'],
      trim: ['short_description', 'long_description', 'product_name', 'MFG_product'],
      custom: {
        'manufacturerPartNumber': (productName: string) => {
          // Extract part number from "BRAND PARTNUMBER" format
          const parts = productName.trim().split(' ');
          return parts.length >= 2 ? parts.slice(1).join(' ') : productName;
        }
      }
    }
  },

  /** SPORTS SOUTH MAPPING RULES */
  'sports-south': {
    vendorId: 'sports-south',
    vendorName: 'Sports South',
    fields: {
      productName: {
        primary: 'TXTREF',
        fallbacks: ['IMODEL', 'SERIES', 'IDESC', 'ITEMNO'],
        quality: 'high',
        description: 'TXTREF contains SHDESC (80-char high-quality descriptions), fallback to constructed name'
      },
      description: {
        primary: 'IDESC',
        fallbacks: ['TXTREF'],
        quality: 'medium',
        description: 'Product description from IDESC field'
      },
      brand: {
        primary: 'MFGR_NAME',
        fallbacks: [],
        quality: 'high',
        description: 'Manufacturer name from MFGR_NAME field'
      },
      model: {
        primary: 'IMODEL',
        fallbacks: [],
        quality: 'medium',
        description: 'Product model from IMODEL field'
      },
      upc: {
        primary: 'UPC',
        fallbacks: [],
        quality: 'high',
        description: 'UPC from UPC field'
      },
      manufacturerPartNumber: {
        primary: 'MFGINO',
        fallbacks: [],
        quality: 'high',
        description: 'Manufacturer part number from MFGINO field'
      },
      category: {
        primary: 'CATNO',
        fallbacks: [],
        quality: 'medium',
        description: 'Category number from CATNO field'
      }
    },
    processing: {
      trim: ['TXTREF', 'IDESC', 'MFGR_NAME', 'IMODEL', 'MFGINO'],
      custom: {
        'productName': (product: any, brandName?: string) => {
          // Use the existing Sports South name generation logic
          const parts: string[] = [];
          
          // Use TXTREF (SHDESC) first priority
          if (product.TXTREF && product.TXTREF.trim()) {
            return product.TXTREF.trim();
          }
          
          // Construct from available parts
          if (brandName && brandName.trim()) parts.push(brandName.trim());
          if (product.IMODEL && product.IMODEL.trim() && product.IMODEL !== product.ITEMNO) {
            parts.push(product.IMODEL.trim());
          }
          if (product.SERIES && product.SERIES.trim()) parts.push(product.SERIES.trim());
          if (product.MFGINO && product.MFGINO.trim() && 
              product.MFGINO !== product.ITEMNO && product.MFGINO !== product.IMODEL) {
            parts.push(`(${product.MFGINO.trim()})`);
          }
          
          if (parts.length > 0) return parts.join(' ');
          
          // Fallback to IDESC if descriptive
          if (product.IDESC && product.IDESC.trim() && product.IDESC.length > 10) {
            return product.IDESC.trim();
          }
          
          // Last resort
          return `Sports South Item ${product.ITEMNO}`;
        }
      }
    }
  },

  /** CHATTANOOGA SHOOTING SUPPLIES MAPPING RULES */
  'chattanooga': {
    vendorId: 'chattanooga',
    vendorName: 'Chattanooga Shooting Supplies',
    fields: {
      productName: {
        primary: 'Web Item Name',
        fallbacks: ['name', 'Item Name', 'model', 'cssi_id'],
        quality: 'high',
        description: 'Web Item Name from CSV (highest quality, matches website), fallback to API name field'
      },
      description: {
        primary: 'Web Item Description',
        fallbacks: ['name'],
        quality: 'medium',
        description: 'Use Web Item Description from CSV, fallback to product name'
      },
      brand: {
        primary: 'Manufacturer',
        fallbacks: ['manufacturer'],
        quality: 'high',
        description: 'Manufacturer name from CSV Manufacturer field or API manufacturer field'
      },
      model: {
        primary: 'model',
        fallbacks: [],
        quality: 'medium',
        description: 'Product model from API model field'
      },
      upc: {
        primary: 'UPC',
        fallbacks: ['upc'],
        quality: 'high',
        description: 'UPC from CSV UPC field or API upc field'
      },
      manufacturerPartNumber: {
        primary: 'Manufacturer Item Number',
        fallbacks: ['cssi_id', 'SKU'],
        quality: 'high',
        description: 'Manufacturer part number from CSV, fallback to Chattanooga SKU'
      },
      category: {
        primary: 'Category',
        fallbacks: ['category'],
        quality: 'medium',
        description: 'Product category from CSV Category field or API category field'
      },
      price: {
        primary: 'Price',
        fallbacks: ['retail_price', 'MAP', 'Retail MAP', 'MSRP', 'map_price', 'msrp'],
        quality: 'high',
        description: 'Product price from CSV Price field with multiple fallbacks'
      }
    },
    processing: {
      trim: ['Web Item Name', 'name', 'Item Name', 'manufacturer', 'Manufacturer', 'model', 'cssi_id', 'SKU'],
      custom: {
        'productName': (product: any, brandName?: string) => {
          // Priority 1: Web Item Name from CSV (highest quality, matches website)
          if (product['Web Item Name'] && product['Web Item Name'].trim()) {
            return product['Web Item Name'].trim();
          }
          
          // Priority 2: API name field (for real-time lookups)
          if (product.name && product.name.trim()) {
            return product.name.trim();
          }
          
          // Priority 3: Item Name from CSV
          if (product['Item Name'] && product['Item Name'].trim()) {
            return product['Item Name'].trim();
          }
          
          // Priority 4: Construct from available parts if name is missing
          const parts: string[] = [];
          if (brandName && brandName.trim()) parts.push(brandName.trim());
          if (product.model && product.model.trim()) parts.push(product.model.trim());
          
          if (parts.length > 0) return parts.join(' ');
          
          // Last resort - use Chattanooga ID
          return `Chattanooga Item ${product.cssi_id || product.SKU || 'Unknown'}`;
        }
      }
    }
  },

  /** LIPSEY'S MAPPING RULES */
  'lipseys': {
    vendorId: 'lipseys',
    vendorName: "Lipsey's",
    fields: {
      productName: {
        primary: 'description1',
        fallbacks: ['description2', 'manufacturer', 'model'],
        quality: 'high',
        description: 'description1 contains primary product description'
      },
      description: {
        primary: 'description2',
        fallbacks: ['description1'],
        quality: 'medium',
        description: 'description2 provides detailed product information'
      },
      brand: {
        primary: 'manufacturer',
        fallbacks: [],
        quality: 'high',
        description: 'Manufacturer/brand name from manufacturer field'
      },
      model: {
        primary: 'model',
        fallbacks: [],
        quality: 'high',
        description: 'Product model from model field'
      },
      upc: {
        primary: 'upc',
        fallbacks: [],
        quality: 'high',
        description: 'UPC from upc field'
      },
      manufacturerPartNumber: {
        primary: 'manufacturerModelNo',
        fallbacks: [],
        quality: 'high',
        description: 'Manufacturer part number from manufacturerModelNo field'
      },
      category: {
        primary: 'type',
        fallbacks: ['itemType'],
        quality: 'medium',
        description: 'Product category from type field'
      }
    },
    processing: {
      trim: ['description1', 'description2', 'manufacturer', 'model', 'manufacturerModelNo'],
      custom: {
        'productName': (product: any, brandName?: string) => {
          // Priority 1: Use description1 (primary description)
          if (product.description1 && product.description1.trim()) {
            return product.description1.trim();
          }
          
          // Priority 2: Use description2 (secondary description)
          if (product.description2 && product.description2.trim()) {
            return product.description2.trim();
          }
          
          // Priority 3: Construct from manufacturer + model
          const parts: string[] = [];
          if (brandName && brandName.trim()) parts.push(brandName.trim());
          if (product.model && product.model.trim()) parts.push(product.model.trim());
          
          if (parts.length > 0) return parts.join(' ');
          
          // Fallback: Use manufacturer only
          if (product.manufacturer && product.manufacturer.trim()) {
            return product.manufacturer.trim();
          }
          
          // Last resort
          return `Lipsey's Item ${product.itemNo || 'Unknown'}`;
        }
      }
    }
  }
};

/**
 * Get field mapping configuration for a vendor
 */
export function getVendorFieldMapping(vendorId: string): VendorFieldMapping | null {
  return VENDOR_FIELD_MAPPINGS[vendorId] || null;
}

/**
 * Apply field mapping to extract product name with fallback logic
 */
export function extractProductName(product: any, vendorId: string, brandName?: string): string {
  const mapping = getVendorFieldMapping(vendorId);
  if (!mapping) {
    throw new Error(`No field mapping found for vendor: ${vendorId}`);
  }

  const nameMapping = mapping.fields.productName;
  
  // Check for custom processing first
  if (mapping.processing?.custom?.productName) {
    const result = mapping.processing.custom.productName(product, brandName);
    return result || `${mapping.vendorName} Product ${product.id || product.ITEMNO || 'Unknown'}`;
  }

  // Try primary field first
  let value = product[nameMapping.primary];
  if (value && typeof value === 'string' && value.trim()) {
    return processFieldValue(value, nameMapping.primary, mapping);
  }

  // Try fallback fields
  for (const fallbackField of nameMapping.fallbacks) {
    value = product[fallbackField];
    if (value && typeof value === 'string' && value.trim()) {
      return processFieldValue(value, fallbackField, mapping);
    }
  }

  // Last resort fallback
  return `${mapping.vendorName} Product ${product.id || product.ITEMNO || 'Unknown'}`;
}

/**
 * Apply field mapping to extract any field with fallback logic
 */
export function extractField(product: any, fieldName: keyof VendorFieldMapping['fields'], vendorId: string): string | null {
  const mapping = getVendorFieldMapping(vendorId);
  if (!mapping || !mapping.fields[fieldName]) {
    return null;
  }

  const fieldMapping = mapping.fields[fieldName]!;
  
  // Check for custom processing first
  if (mapping.processing?.custom?.[fieldName as string]) {
    return mapping.processing.custom[fieldName as string](product);
  }

  // Try primary field first
  let value = product[fieldMapping.primary];
  if (value && typeof value === 'string' && value.trim()) {
    return processFieldValue(value, fieldMapping.primary, mapping);
  }

  // Try fallback fields
  for (const fallbackField of fieldMapping.fallbacks) {
    value = product[fallbackField];
    if (value && typeof value === 'string' && value.trim()) {
      return processFieldValue(value, fallbackField, mapping);
    }
  }

  return null;
}

/**
 * Process field value according to vendor-specific rules
 */
function processFieldValue(value: string, fieldName: string, mapping: VendorFieldMapping): string {
  let processed = value;

  // Apply trimming
  if (mapping.processing?.trim?.includes(fieldName)) {
    processed = processed.trim();
  }

  // Apply HTML decoding
  if (mapping.processing?.htmlDecode?.includes(fieldName)) {
    processed = processed
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  return processed;
}

/**
 * Validate that a vendor field mapping is correctly configured
 */
export function validateVendorFieldMapping(vendorId: string): { valid: boolean; errors: string[] } {
  const mapping = getVendorFieldMapping(vendorId);
  const errors: string[] = [];

  if (!mapping) {
    return { valid: false, errors: [`No field mapping found for vendor: ${vendorId}`] };
  }

  // Validate required fields
  const requiredFields = ['productName', 'description', 'brand', 'upc'];
  for (const field of requiredFields) {
    if (!mapping.fields[field as keyof typeof mapping.fields]) {
      errors.push(`Missing required field mapping: ${field}`);
    }
  }

  // Validate field mapping structure
  for (const [fieldName, fieldMapping] of Object.entries(mapping.fields)) {
    if (!fieldMapping.primary) {
      errors.push(`Field ${fieldName} missing primary field`);
    }
    if (!fieldMapping.quality) {
      errors.push(`Field ${fieldName} missing quality indicator`);
    }
  }

  return { valid: errors.length === 0, errors };
}
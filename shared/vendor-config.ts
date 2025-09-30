/**
 * Vendor Configuration
 * 
 * This file contains the configuration for all supported vendors,
 * making it easy to maintain and update vendor information without
 * hardcoding vendor names throughout the codebase.
 */

export interface VendorConfig {
  id: string;
  name: string;
  shortCode: string;
  displayName: string;
  logoUrl?: string;
  capabilities: {
    supportsAuth: boolean;
    supportsSync: boolean;
    supportsOrdering: boolean;
    supportsFTP: boolean;
  };
  requiredCredentials: string[];
  apiEndpoints?: string[];
  imagePriority: number;
  completenessInfo?: {
    strengths: string[];
    completenessLevel: 'High' | 'Medium' | 'Basic';
  };
}

export const VENDOR_CONFIGS: Record<string, VendorConfig> = {
  'chattanooga': {
    id: 'chattanooga',
    name: 'Chattanooga Shooting Supplies Inc.',
    shortCode: 'chattanooga',
    displayName: 'Chattanooga Shooting Supplies',
    capabilities: {
      supportsAuth: true,
      supportsSync: true,
      supportsOrdering: true,
      supportsFTP: false
    },
    requiredCredentials: ['accountNumber', 'username', 'password', 'sid', 'token'],
    apiEndpoints: ['https://developers.chattanoogashooting.com/api'],
    imagePriority: 1,
    completenessInfo: {
      strengths: ['Complete model data', 'High-quality images', 'Detailed descriptions'],
      completenessLevel: 'High'
    }
  },
  'sports-south': {
    id: 'sports-south',
    name: 'Sports South',
    shortCode: 'sports-south',
    displayName: 'Sports South',
    capabilities: {
      supportsAuth: true,
      supportsSync: true,
      supportsOrdering: true,
      supportsFTP: false
    },
    requiredCredentials: ['userName', 'customerNumber', 'password', 'source'],
    apiEndpoints: [
      'http://webservices.theshootingwarehouse.com/smart/inventory.asmx',
      'http://webservices.theshootingwarehouse.com/smart/orders.asmx'
    ],
    imagePriority: 3,
    completenessInfo: {
      strengths: ['Model data', 'Basic specifications', 'Some images'],
      completenessLevel: 'Medium'
    }
  },
  'bill-hicks': {
    id: 'bill-hicks',
    name: 'Bill Hicks & Co.',
    shortCode: 'bill-hicks',
    displayName: 'Bill Hicks & Co.',
    capabilities: {
      supportsAuth: true,
      supportsSync: true,
      supportsOrdering: false,
      supportsFTP: true
    },
    requiredCredentials: ['ftpHost', 'ftpUsername', 'ftpPassword', 'storeName'],
    imagePriority: 4,
    completenessInfo: {
      strengths: ['Large catalog', 'Basic product names', 'Manufacturer data'],
      completenessLevel: 'Basic'
    }
  },
  'lipseys': {
    id: 'lipseys',
    name: "Lipsey's Inc.",
    shortCode: 'lipseys',
    displayName: "Lipsey's",
    capabilities: {
      supportsAuth: true,
      supportsSync: true,
      supportsOrdering: true,
      supportsFTP: false
    },
    requiredCredentials: ['email', 'password'],
    apiEndpoints: [
      'https://api.lipseys.com/api/Integration/Authentication/Login',
      'https://api.lipseys.com/api/Integration/Items/CatalogFeed',
      'https://api.lipseys.com/api/Integration/Order/NewOrder'
    ],
    imagePriority: 2,
    completenessInfo: {
      strengths: ['Model numbers', 'Product images', 'Accurate specifications'],
      completenessLevel: 'High'
    }
  },
  'gunbroker': {
    id: 'gunbroker',
    name: 'GunBroker.com LLC',
    shortCode: 'gunbroker',
    displayName: 'GunBroker',
    capabilities: {
      supportsAuth: true,
      supportsSync: false,
      supportsOrdering: false,
      supportsFTP: false
    },
    requiredCredentials: ['devKey', 'userAgent'],
    apiEndpoints: [
      'https://api.sandbox.gunbroker.com/v1',
      'https://api.gunbroker.com/v1'
    ],
    imagePriority: 10,
    completenessInfo: {
      strengths: ['Marketplace listings', 'Basic product information'],
      completenessLevel: 'Basic'
    }
  }
};

/**
 * Get vendor configuration by short code
 */
export function getVendorConfig(shortCode: string): VendorConfig | undefined {
  return VENDOR_CONFIGS[shortCode.toLowerCase()];
}

/**
 * Get vendor configuration by name (fallback for legacy support)
 */
export function getVendorConfigByName(name: string): VendorConfig | undefined {
  const normalizedName = name.toLowerCase();
  
  for (const config of Object.values(VENDOR_CONFIGS)) {
    if (config.name.toLowerCase() === normalizedName ||
        config.displayName.toLowerCase() === normalizedName ||
        normalizedName.includes(config.shortCode) ||
        config.name.toLowerCase().includes(normalizedName.split(' ')[0])) {
      return config;
    }
  }
  
  return undefined;
}

/**
 * Get all vendor configurations
 */
export function getAllVendorConfigs(): VendorConfig[] {
  return Object.values(VENDOR_CONFIGS);
}

/**
 * Check if a vendor supports a specific capability
 */
export function vendorSupports(vendor: { vendorShortCode?: string; name?: string }, capability: keyof VendorConfig['capabilities']): boolean {
  const config = vendor.vendorShortCode ? 
    getVendorConfig(vendor.vendorShortCode) : 
    getVendorConfigByName(vendor.name || '');
    
  return config?.capabilities[capability] || false;
}

/**
 * Get vendor display name
 */
export function getVendorDisplayName(vendor: { vendorShortCode?: string; name?: string }): string {
  const config = vendor.vendorShortCode ? 
    getVendorConfig(vendor.vendorShortCode) : 
    getVendorConfigByName(vendor.name || '');
    
  return config?.displayName || vendor.name || 'Unknown Vendor';
}

/**
 * Bill Hicks Integration Configuration
 * Centralized configuration for all Bill Hicks vendor operations
 */

export const BILL_HICKS_CONFIG = {
  // Vendor identification
  VENDOR_ID: undefined as unknown as number, // Deprecated: do not rely on static IDs
  VENDOR_NAME: 'Bill Hicks & Co.',
  
  // File naming patterns for dynamic discovery
  FILE_PATTERNS: {
    CATALOG: {
      // Pattern for catalog files from FTP
      FTP_PATTERN: /^BHC_Catalog.*\.csv$/i,
      // Pattern specifically for files with updated UPCs
      UPDATED_UPC_PATTERN: /^BHC_Catalog with Updated UPCs.*\.csv$/i,
    },
    INVENTORY: {
      // Pattern for inventory files from FTP  
      FTP_PATTERN: /^BHC_Inventory.*\.csv$/i,
    }
  },

  // FTP server configuration
  FTP: {
    DIRECTORY: '/MicroBiz/Feeds',
    INVENTORY_FILENAME: 'MicroBiz_Hourly_Inventory.csv',
    CATALOG_FILENAME: 'MicroBiz_Product_Feed.csv',
    // Master catalog sync file for MicroBiz (used by PriceCompare admin)
    MASTER_CATALOG_FILENAME: 'MicroBiz_Daily_Catalog.csv',
  },

  // File storage paths
  STORAGE: {
    DOWNLOADS_DIR: 'downloads/bill-hicks',
    ATTACHED_ASSETS_DIR: 'attached_assets',
  },

  // Sync scheduling
  SCHEDULES: {
    // TIER 1 - Master Products: Daily at 1:00 AM (product data, no pricing)
    MASTER_PRODUCTS: '0 1 * * *',
    // TIER 2 - Store Pricing: Daily at 1:30 AM (pricing only, per store)  
    STORE_PRICING: '30 1 * * *',
    // TIER 3 - Global Inventory: Hourly 24/7 (shared across all stores, differential sync)
    GLOBAL_INVENTORY: '0 * * * *',
    // Master Catalog Sync: Daily at 2:00 AM (admin-level master product catalog sync)
    MASTER_CATALOG_SYNC: '0 2 * * *',
    // Batch Import: Every 2 hours during business hours for initial setup
    BATCH_IMPORT: '0 8,10,12,14,16,18,20,22 * * *',
  },

  // Import thresholds and limits
  IMPORT: {
    TARGET_PRODUCT_COUNT: 25739,
    BATCH_SIZE: 1000,
    MAX_RETRIES: 3,
  },

  // Master catalog sync configuration
  MASTER_CATALOG: {
    DEFAULT_SYNC_TIME: '02:00', // Default time for master catalog sync (24-hour format)
    DEFAULT_ENABLED: true,
    DIFFERENTIAL_THRESHOLD: 1000, // Minimum changes to trigger differential processing
  },

  // Demo/testing configuration
  DEMO: {
    COMPANY_ID: 5, // Demo Gun Store
  },

  // Field mapping rules for CSV imports and syncs
  FIELD_MAPPINGS: {
    // Reference the centralized vendor field mappings
    VENDOR_ID: 'bill-hicks',
    
    // Quality indicators for validation
    HIGH_QUALITY_FIELDS: {
      PRODUCT_NAME: 'short_description',   // Contains descriptive product names
      DESCRIPTION: 'long_description',     // Detailed product information
      BRAND: 'MFG_product',               // Manufacturer/brand
      UPC: 'universal_product_code'       // Universal Product Code
    },
    
    // Low quality fields (fallbacks)
    LOW_QUALITY_FIELDS: {
      PRODUCT_NAME: 'product_name',       // Contains vendor SKUs like "BUR 420556"
    },
    
    // Processing rules
    PROCESSING: {
      HTML_DECODE: ['short_description', 'long_description'],
      TRIM_WHITESPACE: ['short_description', 'long_description', 'product_name', 'MFG_product'],
      EXTRACT_PART_NUMBER: 'product_name'  // Extract from "BRAND PARTNUMBER" format
    }
  }
} as const;

import { readdirSync, statSync, existsSync } from 'fs';
import path from 'path';

/**
 * Get the most recent file matching a pattern from a directory
 */
export function getLatestFileByPattern(directory: string, pattern: RegExp): string | null {
  try {
    
    if (!existsSync(directory)) {
      return null;
    }
    
    const files = readdirSync(directory)
      .filter((file: string) => pattern.test(file))
      .map((file: string) => ({
        name: file,
        path: path.join(directory, file),
        mtime: statSync(path.join(directory, file)).mtime
      }))
      .sort((a: any, b: any) => b.mtime.getTime() - a.mtime.getTime());
    
    return files.length > 0 ? files[0].path : null;
  } catch (error) {
    console.error('Error finding latest file:', error);
    return null;
  }
}

/**
 * Get the latest Bill Hicks catalog file - ONLY from FTP downloads
 */
export function getLatestCatalogFile(baseDir: string = process.cwd()): string | null {
  // Use ONLY FTP downloads directory - NO sample files
  const downloadsDir = path.join(baseDir, BILL_HICKS_CONFIG.STORAGE.DOWNLOADS_DIR);
  const latestCatalogFile = path.join(downloadsDir, 'latest_master_catalog.csv');
  
  // Return the FTP catalog file if it exists
  if (existsSync(latestCatalogFile)) {
    return latestCatalogFile;
  }
  
  return null;
}

/**
 * Get the latest Bill Hicks inventory file - ONLY from FTP downloads
 */
export function getLatestInventoryFile(baseDir: string = process.cwd()): string | null {
  // Use ONLY FTP downloads directory - NO sample files
  const downloadsDir = path.join(baseDir, BILL_HICKS_CONFIG.STORAGE.DOWNLOADS_DIR);
  const latestInventoryFile = path.join(downloadsDir, 'latest_inventory.csv');
  
  // Return the FTP inventory file if it exists
  if (existsSync(latestInventoryFile)) {
    return latestInventoryFile;
  }
  
  return null;
}
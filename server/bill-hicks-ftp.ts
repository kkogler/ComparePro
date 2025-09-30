/**
 * BILL HICKS UTILITIES
 * 
 * This file contains utility functions for Bill Hicks integration.
 * The legacy complex FTP sync system has been replaced by bill-hicks-simple-sync.ts
 * 
 * LEGACY CODE REMOVED: The original 1115-line file contained complex legacy functions
 * that were made redundant by the simplified sync approach. All legacy FTP download,
 * parsing, and processing functions have been removed as they are no longer used.
 * 
 * PRESERVED UTILITIES: Only essential utility functions that may be useful in the future.
 * 
 * NOTE: No vendor ID is needed in this utility file as it only contains pure functions.
 */

/**
 * Create Bill Hicks product image URL from vendor SKU
 * Images are stored in: BHC Digital Images ALL/Website/[VENDOR_SKU].jpg
 * @param vendorSku Bill Hicks vendor SKU (from product_name field)
 * @returns Full image URL or null if no SKU provided
 */
export function createBillHicksImageUrl(vendorSku: string): string | null {
  if (!vendorSku || !vendorSku.trim()) {
    return null;
  }
  
  // URL encode the vendor SKU (spaces become +, special chars encoded)
  const encodedSku = encodeURIComponent(vendorSku.trim()).replace(/%20/g, '+');
  
  // Construct full image URL
  const imageUrl = `https://billhicksco.hostedftp.com/files/path/BHC+Digital+Images+ALL/Website/${encodedSku}.jpg`;
  
  return imageUrl;
}

/**
 * Extract manufacturer part number from Bill Hicks product name
 * Often the product name contains the manufacturer part number at the end
 */
export function extractManufacturerPartNumber(productName: string): string {
  if (!productName) return '';
  
  // Common patterns for manufacturer part numbers in Bill Hicks product names
  const patterns = [
    /\s+([A-Z0-9-]+)$/,           // Space followed by alphanumeric code at end
    /\s+Model\s+([A-Z0-9-]+)$/i,  // "Model XXX" pattern
    /\s+Part\s+([A-Z0-9-]+)$/i,   // "Part XXX" pattern
  ];
  
  for (const pattern of patterns) {
    const match = productName.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return '';
}

/**
 * Basic interfaces for Bill Hicks data structures
 * These may be useful for future development
 */
export interface BillHicksProduct {
  product_name: string;
  universal_product_code: string;
  short_description: string;
  long_description: string;
  category_code: string;
  category_description: string;
  product_price: string;
  MFG_product: string;
  product_weight: string;
  marp: string;
  msrp: string;
}

export interface BillHicksInventoryItem {
  Product: string;
  UPC: string;
  'Qty Avail': string;
}

export interface BillHicksFTPCredentials {
  ftpServer: string;
  ftpUsername: string;
  ftpPassword: string;
  ftpBasePath?: string;
  ftpPort?: number;
}

/**
 * LEGACY FUNCTIONS REMOVED:
 * 
 * The following functions were removed as they are redundant with the simplified sync:
 * - downloadBillHicksMasterCatalogFTP() - Complex FTP download (replaced by simple sync)
 * - downloadBillHicksInventoryFTP() - Complex FTP download (replaced by simple sync)
 * - parseBillHicksCatalog() - Complex CSV parsing (replaced by simple sync)
 * - parseBillHicksInventory() - Complex inventory parsing (replaced by simple sync)
 * - processBillHicksCatalog() - Complex processing logic (replaced by simple sync)
 * - processBillHicksInventory() - Complex inventory processing (replaced by simple sync)
 * - syncBillHicksInventoryFromFTP() - Legacy sync function (replaced by simple sync)
 * - importBillHicksFiles() - Complex import logic (replaced by simple sync)
 * - compareInventoryFiles() - Complex diff logic (replaced by simple sync)
 * - processBillHicksInventoryDifferential() - Complex differential sync (replaced by simple sync)
 * 
 * All of these functions contained hundreds of lines of complex logic that duplicated
 * functionality now handled more efficiently by bill-hicks-simple-sync.ts
 */
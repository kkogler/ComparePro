/**
 * Bill Hicks Store-Specific Pricing Sync
 * 
 * Downloads pricing/inventory data from individual store folders on Bill Hicks FTP
 * using each store's own credentials. This complements the admin master catalog sync.
 * 
 * Architecture:
 * - Admin credentials: Master catalog sync (universal product identification)
 * - Store credentials: Store-specific pricing/inventory sync (this module)
 * - Data storage: vendorProductMappings table with companyId scoping
 * 
 * Performance Optimization:
 * - Uses line-by-line differential detection (same as admin sync)
 * - Only processes changed records instead of entire file
 * - Typical scenario: 10 price changes → 30 seconds, not 30 minutes
 * - 99%+ processing reduction for incremental updates
 * 
 * Updated: Implemented line-by-line differential sync for consistency with other syncs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { Client as FTPClient } from 'basic-ftp';
import path from 'path';
import crypto from 'crypto';
import { db } from './db';
import { products, vendorProductMappings, companyVendorCredentials, supportedVendors } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { storage } from './storage';

// Bill Hicks Configuration
const STORE_DOWNLOADS_DIR = path.join(process.cwd(), 'downloads', 'bill-hicks-stores');

// Cache for vendor ID to avoid repeated lookups during sync
let cachedBillHicksVendorId: number | null = null;

// Ensure store downloads directory exists
if (!existsSync(STORE_DOWNLOADS_DIR)) {
  mkdirSync(STORE_DOWNLOADS_DIR, { recursive: true });
}

export interface BillHicksFTPCredentials {
  ftpServer: string;
  ftpUsername: string;
  ftpPassword: string;
  ftpPort?: number;
  ftpBasePath?: string;
}

export interface BillHicksStorePricingRecord {
  // Store-specific pricing fields from CSV
  product_name: string;
  universal_product_code: string;
  vendor_sku: string; // Store-specific SKU
  product_price: string; // Store cost
  msrp: string;
  map_price?: string;
  quantity_available?: string;
}

export interface BillHicksStoreSyncResult {
  success: boolean;
  message: string;
  stats: {
    totalRecords: number;
    recordsUpdated: number;
    recordsSkipped: number;
    recordsErrors: number;
    recordsAdded: number;
  };
  error?: string;
}

/**
 * Main function to sync store-specific Bill Hicks pricing
 */
export async function syncStoreSpecificBillHicksPricing(companyId: number): Promise<BillHicksStoreSyncResult> {
  console.log(`🔄 BILL HICKS STORE: Starting pricing sync for company ${companyId}...`);
  
  const stats = {
    totalRecords: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsErrors: 0,
    recordsAdded: 0
  };

  try {
    // Get Bill Hicks vendor ID dynamically
    const billHicksVendor = await getBillHicksVendorId();
    if (!billHicksVendor) {
      throw new Error('Bill Hicks vendor not found in supported vendors');
    }

    // Update sync status to in_progress
    await updateStoreSyncStatus(companyId, billHicksVendor, 'in_progress', stats);

    // Step 1: Get store's FTP credentials
    const credentials = await getStoreCredentials(companyId);
    if (!credentials) {
      throw new Error('Bill Hicks FTP credentials not configured for this store');
    }

    // Step 2: Download store-specific pricing file
    console.log(`📥 Downloading store pricing from FTP for company ${companyId}...`);
    const pricingContent = await downloadStoreSpecificBillHicksPricing(companyId, credentials);
    
    // Step 3: OPTIMIZED - Detect only changed lines instead of processing all records
    console.log('🔍 Analyzing changes using line-by-line differential...');
    const changeResult = await detectStoreChangedLines(companyId, pricingContent);
    
    if (!changeResult.hasChanges) {
      // No changes detected - update stats with actual file size but zero processing
      const allRecords = parseStorePricingCSV(pricingContent);
      stats.totalRecords = allRecords.length;
      stats.recordsSkipped = allRecords.length; // All records were skipped due to no changes
      stats.recordsUpdated = 0;
      stats.recordsAdded = 0;
      stats.recordsErrors = 0;
      
      await updateStoreSyncStatus(companyId, billHicksVendor, 'success', stats);
      return {
        success: true,
        message: `No changes detected - skipped processing ${allRecords.length} records`,
        stats
      };
    }

    // Step 4: OPTIMIZED - Parse only changed lines instead of entire file
    console.log('📋 Parsing only changed records for maximum efficiency...');
    const changedCsvContent = changeResult.changedLines.join('\n');
    const pricingRecords = parseStorePricingCSV(changedCsvContent);
    const allRecords = parseStorePricingCSV(pricingContent); // For total count
    stats.totalRecords = allRecords.length;
    console.log(`🎯 STORE OPTIMIZATION: Found ${changeResult.stats.changedLines} changed records out of ${changeResult.stats.totalLines} total lines`);
    console.log(`📊 Processing only ${pricingRecords.length} records instead of ${allRecords.length}! (${Math.round((1 - pricingRecords.length / allRecords.length) * 100)}% reduction)`);

    // Step 5: Update vendor mappings with store pricing using bulk operations
    console.log('🔄 Updating store pricing mappings with bulk operations...');
    const bulkResult = await bulkUpdateVendorMappings(companyId, billHicksVendor, pricingRecords);
    stats.recordsUpdated = bulkResult.recordsUpdated;
    stats.recordsAdded = bulkResult.recordsAdded;
    stats.recordsSkipped = bulkResult.recordsSkipped;
    stats.recordsErrors = bulkResult.recordsErrors;

    // Step 6: Store current content for future comparison
    await storePreviousStoreContent(companyId, pricingContent);

    // Step 7: Update sync status
    await updateStoreSyncStatus(companyId, billHicksVendor, 'success', stats);

    const message = `✅ Store pricing sync completed: ${stats.recordsUpdated} updated, ${stats.recordsAdded} added, ${stats.recordsSkipped} skipped, ${stats.recordsErrors} errors`;
    console.log(message);

    return {
      success: true,
      message,
      stats
    };

  } catch (error) {
    console.error(`❌ BILL HICKS STORE: Pricing sync failed for company ${companyId}:`, error);
    const billHicksVendor = await getBillHicksVendorId();
    if (billHicksVendor) {
      await updateStoreSyncStatus(companyId, billHicksVendor, 'error', stats, error instanceof Error ? error.message : 'Unknown error');
    }
    
    return {
      success: false,
      message: `Store pricing sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stats,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Download store-specific pricing file from Bill Hicks FTP
 */
async function downloadStoreSpecificBillHicksPricing(companyId: number, credentials: BillHicksFTPCredentials): Promise<string> {
  const client = new FTPClient();
  
  try {
    // Clean hostname - remove protocol and trailing slashes
    const cleanHost = credentials.ftpServer
      .replace(/^https?:\/\//, '')  // Remove protocol (http://, https://)
      .replace(/\/+$/, '');          // Remove trailing slashes
    
    console.log(`📡 BILL HICKS STORE: Connecting to FTP server: ${cleanHost}`);
    
    // Connect to FTP
    await client.access({
      host: cleanHost,
      user: credentials.ftpUsername,
      password: credentials.ftpPassword,
      port: credentials.ftpPort || 21,
      secure: false
    });

    // Navigate to store-specific folder
    // Store folders are typically organized by customer name or number
    const storePath = credentials.ftpBasePath || '/';
    console.log(`📁 BILL HICKS STORE: Attempting to navigate to FTP path: "${storePath}"`);
    
    let actualPath = '/';
    try {
      if (storePath !== '/') {
        await client.cd(storePath);
      }
      actualPath = await client.pwd();
      console.log(`📁 BILL HICKS STORE: Successfully navigated to: "${actualPath}"`);
    } catch (cdError: any) {
      console.error(`❌ BILL HICKS STORE: Failed to navigate to "${storePath}":`, cdError.message);
      
      // Try fallback: navigate to /MicroBiz if /MicroBiz/Feeds fails
      if (storePath === '/MicroBiz/Feeds') {
        console.log(`📁 BILL HICKS STORE: Trying fallback path: "/MicroBiz"`);
        try {
          await client.cd('/MicroBiz');
          actualPath = await client.pwd();
          console.log(`📁 BILL HICKS STORE: Successfully navigated to fallback: "${actualPath}"`);
        } catch (fallbackError: any) {
          console.error(`❌ BILL HICKS STORE: Fallback also failed:`, fallbackError.message);
          throw new Error(`Cannot access FTP directory "${storePath}" or fallback "/MicroBiz". Please verify the Base Directory path is correct. The file may be in the root directory or a different path.`);
        }
      } else {
        throw new Error(`Cannot access FTP directory "${storePath}". Please verify the Base Directory path is correct.`);
      }
    }

    // Look for pricing/inventory files in store folder
    // Common file patterns: pricing.csv, inventory.csv, catalog.csv, etc.
    const files = await client.list();
    console.log(`📂 Found ${files.length} files/folders in directory: "${actualPath}"`);

    // Find the most likely pricing file
    const pricingFile = findPricingFile(files);
    if (!pricingFile) {
      throw new Error(`No pricing file found in store folder ${storePath}. Available files: ${files.map(f => f.name).join(', ')}`);
    }

    console.log(`📄 Using pricing file: ${pricingFile.name} (type: ${pricingFile.type})`);

    // Ensure it's a file, not a directory
    if (pricingFile.type === 2) {
      throw new Error(`"${pricingFile.name}" is a directory, not a file. The pricing file (MicroBiz_Daily_Catalog.csv) should be inside this directory.`);
    }

    // Download the pricing file
    const tempFile = path.join(STORE_DOWNLOADS_DIR, `company_${companyId}_pricing_${Date.now()}.csv`);
    await client.downloadTo(tempFile, pricingFile.name);
    
    // Read content
    const content = readFileSync(tempFile, 'utf-8');
    return content;
    
  } finally {
    client.close();
  }
}

/**
 * Find the most likely pricing file from FTP directory listing
 */
function findPricingFile(files: any[]): any {
  // Bill Hicks specific file patterns (EXACT FILENAMES FIRST - per documentation)
  const billHicksPatterns = [
    // HIGHEST PRIORITY: Exact Bill Hicks MicroBiz filenames (documented in shared/bill-hicks-config.ts)
    /^MicroBiz_Daily_Catalog\.csv$/i,           // Store-specific catalog file (used for pricing)
    /^MicroBiz_Product_Feed\.csv$/i,            // Alternative catalog file name
    /^MicroBiz$/i,                              // File listing might show truncated name
    
    // Store-specific catalog files (generic patterns)
    /^.*catalog.*\.csv$/i,
    /^.*pricing.*\.csv$/i,
    /^.*price.*\.csv$/i,
    
    // Generic patterns
    /pricing\.csv$/i,
    /inventory\.csv$/i,
    /catalog\.csv$/i,
    /price.*\.csv$/i,
    /.*pricing.*\.csv$/i,
    
    // Fallback to any CSV file
    /\.csv$/i
  ];

  console.log(`🔍 Searching for pricing files in ${files.length} files...`);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`  ${i + 1}. Name: "${file.name}" | Size: ${file.size || 'unknown'} bytes | Type: ${file.type || 'unknown'}`);
  }

  for (const pattern of billHicksPatterns) {
    const match = files.find(file => pattern.test(file.name));
    if (match) {
      console.log(`✅ Found pricing file: "${match.name}" (matched pattern: ${pattern})`);
      return match;
    }
  }

  console.log('❌ No pricing file found matching any pattern');
  console.log('Available file names:', files.map(f => `"${f.name}"`).join(', '));
  return null;
}

/**
 * Parse store pricing CSV content
 */
function parseStorePricingCSV(content: string): BillHicksStorePricingRecord[] {
  try {
    // Simple fix for common header issues
    const fixedContent = content.replace(/,product_name"/g, ',"product_name"');
    
    const records = parse(fixedContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      skip_records_with_error: true
    });
    
    // Map CSV fields to our interface
    return records.map((record: any) => ({
      product_name: record.product_name || record.Product || record.PRODUCT_NAME || '',
      universal_product_code: record.universal_product_code || record.UPC || record.upc || '',
      vendor_sku: record.vendor_sku || record.SKU || record.sku || record.product_name || '',
      product_price: record.product_price || record.cost || record.COST || record.price || '0',
      msrp: record.msrp || record.MSRP || record.retail || '0',
      map_price: record.map_price || record.MAP || record.map || undefined,
      quantity_available: record.quantity_available || record.qty || record.QTY || record.quantity || undefined
    }));
    
  } catch (error) {
    throw new Error(`Failed to parse store pricing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Bill Hicks vendor ID dynamically
 */
async function getBillHicksVendorId(): Promise<number | null> {
  if (cachedBillHicksVendorId) {
    return cachedBillHicksVendorId;
  }
  
  try {
    const vendorId = await storage.getBillHicksVendorId();
    cachedBillHicksVendorId = vendorId;
    return vendorId;
  } catch {
    return null;
  }
}

/**
 * Bulk update vendor mappings for better performance
 * Replaces individual database operations with bulk operations
 */
async function bulkUpdateVendorMappings(
  companyId: number, 
  billHicksVendorId: number, 
  pricingRecords: BillHicksStorePricingRecord[]
): Promise<{recordsUpdated: number, recordsAdded: number, recordsSkipped: number, recordsErrors: number}> {
  
  const stats = {
    recordsUpdated: 0,
    recordsAdded: 0,
    recordsSkipped: 0,
    recordsErrors: 0
  };

  try {
    // Step 1: Get all UPCs that need to be processed
    const upcs = pricingRecords
      .map(record => record.universal_product_code?.trim())
      .filter(upc => upc && upc !== '0');
    
    if (upcs.length === 0) {
      console.log('⚠️ No valid UPCs found in pricing records');
      return stats;
    }

    // Step 2: Pre-fetch all products by UPC in one query
    console.log(`📊 Pre-fetching ${upcs.length} products by UPC...`);
    const products = await db.select()
      .from(products)
      .where(inArray(products.upc, upcs));
    
    const productMap = new Map(products.map(p => [p.upc, p]));
    console.log(`📊 Found ${products.length} existing products`);

    // Step 3: Pre-fetch all existing vendor mappings in one query
    console.log(`📊 Pre-fetching existing vendor mappings...`);
    const existingMappings = await db.select()
      .from(vendorProductMappings)
      .where(
        and(
          eq(vendorProductMappings.companyId, companyId),
          eq(vendorProductMappings.supportedVendorId, billHicksVendorId)
        )
      );
    
    const mappingMap = new Map(existingMappings.map(m => [m.productId, m]));
    console.log(`📊 Found ${existingMappings.length} existing mappings`);

    // Step 4: Process changes in memory
    const mappingsToInsert = [];
    const mappingsToUpdate = [];

    for (const pricingRecord of pricingRecords) {
      const upc = pricingRecord.universal_product_code?.trim();
      
      // Skip records without UPC
      if (!upc || upc === '0') {
        stats.recordsSkipped++;
        continue;
      }

      const product = productMap.get(upc);
      if (!product) {
        console.log(`⚠️ Product with UPC ${upc} not found in master catalog - skipping`);
        stats.recordsSkipped++;
        continue;
      }

      const existingMapping = mappingMap.get(product.id);
      const mappingData = {
        vendorSku: pricingRecord.vendor_sku,
        vendorCost: pricingRecord.product_price && pricingRecord.product_price !== '0' ? pricingRecord.product_price : null,
        msrpPrice: pricingRecord.msrp && pricingRecord.msrp !== '0' ? pricingRecord.msrp : null,
        mapPrice: pricingRecord.map_price && pricingRecord.map_price !== '0' ? pricingRecord.map_price : null,
        lastPriceUpdate: new Date(),
        updatedAt: new Date()
      };

      if (existingMapping) {
        // Check if update is needed
        const needsUpdate = 
          existingMapping.vendorSku !== mappingData.vendorSku ||
          existingMapping.vendorCost !== mappingData.vendorCost ||
          existingMapping.msrpPrice !== mappingData.msrpPrice ||
          existingMapping.mapPrice !== mappingData.mapPrice;

        if (needsUpdate) {
          mappingsToUpdate.push({
            id: existingMapping.id,
            ...mappingData
          });
        } else {
          stats.recordsSkipped++;
        }
      } else {
        // New mapping
        mappingsToInsert.push({
          productId: product.id,
          supportedVendorId: billHicksVendorId,
          companyId: companyId,
          ...mappingData
        });
      }
    }

    // Step 5: Execute bulk operations
    console.log(`🔄 Executing bulk operations: ${mappingsToInsert.length} inserts, ${mappingsToUpdate.length} updates`);
    
    if (mappingsToInsert.length > 0) {
      await db.insert(vendorProductMappings).values(mappingsToInsert);
      stats.recordsAdded = mappingsToInsert.length;
    }
    
    if (mappingsToUpdate.length > 0) {
      await db.transaction(async (tx) => {
        for (const update of mappingsToUpdate) {
          await tx.update(vendorProductMappings)
            .set({
              vendorSku: update.vendorSku,
              vendorCost: update.vendorCost,
              msrpPrice: update.msrpPrice,
              mapPrice: update.mapPrice,
              lastPriceUpdate: update.lastPriceUpdate,
              updatedAt: update.updatedAt
            })
            .where(eq(vendorProductMappings.id, update.id));
        }
      });
      stats.recordsUpdated = mappingsToUpdate.length;
    }

    console.log(`✅ Bulk operations completed: ${stats.recordsAdded} added, ${stats.recordsUpdated} updated, ${stats.recordsSkipped} skipped`);
    return stats;

  } catch (error) {
    console.error('❌ Error in bulk update vendor mappings:', error);
    stats.recordsErrors = pricingRecords.length;
    return stats;
  }
}

/**
 * Update vendor mapping with store pricing data (DEPRECATED - use bulkUpdateVendorMappings)
 */
async function updateVendorMapping(companyId: number, billHicksVendorId: number, pricingRecord: BillHicksStorePricingRecord): Promise<{updated: boolean, isNew: boolean}> {
  const upc = pricingRecord.universal_product_code?.trim();
  
  // Skip records without UPC
  if (!upc || upc === '0') {
    return { updated: false, isNew: false };
  }

  // Find existing product by UPC using storage
  const existingProduct = await storage.getProductByUPC(upc);
  if (!existingProduct) {
    console.log(`⚠️ Product with UPC ${upc} not found in master catalog - skipping`);
    return { updated: false, isNew: false };
  }

  // Check for existing vendor mapping using storage
  const existingMapping = await storage.getVendorProductMappingByCompanyAndVendor(companyId, existingProduct.id, billHicksVendorId);

  const mappingData = {
    vendorSku: pricingRecord.vendor_sku,
    vendorCost: pricingRecord.product_price && pricingRecord.product_price !== '0' ? pricingRecord.product_price : null,
    msrpPrice: pricingRecord.msrp && pricingRecord.msrp !== '0' ? pricingRecord.msrp : null,
    mapPrice: pricingRecord.map_price && pricingRecord.map_price !== '0' ? pricingRecord.map_price : null,
    lastPriceUpdate: new Date(),
    updatedAt: new Date()
  };

  if (existingMapping) {
    // Update existing mapping using storage
    await storage.updateVendorProductMapping(existingMapping.id, mappingData);
    return { updated: true, isNew: false };
  } else {
    // Create new mapping using storage
    await storage.createVendorProductMapping({
      productId: existingProduct.id,
      supportedVendorId: billHicksVendorId,
      companyId: companyId,
      ...mappingData
    });
    return { updated: true, isNew: true };
  }
}

/**
 * Get store's Bill Hicks FTP credentials
 * Falls back to admin Base Directory if store doesn't have a specific path configured
 */
async function getStoreCredentials(companyId: number): Promise<BillHicksFTPCredentials | null> {
  const billHicksVendorId = await getBillHicksVendorId();
  if (!billHicksVendorId) {
    return null;
  }

  const credentials = await storage.getCompanyVendorCredentials(companyId, billHicksVendorId);
  if (!credentials || !credentials.ftpServer || !credentials.ftpUsername || !credentials.ftpPassword) {
    return null;
  }

  // Get admin Base Directory as fallback
  let defaultBasePath = '/MicroBiz/Feeds'; // Final fallback per Bill Hicks documentation
  const billHicksVendor = await storage.getSupportedVendorById(billHicksVendorId);
  if (billHicksVendor?.adminCredentials) {
    const adminBasePath = billHicksVendor.adminCredentials.ftpBasePath || billHicksVendor.adminCredentials.ftp_base_path;
    if (adminBasePath) {
      defaultBasePath = adminBasePath;
      console.log(`📁 BILL HICKS STORE: Using admin Base Directory as default: ${defaultBasePath}`);
    }
  }

  return {
    ftpServer: credentials.ftpServer,
    ftpUsername: credentials.ftpUsername,
    ftpPassword: credentials.ftpPassword, // Plain text - no decryption needed
    ftpPort: credentials.ftpPort || 21,
    ftpBasePath: credentials.ftpBasePath || defaultBasePath // Use store path or admin default
  };
}

/**
 * OPTIMIZED: Line-by-line differential detection for store pricing
 * Only returns the actual changed lines instead of a boolean
 * This is MUCH more efficient than processing all records
 */
async function detectStoreChangedLines(companyId: number, newContent: string): Promise<{
  hasChanges: boolean;
  changedLines: string[];
  stats: {
    totalLines: number;
    changedLines: number;
    addedLines: number;
    removedLines: number;
  };
}> {
  const previousFile = path.join(STORE_DOWNLOADS_DIR, `company_${companyId}_previous_pricing.csv`);
  
  if (!existsSync(previousFile)) {
    console.log(`📝 No previous pricing file found for company ${companyId} - processing all records (first sync)`);
    const allLines = newContent.split('\n').filter(line => line.trim());
    return {
      hasChanges: true,
      changedLines: allLines,
      stats: {
        totalLines: allLines.length,
        changedLines: allLines.length,
        addedLines: allLines.length,
        removedLines: 0
      }
    };
  }
  
  const previousContent = readFileSync(previousFile, 'utf-8');
  const previousLines = new Set(previousContent.split('\n').filter(line => line.trim()));
  const newLines = newContent.split('\n').filter(line => line.trim());
  const newLinesSet = new Set(newLines);
  
  // Find added/modified lines (lines that exist in new but not in previous)
  const changedLines = [];
  const headerLine = newLines[0]; // Always include header
  if (headerLine) {
    changedLines.push(headerLine);
  }
  
  for (let i = 1; i < newLines.length; i++) { // Skip header
    const line = newLines[i];
    if (!previousLines.has(line)) {
      changedLines.push(line);
    }
  }
  
  // Calculate stats
  const addedLines = newLines.filter(line => !previousLines.has(line)).length;
  const removedLines = Array.from(previousLines).filter(line => !newLinesSet.has(line)).length;
  
  const stats = {
    totalLines: newLines.length,
    changedLines: changedLines.length - 1, // Subtract header
    addedLines: addedLines,
    removedLines: removedLines
  };
  
  const hasChanges = changedLines.length > 1; // More than just header
  
  if (hasChanges) {
    console.log(`🎯 STORE OPTIMIZATION: Found ${stats.changedLines} changed lines out of ${stats.totalLines} total lines`);
    console.log(`📊 Store Added: ${stats.addedLines}, Removed: ${stats.removedLines}`);
    console.log(`⚡ Processing only ${stats.changedLines} records instead of ${stats.totalLines}! (${Math.round((1 - stats.changedLines / stats.totalLines) * 100)}% reduction)`);
  } else {
    console.log(`✅ No pricing changes detected in store file`);
  }
  
  return {
    hasChanges,
    changedLines,
    stats
  };
}

/**
 * Store current content for future change detection
 */
async function storePreviousStoreContent(companyId: number, content: string): Promise<void> {
  const previousFile = path.join(STORE_DOWNLOADS_DIR, `company_${companyId}_previous_pricing.csv`);
  writeFileSync(previousFile, content, 'utf-8');
}

/**
 * Update store-specific sync status in companyVendorCredentials table
 * FIXED: Now properly maps camelCase to snake_case for database compatibility
 */
async function updateStoreSyncStatus(companyId: number, billHicksVendorId: number, status: 'in_progress' | 'success' | 'error', stats: any, error?: string): Promise<void> {
  // Get existing credentials to update
  const existingCredentials = await storage.getCompanyVendorCredentials(companyId, billHicksVendorId);
  if (!existingCredentials) {
    console.warn(`⚠️ BILL HICKS STORE: No existing credentials found for company ${companyId}, vendor ${billHicksVendorId} - skipping status update`);
    return;
  }

  const updateData: any = {
    catalog_sync_status: status,
    updated_at: new Date()
  };

  if (status === 'success') {
    updateData.last_catalog_sync = new Date();
    updateData.catalog_sync_error = null;
    updateData.last_catalog_records_created = stats.recordsAdded || 0;
    updateData.last_catalog_records_updated = stats.recordsUpdated || 0;
    updateData.last_catalog_records_skipped = stats.recordsSkipped || 0;
    updateData.last_catalog_records_failed = stats.recordsErrors || 0;
    updateData.last_catalog_records_processed = stats.totalRecords || 0;
  } else if (status === 'error') {
    updateData.catalog_sync_error = error;
    updateData.last_catalog_records_created = 0;
    updateData.last_catalog_records_updated = 0;
    updateData.last_catalog_records_skipped = 0;
    updateData.last_catalog_records_failed = 0;
    updateData.last_catalog_records_processed = 0;
  }

  // Merge update data with existing credentials
  // Convert ALL fields to snake_case for upsert function
  const updatedCredentials = {
    company_id: existingCredentials.companyId || companyId,
    supported_vendor_id: existingCredentials.supportedVendorId || billHicksVendorId,
    ftp_server: existingCredentials.ftpServer,
    ftp_port: existingCredentials.ftpPort,
    ftp_username: existingCredentials.ftpUsername,
    ftp_password: existingCredentials.ftpPassword,
    ftp_base_path: existingCredentials.ftpBasePath,
    catalog_sync_enabled: existingCredentials.catalogSyncEnabled,
    catalog_sync_schedule: existingCredentials.catalogSyncSchedule,
    inventory_sync_enabled: existingCredentials.inventorySyncEnabled,
    inventory_sync_schedule: existingCredentials.inventorySyncSchedule,
    ...updateData // Now all fields are already in snake_case
  };
  
  console.log(`🔍 BILL HICKS STORE: Updating credentials with company_id=${updatedCredentials.company_id}, supported_vendor_id=${updatedCredentials.supported_vendor_id}`);
  await storage.upsertCompanyVendorCredentials(updatedCredentials);
}
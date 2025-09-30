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
    
    // Step 3: Check if content has changed
    const hasChanges = await detectStoreChanges(companyId, pricingContent);
    if (!hasChanges) {
      // Even when no changes are detected, we still processed the file
      // Parse the CSV to get the actual record count for proper stats
      const pricingRecords = parseStorePricingCSV(pricingContent);
      stats.totalRecords = pricingRecords.length;
      stats.recordsSkipped = pricingRecords.length; // All records were skipped due to no changes
      stats.recordsUpdated = 0;
      stats.recordsAdded = 0;
      stats.recordsErrors = 0;
      
      await updateStoreSyncStatus(companyId, billHicksVendor, 'success', stats);
      return {
        success: true,
        message: 'No changes detected - sync skipped',
        stats
      };
    }

    // Step 4: Parse CSV content
    console.log('📋 Parsing store pricing data...');
    const pricingRecords = parseStorePricingCSV(pricingContent);
    stats.totalRecords = pricingRecords.length;
    console.log(`📊 Found ${pricingRecords.length} pricing records`);

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
    // Connect to FTP
    await client.access({
      host: credentials.ftpServer.replace(/^https?:\/\//, ''),
      user: credentials.ftpUsername,
      password: credentials.ftpPassword,
      port: credentials.ftpPort || 21,
      secure: false
    });

    // Navigate to store-specific folder
    // Store folders are typically organized by customer name or number
    const storePath = credentials.ftpBasePath || '/';
    await client.cd(storePath);

    // Look for pricing/inventory files in store folder
    // Common file patterns: pricing.csv, inventory.csv, catalog.csv, etc.
    const files = await client.list();
    console.log(`📂 Found ${files.length} files in store folder: ${storePath}`);

    // Find the most likely pricing file
    const pricingFile = findPricingFile(files);
    if (!pricingFile) {
      throw new Error(`No pricing file found in store folder ${storePath}`);
    }

    console.log(`📄 Using pricing file: ${pricingFile.name}`);

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
  // Bill Hicks specific file patterns (based on documentation)
  const billHicksPatterns = [
    // Store-specific catalog files (most common)
    /^.*catalog.*\.csv$/i,
    /^.*pricing.*\.csv$/i,
    /^.*price.*\.csv$/i,
    // Generic patterns
    /pricing\.csv$/i,
    /inventory\.csv$/i,
    /catalog\.csv$/i,
    /price.*\.csv$/i,
    /.*pricing.*\.csv$/i,
    /.*inventory.*\.csv$/i,
    // Fallback to any CSV file
    /\.csv$/i
  ];

  console.log(`🔍 Searching for pricing files in ${files.length} files...`);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`  ${i + 1}. ${file.name} (${file.size || 'unknown size'} bytes)`);
  }

  for (const pattern of billHicksPatterns) {
    const match = files.find(file => pattern.test(file.name));
    if (match) {
      console.log(`✅ Found pricing file: ${match.name} (matched pattern: ${pattern})`);
      return match;
    }
  }

  console.log('❌ No pricing file found matching any pattern');
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

  return {
    ftpServer: credentials.ftpServer,
    ftpUsername: credentials.ftpUsername,
    ftpPassword: credentials.ftpPassword, // Plain text - no decryption needed
    ftpPort: credentials.ftpPort || 21,
    ftpBasePath: credentials.ftpBasePath || '/'
  };
}

/**
 * Simple change detection using content hash for store pricing
 */
async function detectStoreChanges(companyId: number, newContent: string): Promise<boolean> {
  const previousFile = path.join(STORE_DOWNLOADS_DIR, `company_${companyId}_previous_pricing.csv`);
  
  if (!existsSync(previousFile)) {
    console.log(`📝 No previous pricing file found for company ${companyId} - processing all records`);
    return true;
  }
  
  const previousContent = readFileSync(previousFile, 'utf-8');
  const newHash = crypto.createHash('md5').update(newContent).digest('hex');
  const previousHash = crypto.createHash('md5').update(previousContent).digest('hex');
  
  const hasChanges = newHash !== previousHash;
  console.log(hasChanges ? '📝 Pricing changes detected' : '✅ No pricing changes detected');
  
  return hasChanges;
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
 */
async function updateStoreSyncStatus(companyId: number, billHicksVendorId: number, status: 'in_progress' | 'success' | 'error', stats: any, error?: string): Promise<void> {
  const updateData: any = {
    catalogSyncStatus: status,
    updatedAt: new Date()
  };

  if (status === 'success') {
    updateData.lastCatalogSync = new Date();
    updateData.catalogSyncError = null;
    updateData.lastCatalogRecordsCreated = stats.recordsAdded;
    updateData.lastCatalogRecordsUpdated = stats.recordsUpdated;
  } else if (status === 'error') {
    updateData.catalogSyncError = error;
    updateData.lastCatalogRecordsCreated = 0;
    updateData.lastCatalogRecordsUpdated = 0;
  }

  // Get existing credentials to update
  const existingCredentials = await storage.getCompanyVendorCredentials(companyId, billHicksVendorId);
  if (existingCredentials) {
    // Merge update data with existing credentials
    const updatedCredentials = {
      ...existingCredentials,
      ...updateData
    };
    await storage.upsertCompanyVendorCredentials(updatedCredentials);
  }
}
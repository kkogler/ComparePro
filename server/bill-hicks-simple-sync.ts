/**
 * SIMPLIFIED Bill Hicks Catalog Sync
 * 
 * Replaces the complex 3-tier system with a simple approach:
 * 1. Download CSV catalog from FTP
 * 2. Detect changes from previous version
 * 3. Update products only where Bill Hicks priority (3) beats current vendor priority
 * 4. Simple, clear logging
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { Client as FTPClient } from 'basic-ftp';
import path from 'path';
import crypto from 'crypto';
import { db } from './db';
import { products, supportedVendors, vendorInventory } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getVendorRecordPriority } from './vendor-priority';
import { storage } from './storage';

// Bill Hicks Configuration
const BILL_HICKS_PRIORITY = 3; // Bill Hicks has priority 3
const FTP_PATH = '/MicroBiz/Feeds/MicroBiz_Daily_Catalog.csv';
const FTP_INVENTORY_PATH = '/MicroBiz/Feeds/MicroBiz_Hourly_Inventory.csv';
const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads', 'bill-hicks');

// Vendor priority cache to avoid repeated database lookups
const vendorPriorityCache = new Map<string, number>();

/**
 * Get vendor priority with caching to avoid repeated database lookups
 */
async function getCachedVendorPriority(vendorName: string): Promise<number> {
  if (vendorPriorityCache.has(vendorName)) {
    return vendorPriorityCache.get(vendorName)!;
  }
  
  const priority = await getVendorRecordPriority(vendorName);
  vendorPriorityCache.set(vendorName, priority);
  return priority;
}

// Ensure downloads directory exists
if (!existsSync(DOWNLOADS_DIR)) {
  mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

export interface BillHicksProduct {
  product_name: string;
  universal_product_code: string;
  short_description: string;
  long_description: string;
  category_description: string;
  MFG_product: string;
  product_price: string;
  msrp: string;
}

export interface BillHicksInventoryItem {
  Product: string; // Vendor SKU
  UPC: string;
  'Qty Avail': string;
}

interface ProcessedInventoryItem {
  vendorSku: string;
  upc: string;
  quantityAvailable: number;
}

export interface BillHicksSyncResult {
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
 * Simple Bill Hicks inventory-only sync
 * Lightweight function that only updates inventory levels without catalog operations
 */
export async function runBillHicksInventorySync(): Promise<BillHicksSyncResult> {
  console.log('📦 BILL HICKS: Starting inventory-only sync...');
  
  const stats = {
    totalRecords: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsErrors: 0,
    recordsAdded: 0
  };

  try {
    // Set status to in_progress at start
    await updateInventorySyncStatus('in_progress', stats);

    // Step 1: Get FTP credentials
    const credentials = await getBillHicksFTPCredentials();
    if (!credentials) {
      throw new Error('Bill Hicks FTP credentials not configured');
    }

    // Step 2: Download inventory file
    console.log('📥 Downloading inventory from FTP...');
    const inventoryContent = await downloadInventoryFile(credentials);
    
    // Step 3: OPTIMIZED - Detect only changed inventory lines
    console.log('🔍 Analyzing inventory changes using line-by-line differential...');
    const inventoryChangeResult = await detectInventoryChangedLines(inventoryContent);
    
    if (!inventoryChangeResult.hasChanges) {
      // No changes detected - update stats with actual file size but zero processing
      const allInventoryItems = parseInventoryCSV(inventoryContent);
      stats.totalRecords = allInventoryItems.length;
      stats.recordsSkipped = allInventoryItems.length; // All records were skipped due to no changes
      stats.recordsUpdated = 0;
      stats.recordsAdded = 0;
      stats.recordsErrors = 0;
      
      await updateInventorySyncStatus('success', stats);
      return {
        success: true,
        message: `No inventory changes detected - skipped processing ${allInventoryItems.length} records`,
        stats
      };
    }

    // Step 4: OPTIMIZED - Parse only changed inventory lines
    console.log('📋 Parsing only changed inventory records for maximum efficiency...');
    const changedInventoryCsvContent = inventoryChangeResult.changedLines.join('\n');
    const changedInventoryItems = parseInventoryCSV(changedInventoryCsvContent);
    
    // Update stats to reflect the optimization
    const allInventoryItems = parseInventoryCSV(inventoryContent);
    stats.totalRecords = allInventoryItems.length;
    
    console.log(`🎯 INVENTORY OPTIMIZATION: Processing only ${changedInventoryItems.length} changed records instead of ${allInventoryItems.length} total records!`);
    console.log(`⚡ Inventory efficiency gain: ${Math.round((1 - changedInventoryItems.length / allInventoryItems.length) * 100)}% reduction!`);

    // Step 5: Update only changed inventory using bulk operations
    console.log('🔄 Updating only changed inventory with bulk operations...');
    const bulkResult = await bulkUpdateInventoryRecords(changedInventoryItems, stats);
    stats.recordsUpdated = bulkResult.recordsUpdated;
    stats.recordsAdded = bulkResult.recordsAdded;
    stats.recordsSkipped = bulkResult.recordsSkipped;
    stats.recordsErrors = bulkResult.recordsErrors;

    // Step 6: Store current content for future comparison
    await storePreviousInventoryContent(inventoryContent);

    // Step 7: Update sync status
    await updateInventorySyncStatus('success', stats);

    const message = `✅ Inventory sync completed: ${stats.recordsUpdated} updated, ${stats.recordsAdded} added, ${stats.recordsSkipped} skipped, ${stats.recordsErrors} errors`;
    console.log(message);

    return {
      success: true,
      message,
      stats
    };

  } catch (error) {
    console.error('❌ BILL HICKS: Inventory sync failed:', error);
    await updateInventorySyncStatus('error', stats, error instanceof Error ? error.message : 'Unknown error');
    
    return {
      success: false,
      message: `Inventory sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stats,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Simple Bill Hicks catalog sync - replaces the complex 3-tier system
 */
export async function runBillHicksSimpleSync(): Promise<BillHicksSyncResult> {
  console.log('🔄 BILL HICKS: Starting simplified catalog sync...');
  
  // Clear vendor priority cache for fresh data
  vendorPriorityCache.clear();
  
  const stats = {
    totalRecords: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsErrors: 0,
    recordsAdded: 0
  };

  try {
    // Set status to in_progress at start
    await updateSyncStatus('in_progress', stats);
    // Step 1: Get FTP credentials
    const credentials = await getBillHicksFTPCredentials();
    if (!credentials) {
      throw new Error('Bill Hicks FTP credentials not configured');
    }

    // Step 2: Download catalog file
    console.log('📥 Downloading catalog from FTP...');
    const catalogContent = await downloadCatalogFile(credentials);
    
    // Step 3: OPTIMIZED - Detect only changed lines instead of processing all products
    console.log('🔍 Analyzing changes using line-by-line differential...');
    const changeResult = await detectChangedLines(catalogContent);
    
    if (!changeResult.hasChanges) {
      // No changes detected - update stats with actual file size but zero processing
      const allProducts = parseCatalogCSV(catalogContent);
      stats.totalRecords = allProducts.length;
      stats.recordsSkipped = allProducts.length; // All records were skipped due to no changes
      stats.recordsUpdated = 0;
      stats.recordsAdded = 0;
      stats.recordsErrors = 0;
      
      await updateSyncStatus('success', stats);
      return {
        success: true,
        message: `No changes detected - skipped processing ${allProducts.length} products`,
        stats
      };
    }

    // Step 4: OPTIMIZED - Parse only changed lines instead of entire catalog
    console.log('📋 Parsing only changed records for maximum efficiency...');
    const changedCsvContent = changeResult.changedLines.join('\n');
    const changedProducts = parseCatalogCSV(changedCsvContent);
    
    // Update stats to reflect the optimization
    const allProducts = parseCatalogCSV(catalogContent);
    stats.totalRecords = allProducts.length;
    
    console.log(`🎯 OPTIMIZATION SUCCESS: Processing only ${changedProducts.length} changed products instead of ${allProducts.length} total products!`);
    console.log(`⚡ Efficiency gain: ${Math.round((1 - changedProducts.length / allProducts.length) * 100)}% reduction in processing time!`);

    // Step 5: Update only changed products based on priority
    console.log('🔄 Updating only changed products...');
    for (const product of changedProducts) {
      try {
        const result = await updateProductIfPriorityAllows(product);
        if (result.updated) {
          if (result.isNew) {
            stats.recordsAdded++;
          } else {
            stats.recordsUpdated++;
          }
        } else {
          stats.recordsSkipped++;
        }
      } catch (error) {
        stats.recordsErrors++;
        console.error(`❌ Error updating product ${product.universal_product_code}:`, error);
      }
    }

    // Step 6: Store current content for future comparison
    await storePreviousContent(catalogContent);

    // Step 7: Update sync status
    await updateSyncStatus('success', stats);

    const message = `✅ Sync completed: ${stats.recordsUpdated} updated, ${stats.recordsSkipped} skipped, ${stats.recordsErrors} errors`;
    console.log(message);

    return {
      success: true,
      message,
      stats
    };

  } catch (error) {
    console.error('❌ BILL HICKS: Sync failed:', error);
    await updateSyncStatus('error', stats, error instanceof Error ? error.message : 'Unknown error');
    
    return {
      success: false,
      message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stats,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Download catalog file from Bill Hicks FTP
 */
async function downloadCatalogFile(credentials: any): Promise<string> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = new FTPClient();
    console.log(`📥 FTP Catalog Download attempt ${attempt}/${maxRetries}...`);
    
    try {
      // Parse and sanitize FTP host
      let host = credentials.ftpServer;
      let secure = false;
      
      try {
        const url = new URL(credentials.ftpServer);
        host = url.hostname;
        secure = url.protocol === 'ftps:';
      } catch {
        // Fallback: strip any protocol prefixes and trailing slashes
        host = credentials.ftpServer
          .replace(/^(https?|ftps?):\/\//, '')
          .replace(/\/+$/, '');
      }

      console.log(`🔗 Connecting to FTP host: ${host} (secure: ${secure})`);

      // Note: rely on library defaults for timeouts to avoid type issues

      // Track progress
      client.trackProgress(info => {
        console.log(`📊 FTP Catalog Progress: ${info.bytes} bytes transferred`);
      });

      const connectStart = Date.now();
      await client.access({
        host,
        user: credentials.ftpUsername,
        password: credentials.ftpPassword,
        secure
      });
      console.log(`✅ FTP Connected in ${Date.now() - connectStart}ms`);

      // Preflight checks
      console.log(`🔍 Checking catalog file availability: ${FTP_PATH}`);
      try {
        const fileSize = await client.size(FTP_PATH);
        const lastMod = await client.lastMod(FTP_PATH);
        console.log(`📄 Catalog file found: ${fileSize} bytes, modified ${lastMod}`);
      } catch (error) {
        console.log(`⚠️ Catalog preflight check failed (file may not exist): ${error}`);
      }

      // Download file to temporary location
      const tempFile = path.join(DOWNLOADS_DIR, `temp_catalog_${Date.now()}.csv`);
      console.log(`⬇️ Starting catalog download to: ${tempFile}`);
      
      const downloadStart = Date.now();
      await client.downloadTo(tempFile, FTP_PATH);
      console.log(`✅ Catalog download completed in ${Date.now() - downloadStart}ms`);
      
      // Read content
      const content = readFileSync(tempFile, 'utf-8');
      console.log(`📋 Catalog content loaded: ${content.length} characters`);
      return content;
      
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ FTP catalog attempt ${attempt} failed:`, error);
      
      // Classify error type
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('530')) {
        console.error(`🔐 Authentication error (530) - check credentials`);
      } else if (errorMsg.includes('550')) {
        console.error(`📂 File not found (550) - check path: ${FTP_PATH}`);
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNREFUSED')) {
        console.error(`🌐 Network connectivity issue`);
      }
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } finally {
      client.close();
    }
  }

  throw new Error(`FTP catalog download failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Simple CSV parsing - no complex header repair or encoding detection
 */
function parseCatalogCSV(content: string): BillHicksProduct[] {
  try {
    // Simple fix for common header issues
    const fixedContent = content.replace(',MFG_product"', ',"MFG_product"');
    
    const records = parse(fixedContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      skip_records_with_error: true
    });
    
    return records as BillHicksProduct[];
  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * OPTIMIZED: Line-by-line differential detection
 * Only returns the actual changed lines instead of a boolean
 * This is MUCH more efficient than processing all 50,000+ products
 */
async function detectChangedLines(newContent: string): Promise<{
  hasChanges: boolean;
  changedLines: string[];
  stats: {
    totalLines: number;
    changedLines: number;
    addedLines: number;
    removedLines: number;
  };
}> {
  const previousFile = path.join(DOWNLOADS_DIR, 'previous_catalog.csv');
  
  if (!existsSync(previousFile)) {
    console.log('📝 No previous file found - processing all records (first sync)');
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
    console.log(`🎯 OPTIMIZATION: Found ${stats.changedLines} changed lines out of ${stats.totalLines} total lines`);
    console.log(`📊 Added: ${stats.addedLines}, Removed: ${stats.removedLines}`);
    console.log(`⚡ Processing only ${stats.changedLines} products instead of ${stats.totalLines}! (${Math.round((1 - stats.changedLines / stats.totalLines) * 100)}% reduction)`);
  } else {
    console.log('✅ No changes detected - sync will be skipped');
  }
  
  return {
    hasChanges,
    changedLines,
    stats
  };
}

/**
 * LEGACY: Simple change detection using content hash (DEPRECATED)
 * This is kept for backward compatibility but should not be used
 */
async function detectChanges(newContent: string): Promise<boolean> {
  const result = await detectChangedLines(newContent);
  return result.hasChanges;
}

/**
 * Update product only if Bill Hicks priority (3) beats current vendor priority
 */
async function updateProductIfPriorityAllows(billHicksProduct: BillHicksProduct): Promise<{updated: boolean, isNew: boolean}> {
  const upc = billHicksProduct.universal_product_code?.trim();
  
  // Skip products without UPC
  if (!upc || upc === '0') {
    return { updated: false, isNew: false };
  }

  // Find existing product
  const [existingProduct] = await db.select()
    .from(products)
    .where(eq(products.upc, upc));

  // If product doesn't exist, create it
  if (!existingProduct) {
    await createNewProduct(billHicksProduct);
    return { updated: true, isNew: true };
  }

  // Check vendor priority (with caching)
  const currentVendorPriority = await getCachedVendorPriority(existingProduct.source || '');
  
  // Bill Hicks (priority 3) can only replace vendors with priority > 3 (like GunBroker=4, Lipsey's=4)
  if (BILL_HICKS_PRIORITY >= currentVendorPriority) {
    return { updated: false, isNew: false }; // Current vendor has same or higher priority
  }

  // Option 1 optimization: skip no-op updates if mapped fields are identical
  const mapped = computeMappedFieldsFromBillHicksProduct(billHicksProduct);
  if (areExistingFieldsIdentical(existingProduct, mapped)) {
    return { updated: false, isNew: false };
  }

  // Update product with Bill Hicks data
  await updateExistingProduct(existingProduct.id, billHicksProduct);
  return { updated: true, isNew: false };
}

/**
 * Create new product from Bill Hicks data
 */
async function createNewProduct(billHicksProduct: BillHicksProduct): Promise<void> {
  await db.insert(products).values({
    name: billHicksProduct.short_description || billHicksProduct.product_name,
    brand: extractBrand(billHicksProduct.product_name),
    upc: billHicksProduct.universal_product_code,
    manufacturerPartNumber: extractPartNumber(billHicksProduct.product_name),
    category: billHicksProduct.category_description,
    description: billHicksProduct.long_description || billHicksProduct.short_description,
    source: 'Bill Hicks & Co.',
    retailVerticalId: 1, // Firearms
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

/**
 * Update existing product with Bill Hicks data
 */
async function updateExistingProduct(productId: number, billHicksProduct: BillHicksProduct): Promise<void> {
  await db.update(products)
    .set({
      name: billHicksProduct.short_description || billHicksProduct.product_name,
      brand: extractBrand(billHicksProduct.product_name),
      manufacturerPartNumber: extractPartNumber(billHicksProduct.product_name),
      category: billHicksProduct.category_description,
      description: billHicksProduct.long_description || billHicksProduct.short_description,
      source: 'Bill Hicks & Co.',
      updatedAt: new Date()
    })
    .where(eq(products.id, productId));
}

/**
 * Simple brand extraction from product_name (e.g., "BUR 202224" -> "BUR")
 */
function extractBrand(productName: string): string {
  const parts = productName.trim().split(' ');
  return parts.length > 0 ? parts[0] : '';
}

/**
 * Simple part number extraction from product_name (e.g., "BUR 202224" -> "202224")
 */
function extractPartNumber(productName: string): string {
  const parts = productName.trim().split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : productName;
}

/**
 * Build the target product field values for comparison
 */
function computeMappedFieldsFromBillHicksProduct(billHicksProduct: BillHicksProduct) {
  return {
    name: billHicksProduct.short_description || billHicksProduct.product_name,
    brand: extractBrand(billHicksProduct.product_name),
    manufacturerPartNumber: extractPartNumber(billHicksProduct.product_name),
    category: billHicksProduct.category_description,
    description: billHicksProduct.long_description || billHicksProduct.short_description,
    source: 'Bill Hicks & Co.'
  };
}

/**
 * Determine whether an existing product already matches the mapped values
 */
function areExistingFieldsIdentical(existingProduct: any, mapped: {
  name: string;
  brand: string;
  manufacturerPartNumber: string;
  category: string;
  description: string;
  source: string;
}): boolean {
  const normalize = (v: any) => (v ?? '').toString();
  return (
    normalize(existingProduct.name) === normalize(mapped.name) &&
    normalize(existingProduct.brand) === normalize(mapped.brand) &&
    normalize(existingProduct.manufacturerPartNumber) === normalize(mapped.manufacturerPartNumber) &&
    normalize(existingProduct.category) === normalize(mapped.category) &&
    normalize(existingProduct.description) === normalize(mapped.description) &&
    normalize(existingProduct.source) === normalize(mapped.source)
  );
}

/**
 * Get Bill Hicks ADMIN-LEVEL FTP credentials from supported_vendors table
 * This is for the master catalog sync that runs system-wide
 */
async function getBillHicksFTPCredentials(): Promise<any> {
  console.log('🔍 GET BILL HICKS ADMIN CREDENTIALS: Starting admin credential lookup...');
  
  // Get Bill Hicks vendor ID
  const billHicksVendorId = await storage.getBillHicksVendorId();
  console.log('🔍 GET BILL HICKS ADMIN CREDENTIALS: billHicksVendorId:', billHicksVendorId);
  
  // Get the Bill Hicks supported vendor record with admin credentials
  const billHicksVendor = await storage.getSupportedVendorById(billHicksVendorId);
  
  if (!billHicksVendor) {
    console.log('❌ GET BILL HICKS ADMIN CREDENTIALS: Bill Hicks vendor not found');
    return null;
  }
  
  // Get admin credentials from the supported vendor
  const adminCredentials = billHicksVendor.adminCredentials;
  
  if (!adminCredentials) {
    console.log('❌ GET BILL HICKS ADMIN CREDENTIALS: No admin credentials configured');
    console.log('⚠️  Please configure admin credentials at: Admin > Supported Vendors > Bill Hicks');
    return null;
  }
  
  console.log('✅ GET BILL HICKS ADMIN CREDENTIALS: Found admin credentials');
  console.log('🔍 FTP Server:', adminCredentials.ftpServer || adminCredentials.ftp_server);
  console.log('🔍 FTP Username:', adminCredentials.ftpUsername || adminCredentials.ftp_username);
  console.log('🔍 FTP Password:', (adminCredentials.ftpPassword || adminCredentials.ftp_password) ? '[HIDDEN]' : 'null');
  
  // Map credentials (support both camelCase and snake_case)
  const result = {
    ftpServer: adminCredentials.ftpServer || adminCredentials.ftp_server,
    ftpUsername: adminCredentials.ftpUsername || adminCredentials.ftp_username,
    ftpPassword: adminCredentials.ftpPassword || adminCredentials.ftp_password,
    ftpPort: adminCredentials.ftpPort || adminCredentials.ftp_port || 21,
    ftpBasePath: adminCredentials.ftpBasePath || adminCredentials.ftp_base_path || '/'
  };
  
  // Validate required fields
  if (!result.ftpServer || !result.ftpUsername || !result.ftpPassword) {
    console.log('❌ GET BILL HICKS ADMIN CREDENTIALS: Missing required fields');
    console.log('   ftpServer:', result.ftpServer ? 'present' : 'MISSING');
    console.log('   ftpUsername:', result.ftpUsername ? 'present' : 'MISSING');
    console.log('   ftpPassword:', result.ftpPassword ? 'present' : 'MISSING');
    return null;
  }
  
  console.log('✅ GET BILL HICKS ADMIN CREDENTIALS: Returning valid admin credentials');
  return result;
}

/**
 * Download inventory file from Bill Hicks FTP
 */
async function downloadInventoryFile(credentials: any): Promise<string> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = new FTPClient();
    console.log(`📥 FTP Download attempt ${attempt}/${maxRetries}...`);
    
    try {
      // Parse and sanitize FTP host
      let host = credentials.ftpServer;
      let secure = false;
      
      try {
        const url = new URL(credentials.ftpServer);
        host = url.hostname;
        secure = url.protocol === 'ftps:';
      } catch {
        // Fallback: strip any protocol prefixes and trailing slashes
        host = credentials.ftpServer
          .replace(/^(https?|ftps?):\/\//, '')
          .replace(/\/+$/, '');
      }

      console.log(`🔗 Connecting to FTP host: ${host} (secure: ${secure})`);

      // Note: rely on library defaults for timeouts to avoid type issues

      // Track progress
      client.trackProgress(info => {
        console.log(`📊 FTP Progress: ${info.bytes} bytes transferred`);
      });

      const connectStart = Date.now();
      await client.access({
        host,
        user: credentials.ftpUsername,
        password: credentials.ftpPassword,
        secure
      });
      console.log(`✅ FTP Connected in ${Date.now() - connectStart}ms`);

      // Preflight checks
      console.log(`🔍 Checking file availability: ${FTP_INVENTORY_PATH}`);
      try {
        const fileSize = await client.size(FTP_INVENTORY_PATH);
        const lastMod = await client.lastMod(FTP_INVENTORY_PATH);
        console.log(`📄 File found: ${fileSize} bytes, modified ${lastMod}`);
      } catch (error) {
        console.log(`⚠️ Preflight check failed (file may not exist): ${error}`);
      }

      // Download inventory file to temporary location
      const tempFile = path.join(DOWNLOADS_DIR, `temp_inventory_${Date.now()}.csv`);
      console.log(`⬇️ Starting download to: ${tempFile}`);
      
      const downloadStart = Date.now();
      await client.downloadTo(tempFile, FTP_INVENTORY_PATH);
      console.log(`✅ Download completed in ${Date.now() - downloadStart}ms`);
      
      // Read content
      const content = readFileSync(tempFile, 'utf-8');
      console.log(`📋 File content loaded: ${content.length} characters`);
      return content;
      
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ FTP attempt ${attempt} failed:`, error);
      
      // Classify error type
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('530')) {
        console.error(`🔐 Authentication error (530) - check credentials`);
      } else if (errorMsg.includes('550')) {
        console.error(`📂 File not found (550) - check path: ${FTP_INVENTORY_PATH}`);
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNREFUSED')) {
        console.error(`🌐 Network connectivity issue`);
      }
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } finally {
      client.close();
    }
  }

  throw new Error(`FTP download failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Parse inventory CSV data
 */
function parseInventoryCSV(content: string): ProcessedInventoryItem[] {
  try {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      skip_records_with_error: true
    }) as BillHicksInventoryItem[];
    
    return records.map(record => ({
      vendorSku: record.Product?.trim() || '',
      upc: record.UPC?.trim() || '',
      quantityAvailable: parseInt(record['Qty Avail']) || 0
    })).filter(item => item.vendorSku && item.upc);
    
  } catch (error) {
    throw new Error(`Failed to parse inventory CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update inventory record in database
 */
async function updateInventoryRecord(item: ProcessedInventoryItem): Promise<{updated: boolean, isNew: boolean}> {
  // Skip items without vendor SKU
  if (!item.vendorSku) {
    return { updated: false, isNew: false };
  }

  const billHicksVendorId = await storage.getBillHicksVendorId();
  
  // Check if inventory record exists
  const [existingRecord] = await db.select()
    .from(vendorInventory)
    .where(
      and(
        eq(vendorInventory.supportedVendorId, billHicksVendorId),
        eq(vendorInventory.vendorSku, item.vendorSku)
      )
    );

  // If record doesn't exist, create it
  if (!existingRecord) {
    await db.insert(vendorInventory).values({
      supportedVendorId: billHicksVendorId,
      vendorSku: item.vendorSku,
      quantityAvailable: item.quantityAvailable,
      lastUpdated: new Date(),
      createdAt: new Date()
    });
    return { updated: true, isNew: true };
  }

  // Update existing record if quantity changed
  if (existingRecord.quantityAvailable !== item.quantityAvailable) {
    await db.update(vendorInventory)
      .set({
        quantityAvailable: item.quantityAvailable,
        lastUpdated: new Date()
      })
      .where(eq(vendorInventory.id, existingRecord.id));
    return { updated: true, isNew: false };
  }

  return { updated: false, isNew: false };
}

/**
 * OPTIMIZED: Line-by-line inventory differential detection
 * Only returns the actual changed inventory lines instead of a boolean
 */
async function detectInventoryChangedLines(newContent: string): Promise<{
  hasChanges: boolean;
  changedLines: string[];
  stats: {
    totalLines: number;
    changedLines: number;
    addedLines: number;
    removedLines: number;
  };
}> {
  const previousFile = path.join(DOWNLOADS_DIR, 'previous_inventory.csv');
  
  if (!existsSync(previousFile)) {
    console.log('📝 No previous inventory file found - processing all records (first inventory sync)');
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
    console.log(`🎯 INVENTORY OPTIMIZATION: Found ${stats.changedLines} changed inventory lines out of ${stats.totalLines} total lines`);
    console.log(`📊 Inventory Added: ${stats.addedLines}, Removed: ${stats.removedLines}`);
    console.log(`⚡ Processing only ${stats.changedLines} inventory records instead of ${stats.totalLines}! (${Math.round((1 - stats.changedLines / stats.totalLines) * 100)}% reduction)`);
  } else {
    console.log('✅ No inventory changes detected - sync will be skipped');
  }
  
  return {
    hasChanges,
    changedLines,
    stats
  };
}

/**
 * LEGACY: Simple inventory change detection using content hash (DEPRECATED)
 * This is kept for backward compatibility but should not be used
 */
async function detectInventoryChanges(newContent: string): Promise<boolean> {
  const result = await detectInventoryChangedLines(newContent);
  return result.hasChanges;
}

/**
 * Store current inventory content for future change detection
 */
async function storePreviousInventoryContent(content: string): Promise<void> {
  const previousFile = path.join(DOWNLOADS_DIR, 'previous_inventory.csv');
  writeFileSync(previousFile, content, 'utf-8');
}

/**
 * Store current content for future change detection
 */
async function storePreviousContent(content: string): Promise<void> {
  const previousFile = path.join(DOWNLOADS_DIR, 'previous_catalog.csv');
  writeFileSync(previousFile, content, 'utf-8');
}

/**
 * Update inventory sync status in supported_vendors table
 */
async function updateInventorySyncStatus(status: 'in_progress' | 'success' | 'error', stats: any, error?: string): Promise<void> {
  const billHicksVendorId = await storage.getBillHicksVendorId();
  const updateData: any = {
    billHicksInventorySyncStatus: status,
    updatedAt: new Date()
  };

  if (status === 'success') {
    updateData.billHicksLastInventorySync = new Date();
    updateData.billHicksInventorySyncError = null;
    updateData.billHicksInventoryTotalRecords = stats.totalRecords;
    updateData.billHicksInventoryRecordsAdded = stats.recordsAdded;
    updateData.billHicksInventoryRecordsFailed = stats.recordsErrors;
    
    // Update fields that the UI uses for last sync display
    updateData.billHicksLastSyncRecordsUpdated = stats.recordsUpdated;
    updateData.billHicksLastSyncRecordsSkipped = stats.recordsSkipped;
    updateData.billHicksLastSyncRecordsFailed = stats.recordsErrors;
  } else if (status === 'error') {
    updateData.billHicksInventorySyncError = error;
  }

  await db.update(supportedVendors)
    .set(updateData)
    .where(eq(supportedVendors.id, billHicksVendorId));
}

/**
 * Update sync status in supported_vendors table
 */
async function updateSyncStatus(status: 'in_progress' | 'success' | 'error', stats: any, error?: string): Promise<void> {
  const billHicksVendorId = await storage.getBillHicksVendorId();
  const updateData: any = {
    billHicksMasterCatalogSyncStatus: status,
    updatedAt: new Date()
  };

  if (status === 'success') {
    updateData.billHicksMasterCatalogLastSync = new Date();
    updateData.billHicksMasterCatalogSyncError = null;
    updateData.billHicksMasterCatalogTotalRecords = stats.totalRecords;
    updateData.billHicksMasterCatalogRecordsUpdated = stats.recordsUpdated;
    updateData.billHicksMasterCatalogRecordsSkipped = stats.recordsSkipped;
    updateData.billHicksMasterCatalogRecordsAdded = stats.recordsAdded;
    updateData.billHicksMasterCatalogRecordsFailed = stats.recordsErrors;
    
    // Update fields that the UI uses for last sync display
    updateData.billHicksLastSyncRecordsUpdated = stats.recordsUpdated;
    updateData.billHicksLastSyncRecordsSkipped = stats.recordsSkipped;
    updateData.billHicksLastSyncRecordsFailed = stats.recordsErrors;
  } else {
    updateData.billHicksMasterCatalogSyncError = error;
    // Set failure counts to 0 on error
    updateData.billHicksLastSyncRecordsUpdated = 0;
    updateData.billHicksLastSyncRecordsSkipped = 0;
    updateData.billHicksLastSyncRecordsFailed = 0;
  }

  await db.update(supportedVendors)
    .set(updateData)
    .where(eq(supportedVendors.id, billHicksVendorId));
}

/**
 * Bulk update inventory records for better performance
 * Replaces individual database operations with bulk operations
 */
async function bulkUpdateInventoryRecords(
  inventoryItems: ProcessedInventoryItem[], 
  stats: any
): Promise<{recordsUpdated: number, recordsAdded: number, recordsSkipped: number, recordsErrors: number}> {
  
  const billHicksVendorId = await storage.getBillHicksVendorId();
  
  // Step 1: Get all existing records in one query
  const existingRecords = await db.select()
    .from(vendorInventory)
    .where(eq(vendorInventory.supportedVendorId, billHicksVendorId));
  
  // Create a map for quick lookup
  const existingMap = new Map();
  existingRecords.forEach(record => {
    existingMap.set(record.vendorSku, record);
  });

  // Step 2: Process changes in memory
  const recordsToInsert: Array<{
    supportedVendorId: number;
    vendorSku: string;
    quantityAvailable: number;
    lastUpdated: Date;
    createdAt: Date;
  }> = [];
  const recordsToUpdate: Array<{
    id: number;
    quantityAvailable: number;
    lastUpdated: Date;
  }> = [];
  
  for (const item of inventoryItems) {
    if (!item.vendorSku) {
      stats.recordsSkipped++;
      continue;
    }
    
    const existingRecord = existingMap.get(item.vendorSku);
    
    if (!existingRecord) {
      // New record
      recordsToInsert.push({
        supportedVendorId: billHicksVendorId,
        vendorSku: item.vendorSku,
        quantityAvailable: item.quantityAvailable,
        lastUpdated: new Date(),
        createdAt: new Date()
      });
    } else if (existingRecord.quantityAvailable !== item.quantityAvailable) {
      // Changed record
      recordsToUpdate.push({
        id: existingRecord.id,
        quantityAvailable: item.quantityAvailable,
        lastUpdated: new Date()
      });
    } else {
      // No change
      stats.recordsSkipped++;
    }
  }

  // Step 3: Execute bulk operations
  if (recordsToInsert.length > 0) {
    await db.insert(vendorInventory).values(recordsToInsert);
    stats.recordsAdded += recordsToInsert.length;
  }
  
  if (recordsToUpdate.length > 0) {
    // Use a single bulk update query for better performance
    // Note: Drizzle doesn't support bulk updates directly, so we use a transaction
    await db.transaction(async (tx) => {
      for (const update of recordsToUpdate) {
        await tx.update(vendorInventory)
          .set({
            quantityAvailable: update.quantityAvailable,
            lastUpdated: update.lastUpdated
          })
          .where(eq(vendorInventory.id, update.id));
      }
    });
    stats.recordsUpdated += recordsToUpdate.length;
  }

  return {
    recordsUpdated: stats.recordsUpdated,
    recordsAdded: stats.recordsAdded,
    recordsSkipped: stats.recordsSkipped,
    recordsErrors: stats.recordsErrors
  };
}
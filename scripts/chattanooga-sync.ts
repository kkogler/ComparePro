#!/usr/bin/env tsx

/**
 * Chattanooga Catalog Sync - Standalone Script for Scheduled Deployment
 * 
 * This script performs daily Chattanooga catalog synchronization as a Replit Scheduled Deployment.
 * It extracts the sync logic from the internal cron system for more reliable scheduled execution.
 * 
 * Features:
 * - API-based catalog download from Chattanooga Shooting Supplies
 * - CSV parsing and product data import
 * - Priority-based product updates using vendor field mappings
 * - Comprehensive error handling and status tracking
 * - Support for both full and incremental syncs
 * 
 * Usage:
 *   tsx scripts/chattanooga-sync.ts [--dry-run] [--force] [--full]
 * 
 * Options:
 *   --dry-run   Show what would be synced without making changes
 *   --force     Force sync even if no changes detected
 *   --full      Perform full catalog sync instead of incremental
 *   --help      Show this help message
 */

import { storage } from '../server/storage.js';
import { ChattanoogaAPI } from '../server/chattanooga-api.js';
import { ChattanoogaCSVImporter } from '../server/chattanooga-csv-importer.js';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

// Chattanooga Configuration
const CACHE_DIR = join(process.cwd(), 'chattanooga-cache');
const CURRENT_CSV_PATH = join(CACHE_DIR, 'current-catalog.csv');
const PREVIOUS_CSV_PATH = join(CACHE_DIR, 'previous-catalog.csv');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

interface SyncOptions {
  dryRun: boolean;
  force: boolean;
  full: boolean;
  help: boolean;
}

interface SyncResult {
  success: boolean;
  message: string;
  productsProcessed: number;
  csvSize: number;
  newProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  errors: string[];
  warnings: string[];
  duration: number; // in seconds
}

interface ChattanoogaCredentials {
  accountNumber: string;
  username: string;
  password: string;
  sid: string;
  token: string;
}

class ChattanoogaSyncScript {
  private options: SyncOptions;

  constructor(args: string[]) {
    this.options = this.parseArguments(args);
  }

  private parseArguments(args: string[]): SyncOptions {
    const options: SyncOptions = {
      dryRun: false,
      force: false,
      full: false,
      help: false
    };

    for (const arg of args) {
      switch (arg) {
        case '--dry-run':
          options.dryRun = true;
          break;
        case '--force':
          options.force = true;
          break;
        case '--full':
          options.full = true;
          break;
        case '--help':
        case '-h':
          options.help = true;
          break;
      }
    }

    return options;
  }

  private showHelp(): void {
    console.log(`
Chattanooga Catalog Sync - Scheduled Deployment

Usage:
  tsx scripts/chattanooga-sync.ts [options]

Options:
  --dry-run   Show what would be synced without making database changes
  --force     Force sync even if no changes detected in CSV
  --full      Perform full catalog sync instead of incremental sync
  --help      Show this help message

Description:
  This script synchronizes the Chattanooga Shooting Supplies product catalog 
  with the master product database. By default, it performs an incremental sync, 
  only processing changes since the last successful sync.

  The script maintains full compatibility with the existing Chattanooga sync 
  system and updates the same database tables and status fields.

Examples:
  tsx scripts/chattanooga-sync.ts                    # Incremental sync
  tsx scripts/chattanooga-sync.ts --full             # Full catalog sync
  tsx scripts/chattanooga-sync.ts --dry-run          # Preview changes
  tsx scripts/chattanooga-sync.ts --full --dry-run   # Preview full sync
  tsx scripts/chattanooga-sync.ts --force            # Force sync regardless of changes
`);
  }

  async run(): Promise<void> {
    const startTime = Date.now();
    
    console.log('🚀 CHATTANOOGA SYNC DEPLOYMENT: Starting...');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`⚙️  Sync type: ${this.options.full ? 'FULL' : 'INCREMENTAL'}`);
    console.log(`🔍 Dry run: ${this.options.dryRun ? 'YES' : 'NO'}`);
    console.log(`🔄 Force sync: ${this.options.force ? 'YES' : 'NO'}`);

    if (this.options.help) {
      this.showHelp();
      return;
    }

    try {
      // Step 1: Validate Chattanooga vendor configuration
      const vendor = await this.validateChattanoogaVendor();
      if (!vendor) {
        throw new Error('Chattanooga vendor not properly configured');
      }

      // Step 2: Check for stuck sync status and reset if needed
      await this.checkAndResetSyncStatus(vendor);

      // Step 3: Update status to indicate sync is in progress (if not dry run)
      if (!this.options.dryRun) {
        await storage.updateSupportedVendor(vendor.id, {
          chattanoogaCsvSyncStatus: 'in_progress'
        });
        console.log('✅ CHATTANOOGA SYNC: Status updated to "in_progress"');
      }

      // Step 4: Perform the sync
      const result = await this.performSync(vendor);

      // Step 5: Update sync status based on results (if not dry run)
      if (!this.options.dryRun) {
        await this.updateSyncStatus(vendor.id, result);
      }

      // Step 6: Log final results
      this.logResults(result);

      // Exit with appropriate code
      process.exit(result.success ? 0 : 1);

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.error(`❌ CHATTANOOGA SYNC DEPLOYMENT: Failed after ${duration} seconds:`, error);
      
      // Update status with error (if not dry run)
      if (!this.options.dryRun) {
        try {
          const vendor = await this.getChattanoogaVendor();
          if (vendor) {
            await storage.updateSupportedVendor(vendor.id, {
              chattanoogaCsvSyncStatus: 'error',
              chattanoogaCsvSyncError: `Scheduled deployment failed: ${(error as Error).message}`
            });
          }
        } catch (statusError) {
          console.error('❌ Failed to update error status:', statusError);
        }
      }

      process.exit(1);
    }
  }

  private async validateChattanoogaVendor(): Promise<any> {
    console.log('🔍 CHATTANOOGA SYNC: Validating vendor configuration...');
    
    const supportedVendors = await storage.getAllSupportedVendors();
    const chattanooga = supportedVendors.find(v => v.name.toLowerCase().includes('chattanooga'));
    
    if (!chattanooga) {
      throw new Error('Chattanooga vendor not found in supported vendors');
    }

    if (!chattanooga.adminCredentials) {
      throw new Error('Chattanooga admin credentials not configured');
    }

    // Validate credential structure
    const creds = chattanooga.adminCredentials as ChattanoogaCredentials;
    if (!creds.sid || !creds.token) {
      throw new Error('Chattanooga credentials are incomplete (missing sid or token)');
    }

    console.log(`✅ CHATTANOOGA SYNC: Vendor validated (ID: ${chattanooga.id})`);
    console.log(`📋 CHATTANOOGA SYNC: SID: ${creds.sid.substring(0, 8)}...`);
    console.log(`🔐 CHATTANOOGA SYNC: Token: ${creds.token.substring(0, 8)}...`);
    
    return chattanooga;
  }

  private async getChattanoogaVendor(): Promise<any> {
    const supportedVendors = await storage.getAllSupportedVendors();
    return supportedVendors.find(v => v.name.toLowerCase().includes('chattanooga'));
  }

  private async checkAndResetSyncStatus(vendor: any): Promise<void> {
    if (vendor.chattanoogaCsvSyncStatus === 'in_progress') {
      console.log('🚨 CHATTANOOGA SYNC: Found sync stuck "in_progress" - resetting status');
      
      if (!this.options.dryRun) {
        await storage.updateSupportedVendor(vendor.id, {
          chattanoogaCsvSyncStatus: 'error',
          chattanoogaCsvSyncError: 'Previous sync was interrupted - auto-recovered by scheduled deployment'
        });
        console.log('✅ CHATTANOOGA SYNC: Reset stuck status to "error"');
      } else {
        console.log('🔍 CHATTANOOGA SYNC: [DRY RUN] Would reset stuck status');
      }
    }

    // Log last sync information
    if (vendor.lastCatalogSync) {
      const lastSync = new Date(vendor.lastCatalogSync);
      const now = new Date();
      const hoursSinceLastSync = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60));
      
      console.log(`📊 CHATTANOOGA SYNC: Last sync was ${hoursSinceLastSync} hours ago (${lastSync.toLocaleString()})`);
      
      if (hoursSinceLastSync >= 25) {
        console.log('⚠️  CHATTANOOGA SYNC: Over 25 hours since last sync - this sync is needed');
      }
    } else {
      console.log('📊 CHATTANOOGA SYNC: No previous sync found - will perform full sync');
    }
  }

  private async performSync(vendor: any): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 CHATTANOOGA SYNC: Starting ${this.options.full ? 'full' : 'incremental'} sync...`);
      
      // Step 1: Download CSV from Chattanooga API
      const csvResult = await this.downloadCatalogCSV(vendor.adminCredentials);
      if (!csvResult.success) {
        return {
          success: false,
          message: `Failed to download catalog: ${csvResult.error}`,
          productsProcessed: 0,
          csvSize: 0,
          newProducts: 0,
          updatedProducts: 0,
          skippedProducts: 0,
          errors: [csvResult.error || 'Unknown download error'],
          warnings: [],
          duration: Math.round((Date.now() - startTime) / 1000)
        };
      }

      // Step 2: Check for changes (unless force or full sync)
      if (!this.options.force && !this.options.full && csvResult.csvData) {
        const hasChanges = await this.checkForChanges(csvResult.csvData);
        if (!hasChanges) {
          // Even when no changes are detected, we still processed the file
          // Count products to get actual record count for proper stats
          const lines = csvResult.csvData.split('\n').filter(line => line.trim());
          const productCount = Math.max(0, lines.length - 1); // Subtract header
          
          console.log('📋 CHATTANOOGA SYNC: No changes detected in CSV - skipping import');
          return {
            success: true,
            message: 'No changes detected - sync skipped',
            productsProcessed: productCount,  // ← FIXED: Show actual product count
            csvSize: csvResult.csvSize || 0,
            newProducts: 0,
            updatedProducts: 0,
            skippedProducts: productCount,    // ← FIXED: All products were skipped due to no changes
            errors: [],
            warnings: ['No changes detected in catalog'],
            duration: Math.round((Date.now() - startTime) / 1000)
          };
        }
      }

      // Step 3: Save CSV files for comparison
      if (!this.options.dryRun && csvResult.csvData) {
        await this.saveCsvFiles(csvResult.csvData);
      }

      // Step 4: Import CSV data
      let importResult = { imported: 0, skipped: 0, errors: [] as string[] };
      
      if (!this.options.dryRun) {
        console.log('🔄 CHATTANOOGA SYNC: Starting product import...');
        importResult = await ChattanoogaCSVImporter.importFromCSV(CURRENT_CSV_PATH);
      } else {
        console.log('🔍 CHATTANOOGA SYNC: [DRY RUN] Would import CSV data');
        // For dry run, parse CSV to get product count
        if (csvResult.csvData) {
          const lines = csvResult.csvData.split('\n').filter(line => line.trim());
          importResult.imported = Math.max(0, lines.length - 1); // Subtract header
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      return {
        success: true,
        message: `Sync completed successfully`,
        productsProcessed: importResult.imported,
        csvSize: csvResult.csvSize || 0,
        newProducts: importResult.imported, // Simplified - could enhance to track new vs updated
        updatedProducts: 0,
        skippedProducts: importResult.skipped,
        errors: importResult.errors,
        warnings: [],
        duration
      };

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      return {
        success: false,
        message: `Sync failed: ${(error as Error).message}`,
        productsProcessed: 0,
        csvSize: 0,
        newProducts: 0,
        updatedProducts: 0,
        skippedProducts: 0,
        errors: [(error as Error).message],
        warnings: [],
        duration
      };
    }
  }

  private async downloadCatalogCSV(credentials: ChattanoogaCredentials): Promise<{
    success: boolean;
    csvData?: string;
    csvSize?: number;
    error?: string;
  }> {
    try {
      console.log('📥 CHATTANOOGA SYNC: Downloading catalog CSV...');

      // Create API client with credentials
      const api = new ChattanoogaAPI({
        accountNumber: credentials.accountNumber || '',
        username: credentials.username || '',
        password: credentials.password || '',
        sid: credentials.sid,
        token: credentials.token
      });

      // Simple retry logic (max 3 attempts)
      let attempt = 0;
      let productFeedResult;
      
      while (attempt < 3) {
        attempt++;
        console.log(`📥 CHATTANOOGA SYNC: Attempting to get product feed (attempt ${attempt}/3)`);
        
        productFeedResult = await api.getProductFeed();
        
        if (productFeedResult.success && productFeedResult.data) {
          break;
        }
        
        if (attempt < 3) {
          const delay = attempt === 1 ? 5000 : 10000; // 5s first retry, 10s second retry
          console.log(`📥 CHATTANOOGA SYNC: Attempt ${attempt} failed, retrying in ${delay/1000} seconds...`);
          console.log(`📥 CHATTANOOGA SYNC: Error: ${productFeedResult?.message || 'Unknown error'}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!productFeedResult?.success || !productFeedResult.data) {
        const errorMsg = `Failed to get product feed after 3 attempts. Last error: ${productFeedResult?.message || 'Unknown error'}`;
        return { success: false, error: errorMsg };
      }

      // Process the CSV data  
      const csvData = typeof productFeedResult.data === 'string' 
        ? productFeedResult.data 
        : String(productFeedResult.data);
      const csvSize = csvData.length;
      
      // Count products (lines minus header)
      const lines = csvData.split('\n').filter(line => line.trim());
      const productCount = Math.max(0, lines.length - 1); // Subtract header
      
      console.log(`✅ CHATTANOOGA SYNC: Downloaded CSV with ${productCount} products (${(csvSize / 1024 / 1024).toFixed(2)} MB)`);

      return {
        success: true,
        csvData,
        csvSize
      };

    } catch (error) {
      const errorMsg = `CSV download failed: ${(error as Error).message}`;
      console.error('📥 CHATTANOOGA SYNC:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  private async checkForChanges(csvData: string): Promise<boolean> {
    try {
      // Check if previous CSV exists
      if (!existsSync(PREVIOUS_CSV_PATH)) {
        console.log('📋 CHATTANOOGA SYNC: No previous CSV found - changes detected');
        return true;
      }

      // Read previous CSV
      const previousCsv = readFileSync(PREVIOUS_CSV_PATH, 'utf-8');

      // Compare file hashes for quick change detection
      const currentHash = crypto.createHash('md5').update(csvData).digest('hex');
      const previousHash = crypto.createHash('md5').update(previousCsv).digest('hex');

      if (currentHash === previousHash) {
        console.log('📋 CHATTANOOGA SYNC: CSV content unchanged (hash match)');
        return false;
      }

      // Basic line count comparison
      const currentLines = csvData.split('\n').length;
      const previousLines = previousCsv.split('\n').length;
      const lineDiff = Math.abs(currentLines - previousLines);

      console.log(`📋 CHATTANOOGA SYNC: Changes detected - hash mismatch, line difference: ${lineDiff}`);
      return true;

    } catch (error) {
      console.log(`📋 CHATTANOOGA SYNC: Error checking for changes: ${(error as Error).message} - assuming changes exist`);
      return true;
    }
  }

  private async saveCsvFiles(csvData: string): Promise<void> {
    try {
      // Move current to previous (if it exists)
      if (existsSync(CURRENT_CSV_PATH)) {
        const currentCsv = readFileSync(CURRENT_CSV_PATH, 'utf-8');
        writeFileSync(PREVIOUS_CSV_PATH, currentCsv);
        console.log('📁 CHATTANOOGA SYNC: Backed up previous CSV');
      }

      // Save new CSV as current
      writeFileSync(CURRENT_CSV_PATH, csvData);
      console.log('📁 CHATTANOOGA SYNC: Saved new CSV');

    } catch (error) {
      console.error(`📁 CHATTANOOGA SYNC: Error saving CSV files: ${(error as Error).message}`);
      // Don't fail the sync for file save errors
    }
  }

  private async updateSyncStatus(vendorId: number, result: SyncResult): Promise<void> {
    const updateData: any = {
      lastCatalogSync: new Date()
    };

    if (result.success) {
      updateData.chattanoogaCsvSyncStatus = 'success';
      updateData.chattanoogaCsvSyncError = null;
      updateData.chattanoogaTotalRecords = result.productsProcessed;
      updateData.chattanoogaRecordsUpdated = result.updatedProducts;
      updateData.chattanoogaRecordsAdded = result.newProducts;
      updateData.chattanoogaRecordsSkipped = result.skippedProducts;
      updateData.chattanoogaRecordsFailed = result.errors.length;
      updateData.chattanoogaLastCsvDownload = new Date();
      updateData.chattanoogaLastCsvSize = result.csvSize;
      
      console.log('✅ CHATTANOOGA SYNC: Updating status to success');
    } else {
      updateData.chattanoogaCsvSyncStatus = 'error';
      updateData.chattanoogaCsvSyncError = `Scheduled deployment failed: ${result.message}`;
      
      console.log('❌ CHATTANOOGA SYNC: Updating status to error');
    }

    try {
      await storage.updateSupportedVendor(vendorId, updateData);
      console.log('✅ CHATTANOOGA SYNC: Database status updated');
    } catch (error) {
      console.error('❌ CHATTANOOGA SYNC: Failed to update database status:', error);
    }
  }

  private logResults(result: SyncResult): void {
    console.log('\n📊 CHATTANOOGA SYNC DEPLOYMENT: Results Summary');
    console.log('===============================================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`⏱️  Duration: ${result.duration} seconds`);
    console.log(`📦 Products processed: ${result.productsProcessed}`);
    console.log(`🆕 New products: ${result.newProducts}`);
    console.log(`🔄 Updated products: ${result.updatedProducts}`);
    console.log(`⏭️  Skipped products: ${result.skippedProducts}`);
    console.log(`📁 CSV size: ${(result.csvSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.slice(0, 10).forEach(error => console.log(`   • ${error}`));
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more errors`);
      }
    }
    
    console.log(`\n🏁 CHATTANOOGA SYNC DEPLOYMENT: ${result.success ? 'COMPLETED' : 'FAILED'}`);
    console.log(`📅 Finished at: ${new Date().toISOString()}`);
  }
}

// Script entry point
async function main() {
  const args = process.argv.slice(2);
  const script = new ChattanoogaSyncScript(args);
  await script.run();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ CHATTANOOGA SYNC DEPLOYMENT: Script failed:', error);
    process.exit(1);
  });
}

export { ChattanoogaSyncScript };
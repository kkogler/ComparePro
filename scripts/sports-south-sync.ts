#!/usr/bin/env tsx

/**
 * Sports South Catalog Sync - Standalone Script for Scheduled Deployment
 * 
 * This script performs daily Sports South catalog synchronization as a Replit Scheduled Deployment.
 * It extracts the sync logic from the internal cron system for more reliable scheduled execution.
 * 
 * Usage:
 *   tsx scripts/sports-south-sync.ts [--full] [--dry-run]
 * 
 * Options:
 *   --full      Perform full catalog sync instead of incremental
 *   --dry-run   Show what would be synced without making changes
 *   --help      Show this help message
 */

import { storage } from '../server/storage.js';
import { SportsSouthCatalogSyncService } from '../server/sports-south-catalog-sync.js';
import { RETAIL_VERTICALS } from '../shared/retail-vertical-config.js';
import { DEFAULT_SPORTS_SOUTH_SYNC_SETTINGS } from '../shared/sports-south-sync-config.js';

interface SyncOptions {
  fullSync: boolean;
  dryRun: boolean;
  help: boolean;
}

interface SyncResult {
  success: boolean;
  message: string;
  productsProcessed: number;
  newProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  errors: string[];
  warnings: string[];
  duration: number; // in seconds
}

class SportsSouthSyncScript {
  private options: SyncOptions;

  constructor(args: string[]) {
    this.options = this.parseArguments(args);
  }

  private parseArguments(args: string[]): SyncOptions {
    const options: SyncOptions = {
      fullSync: false,
      dryRun: false,
      help: false
    };

    for (const arg of args) {
      switch (arg) {
        case '--full':
          options.fullSync = true;
          break;
        case '--dry-run':
          options.dryRun = true;
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
Sports South Catalog Sync - Scheduled Deployment

Usage:
  tsx scripts/sports-south-sync.ts [options]

Options:
  --full      Perform full catalog sync instead of incremental sync
  --dry-run   Show what would be synced without making database changes
  --help      Show this help message

Description:
  This script synchronizes the Sports South product catalog with the master 
  product database. By default, it performs an incremental sync, only 
  processing products that have been updated since the last sync.

  The script maintains full compatibility with the existing Sports South 
  sync system and updates the same database tables and status fields.

Examples:
  tsx scripts/sports-south-sync.ts                    # Incremental sync
  tsx scripts/sports-south-sync.ts --full             # Full catalog sync
  tsx scripts/sports-south-sync.ts --dry-run          # Preview changes
  tsx scripts/sports-south-sync.ts --full --dry-run   # Preview full sync
`);
  }

  async run(): Promise<void> {
    const startTime = Date.now();
    
    console.log('🚀 SPORTS SOUTH SYNC DEPLOYMENT: Starting...');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`⚙️  Sync type: ${this.options.fullSync ? 'FULL' : 'INCREMENTAL'}`);
    console.log(`🔍 Dry run: ${this.options.dryRun ? 'YES' : 'NO'}`);

    if (this.options.help) {
      this.showHelp();
      return;
    }

    try {
      // Step 1: Validate Sports South vendor configuration
      const vendor = await this.validateSportsSouthVendor();
      if (!vendor) {
        throw new Error('Sports South vendor not properly configured');
      }

      // Step 2: Check for stuck sync status and reset if needed
      await this.checkAndResetSyncStatus(vendor);

      // Step 3: Update status to indicate sync is in progress (if not dry run)
      if (!this.options.dryRun) {
        await storage.updateSupportedVendor(vendor.id, {
          catalogSyncStatus: 'in_progress'
        });
        console.log('✅ SPORTS SOUTH SYNC: Status updated to "in_progress"');
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
      console.error(`❌ SPORTS SOUTH SYNC DEPLOYMENT: Failed after ${duration} seconds:`, error);
      
      // Update status with error (if not dry run)
      if (!this.options.dryRun) {
        try {
          const vendor = await this.getSportsSouthVendor();
          if (vendor) {
            await storage.updateSupportedVendor(vendor.id, {
              catalogSyncStatus: 'error',
              catalogSyncError: `Scheduled deployment failed: ${(error as Error).message}`
            });
          }
        } catch (statusError) {
          console.error('❌ Failed to update error status:', statusError);
        }
      }

      process.exit(1);
    }
  }

  private async validateSportsSouthVendor(): Promise<any> {
    console.log('🔍 SPORTS SOUTH SYNC: Validating vendor configuration...');
    
    const supportedVendors = await storage.getAllSupportedVendors();
    const sportsSouth = supportedVendors.find(v => v.name.toLowerCase().includes('sports south'));
    
    if (!sportsSouth) {
      throw new Error('Sports South vendor not found in supported vendors');
    }

    if (!sportsSouth.adminCredentials) {
      throw new Error('Sports South admin credentials not configured');
    }

    // Validate credential structure
    const creds = sportsSouth.adminCredentials as any;
    if (!creds.userName || !creds.customerNumber || !creds.password) {
      throw new Error('Sports South credentials are incomplete (missing userName, customerNumber, or password)');
    }

    console.log(`✅ SPORTS SOUTH SYNC: Vendor validated (ID: ${sportsSouth.id})`);
    console.log(`📋 SPORTS SOUTH SYNC: Customer Number: ${creds.customerNumber}`);
    console.log(`👤 SPORTS SOUTH SYNC: Username: ${creds.userName}`);
    
    return sportsSouth;
  }

  private async getSportsSouthVendor(): Promise<any> {
    const supportedVendors = await storage.getAllSupportedVendors();
    return supportedVendors.find(v => v.name.toLowerCase().includes('sports south'));
  }

  private async checkAndResetSyncStatus(vendor: any): Promise<void> {
    if (vendor.catalogSyncStatus === 'in_progress') {
      console.log('🚨 SPORTS SOUTH SYNC: Found sync stuck "in_progress" - resetting status');
      
      if (!this.options.dryRun) {
        await storage.updateSupportedVendor(vendor.id, {
          catalogSyncStatus: 'error',
          catalogSyncError: 'Previous sync was interrupted - auto-recovered by scheduled deployment'
        });
        console.log('✅ SPORTS SOUTH SYNC: Reset stuck status to "error"');
      } else {
        console.log('🔍 SPORTS SOUTH SYNC: [DRY RUN] Would reset stuck status');
      }
    }

    // Log last sync information
    if (vendor.lastCatalogSync) {
      const lastSync = new Date(vendor.lastCatalogSync);
      const now = new Date();
      const hoursSinceLastSync = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60));
      
      console.log(`📊 SPORTS SOUTH SYNC: Last sync was ${hoursSinceLastSync} hours ago (${lastSync.toLocaleString()})`);
      
      if (hoursSinceLastSync >= 25) {
        console.log('⚠️  SPORTS SOUTH SYNC: Over 25 hours since last sync - this sync is needed');
      }
    } else {
      console.log('📊 SPORTS SOUTH SYNC: No previous sync found - will perform full sync');
    }
  }

  private async performSync(vendor: any): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 SPORTS SOUTH SYNC: Starting ${this.options.fullSync ? 'full' : 'incremental'} sync...`);
      
      // Create catalog sync service instance
      const catalogSync = new SportsSouthCatalogSyncService(
        vendor.adminCredentials as any,
        RETAIL_VERTICALS.FIREARMS.id,
        DEFAULT_SPORTS_SOUTH_SYNC_SETTINGS
      );

      // Perform the sync
      const syncResult = this.options.fullSync 
        ? await catalogSync.performFullCatalogSync()
        : await catalogSync.performIncrementalSync();

      const duration = Math.round((Date.now() - startTime) / 1000);

      return {
        ...syncResult,
        duration
      };

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      return {
        success: false,
        message: `Sync failed: ${(error as Error).message}`,
        productsProcessed: 0,
        newProducts: 0,
        updatedProducts: 0,
        skippedProducts: 0,
        errors: [(error as Error).message],
        warnings: [],
        duration
      };
    }
  }

  private async updateSyncStatus(vendorId: number, result: SyncResult): Promise<void> {
    const updateData: any = {
      lastCatalogSync: new Date()
    };

    if (result.success) {
      updateData.catalogSyncStatus = 'success';
      updateData.catalogSyncError = null;
      console.log('✅ SPORTS SOUTH SYNC: Status updated to "success"');
    } else {
      updateData.catalogSyncStatus = 'error';
      updateData.catalogSyncError = `Sync completed with ${result.errors.length} errors. ${result.message}`;
      console.log('❌ SPORTS SOUTH SYNC: Status updated to "error"');
    }

    await storage.updateSupportedVendor(vendorId, updateData);
  }

  private logResults(result: SyncResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SPORTS SOUTH SYNC DEPLOYMENT: FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Success: ${result.success ? 'YES' : 'NO'}`);
    console.log(`⏱️  Duration: ${result.duration} seconds`);
    console.log(`📦 Products Processed: ${result.productsProcessed}`);
    console.log(`🆕 New Products: ${result.newProducts}`);
    console.log(`🔄 Updated Products: ${result.updatedProducts}`);
    console.log(`⏭️  Skipped Products: ${result.skippedProducts}`);
    console.log(`❌ Errors: ${result.errors.length}`);
    console.log(`⚠️  Warnings: ${result.warnings.length}`);
    console.log(`💬 Message: ${result.message}`);
    
    if (result.errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      result.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    console.log('\n🎯 SPORTS SOUTH SYNC DEPLOYMENT: Completed');
    console.log(`📅 Finished at: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
  }
}

// Main execution
async function main(): Promise<void> {
  const script = new SportsSouthSyncScript(process.argv.slice(2));
  await script.run();
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ SPORTS SOUTH SYNC: Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ SPORTS SOUTH SYNC: Uncaught Exception:', error);
  process.exit(1);
});

// Run the script (ESM compatible check)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ SPORTS SOUTH SYNC: Script failed:', error);
    process.exit(1);
  });
}
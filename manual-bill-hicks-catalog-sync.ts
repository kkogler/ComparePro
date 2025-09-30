#!/usr/bin/env tsx

/**
 * Manual Bill Hicks Catalog Sync
 * 
 * This script can be run manually to sync Bill Hicks catalog
 * when Replit Scheduled Deployments are not available.
 */

import { storage } from './server/storage.js';
import { runBillHicksSimpleSync } from './server/bill-hicks-simple-sync.js';

async function manualCatalogSync() {
  console.log('🔄 Starting manual Bill Hicks catalog sync...');
  console.log('⏰ Time:', new Date().toISOString());
  
  try {
    // Get Bill Hicks vendor
    const vendors = await storage.getAllSupportedVendors();
    const billHicksVendor = vendors.find(v => v.name.toLowerCase().includes('bill hicks'));
    
    if (!billHicksVendor) {
      console.error('❌ Bill Hicks vendor not found');
      process.exit(1);
    }
    
    console.log(`📋 Found Bill Hicks vendor: ${billHicksVendor.name} (ID: ${billHicksVendor.id})`);
    
    // Check if FTP credentials are configured
    if (!billHicksVendor.adminCredentials?.ftpServer) {
      console.error('❌ Bill Hicks FTP credentials not configured');
      console.log('💡 Please configure FTP credentials in your admin panel first');
      process.exit(1);
    }
    
    console.log('✅ FTP credentials configured');
    
    // Run the catalog sync
    console.log('🚀 Starting catalog sync...');
    const result = await runBillHicksSimpleSync();
    
    if (result.success) {
      console.log('✅ Catalog sync completed successfully!');
      console.log(`📊 Records added: ${result.stats.recordsAdded}`);
      console.log(`📊 Records updated: ${result.stats.recordsUpdated}`);
      console.log(`📊 Records skipped: ${result.stats.recordsSkipped}`);
      console.log(`📊 Records failed: ${result.stats.recordsErrors}`);
      console.log(`📊 Total records: ${result.stats.totalRecords}`);
      console.log(`💬 Message: ${result.message}`);
    } else {
      console.error('❌ Catalog sync failed!');
      console.error(`💬 Error: ${result.message}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    process.exit(1);
  }
}

// Run the sync
manualCatalogSync()
  .then(() => {
    console.log('\n🏁 Manual Bill Hicks catalog sync completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

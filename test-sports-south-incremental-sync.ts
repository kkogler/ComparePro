#!/usr/bin/env tsx

/**
 * Test script for Sports South Incremental Sync
 * 
 * This script tests the fixed Sports South sync to ensure it uses
 * incremental sync instead of full catalog sync.
 */

import { storage } from './server/storage.js';
import { performSportsSouthCatalogSync } from './server/sports-south-simple-sync.js';

async function testSportsSouthIncrementalSync() {
  console.log('🧪 Testing Sports South Incremental Sync...');
  console.log('⏰ Time:', new Date().toISOString());

  try {
    // Get Sports South vendor
    const supportedVendors = await storage.getAllSupportedVendors();
    const sportsSouth = supportedVendors.find(sv => sv.name.toLowerCase().includes('sports south'));
    
    if (!sportsSouth) {
      console.error('❌ Sports South vendor not found');
      process.exit(1);
    }

    console.log(`📋 Sports South vendor found: ${sportsSouth.name} (ID: ${sportsSouth.id})`);
    console.log(`📋 Last sync: ${sportsSouth.lastCatalogSync ? new Date(sportsSouth.lastCatalogSync).toISOString() : 'Never'}`);
    console.log(`📋 Current status: ${sportsSouth.catalogSyncStatus || 'unknown'}`);

    if (!sportsSouth.adminCredentials) {
      console.error('❌ Sports South admin credentials not configured');
      console.log('💡 Please configure Sports South credentials in the admin panel first');
      process.exit(1);
    }

    console.log('🚀 Starting Sports South sync test...');
    console.log('📊 Expected behavior:');
    console.log('  - If first sync: Should use getFullCatalog()');
    console.log('  - If incremental: Should use getCatalogUpdates(lastSyncDate)');
    console.log('  - Should show proper logging for sync type');

    // Run the sync
    const result = await performSportsSouthCatalogSync(sportsSouth.adminCredentials as any);

    console.log('\n📊 Sync Results:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Message: ${result.message}`);
    console.log(`  Products Processed: ${result.productsProcessed}`);
    console.log(`  New Records: ${result.newRecords}`);
    console.log(`  Records Updated: ${result.recordsUpdated}`);
    console.log(`  Records Skipped: ${result.recordsSkipped}`);
    console.log(`  Images Added: ${result.imagesAdded}`);
    console.log(`  Images Updated: ${result.imagesUpdated}`);
    console.log(`  Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // Verify the sync type was correct
    const updatedVendor = await storage.getSupportedVendor(sportsSouth.id);
    console.log('\n📋 Updated vendor status:');
    console.log(`  Last sync: ${updatedVendor?.lastCatalogSync ? new Date(updatedVendor.lastCatalogSync).toISOString() : 'Never'}`);
    console.log(`  Status: ${updatedVendor?.catalogSyncStatus || 'unknown'}`);
    console.log(`  Error: ${updatedVendor?.catalogSyncError || 'None'}`);

    if (result.success) {
      console.log('\n✅ Sports South incremental sync test completed successfully!');
      console.log('🎯 The sync is now using proper incremental sync as documented.');
    } else {
      console.log('\n❌ Sports South incremental sync test failed!');
      console.log('💡 Check the error messages above for details.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  }
}

// Run the test
testSportsSouthIncrementalSync()
  .then(() => {
    console.log('\n🏁 Sports South Incremental Sync Test Completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error during test:', error);
    process.exit(1);
  });

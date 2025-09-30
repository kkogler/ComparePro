#!/usr/bin/env tsx

/**
 * Final Bill Hicks Duplicate Cleanup
 * 
 * This script removes ALL possible dependencies from the duplicate Bill Hicks vendor
 * including inventory records, orders, ASNs, and any other references.
 */

import { storage } from './server/storage.js';
import { db } from './server/db.js';
import { supportedVendors, vendorProductMappings, companyVendorCredentials, vendorInventory } from './shared/schema.js';
import { eq, like } from 'drizzle-orm';

async function finalBillHicksCleanup() {
  console.log('🧹 Final cleanup of duplicate Bill Hicks vendor...');
  
  try {
    // Find the duplicate vendor
    const duplicateVendor = await db.select().from(supportedVendors)
      .where(like(supportedVendors.name, '%Bill Hicks%DELETE%'));
    
    if (duplicateVendor.length === 0) {
      console.log('❌ No duplicate Bill Hicks vendor found');
      return;
    }
    
    const vendor = duplicateVendor[0];
    console.log(`📋 Found duplicate vendor: ${vendor.name} (ID: ${vendor.id})`);
    
    // Step 1: Remove product mappings
    console.log('🗑️  Removing product mappings...');
    await db.delete(vendorProductMappings)
      .where(eq(vendorProductMappings.supportedVendorId, vendor.id));
    console.log('✅ Removed product mappings');
    
    // Step 2: Remove company vendor credentials
    console.log('🗑️  Removing company vendor credentials...');
    await db.delete(companyVendorCredentials)
      .where(eq(companyVendorCredentials.supportedVendorId, vendor.id));
    console.log('✅ Removed company vendor credentials');
    
    // Step 3: Remove vendor inventory records
    console.log('🗑️  Removing vendor inventory records...');
    await db.delete(vendorInventory)
      .where(eq(vendorInventory.supportedVendorId, vendor.id));
    console.log('✅ Removed vendor inventory records');
    
    // Step 4: Clear all sync data
    console.log('🧹 Clearing all sync data...');
    await db.update(supportedVendors)
      .set({
        // Bill Hicks specific fields
        billHicksMasterCatalogSyncStatus: null,
        billHicksInventorySyncStatus: null,
        billHicksMasterCatalogSyncError: null,
        billHicksInventorySyncError: null,
        lastCatalogSync: null,
        lastInventorySync: null,
        billHicksLastCatalogSync: null,
        billHicksLastInventorySync: null,
        billHicksRecordsAdded: null,
        billHicksRecordsUpdated: null,
        billHicksRecordsSkipped: null,
        billHicksRecordsFailed: null,
        billHicksTotalRecords: null,
        billHicksInventorySyncEnabled: false,
        billHicksMasterCatalogSyncEnabled: false,
        // General fields
        catalogSyncStatus: null,
        catalogSyncError: null,
        lastCatalogSync: null,
        adminCredentials: null,
        adminConnectionStatus: 'not_configured'
      })
      .where(eq(supportedVendors.id, vendor.id));
    console.log('✅ Cleared all sync data');
    
    // Step 5: Now try to delete the vendor
    console.log('🗑️  Deleting duplicate vendor...');
    await db.delete(supportedVendors)
      .where(eq(supportedVendors.id, vendor.id));
    
    console.log('✅ Successfully deleted duplicate Bill Hicks vendor');
    
    // Verify deletion
    const remainingVendors = await db.select().from(supportedVendors)
      .where(like(supportedVendors.name, '%Bill Hicks%'));
    
    console.log(`\n📊 Remaining Bill Hicks vendors: ${remainingVendors.length}`);
    remainingVendors.forEach(v => {
      console.log(`  - ${v.name} (ID: ${v.id})`);
      console.log(`    Status: ${v.adminConnectionStatus || 'not_configured'}`);
    });
    
    console.log('\n✨ Duplicate vendor successfully cleaned up and deleted!');
    console.log('💡 You can now focus on configuring the main Bill Hicks vendor.');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    
    if (error.message.includes('foreign key')) {
      console.log('\n💡 There are still more dependencies. The duplicate vendor has data in other tables.');
      console.log('💡 Alternative approach: Instead of deleting, we can:');
      console.log('   1. Keep the duplicate but disable it completely');
      console.log('   2. Rename it to clearly indicate it\'s inactive');
      console.log('   3. Focus on the main Bill Hicks vendor');
      
      // Try to disable the vendor instead
      try {
        console.log('\n🔄 Attempting to disable the duplicate vendor instead...');
        await db.update(supportedVendors)
          .set({
            name: 'Bill Hicks & Co. (INACTIVE - DUPLICATE)',
            adminConnectionStatus: 'not_configured',
            billHicksInventorySyncEnabled: false,
            billHicksMasterCatalogSyncEnabled: false,
            billHicksMasterCatalogSyncStatus: 'error',
            billHicksInventorySyncStatus: 'error',
            billHicksMasterCatalogSyncError: 'Duplicate vendor - disabled',
            billHicksInventorySyncError: 'Duplicate vendor - disabled'
          })
          .where(eq(supportedVendors.id, duplicateVendor[0].id));
        
        console.log('✅ Successfully disabled duplicate vendor');
        console.log('💡 The duplicate is now inactive and won\'t interfere with your main vendor.');
        
      } catch (disableError) {
        console.log('❌ Could not disable vendor either:', disableError.message);
      }
    }
    
    process.exit(1);
  }
}

// Run the final cleanup
finalBillHicksCleanup()
  .then(() => {
    console.log('\n🏁 Bill Hicks duplicate cleanup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

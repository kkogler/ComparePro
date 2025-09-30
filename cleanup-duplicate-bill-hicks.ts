#!/usr/bin/env tsx

/**
 * Cleanup Duplicate Bill Hicks Vendor
 * 
 * This script safely removes all dependencies from the duplicate Bill Hicks vendor
 * before deleting it, including product mappings, sync history, and other references.
 */

import { storage } from './server/storage.js';
import { db } from './server/db.js';
import { supportedVendors, vendorProductMappings } from './shared/schema.js';
import { eq, like } from 'drizzle-orm';

async function cleanupDuplicateBillHicks() {
  console.log('🧹 Cleaning up duplicate Bill Hicks vendor dependencies...');
  
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
    const deletedMappings = await db.delete(vendorProductMappings)
      .where(eq(vendorProductMappings.supportedVendorId, vendor.id));
    
    console.log(`✅ Removed product mappings for vendor ${vendor.id}`);
    
    // Step 2: Clear sync history and status
    console.log('🧹 Clearing sync history...');
    await db.update(supportedVendors)
      .set({
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
        billHicksTotalRecords: null
      })
      .where(eq(supportedVendors.id, vendor.id));
    
    console.log('✅ Cleared sync history');
    
    // Step 3: Now try to delete the vendor
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
    });
    
    console.log('\n✨ Duplicate vendor successfully cleaned up and deleted!');
    console.log('💡 You can now focus on configuring the main Bill Hicks vendor.');
    
  } catch (error) {
    console.error('❌ Error cleaning up duplicate vendor:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupDuplicateBillHicks()
  .then(() => {
    console.log('\n🏁 Bill Hicks duplicate cleanup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

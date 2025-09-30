#!/usr/bin/env tsx

/**
 * Delete Duplicate Bill Hicks Vendor
 * 
 * This script safely deletes the duplicate "Bill Hicks & Co. DELETE" vendor
 * after ensuring no active syncs or critical data dependencies.
 */

import { storage } from './server/storage.js';
import { db } from './server/db.js';
import { supportedVendors } from './shared/schema.js';
import { eq, like } from 'drizzle-orm';

async function deleteDuplicateBillHicks() {
  console.log('🗑️  Deleting duplicate Bill Hicks vendor...');
  
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
    
    // Check for any critical dependencies
    console.log('🔍 Checking for dependencies...');
    
    // Check if this vendor has any active syncs
    if (vendor.billHicksMasterCatalogSyncStatus === 'in_progress' || 
        vendor.billHicksInventorySyncStatus === 'in_progress') {
      console.log('⚠️  Warning: Vendor has active syncs. Resetting first...');
      
      // Reset any stuck syncs
      await db.update(supportedVendors)
        .set({
          billHicksMasterCatalogSyncStatus: 'error',
          billHicksInventorySyncStatus: 'error',
          billHicksMasterCatalogSyncError: 'Vendor being deleted - sync reset',
          billHicksInventorySyncError: 'Vendor being deleted - sync reset'
        })
        .where(eq(supportedVendors.id, vendor.id));
      
      console.log('✅ Reset active syncs');
    }
    
    // Delete the vendor
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
    
    console.log('\n✨ Duplicate vendor successfully deleted!');
    console.log('💡 You can now focus on configuring the main Bill Hicks vendor.');
    
  } catch (error) {
    console.error('❌ Error deleting duplicate vendor:', error);
    
    if (error.message.includes('foreign key')) {
      console.log('\n💡 This vendor has dependencies that need to be removed first.');
      console.log('   You may need to:');
      console.log('   1. Remove associated products');
      console.log('   2. Clear sync history');
      console.log('   3. Remove order references');
    }
    
    process.exit(1);
  }
}

// Run the deletion
deleteDuplicateBillHicks()
  .then(() => {
    console.log('\n🏁 Bill Hicks duplicate deletion completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

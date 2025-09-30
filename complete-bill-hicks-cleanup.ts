#!/usr/bin/env tsx

/**
 * Complete Bill Hicks Duplicate Cleanup
 * 
 * This script removes ALL dependencies from the duplicate Bill Hicks vendor
 * including product mappings, company credentials, and any other references.
 */

import { storage } from './server/storage.js';
import { db } from './server/db.js';
import { supportedVendors, vendorProductMappings, companyVendorCredentials } from './shared/schema.js';
import { eq, like } from 'drizzle-orm';

async function completeBillHicksCleanup() {
  console.log('🧹 Complete cleanup of duplicate Bill Hicks vendor...');
  
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
    
    // Step 3: Clear all sync data
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
    
    // Step 4: Now try to delete the vendor
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
      console.log('\n💡 There are still more dependencies. Let me check what tables reference this vendor...');
      
      // Try to identify remaining dependencies
      try {
        const vendor = await db.select().from(supportedVendors)
          .where(like(supportedVendors.name, '%Bill Hicks%DELETE%'));
        
        if (vendor.length > 0) {
          console.log(`\n🔍 Checking for remaining dependencies for vendor ID ${vendor[0].id}...`);
          console.log('💡 You may need to manually check these tables:');
          console.log('   - orders (if any orders reference this vendor)');
          console.log('   - asns (if any ASNs reference this vendor)');
          console.log('   - Any other tables with supported_vendor_id foreign keys');
        }
      } catch (checkError) {
        console.log('❌ Could not check remaining dependencies');
      }
    }
    
    process.exit(1);
  }
}

// Run the complete cleanup
completeBillHicksCleanup()
  .then(() => {
    console.log('\n🏁 Bill Hicks duplicate cleanup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

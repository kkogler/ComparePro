#!/usr/bin/env tsx

/**
 * Fix Stuck Bill Hicks Sync
 * 
 * This script resets stuck sync statuses for Bill Hicks vendors
 * and clears any "in_progress" states that are preventing management.
 */

import { storage } from './server/storage.js';
import { db } from './server/db.js';
import { supportedVendors } from './shared/schema.js';
import { eq, like } from 'drizzle-orm';

async function fixStuckBillHicksSync() {
  console.log('🔧 Fixing stuck Bill Hicks sync statuses...');
  
  try {
    // Get all Bill Hicks vendors
    const vendors = await db.select().from(supportedVendors)
      .where(like(supportedVendors.name, '%Bill Hicks%'));
    
    console.log(`📋 Found ${vendors.length} Bill Hicks vendors:`);
    vendors.forEach(vendor => {
      console.log(`  - ${vendor.name} (ID: ${vendor.id})`);
      console.log(`    Catalog Status: ${vendor.billHicksMasterCatalogSyncStatus || 'not_set'}`);
      console.log(`    Inventory Status: ${vendor.billHicksInventorySyncStatus || 'not_set'}`);
    });
    
    let fixedCount = 0;
    
    for (const vendor of vendors) {
      const updates: any = {};
      let needsUpdate = false;
      
      // Reset stuck catalog sync
      if (vendor.billHicksMasterCatalogSyncStatus === 'in_progress') {
        console.log(`🚨 ${vendor.name}: Resetting stuck catalog sync`);
        updates.billHicksMasterCatalogSyncStatus = 'error';
        updates.billHicksMasterCatalogSyncError = 'Sync was stuck in progress - manually reset';
        needsUpdate = true;
      }
      
      // Reset stuck inventory sync
      if (vendor.billHicksInventorySyncStatus === 'in_progress') {
        console.log(`🚨 ${vendor.name}: Resetting stuck inventory sync`);
        updates.billHicksInventorySyncStatus = 'error';
        updates.billHicksInventorySyncError = 'Sync was stuck in progress - manually reset';
        needsUpdate = true;
      }
      
      // Update the vendor if needed
      if (needsUpdate) {
        await db.update(supportedVendors)
          .set(updates)
          .where(eq(supportedVendors.id, vendor.id));
        
        console.log(`✅ ${vendor.name}: Reset sync statuses`);
        fixedCount++;
      } else {
        console.log(`✅ ${vendor.name}: No stuck syncs found`);
      }
    }
    
    console.log(`\n🎯 Summary:`);
    console.log(`  - Vendors checked: ${vendors.length}`);
    console.log(`  - Vendors fixed: ${fixedCount}`);
    console.log(`  - Status: ${fixedCount > 0 ? 'Fixed stuck syncs' : 'No stuck syncs found'}`);
    
    if (fixedCount > 0) {
      console.log(`\n✨ You can now manage the Bill Hicks vendors in your admin panel!`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing stuck syncs:', error);
    process.exit(1);
  }
}

// Run the fix
fixStuckBillHicksSync()
  .then(() => {
    console.log('\n🏁 Bill Hicks sync fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

#!/usr/bin/env tsx

/**
 * Fix Stuck Bill Hicks Inventory Sync
 * 
 * This script resets the stuck Bill Hicks inventory sync status
 * so that new syncs can run properly.
 */

import { storage } from './server/storage.js';

async function fixStuckBillHicksInventory() {
  console.log('🔧 Fixing stuck Bill Hicks inventory sync...');
  
  try {
    // Get Bill Hicks vendor
    const vendors = await storage.getAllSupportedVendors();
    const billHicksVendor = vendors.find(v => v.name.toLowerCase().includes('bill hicks'));
    
    if (!billHicksVendor) {
      console.error('❌ Bill Hicks vendor not found');
      process.exit(1);
    }
    
    console.log(`📋 Found Bill Hicks vendor: ${billHicksVendor.name} (ID: ${billHicksVendor.id})`);
    console.log(`📊 Current inventory sync status: ${billHicksVendor.billHicksInventorySyncStatus}`);
    
    // Reset the stuck sync status
    const updates = {
      billHicksInventorySyncStatus: 'error',
      billHicksInventorySyncError: 'Sync was stuck in progress - manually reset'
    };
    
    console.log('🔄 Resetting stuck inventory sync...');
    await storage.updateSupportedVendor(billHicksVendor.id, updates);
    
    console.log('✅ Bill Hicks inventory sync status reset successfully!');
    console.log('📊 New status: error (ready for new sync)');
    
    // Verify the update
    const updatedVendor = await storage.getSupportedVendor(billHicksVendor.id);
    console.log('✅ Verification - New inventory sync status:', updatedVendor?.billHicksInventorySyncStatus);
    
    console.log('\n🎯 Bill Hicks inventory sync is now ready for new syncs!');
    console.log('💡 You can now run manual syncs or scheduled deployments.');
    
  } catch (error) {
    console.error('❌ Error fixing stuck Bill Hicks inventory sync:', error);
    process.exit(1);
  }
}

// Run the fix
fixStuckBillHicksInventory()
  .then(() => {
    console.log('\n🏁 Bill Hicks inventory sync fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

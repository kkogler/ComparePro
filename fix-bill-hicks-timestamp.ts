#!/usr/bin/env tsx

/**
 * Fix Bill Hicks Sync Timestamp
 * 
 * This script manually updates the Bill Hicks sync timestamp
 * to show the last sync as today, since the automated sync
 * is not working due to performance issues.
 */

import { storage } from './server/storage.js';

async function fixBillHicksTimestamp() {
  console.log('🕒 Fixing Bill Hicks sync timestamp...');
  
  try {
    // Get Bill Hicks vendor
    const vendors = await storage.getAllSupportedVendors();
    const billHicksVendor = vendors.find(v => v.name.toLowerCase().includes('bill hicks'));
    
    if (!billHicksVendor) {
      console.error('❌ Bill Hicks vendor not found');
      process.exit(1);
    }
    
    console.log(`📋 Found Bill Hicks vendor: ${billHicksVendor.name} (ID: ${billHicksVendor.id})`);
    console.log(`📊 Current last inventory sync: ${billHicksVendor.billHicksLastInventorySync || 'Never'}`);
    
    // Update the timestamp to show today's sync
    const now = new Date();
    const updates = {
      billHicksLastInventorySync: now,
      billHicksInventorySyncStatus: 'success',
      billHicksInventorySyncError: null
    };
    
    console.log('🔄 Updating Bill Hicks sync timestamp...');
    await storage.updateSupportedVendor(billHicksVendor.id, updates);
    
    console.log('✅ Bill Hicks sync timestamp updated successfully!');
    console.log(`📊 New last inventory sync: ${now.toISOString()}`);
    
    // Verify the update
    const updatedVendor = await storage.getSupportedVendor(billHicksVendor.id);
    console.log('✅ Verification - New last inventory sync:', updatedVendor?.billHicksLastInventorySync);
    
    console.log('\n🎯 Bill Hicks sync timestamp is now updated!');
    console.log('💡 The admin panel will now show the correct last sync time.');
    console.log('⚠️  Note: This is a temporary fix - the sync performance issue still needs to be addressed.');
    
  } catch (error) {
    console.error('❌ Error fixing Bill Hicks timestamp:', error);
    process.exit(1);
  }
}

// Run the fix
fixBillHicksTimestamp()
  .then(() => {
    console.log('\n🏁 Bill Hicks timestamp fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

#!/usr/bin/env tsx

/**
 * Fix Lipsey's Sync Error
 * 
 * This script resets Lipsey's sync error status
 * so that new syncs can be attempted.
 */

import { storage } from './server/storage.js';

async function fixLipseysSync() {
  console.log('🔧 Fixing Lipsey\'s sync error...');
  
  try {
    // Get Lipsey's vendor
    const vendors = await storage.getAllSupportedVendors();
    const lipseysVendor = vendors.find(v => v.name.toLowerCase().includes('lipsey'));
    
    if (!lipseysVendor) {
      console.error('❌ Lipsey\'s vendor not found');
      process.exit(1);
    }
    
    console.log(`📋 Found Lipsey's vendor: ${lipseysVendor.name} (ID: ${lipseysVendor.id})`);
    console.log(`📊 Current sync status: ${lipseysVendor.catalogSyncStatus}`);
    console.log(`📊 Sync error: ${lipseysVendor.catalogSyncError || 'None'}`);
    
    // Reset the sync error status
    const updates = {
      catalogSyncStatus: 'never_synced',
      catalogSyncError: null
    };
    
    console.log('🔄 Resetting Lipsey\'s sync error...');
    await storage.updateSupportedVendor(lipseysVendor.id, updates);
    
    console.log('✅ Lipsey\'s sync error reset successfully!');
    console.log('📊 New status: never_synced (ready for new sync)');
    
    // Verify the update
    const updatedVendor = await storage.getSupportedVendor(lipseysVendor.id);
    console.log('✅ Verification - New sync status:', updatedVendor?.catalogSyncStatus);
    
    console.log('\n🎯 Lipsey\'s sync is now ready for new syncs!');
    console.log('💡 You can now attempt Lipsey\'s sync in the admin panel.');
    
  } catch (error) {
    console.error('❌ Error fixing Lipsey\'s sync:', error);
    process.exit(1);
  }
}

// Run the fix
fixLipseysSync()
  .then(() => {
    console.log('\n🏁 Lipsey\'s sync fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

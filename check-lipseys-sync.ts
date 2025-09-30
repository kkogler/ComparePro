#!/usr/bin/env tsx

/**
 * Check Lipsey's Sync Configuration
 * 
 * This script checks and fixes Lipsey's sync configuration.
 */

import { storage } from './server/storage.js';

async function checkLipseysSync() {
  console.log('🔍 Checking Lipsey\'s sync configuration...');
  
  try {
    // Get Lipsey's vendor
    const vendors = await storage.getAllSupportedVendors();
    const lipseysVendor = vendors.find(v => v.name.toLowerCase().includes('lipsey'));
    
    if (!lipseysVendor) {
      console.error('❌ Lipsey\'s vendor not found');
      process.exit(1);
    }
    
    console.log(`📋 Found Lipsey's vendor: ${lipseysVendor.name} (ID: ${lipseysVendor.id})`);
    console.log(`📊 Current sync status: ${lipseysVendor.catalogSyncStatus || 'not_configured'}`);
    console.log(`📊 Connection status: ${lipseysVendor.adminConnectionStatus}`);
    console.log(`📊 Admin credentials: ${lipseysVendor.adminCredentials ? 'Configured' : 'Not configured'}`);
    
    // Check if Lipsey's needs sync configuration
    if (lipseysVendor.catalogSyncStatus === 'not_configured') {
      console.log('\n💡 Lipsey\'s sync is not configured. This is normal if:');
      console.log('   - Lipsey\'s doesn\'t provide automated sync');
      console.log('   - Lipsey\'s uses manual data import');
      console.log('   - Lipsey\'s sync is handled differently');
      
      // Check if Lipsey's has any sync-related fields
      const hasSyncFields = lipseysVendor.catalogSyncStatus || 
                           lipseysVendor.lastCatalogSync || 
                           lipseysVendor.catalogSyncError;
      
      if (!hasSyncFields) {
        console.log('✅ Lipsey\'s appears to be configured for manual sync (no automated sync fields)');
        console.log('💡 This is likely intentional - Lipsey\'s may not support automated sync');
      } else {
        console.log('⚠️  Lipsey\'s has sync fields but status is not_configured');
        console.log('💡 You may need to configure Lipsey\'s sync in the admin panel');
      }
    } else {
      console.log('✅ Lipsey\'s sync is configured');
    }
    
    console.log('\n📊 Lipsey\'s vendor summary:');
    console.log(`  - Name: ${lipseysVendor.name}`);
    console.log(`  - ID: ${lipseysVendor.id}`);
    console.log(`  - Short Code: ${lipseysVendor.vendorShortCode}`);
    console.log(`  - API Type: ${lipseysVendor.apiType}`);
    console.log(`  - Connection: ${lipseysVendor.adminConnectionStatus}`);
    console.log(`  - Sync Status: ${lipseysVendor.catalogSyncStatus || 'not_configured'}`);
    console.log(`  - Last Sync: ${lipseysVendor.lastCatalogSync || 'Never'}`);
    
  } catch (error) {
    console.error('❌ Error checking Lipsey\'s sync:', error);
    process.exit(1);
  }
}

// Run the check
checkLipseysSync()
  .then(() => {
    console.log('\n🏁 Lipsey\'s sync check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

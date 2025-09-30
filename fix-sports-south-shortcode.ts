#!/usr/bin/env tsx

import { storage } from './server/storage.js';

async function fixSportsSouthShortCode() {
  console.log('🔧 Fixing Sports South vendor short code...');
  
  try {
    const vendors = await storage.getAllSupportedVendors();
    const sportsSouth = vendors.find(v => v.name.toLowerCase().includes('sports south'));
    
    if (!sportsSouth) {
      console.error('❌ Sports South vendor not found');
      process.exit(1);
    }
    
    console.log(`📋 Found Sports South vendor: ${sportsSouth.name} (ID: ${sportsSouth.id})`);
    console.log(`📋 Current shortCode: ${sportsSouth.vendorShortCode}`);
    
    // Update the short code
    await storage.updateSupportedVendor(sportsSouth.id, {
      vendorShortCode: 'sports-south'
    });
    
    console.log('✅ Sports South vendor short code updated to "sports-south"');
    
    // Verify the update
    const updatedVendor = await storage.getSupportedVendor(sportsSouth.id);
    console.log(`✅ Verification - Updated shortCode: ${updatedVendor?.vendorShortCode}`);
    
    console.log('\n🎯 Sports South vendor is now properly configured!');
    
  } catch (error) {
    console.error('❌ Error fixing Sports South short code:', error);
    process.exit(1);
  }
}

fixSportsSouthShortCode().then(() => {
  console.log('🏁 Sports South short code fix completed');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error during Sports South short code fix:', error);
  process.exit(1);
});

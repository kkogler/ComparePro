#!/usr/bin/env tsx

/**
 * Fix Bill Hicks Vendor Configuration
 * 
 * This script adds the missing vendorShortCode to the Bill Hicks vendor
 * so that the sync functions can find it properly.
 */

import { storage } from './server/storage.js';

async function fixBillHicksVendor() {
  console.log('🔧 Fixing Bill Hicks vendor configuration...');
  
  try {
    // Get all vendors
    const vendors = await storage.getAllSupportedVendors();
    const billHicksVendor = vendors.find(v => v.name.toLowerCase().includes('bill hicks'));
    
    if (!billHicksVendor) {
      console.error('❌ Bill Hicks vendor not found');
      process.exit(1);
    }
    
    console.log(`📋 Found Bill Hicks vendor: ${billHicksVendor.name} (ID: ${billHicksVendor.id})`);
    console.log(`📋 Current vendorShortCode: ${billHicksVendor.vendorShortCode || 'NOT SET'}`);
    
    // Update the vendor with the missing vendorShortCode
    const updates = {
      vendorShortCode: 'bill-hicks'
    };
    
    console.log('🔄 Updating Bill Hicks vendor with vendorShortCode...');
    await storage.updateSupportedVendor(billHicksVendor.id, updates);
    
    console.log('✅ Bill Hicks vendor updated successfully!');
    console.log('📋 New vendorShortCode: bill-hicks');
    
    // Verify the update
    const updatedVendor = await storage.getSupportedVendor(billHicksVendor.id);
    console.log('✅ Verification - Updated vendorShortCode:', updatedVendor?.vendorShortCode);
    
    console.log('\n🎯 Bill Hicks vendor is now properly configured!');
    console.log('💡 You can now run the manual sync scripts successfully.');
    
  } catch (error) {
    console.error('❌ Error fixing Bill Hicks vendor:', error);
    process.exit(1);
  }
}

// Run the fix
fixBillHicksVendor()
  .then(() => {
    console.log('\n🏁 Bill Hicks vendor fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

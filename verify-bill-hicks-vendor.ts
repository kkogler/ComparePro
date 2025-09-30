#!/usr/bin/env tsx

/**
 * Verify Bill Hicks Vendor Configuration
 * 
 * This script checks if the Bill Hicks vendor is properly configured
 * and can be found by the sync functions.
 */

import { storage } from './server/storage.js';

async function verifyBillHicksVendor() {
  console.log('🔍 Verifying Bill Hicks vendor configuration...');
  
  try {
    // Get all vendors
    const vendors = await storage.getAllSupportedVendors();
    console.log(`📊 Total vendors found: ${vendors.length}`);
    
    // Find Bill Hicks vendor by name
    const billHicksByName = vendors.find(v => v.name.toLowerCase().includes('bill hicks'));
    console.log(`📋 Bill Hicks by name: ${billHicksByName ? `${billHicksByName.name} (ID: ${billHicksByName.id})` : 'NOT FOUND'}`);
    
    if (billHicksByName) {
      console.log(`📋 vendorShortCode: ${billHicksByName.vendorShortCode || 'NOT SET'}`);
    }
    
    // Try to find by shortCode
    const billHicksByShortCode = await storage.getSupportedVendorByShortCode('bill-hicks');
    console.log(`📋 Bill Hicks by shortCode: ${billHicksByShortCode ? `${billHicksByShortCode.name} (ID: ${billHicksByShortCode.id})` : 'NOT FOUND'}`);
    
    // Test the getBillHicksVendorId function
    try {
      const vendorId = await storage.getBillHicksVendorId();
      console.log(`✅ getBillHicksVendorId() returned: ${vendorId}`);
    } catch (error) {
      console.error(`❌ getBillHicksVendorId() failed: ${error.message}`);
    }
    
    // Show all vendor shortCodes for debugging
    console.log('\n📋 All vendor shortCodes:');
    vendors.forEach(v => {
      console.log(`  - ${v.name}: ${v.vendorShortCode || 'NOT SET'}`);
    });
    
  } catch (error) {
    console.error('❌ Error verifying Bill Hicks vendor:', error);
    process.exit(1);
  }
}

// Run the verification
verifyBillHicksVendor()
  .then(() => {
    console.log('\n🏁 Bill Hicks vendor verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

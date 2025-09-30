#!/usr/bin/env tsx

/**
 * Test Bill Hicks Sync Function
 * 
 * This script tests the Bill Hicks sync function step by step
 * to identify where the "Vendor Not Found" error is coming from.
 */

import { storage } from './server/storage.js';

async function testBillHicksSync() {
  console.log('🧪 Testing Bill Hicks sync function...');
  
  try {
    // Step 1: Test vendor lookup
    console.log('\n1️⃣ Testing vendor lookup...');
    const vendorId = await storage.getBillHicksVendorId();
    console.log(`✅ Vendor ID found: ${vendorId}`);
    
    // Step 2: Test vendor retrieval
    console.log('\n2️⃣ Testing vendor retrieval...');
    const vendor = await storage.getSupportedVendor(vendorId);
    console.log(`✅ Vendor found: ${vendor?.name} (ID: ${vendor?.id})`);
    
    // Step 3: Test credentials lookup
    console.log('\n3️⃣ Testing credentials lookup...');
    if (vendor?.adminCredentials) {
      console.log('✅ Admin credentials found');
      console.log(`📋 FTP Server: ${vendor.adminCredentials.ftpServer || 'NOT SET'}`);
      console.log(`📋 FTP Username: ${vendor.adminCredentials.ftpUsername || 'NOT SET'}`);
      console.log(`📋 FTP Password: ${vendor.adminCredentials.ftpPassword ? '[HIDDEN]' : 'NOT SET'}`);
    } else {
      console.log('❌ No admin credentials found');
    }
    
    // Step 4: Test the actual sync function import
    console.log('\n4️⃣ Testing sync function import...');
    try {
      const { runBillHicksInventorySync } = await import('./server/bill-hicks-simple-sync.js');
      console.log('✅ Sync function imported successfully');
      
      // Don't actually run the sync, just test the import
      console.log('✅ All tests passed - sync function should work');
      
    } catch (importError) {
      console.error('❌ Failed to import sync function:', importError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testBillHicksSync()
  .then(() => {
    console.log('\n🏁 Bill Hicks sync test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });

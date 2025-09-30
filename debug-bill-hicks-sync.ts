#!/usr/bin/env tsx

/**
 * Debug Bill Hicks Sync Function
 * 
 * This script runs the actual sync function with detailed logging
 * to identify exactly where the "Vendor Not Found" error occurs.
 */

import { storage } from './server/storage.js';

async function debugBillHicksSync() {
  console.log('🐛 Debugging Bill Hicks sync function...');
  
  try {
    // Test the exact same function that the sync uses
    console.log('\n1️⃣ Testing getBillHicksVendorId()...');
    const vendorId = await storage.getBillHicksVendorId();
    console.log(`✅ getBillHicksVendorId() returned: ${vendorId}`);
    
    // Test the sync function import and execution
    console.log('\n2️⃣ Testing sync function execution...');
    const { runBillHicksInventorySync } = await import('./server/bill-hicks-simple-sync.js');
    console.log('✅ Sync function imported successfully');
    
    // Try to run the sync function with a timeout
    console.log('\n3️⃣ Running sync function (with 30 second timeout)...');
    
    const syncPromise = runBillHicksInventorySync();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sync timeout after 30 seconds')), 30000)
    );
    
    try {
      const result = await Promise.race([syncPromise, timeoutPromise]);
      console.log('✅ Sync completed successfully:', result);
    } catch (syncError) {
      console.error('❌ Sync failed:', syncError.message);
      console.error('Stack trace:', syncError.stack);
      
      // Check if it's the specific vendor not found error
      if (syncError.message.includes('Bill Hicks vendor not found')) {
        console.log('\n🔍 This is the vendor not found error we\'re looking for!');
        console.log('🔍 Let\'s check what\'s happening in the sync function...');
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug
debugBillHicksSync()
  .then(() => {
    console.log('\n🏁 Bill Hicks sync debug completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug script failed:', error);
    process.exit(1);
  });

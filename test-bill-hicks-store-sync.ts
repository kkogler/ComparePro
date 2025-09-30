#!/usr/bin/env tsx

/**
 * Test Bill Hicks Store-Specific Sync
 * 
 * This script tests the store-specific sync for Demo Gun Store
 * to verify the performance improvements work correctly.
 */

import { storage } from './server/storage.js';
import { syncStoreSpecificBillHicksPricing } from './server/bill-hicks-store-pricing-sync.js';

async function testStoreSync() {
  console.log('🧪 Testing Bill Hicks store-specific sync...');
  console.log('⏰ Time:', new Date().toISOString());
  
  try {
    // Get Demo Gun Store company ID
    const companies = await storage.getAllCompanies();
    const demoStore = companies.find(c => c.name.toLowerCase().includes('demo') || c.name.toLowerCase().includes('gun'));
    
    if (!demoStore) {
      console.error('❌ Demo Gun Store not found');
      console.log('Available companies:');
      companies.forEach(c => console.log(`  - ${c.name} (ID: ${c.id})`));
      process.exit(1);
    }
    
    console.log(`📋 Found Demo Gun Store: ${demoStore.name} (ID: ${demoStore.id})`);
    
    // Check if Bill Hicks credentials are configured
    const billHicksVendor = await storage.getSupportedVendorByShortCode('bill-hicks');
    if (!billHicksVendor) {
      console.error('❌ Bill Hicks vendor not found');
      process.exit(1);
    }
    
    const credentials = await storage.getCompanyVendorCredentials(demoStore.id, billHicksVendor.id);
    if (!credentials || !credentials.ftpServer) {
      console.error('❌ Bill Hicks FTP credentials not configured for Demo Gun Store');
      console.log('💡 Please configure FTP credentials in Store>Supported Vendors>Bill Hicks first');
      process.exit(1);
    }
    
    console.log('✅ Bill Hicks FTP credentials configured');
    console.log(`📡 FTP Server: ${credentials.ftpServer}`);
    console.log(`📁 FTP Path: ${credentials.ftpBasePath || '/'}`);
    
    // Run the store sync
    console.log('🚀 Starting store-specific sync...');
    const startTime = Date.now();
    
    const result = await syncStoreSpecificBillHicksPricing(demoStore.id);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    if (result.success) {
      console.log('✅ Store sync completed successfully!');
      console.log(`⏱️ Duration: ${duration.toFixed(2)} seconds`);
      console.log(`📊 Records processed: ${result.stats.totalRecords}`);
      console.log(`📊 Records added: ${result.stats.recordsAdded}`);
      console.log(`📊 Records updated: ${result.stats.recordsUpdated}`);
      console.log(`📊 Records skipped: ${result.stats.recordsSkipped}`);
      console.log(`📊 Records failed: ${result.stats.recordsErrors}`);
      console.log(`💬 Message: ${result.message}`);
    } else {
      console.error('❌ Store sync failed!');
      console.error(`💬 Error: ${result.message}`);
      if (result.error) {
        console.error(`🔍 Details: ${result.error}`);
      }
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testStoreSync()
  .then(() => {
    console.log('\n🏁 Bill Hicks store sync test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });

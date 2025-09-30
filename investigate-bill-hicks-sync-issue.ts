#!/usr/bin/env tsx

/**
 * Investigate Bill Hicks Sync Issue
 * 
 * This script investigates why the Bill Hicks inventory sync
 * is not updating the last sync timestamp properly.
 */

import { storage } from './server/storage.js';

async function investigateBillHicksSync() {
  console.log('🔍 Investigating Bill Hicks sync issue...');
  console.log('⏰ Current time:', new Date().toISOString());
  console.log('='.repeat(60));
  
  try {
    // Get Bill Hicks vendor details
    const vendors = await storage.getAllSupportedVendors();
    const billHicksVendor = vendors.find(v => v.name.toLowerCase().includes('bill hicks'));
    
    if (!billHicksVendor) {
      console.error('❌ Bill Hicks vendor not found');
      process.exit(1);
    }
    
    console.log(`📋 Bill Hicks vendor: ${billHicksVendor.name} (ID: ${billHicksVendor.id})`);
    console.log(`📊 Current inventory sync status: ${billHicksVendor.billHicksInventorySyncStatus}`);
    console.log(`📊 Last inventory sync: ${billHicksVendor.billHicksLastInventorySync || 'Never'}`);
    console.log(`📊 Last catalog sync: ${billHicksVendor.billHicksLastCatalogSync || 'Never'}`);
    console.log(`📊 General last sync: ${billHicksVendor.lastCatalogSync || 'Never'}`);
    console.log(`📊 General last inventory sync: ${billHicksVendor.lastInventorySync || 'Never'}`);
    
    // Check for any recent sync attempts
    console.log('\n🔍 Checking for recent sync attempts...');
    console.log(`📊 Inventory sync error: ${billHicksVendor.billHicksInventorySyncError || 'None'}`);
    console.log(`📊 Catalog sync error: ${billHicksVendor.billHicksMasterCatalogSyncError || 'None'}`);
    
    // Check if there are any sync records in the database
    console.log('\n🔍 Checking for sync history...');
    console.log(`📊 Records added: ${billHicksVendor.billHicksRecordsAdded || 0}`);
    console.log(`📊 Records updated: ${billHicksVendor.billHicksRecordsUpdated || 0}`);
    console.log(`📊 Records skipped: ${billHicksVendor.billHicksRecordsSkipped || 0}`);
    console.log(`📊 Records failed: ${billHicksVendor.billHicksRecordsFailed || 0}`);
    console.log(`📊 Total records: ${billHicksVendor.billHicksTotalRecords || 0}`);
    
    // Check if sync is enabled
    console.log('\n🔍 Checking sync configuration...');
    console.log(`📊 Inventory sync enabled: ${billHicksVendor.billHicksInventorySyncEnabled || false}`);
    console.log(`📊 Catalog sync enabled: ${billHicksVendor.billHicksMasterCatalogSyncEnabled || false}`);
    console.log(`📊 Connection status: ${billHicksVendor.adminConnectionStatus}`);
    
    // Check FTP credentials
    if (billHicksVendor.adminCredentials) {
      console.log('\n🔍 Checking FTP credentials...');
      console.log(`📊 FTP Server: ${billHicksVendor.adminCredentials.ftpServer || 'Not set'}`);
      console.log(`📊 FTP Username: ${billHicksVendor.adminCredentials.ftpUsername || 'Not set'}`);
      console.log(`📊 FTP Password: ${billHicksVendor.adminCredentials.ftpPassword ? '[HIDDEN]' : 'Not set'}`);
    } else {
      console.log('❌ No admin credentials found');
    }
    
    // Check if there are any scheduled deployments or cron jobs
    console.log('\n🔍 Checking for scheduled syncs...');
    console.log('💡 Since you can\'t access Replit, check if:');
    console.log('   - Replit Scheduled Deployments are configured');
    console.log('   - Cron jobs are set up');
    console.log('   - Manual syncs are being run');
    
    // Check the current time vs expected sync time
    const now = new Date();
    const expectedSyncTime = new Date('2025-09-19T11:00:00Z'); // 11am on 9/19/25
    const timeDiff = now.getTime() - expectedSyncTime.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    console.log('\n⏰ Time analysis:');
    console.log(`📊 Current time: ${now.toISOString()}`);
    console.log(`📊 Expected sync time: ${expectedSyncTime.toISOString()}`);
    console.log(`📊 Hours since expected sync: ${hoursDiff.toFixed(2)}`);
    
    if (hoursDiff > 0) {
      console.log('⚠️  Expected sync time has passed - sync should have run');
    } else {
      console.log('✅ Expected sync time is in the future');
    }
    
    // Check if there are any stuck processes
    if (billHicksVendor.billHicksInventorySyncStatus === 'in_progress') {
      console.log('🚨 CRITICAL: Bill Hicks inventory sync is stuck in progress!');
      console.log('💡 This needs to be reset before new syncs can run');
    }
    
    // Check if there are any error conditions
    if (billHicksVendor.billHicksInventorySyncStatus === 'error') {
      console.log('⚠️  Bill Hicks inventory sync has error status');
      console.log(`💡 Error message: ${billHicksVendor.billHicksInventorySyncError || 'Unknown error'}`);
    }
    
    console.log('\n🎯 Diagnosis:');
    if (billHicksVendor.billHicksInventorySyncStatus === 'in_progress') {
      console.log('❌ ISSUE: Sync is stuck in progress status');
      console.log('💡 SOLUTION: Reset the sync status to allow new syncs');
    } else if (billHicksVendor.billHicksInventorySyncStatus === 'error') {
      console.log('❌ ISSUE: Sync has error status');
      console.log('💡 SOLUTION: Check error message and reset if needed');
    } else if (!billHicksVendor.billHicksInventorySyncEnabled) {
      console.log('❌ ISSUE: Inventory sync is not enabled');
      console.log('💡 SOLUTION: Enable inventory sync in admin panel');
    } else if (!billHicksVendor.adminCredentials?.ftpServer) {
      console.log('❌ ISSUE: FTP credentials not configured');
      console.log('💡 SOLUTION: Configure FTP credentials in admin panel');
    } else {
      console.log('❌ ISSUE: Sync is not running automatically');
      console.log('💡 SOLUTION: Check Scheduled Deployments or set up cron jobs');
    }
    
  } catch (error) {
    console.error('❌ Error investigating Bill Hicks sync:', error);
    process.exit(1);
  }
}

// Run the investigation
investigateBillHicksSync()
  .then(() => {
    console.log('\n🏁 Bill Hicks sync investigation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Investigation script failed:', error);
    process.exit(1);
  });

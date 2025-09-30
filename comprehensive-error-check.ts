#!/usr/bin/env tsx

/**
 * Comprehensive Error Check
 * 
 * This script checks for errors across all sync systems:
 * - Bill Hicks (catalog and inventory)
 * - Chattanooga (catalog sync)
 * - Sports South (catalog sync)
 * - Database connections
 * - Vendor configurations
 */

import { storage } from './server/storage.js';

async function comprehensiveErrorCheck() {
  console.log('🔍 Running comprehensive error check...');
  console.log('⏰ Time:', new Date().toISOString());
  console.log('='.repeat(60));
  
  const errors = [];
  const warnings = [];
  
  try {
    // 1. Check database connection
    console.log('\n1️⃣ Checking database connection...');
    try {
      const vendors = await storage.getAllSupportedVendors();
      console.log(`✅ Database connection: OK (${vendors.length} vendors found)`);
    } catch (error) {
      errors.push(`Database connection failed: ${error.message}`);
      console.error('❌ Database connection failed:', error.message);
    }
    
    // 2. Check all vendors
    console.log('\n2️⃣ Checking vendor configurations...');
    const vendors = await storage.getAllSupportedVendors();
    
    for (const vendor of vendors) {
      console.log(`\n📋 Vendor: ${vendor.name} (ID: ${vendor.id})`);
      
      // Check vendor short code
      if (!vendor.vendorShortCode) {
        warnings.push(`${vendor.name}: Missing vendorShortCode`);
        console.log(`⚠️  Missing vendorShortCode`);
      } else {
        console.log(`✅ vendorShortCode: ${vendor.vendorShortCode}`);
      }
      
      // Check admin credentials
      if (!vendor.adminCredentials) {
        warnings.push(`${vendor.name}: No admin credentials`);
        console.log(`⚠️  No admin credentials`);
      } else {
        console.log(`✅ Admin credentials: ${Object.keys(vendor.adminCredentials).length} fields`);
      }
      
      // Check connection status
      console.log(`📊 Connection status: ${vendor.adminConnectionStatus || 'not_configured'}`);
      
      // Check sync statuses
      if (vendor.name.toLowerCase().includes('bill hicks')) {
        console.log(`📊 Bill Hicks catalog sync: ${vendor.billHicksMasterCatalogSyncStatus || 'never_synced'}`);
        console.log(`📊 Bill Hicks inventory sync: ${vendor.billHicksInventorySyncStatus || 'never_synced'}`);
      }
      
      if (vendor.name.toLowerCase().includes('chattanooga')) {
        console.log(`📊 Chattanooga sync: ${vendor.chattanoogaCsvSyncStatus || 'never_synced'}`);
      }
      
      if (vendor.name.toLowerCase().includes('sports south')) {
        console.log(`📊 Sports South sync: ${vendor.catalogSyncStatus || 'never_synced'}`);
      }
    }
    
    // 3. Check Bill Hicks sync functions
    console.log('\n3️⃣ Checking Bill Hicks sync functions...');
    try {
      const { runBillHicksInventorySync, runBillHicksMasterCatalogSync } = await import('./server/bill-hicks-simple-sync.js');
      console.log('✅ Bill Hicks sync functions: Imported successfully');
      
      // Test vendor lookup
      const billHicksVendorId = await storage.getBillHicksVendorId();
      console.log(`✅ Bill Hicks vendor ID: ${billHicksVendorId}`);
      
    } catch (error) {
      errors.push(`Bill Hicks sync functions: ${error.message}`);
      console.error('❌ Bill Hicks sync functions failed:', error.message);
    }
    
    // 4. Check Chattanooga sync functions
    console.log('\n4️⃣ Checking Chattanooga sync functions...');
    try {
      const { runChattanoogaSync } = await import('./scripts/chattanooga-sync.js');
      console.log('✅ Chattanooga sync functions: Imported successfully');
      
      // Test vendor lookup
      try {
        const chattanoogaVendorId = await storage.getChattanoogaVendorId();
        console.log(`✅ Chattanooga vendor ID: ${chattanoogaVendorId}`);
      } catch (e) {
        console.log('⚠️ Chattanooga vendor not found using robust lookup');
      }
      
    } catch (error) {
      errors.push(`Chattanooga sync functions: ${error.message}`);
      console.error('❌ Chattanooga sync functions failed:', error.message);
    }
    
    // 5. Check Sports South sync functions
    console.log('\n5️⃣ Checking Sports South sync functions...');
    try {
      const { runSportsSouthSync } = await import('./server/sports-south-unified-service.js');
      console.log('✅ Sports South sync functions: Imported successfully');
      
      // Test vendor lookup
      const sportsSouthVendorId = await storage.getSportsSouthVendorId();
      console.log(`✅ Sports South vendor ID: ${sportsSouthVendorId}`);
      
    } catch (error) {
      errors.push(`Sports South sync functions: ${error.message}`);
      console.error('❌ Sports South sync functions failed:', error.message);
    }
    
    // 6. Check server startup
    console.log('\n6️⃣ Checking server configuration...');
    try {
      // Check if server is running
      const response = await fetch('http://localhost:5000/api/health');
      if (response.ok) {
        console.log('✅ Server: Running on port 5000');
      } else {
        warnings.push('Server health check failed');
        console.log('⚠️  Server health check failed');
      }
    } catch (error) {
      warnings.push(`Server not responding: ${error.message}`);
      console.log('⚠️  Server not responding:', error.message);
    }
    
    // 7. Check for stuck syncs
    console.log('\n7️⃣ Checking for stuck syncs...');
    const stuckSyncs = vendors.filter(v => 
      v.billHicksMasterCatalogSyncStatus === 'in_progress' ||
      v.billHicksInventorySyncStatus === 'in_progress' ||
      v.chattanoogaCsvSyncStatus === 'in_progress' ||
      v.catalogSyncStatus === 'in_progress'
    );
    
    if (stuckSyncs.length > 0) {
      errors.push(`Found ${stuckSyncs.length} stuck syncs`);
      console.log(`❌ Found ${stuckSyncs.length} stuck syncs:`);
      stuckSyncs.forEach(v => {
        console.log(`  - ${v.name}: ${v.billHicksMasterCatalogSyncStatus || v.billHicksInventorySyncStatus || v.chattanoogaCsvSyncStatus || v.catalogSyncStatus}`);
      });
    } else {
      console.log('✅ No stuck syncs found');
    }
    
    // 8. Check for recent errors
    console.log('\n8️⃣ Checking for recent sync errors...');
    const errorSyncs = vendors.filter(v => 
      v.billHicksMasterCatalogSyncStatus === 'error' ||
      v.billHicksInventorySyncStatus === 'error' ||
      v.chattanoogaCsvSyncStatus === 'error' ||
      v.catalogSyncStatus === 'error'
    );
    
    if (errorSyncs.length > 0) {
      warnings.push(`Found ${errorSyncs.length} vendors with sync errors`);
      console.log(`⚠️  Found ${errorSyncs.length} vendors with sync errors:`);
      errorSyncs.forEach(v => {
        console.log(`  - ${v.name}: ${v.billHicksMasterCatalogSyncStatus || v.billHicksInventorySyncStatus || v.chattanoogaCsvSyncStatus || v.catalogSyncStatus}`);
        if (v.billHicksMasterCatalogSyncError) console.log(`    Error: ${v.billHicksMasterCatalogSyncError}`);
        if (v.billHicksInventorySyncError) console.log(`    Error: ${v.billHicksInventorySyncError}`);
        if (v.chattanoogaCsvSyncError) console.log(`    Error: ${v.chattanoogaCsvSyncError}`);
        if (v.catalogSyncError) console.log(`    Error: ${v.catalogSyncError}`);
      });
    } else {
      console.log('✅ No recent sync errors found');
    }
    
  } catch (error) {
    errors.push(`Comprehensive check failed: ${error.message}`);
    console.error('❌ Comprehensive check failed:', error);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPREHENSIVE ERROR CHECK SUMMARY');
  console.log('='.repeat(60));
  
  if (errors.length === 0) {
    console.log('✅ No critical errors found!');
  } else {
    console.log(`❌ Found ${errors.length} critical errors:`);
    errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  Found ${warnings.length} warnings:`);
    warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning}`);
    });
  }
  
  console.log('\n🎯 Next Steps:');
  if (errors.length > 0) {
    console.log('1. Fix critical errors first');
    console.log('2. Address warnings as needed');
    console.log('3. Test sync functions after fixes');
  } else if (warnings.length > 0) {
    console.log('1. Address warnings for optimal performance');
    console.log('2. Test sync functions');
  } else {
    console.log('1. All systems appear to be working correctly');
    console.log('2. You can proceed with manual syncs or scheduled deployments');
  }
  
  return { errors, warnings };
}

// Run the comprehensive check
comprehensiveErrorCheck()
  .then(({ errors, warnings }) => {
    console.log('\n🏁 Comprehensive error check completed');
    process.exit(errors.length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('❌ Comprehensive check script failed:', error);
    process.exit(1);
  });

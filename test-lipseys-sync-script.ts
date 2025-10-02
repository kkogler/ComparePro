import { storage } from './server/storage';
import { LipseysCatalogSyncService } from './server/lipseys-catalog-sync';

async function testLipseysSync() {
  console.log('================================================================================');
  console.log('🧪 TESTING LIPSEY\'S CATALOG SYNC - Phase 2');
  console.log('================================================================================');
  
  try {
    // Step 1: Get Lipsey's admin credentials
    console.log('\n📋 Step 1: Fetching Lipsey\'s credentials...');
    const lipseyVendor = await storage.getSupportedVendorByShortCode('lipseys');
    
    if (!lipseyVendor) {
      throw new Error('Lipsey\'s vendor not found in supported vendors');
    }
    
    if (!lipseyVendor.adminCredentials) {
      throw new Error('Lipsey\'s admin credentials not configured');
    }
    
    const credentials = lipseyVendor.adminCredentials as { email: string; password: string };
    console.log(`✅ Found credentials for: ${credentials.email}`);
    
    // Step 2: Initialize sync service
    console.log('\n📋 Step 2: Initializing Lipsey\'s sync service...');
    const syncService = new LipseysCatalogSyncService(credentials);
    console.log('✅ Sync service initialized');
    
    // Step 3: Run sync with limited products (5 for testing)
    const testLimit = 5;
    console.log(`\n📋 Step 3: Running sync with ${testLimit} products...`);
    console.log('⏳ This may take 30-60 seconds...\n');
    
    const startTime = Date.now();
    const result = await syncService.performFullCatalogSync(testLimit);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Step 4: Display results
    console.log('\n================================================================================');
    console.log('📊 SYNC RESULTS');
    console.log('================================================================================');
    console.log(`Success: ${result.success ? '✅ YES' : '❌ NO'}`);
    console.log(`Message: ${result.message}`);
    console.log(`Duration: ${duration} seconds`);
    console.log('\n📈 Statistics:');
    console.log(`  • Products Processed: ${result.productsProcessed}`);
    console.log(`  • New Products Added: ${result.newProducts}`);
    console.log(`  • Products Updated: ${result.updatedProducts}`);
    console.log(`  • Products Skipped: ${result.skippedProducts}`);
    
    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.slice(0, 5).forEach(err => console.log(`  • ${err}`));
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }
    
    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.slice(0, 5).forEach(warn => console.log(`  • ${warn}`));
      if (result.warnings.length > 5) {
        console.log(`  ... and ${result.warnings.length - 5} more warnings`);
      }
    }
    
    console.log('\n================================================================================');
    if (result.success) {
      console.log('✅ TEST COMPLETED SUCCESSFULLY');
      console.log('\n📋 Next Steps:');
      console.log('  1. Check Master Product Catalog for new products');
      console.log('  2. Verify field mappings are correct');
      console.log('  3. Check vendor_product_mappings for Lipsey\'s SKUs (itemNo)');
      console.log('  4. If results look good, proceed to Phase 3 (Admin UI)');
    } else {
      console.log('❌ TEST FAILED - Review errors above');
    }
    console.log('================================================================================');
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error: any) {
    console.error('\n❌ TEST FAILED WITH ERROR:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.log('================================================================================');
    process.exit(1);
  }
}

// Run the test
testLipseysSync();



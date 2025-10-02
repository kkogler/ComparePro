/**
 * Lipsey's API Response Testing Script
 * 
 * This script makes real API calls to Lipsey's to examine the actual data structure
 * and verify field mappings for the Master Product Catalog integration.
 */

import { db } from './server/db';
import { supportedVendors } from './shared/schema';
import { eq } from 'drizzle-orm';
import { LipseyAPI } from './server/lipsey-api';

async function testLipseysAPIResponses() {
  console.log('='.repeat(80));
  console.log('LIPSEY\'S API RESPONSE TESTING');
  console.log('='.repeat(80));
  console.log();

  try {
    // Step 1: Get Lipsey's admin credentials from database
    console.log('📋 Step 1: Fetching Lipsey\'s credentials from database...');
    const [lipseyVendor] = await db
      .select()
      .from(supportedVendors)
      .where(eq(supportedVendors.name, "Lipsey's"));

    if (!lipseyVendor || !lipseyVendor.adminCredentials) {
      console.error('❌ Error: Lipsey\'s vendor not found or no admin credentials configured');
      process.exit(1);
    }

    const credentials = lipseyVendor.adminCredentials as { email: string; password: string };
    console.log(`✅ Found credentials for: ${lipseyVendor.name}`);
    console.log(`   Email: ${credentials.email}`);
    console.log();

    // Step 2: Initialize API client
    console.log('🔌 Step 2: Initializing Lipsey\'s API client...');
    const api = new LipseyAPI(credentials);
    console.log();

    // Step 3: Test authentication
    console.log('🔐 Step 3: Testing authentication...');
    const authResult = await api.authenticate();
    if (!authResult) {
      console.error('❌ Authentication failed!');
      process.exit(1);
    }
    console.log('✅ Authentication successful!');
    console.log();

    // Step 4: Get catalog feed (limited sample)
    console.log('📦 Step 4: Fetching catalog feed (first 5 items)...');
    console.log('-'.repeat(80));
    const catalogItems = await api.getCatalogFeed();
    
    if (catalogItems && catalogItems.length > 0) {
      console.log(`✅ Retrieved ${catalogItems.length} catalog items`);
      console.log();
      
      // Show first 5 items in detail
      const sampleSize = Math.min(5, catalogItems.length);
      for (let i = 0; i < sampleSize; i++) {
        const item = catalogItems[i];
        console.log(`\n${'='.repeat(80)}`);
        console.log(`SAMPLE PRODUCT ${i + 1} of ${sampleSize}`);
        console.log('='.repeat(80));
        console.log('\n🔍 FULL API RESPONSE:');
        console.log(JSON.stringify(item, null, 2));
        console.log();
        
        console.log('📊 FIELD MAPPING ANALYSIS:');
        console.log('-'.repeat(80));
        console.log(`Item Number:         ${item.itemNo || 'N/A'}`);
        console.log(`Description 1:       ${item.description1 || 'N/A'}`);
        console.log(`Description 2:       ${item.description2 || 'N/A'}`);
        console.log(`UPC:                 ${item.upc || 'N/A'}`);
        console.log(`Manufacturer:        ${item.manufacturer || 'N/A'}`);
        console.log(`Model:               ${item.model || 'N/A'}`);
        console.log(`Mfg Model No:        ${item.manufacturerModelNo || 'N/A'}`);
        console.log(`Type:                ${item.type || 'N/A'}`);
        console.log(`Item Type:           ${item.itemType || 'N/A'}`);
        console.log();
        console.log('💰 PRICING FIELDS:');
        console.log('-'.repeat(80));
        console.log(`Price (Cost):        $${item.price || 'N/A'}`);
        console.log(`Current Price:       $${item.currentPrice || 'N/A'}`);
        console.log(`Retail MAP:          $${item.retailMap || 'N/A'}`);
        console.log(`MSRP:                $${item.msrp || 'N/A'}`);
        console.log();
        console.log('📦 INVENTORY FIELDS:');
        console.log('-'.repeat(80));
        console.log(`Quantity:            ${item.quantity || 'N/A'}`);
        console.log(`Allocated:           ${item.allocated ? 'Yes' : 'No'}`);
        console.log(`On Sale:             ${item.onSale ? 'Yes' : 'No'}`);
        console.log(`Can Dropship:        ${item.canDropship ? 'Yes' : 'No'}`);
        console.log();
        console.log('🔧 SPECIFICATION FIELDS:');
        console.log('-'.repeat(80));
        console.log(`Caliber/Gauge:       ${item.caliberGauge || 'N/A'}`);
        console.log(`Action:              ${item.action || 'N/A'}`);
        console.log(`Barrel Length:       ${item.barrelLength || 'N/A'}`);
        console.log(`Capacity:            ${item.capacity || 'N/A'}`);
        console.log(`Finish:              ${item.finish || 'N/A'}`);
        console.log(`Overall Length:      ${item.overallLength || 'N/A'}`);
        console.log(`Weight:              ${item.weight || 'N/A'}`);
        console.log(`Shipping Weight:     ${item.shippingWeight || 'N/A'}`);
        console.log();
        console.log('🖼️  IMAGE FIELDS:');
        console.log('-'.repeat(80));
        console.log(`Image Name:          ${item.imageName || 'N/A'}`);
        if (item.imageName) {
          console.log(`Constructed URL:     https://www.lipseyscloud.com/images/${item.imageName}`);
        }
        console.log();
        console.log('🔫 FIREARMS COMPLIANCE:');
        console.log('-'.repeat(80));
        console.log(`FFL Required:        ${item.fflRequired ? 'Yes' : 'No'}`);
        console.log(`SOT Required:        ${item.sotRequired ? 'Yes' : 'No'}`);
        console.log(`Bound Book Mfg:      ${item.boundBookManufacturer || 'N/A'}`);
        console.log(`Bound Book Model:    ${item.boundBookModel || 'N/A'}`);
        console.log(`Bound Book Type:     ${item.boundBookType || 'N/A'}`);
        console.log();
      }
    } else {
      console.log('⚠️  No catalog items returned');
    }

    // Step 5: Test specific item lookup (if we have an item number)
    if (catalogItems && catalogItems.length > 0 && catalogItems[0].itemNo) {
      console.log('\n\n' + '='.repeat(80));
      console.log('📦 Step 5: Testing specific item lookup...');
      console.log('='.repeat(80));
      
      const itemNumber = catalogItems[0].itemNo;
      console.log(`Fetching item: ${itemNumber}`);
      const specificItem = await api.getCatalogItem(itemNumber);
      
      if (specificItem) {
        console.log('\n✅ Successfully retrieved specific item');
        console.log('\n🔍 FULL ITEM RESPONSE:');
        console.log(JSON.stringify(specificItem, null, 2));
      } else {
        console.log('⚠️  Could not retrieve specific item');
      }
    }

    // Step 6: Test UPC search
    if (catalogItems && catalogItems.length > 0 && catalogItems[0].upc) {
      console.log('\n\n' + '='.repeat(80));
      console.log('🔍 Step 6: Testing UPC search...');
      console.log('='.repeat(80));
      
      const upc = catalogItems[0].upc;
      console.log(`Searching for UPC: ${upc}`);
      const searchResult = await api.searchProduct({ upc });
      
      console.log('\n✅ Search result:');
      console.log(JSON.stringify(searchResult, null, 2));
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ TESTING COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log('📝 SUMMARY:');
    console.log(`   - Total items in catalog: ${catalogItems?.length || 0}`);
    console.log(`   - Sample items examined: ${Math.min(5, catalogItems?.length || 0)}`);
    console.log();
    console.log('🎯 NEXT STEPS:');
    console.log('   1. Review the field mappings above');
    console.log('   2. Verify which fields are consistently populated');
    console.log('   3. Determine best fields for Master Product Catalog integration');
    console.log('   4. Update field mapping configuration based on actual data');
    console.log();

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Run the test
testLipseysAPIResponses();


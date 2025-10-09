/**
 * Force a fresh Bill Hicks store-level sync for a specific company
 * This script:
 * 1. Deletes all existing Bill Hicks vendor_product_mappings for the company
 * 2. Deletes the cached previous pricing file
 * 3. Triggers a fresh sync
 */

import { db } from '../server/db';
import { vendorProductMappings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { syncStoreSpecificBillHicksPricing } from '../server/bill-hicks-store-pricing-sync';
import * as fs from 'fs';
import * as path from 'path';

const COMPANY_ID = 1; // Phil's Guns
const BILL_HICKS_SUPPORTED_VENDOR_ID = 3; // Bill Hicks in supported_vendors table

async function forceBillHicksSync() {
  console.log('🔄 FORCE SYNC: Starting fresh Bill Hicks sync for company', COMPANY_ID);
  
  try {
    // Step 1: Delete all existing Bill Hicks mappings for this company
    console.log('🗑️  Step 1: Deleting existing Bill Hicks vendor_product_mappings...');
    const deleteResult = await db
      .delete(vendorProductMappings)
      .where(
        and(
          eq(vendorProductMappings.companyId, COMPANY_ID),
          eq(vendorProductMappings.supportedVendorId, BILL_HICKS_SUPPORTED_VENDOR_ID)
        )
      )
      .returning({ id: vendorProductMappings.id });
    
    console.log(`✅ Deleted ${deleteResult.length} existing mappings`);
    
    // Step 2: Delete cached previous pricing file
    console.log('🗑️  Step 2: Deleting cached pricing file...');
    const downloadsDir = path.join(process.cwd(), 'downloads', 'bill-hicks-stores');
    const previousFile = path.join(downloadsDir, `company_${COMPANY_ID}_previous_pricing.csv`);
    
    if (fs.existsSync(previousFile)) {
      fs.unlinkSync(previousFile);
      console.log('✅ Deleted previous pricing file');
    } else {
      console.log('ℹ️  No previous pricing file found (already clean)');
    }
    
    // Step 3: Run the sync
    console.log('🔄 Step 3: Running fresh sync...');
    console.log('⏰ This will take 30-60 seconds as it processes all records...');
    console.log('');
    
    const result = await syncStoreSpecificBillHicksPricing(COMPANY_ID);
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🎉 SYNC COMPLETE!');
    console.log('═══════════════════════════════════════');
    console.log('Success:', result.success);
    console.log('Message:', result.message);
    console.log('Stats:', JSON.stringify(result.stats, null, 2));
    console.log('═══════════════════════════════════════');
    
    if (result.success) {
      console.log('✅ Bill Hicks sync completed successfully!');
      process.exit(0);
    } else {
      console.error('❌ Sync failed:', result.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Force sync failed:', error);
    console.error('Stack:', (error as Error).stack);
    process.exit(1);
  }
}

// Run the script
forceBillHicksSync();



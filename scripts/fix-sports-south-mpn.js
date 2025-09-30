#!/usr/bin/env node
/**
 * Script to fix Sports South manufacturer part numbers
 * Updates products that incorrectly have ITEMNO as manufacturerPartNumber
 * instead of the correct IMFGNO field from Sports South API
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixSportsSouthManufacturerPartNumbers() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Starting Sports South manufacturer part number fix...');
    
    // Get Sports South vendor ID
    const vendorResult = await client.query(
      "SELECT id FROM supported_vendors WHERE name ILIKE '%sports south%'"
    );
    
    if (vendorResult.rows.length === 0) {
      console.log('❌ Sports South vendor not found');
      return;
    }
    
    const sportsSouthVendorId = vendorResult.rows[0].id;
    console.log(`✅ Found Sports South vendor ID: ${sportsSouthVendorId}`);
    
    // Find products with incorrect manufacturer part numbers
    // These are products where manufacturerPartNumber = vendor_sku (ITEMNO)
    const incorrectProducts = await client.query(`
      SELECT 
        p.id,
        p.upc,
        p.name,
        p.manufacturer_part_number as current_mpn,
        vpm.vendor_sku as sports_south_itemno,
        vpm.vendor_data
      FROM products p
      JOIN vendor_product_mappings vpm ON p.id = vpm.product_id
      WHERE vpm.supported_vendor_id = $1
        AND p.manufacturer_part_number = vpm.vendor_sku
    `, [sportsSouthVendorId]);
    
    console.log(`📊 Found ${incorrectProducts.rows.length} products with incorrect manufacturer part numbers`);
    
    if (incorrectProducts.rows.length === 0) {
      console.log('✅ No products need fixing');
      return;
    }
    
    // Show examples of what will be fixed
    console.log('\n🔍 Examples of products that will be fixed:');
    for (let i = 0; i < Math.min(5, incorrectProducts.rows.length); i++) {
      const product = incorrectProducts.rows[i];
      console.log(`  - UPC: ${product.upc}`);
      console.log(`    Name: ${product.name.substring(0, 60)}...`);
      console.log(`    Current MPN: ${product.current_mpn} (Sports South ITEMNO)`);
      console.log(`    Should be: [Extract from IMFGNO or product name]`);
      console.log('');
    }
    
    // For now, we'll clear the incorrect manufacturer part numbers
    // The next sync will populate them correctly using IMFGNO
    console.log('🔄 Clearing incorrect manufacturer part numbers...');
    
    const updateResult = await client.query(`
      UPDATE products 
      SET manufacturer_part_number = NULL
      WHERE id IN (
        SELECT p.id
        FROM products p
        JOIN vendor_product_mappings vpm ON p.id = vpm.product_id
        WHERE vpm.supported_vendor_id = $1
          AND p.manufacturer_part_number = vpm.vendor_sku
      )
    `, [sportsSouthVendorId]);
    
    console.log(`✅ Updated ${updateResult.rowCount} products - cleared incorrect manufacturer part numbers`);
    console.log('📝 Next Sports South sync will populate correct IMFGNO values');
    
    // Show summary
    const summary = await client.query(`
      SELECT 
        COUNT(*) as total_sports_south_products,
        COUNT(p.manufacturer_part_number) as products_with_mpn,
        COUNT(*) - COUNT(p.manufacturer_part_number) as products_without_mpn
      FROM products p
      JOIN vendor_product_mappings vpm ON p.id = vpm.product_id
      WHERE vpm.supported_vendor_id = $1
    `, [sportsSouthVendorId]);
    
    const stats = summary.rows[0];
    console.log('\n📊 Sports South Products Summary:');
    console.log(`  - Total Products: ${stats.total_sports_south_products}`);
    console.log(`  - With MPN: ${stats.products_with_mpn}`);
    console.log(`  - Without MPN: ${stats.products_without_mpn}`);
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
fixSportsSouthManufacturerPartNumbers()
  .then(() => {
    console.log('🎉 Sports South MPN fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
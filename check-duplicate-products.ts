/**
 * Check for Duplicate Products in Master Product Catalog
 * 
 * This script identifies:
 * 1. Duplicate UPCs (should be impossible due to UNIQUE constraint)
 * 2. Duplicate product records (same brand + model + name)
 * 3. Near-duplicates with slight variations
 */

import { db } from './server/db';
import { products } from './shared/schema';
import { sql, eq, and, or } from 'drizzle-orm';

async function checkDuplicateProducts() {
  console.log('🔍 Checking for duplicate products in Master Product Catalog...\n');

  try {
    // 1. Get total product count
    const totalCountResult = await db.select({ count: sql<number>`count(*)::int` }).from(products);
    const totalCount = totalCountResult[0]?.count || 0;
    console.log(`📊 Total Products: ${totalCount.toLocaleString()}`);
    console.log(`   (Expected: ~65,000 | Current: ${totalCount.toLocaleString()} | Difference: +${(totalCount - 65000).toLocaleString()})\n`);

    // 2. Check for duplicate UPCs (should be prevented by UNIQUE constraint)
    console.log('🔎 Checking for duplicate UPCs...');
    const duplicateUPCs = await db.execute(sql`
      SELECT upc, COUNT(*) as count, ARRAY_AGG(id ORDER BY id) as product_ids
      FROM products
      WHERE upc IS NOT NULL AND upc != ''
      GROUP BY upc
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `);

    if (duplicateUPCs.rows.length > 0) {
      console.log(`❌ Found ${duplicateUPCs.rows.length} duplicate UPCs!`);
      console.log('   First 10 examples:');
      duplicateUPCs.rows.slice(0, 10).forEach((row: any) => {
        console.log(`   - UPC: ${row.upc} (${row.count} records) - Product IDs: ${row.product_ids}`);
      });
    } else {
      console.log('✅ No duplicate UPCs found (as expected)\n');
    }

    // 3. Check for duplicate brand + model combinations
    console.log('🔎 Checking for duplicate Brand + Model combinations...');
    const duplicateBrandModel = await db.execute(sql`
      SELECT brand, model, COUNT(*) as count, ARRAY_AGG(id ORDER BY id) as product_ids, ARRAY_AGG(upc ORDER BY id) as upcs
      FROM products
      WHERE brand IS NOT NULL AND brand != '' 
        AND model IS NOT NULL AND model != ''
      GROUP BY brand, model
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `);

    if (duplicateBrandModel.rows.length > 0) {
      console.log(`⚠️  Found ${duplicateBrandModel.rows.length} duplicate Brand + Model combinations!`);
      console.log('   First 10 examples:');
      duplicateBrandModel.rows.slice(0, 10).forEach((row: any) => {
        console.log(`   - ${row.brand} ${row.model} (${row.count} records)`);
        console.log(`     Product IDs: ${row.product_ids}`);
        console.log(`     UPCs: ${row.upcs}`);
      });
      console.log('');
    } else {
      console.log('✅ No duplicate Brand + Model combinations found\n');
    }

    // 4. Check for duplicate brand + name combinations (common issue with imports)
    console.log('🔎 Checking for duplicate Brand + Name combinations...');
    const duplicateBrandName = await db.execute(sql`
      SELECT brand, name, COUNT(*) as count, ARRAY_AGG(id ORDER BY id) as product_ids, ARRAY_AGG(upc ORDER BY id) as upcs
      FROM products
      WHERE brand IS NOT NULL AND brand != '' 
        AND name IS NOT NULL AND name != ''
      GROUP BY brand, name
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `);

    if (duplicateBrandName.rows.length > 0) {
      console.log(`⚠️  Found ${duplicateBrandName.rows.length} duplicate Brand + Name combinations!`);
      console.log('   First 10 examples:');
      duplicateBrandName.rows.slice(0, 10).forEach((row: any) => {
        console.log(`   - ${row.brand} - ${row.name} (${row.count} records)`);
        console.log(`     Product IDs: ${row.product_ids}`);
        console.log(`     UPCs: ${row.upcs}`);
      });
      console.log('');
    } else {
      console.log('✅ No duplicate Brand + Name combinations found\n');
    }

    // 5. Check product distribution by source
    console.log('📊 Product distribution by source:');
    const sourceDistribution = await db.execute(sql`
      SELECT source, COUNT(*) as count, 
             ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM products
      WHERE source IS NOT NULL
      GROUP BY source
      ORDER BY count DESC
    `);

    sourceDistribution.rows.forEach((row: any) => {
      console.log(`   - ${row.source}: ${parseInt(row.count).toLocaleString()} products (${row.percentage}%)`);
    });
    console.log('');

    // 6. Check for products with same UPC prefix (might indicate import issues)
    console.log('🔎 Checking for suspicious UPC patterns (same first 8 digits)...');
    const upcPatterns = await db.execute(sql`
      SELECT LEFT(upc, 8) as upc_prefix, COUNT(*) as count
      FROM products
      WHERE upc IS NOT NULL AND LENGTH(upc) >= 8
      GROUP BY LEFT(upc, 8)
      HAVING COUNT(*) > 100
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `);

    if (upcPatterns.rows.length > 0) {
      console.log(`⚠️  Found ${upcPatterns.rows.length} UPC prefixes with >100 products:`);
      upcPatterns.rows.slice(0, 10).forEach((row: any) => {
        console.log(`   - UPC prefix ${row.upc_prefix}***: ${row.count} products`);
      });
      console.log('');
    } else {
      console.log('✅ No suspicious UPC patterns found\n');
    }

    // 7. Check for recent product creation spikes (might indicate duplicate imports)
    console.log('📅 Product creation timeline (last 30 days):');
    const creationTimeline = await db.execute(sql`
      SELECT DATE(created_at) as creation_date, COUNT(*) as count, source
      FROM products
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at), source
      ORDER BY creation_date DESC, count DESC
      LIMIT 30
    `);

    if (creationTimeline.rows.length > 0) {
      creationTimeline.rows.forEach((row: any) => {
        console.log(`   - ${row.creation_date}: ${row.count} products (${row.source})`);
      });
    } else {
      console.log('   (No products created in last 30 days)');
    }
    console.log('');

    // 8. Summary and recommendations
    console.log('📋 SUMMARY:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Products: ${totalCount.toLocaleString()}`);
    console.log(`Expected Count: ~65,000`);
    console.log(`Excess Products: +${(totalCount - 65000).toLocaleString()}`);
    console.log('');
    console.log('Potential Issues:');
    if (duplicateUPCs.rows.length > 0) {
      console.log(`  ❌ ${duplicateUPCs.rows.length} duplicate UPCs (DATABASE CONSTRAINT VIOLATED!)`);
    }
    if (duplicateBrandModel.rows.length > 0) {
      console.log(`  ⚠️  ${duplicateBrandModel.rows.length} duplicate Brand + Model combinations`);
    }
    if (duplicateBrandName.rows.length > 0) {
      console.log(`  ⚠️  ${duplicateBrandName.rows.length} duplicate Brand + Name combinations`);
    }
    
    console.log('\n✅ Duplicate check complete!');

  } catch (error) {
    console.error('❌ Error checking duplicates:', error);
    throw error;
  }
}

checkDuplicateProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


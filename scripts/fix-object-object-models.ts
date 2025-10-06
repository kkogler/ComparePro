#!/usr/bin/env tsx
/**
 * Fix [object Object] in model fields
 * 
 * This script finds and fixes products that have "[object Object]" stored in the model field.
 * This happened during Sports South syncs when the XML parser returned objects instead of strings.
 */

import { db } from '../server/db';
import { products } from '../shared/schema';
import { like, eq } from 'drizzle-orm';

const dryRun = !process.argv.includes('--fix');

console.log('================================================================================');
console.log('Fixing [object Object] in Model Fields');
console.log('================================================================================');
console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE MODE (applying fixes)'}`);
console.log('================================================================================\n');

// Find all products with [object Object] in model field
const badProducts = await db.select()
  .from(products)
  .where(like(products.model, '%object Object%'));

console.log(`Found ${badProducts.length} products with bad model data\n`);

if (badProducts.length === 0) {
  console.log('✅ No products need fixing!');
  process.exit(0);
}

// Show first 10 examples
console.log('Examples of affected products:');
console.log('-'.repeat(80));
badProducts.slice(0, 10).forEach((p, i) => {
  console.log(`${i + 1}. UPC: ${p.upc}`);
  console.log(`   Name: ${p.name.substring(0, 60)}`);
  console.log(`   Brand: ${p.brand}`);
  console.log(`   Model: ${p.model}`);
  console.log(`   MPN: ${p.manufacturerPartNumber || '(none)'}`);
  console.log();
});

if (badProducts.length > 10) {
  console.log(`... and ${badProducts.length - 10} more\n`);
}

if (dryRun) {
  console.log('================================================================================');
  console.log('💡 To fix these products, run:');
  console.log('   tsx scripts/fix-object-object-models.ts --fix');
  console.log('================================================================================');
  console.log('\nFix options:');
  console.log('1. Set model to NULL (cleanest - let next sync repopulate)');
  console.log('2. Try to extract from manufacturer part number');
  console.log('3. Leave as-is and wait for next Sports South sync');
  process.exit(0);
}

// Apply fixes
console.log('================================================================================');
console.log('Applying fixes...');
console.log('================================================================================\n');

let fixed = 0;
let failed = 0;

for (const product of badProducts) {
  try {
    // Strategy: Set model to NULL so it doesn't show "[object Object]"
    // Next Sports South sync will repopulate with correct data
    await db.update(products)
      .set({ 
        model: null,
        updatedAt: new Date()
      })
      .where(eq(products.id, product.id));
    
    fixed++;
    
    if (fixed % 100 === 0) {
      console.log(`Fixed ${fixed} products...`);
    }
  } catch (error: any) {
    console.error(`Failed to fix product ${product.id}: ${error.message}`);
    failed++;
  }
}

console.log('\n================================================================================');
console.log('RESULTS:');
console.log('================================================================================');
console.log(`✅ Fixed: ${fixed} products`);
console.log(`❌ Failed: ${failed} products`);
console.log(`📊 Total: ${badProducts.length} products`);
console.log('================================================================================');
console.log('\n💡 Next Steps:');
console.log('1. Run a Sports South catalog sync to repopulate model numbers');
console.log('2. Or wait for next scheduled sync');
console.log('3. Model field will show as empty until repopulated');
console.log('================================================================================');

process.exit(0);


/**
 * Migration: Convert products.source from vendor names to vendor slugs
 * 
 * This migration updates all existing products to use vendor slugs (vendorShortCode)
 * instead of vendor full names in the source field, enabling consistent priority matching.
 * 
 * Mappings:
 * - "Sports South" → "sports_south"
 * - "Bill Hicks & Co." → "bill-hicks"
 * - "Chattanooga Shooting Supplies" → "chattanooga"
 * - "Lipsey's Inc." → "lipseys" (already using slug, but included for completeness)
 * - "GunBroker.com" → "gunbroker"
 */

import { db } from '../server/db';
import { products } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';

// Mapping of old vendor names to new slugs
const VENDOR_NAME_TO_SLUG_MAP: Record<string, string> = {
  'Sports South': 'sports_south',
  'Bill Hicks & Co.': 'bill-hicks',
  'Chattanooga Shooting Supplies': 'chattanooga',
  "Lipsey's Inc.": 'lipseys',
  'Lipseys': 'lipseys',
  "Lipsey's": 'lipseys',
  'GunBroker.com': 'gunbroker',
  'GunBroker': 'gunbroker',
  'gunbroker': 'gunbroker'
};

async function migrateProductSourcesToSlugs() {
  console.log('================================================================================');
  console.log('MIGRATION: Convert products.source from names to slugs');
  console.log('================================================================================\n');

  try {
    console.log('Step 1: Analyzing current product sources...\n');
    
    // Get distinct source values from products table
    const distinctSources = await db
      .selectDistinct({ source: products.source })
      .from(products)
      .where(sql`${products.source} IS NOT NULL`);

    console.log(`Found ${distinctSources.length} distinct source values:`);
    for (const { source } of distinctSources) {
      const slug = VENDOR_NAME_TO_SLUG_MAP[source || ''] || '(no mapping)';
      console.log(`  • "${source}" → "${slug}"`);
    }
    console.log();

    // Count products per source
    console.log('Step 2: Counting products per source...\n');
    const sourceCounts = await db
      .select({
        source: products.source,
        count: sql<number>`cast(count(*) as integer)`
      })
      .from(products)
      .where(sql`${products.source} IS NOT NULL`)
      .groupBy(products.source);

    console.log('Products by source:');
    for (const { source, count } of sourceCounts) {
      console.log(`  • ${source}: ${count} products`);
    }
    console.log();

    // Perform migrations
    console.log('Step 3: Migrating product sources to slugs...\n');
    
    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const [oldName, newSlug] of Object.entries(VENDOR_NAME_TO_SLUG_MAP)) {
      // Skip if already using slug
      if (oldName === newSlug) {
        console.log(`  ⊘ Skipping "${oldName}" (already using slug)`);
        const count = sourceCounts.find(s => s.source === oldName)?.count || 0;
        totalSkipped += count;
        continue;
      }

      // Update products with this source
      const result = await db
        .update(products)
        .set({ source: newSlug, updatedAt: new Date() })
        .where(eq(products.source, oldName));

      const affected = result.rowCount || 0;
      totalUpdated += affected;
      
      if (affected > 0) {
        console.log(`  ✓ Updated ${affected} products: "${oldName}" → "${newSlug}"`);
      } else {
        console.log(`  • No products found with source "${oldName}"`);
      }
    }

    console.log();
    console.log('Step 4: Verification...\n');

    // Get updated distinct sources
    const updatedSources = await db
      .selectDistinct({ source: products.source })
      .from(products)
      .where(sql`${products.source} IS NOT NULL`);

    console.log(`After migration, found ${updatedSources.length} distinct source values:`);
    for (const { source } of updatedSources) {
      console.log(`  • "${source}"`);
    }
    console.log();

    // Check for any unmapped sources
    const unmappedSources = updatedSources.filter(
      ({ source }) => source && !Object.values(VENDOR_NAME_TO_SLUG_MAP).includes(source)
    );

    if (unmappedSources.length > 0) {
      console.log('⚠️  WARNING: Found unmapped source values:');
      for (const { source } of unmappedSources) {
        const count = sourceCounts.find(s => s.source === source)?.count || 0;
        console.log(`  • "${source}" (${count} products) - may need manual review`);
      }
      console.log();
    }

    console.log('================================================================================');
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
    console.log(`   • Total products updated: ${totalUpdated}`);
    console.log(`   • Total products skipped (already using slugs): ${totalSkipped}`);
    console.log('================================================================================');

  } catch (error: any) {
    console.error('================================================================================');
    console.error('❌ MIGRATION FAILED');
    console.error('================================================================================');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    throw error;
  }
}

// Run migration
migrateProductSourcesToSlugs()
  .then(() => {
    console.log('\nMigration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration script failed:', error);
    process.exit(1);
  });



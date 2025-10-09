#!/usr/bin/env tsx
/**
 * Migration Script: Normalize Vendor Slugs
 * 
 * Problem: Historical vendor records have inconsistent slug formats:
 * - billing-service.ts created: "chattanooga-{companyId}" (e.g., "chattanooga-5")
 * - storage.ts created: "chattanooga" (just the vendorShortCode)
 * 
 * Solution: Update all vendor slugs to match their vendorShortCode
 * 
 * Usage:
 *   tsx scripts/normalize-vendor-slugs.ts
 *   tsx scripts/normalize-vendor-slugs.ts --dry-run  (preview changes without applying)
 */

import { db } from '../server/db';
import { vendors } from '../shared/schema';
import { eq, and, ne, isNotNull, sql } from 'drizzle-orm';

const isDryRun = process.argv.includes('--dry-run');

async function normalizeVendorSlugs() {
  console.log('🔍 VENDOR SLUG NORMALIZATION');
  console.log('========================================');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}\n`);

  try {
    // Step 1: Find all vendors with mismatched slugs
    console.log('📊 Step 1: Finding vendors with non-standard slugs...\n');
    
    const mismatchedVendors = await db.select({
      id: vendors.id,
      name: vendors.name,
      slug: vendors.slug,
      vendorShortCode: vendors.vendorShortCode,
      companyId: vendors.companyId,
    })
    .from(vendors)
    .where(
      and(
        isNotNull(vendors.vendorShortCode),
        ne(vendors.slug, vendors.vendorShortCode)
      )
    )
    .orderBy(vendors.companyId, vendors.name);

    if (mismatchedVendors.length === 0) {
      console.log('✅ All vendor slugs are already normalized. No changes needed.');
      return;
    }

    console.log(`Found ${mismatchedVendors.length} vendor(s) with non-standard slugs:\n`);
    
    console.table(mismatchedVendors.map(v => ({
      ID: v.id,
      Name: v.name.substring(0, 30),
      'Old Slug': v.slug,
      'Vendor Short Code': v.vendorShortCode,
      'Company ID': v.companyId,
    })));
    console.log('');

    if (isDryRun) {
      console.log('🔍 DRY RUN MODE: No changes will be applied.');
      console.log('   Run without --dry-run flag to apply these changes.\n');
      return;
    }

    // Step 2: Update vendor slugs to match vendorShortCode
    console.log('🔄 Step 2: Normalizing vendor slugs...\n');
    
    let updatedCount = 0;
    for (const vendor of mismatchedVendors) {
      if (!vendor.vendorShortCode) continue;
      
      await db.update(vendors)
        .set({
          slug: vendor.vendorShortCode,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendor.id));
      
      console.log(`  ✅ Updated: ${vendor.name}`);
      console.log(`     Old slug: "${vendor.slug}" → New slug: "${vendor.vendorShortCode}"\n`);
      updatedCount++;
    }

    console.log('========================================');
    console.log(`✅ SUCCESS: Normalized ${updatedCount} vendor slug(s)\n`);

    // Step 3: Verify results
    console.log('🔍 Step 3: Verifying normalization...\n');
    
    const remainingMismatches = await db.select({
      id: vendors.id,
      name: vendors.name,
      slug: vendors.slug,
      vendorShortCode: vendors.vendorShortCode,
    })
    .from(vendors)
    .where(
      and(
        isNotNull(vendors.vendorShortCode),
        ne(vendors.slug, vendors.vendorShortCode)
      )
    );

    if (remainingMismatches.length === 0) {
      console.log('✅ Verification passed: All vendor slugs are now normalized.');
    } else {
      console.warn(`⚠️  Warning: ${remainingMismatches.length} vendor(s) still have mismatched slugs:`);
      console.table(remainingMismatches);
    }

    // Step 4: Show summary
    console.log('\n📊 Final Summary:');
    const allVendors = await db.select({
      slug: vendors.slug,
      vendorShortCode: vendors.vendorShortCode,
    }).from(vendors);

    const normalized = allVendors.filter(v => v.vendorShortCode && v.slug === v.vendorShortCode).length;
    const nullShortCode = allVendors.filter(v => !v.vendorShortCode).length;
    const total = allVendors.length;

    console.log(`  Total vendors: ${total}`);
    console.log(`  Normalized: ${normalized}`);
    console.log(`  Null vendorShortCode: ${nullShortCode}`);
    console.log(`  Remaining mismatches: ${remainingMismatches.length}`);

  } catch (error) {
    console.error('❌ ERROR during migration:', error);
    throw error;
  }
}

// Run the migration
normalizeVendorSlugs()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });


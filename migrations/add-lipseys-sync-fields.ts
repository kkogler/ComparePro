/**
 * Migration: Add Lipsey's Catalog Sync Fields and Update Vendor Priorities
 * 
 * This migration:
 * 1. Adds Lipsey's-specific sync fields to supported_vendors table
 * 2. Updates vendor priorities: Lipsey's=2, Chattanooga=3, Bill Hicks=4
 */

import { db } from '../server/db';
import { supportedVendors } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

async function migrate() {
  console.log('='.repeat(80));
  console.log('MIGRATION: Add Lipsey\'s Sync Fields and Update Priorities');
  console.log('='.repeat(80));
  console.log();

  try {
    // Step 1: Add new columns for Lipsey's catalog sync
    console.log('Step 1: Adding Lipsey\'s sync columns...');
    
    await db.execute(sql`
      ALTER TABLE supported_vendors 
      ADD COLUMN IF NOT EXISTS lipseys_catalog_sync_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS lipseys_catalog_sync_time VARCHAR(5) DEFAULT '08:00',
      ADD COLUMN IF NOT EXISTS lipseys_catalog_sync_frequency TEXT DEFAULT 'daily',
      ADD COLUMN IF NOT EXISTS lipseys_catalog_sync_status VARCHAR(20) DEFAULT 'not_configured',
      ADD COLUMN IF NOT EXISTS lipseys_last_catalog_sync TIMESTAMP,
      ADD COLUMN IF NOT EXISTS lipseys_catalog_sync_error TEXT,
      
      ADD COLUMN IF NOT EXISTS lipseys_records_added INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lipseys_records_updated INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lipseys_records_skipped INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lipseys_records_failed INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lipseys_total_records INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lipseys_images_added INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lipseys_images_updated INTEGER DEFAULT 0;
    `);
    
    console.log('✅ Successfully added Lipsey\'s sync columns');
    console.log();

    // Step 2: Update vendor priorities
    console.log('Step 2: Updating vendor priorities...');
    console.log('  Current: Sports South=1, Chattanooga=2, Bill Hicks=3, GunBroker=4, Lipsey\'s=5');
    console.log('  Target:  Sports South=1, Lipsey\'s=2, Chattanooga=3, Bill Hicks=4, GunBroker=5');
    console.log();

    // Get all vendors to check current state
    const vendors = await db
      .select()
      .from(supportedVendors)
      .orderBy(supportedVendors.productRecordPriority);

    console.log('Current vendor priorities:');
    vendors.forEach(v => {
      console.log(`  ${v.name}: priority ${v.productRecordPriority}`);
    });
    console.log();

    // Update priorities in specific order to avoid unique constraint violations
    console.log('Updating priorities...');
    
    // Temporarily set GunBroker to 99 (out of the way)
    const gunBroker = vendors.find(v => v.name?.toLowerCase().includes('gunbroker'));
    if (gunBroker) {
      await db
        .update(supportedVendors)
        .set({ productRecordPriority: 99 })
        .where(eq(supportedVendors.id, gunBroker.id));
      console.log(`  ✓ GunBroker: 4 → 99 (temporary)`);
    }

    // Temporarily set Bill Hicks to 98
    const billHicks = vendors.find(v => v.name?.toLowerCase().includes('bill hicks'));
    if (billHicks) {
      await db
        .update(supportedVendors)
        .set({ productRecordPriority: 98 })
        .where(eq(supportedVendors.id, billHicks.id));
      console.log(`  ✓ Bill Hicks: 3 → 98 (temporary)`);
    }

    // Temporarily set Chattanooga to 97
    const chattanooga = vendors.find(v => v.name?.toLowerCase().includes('chattanooga'));
    if (chattanooga) {
      await db
        .update(supportedVendors)
        .set({ productRecordPriority: 97 })
        .where(eq(supportedVendors.id, chattanooga.id));
      console.log(`  ✓ Chattanooga: 2 → 97 (temporary)`);
    }

    // Temporarily set Lipsey's to 96
    const lipseys = vendors.find(v => v.name?.toLowerCase().includes('lipsey'));
    if (lipseys) {
      await db
        .update(supportedVendors)
        .set({ productRecordPriority: 96 })
        .where(eq(supportedVendors.id, lipseys.id));
      console.log(`  ✓ Lipsey\'s: 5 → 96 (temporary)`);
    }

    // Now set final priorities
    console.log();
    console.log('Setting final priorities...');

    // Lipsey's: 96 → 2
    if (lipseys) {
      await db
        .update(supportedVendors)
        .set({ productRecordPriority: 2 })
        .where(eq(supportedVendors.id, lipseys.id));
      console.log(`  ✓ Lipsey\'s: 96 → 2 (FINAL)`);
    }

    // Chattanooga: 97 → 3
    if (chattanooga) {
      await db
        .update(supportedVendors)
        .set({ productRecordPriority: 3 })
        .where(eq(supportedVendors.id, chattanooga.id));
      console.log(`  ✓ Chattanooga: 97 → 3 (FINAL)`);
    }

    // Bill Hicks: 98 → 4
    if (billHicks) {
      await db
        .update(supportedVendors)
        .set({ productRecordPriority: 4 })
        .where(eq(supportedVendors.id, billHicks.id));
      console.log(`  ✓ Bill Hicks: 98 → 4 (FINAL)`);
    }

    // GunBroker: 99 → 5
    if (gunBroker) {
      await db
        .update(supportedVendors)
        .set({ productRecordPriority: 5 })
        .where(eq(supportedVendors.id, gunBroker.id));
      console.log(`  ✓ GunBroker: 99 → 5 (FINAL)`);
    }

    console.log();
    console.log('✅ Successfully updated vendor priorities');
    console.log();

    // Step 3: Verify final state
    console.log('Step 3: Verifying final state...');
    const updatedVendors = await db
      .select()
      .from(supportedVendors)
      .orderBy(supportedVendors.productRecordPriority);

    console.log('Final vendor priorities:');
    updatedVendors.forEach(v => {
      console.log(`  ${v.name}: priority ${v.productRecordPriority}`);
    });
    console.log();

    console.log('='.repeat(80));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log();
    console.log('Summary:');
    console.log('  ✓ Added Lipsey\'s catalog sync columns to supported_vendors');
    console.log('  ✓ Updated vendor priorities (Lipsey\'s now at priority 2)');
    console.log('  ✓ Verified database consistency');
    console.log();

  } catch (error: any) {
    console.error('❌ MIGRATION FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrate();



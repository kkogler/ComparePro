#!/usr/bin/env node

/**
 * Restore missing retail vertical assignments for Sports South and Chattanooga
 * This fixes the data loss caused by the updateSupportedVendor bug
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import { eq, sql } from 'drizzle-orm';
import { supportedVendors, supportedVendorRetailVerticals, retailVerticals } from './shared/schema.js';

// Database connection
const sqlClient = neon(process.env.DATABASE_URL);
const db = drizzle(sqlClient);

async function restoreVendorData() {
  console.log('🔧 Restoring missing vendor retail vertical assignments...');
  
  try {
    // Check current state
    console.log('\n📊 Current vendor assignments:');
    const currentAssignments = await db
      .select({
        vendorId: supportedVendors.id,
        vendorName: supportedVendors.name,
        vendorShortCode: supportedVendors.vendorShortCode,
        retailVerticalId: supportedVendorRetailVerticals.retailVerticalId,
        priority: supportedVendorRetailVerticals.priority,
        retailVerticalName: retailVerticals.name
      })
      .from(supportedVendors)
      .leftJoin(supportedVendorRetailVerticals, eq(supportedVendors.id, supportedVendorRetailVerticals.supportedVendorId))
      .leftJoin(retailVerticals, eq(supportedVendorRetailVerticals.retailVerticalId, retailVerticals.id))
      .where(sql`lower(${supportedVendors.name}) LIKE '%sports south%' OR lower(${supportedVendors.name}) LIKE '%chattanooga%'`);
    
    console.table(currentAssignments);
    
    // Get firearms retail vertical
    const firearmsVertical = await db
      .select()
      .from(retailVerticals)
      .where(eq(retailVerticals.slug, 'firearms'))
      .limit(1);
    
    if (firearmsVertical.length === 0) {
      console.error('❌ Firearms retail vertical not found');
      return;
    }
    
    const firearmsVerticalId = firearmsVertical[0].id;
    console.log(`\n🎯 Using firearms retail vertical ID: ${firearmsVerticalId}`);
    
    // Find Sports South and Chattanooga vendors
    const vendors = await db
      .select()
      .from(supportedVendors)
      .where(sql`lower(${supportedVendors.name}) LIKE '%sports south%' OR lower(${supportedVendors.name}) LIKE '%chattanooga%'`);
    
    console.log(`\n🔍 Found ${vendors.length} vendors to restore:`);
    vendors.forEach(v => console.log(`  - ${v.name} (ID: ${v.id})`));
    
    // Check existing assignments for firearms vertical
    const existingAssignments = await db
      .select()
      .from(supportedVendorRetailVerticals)
      .where(eq(supportedVendorRetailVerticals.retailVerticalId, firearmsVerticalId));
    
    console.log(`\n📋 Existing assignments in firearms vertical: ${existingAssignments.length}`);
    
    // Get available priorities
    const assignedPriorities = existingAssignments.map(a => a.priority);
    const allPriorities = Array.from({ length: 25 }, (_, i) => i + 1);
    const availablePriorities = allPriorities.filter(p => !assignedPriorities.includes(p));
    
    console.log(`Available priorities: ${availablePriorities.slice(0, 10).join(', ')}${availablePriorities.length > 10 ? '...' : ''}`);
    
    // Restore assignments
    const restoredVendors = [];
    
    for (const vendor of vendors) {
      // Check if vendor already has assignment
      const existingAssignment = existingAssignments.find(a => a.supportedVendorId === vendor.id);
      
      if (existingAssignment) {
        console.log(`✅ ${vendor.name} already has assignment with priority ${existingAssignment.priority}`);
        restoredVendors.push({ name: vendor.name, status: 'already_assigned', priority: existingAssignment.priority });
        continue;
      }
      
      // Assign next available priority
      if (availablePriorities.length === 0) {
        console.error(`❌ No available priorities for ${vendor.name}`);
        restoredVendors.push({ name: vendor.name, status: 'no_priority_available' });
        continue;
      }
      
      const priority = Math.min(...availablePriorities);
      const priorityIndex = availablePriorities.indexOf(priority);
      availablePriorities.splice(priorityIndex, 1); // Remove from available
      
      // Insert assignment
      await db.insert(supportedVendorRetailVerticals).values({
        supportedVendorId: vendor.id,
        retailVerticalId: firearmsVerticalId,
        priority: priority,
      });
      
      console.log(`✅ Restored ${vendor.name} with priority ${priority}`);
      restoredVendors.push({ name: vendor.name, status: 'restored', priority: priority });
    }
    
    // Verify restoration
    console.log('\n📊 Final vendor assignments:');
    const finalAssignments = await db
      .select({
        vendorId: supportedVendors.id,
        vendorName: supportedVendors.name,
        vendorShortCode: supportedVendors.vendorShortCode,
        retailVerticalId: supportedVendorRetailVerticals.retailVerticalId,
        priority: supportedVendorRetailVerticals.priority,
        retailVerticalName: retailVerticals.name
      })
      .from(supportedVendors)
      .leftJoin(supportedVendorRetailVerticals, eq(supportedVendors.id, supportedVendorRetailVerticals.supportedVendorId))
      .leftJoin(retailVerticals, eq(supportedVendorRetailVerticals.retailVerticalId, retailVerticals.id))
      .where(sql`lower(${supportedVendors.name}) LIKE '%sports south%' OR lower(${supportedVendors.name}) LIKE '%chattanooga%'`);
    
    console.table(finalAssignments);
    
    console.log('\n🎉 Vendor data restoration completed!');
    console.log('Summary:', restoredVendors);
    
  } catch (error) {
    console.error('❌ Error restoring vendor data:', error);
  }
}

// Run the restoration
restoreVendorData()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

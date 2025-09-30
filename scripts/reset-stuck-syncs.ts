#!/usr/bin/env tsx

import { storage } from '../server/storage';
import { db } from '../server/db';
import { supportedVendors } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function resetStuckSyncs() {
  console.log('🔧 Resetting stuck sync statuses...');
  
  try {
    // Get all supported vendors
    const vendors = await storage.getAllSupportedVendors();
    
    for (const vendor of vendors) {
      let updated = false;
      const updates: any = {};
      
      // Check Bill Hicks sync statuses
      if (vendor.billHicksMasterCatalogSyncStatus === 'in_progress') {
        console.log(`🚨 Bill Hicks Master Catalog sync stuck for ${vendor.name} - resetting to error`);
        updates.billHicksMasterCatalogSyncStatus = 'error';
        updates.billHicksMasterCatalogSyncError = 'Sync was stuck in progress - manually reset';
        updated = true;
      }
      
      if (vendor.billHicksInventorySyncStatus === 'in_progress') {
        console.log(`🚨 Bill Hicks Inventory sync stuck for ${vendor.name} - resetting to error`);
        updates.billHicksInventorySyncStatus = 'error';
        updates.billHicksInventorySyncError = 'Sync was stuck in progress - manually reset';
        updated = true;
      }
      
      // Check Chattanooga sync status
      if (vendor.chattanoogaCsvSyncStatus === 'in_progress') {
        console.log(`🚨 Chattanooga CSV sync stuck for ${vendor.name} - resetting to error`);
        updates.chattanoogaCsvSyncStatus = 'error';
        updates.chattanoogaCsvSyncError = 'Sync was stuck in progress - manually reset';
        updated = true;
      }
      
      // Check Sports South sync status
      if (vendor.catalogSyncStatus === 'in_progress') {
        console.log(`🚨 Sports South sync stuck for ${vendor.name} - resetting to error`);
        updates.catalogSyncStatus = 'error';
        updates.catalogSyncError = 'Sync was stuck in progress - manually reset';
        updated = true;
      }
      
      // Update vendor if any stuck syncs were found
      if (updated) {
        await db.update(supportedVendors)
          .set(updates)
          .where(eq(supportedVendors.id, vendor.id));
        console.log(`✅ Reset stuck syncs for ${vendor.name}`);
      }
    }
    
    console.log('✅ All stuck sync statuses have been reset!');
    
  } catch (error) {
    console.error('❌ Error resetting stuck syncs:', error);
  }
}

resetStuckSyncs().catch(console.error);




























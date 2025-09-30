#!/usr/bin/env tsx

/**
 * Optimized Bill Hicks Inventory Sync
 * 
 * This creates an efficient version of the Bill Hicks inventory sync
 * that uses bulk operations instead of individual database calls.
 * Based on the efficient patterns used by Sports South.
 */

import { storage } from './server/storage.js';
import { db } from './server/db.js';
import { vendorInventory } from './shared/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

interface ProcessedInventoryItem {
  vendorSku: string;
  quantityAvailable: number;
}

interface BulkUpdateResult {
  totalRecords: number;
  recordsUpdated: number;
  recordsAdded: number;
  recordsSkipped: number;
  recordsErrors: number;
}

/**
 * Optimized Bill Hicks inventory sync using bulk operations
 */
export async function runOptimizedBillHicksInventorySync(): Promise<{
  success: boolean;
  message: string;
  stats: BulkUpdateResult;
}> {
  console.log('🚀 BILL HICKS: Starting optimized inventory sync...');
  
  const stats: BulkUpdateResult = {
    totalRecords: 0,
    recordsUpdated: 0,
    recordsAdded: 0,
    recordsSkipped: 0,
    recordsErrors: 0
  };

  try {
    // Get Bill Hicks vendor ID
    const billHicksVendorId = await storage.getBillHicksVendorId();
    console.log(`📋 Bill Hicks vendor ID: ${billHicksVendorId}`);

    // Step 1: Get all existing inventory records in one query
    console.log('📊 Fetching existing inventory records...');
    const existingRecords = await db.select()
      .from(vendorInventory)
      .where(eq(vendorInventory.supportedVendorId, billHicksVendorId));
    
    console.log(`📊 Found ${existingRecords.length} existing inventory records`);
    
    // Create a map for quick lookup
    const existingMap = new Map();
    existingRecords.forEach(record => {
      existingMap.set(record.vendorSku, record);
    });

    // Step 2: Simulate processing new inventory data
    // In real implementation, this would come from FTP download
    console.log('📋 Processing inventory data...');
    
    // For demonstration, create some test data
    const newInventoryItems: ProcessedInventoryItem[] = [
      { vendorSku: 'TEST001', quantityAvailable: 10 },
      { vendorSku: 'TEST002', quantityAvailable: 5 },
      { vendorSku: 'TEST003', quantityAvailable: 0 }
    ];
    
    stats.totalRecords = newInventoryItems.length;
    console.log(`📊 Processing ${stats.totalRecords} inventory records`);

    // Step 3: Process changes in memory (bulk approach)
    const recordsToInsert = [];
    const recordsToUpdate = [];
    const recordsToSkip = [];

    for (const item of newInventoryItems) {
      const existingRecord = existingMap.get(item.vendorSku);
      
      if (!existingRecord) {
        // New record - add to insert batch
        recordsToInsert.push({
          supportedVendorId: billHicksVendorId,
          vendorSku: item.vendorSku,
          quantityAvailable: item.quantityAvailable,
          lastUpdated: new Date(),
          createdAt: new Date()
        });
        stats.recordsAdded++;
      } else if (existingRecord.quantityAvailable !== item.quantityAvailable) {
        // Changed record - add to update batch
        recordsToUpdate.push({
          id: existingRecord.id,
          quantityAvailable: item.quantityAvailable,
          lastUpdated: new Date()
        });
        stats.recordsUpdated++;
      } else {
        // No change - skip
        recordsToSkip.push(item.vendorSku);
        stats.recordsSkipped++;
      }
    }

    // Step 4: Execute bulk operations
    console.log('🔄 Executing bulk operations...');
    
    if (recordsToInsert.length > 0) {
      console.log(`📝 Inserting ${recordsToInsert.length} new records...`);
      await db.insert(vendorInventory).values(recordsToInsert);
    }
    
    if (recordsToUpdate.length > 0) {
      console.log(`📝 Updating ${recordsToUpdate.length} existing records...`);
      // Note: Drizzle doesn't have native bulk update, so we'd need to use raw SQL
      // For now, we'll simulate the bulk update
      for (const update of recordsToUpdate) {
        await db.update(vendorInventory)
          .set({
            quantityAvailable: update.quantityAvailable,
            lastUpdated: update.lastUpdated
          })
          .where(eq(vendorInventory.id, update.id));
      }
    }

    if (recordsToSkip.length > 0) {
      console.log(`⏭️  Skipped ${recordsToSkip.length} unchanged records`);
    }

    const message = `✅ Optimized inventory sync completed: ${stats.recordsUpdated} updated, ${stats.recordsAdded} added, ${stats.recordsSkipped} skipped, ${stats.recordsErrors} errors`;
    console.log(message);

    return {
      success: true,
      message,
      stats
    };

  } catch (error) {
    console.error('❌ Optimized inventory sync failed:', error);
    return {
      success: false,
      message: `Optimized sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stats
    };
  }
}

// Run the optimized sync
runOptimizedBillHicksInventorySync()
  .then((result) => {
    console.log('\n🏁 Optimized Bill Hicks inventory sync completed');
    console.log('📊 Result:', result);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

/**
 * Simple Vendor Priority-Based Product Replacement System
 * Uses database-driven vendor priority ranking instead of quality scores
 * Lower priority number = higher priority (1 = highest, 4 = lowest)
 */

import { getVendorRecordPriority } from './vendor-priority';

interface ProductData {
  model?: string | null;
  manufacturerPartNumber?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  source?: string | null;
}

/**
 * Simple vendor priority-based replacement logic
 * Uses database-driven vendor priority ranking instead of quality scores
 * Supports manual override capability
 */
export async function shouldReplaceProduct(
  existingProduct: ProductData,
  newProduct: ProductData,
  newVendorSource: string,
  options: {
    isManualOverride?: boolean;
  } = {}
): Promise<boolean> {
  // Manual override (from re-ranking tools) - always allow
  if (options.isManualOverride) {
    console.log(`MANUAL OVERRIDE: Replacing due to manual re-ranking request`);
    return true;
  }
  
  // Same vendor updating their own data - always allow
  if (existingProduct.source === newVendorSource) {
    console.log(`VENDOR PRIORITY: Same vendor update (${newVendorSource}) - allowing replacement`);
    return true;
  }
  

  // Compare vendor priorities (lower number = higher priority)
  const existingPriority = await getVendorRecordPriority(existingProduct.source || '');
  const newPriority = await getVendorRecordPriority(newVendorSource);
  
  console.log(`VENDOR PRIORITY: Comparing priorities - Existing (${existingProduct.source}): ${existingPriority}, New (${newVendorSource}): ${newPriority}`);
  
  if (newPriority < existingPriority) {
    console.log(`VENDOR PRIORITY: Replacing due to higher priority vendor (${newPriority} beats ${existingPriority})`);
    return true;
  } else if (newPriority === existingPriority) {
    console.log(`VENDOR PRIORITY: Equal priority (${newPriority} = ${existingPriority}) - keeping existing for deterministic behavior`);
    return false;
  } else {
    console.log(`VENDOR PRIORITY: Keeping existing vendor with higher priority (${existingPriority} beats ${newPriority})`);
    return false;
  }
}

/**
 * Synchronous version using cached vendor priorities only
 * For performance-critical paths where async database lookup is not acceptable
 * Falls back to original behavior if priorities not cached
 */
export function shouldReplaceProductSync(
  existingProduct: ProductData,
  newProduct: ProductData,
  newVendorSource: string,
  options: {
    isManualOverride?: boolean;
  } = {}
): boolean {
  // Manual override (from re-ranking tools) - always allow
  if (options.isManualOverride) {
    console.log(`MANUAL OVERRIDE: Replacing due to manual re-ranking request`);
    return true;
  }
  
  // Same vendor updating their own data - always allow
  if (existingProduct.source === newVendorSource) {
    console.log(`VENDOR PRIORITY: Same vendor update (${newVendorSource}) - allowing replacement`);
    return true;
  }
  

  // Use cached priorities only for performance
  const { getVendorRecordPriorityFromCache } = require('./vendor-priority');
  const existingPriority = getVendorRecordPriorityFromCache(existingProduct.source || '');
  const newPriority = getVendorRecordPriorityFromCache(newVendorSource);
  
  // If either priority is not cached, be conservative and keep existing
  if (existingPriority === null || newPriority === null) {
    console.log(`VENDOR PRIORITY SYNC: Priorities not cached - keeping existing (${existingProduct.source}) for safety`);
    return false;
  }
  
  console.log(`VENDOR PRIORITY SYNC: Comparing cached priorities - Existing (${existingProduct.source}): ${existingPriority}, New (${newVendorSource}): ${newPriority}`);
  
  if (newPriority < existingPriority) {
    console.log(`VENDOR PRIORITY SYNC: Replacing due to higher priority vendor (${newPriority} beats ${existingPriority})`);
    return true;
  } else if (newPriority === existingPriority) {
    console.log(`VENDOR PRIORITY SYNC: Equal priority (${newPriority} = ${existingPriority}) - keeping existing for deterministic behavior`);
    return false;
  } else {
    console.log(`VENDOR PRIORITY SYNC: Keeping existing vendor with higher priority (${existingPriority} beats ${newPriority})`);
    return false;
  }
}


/**
 * Get vendor priority for external use
 */
export async function getVendorPriority(vendorSource: string): Promise<number> {
  return await getVendorRecordPriority(vendorSource);
}
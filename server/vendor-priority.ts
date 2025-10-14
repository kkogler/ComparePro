import { db } from "./db";
import { supportedVendors } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Vendor Priority Cache System
 * Simple in-memory cache with TTL for performance optimization
 */
interface CacheEntry {
  priority: number;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const DEFAULT_PRIORITY = 999; // Default priority for unknown/unranked vendors
const MIN_PRIORITY = 1; // Highest priority
// Note: MAX_PRIORITY is now dynamic based on number of vendors (removed hardcoded limit)

/**
 * Get vendor record priority from the database
 * Lower numbers indicate higher priority (1 = highest, N = lowest where N is total vendors)
 * Each vendor has a unique priority - no ties or tie-breaking needed
 * 
 * @param vendorSlug - The vendor slug/short code to lookup priority for (e.g., "lipseys", "sports-south")
 * @returns Promise<number> - The priority value (1-N) or 999 for unknown vendors
 */
export async function getVendorRecordPriority(vendorSlug: string): Promise<number> {
  if (!vendorSlug || typeof vendorSlug !== 'string') {
    console.log(`VENDOR PRIORITY: Invalid vendor slug provided: ${vendorSlug}`);
    return DEFAULT_PRIORITY;
  }

  const cacheKey = vendorSlug.toLowerCase().trim();
  const now = Date.now();

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`VENDOR PRIORITY: Cache hit for "${vendorSlug}" -> priority ${cached.priority}`);
    return cached.priority;
  }

  try {
    // Query database for vendor priority using vendorShortCode (slug) OR name
    // This handles both "sports-south" and "Sports South" lookups
    const [result] = await db
      .select({ 
        productRecordPriority: supportedVendors.productRecordPriority,
        vendorShortCode: supportedVendors.vendorShortCode,
        name: supportedVendors.name 
      })
      .from(supportedVendors)
      .where(
        sql`lower(trim(${supportedVendors.vendorShortCode})) = lower(trim(${vendorSlug})) 
            OR lower(trim(${supportedVendors.name})) = lower(trim(${vendorSlug}))`
      );

    let priority: number;

    if (!result) {
      // Vendor not found in supportedVendors table
      console.log(`VENDOR PRIORITY: Vendor "${vendorSlug}" not found in supportedVendors table (searched by short code and name), using default priority ${DEFAULT_PRIORITY}`);
      priority = DEFAULT_PRIORITY;
    } else if (result.productRecordPriority === null || result.productRecordPriority === undefined) {
      // Vendor found but priority not set
      console.log(`VENDOR PRIORITY: Vendor "${result.name}" (slug: ${vendorSlug}) found but productRecordPriority is null, using default priority ${DEFAULT_PRIORITY}`);
      priority = DEFAULT_PRIORITY;
    } else {
      // Validate priority is a positive integer
      const rawPriority = result.productRecordPriority;
      if (rawPriority < MIN_PRIORITY || !Number.isInteger(rawPriority)) {
        console.warn(`VENDOR PRIORITY: Invalid priority value ${rawPriority} for vendor "${result.name}" (slug: ${vendorSlug}), using default priority ${DEFAULT_PRIORITY}`);
        priority = DEFAULT_PRIORITY;
      } else {
        // Valid priority found (no upper limit since priorities are now unique and sequential)
        priority = rawPriority;
        console.log(`VENDOR PRIORITY: Found valid priority ${priority} for vendor "${result.name}" (slug: ${vendorSlug})`);
      }
    }

    // Cache the result
    cache.set(cacheKey, {
      priority,
      timestamp: now
    });

    return priority;

  } catch (error) {
    console.error(`VENDOR PRIORITY: Database error looking up priority for slug "${vendorSlug}":`, error);
    
    // Return cached value if available, even if stale
    if (cached) {
      console.log(`VENDOR PRIORITY: Using stale cached value for "${vendorSlug}" due to database error`);
      return cached.priority;
    }

    return DEFAULT_PRIORITY;
  }
}

/**
 * Get vendor priority synchronously from cache only
 * Used for performance-critical paths where database lookup is not acceptable
 * 
 * @param vendorSlug - The vendor slug/short code to lookup priority for
 * @returns number | null - The cached priority value or null if not cached
 */
export function getVendorRecordPriorityFromCache(vendorSlug: string): number | null {
  if (!vendorSlug || typeof vendorSlug !== 'string') {
    return null;
  }

  const cacheKey = vendorSlug.toLowerCase().trim();
  const cached = cache.get(cacheKey);
  
  if (!cached) {
    return null;
  }

  const now = Date.now();
  if ((now - cached.timestamp) > CACHE_TTL) {
    // Cache entry is stale but return it anyway for sync operations
    console.log(`VENDOR PRIORITY: Using stale cached priority ${cached.priority} for slug "${vendorSlug}"`);
  }

  return cached.priority;
}

/**
 * Preload vendor priorities for commonly used vendors
 * Call this during application startup for better performance
 * 
 * @param vendorSlugs - Array of vendor slugs to preload
 */
export async function preloadVendorPriorities(vendorSlugs: string[]): Promise<void> {
  console.log(`VENDOR PRIORITY: Preloading priorities for ${vendorSlugs.length} vendors`);
  
  const loadPromises = vendorSlugs.map(async (vendorSlug) => {
    try {
      await getVendorRecordPriority(vendorSlug);
    } catch (error) {
      console.error(`VENDOR PRIORITY: Failed to preload priority for slug "${vendorSlug}":`, error);
    }
  });

  await Promise.allSettled(loadPromises);
  console.log(`VENDOR PRIORITY: Preloading completed`);
}

/**
 * Clear the vendor priority cache
 * Useful for testing and when vendor priorities are updated
 */
export function clearVendorPriorityCache(): void {
  const previousSize = cache.size;
  cache.clear();
  console.log(`VENDOR PRIORITY: Cache cleared (${previousSize} entries removed)`);
}

/**
 * Invalidate cache entry for a specific vendor
 * Called when vendor priority is updated via admin interface
 * 
 * @param vendorSlug - The vendor slug to invalidate
 */
export function invalidateVendorPriorityCache(vendorSlug: string): void {
  if (!vendorSlug || typeof vendorSlug !== 'string') {
    console.warn(`VENDOR PRIORITY: Invalid vendor slug provided for cache invalidation: ${vendorSlug}`);
    return;
  }

  const cacheKey = vendorSlug.toLowerCase().trim();
  const wasPresent = cache.has(cacheKey);
  
  if (wasPresent) {
    cache.delete(cacheKey);
    console.log(`VENDOR PRIORITY: Cache invalidated for vendor slug "${vendorSlug}"`);
  } else {
    console.log(`VENDOR PRIORITY: No cache entry found for vendor slug "${vendorSlug}" - nothing to invalidate`);
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getVendorPriorityCacheStats(): {
  size: number;
  entries: Array<{ vendor: string; priority: number; age: number }>;
} {
  const now = Date.now();
  const entries = Array.from(cache.entries()).map(([vendor, entry]) => ({
    vendor,
    priority: entry.priority,
    age: Math.round((now - entry.timestamp) / 1000) // age in seconds
  }));

  return {
    size: cache.size,
    entries
  };
}

/**
 * Validate that all vendors have unique, sequential 1-N priorities
 * Returns validation results with any issues found
 */
export async function validateVendorPriorityConsistency(): Promise<{
  isValid: boolean;
  totalVendors: number;
  issues: string[];
  recommendations: string[];
}> {
  console.log('VENDOR PRIORITY VALIDATION: Starting 1-N consistency check...');
  
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Retry configuration for database connection issues
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`VENDOR PRIORITY VALIDATION: Attempt ${attempt}/${maxRetries}`);
      
      // Get all vendors with their priorities
      const vendors = await db
        .select({
          id: supportedVendors.id,
          name: supportedVendors.name,
          priority: supportedVendors.productRecordPriority
        })
        .from(supportedVendors);
    
    const totalVendors = vendors.length;
    console.log('VENDOR PRIORITY VALIDATION: Found', totalVendors, 'vendors to validate');
    
    if (totalVendors === 0) {
      console.log('VENDOR PRIORITY VALIDATION: No vendors found - system is consistent (empty)');
      return {
        isValid: true,
        totalVendors: 0,
        issues: [],
        recommendations: []
      };
    }
    
    // Check for vendors with null/undefined priorities
    const vendorsWithNullPriority = vendors.filter(v => v.priority === null || v.priority === undefined);
    if (vendorsWithNullPriority.length > 0) {
      const vendorNames = vendorsWithNullPriority.map(v => v.name).join(', ');
      issues.push(`Found ${vendorsWithNullPriority.length} vendors with null/undefined priorities: ${vendorNames}`);
      recommendations.push('Run priority auto-assignment to fix null priorities');
    }
    
    // Get vendors with non-null priorities for sequence validation
    const vendorsWithPriority = vendors.filter(v => v.priority !== null && v.priority !== undefined);
    const priorities = vendorsWithPriority.map(v => v.priority).sort((a, b) => a - b);
    
    console.log('VENDOR PRIORITY VALIDATION: Non-null priorities found:', priorities);
    
    // Check for duplicate priorities
    const duplicates = new Map();
    const priorityCounts = new Map();
    
    vendorsWithPriority.forEach(vendor => {
      const priority = vendor.priority;
      if (!priorityCounts.has(priority)) {
        priorityCounts.set(priority, []);
      }
      priorityCounts.get(priority).push(vendor.name);
    });
    
    priorityCounts.forEach((vendorNames, priority) => {
      if (vendorNames.length > 1) {
        duplicates.set(priority, vendorNames);
        issues.push(`Priority ${priority} is assigned to multiple vendors: ${vendorNames.join(', ')}`);
      }
    });
    
    if (duplicates.size > 0) {
      recommendations.push('Reassign duplicate priorities to maintain unique 1-N sequence');
    }
    
    // Check for gaps in 1-N sequence
    if (priorities.length > 0) {
      const expectedSequence = Array.from({ length: vendorsWithPriority.length }, (_, i) => i + 1);
      const missingPriorities = expectedSequence.filter(expected => !priorities.includes(expected));
      const extraPriorities = priorities.filter(actual => actual > vendorsWithPriority.length);
      
      if (missingPriorities.length > 0) {
        issues.push(`Missing priorities in 1-N sequence: ${missingPriorities.join(', ')}`);
        recommendations.push('Re-sequence priorities to fill gaps and maintain continuous 1-N order');
      }
      
      if (extraPriorities.length > 0) {
        issues.push(`Priorities exceed vendor count (${vendorsWithPriority.length}): ${extraPriorities.join(', ')}`);
        recommendations.push('Compress priority sequence to fit 1-N range');
      }
    }
    
    // Check for invalid priority values (non-positive integers)
    const invalidPriorities = vendorsWithPriority.filter(v => 
      !Number.isInteger(v.priority) || v.priority < 1
    );
    
    if (invalidPriorities.length > 0) {
      const invalidData = invalidPriorities.map(v => `${v.name}(${v.priority})`).join(', ');
      issues.push(`Found ${invalidPriorities.length} vendors with invalid priority values: ${invalidData}`);
      recommendations.push('Priority values must be positive integers starting from 1');
    }
    
      const isValid = issues.length === 0;
      
      console.log('VENDOR PRIORITY VALIDATION: Completed -', isValid ? 'VALID' : 'ISSUES FOUND');
      console.log('VENDOR PRIORITY VALIDATION: Total vendors:', totalVendors, 'Issues found:', issues.length);
      
      if (!isValid) {
        console.log('VENDOR PRIORITY VALIDATION: Issues:', issues);
        console.log('VENDOR PRIORITY VALIDATION: Recommendations:', recommendations);
      }
      
      return {
        isValid,
        totalVendors,
        issues,
        recommendations
      };
      
    } catch (error: any) {
      console.error(`VENDOR PRIORITY VALIDATION: Attempt ${attempt} failed:`, error.message);
      
      // Check if this is a connection error that we should retry
      const isConnectionError = 
        error.code === '57P01' || // admin_shutdown
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('terminating connection') ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout');
      
      if (isConnectionError && attempt < maxRetries) {
        console.log(`VENDOR PRIORITY VALIDATION: Connection error, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt)); // Exponential backoff
        continue; // Retry
      }
      
      // Non-retryable error or max retries exceeded
      console.error('VENDOR PRIORITY VALIDATION: Failed after', attempt, 'attempts');
      return {
        isValid: false,
        totalVendors: 0,
        issues: [`Database error during validation: ${error.message || String(error)}`],
        recommendations: ['Check database connection and schema', 'Verify connection pool settings']
      };
    }
  }
  
  // Should never reach here due to return statements in try/catch
  return {
    isValid: false,
    totalVendors: 0,
    issues: ['Unexpected validation flow'],
    recommendations: ['Check validation logic']
  };
}

/**
 * Auto-fix vendor priority consistency issues
 * Re-assigns all vendor priorities to proper 1-N sequence
 */
export async function fixVendorPriorityConsistency(): Promise<{
  success: boolean;
  message: string;
  vendorsUpdated: number;
}> {
  console.log('VENDOR PRIORITY FIX: Starting auto-fix for priority consistency...');
  
  try {
    // Get all vendors
    const vendors = await db
      .select({
        id: supportedVendors.id,
        name: supportedVendors.name,
        vendorShortCode: supportedVendors.vendorShortCode,
        priority: supportedVendors.productRecordPriority
      })
      .from(supportedVendors);
    
    const totalVendors = vendors.length;
    console.log('VENDOR PRIORITY FIX: Found', totalVendors, 'vendors to fix');
    
    if (totalVendors === 0) {
      return {
        success: true,
        message: 'No vendors found - nothing to fix',
        vendorsUpdated: 0
      };
    }
    
    // Sort vendors by existing priority (null priorities go to end)
    vendors.sort((a, b) => {
      if (a.priority === null || a.priority === undefined) return 1;
      if (b.priority === null || b.priority === undefined) return -1;
      return a.priority - b.priority;
    });
    
    // Reassign priorities in 1-N sequence
    let vendorsUpdated = 0;
    
    for (let i = 0; i < vendors.length; i++) {
      const vendor = vendors[i];
      const expectedPriority = i + 1;
      
      if (vendor.priority !== expectedPriority) {
        console.log('VENDOR PRIORITY FIX: Updating', vendor.name, 'from priority', vendor.priority, 'to', expectedPriority);
        
        // Update vendor priority in database
        await db
          .update(supportedVendors)
          .set({ productRecordPriority: expectedPriority })
          .where(eq(supportedVendors.id, vendor.id));
        
        // Invalidate cache for updated vendor (using slug)
        if (vendor.vendorShortCode) {
          invalidateVendorPriorityCache(vendor.vendorShortCode);
        }
        
        vendorsUpdated++;
      }
    }
    
    console.log('VENDOR PRIORITY FIX: Successfully updated', vendorsUpdated, 'vendors to maintain 1-N sequence');
    
    return {
      success: true,
      message: `Successfully reassigned priorities for ${vendorsUpdated} vendors to maintain 1-N sequence`,
      vendorsUpdated
    };
    
  } catch (error) {
    console.error('VENDOR PRIORITY FIX: Error during auto-fix:', error);
    return {
      success: false,
      message: `Failed to fix priority consistency: ${error instanceof Error ? error.message : String(error)}`,
      vendorsUpdated: 0
    };
  }
}

/**
 * Clean up expired cache entries
 * Can be called periodically to prevent memory leaks
 */
export function cleanupVendorPriorityCache(): void {
  const now = Date.now();
  let removedCount = 0;
  const keysToDelete: string[] = [];

  // Collect keys to delete first, then delete them
  cache.forEach((entry, key) => {
    if ((now - entry.timestamp) > CACHE_TTL) {
      keysToDelete.push(key);
    }
  });

  // Delete expired entries
  keysToDelete.forEach((key) => {
    cache.delete(key);
    removedCount++;
  });

  if (removedCount > 0) {
    console.log(`VENDOR PRIORITY: Cleaned up ${removedCount} expired cache entries`);
  }
}
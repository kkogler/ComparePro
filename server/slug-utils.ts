/**
 * Slug generation utilities for vendors
 * Ensures consistent, URL-safe, and database-safe slugs
 */

/**
 * Generate a vendor slug from a vendor short code
 * @param shortCode The vendor short code (e.g., "sports-south", "chattanooga")
 * @returns A normalized slug suitable for system-wide use
 */
export function generateVendorSlug(shortCode: string): string {
  if (!shortCode || typeof shortCode !== 'string') {
    throw new Error('Short code is required and must be a string');
  }

  return shortCode
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_') // Replace non-alphanumeric chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
}

/**
 * Generate a vendor slug from a vendor name (fallback when short code is not available)
 * @param name The vendor name (e.g., "GunBroker.com LLC")
 * @returns A normalized slug
 */
export function generateVendorSlugFromName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Vendor name is required and must be a string');
  }

  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-z0-9_-]/g, '') // Remove special characters
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
}

/**
 * Validate that a slug meets our requirements
 * @param slug The slug to validate
 * @returns True if valid, false otherwise
 */
export function isValidVendorSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false;
  }

  // Must be 1-50 characters, lowercase alphanumeric with underscores/hyphens
  const slugRegex = /^[a-z0-9_-]{1,50}$/;
  return slugRegex.test(slug);
}

/**
 * Ensure slug uniqueness by appending a number if needed
 * @param baseSlug The base slug to make unique
 * @param existingSlugs Array of existing slugs to check against
 * @returns A unique slug
 */
export function ensureUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let counter = 1;
  let uniqueSlug = `${baseSlug}_${counter}`;
  
  while (existingSlugs.includes(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}_${counter}`;
  }

  return uniqueSlug;
}

/**
 * Convert legacy vendor identifiers to slugs
 * This helps during the migration period
 */
export const LEGACY_VENDOR_SLUG_MAP: Record<string, string> = {
  // Legacy name patterns -> standardized slugs
  'gunbroker.com llc': 'gunbroker',
  'gunbroker': 'gunbroker',
  'chattanooga shooting supplies inc.': 'chattanooga',
  'chattanooga shooting supplies': 'chattanooga',
  'chattanooga': 'chattanooga',
  'sports south': 'sports-south',
  'sports_south': 'sports-south',
  'sports-south': 'sports-south',
  'bill hicks & co.': 'bill-hicks',
  'bill hicks': 'bill-hicks',
  'bill_hicks': 'bill-hicks',
  'bill-hicks': 'bill-hicks',
  'lipsey\'s inc.': 'lipseys',
  'lipsey\'s': 'lipseys',
  'lipseys': 'lipseys'
};

/**
 * Get standardized slug from any vendor identifier
 * @param identifier Any vendor identifier (name, short code, etc.)
 * @returns Standardized slug or null if not found
 */
export function getStandardizedSlug(identifier: string): string | null {
  if (!identifier) return null;
  
  const normalized = identifier.toLowerCase().trim();
  return LEGACY_VENDOR_SLUG_MAP[normalized] || null;
}















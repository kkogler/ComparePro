/**
 * Vendor Reference Utilities
 * 
 * STANDARD: Always use vendorShortCode as the primary identifier for API calls.
 * The vendorShortCode is consistent across both supported_vendors and vendors tables.
 * 
 * DO NOT use slug or id for API calls - those are instance-specific.
 */

export interface VendorReference {
  id?: number;
  slug?: string;
  vendorShortCode?: string;
  name?: string;
}

/**
 * Get the standard vendor identifier for API calls.
 * 
 * ALWAYS use this function when making vendor-related API calls.
 * 
 * @param vendor - The vendor object (can be from vendors or supported_vendors table)
 * @returns The vendor short code to use in API calls
 * @throws Error if vendor short code cannot be determined
 */
export function getVendorIdentifier(vendor: VendorReference | null | undefined): string {
  if (!vendor) {
    throw new Error('Vendor object is required');
  }

  // Primary: vendorShortCode (THIS IS THE STANDARD)
  if (vendor.vendorShortCode) {
    return vendor.vendorShortCode;
  }

  // Fallback: Normalize name to short code format
  // This should only happen for legacy data
  if (vendor.name) {
    console.warn(
      `⚠️ VENDOR IDENTIFIER: Using name as fallback for vendor. This indicates missing vendorShortCode.`,
      { vendor: vendor.name }
    );
    return vendor.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  // Last resort: Use slug (but log warning)
  if (vendor.slug) {
    console.warn(
      `⚠️ VENDOR IDENTIFIER: Using slug as last resort. This may cause issues with numbered instances (chattanooga-1 vs chattanooga-2).`,
      { slug: vendor.slug }
    );
    return vendor.slug;
  }

  throw new Error(
    `Cannot determine vendor identifier. Vendor must have vendorShortCode, name, or slug. Got: ${JSON.stringify(vendor)}`
  );
}

/**
 * Validate that a vendor has the required fields for API operations
 */
export function validateVendorReference(vendor: VendorReference | null | undefined): void {
  if (!vendor) {
    throw new Error('Vendor is required');
  }

  if (!vendor.vendorShortCode && !vendor.name && !vendor.slug) {
    throw new Error(
      'Vendor must have at least one of: vendorShortCode (preferred), name, or slug'
    );
  }
}

/**
 * Build vendor API endpoint URL
 * 
 * @param orgSlug - Organization slug
 * @param vendor - Vendor reference
 * @param endpoint - API endpoint path (e.g., 'credentials', 'test-connection')
 * @returns Full API URL path
 */
export function buildVendorApiUrl(
  orgSlug: string | undefined,
  vendor: VendorReference | null | undefined,
  endpoint: string
): string {
  if (!orgSlug) {
    throw new Error('Organization slug is required');
  }

  const vendorIdentifier = getVendorIdentifier(vendor);
  
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  return `/org/${orgSlug}/api/vendors/${vendorIdentifier}/${cleanEndpoint}`;
}


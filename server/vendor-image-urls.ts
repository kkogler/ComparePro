/**
 * Centralized Vendor Image URL Service
 * 
 * Single source of truth for all vendor image URL generation.
 * This eliminates inconsistencies and makes adding new vendors simple.
 * 
 * Usage:
 *   const imageUrl = VendorImageService.getImageUrl('Sports South', vendorSku, picRef);
 */

export class VendorImageService {
  /**
   * Generate canonical image URL for any vendor
   * This is the SINGLE place where all vendor image URLs are created
   */
  static getImageUrl(vendorName: string, vendorSku: string, picRef?: string): string | null {
    if (!vendorName || !vendorSku?.trim()) {
      return null;
    }

    const normalizedVendorName = vendorName.toLowerCase().trim();
    const cleanSku = vendorSku.trim();

    switch (normalizedVendorName) {
      case 'sports south':
        // Use PICREF if available, otherwise use vendor SKU (ITEMNO)
        const identifier = picRef?.trim() || cleanSku;
        if (!identifier) return null;
        // Use hires format for highest quality
        return `https://media.server.theshootingwarehouse.com/hires/${identifier}.png`;

      case 'bill hicks':
      case 'bill hicks & co.':
        // URL encode the vendor SKU (spaces become +, special chars encoded)
        const encodedSku = encodeURIComponent(cleanSku).replace(/%20/g, '+');
        return `https://billhicksco.hostedftp.com/files/path/BHC+Digital+Images+ALL/Website/${encodedSku}.jpg`;

      case 'chattanooga shooting supplies':
      case 'chattanooga shooting supplies inc.':
      case 'chattanooga':
        // Chattanooga provides image URLs in their CSV data
        // This case is handled during sync - no URL generation needed
        return null;

      case 'lipsey\'s':
      case 'lipsey\'s inc.':
      case 'lipseys':
        // Lipsey's provides image URLs in their API responses
        // This case is handled during sync - no URL generation needed
        return null;

      case 'gunbroker':
      case 'gunbroker.com':
      case 'gunbroker.com llc':
        // GunBroker provides image URLs in their API responses
        // This case is handled during sync - no URL generation needed
        return null;

      // Add new vendors here as simple cases:
      // case 'new vendor name':
      //   return `https://newvendor.com/images/${cleanSku}.jpg`;

      default:
        console.log(`VENDOR IMAGE SERVICE: No URL pattern defined for vendor: ${vendorName}`);
        return null;
    }
  }

  /**
   * Get vendor-specific image format information
   * Useful for debugging and documentation
   */
  static getVendorImageInfo(vendorName: string): { format: string; quality: string; notes: string } | null {
    const normalizedVendorName = vendorName.toLowerCase().trim();

    switch (normalizedVendorName) {
      case 'sports south':
        return {
          format: 'PNG',
          quality: 'High-res (hires folder)',
          notes: 'Uses PICREF if available, falls back to ITEMNO'
        };

      case 'bill hicks':
      case 'bill hicks & co.':
        return {
          format: 'JPG',
          quality: 'Standard',
          notes: 'Uses product name as filename with URL encoding'
        };

      default:
        return null;
    }
  }

  /**
   * Check if a vendor supports image URL generation
   */
  static supportsImageGeneration(vendorName: string): boolean {
    const normalizedVendorName = vendorName.toLowerCase().trim();
    
    // Only vendors that generate URLs (not those that provide URLs in API/CSV)
    return ['sports south', 'bill hicks', 'bill hicks & co.'].includes(normalizedVendorName);
  }
}

import { db } from './db';
import { products } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { vendorRegistry } from './vendor-registry';

/**
 * Service for managing product images from vendor APIs
 * Prioritizes distributor images over marketplace images
 */
export class ImageService {
  /**
   * Get image priority for a vendor (lower number = higher priority)
   */
  private static async getVendorImagePriority(vendorName: string): Promise<number> {
    return await vendorRegistry.getImagePriority(vendorName);
  }

  /**
   * Update product image URL from vendor API response with priority handling
   */
  static async updateProductImage(upc: string, imageUrl: string, vendorName?: string): Promise<boolean> {
    try {
      if (!imageUrl || !upc) {
        return false;
      }

      // Check if we should update based on vendor priority
      const shouldUpdate = await this.shouldUpdateImage(upc, vendorName);
      if (!shouldUpdate) {
        console.log(`IMAGE SERVICE: Skipping image update for UPC ${upc} - existing image has higher priority`);
        return false;
      }

      console.log(`IMAGE SERVICE: Updating image for UPC ${upc} from ${vendorName || 'unknown vendor'}: ${imageUrl}`);
      
      const result = await db
        .update(products)
        .set({ 
          imageUrl: imageUrl,
          imageSource: vendorName || null,
          updatedAt: new Date()
        })
        .where(eq(products.upc, upc));

      if (result.rowCount && result.rowCount > 0) {
        console.log(`IMAGE SERVICE: Successfully updated image for UPC ${upc}`);
        return true;
      } else {
        console.log(`IMAGE SERVICE: No product found with UPC ${upc}`);
        return false;
      }
    } catch (error: any) {
      console.error(`IMAGE SERVICE: Failed to update image for UPC ${upc}:`, error.message);
      return false;
    }
  }

  /**
   * Extract image URL from GunBroker API response
   */
  static extractGunBrokerImage(gunBrokerProduct: any): string | null {
    // GunBroker provides thumbnailURL in their API responses
    if (gunBrokerProduct?.thumbnailURL) {
      return gunBrokerProduct.thumbnailURL;
    }
    return null;
  }

  /**
   * Extract image URL from Chattanooga API response
   */
  static extractChattanoogaImage(chattanoogaProduct: any): string | null {
    // Chattanooga API doesn't provide image URLs in their documented response structure
    // They may add this capability in future API versions
    if (chattanoogaProduct?.image_url) {
      return chattanoogaProduct.image_url;
    }
    
    // Check custom properties for potential image fields
    if (chattanoogaProduct?.custom_properties?.imageUrl) {
      return chattanoogaProduct.custom_properties.imageUrl;
    }
    
    return null;
  }

  /**
   * Check if image URL is valid and accessible
   */
  static async validateImageUrl(imageUrl: string): Promise<boolean> {
    try {
      // For now, just check if it's a valid URL format
      // In production, you might want to make a HEAD request to verify accessibility
      const url = new URL(imageUrl);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Check if we should update the image based on vendor priority
   */
  private static async shouldUpdateImage(upc: string, newVendorName?: string): Promise<boolean> {
    try {
      const [existingProduct] = await db
        .select({ imageUrl: products.imageUrl, imageSource: products.imageSource })
        .from(products)
        .where(eq(products.upc, upc));

      // If no existing image, always update
      if (!existingProduct?.imageUrl) {
        return true;
      }

      // If no vendor name provided, don't update existing image
      if (!newVendorName) {
        return false;
      }

      // Get priorities using vendor registry
      const existingPriority = await this.getVendorImagePriority(existingProduct.imageSource || '');
      const newPriority = await this.getVendorImagePriority(newVendorName);

      // Update if new source has higher priority (lower number)
      return newPriority < existingPriority;
    } catch (error) {
      console.error('IMAGE SERVICE: Error checking image priority:', error);
      return false;
    }
  }



  /**
   * Get fallback image URL for when no vendor image is available
   */
  static getFallbackImageUrl(brand: string, category?: string): string | null {
    // Return null to show the "No Image Available" placeholder
    // We prioritize authentic vendor images only
    return null;
  }
}
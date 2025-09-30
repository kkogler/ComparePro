/**
 * Image Fallback Service
 * 
 * Provides image fallback functionality that automatically uses images from lower priority vendors
 * when higher priority vendors don't have images. This preserves the original product source
 * while allowing images from other vendors to be used.
 * 
 * Key Features:
 * - Respects vendor priority system (1=highest, N=lowest)
 * - Preserves original product source
 * - Tracks image source separately from product source
 * - Supports fallback notation in imageSource field
 * 
 * NOTE: Image URL generation has been moved to VendorImageService for consistency.
 * This service now focuses on fallback logic and delegates URL generation.
 */

import { db } from "./db";
import { products, vendorProductMappings, supportedVendors } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getVendorRecordPriority } from "./vendor-priority";

export interface VendorImageInfo {
  vendorName: string;
  vendorId: number;
  priority: number;
  imageUrl: string | null;
  vendorSku?: string;
}

export interface ImageFallbackResult {
  imageUrl: string | null;
  imageSource: string | null;
  fallbackUsed: boolean;
  originalVendorName?: string;
  imageVendorName?: string;
}

/**
 * Core image fallback service class
 */
export class ImageFallbackService {
  
  /**
   * Generate image URL for Sports South products using centralized service
   * @deprecated This method now delegates to VendorImageService
   */
  private static generateSportsSouthImageUrl(vendorSku: string, picRef?: string): string | null {
    if (!vendorSku?.trim()) return null;
    
    try {
      const { VendorImageService } = require('./vendor-image-urls');
      return VendorImageService.getImageUrl('Sports South', vendorSku, picRef);
    } catch (error) {
      console.error('Failed to get Sports South image URL from centralized service:', error);
      
      // Fallback to original logic for safety
      const baseUrl = 'https://media.server.theshootingwarehouse.com';
      const identifier = (picRef?.trim() || vendorSku.trim());
      
      if (!identifier || identifier.length === 0) {
        console.log(`SPORTS SOUTH IMAGE: Invalid identifier for vendor SKU ${vendorSku}`);
        return null;
      }
      
      return `${baseUrl}/hires/${identifier}.png`;
    }
  }
  
  /**
   * Generate image URL for Bill Hicks products using centralized service
   * @deprecated This method now delegates to VendorImageService
   */
  private static generateBillHicksImageUrl(vendorSku: string): string | null {
    if (!vendorSku?.trim()) return null;
    
    try {
      const { VendorImageService } = require('./vendor-image-urls');
      return VendorImageService.getImageUrl('Bill Hicks', vendorSku);
    } catch (error) {
      console.error('Failed to get Bill Hicks image URL from centralized service:', error);
      
      // Fallback to original logic for safety
      const encodedSku = encodeURIComponent(vendorSku.trim()).replace(/%20/g, '+');
      return `https://billhicksco.hostedftp.com/files/path/BHC+Digital+Images+ALL/Website/${encodedSku}.jpg`;
    }
  }
  
  /**
   * Get image URL for Chattanooga products from existing product data
   * Chattanooga provides image URLs in their CSV data which are stored in the product record
   * This method retrieves the existing imageUrl instead of generating one
   */
  private static async getChattanoogaImageUrl(upc: string): Promise<string | null> {
    try {
      // Get the product by UPC to check existing imageUrl
      const [product] = await db
        .select({ imageUrl: products.imageUrl })
        .from(products)
        .where(eq(products.upc, upc.trim()));
      
      if (product?.imageUrl?.trim()) {
        console.log(`CHATTANOOGA IMAGE: Found existing image URL for UPC ${upc}`);
        return product.imageUrl.trim();
      }
      
      console.log(`CHATTANOOGA IMAGE: No existing image URL found for UPC ${upc}`);
      return null;
      
    } catch (error) {
      console.error(`CHATTANOOGA IMAGE: Error getting image URL for UPC ${upc}:`, error);
      return null;
    }
  }
  
  /**
   * Generate vendor-specific image URL based on vendor name and SKU
   */
  private static async generateVendorImageUrl(vendorName: string, vendorSku: string, upc: string, picRef?: string): Promise<string | null> {
    const normalizedVendorName = vendorName.toLowerCase();
    
    if (normalizedVendorName.includes('sports south')) {
      return this.generateSportsSouthImageUrl(vendorSku, picRef);
    } else if (normalizedVendorName.includes('bill hicks')) {
      return this.generateBillHicksImageUrl(vendorSku);
    } else if (normalizedVendorName.includes('chattanooga')) {
      return await this.getChattanoogaImageUrl(upc);
    }
    
    // For other vendors, return null - they would need specific URL generation logic
    console.log(`IMAGE FALLBACK: No image URL generation logic for vendor: ${vendorName}`);
    return null;
  }
  
  /**
   * Get existing product image information for a UPC
   */
  private static async getExistingProductImage(upc: string): Promise<{ imageUrl: string | null; imageSource: string | null; source: string | null } | null> {
    try {
      const [product] = await db
        .select({ 
          imageUrl: products.imageUrl, 
          imageSource: products.imageSource,
          source: products.source
        })
        .from(products)
        .where(eq(products.upc, upc.trim()));
      
      return product || null;
    } catch (error) {
      console.error(`IMAGE FALLBACK: Error getting existing product image for UPC ${upc}:`, error);
      return null;
    }
  }

  /**
   * Get all vendor product mappings for a UPC with priority information
   */
  private static async getVendorImageInfo(upc: string): Promise<VendorImageInfo[]> {
    if (!upc?.trim()) {
      console.log('IMAGE FALLBACK: Invalid UPC provided');
      return [];
    }
    
    try {
      // Get product by UPC to find productId
      const [product] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.upc, upc.trim()));
      
      if (!product) {
        console.log(`IMAGE FALLBACK: No product found for UPC: ${upc}`);
        return [];
      }
      
      // Get all vendor product mappings for this product with vendor info
      const mappings = await db
        .select({
          vendorId: vendorProductMappings.supportedVendorId,
          vendorSku: vendorProductMappings.vendorSku,
          vendorName: supportedVendors.name,
          priority: supportedVendors.productRecordPriority,
          picRef: vendorProductMappings.picRef // Add PICREF for Sports South
        })
        .from(vendorProductMappings)
        .innerJoin(supportedVendors, eq(vendorProductMappings.supportedVendorId, supportedVendors.id))
        .where(eq(vendorProductMappings.productId, product.id));
      
      console.log(`IMAGE FALLBACK: Found ${mappings.length} vendor mappings for UPC ${upc}`);
      
      // Convert to VendorImageInfo array with generated image URLs
      const vendorImageInfo: VendorImageInfo[] = [];
      
      for (const mapping of mappings) {
        if (!mapping.vendorName || !mapping.vendorSku) continue;
        
        // Generate vendor-specific image URL (now async)
        const imageUrl = await this.generateVendorImageUrl(
          mapping.vendorName, 
          mapping.vendorSku,
          upc,
          mapping.picRef || undefined
        );
        
        // Get vendor priority (use cached if available)
        const priority = mapping.priority || await getVendorRecordPriority(mapping.vendorName);
        
        vendorImageInfo.push({
          vendorName: mapping.vendorName,
          vendorId: mapping.vendorId,
          priority: priority,
          imageUrl: imageUrl,
          vendorSku: mapping.vendorSku
        });
      }
      
      // Sort by priority (lower number = higher priority)
      vendorImageInfo.sort((a, b) => a.priority - b.priority);
      
      console.log(`IMAGE FALLBACK: Vendor priority order for UPC ${upc}:`, 
        vendorImageInfo.map(v => `${v.vendorName} (Priority ${v.priority})`));
      
      return vendorImageInfo;
      
    } catch (error) {
      console.error(`IMAGE FALLBACK: Error getting vendor image info for UPC ${upc}:`, error);
      return [];
    }
  }
  
  /**
   * Find the best available image for a UPC using vendor priority fallback
   * CRITICAL: This method now respects existing images and only falls back when needed
   * 
   * @param upc - Product UPC to find image for
   * @param preferredVendorName - Primary vendor name (for tracking original source)
   * @param respectExistingImage - If true, only apply fallback when no existing image (default: true)
   * @returns Image fallback result with URL and source information
   */
  static async findBestAvailableImage(
    upc: string, 
    preferredVendorName?: string,
    respectExistingImage: boolean = true
  ): Promise<ImageFallbackResult> {
    console.log(`IMAGE FALLBACK: Finding best available image for UPC ${upc}, preferred vendor: ${preferredVendorName}, respect existing: ${respectExistingImage}`);
    
    const result: ImageFallbackResult = {
      imageUrl: null,
      imageSource: null,
      fallbackUsed: false,
      originalVendorName: preferredVendorName,
      imageVendorName: undefined
    };
    
    try {
      // CRITICAL FIX: Check existing product image first
      if (respectExistingImage) {
        const existingImage = await this.getExistingProductImage(upc);
        if (existingImage?.imageUrl?.trim()) {
          console.log(`IMAGE FALLBACK: Product already has image from ${existingImage.imageSource || 'unknown source'}, respecting existing image`);
          
          result.imageUrl = existingImage.imageUrl;
          result.imageSource = existingImage.imageSource;
          result.fallbackUsed = false; // Not a fallback, existing image
          result.imageVendorName = existingImage.imageSource;
          
          return result;
        }
        
        console.log(`IMAGE FALLBACK: No existing image found for UPC ${upc}, proceeding with fallback logic`);
      }
      
      // Get all vendor image info sorted by priority
      const vendorImageInfo = await this.getVendorImageInfo(upc);
      
      if (vendorImageInfo.length === 0) {
        console.log(`IMAGE FALLBACK: No vendor mappings found for UPC ${upc}`);
        return result;
      }
      
      // Try to find an image starting with the highest priority vendor
      for (const vendorInfo of vendorImageInfo) {
        if (vendorInfo.imageUrl) {
          console.log(`IMAGE FALLBACK: Found image from ${vendorInfo.vendorName} (Priority ${vendorInfo.priority})`);
          
          result.imageUrl = vendorInfo.imageUrl;
          result.imageVendorName = vendorInfo.vendorName;
          
          // Determine if this is a fallback or primary source
          if (preferredVendorName && 
              vendorInfo.vendorName.toLowerCase() !== preferredVendorName.toLowerCase()) {
            // This is a fallback - image from different vendor than preferred
            result.fallbackUsed = true;
            result.imageSource = `${vendorInfo.vendorName} (fallback)`;
            console.log(`IMAGE FALLBACK: Using fallback image from ${vendorInfo.vendorName} for preferred vendor ${preferredVendorName}`);
          } else {
            // This is the primary source or no preference specified
            result.imageSource = vendorInfo.vendorName;
            console.log(`IMAGE FALLBACK: Using primary image from ${vendorInfo.vendorName}`);
          }
          
          break; // Found an image, stop searching
        }
      }
      
      if (!result.imageUrl) {
        console.log(`IMAGE FALLBACK: No images available from any vendor for UPC ${upc}`);
      }
      
    } catch (error) {
      console.error(`IMAGE FALLBACK: Error finding best available image for UPC ${upc}:`, error);
    }
    
    return result;
  }
  
  /**
   * Check if a product needs image fallback (i.e., has no existing image)
   * CRITICAL: This prevents overwriting existing valid images
   */
  static async needsImageFallback(upc: string): Promise<boolean> {
    try {
      const existingImage = await this.getExistingProductImage(upc);
      const hasValidImage = existingImage?.imageUrl?.trim();
      
      console.log(`IMAGE FALLBACK: UPC ${upc} needs fallback: ${!hasValidImage} (existing image: ${hasValidImage ? 'YES' : 'NO'})`);
      
      return !hasValidImage;
    } catch (error) {
      console.error(`IMAGE FALLBACK: Error checking if UPC ${upc} needs fallback:`, error);
      return true; // Default to needing fallback on error
    }
  }

  /**
   * Update product image using fallback logic
   * This preserves the original product source while updating the image and imageSource
   * CRITICAL: Now respects existing images by default
   * 
   * @param upc - Product UPC to update
   * @param preferredVendorName - Primary vendor name (product source)
   * @param forceUpdate - If true, update even if image exists (default: false)
   * @returns Whether the image was updated successfully
   */
  static async updateProductImageWithFallback(
    upc: string, 
    preferredVendorName?: string, 
    forceUpdate: boolean = false
  ): Promise<boolean> {
    console.log(`IMAGE FALLBACK: Updating product image with fallback for UPC ${upc}, force: ${forceUpdate}`);
    
    try {
      // CRITICAL FIX: Check if update is needed before proceeding
      if (!forceUpdate) {
        const needsFallback = await this.needsImageFallback(upc);
        if (!needsFallback) {
          console.log(`IMAGE FALLBACK: UPC ${upc} already has image, skipping update`);
          return true; // Return true because image exists (no update needed)
        }
      }
      
      // Find the best available image (respect existing unless forced)
      const fallbackResult = await this.findBestAvailableImage(
        upc, 
        preferredVendorName, 
        !forceUpdate
      );
      
      if (!fallbackResult.imageUrl) {
        console.log(`IMAGE FALLBACK: No image available for UPC ${upc} - no update performed`);
        return false;
      }
      
      // Update the product with the fallback image
      const updateResult = await db
        .update(products)
        .set({
          imageUrl: fallbackResult.imageUrl,
          imageSource: fallbackResult.imageSource,
          updatedAt: new Date()
        })
        .where(eq(products.upc, upc));
      
      const success = Boolean(updateResult.rowCount && updateResult.rowCount > 0);
      
      if (success) {
        console.log(`IMAGE FALLBACK: Successfully updated image for UPC ${upc}`);
        console.log(`  - Image URL: ${fallbackResult.imageUrl}`);
        console.log(`  - Image Source: ${fallbackResult.imageSource}`);
        console.log(`  - Fallback Used: ${fallbackResult.fallbackUsed}`);
      } else {
        console.log(`IMAGE FALLBACK: Failed to update image for UPC ${upc} - product may not exist`);
      }
      
      return success;
      
    } catch (error) {
      console.error(`IMAGE FALLBACK: Error updating product image with fallback for UPC ${upc}:`, error);
      return false;
    }
  }
  
  /**
   * Batch update images for multiple products using fallback logic
   * Useful for running fallback updates across entire product catalogs
   * 
   * @param upcs - Array of UPCs to process
   * @param preferredVendorName - Primary vendor name for all products
   * @returns Statistics about the batch update
   */
  static async batchUpdateImagesWithFallback(
    upcs: string[], 
    preferredVendorName?: string
  ): Promise<{
    processed: number;
    updated: number;
    failed: number;
    noImageAvailable: number;
    fallbacksUsed: number;
  }> {
    console.log(`IMAGE FALLBACK: Starting batch update for ${upcs.length} products`);
    
    const stats = {
      processed: 0,
      updated: 0,
      failed: 0,
      noImageAvailable: 0,
      fallbacksUsed: 0
    };
    
    for (const upc of upcs) {
      stats.processed++;
      
      try {
        const fallbackResult = await this.findBestAvailableImage(upc, preferredVendorName);
        
        if (!fallbackResult.imageUrl) {
          stats.noImageAvailable++;
          continue;
        }
        
        if (fallbackResult.fallbackUsed) {
          stats.fallbacksUsed++;
        }
        
        const success = await this.updateProductImageWithFallback(upc, preferredVendorName, false);
        
        if (success) {
          stats.updated++;
        } else {
          stats.failed++;
        }
        
      } catch (error) {
        console.error(`IMAGE FALLBACK: Error processing UPC ${upc} in batch:`, error);
        stats.failed++;
      }
      
      // Add small delay to prevent overwhelming the database
      if (stats.processed % 100 === 0) {
        console.log(`IMAGE FALLBACK: Batch progress - ${stats.processed}/${upcs.length} processed`);
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
      }
    }
    
    console.log(`IMAGE FALLBACK: Batch update completed`, stats);
    return stats;
  }
  
  /**
   * Test image availability for a specific vendor and UPC
   * Useful for debugging and testing image URL generation
   */
  static async testImageAvailability(upc: string, vendorName: string): Promise<{
    vendorFound: boolean;
    imageUrl: string | null;
    imageAccessible: boolean;
  }> {
    console.log(`IMAGE FALLBACK: Testing image availability for UPC ${upc}, vendor ${vendorName}`);
    
    const result = {
      vendorFound: false,
      imageUrl: null as string | null,
      imageAccessible: false
    };
    
    try {
      const vendorImageInfo = await this.getVendorImageInfo(upc);
      const vendor = vendorImageInfo.find(v => 
        v.vendorName.toLowerCase().includes(vendorName.toLowerCase())
      );
      
      if (vendor) {
        result.vendorFound = true;
        result.imageUrl = vendor.imageUrl;
        
        // Test if image is accessible (basic HTTP check)
        if (vendor.imageUrl) {
          try {
            const response = await fetch(vendor.imageUrl, { method: 'HEAD' });
            result.imageAccessible = response.ok;
          } catch (error) {
            console.log(`IMAGE FALLBACK: Image not accessible at ${vendor.imageUrl}`);
            result.imageAccessible = false;
          }
        }
      }
      
    } catch (error) {
      console.error(`IMAGE FALLBACK: Error testing image availability:`, error);
    }
    
    return result;
  }
}
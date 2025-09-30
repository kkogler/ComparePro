// Image Conversion Service - Converts vendor-specific image data to full URLs
import { vendorRegistry } from './vendor-registry';

export interface ImageConversionResult {
  imageUrl?: string;
  imageSource?: string;
  error?: string;
}

export class ImageConversionService {
  /**
   * Convert vendor-specific image data to a full image URL
   * @param imageData - Raw image data from CSV (filename, partial path, etc.)
   * @param vendorSource - Source vendor name for conversion rules
   * @returns Converted image URL and source
   */
  static convertImageData(imageData: string, vendorSource: string): ImageConversionResult {
    if (!imageData || !imageData.trim()) {
      return { error: 'No image data provided' };
    }

    const trimmedData = imageData.trim();
    
    // Get vendor handler by source name
    let handler = vendorRegistry.getHandlerById(vendorSource.toLowerCase().replace(/\s+/g, ''));
    
    // If not found by ID, try to find by matching vendor name patterns
    if (!handler) {
      const normalizedSource = vendorSource.toLowerCase();
      // Try to match vendor name patterns without hardcoded IDs
      const availableHandlers = vendorRegistry.getAllHandlers();
      for (const availableHandler of availableHandlers) {
        const handlerName = availableHandler.name.toLowerCase();
        if (normalizedSource.includes('lipsey') && handlerName.includes('lipsey')) {
          handler = availableHandler;
          break;
        } else if (normalizedSource.includes('chattanooga') && handlerName.includes('chattanooga')) {
          handler = availableHandler;
          break;
        } else if (normalizedSource.includes('gunbroker') && handlerName.includes('gunbroker')) {
          handler = availableHandler;
          break;
        }
      }
    }
    
    // Use handler name to determine conversion method - avoid hardcoded ID checks
    if (handler && handler.name.toLowerCase().includes('lipsey')) {
      return this.convertLipseyImage(trimmedData);
    } else if (handler && handler.name.toLowerCase().includes('chattanooga')) {
      return this.convertChattanoogaImage(trimmedData);
    } else if (handler && handler.name.toLowerCase().includes('gunbroker')) {
      return this.convertGunBrokerImage(trimmedData);
    } else {
      // Generic/manual import - assume it's already a full URL or return as-is
      return this.convertGenericImage(trimmedData, vendorSource);
    }
  }

  /**
   * Lipsey's Image Conversion
   * Converts imageName to full Lipsey's cloud URL
   */
  private static convertLipseyImage(imageName: string): ImageConversionResult {
    // Skip if already a full URL
    if (imageName.startsWith('http://') || imageName.startsWith('https://')) {
      return {
        imageUrl: imageName,
        imageSource: 'Lipsey\'s'
      };
    }

    // Convert imageName to full Lipsey's cloud URL
    // Pattern: https://www.lipseyscloud.com/images/{imageName}
    const imageUrl = `https://www.lipseyscloud.com/images/${imageName}`;
    
    return {
      imageUrl,
      imageSource: 'Lipsey\'s'
    };
  }

  /**
   * Chattanooga Shooting Supplies Image Conversion
   * Convert their image format to full URLs
   */
  private static convertChattanoogaImage(imageData: string): ImageConversionResult {
    // Skip if already a full URL
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      return {
        imageUrl: imageData,
        imageSource: 'Chattanooga Shooting Supplies'
      };
    }

    // TODO: Implement Chattanooga's specific image URL pattern when discovered
    // For now, return as-is and mark as needing conversion
    return {
      imageUrl: imageData,
      imageSource: 'Chattanooga Shooting Supplies',
      error: 'Chattanooga image conversion pattern not yet implemented'
    };
  }

  /**
   * GunBroker Image Conversion
   * Convert their image format to full URLs
   */
  private static convertGunBrokerImage(imageData: string): ImageConversionResult {
    // Skip if already a full URL
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      return {
        imageUrl: imageData,
        imageSource: 'GunBroker'
      };
    }

    // TODO: Implement GunBroker's specific image URL pattern when discovered
    // For now, return as-is and mark as needing conversion
    return {
      imageUrl: imageData,
      imageSource: 'GunBroker',
      error: 'GunBroker image conversion pattern not yet implemented'
    };
  }

  /**
   * Generic/Manual Import Image Conversion
   * Handle manual CSV imports and unknown vendors
   */
  private static convertGenericImage(imageData: string, source: string): ImageConversionResult {
    // If it's already a full URL, use it
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      return {
        imageUrl: imageData,
        imageSource: source
      };
    }

    // If it looks like a filename or partial path, mark it for manual review
    return {
      imageUrl: imageData,
      imageSource: source,
      error: 'Manual review required - not a full URL'
    };
  }

  /**
   * Batch convert multiple image entries
   * @param imageDataList - Array of image data objects with vendor info
   * @returns Array of conversion results
   */
  static batchConvertImages(imageDataList: Array<{ imageData: string; vendorSource: string; upc?: string }>): Array<ImageConversionResult & { upc?: string }> {
    return imageDataList.map(item => ({
      ...this.convertImageData(item.imageData, item.vendorSource),
      upc: item.upc
    }));
  }

  /**
   * Validate if an image URL is accessible
   * @param imageUrl - URL to validate
   * @returns Promise indicating if URL is accessible
   */
  static async validateImageUrl(imageUrl: string): Promise<boolean> {
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(imageUrl, { 
        method: 'HEAD', 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn(`Image URL validation failed for ${imageUrl}:`, error);
      return false;
    }
  }
}

// Export vendor-specific conversion patterns for documentation
export const VENDOR_IMAGE_PATTERNS = {
  'Lipsey\'s': {
    pattern: 'https://www.lipseyscloud.com/images/{imageName}',
    description: 'Converts imageName field to full Lipsey cloud URL',
    example: 'BSBP9CCMAG.jpg → https://www.lipseyscloud.com/images/BSBP9CCMAG.jpg'
  },
  'Chattanooga Shooting Supplies': {
    pattern: 'TBD',
    description: 'Pattern to be determined from API documentation',
    example: 'Pending implementation'
  },
  'GunBroker': {
    pattern: 'TBD', 
    description: 'Pattern to be determined from API documentation',
    example: 'Pending implementation'
  }
};
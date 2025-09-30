import { ChattanoogaAPI } from './chattanooga-api';
import { DatabaseStorage } from './storage';

interface ChattanoogaImportResult {
  success: boolean;
  productsProcessed: number;
  productsCreated: number;
  productsUpdated: number;
  errors: string[];
  message: string;
}

export class ChattanoogaImporter {
  private api: ChattanoogaAPI;
  private storage: DatabaseStorage;

  constructor(credentials: any) {
    this.api = new ChattanoogaAPI(credentials);
    this.storage = new DatabaseStorage();
  }

  /**
   * Import products from Chattanooga API to Master Product Catalog
   */
  async importProducts(options: {
    maxProducts?: number;
    startPage?: number;
    perPage?: number;
  } = {}): Promise<ChattanoogaImportResult> {
    const { maxProducts = 50, startPage = 1, perPage = 10 } = options;
    
    const result: ChattanoogaImportResult = {
      success: false,
      productsProcessed: 0,
      productsCreated: 0,
      productsUpdated: 0,
      errors: [],
      message: ''
    };

    try {
      console.log(`🚀 CHATTANOOGA IMPORT: Starting import of up to ${maxProducts} products`);
      
      // Test API connection first
      const connectionTest = await this.api.testConnection();
      if (!connectionTest.success) {
        result.errors.push(`API connection failed: ${connectionTest.message}`);
        result.message = 'Failed to connect to Chattanooga API';
        return result;
      }

      console.log('✅ CHATTANOOGA IMPORT: API connection verified');

      let currentPage = startPage;
      let totalProcessed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;

      // Import products page by page
      while (totalProcessed < maxProducts) {
        console.log(`📄 CHATTANOOGA IMPORT: Processing page ${currentPage}`);
        
        const response = await this.fetchProductsPage(currentPage, perPage);
        if (!response.success || !response.data) {
          result.errors.push(`Failed to fetch page ${currentPage}: ${response.error}`);
          break;
        }

        const products = response.data.items || [];
        if (products.length === 0) {
          console.log('📄 CHATTANOOGA IMPORT: No more products available');
          break;
        }

        // Process each product
        for (const chattanoogaProduct of products) {
          if (totalProcessed >= maxProducts) break;

          try {
            const importResult = await this.importSingleProduct(chattanoogaProduct);
            totalProcessed++;
            
            if (importResult.created) {
              totalCreated++;
              console.log(`✅ Created: ${chattanoogaProduct.name}`);
            } else if (importResult.updated) {
              totalUpdated++;
              console.log(`🔄 Updated: ${chattanoogaProduct.name}`);
            } else {
              console.log(`ℹ️  Skipped: ${chattanoogaProduct.name} (${importResult.reason})`);
            }

          } catch (error: any) {
            result.errors.push(`Error processing ${chattanoogaProduct.name}: ${error.message}`);
            console.error(`❌ Error processing product:`, error);
          }
        }

        currentPage++;
        
        // Break if we got fewer products than requested (last page)
        if (products.length < perPage) {
          break;
        }
      }

      result.productsProcessed = totalProcessed;
      result.productsCreated = totalCreated;
      result.productsUpdated = totalUpdated;
      result.success = true;
      result.message = `Successfully imported ${totalCreated} new products and updated ${totalUpdated} existing products from Chattanooga catalog`;

      console.log(`🎉 CHATTANOOGA IMPORT COMPLETE:`);
      console.log(`   Products Processed: ${totalProcessed}`);
      console.log(`   Products Created: ${totalCreated}`);
      console.log(`   Products Updated: ${totalUpdated}`);
      console.log(`   Errors: ${result.errors.length}`);

    } catch (error: any) {
      console.error('❌ CHATTANOOGA IMPORT FAILED:', error);
      result.errors.push(`Import failed: ${error.message}`);
      result.message = `Import failed: ${error.message}`;
    }

    return result;
  }

  /**
   * Fetch a single page of products from Chattanooga API
   */
  private async fetchProductsPage(page: number, perPage: number): Promise<any> {
    try {
      const crypto = await import('crypto');
      const credentials = (this.api as any).credentials;
      const tokenHash = crypto.createHash('md5').update(credentials.token).digest('hex');
      const authString = `Basic ${credentials.sid}:${tokenHash}`;
      
      // Use the working API endpoint with pagination
      const response = await fetch(`https://api.chattanoogashooting.com/rest/v5/items?page=${page}&per_page=${perPage}`, {
        method: 'GET',
        headers: {
          'Authorization': authString,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'RetailPlatform/1.0'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }



  /**
   * Import a single product into the Master Product Catalog
   */
  private async importSingleProduct(chattanoogaProduct: any): Promise<{
    created: boolean;
    updated: boolean;
    reason?: string;
  }> {
    // Transform Chattanooga product to our format
    const productData = this.transformChattanoogaProduct(chattanoogaProduct);
    
    // Skip products without essential data
    if (!productData.name || !productData.partNumber) {
      return { created: false, updated: false, reason: 'Missing essential data' };
    }

    try {
      // Check if product already exists by part number (CSSI ID)
      const existingProduct = await this.storage.getProductByPartNumber(productData.partNumber);
      
      if (existingProduct) {
        // Update existing product
        await this.storage.updateProduct(existingProduct.id, productData);
        return { created: false, updated: true };
      } else {
        // Create new product
        await this.storage.createProduct(productData);
        return { created: true, updated: false };
      }
    } catch (error: any) {
      console.error(`Error saving product ${productData.name}:`, error);
      throw error;
    }
  }

  /**
   * Transform Chattanooga API product to our Master Catalog format
   */
  private transformChattanoogaProduct(chattanoogaProduct: any): any {
    // Extract manufacturer from name (common pattern: "BRAND PRODUCT NAME")
    const name = chattanoogaProduct.name || '';
    const nameParts = name.split(' ');
    const manufacturer = nameParts[0] || null;
    
    // Try to extract model from remaining parts
    const remainingName = nameParts.slice(1).join(' ');
    const model = nameParts[1] || '';

    // Extract caliber if present (look for common caliber patterns)
    const caliberMatch = name.match(/(\d+)(?:mm|cal|gauge|\.\d+)/i);
    const caliber = caliberMatch ? caliberMatch[0] : null;

    return {
      name: name,
      brand: manufacturer,
      model: model,
      partNumber: chattanoogaProduct.cssi_id || '',
      upc: '', // Chattanooga API doesn't seem to include UPC in response
      caliber: caliber,
      category: this.categorizeProduct(name),
      description: name,
      weight: null, // Not provided in API response
      imageUrl: null, // Not provided in API response
      
      // Enhanced fields from Chattanooga
      fflRequired: Boolean(chattanoogaProduct.serialized_flag),
      serialized: Boolean(chattanoogaProduct.serialized_flag),
      mapPrice: this.parsePrice(chattanoogaProduct.map_price),
      retailPrice: this.parsePrice(chattanoogaProduct.retail_price),
      dropShipAvailable: Boolean(chattanoogaProduct.drop_ship_flag),
      allocated: Boolean(chattanoogaProduct.allocated_flag),
      
      // Metadata
      source: 'chattanooga',
      sourceId: chattanoogaProduct.cssi_id,
      lastUpdated: new Date(),
      isActive: true
    };
  }

  /**
   * Parse price values (handle empty strings and null values)
   */
  private parsePrice(price: any): number | null {
    if (!price || price === '' || price === null) {
      return null;
    }
    const parsed = parseFloat(price);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Categorize product based on name patterns
   */
  private categorizeProduct(name: string): string {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('ammo') || nameLower.includes('ammunition') || nameLower.includes('rounds')) {
      return 'Ammunition';
    }
    if (nameLower.includes('scope') || nameLower.includes('optic') || nameLower.includes('sight')) {
      return 'Optics';
    }
    if (nameLower.includes('holster') || nameLower.includes('belt') || nameLower.includes('case')) {
      return 'Accessories';
    }
    if (nameLower.includes('rifle') || nameLower.includes('carbine')) {
      return 'Rifles';
    }
    if (nameLower.includes('pistol') || nameLower.includes('handgun')) {
      return 'Handguns';
    }
    if (nameLower.includes('shotgun')) {
      return 'Shotguns';
    }
    if (nameLower.includes('mag') || nameLower.includes('magazine') || nameLower.includes('clip')) {
      return 'Magazines';
    }
    
    return 'Accessories';
  }
}

// Export for use in API routes
export async function importChattanoogaProducts(
  credentials: any, 
  options: { maxProducts?: number; startPage?: number; perPage?: number } = {}
): Promise<ChattanoogaImportResult> {
  const importer = new ChattanoogaImporter(credentials);
  return await importer.importProducts(options);
}
import { db } from './db';
import { products, vendorProductMappings, supportedVendors } from '@shared/schema';
import { eq, and, like } from 'drizzle-orm';
import { SportsSouthAPI } from './sports-south-api';
import { storage } from './storage';

export interface ChunkedUpdateResult {
  chunkType: string;
  chunkValue: string;
  totalMappingsInChunk: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  sampleUpdates: Array<{
    productId: number;
    oldName: string;
    newName: string;
  }>;
}

export class SportsSouthChunkedUpdateService {
  private sportsSouthAPI: SportsSouthAPI | null = null;
  private supportedVendorId: number | null = null;

  /**
   * Initialize the service with Sports South API credentials
   */
  async initialize(): Promise<{ success: boolean; message: string }> {
    try {
      // Find Sports South supported vendor
      const allVendors = await storage.getAllSupportedVendors();
      const sportsSouth = allVendors.find(sv => 
        sv.name.toLowerCase().includes('sports south')
      );

      if (!sportsSouth) {
        return { success: false, message: 'Sports South vendor not found in supported vendors' };
      }

      this.supportedVendorId = sportsSouth.id;

      // Get admin credentials for Sports South
      if (!sportsSouth.adminCredentials) {
        return { success: false, message: 'Sports South admin credentials not configured' };
      }

      this.sportsSouthAPI = new SportsSouthAPI(sportsSouth.adminCredentials as any);

      // Test the connection
      const testResult = await this.sportsSouthAPI.testConnection();
      if (!testResult.success) {
        return { success: false, message: `Sports South API connection failed: ${testResult.message}` };
      }

      return { success: true, message: 'Sports South chunked update service initialized successfully' };

    } catch (error: any) {
      return { success: false, message: `Initialization failed: ${error.message}` };
    }
  }

  /**
   * Update products for a specific character (e.g., "A", "B", "1", "2", etc.)
   */
  async updateProductsByCharacter(character: string): Promise<ChunkedUpdateResult> {
    const result: ChunkedUpdateResult = {
      chunkType: 'character',
      chunkValue: character,
      totalMappingsInChunk: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      sampleUpdates: []
    };

    if (!this.sportsSouthAPI || !this.supportedVendorId) {
      result.errors.push('Service not initialized - call initialize() first');
      return result;
    }

    try {
      console.log(`SPORTS SOUTH CHUNKED: Starting update for character "${character}"...`);

      // Find Sports South products that start with this character
      const vendorMappings = await db.select()
        .from(vendorProductMappings)
        .where(and(
          eq(vendorProductMappings.supportedVendorId, this.supportedVendorId),
          like(vendorProductMappings.vendorSku, `${character}%`)
        ));

      result.totalMappingsInChunk = vendorMappings.length;
      console.log(`SPORTS SOUTH CHUNKED: Found ${vendorMappings.length} mappings starting with "${character}"`);

      if (vendorMappings.length === 0) {
        console.log(`SPORTS SOUTH CHUNKED: No products found starting with "${character}", skipping...`);
        return result;
      }

      // Create map to collect SHDESC data for these specific SKUs
      const shdescMap = new Map<string, string>();
      const processedSkus = new Set<string>();

      // Process SKUs in batches to get SHDESC data
      const batchSize = 50; // Process 50 SKUs at a time
      for (let i = 0; i < vendorMappings.length; i += batchSize) {
        const batch = vendorMappings.slice(i, i + batchSize);
        console.log(`SPORTS SOUTH CHUNKED: Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(vendorMappings.length/batchSize)} for character "${character}"...`);

        for (const mapping of batch) {
          const sku = mapping.vendorSku;
          
          // Skip if we already processed this SKU
          if (processedSkus.has(sku)) {
            continue;
          }
          processedSkus.add(sku);

          try {
            // Search for exact SKU to get SHDESC
            const productData = await this.sportsSouthAPI.testFullTextSearch(sku, 0, 0);
            
            if (productData && productData.length > 0) {
              for (const item of productData) {
                if (item.ITEMNO === sku && item.SHDESC && item.SHDESC.trim()) {
                  shdescMap.set(sku, item.SHDESC.trim());
                  break;
                }
              }
            }

            // Rate limiting to be respectful
            await new Promise(resolve => setTimeout(resolve, 50));

          } catch (error: any) {
            console.error(`SPORTS SOUTH CHUNKED: Error getting SHDESC for SKU ${sku}:`, error.message);
          }
        }
      }

      console.log(`SPORTS SOUTH CHUNKED: Found SHDESC data for ${shdescMap.size} out of ${vendorMappings.length} products starting with "${character}"`);

      // Process each mapping
      for (const mapping of vendorMappings) {
        try {
          // Get the product
          const product = await db.select()
            .from(products)
            .where(eq(products.id, mapping.productId))
            .limit(1);

          if (!product || product.length === 0) {
            result.skipped++;
            continue;
          }

          const currentProduct = product[0];
          const itemno = mapping.vendorSku;
          const shdesc = shdescMap.get(itemno);

          // Check if we have SHDESC for this item
          if (!shdesc || !shdesc.trim()) {
            result.skipped++;
            continue;
          }

          // Check if product name needs updating
          if (currentProduct.name === shdesc.trim()) {
            result.skipped++;
            continue;
          }

          // Store sample update for reporting
          if (result.sampleUpdates.length < 5) {
            result.sampleUpdates.push({
              productId: currentProduct.id,
              oldName: currentProduct.name,
              newName: shdesc.trim()
            });
          }

          // Update the product name with SHDESC
          await db.update(products)
            .set({ 
              name: shdesc.trim(),
              updatedAt: new Date()
            })
            .where(eq(products.id, currentProduct.id));

          result.updated++;

        } catch (error: any) {
          console.error(`SPORTS SOUTH CHUNKED: Error updating product ${mapping.vendorSku}:`, error);
          result.failed++;
          result.errors.push(`Failed to update ${mapping.vendorSku}: ${error.message}`);
        }
      }

      console.log(`SPORTS SOUTH CHUNKED: Character "${character}" completed. Updated: ${result.updated}, Skipped: ${result.skipped}, Failed: ${result.failed}`);
      return result;

    } catch (error: any) {
      console.error(`SPORTS SOUTH CHUNKED: Update for character "${character}" failed:`, error);
      result.errors.push(`Update failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Get multiple search terms for comprehensive brand coverage
   */
  private getMultiSearchTerms(brand: string): string[] {
    const searchTerms = [brand]; // Always include the main brand

    // Brand-specific additional search terms
    switch (brand.toLowerCase()) {
      case 'eotech':
        searchTerms.push('EXPS', 'XPS', 'VUDU', 'HWS', 'EOT', '512', '552', '518', 'G33', 'G43', 'G45');
        break;
      case 'glock':
        searchTerms.push('GLK', 'G17', 'G19', 'G21', 'G22', 'G23', 'G26', 'G27', 'G43', 'G45');
        break;
      case 'smith':
        searchTerms.push('SW', 'M&P', 'Performance', 'Bodyguard', 'Shield', 'SD9', 'SD40');
        break;
      case 'sig':
        searchTerms.push('SIG', 'P320', 'P365', 'P226', 'P229', 'MCX', 'MPX', 'Cross');
        break;
      case 'ruger':
        searchTerms.push('RUG', 'SR9', 'LCP', 'LC9', 'Security', 'American', 'Precision', '10/22');
        break;
      case 'kimber':
        searchTerms.push('KIM', '1911', 'Custom', 'Eclipse', 'Pro', 'Ultra', 'Compact');
        break;
      case 'springfield':
        searchTerms.push('SPG', '1911', 'XD', 'XDS', 'XDM', 'Hellcat', 'Saint', 'M1A');
        break;
      case 'beretta':
        searchTerms.push('BER', '92', 'APX', 'Px4', 'Nano', 'Pico', 'A400', 'A300');
        break;
      case 'colt':
        searchTerms.push('CLT', '1911', 'Python', 'King', 'Cobra', 'LE6920', 'M4');
        break;
      case 'remington':
        searchTerms.push('REM', '700', '870', '1100', '11-87', 'Model', 'Express');
        break;
      case 'mossberg':
        searchTerms.push('MOS', '500', '590', '835', 'Shockwave', 'Patriot', 'MC1sc');
        break;
      case 'winchester':
        searchTerms.push('WIN', 'Model', 'SXP', 'Super', '70', '94', 'Defender');
        break;
      case 'taurus':
        searchTerms.push('TAU', 'G2C', 'G3C', 'TX22', 'Judge', 'Raging', 'Spectrum');
        break;
      case 'wilson':
        searchTerms.push('WIL', 'Combat', 'EDC', 'CQB', 'Tactical', 'Elite');
        break;
      case 'vortex':
        searchTerms.push('VOR', 'Razor', 'Viper', 'Diamondback', 'Crossfire', 'Strike', 'Spitfire');
        break;
      case 'leupold':
        searchTerms.push('LEU', 'VX', 'Mark', 'Delta', 'Freedom', 'Backcountry');
        break;
      default:
        // For other brands, add common variations
        if (brand.length > 4) {
          searchTerms.push(brand.substring(0, 3).toUpperCase()); // First 3 letters
          searchTerms.push(brand.substring(0, 4).toUpperCase()); // First 4 letters
        }
        break;
    }

    return [...new Set(searchTerms)]; // Remove duplicates
  }

  /**
   * Update products for a specific brand (e.g., "Smith", "Ruger", etc.)
   */
  async updateProductsByBrand(brand: string): Promise<ChunkedUpdateResult> {
    const result: ChunkedUpdateResult = {
      chunkType: 'brand',
      chunkValue: brand,
      totalMappingsInChunk: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      sampleUpdates: []
    };

    if (!this.sportsSouthAPI || !this.supportedVendorId) {
      result.errors.push('Service not initialized - call initialize() first');
      return result;
    }

    try {
      console.log(`SPORTS SOUTH CHUNKED: Starting multi-search update for brand "${brand}"...`);

      // Get all search terms for this brand
      const searchTerms = this.getMultiSearchTerms(brand);
      console.log(`SPORTS SOUTH CHUNKED: Using ${searchTerms.length} search terms for "${brand}": ${searchTerms.join(', ')}`);

      // Create map of itemno -> shdesc from ALL searches
      const shdescMap = new Map<string, string>();
      let totalProductsFound = 0;

      // Run multiple searches to get comprehensive coverage
      for (const searchTerm of searchTerms) {
        try {
          console.log(`SPORTS SOUTH CHUNKED: Searching for "${searchTerm}"...`);
          const productData = await this.sportsSouthAPI.testFullTextSearch(searchTerm, 0, 0);
          
          console.log(`SPORTS SOUTH CHUNKED: Found ${productData.length} products for search term "${searchTerm}"`);
          totalProductsFound += productData.length;

          // Add SHDESC data to map (avoid duplicates)
          for (const item of productData) {
            if (item.ITEMNO && item.SHDESC && item.SHDESC.trim()) {
              if (!shdescMap.has(item.ITEMNO)) { // Only add if not already present
                shdescMap.set(item.ITEMNO, item.SHDESC.trim());
              }
            }
          }

          // Small delay between searches to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (searchError: any) {
          console.error(`SPORTS SOUTH CHUNKED: Error searching for "${searchTerm}":`, searchError);
          result.errors.push(`Search failed for "${searchTerm}": ${searchError.message}`);
        }
      }

      console.log(`SPORTS SOUTH CHUNKED: Multi-search complete for "${brand}". Total API results: ${totalProductsFound}, Unique products: ${shdescMap.size}`);
    

      // Find Sports South products from this brand search
      const vendorMappings = await db.select()
        .from(vendorProductMappings)
        .where(eq(vendorProductMappings.supportedVendorId, this.supportedVendorId));

      // Filter to only mappings that have SHDESC data from this brand search
      const relevantMappings = vendorMappings.filter(mapping => 
        shdescMap.has(mapping.vendorSku)
      );

      result.totalMappingsInChunk = relevantMappings.length;
      console.log(`SPORTS SOUTH CHUNKED: Found ${relevantMappings.length} relevant mappings for brand "${brand}"`);

      // Process each relevant mapping
      for (const mapping of relevantMappings) {
        try {
          // Get the product
          const product = await db.select()
            .from(products)
            .where(eq(products.id, mapping.productId))
            .limit(1);

          if (!product || product.length === 0) {
            result.skipped++;
            continue;
          }

          const currentProduct = product[0];
          const itemno = mapping.vendorSku;
          const shdesc = shdescMap.get(itemno);

          if (!shdesc || !shdesc.trim()) {
            result.skipped++;
            continue;
          }

          // Check if product name needs updating
          if (currentProduct.name === shdesc.trim()) {
            result.skipped++;
            continue;
          }

          // Store sample update for reporting
          if (result.sampleUpdates.length < 5) {
            result.sampleUpdates.push({
              productId: currentProduct.id,
              oldName: currentProduct.name,
              newName: shdesc.trim()
            });
          }

          // Update the product name with SHDESC
          await db.update(products)
            .set({ 
              name: shdesc.trim(),
              updatedAt: new Date()
            })
            .where(eq(products.id, currentProduct.id));

          result.updated++;

        } catch (error: any) {
          console.error(`SPORTS SOUTH CHUNKED: Error updating product ${mapping.vendorSku}:`, error);
          result.failed++;
          result.errors.push(`Failed to update ${mapping.vendorSku}: ${error.message}`);
        }
      }

      console.log(`SPORTS SOUTH CHUNKED: Brand "${brand}" completed. Updated: ${result.updated}, Skipped: ${result.skipped}, Failed: ${result.failed}`);
      return result;

    } catch (error: any) {
      console.error(`SPORTS SOUTH CHUNKED: Update for brand "${brand}" failed:`, error);
      result.errors.push(`Update failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Get all available characters (letters A-Z and numbers 0-9) for complete coverage
   */
  async getAvailableCharacters(): Promise<string[]> {
    if (!this.supportedVendorId) {
      return [];
    }

    try {
      const vendorMappings = await db.select({
        vendorSku: vendorProductMappings.vendorSku
      })
      .from(vendorProductMappings)
      .where(eq(vendorProductMappings.supportedVendorId, this.supportedVendorId));

      const characters = new Set<string>();
      for (const mapping of vendorMappings) {
        const firstChar = mapping.vendorSku.charAt(0).toUpperCase();
        if (firstChar.match(/[A-Z0-9]/)) {
          characters.add(firstChar);
        }
      }

      return Array.from(characters).sort();
    } catch (error: any) {
      console.error('SPORTS SOUTH CHUNKED: Error getting available characters:', error);
      return [];
    }
  }

  /**
   * Get all possible characters for systematic processing (A-Z, 0-9)
   */
  getAllPossibleCharacters(): string[] {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const numbers = '0123456789'.split('');
    return [...letters, ...numbers];
  }
}
import { db } from './db';
import { products, vendorProductMappings, supportedVendors } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { SportsSouthAPI } from './sports-south-api';
import { storage } from './storage';

export interface FullTextBulkUpdateResult {
  totalProductsFound: number;
  totalSearches: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  searchStrategies: string[];
}

export class SportsSouthFullTextBulkUpdateService {
  private sportsSouthAPI: SportsSouthAPI | null = null;
  private supportedVendorId: number | null = null;

  /**
   * Initialize the service with Sports South API credentials
   */
  async initialize(): Promise<{ success: boolean; message: string }> {
    try {
      // Find Sports South supported vendor using same pattern as working bulk update
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

      return { success: true, message: 'Sports South FullTextSearch bulk update service initialized successfully' };

    } catch (error: any) {
      return { success: false, message: `Initialization failed: ${error.message}` };
    }
  }

  /**
   * Get all Sports South products using strategic FullTextSearch patterns
   */
  async getAllSportsSouthProductsWithSHDESC(): Promise<Map<string, string>> {
    const productMap = new Map<string, string>(); // itemno -> shdesc
    const searchStrategies: string[] = [];

    if (!this.sportsSouthAPI) {
      throw new Error('Service not initialized');
    }

    console.log('SPORTS SOUTH FULLTEXT: Starting comprehensive product search...');

    // Strategy 1: Alphabetic batching (A*, B*, C*, etc.)
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    
    for (const letter of alphabet) {
      try {
        const searchTerm = `${letter}*`;
        console.log(`SPORTS SOUTH FULLTEXT: Searching for ${searchTerm}...`);
        
        const results = await this.sportsSouthAPI.testFullTextSearch(searchTerm, 0, 0);
        
        if (results.length > 0) {
          searchStrategies.push(`${searchTerm}: ${results.length} products`);
          
          for (const result of results) {
            if (result.ITEMNO && result.SHDESC && result.SHDESC.trim()) {
              productMap.set(result.ITEMNO, result.SHDESC.trim());
            }
          }
        }
        
        // Rate limiting to be respectful to Sports South API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`SPORTS SOUTH FULLTEXT: Error searching ${letter}*:`, error.message);
      }
    }

    // Strategy 2: Numeric searches (1*, 2*, etc.) for items starting with numbers
    const numbers = '0123456789'.split('');
    
    for (const number of numbers) {
      try {
        const searchTerm = `${number}*`;
        console.log(`SPORTS SOUTH FULLTEXT: Searching for ${searchTerm}...`);
        
        const results = await this.sportsSouthAPI.testFullTextSearch(searchTerm, 0, 0);
        
        if (results.length > 0) {
          searchStrategies.push(`${searchTerm}: ${results.length} products`);
          
          for (const result of results) {
            if (result.ITEMNO && result.SHDESC && result.SHDESC.trim()) {
              productMap.set(result.ITEMNO, result.SHDESC.trim());
            }
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`SPORTS SOUTH FULLTEXT: Error searching ${number}*:`, error.message);
      }
    }

    // Strategy 3: Common firearm brands for comprehensive coverage
    const commonBrands = ['Smith', 'Ruger', 'Sig', 'Springfield', 'Remington', 'Beretta', 'Colt', 'Kimber', 'Wilson', 'Taurus'];
    
    for (const brand of commonBrands) {
      try {
        console.log(`SPORTS SOUTH FULLTEXT: Searching for ${brand}...`);
        
        const results = await this.sportsSouthAPI.testFullTextSearch(brand, 0, 0);
        
        if (results.length > 0) {
          searchStrategies.push(`${brand}: ${results.length} products`);
          
          for (const result of results) {
            if (result.ITEMNO && result.SHDESC && result.SHDESC.trim()) {
              productMap.set(result.ITEMNO, result.SHDESC.trim());
            }
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error: any) {
        console.error(`SPORTS SOUTH FULLTEXT: Error searching ${brand}:`, error.message);
      }
    }

    console.log(`SPORTS SOUTH FULLTEXT: Found ${productMap.size} unique products with SHDESC`);
    console.log('SPORTS SOUTH FULLTEXT: Search strategies used:', searchStrategies);
    
    return productMap;
  }

  /**
   * Bulk update Sports South products using FullTextSearch SHDESC data
   */
  async bulkUpdateProductNamesWithFullTextSearch(): Promise<FullTextBulkUpdateResult> {
    const result: FullTextBulkUpdateResult = {
      totalProductsFound: 0,
      totalSearches: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      searchStrategies: []
    };

    if (!this.sportsSouthAPI || !this.supportedVendorId) {
      result.errors.push('Service not initialized - call initialize() first');
      return result;
    }

    try {
      console.log('SPORTS SOUTH FULLTEXT BULK: Starting FullTextSearch bulk product name update...');

      // Get all Sports South products with SHDESC using strategic searches
      const productMap = await this.getAllSportsSouthProductsWithSHDESC();
      result.totalProductsFound = productMap.size;

      // Find all Sports South products in master catalog that need updating
      const vendorMappings = await db.select()
        .from(vendorProductMappings)
        .where(eq(vendorProductMappings.supportedVendorId, this.supportedVendorId));

      console.log(`SPORTS SOUTH FULLTEXT BULK: Found ${vendorMappings.length} Sports South vendor mappings in catalog`);

      let processed = 0;
      for (const mapping of vendorMappings) {
        try {
          processed++;
          
          if (processed % 100 === 0) {
            console.log(`SPORTS SOUTH FULLTEXT BULK: Processed ${processed}/${vendorMappings.length} mappings...`);
          }

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

          // Check if we have SHDESC for this item
          const shdesc = productMap.get(itemno);
          
          if (!shdesc || !shdesc.trim()) {
            result.skipped++;
            continue;
          }

          // Check if product name needs updating
          if (currentProduct.name === shdesc.trim()) {
            result.skipped++;
            continue;
          }

          // Update the product name with SHDESC
          await db.update(products)
            .set({ 
              name: shdesc.trim(),
              updatedAt: new Date()
            })
            .where(eq(products.id, currentProduct.id));

          result.updated++;
          
          if (result.updated % 50 === 0) {
            console.log(`SPORTS SOUTH FULLTEXT BULK: Updated ${result.updated} product names so far...`);
          }

        } catch (error: any) {
          console.error(`SPORTS SOUTH FULLTEXT BULK: Error updating product ${mapping.vendorSku}:`, error);
          result.failed++;
          result.errors.push(`Failed to update ${mapping.vendorSku}: ${error.message}`);
        }
      }

      console.log(`SPORTS SOUTH FULLTEXT BULK: Bulk update completed. Updated: ${result.updated}, Skipped: ${result.skipped}, Failed: ${result.failed}`);
      return result;

    } catch (error: any) {
      console.error('SPORTS SOUTH FULLTEXT BULK: Bulk update failed:', error);
      result.errors.push(`Bulk update failed: ${error.message}`);
      return result;
    }
  }
}
import { db } from './db';
import { products, vendorProductMappings, supportedVendors } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { SportsSouthAPI } from './sports-south-api';
import { storage } from './storage';

export interface BulkUpdateResult {
  totalProducts: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export class SportsSouthBulkUpdateService {
  private sportsSouthAPI: SportsSouthAPI | null = null;
  private supportedVendorId: number | null = null;

  /**
   * Initialize the service with Sports South API credentials
   */
  async initialize(): Promise<{ success: boolean; message: string }> {
    try {
      // Find Sports South supported vendor
      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(sv => 
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

      return { success: true, message: 'Sports South bulk update service initialized successfully' };

    } catch (error: any) {
      return { success: false, message: `Initialization failed: ${error.message}` };
    }
  }

  /**
   * Bulk update all Sports South products with SHDESC as product name
   */
  async bulkUpdateProductNames(): Promise<BulkUpdateResult> {
    const result: BulkUpdateResult = {
      totalProducts: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    if (!this.sportsSouthAPI || !this.supportedVendorId) {
      result.errors.push('Service not initialized - call initialize() first');
      return result;
    }

    try {
      console.log('SPORTS SOUTH BULK UPDATE: Starting bulk product name update...');

      // Find all Sports South products in master catalog
      const sportsSouthProducts = await db
        .select()
        .from(products)
        .where(eq(products.source, 'Sports South'));

      result.totalProducts = sportsSouthProducts.length;
      console.log(`SPORTS SOUTH BULK UPDATE: Found ${result.totalProducts} Sports South products to update`);

      // Process products in batches to avoid overwhelming the API
      const batchSize = 50;
      for (let i = 0; i < sportsSouthProducts.length; i += batchSize) {
        const batch = sportsSouthProducts.slice(i, i + batchSize);
        
        for (const product of batch) {
          try {
            await this.updateProductName(product, result);
            
            // Add small delay between API calls to be respectful
            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (error: any) {
            result.failed++;
            result.errors.push(`Product ${product.id}: ${error.message}`);
            console.error(`SPORTS SOUTH BULK UPDATE: Failed to update product ${product.id}:`, error);
          }
        }

        // Progress update
        console.log(`SPORTS SOUTH BULK UPDATE: Processed ${Math.min(i + batchSize, result.totalProducts)} of ${result.totalProducts} products`);
      }

      console.log(`SPORTS SOUTH BULK UPDATE: Completed! Updated: ${result.updated}, Skipped: ${result.skipped}, Failed: ${result.failed}`);
      return result;

    } catch (error: any) {
      result.errors.push(`Bulk update failed: ${error.message}`);
      console.error('SPORTS SOUTH BULK UPDATE: Bulk update failed:', error);
      return result;
    }
  }

  /**
   * Update a single product's name with SHDESC
   */
  private async updateProductName(product: any, result: BulkUpdateResult): Promise<void> {
    if (!this.sportsSouthAPI || !this.supportedVendorId) {
      throw new Error('Service not initialized');
    }

    // Get ITEMNO for this product
    let itemno = product.manufacturerPartNumber;
    
    // If no manufacturerPartNumber, try to find it from vendor product mappings
    if (!itemno) {
      const mapping = await db
        .select()
        .from(vendorProductMappings)
        .where(
          and(
            eq(vendorProductMappings.productId, product.id),
            eq(vendorProductMappings.supportedVendorId, this.supportedVendorId)
          )
        );

      if (mapping.length > 0) {
        itemno = mapping[0].vendorSku;
      }
    }

    if (!itemno) {
      result.skipped++;
      console.log(`SPORTS SOUTH BULK UPDATE: Skipped product ${product.id} - no ITEMNO found`);
      return;
    }

    // Check if product name needs updating (same criteria as before)
    const currentName = product.name || '';
    if (currentName.length >= 15 && !/^[A-Z0-9]{3,}\s+[0-9]+$/.test(currentName)) {
      result.skipped++;
      console.log(`SPORTS SOUTH BULK UPDATE: Skipped product ${product.id} - name already adequate: ${currentName}`);
      return;
    }

    // Fetch SHDESC from Sports South API
    console.log(`SPORTS SOUTH BULK UPDATE: Fetching SHDESC for product ${product.id}, ITEMNO: ${itemno}`);
    
    const shdesc = await this.sportsSouthAPI.fetchSHDESCForBulkUpdate(itemno);

    if (!shdesc) {
      result.skipped++;
      console.log(`SPORTS SOUTH BULK UPDATE: No SHDESC found for product ${product.id}, ITEMNO: ${itemno}`);
      return;
    }

    // Update the product name in master catalog
    await db
      .update(products)
      .set({ 
        name: shdesc,
        updatedAt: new Date()
      })
      .where(eq(products.id, product.id));

    result.updated++;
    console.log(`SPORTS SOUTH BULK UPDATE: Updated product ${product.id}: "${currentName}" -> "${shdesc.substring(0, 60)}..."`);
  }
}
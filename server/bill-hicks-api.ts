import { db } from './db';
import { vendorInventory, vendorProductMappings, products } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from './storage';

export interface BillHicksInventoryRecord {
  Product: string; // Vendor SKU
  UPC: string;
  'Qty Avail': string;
}

export interface BillHicksPricingData {
  vendorSku: string;
  upc: string;
  quantityAvailable: number;
  vendorCost?: number;
  mapPrice?: number;
  msrpPrice?: number;
  lastUpdated: Date;
}

/**
 * Bill Hicks pricing and inventory handler
 * Uses stored vendor mapping data since Bill Hicks is FTP-based, not real-time API
 */
export class BillHicksAPI {
  private vendorId: number | null = null; // Bill Hicks vendor ID (dynamically resolved)

  /**
   * Get pricing and availability for a specific product
   * Uses pre-imported data from FTP catalog and inventory files
   * OPTIMIZED: Single JOIN query instead of 4 separate queries
   */
  async getProductPricing(upc: string, companyId: number): Promise<BillHicksPricingData | null> {
    const startTime = Date.now();
    
    try {
      // Get Bill Hicks vendor ID dynamically if not already cached
      if (this.vendorId === null) {
        this.vendorId = await storage.getBillHicksVendorId();
      }
      
      // OPTIMIZED: Single query with JOINs instead of 4 separate queries
      // Combines: product lookup + vendor mapping + inventory lookup
      const [result] = await db.select({
        vendorSku: vendorProductMappings.vendorSku,
        vendorCost: vendorProductMappings.vendorCost,
        mapPrice: vendorProductMappings.mapPrice,
        msrpPrice: vendorProductMappings.msrpPrice,
        lastPriceUpdate: vendorProductMappings.lastPriceUpdate,
        updatedAt: vendorProductMappings.updatedAt,
        quantityAvailable: vendorInventory.quantityAvailable,
      })
      .from(products)
      .innerJoin(
        vendorProductMappings,
        and(
          eq(products.id, vendorProductMappings.productId),
          eq(vendorProductMappings.supportedVendorId, this.vendorId),
          eq(vendorProductMappings.companyId, companyId)
        )
      )
      .leftJoin(
        vendorInventory,
        and(
          eq(vendorInventory.supportedVendorId, this.vendorId),
          eq(vendorInventory.vendorSku, vendorProductMappings.vendorSku)
        )
      )
      .where(eq(products.upc, upc))
      .limit(1);

      const duration = Date.now() - startTime;
      
      if (!result) {
        console.log(`VENDOR_TIMING: Bill Hicks completed in ${duration}ms - NOT_FOUND (UPC: ${upc})`);
        return null;
      }

      console.log(`VENDOR_TIMING: Bill Hicks completed in ${duration}ms - SUCCESS (UPC: ${upc})`);

      return {
        vendorSku: result.vendorSku,
        upc: upc,
        quantityAvailable: result.quantityAvailable || 0,
        vendorCost: result.vendorCost ? parseFloat(result.vendorCost) : undefined,
        mapPrice: result.mapPrice ? parseFloat(result.mapPrice) : undefined,
        msrpPrice: result.msrpPrice ? parseFloat(result.msrpPrice) : undefined,
        lastUpdated: result.lastPriceUpdate || result.updatedAt
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`VENDOR_TIMING: Bill Hicks completed in ${duration}ms - FAILED (UPC: ${upc})`, error);
      return null;
    }
  }

  /**
   * Get pricing for multiple products (batch lookup)
   */
  async getBatchProductPricing(upcs: string[], companyId: number): Promise<BillHicksPricingData[]> {
    // Get Bill Hicks vendor ID dynamically if not already cached
    if (this.vendorId === null) {
      this.vendorId = await storage.getBillHicksVendorId();
    }
    
    const results: BillHicksPricingData[] = [];
    
    for (const upc of upcs) {
      const pricing = await this.getProductPricing(upc, companyId);
      if (pricing) {
        results.push(pricing);
      }
    }
    
    return results;
  }

  /**
   * Test connection - Test actual FTP connection with provided credentials
   */
  async testConnection(companyId: number, credentials?: { ftpServer: string; ftpUsername: string; ftpPassword: string; ftpPort?: number }): Promise<{ success: boolean; message: string }> {
    try {
      // If credentials provided, test them directly (for Test Connection button)
      if (credentials) {
        const { testFtpConnection } = await import('./ftp-utils.js');
        
        // Clean hostname - remove protocol prefixes and trailing slashes
        let hostname = credentials.ftpServer;
        hostname = hostname.replace(/^(https?|ftps?):\/\//, '').replace(/\/$/, '');
        
        const ftpConfig = {
          host: hostname,
          port: credentials.ftpPort || 21,
          username: credentials.ftpUsername,
          password: credentials.ftpPassword
        };
        
        console.log('🔍 BILL HICKS FTP TEST: Testing connection to', ftpConfig.host);
        const result = await testFtpConnection(ftpConfig);
        
        if (result.success) {
          return {
            success: true,
            message: `FTP connection successful to ${ftpConfig.host}`
          };
        } else {
          return {
            success: false,
            message: result.message || 'FTP connection failed'
          };
        }
      }
      
      // Otherwise, check if store has product mappings (for general status check)
      if (this.vendorId === null) {
        this.vendorId = await storage.getBillHicksVendorId();
      }
      
      const mappingCount = await db.select()
        .from(vendorProductMappings)
        .where(
          and(
            eq(vendorProductMappings.supportedVendorId, this.vendorId),
            eq(vendorProductMappings.companyId, companyId)
          )
        );

      if (mappingCount.length === 0) {
        return {
          success: false,
          message: 'No Bill Hicks product mappings found. Contact support to get your products mapped.'
        };
      }

      return {
        success: true,
        message: `Bill Hicks integration active: ${mappingCount.length} products mapped`
      };

    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Manual catalog sync using simplified scheduler
   */
  async syncCatalog(companyId: number): Promise<void> {
    // Get Bill Hicks vendor ID dynamically if not already cached
    if (this.vendorId === null) {
      this.vendorId = await storage.getBillHicksVendorId();
    }
    
    console.log(`BILL HICKS API: Starting catalog sync for company ${companyId}`);
    
    // Use the simplified sync function directly
    const { runBillHicksSimpleSync } = await import('./bill-hicks-simple-sync');
    const result = await runBillHicksSimpleSync();
    
    if (result.success) {
      console.log(`BILL HICKS API: Catalog sync completed for company ${companyId}: ${result.message}`);
    } else {
      console.error(`BILL HICKS API: Catalog sync failed for company ${companyId}: ${result.message}`);
    }
  }

  /**
   * Get vendor capabilities
   */
  getCapabilities() {
    return {
      supportsPricing: true,
      supportsInventory: true,
      supportsOrdering: false, // Not implemented yet
      isRealTime: false, // Uses pre-imported data
      updateFrequency: 'daily' // Catalog daily, inventory daily
    };
  }
}

export default BillHicksAPI;
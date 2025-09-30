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
   */
  async getProductPricing(upc: string, companyId: number): Promise<BillHicksPricingData | null> {
    try {
      // Get Bill Hicks vendor ID dynamically if not already cached
      if (this.vendorId === null) {
        this.vendorId = await storage.getBillHicksVendorId();
      }
      
      // Find the product by UPC
      const [product] = await db.select()
        .from(products)
        .where(eq(products.upc, upc));

      if (!product) {
        return null;
      }

      // Get Bill Hicks vendor mapping for this company
      const [vendorMapping] = await db.select()
        .from(vendorProductMappings)
        .where(
          and(
            eq(vendorProductMappings.productId, product.id),
            eq(vendorProductMappings.supportedVendorId, this.vendorId),
            eq(vendorProductMappings.companyId, companyId)
          )
        );

      if (!vendorMapping) {
        return null; // Bill Hicks doesn't carry this product for this company
      }

      // Get inventory data (shared across all companies)
      const [inventoryRecord] = await db.select()
        .from(vendorInventory)
        .where(
          and(
            eq(vendorInventory.supportedVendorId, this.vendorId),
            eq(vendorInventory.vendorSku, vendorMapping.vendorSku)
          )
        );

      return {
        vendorSku: vendorMapping.vendorSku,
        upc: upc,
        quantityAvailable: inventoryRecord?.quantityAvailable || 0,
        vendorCost: vendorMapping.vendorCost ? parseFloat(vendorMapping.vendorCost) : undefined,
        mapPrice: vendorMapping.mapPrice ? parseFloat(vendorMapping.mapPrice) : undefined,
        msrpPrice: vendorMapping.msrpPrice ? parseFloat(vendorMapping.msrpPrice) : undefined,
        lastUpdated: vendorMapping.lastPriceUpdate || vendorMapping.updatedAt
      };

    } catch (error) {
      console.error(`Bill Hicks API Error for UPC ${upc}:`, error);
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
   * Test connection - For Bill Hicks, this validates that we have working vendor mappings
   */
  async testConnection(companyId: number): Promise<{ success: boolean; message: string }> {
    try {
      // Get Bill Hicks vendor ID dynamically if not already cached
      if (this.vendorId === null) {
        this.vendorId = await storage.getBillHicksVendorId();
      }
      
      // Count how many Bill Hicks products this company has access to
      const mappingCount = await db.select()
        .from(vendorProductMappings)
        .where(
          and(
            eq(vendorProductMappings.supportedVendorId, this.vendorId),
            eq(vendorProductMappings.companyId, companyId)
          )
        );

      const inventoryCount = await db.select()
        .from(vendorInventory)
        .where(eq(vendorInventory.supportedVendorId, this.vendorId));

      if (mappingCount.length === 0) {
        return {
          success: false,
          message: 'No Bill Hicks product mappings found for this company'
        };
      }

      return {
        success: true,
        message: `Bill Hicks integration active: ${mappingCount.length} products mapped, ${inventoryCount.length} inventory records`
      };

    } catch (error) {
      return {
        success: false,
        message: `Bill Hicks connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    
    // Use the simplified sync function
    const { triggerBillHicksSyncManually } = await import('./bill-hicks-simple-scheduler');
    const result = await triggerBillHicksSyncManually();
    
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
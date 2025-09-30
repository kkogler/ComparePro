import { storage } from './storage';
import { GunBrokerAPI } from './gunbroker-api';
import type { InsertProduct, InsertVendorProduct } from '@shared/schema';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  details: string[];
}

export class MasterCatalogPopulator {
  
  /**
   * Populate Master Product Catalog from all available working vendors
   */
  async populateFromAllSources(): Promise<ImportResult> {
    console.log('=== Starting Master Product Catalog Population ===');
    
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    
    try {
      // Get all vendors with valid credentials
      const vendors = await storage.getAllVendors();
      const workingVendors = vendors.filter(v => 
        v.status === 'online' && 
        v.credentials
      );
      
      console.log(`Found ${workingVendors.length} working vendors`);
      result.details.push(`Found ${workingVendors.length} working vendors`);
      
      // Process GunBroker vendor
      const gunbrokerVendor = workingVendors.find(v => v.name === 'GunBroker');
      if (gunbrokerVendor) {
        const gbResult = await this.importFromGunBroker(gunbrokerVendor);
        result.imported += gbResult.imported;
        result.skipped += gbResult.skipped;
        result.errors += gbResult.errors;
        result.details.push(...gbResult.details);
      }
      
      // Import from vendor APIs only - no hardcoded product data
      const vendorAPIResult = await this.importFromConnectedVendors();
      result.imported += vendorAPIResult.imported;
      result.skipped += vendorAPIResult.skipped;
      result.errors += vendorAPIResult.errors;
      result.details.push(...vendorAPIResult.details);
      
      // Update final count
      const finalProducts = await storage.getAllProducts();
      result.details.push(`Master Product Catalog now contains ${finalProducts.length} total products`);
      
      console.log('=== Population Complete ===');
      console.log(`Total: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`);
      
      return result;
      
    } catch (error) {
      console.error('Master catalog population failed:', error);
      result.errors++;
      result.details.push(`Population failed: ${error.message}`);
      return result;
    }
  }
  
  /**
   * Import products from GunBroker marketplace
   */
  private async importFromGunBroker(vendor: any): Promise<ImportResult> {
    const result: ImportResult = { imported: 0, skipped: 0, errors: 0, details: [] };
    
    // GunBroker is a marketplace - no catalog sync needed
    // Store-level credentials handle real-time pricing/availability API calls
    console.log('GUNBROKER SYNC: Skipped - GunBroker is marketplace-only, no catalog sync required');
    result.details.push('GunBroker: Skipped - marketplace uses real-time API calls only');
    return result;
    
    try {
      console.log('=== Importing from GunBroker ===');
      
      const gunbrokerAPI = new GunBrokerAPI(vendor.credentials);
      
      // Search for major firearms brands
      const brands = ['Glock', 'Smith & Wesson', 'Ruger', 'Sig Sauer', 'Springfield', 'Beretta', 'Colt'];
      
      for (const brand of brands) {
        try {
          console.log(`Searching GunBroker for ${brand} products...`);
          
          const products = await gunbrokerAPI.searchProducts({
            keywords: brand,
            buyNowOnly: true,
            pageSize: 100
          });
          
          if (products && products.length > 0) {
            console.log(`Found ${products.length} ${brand} products`);
            
            for (const item of products.slice(0, 20)) { // Limit to 20 per brand
              try {
                const importItemResult = await this.importSingleProduct(item, vendor.id, 'GunBroker');
                if (importItemResult === 'imported') result.imported++;
                else if (importItemResult === 'skipped') result.skipped++;
              } catch (error) {
                result.errors++;
                console.error(`Error importing ${item.title}:`, error);
              }
            }
          }
          
          // Small delay between brand searches
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (brandError) {
          console.error(`Error searching ${brand}:`, brandError);
          result.errors++;
        }
      }
      
      result.details.push(`GunBroker: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`);
      
    } catch (error) {
      console.error('GunBroker import failed:', error);
      result.errors++;
      result.details.push(`GunBroker import failed: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Import products from connected vendor APIs (no hardcoded product data)
   */
  private async importFromConnectedVendors(): Promise<ImportResult> {
    const result: ImportResult = { imported: 0, skipped: 0, errors: 0, details: [] };
    
    try {
      console.log('=== Importing from Connected Vendor APIs ===');
      
      // Import from connected vendor APIs only - no hardcoded product data
      // This ensures all product data comes from authentic vendor sources
      console.log('Note: Products are imported from connected vendor APIs during catalog refresh');
      console.log('No hardcoded product data is used to maintain data integrity');
      
      result.details.push('Skipped hardcoded product import - using vendor API data only');
      result.skipped = 1; // Mark as skipped operation

      
    } catch (error) {
      console.error('Vendor API import failed:', error);
      result.errors++;
      result.details.push(`Vendor API import failed: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Import a single product from marketplace data
   */
  private async importSingleProduct(item: any, vendorId: number, source: string): Promise<'imported' | 'skipped'> {
    try {
      // Extract UPC from various fields
      const upc = item.gtin || item.upc || item.UPC || null;
      
      if (!upc || upc.length < 10) {
        return 'skipped';
      }
      
      // Check if product already exists
      const existingProduct = await storage.getProductByUPC(upc);
      if (existingProduct) {
        return 'skipped';
      }
      
      // Extract product details
      const name = item.title || item.name || 'Unknown Product';
      const brand = this.extractBrand(name);
      const model = this.extractModel(name);
      const caliber = this.extractCaliber(name);
      
      // Create product
      const product = await storage.createProduct({
        upc,
        name,
        brand,
        model: model || 'Unknown',
        partNumber: item.manufacturerPartNumber || item.mpn || null,
        caliber,
        category: 'Firearms',
        description: item.description || name,
        msrp: item.msrp || null,
        imageUrl: item.pictureUrl || null
      });
      
      // Create vendor product relationship
      await storage.createVendorProduct({
        vendorId,
        productId: product.id,
        vendorSku: item.id?.toString() || item.itemId?.toString() || 'N/A'
      });
      
      return 'imported';
      
    } catch (error) {
      throw error;
    }
  }
  
  // Helper methods for data extraction
  private extractBrand(title: string): string {
    const brands = ['Glock', 'Smith & Wesson', 'Sig Sauer', 'Springfield', 'Ruger', 'Beretta', 'Colt', 'Kimber', 'Taurus', 'Walther'];
    const upperTitle = title.toUpperCase();
    
    for (const brand of brands) {
      if (upperTitle.includes(brand.toUpperCase())) {
        return brand;
      }
    }
    
    return 'Unknown';
  }
  
  private extractModel(title: string): string {
    // Common model patterns
    const modelPatterns = [
      /G(\d{2}X?)/i,  // Glock models (G17, G19, G19X)
      /M&P/i,         // Smith & Wesson M&P
      /P(\d{3})/i,    // Sig P320, P365
      /XD[MS]?/i,     // Springfield XD, XDM, XDS
      /1911/i,        // 1911 models
      /92FS/i         // Beretta 92FS
    ];
    
    for (const pattern of modelPatterns) {
      const match = title.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  }
  
  private extractCaliber(title: string): string | null {
    const caliberPatterns = [
      /9mm/i,
      /\.40\s?S&W/i,
      /\.45\s?ACP/i,
      /\.380\s?ACP/i,
      /10mm/i,
      /\.357/i,
      /\.38/i
    ];
    
    for (const pattern of caliberPatterns) {
      const match = title.match(pattern);
      if (match) {
        return match[0].toLowerCase();
      }
    }
    
    return null;
  }
}

export const masterCatalogPopulator = new MasterCatalogPopulator();
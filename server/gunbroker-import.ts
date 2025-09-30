import { GunBrokerAPI } from './gunbroker-api';
import { db } from './db';
import { products, vendorProducts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class GunBrokerImporter {
  private gunbrokerApi: GunBrokerAPI;
  private organizationId: number;
  private vendorId: number;

  constructor(credentials: any, organizationId: number, vendorId: number) {
    this.gunbrokerApi = new GunBrokerAPI(credentials);
    this.organizationId = organizationId;
    this.vendorId = vendorId;
  }

  async importGlockProducts(): Promise<{ imported: number; skipped: number; errors: number }> {
    console.log('Starting GunBroker Glock product import...');
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    try {
      // Search for Glock products with pagination to get all 779+ results
      const glockProducts = [];
      let page = 1;
      const pageSize = 100;
      
      while (glockProducts.length < 779) {
        console.log(`Fetching GunBroker page ${page}...`);
        
        const searchResults = await this.gunbrokerApi.searchProducts({
          keywords: 'Glock',
          pageSize: pageSize,
          pageIndex: page
        });
        
        if (!searchResults || searchResults.length === 0) {
          console.log(`No more results found at page ${page}`);
          break;
        }
        
        glockProducts.push(...searchResults);
        console.log(`Retrieved ${searchResults.length} products, total: ${glockProducts.length}`);
        
        page++;
        
        // Add delay between API calls
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`Total GunBroker products retrieved: ${glockProducts.length}`);
      
      // Process each product
      for (const item of glockProducts) {
        try {
          // Extract UPC from GTIN field
          const upc = item.gtin || item.upc || null;
          
          if (!upc || upc.length < 10) {
            console.log(`Skipping item ${item.id} - no valid UPC: ${upc}`);
            skipped++;
            continue;
          }
          
          // Extract brand, model, and caliber from title
          const title = item.name || item.title || '';
          const brand = this.extractBrand(title);
          const model = this.extractModel(title);
          const caliber = this.extractCaliber(title);
          
          // Check if product already exists by UPC
          const existingProducts = await db
            .select()
            .from(products)
            .where(eq(products.upc, upc))
            .limit(1);
            
          let productId: number;
          
          if (existingProducts.length > 0) {
            productId = existingProducts[0].id;
            console.log(`Product exists with UPC ${upc}, using existing ID ${productId}`);
          } else {
            // Create new product
            const [newProduct] = await db
              .insert(products)
              .values({
                upc: upc,
                name: title,
                brand: brand,
                model: model,
                caliber: caliber,
                partNumber: null, // GunBroker doesn't provide manufacturer part numbers
                description: item.description || null,
                organizationId: this.organizationId
              })
              .returning();
              
            productId = newProduct.id;
            console.log(`Created new product: ${title} with UPC ${upc}`);
            imported++;
          }
          
          // Create vendor product relationship
          const existingVendorProducts = await db
            .select()
            .from(vendorProducts)
            .where(and(
              eq(vendorProducts.productId, productId),
              eq(vendorProducts.vendorId, this.vendorId)
            ))
            .limit(1);
            
          if (existingVendorProducts.length === 0) {
            await db
              .insert(vendorProducts)
              .values({
                productId: productId,
                vendorId: this.vendorId,
                vendorSku: item.id?.toString() || `GB-${Date.now()}`,
                organizationId: this.organizationId
              });
          }
          
        } catch (error) {
          console.error(`Error processing item ${item.id}:`, error);
          errors++;
        }
      }
      
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
    
    console.log(`Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
    return { imported, skipped, errors };
  }
  
  private extractBrand(title: string): string | null {
    const brands = ['Glock', 'GLOCK'];
    for (const brand of brands) {
      if (title.toUpperCase().includes(brand.toUpperCase())) {
        return brand;
      }
    }
    return 'Glock'; // Default for Glock search results
  }
  
  private extractModel(title: string): string | null {
    // Extract Glock model numbers (G17, G19, G26, etc.)
    const modelMatch = title.match(/G(\d+[A-Z]*)/i);
    return modelMatch ? `G${modelMatch[1]}` : null;
  }
  
  private extractCaliber(title: string): string | null {
    const caliberPatterns = [
      /9mm/i, /\.40/i, /40 S&W/i, /\.45/i, /45 ACP/i, 
      /\.380/i, /380 ACP/i, /10mm/i, /\.357/i
    ];
    
    for (const pattern of caliberPatterns) {
      const match = title.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return null;
  }
}
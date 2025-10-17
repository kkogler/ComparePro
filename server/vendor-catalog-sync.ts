import fetch from 'node-fetch';
import { db } from './db';
import { products, vendors, vendorProducts } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { ImageService } from './image-service';

/**
 * Service for synchronizing vendor catalogs and populating master product database
 */
export class VendorCatalogSyncService {
  
  /**
   * Sync catalog from a newly added vendor and populate master database
   */
  static async syncNewVendorCatalog(organizationId: number, vendorId: number): Promise<{
    newProducts: number;
    updatedProducts: number;
    newImages: number;
    totalProcessed: number;
  }> {
    try {
      console.log(`CATALOG SYNC: Starting new vendor catalog sync for vendor ${vendorId}`);
      
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.id, vendorId), eq(vendors.organizationId, organizationId)));

      if (!vendor) {
        throw new Error(`Vendor ${vendorId} not found for organization ${organizationId}`);
      }

      let result = {
        newProducts: 0,
        updatedProducts: 0,
        newImages: 0,
        totalProcessed: 0
      };

      // Use vendor registry for catalog sync
      const { vendorRegistry } = await import('./vendor-registry');
      result = await vendorRegistry.syncVendorCatalog(vendor);

      // After catalog sync, search for missing images
      const imageResults = await ImageService.findMissingImages(organizationId);
      result.newImages = imageResults.updated;

      console.log(`CATALOG SYNC: Complete for ${vendor.name} - ${result.newProducts} new products, ${result.updatedProducts} updated, ${result.newImages} new images`);
      return result;

    } catch (error: any) {
      console.error('CATALOG SYNC: Error syncing vendor catalog:', error.message);
      throw error;
    }
  }

  /**
   * Sync Chattanooga Shooting Supplies catalog
   */
  private static async syncChattanoogaCatalog(vendor: any): Promise<{
    newProducts: number;
    updatedProducts: number;
    newImages: number;
    totalProcessed: number;
  }> {
    const { ChattanoogaAPI } = await import('./chattanooga-api.js');
    const api = new ChattanoogaAPI(vendor.credentials);
    
    let newProducts = 0;
    let updatedProducts = 0;

    try {
      // Get product feed from Chattanooga
      const feedResult = await api.getProductFeed();
      
      if (!feedResult.success) {
        throw new Error(`Chattanooga API error: ${feedResult.message}`);
      }

      // Process CSV data if available
      if (Array.isArray(feedResult.data)) {
        for (const chattanoogaProduct of feedResult.data) {
          if (!chattanoogaProduct.upc || !chattanoogaProduct.name) {
            continue; // Skip products without required fields
          }

          const transformed = await ChattanoogaAPI.transformProduct(chattanoogaProduct);
          const productResult = await this.upsertProduct(transformed);
          
          if (productResult.isNew) {
            newProducts++;
          } else {
            updatedProducts++;
          }

          // Create vendor product association
          await this.createVendorProductAssociation(
            vendor.id,
            productResult.productId,
            chattanoogaProduct.cssi_id || chattanoogaProduct.name
          );
        }
      }

      return {
        newProducts,
        updatedProducts,
        newImages: 0,
        totalProcessed: newProducts + updatedProducts
      };

    } catch (error: any) {
      console.error('CATALOG SYNC: Chattanooga sync error:', error.message);
      return { newProducts: 0, updatedProducts: 0, newImages: 0, totalProcessed: 0 };
    }
  }

  /**
   * Sync GunBroker marketplace catalog (import exactly 10 authentic products per sync)
   */
  private static async syncGunBrokerCatalog(vendor: any): Promise<{
    newProducts: number;
    updatedProducts: number;
    newImages: number;
    totalProcessed: number;
  }> {
    // GunBroker is a marketplace - no catalog sync needed
    // Store-level credentials handle real-time pricing/availability API calls
    console.log('CATALOG SYNC: Skipped GunBroker - marketplace uses real-time API calls only');
    return {
      newProducts: 0,
      updatedProducts: 0,
      newImages: 0,
      totalProcessed: 0
    };

    const { GunBrokerAPI } = await import('./gunbroker-api.js');
    const api = new GunBrokerAPI(vendor.credentials);
    
    let newProducts = 0;
    let updatedProducts = 0;
    const TARGET_PRODUCTS = 10; // Exactly 10 products per sync

    try {
      console.log(`CATALOG SYNC: Starting GunBroker import - target: ${TARGET_PRODUCTS} authentic products`);
      
      // Get access token for API calls
      const token = await api.getAccessToken();
      if (!token) {
        throw new Error('GunBroker authentication failed - check credentials');
      }

      // Use direct API call for bulk import with pagination
      const queryParams = new URLSearchParams({
        'Keywords': 'Glock', // Focus on one brand for consistent results
        'PageSize': TARGET_PRODUCTS.toString(), // Get exactly 10 items
        'PageIndex': '1',
        'Sort': '13', // Featured and Relevance sorting
        'BuyNowOnly': 'true' // Only fixed-price items
      });

      const baseUrl = api.credentials.environment === 'production' 
        ? 'https://api.gunbroker.com/v1'
        : 'https://api.sandbox.gunbroker.com/v1';
      
      const url = `${baseUrl}/Items?${queryParams.toString()}`;
      console.log(`CATALOG SYNC: Fetching ${TARGET_PRODUCTS} products from GunBroker: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-DevKey': api.credentials.devKey,
          'X-AccessToken': token,
          'User-Agent': 'RetailPlatform/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`GunBroker API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const items = data.results || [];
      
      console.log(`CATALOG SYNC: Retrieved ${items.length} authentic products from GunBroker API`);

      // Process each authentic product from the API response
      for (const item of items.slice(0, TARGET_PRODUCTS)) {
        try {
          // Transform using authentic GunBroker API field names (try multiple field variations)
          const itemId = item.ItemID || item.itemID || item.id;
          const title = item.Title || item.title || 'GunBroker Item';
          const gtin = item.GTIN || item.gtin || item.upc;
          const partNum = item.MfgPartNumber || item.mfgPartNumber || item.manufacturerPartNumber;
          const imageUrl = item.PictureURL || item.pictureURL || item.thumbnailURL || item.ThumbnailURL;
          
          const transformed = {
            upc: gtin || `GB-${itemId}`, // Use authentic GTIN (UPC) from API
            name: title,
            brand: this.extractBrand(title) || 'Unknown',
            model: this.extractModel(title) || 'Unknown',
            partNumber: partNum || itemId?.toString() || 'N/A',
            description: item.Description || item.description || title,
            imageUrl: imageUrl || null,
            imageSource: imageUrl ? 'gunbroker' : null, // Use vendor slug
            fflRequired: true, // GunBroker firearms require FFL
            serialized: true
          };

          console.log(`CATALOG SYNC: Processing authentic product: ${transformed.name} (UPC: ${transformed.upc})`);

          const productResult = await this.upsertProduct(transformed);
          
          if (productResult.isNew) {
            newProducts++;
            console.log(`CATALOG SYNC: Added new product: ${transformed.name}`);
          } else {
            updatedProducts++;
            console.log(`CATALOG SYNC: Updated existing product: ${transformed.name}`);
          }

          // Create vendor product association with authentic ItemID
          await this.createVendorProductAssociation(
            vendor.id,
            productResult.productId,
            itemId?.toString() || 'marketplace-item'
          );

        } catch (productError: any) {
          console.error(`CATALOG SYNC: Error processing product ${item.ItemID}:`, productError.message);
        }
      }

      console.log(`CATALOG SYNC: GunBroker import complete - ${newProducts} new, ${updatedProducts} updated (${newProducts + updatedProducts}/${TARGET_PRODUCTS} target)`);

      return {
        newProducts,
        updatedProducts,
        newImages: 0,
        totalProcessed: newProducts + updatedProducts
      };

    } catch (error: any) {
      console.error('CATALOG SYNC: GunBroker sync error:', error.message);
      return { newProducts: 0, updatedProducts: 0, newImages: 0, totalProcessed: 0 };
    }
  }

  /**
   * Extract brand name from product title
   */
  private static extractBrand(title: string): string {
    if (!title) return 'Unknown';
    
    const brands = ['Glock', 'Smith & Wesson', 'Ruger', 'Sig Sauer', 'Springfield', 'Remington', 'Beretta', 'Colt', 'Kimber', 'Wilson Combat'];
    
    for (const brand of brands) {
      if (title.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }
    
    // Extract first word as brand if no known brand found
    return title.split(' ')[0] || 'Unknown';
  }

  /**
   * Extract model from product title
   */
  private static extractModel(title: string): string {
    if (!title) return 'Unknown';
    
    // Look for common model patterns
    const modelMatch = title.match(/\b(G\d+|M\d+|SR\d+|P\d+|1911|AR-\d+)\b/i);
    if (modelMatch) {
      return modelMatch[1];
    }
    
    // Fallback to second word
    const words = title.split(' ');
    return words.length > 1 ? words[1] : 'Unknown';
  }



  /**
   * Upsert product into master database
   */
  private static async upsertProduct(productData: any): Promise<{ productId: number; isNew: boolean }> {
    try {
      // Check if product exists by UPC
      const [existingProduct] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.upc, productData.upc));

      if (existingProduct) {
        // Update existing product with new information (but preserve higher-priority images)
        await db
          .update(products)
          .set({
            name: productData.name,
            brand: productData.brand,
            model: productData.model,
            partNumber: productData.partNumber,
            description: productData.description,
            weight: productData.weight || null,
            fflRequired: productData.fflRequired || false,
            serialized: productData.serialized || false,
            mapPrice: productData.mapPrice || null,
            retailPrice: productData.retailPrice || null,
            dropShipAvailable: productData.dropShipAvailable || false,
            allocated: productData.allocated || false,
            updatedAt: new Date()
          })
          .where(eq(products.id, existingProduct.id));

        // Handle image updates with priority system
        if (productData.imageUrl && productData.imageSource) {
          await ImageService.updateProductImage(
            productData.upc, 
            productData.imageUrl, 
            productData.imageSource
          );
        }

        return { productId: existingProduct.id, isNew: false };
      } else {
        // Create new product
        const [newProduct] = await db
          .insert(products)
          .values({
            upc: productData.upc,
            name: productData.name,
            brand: productData.brand,
            model: productData.model,
            partNumber: productData.partNumber,
            description: productData.description,
            weight: productData.weight || null,
            imageUrl: productData.imageUrl || null,
            imageSource: productData.imageSource || null,
            fflRequired: productData.fflRequired || false,
            serialized: productData.serialized || false,
            mapPrice: productData.mapPrice || null,
            retailPrice: productData.retailPrice || null,
            dropShipAvailable: productData.dropShipAvailable || false,
            allocated: productData.allocated || false
          })
          .returning({ id: products.id });

        return { productId: newProduct.id, isNew: true };
      }
    } catch (error: any) {
      console.error(`CATALOG SYNC: Error upserting product ${productData.upc}:`, error.message);
      throw error;
    }
  }

  /**
   * Create vendor-product association
   */
  private static async createVendorProductAssociation(
    vendorId: number, 
    productId: number, 
    vendorSku: string
  ): Promise<void> {
    try {
      // Check if association already exists
      const [existing] = await db
        .select({ id: vendorProducts.id })
        .from(vendorProducts)
        .where(and(
          eq(vendorProducts.vendorId, vendorId),
          eq(vendorProducts.productId, productId)
        ));

      if (!existing) {
        await db
          .insert(vendorProducts)
          .values({
            vendorId,
            productId,
            vendorSku
          });
      } else {
        // Update existing association
        await db
          .update(vendorProducts)
          .set({
            vendorSku,
            lastUpdated: new Date()
          })
          .where(eq(vendorProducts.id, existing.id));
      }
    } catch (error: any) {
      console.error(`CATALOG SYNC: Error creating vendor product association:`, error.message);
    }
  }

  /**
   * Get sync statistics for organization
   */
  static async getSyncStats(organizationId: number): Promise<{
    totalProducts: number;
    productsWithImages: number;
    productsWithoutImages: number;
    vendorCoverage: { vendorName: string; productCount: number }[];
  }> {
    try {
      // Get total products
      const totalProducts = await db
        .select({ count: products.id })
        .from(products);

      // Get products with images
      const productsWithImages = await db
        .select({ count: products.id })
        .from(products)
        .where(eq(products.imageUrl, null));

      // Get vendor coverage
      const vendorCoverage = await db
        .select({
          vendorName: vendors.name,
          productCount: vendorProducts.id
        })
        .from(vendors)
        .leftJoin(vendorProducts, eq(vendors.id, vendorProducts.vendorId))
        .where(eq(vendors.organizationId, organizationId));

      return {
        totalProducts: totalProducts.length,
        productsWithImages: totalProducts.length - productsWithImages.length,
        productsWithoutImages: productsWithImages.length,
        vendorCoverage: [] // Would need proper aggregation query
      };
    } catch (error: any) {
      console.error('CATALOG SYNC: Error getting sync stats:', error.message);
      return {
        totalProducts: 0,
        productsWithImages: 0,
        productsWithoutImages: 0,
        vendorCoverage: []
      };
    }
  }
}
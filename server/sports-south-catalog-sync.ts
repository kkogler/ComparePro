import { storage } from './storage';
import { createSportsSouthAPI, SportsSouthCredentials, SportsSouthProduct } from './sports-south-api';
import { RETAIL_VERTICALS } from '../shared/retail-vertical-config';
import { SportsSouthSyncSettings, DEFAULT_SPORTS_SOUTH_SYNC_SETTINGS, SportsSouthDuplicateHandling } from '../shared/sports-south-sync-config';
import { SPORTS_SOUTH_CONFIG, isSportsSouthFirearmCategory, getSportsSouthVendorId, getSportsSouthImageSource } from '../shared/sports-south-config';
import { vendorRegistry } from './vendor-registry';
import { shouldReplaceProduct } from './simple-quality-priority';

interface CatalogSyncResult {
  success: boolean;
  message: string;
  productsProcessed: number;
  newProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  errors: string[];
  warnings: string[];
}

// Import the proper SportsSouthProduct interface from the API file

export class SportsSouthCatalogSyncService {
  private api: any;
  private retailVerticalId: number;
  private sportsSouthVendorId: number | null = null;
  private syncSettings: SportsSouthSyncSettings;

  constructor(credentials: SportsSouthCredentials, retailVerticalId: number = RETAIL_VERTICALS.FIREARMS.id, syncSettings: SportsSouthSyncSettings = DEFAULT_SPORTS_SOUTH_SYNC_SETTINGS) {
    this.api = createSportsSouthAPI(credentials);
    this.retailVerticalId = retailVerticalId;
    this.syncSettings = syncSettings;
  }

  private async getSportsSouthVendorId(): Promise<number> {
    if (this.sportsSouthVendorId !== null) {
      return this.sportsSouthVendorId;
    }
    
    // Find Sports South using vendor registry pattern
    const supportedVendors = await storage.getAllSupportedVendors();
    
    // Use vendor registry ID to identify Sports South vendor
    // The vendor registry uses 'sports-south' ID which should match vendorShortCode
    const sportsSouth = supportedVendors.find(vendor => 
      vendor.vendorShortCode === getSportsSouthVendorId() || 
      vendor.name?.toLowerCase().includes('sports south')
    );
    
    if (!sportsSouth) {
      throw new Error(`Sports South vendor not found in supported vendors (looking for ID: ${getSportsSouthVendorId()})`);
    }
    
    this.sportsSouthVendorId = sportsSouth.id;
    return sportsSouth.id;
  }

  /**
   * Perform full catalog sync from Sports South
   */
  async performFullCatalogSync(): Promise<CatalogSyncResult> {
    const result: CatalogSyncResult = {
      success: false,
      message: '',
      productsProcessed: 0,
      newProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      errors: [],
      warnings: []
    };

    try {
      console.log('SPORTS SOUTH CATALOG SYNC: Starting full catalog sync...');
      
      // Step 1: Get full catalog from Sports South
      const products = await this.api.getFullCatalog();
      result.productsProcessed = products.length;
      
      if (products.length === 0) {
        result.success = false;
        result.message = 'No products retrieved from Sports South catalog';
        result.errors.push('No products returned from Sports South API');
        return result;
      }

      console.log(`SPORTS SOUTH CATALOG SYNC: Processing ${products.length} products...`);

      // Step 2: Process each product
      for (const sportsProduct of products) {
        try {
          await this.processProduct(sportsProduct, result);
        } catch (error: any) {
          console.error(`SPORTS SOUTH CATALOG SYNC: Error processing product ${sportsProduct.ITEMNO}:`, error);
          result.errors.push(`Product ${sportsProduct.ITEMNO}: ${error.message}`);
        }
      }

      // Step 3: Update sync status
      await this.updateSyncStatus(true);

      result.success = true;
      result.message = `Successfully synced ${result.newProducts} new products and updated ${result.updatedProducts} existing products`;
      
      console.log(`SPORTS SOUTH CATALOG SYNC: Completed. New: ${result.newProducts}, Updated: ${result.updatedProducts}, Errors: ${result.errors.length}`);
      
    } catch (error: any) {
      console.error('SPORTS SOUTH CATALOG SYNC: Full sync failed:', error);
      result.success = false;
      result.message = `Catalog sync failed: ${error.message}`;
      result.errors.push(error.message);
      
      await this.updateSyncStatus(false, error.message);
    }

    return result;
  }

  /**
   * Perform incremental catalog sync (products updated since last sync)
   */
  async performIncrementalSync(): Promise<CatalogSyncResult> {
    const result: CatalogSyncResult = {
      success: false,
      message: '',
      productsProcessed: 0,
      newProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      errors: [],
      warnings: []
    };

    try {
      console.log('SPORTS SOUTH CATALOG SYNC: Starting incremental sync...');
      
      // Get last sync date from supported_vendors table
      const supportedVendors = await storage.getAllSupportedVendors();
      
      // Use vendor registry ID to identify Sports South vendor
      const sportsSouthVendor = supportedVendors.find(vendor =>
        vendor.vendorShortCode === getSportsSouthVendorId() || 
        vendor.name?.toLowerCase().includes('sports south')
      );
      
      if (!sportsSouthVendor || !sportsSouthVendor.lastCatalogSync) {
        console.log('SPORTS SOUTH CATALOG SYNC: No previous sync found, performing full sync instead');
        return await this.performFullCatalogSync();
      }

      const lastSyncDate = new Date(sportsSouthVendor.lastCatalogSync);
      const now = new Date();
      const timeSinceLastSync = now.getTime() - lastSyncDate.getTime();
      
      console.log(`SPORTS SOUTH CATALOG SYNC: Last sync was: ${lastSyncDate.toISOString()}`);
      console.log(`SPORTS SOUTH CATALOG SYNC: Current time: ${now.toISOString()}`);
      console.log(`SPORTS SOUTH CATALOG SYNC: Time since last sync: ${Math.round(timeSinceLastSync / 1000)} seconds`);
      console.log(`SPORTS SOUTH CATALOG SYNC: Getting updates since ${lastSyncDate.toLocaleDateString()}`);

      // Get incremental updates from Sports South
      const products = await this.api.getCatalogUpdates(lastSyncDate);
      result.productsProcessed = products.length;

      if (products.length === 0) {
        result.success = true;
        result.message = 'No new updates found since last sync';
        return result;
      }

      console.log(`SPORTS SOUTH CATALOG SYNC: Processing ${products.length} updated products...`);

      // Process each updated product
      for (const sportsProduct of products) {
        try {
          await this.processProduct(sportsProduct, result);
        } catch (error: any) {
          console.error(`SPORTS SOUTH CATALOG SYNC: Error processing product ${sportsProduct.ITEMNO}:`, error);
          result.errors.push(`Product ${sportsProduct.ITEMNO}: ${error.message}`);
        }
      }

      // Update sync status with statistics
      await this.updateSyncStatus(true, undefined, result);

      result.success = true;
      result.message = `Successfully processed ${result.newProducts} new products and ${result.updatedProducts} updated products`;
      
      console.log(`SPORTS SOUTH CATALOG SYNC: Incremental sync completed. New: ${result.newProducts}, Updated: ${result.updatedProducts}, Errors: ${result.errors.length}`);
      
    } catch (error: any) {
      console.error('SPORTS SOUTH CATALOG SYNC: Incremental sync failed:', error);
      result.success = false;
      result.message = `Incremental sync failed: ${error.message}`;
      result.errors.push(error.message);
      
      await this.updateSyncStatus(false, error.message, result);
    }

    return result;
  }

  /**
   * Process a single Sports South product using proper duplicate handling
   */
  private async processProduct(sportsProduct: SportsSouthProduct, result: CatalogSyncResult): Promise<void> {
    try {
      // Step 1: Find existing product using UPC as primary key, MPN as secondary
      let existingProduct;
      
      // Primary: Search by UPC if available
      if (sportsProduct.ITUPC) {
        const products = await storage.searchProducts(sportsProduct.ITUPC, 'upc', this.retailVerticalId);
        existingProduct = products.length > 0 ? products[0] : undefined;
      }
      
      // Secondary: Search by Manufacturer Part Number if no UPC match
      if (!existingProduct && sportsProduct.MFGINO) {
        const products = await storage.searchProducts(sportsProduct.MFGINO, 'manufacturerPartNumber', this.retailVerticalId);
        // Look for exact match on manufacturerPartNumber field
        existingProduct = products.find(p => p.manufacturerPartNumber === sportsProduct.MFGINO);
      }

      // Step 2: Handle duplicates based on sync settings
      if (existingProduct) {
        if (this.syncSettings.duplicateHandling === SportsSouthDuplicateHandling.IGNORE) {
          // Skip existing products completely
          return;
        }
      }

      // Step 3: Get Sports South vendor ID for mapping table
      const sportsSouthVendorId = await this.getSportsSouthVendorId();

      // Step 4: Prepare Master Product Catalog data (NO vendor-specific fields)
      // Use centralized vendor field mapping for brand and product name
      const { extractProductName, extractField } = await import('@shared/vendor-field-mappings');
      
      // Extract brand name using centralized mappings, fallback to existing
      let brandName = extractField(sportsProduct, 'brand', 'sports-south');
      if (!brandName && existingProduct?.brand) {
        brandName = existingProduct.brand;
      }
      
      const productName = extractProductName(sportsProduct, 'sports-south', brandName || undefined);
      
      const productData = {
        upc: sportsProduct.ITUPC || '', // Use ITUPC as primary identifier (actual field name)
        name: productName, // ✅ Using centralized field mapping
        manufacturerPartNumber: sportsProduct.MFGINO || null, // Use MFGINO for actual manufacturer part number
        brand: brandName || '', // Use resolved brand or empty string
        model: this.extractStringValue(sportsProduct.IMODEL), // ✅ FIXED: Safely extract model string from potentially array/object field
        category: null, // Categories are vendor-specific, NOT stored in Master Product Catalog
        subcategory1: null,
        subcategory2: null,
        subcategory3: null,
        description: null, // Will be fetched separately if TXTREF is available
        imageUrl: await this.getImageUrl(sportsProduct), // Initial Sports South image - fallback will be applied later
        imageSource: null, // Will be set by image fallback system
        weight: null, // Weight is vendor-specific, NOT stored in Master Product Catalog
        dimensions: null,
        serialized: this.isFirearmProduct(sportsProduct),
        allocated: false,
        specifications: this.buildSpecifications(sportsProduct),
        customProperties: {},
        status: 'active',
        source: 'Sports South', // Track import source for data lineage
        retailVerticalId: this.retailVerticalId
      };

      let productId: number;

      if (existingProduct && this.syncSettings.duplicateHandling === SportsSouthDuplicateHandling.SMART_MERGE) {
        // Use simple quality-based priority system
        if (await shouldReplaceProduct(existingProduct, productData, 'Sports South')) {
          // Replace with Sports South data (no complex metadata)
          await storage.updateProduct(existingProduct.id, productData);
          console.log(`SPORTS SOUTH CATALOG: Replaced existing product data for UPC ${productData.upc}`);
          productId = existingProduct.id;
          result.updatedProducts++;
        } else {
          // Smart merge: update only missing/better data
          const mergedData = this.smartMergeProductData(existingProduct, productData);
          const hasChanges = this.hasProductChanges(existingProduct, mergedData);
          
          if (hasChanges) {
            await storage.updateProduct(existingProduct.id, mergedData);
            productId = existingProduct.id;
            result.updatedProducts++;
          } else {
            productId = existingProduct.id;
            // Product was examined but no changes made - count as skipped
            result.skippedProducts++;
          }
        }
      } else if (existingProduct && this.syncSettings.duplicateHandling === SportsSouthDuplicateHandling.OVERWRITE) {
        // Overwrite: replace entire record
        const hasChanges = this.hasProductChanges(existingProduct, productData);
        
        if (hasChanges) {
          await storage.updateProduct(existingProduct.id, productData);
          productId = existingProduct.id;
          result.updatedProducts++;
        } else {
          productId = existingProduct.id;
          // Product was examined but no changes made - count as skipped
          result.skippedProducts++;
        }
      } else {
        // Create new product
        const newProduct = await storage.createProduct(productData);
        productId = newProduct.id;
        result.newProducts++;
      }

      // Step 5: Create/update vendor mapping (separate from Master Catalog)
      await this.upsertVendorMapping(productId, sportsSouthVendorId, sportsProduct);

      // Step 6: Apply image fallback logic to find best available image across all vendors
      if (this.syncSettings.imageHandling.updateIfMissing || this.syncSettings.imageHandling.replaceWithHigherQuality) {
        try {
          const { ImageFallbackService } = await import('./image-fallback-service');
          await ImageFallbackService.updateProductImageWithFallback(productData.upc, 'Sports South');
          console.log(`SPORTS SOUTH CATALOG: Applied image fallback for UPC ${productData.upc}`);
        } catch (error: any) {
          console.error(`SPORTS SOUTH CATALOG: Image fallback failed for UPC ${productData.upc}:`, error.message);
          // Continue processing - image fallback failure shouldn't stop the sync
        }
      }

      // Step 7: Fetch and update description if available
      if (sportsProduct.TXTREF && this.syncSettings.descriptionHandling.addIfMissing) {
        await this.updateProductDescription(productId, sportsProduct.TXTREF, existingProduct?.description);
      }

    } catch (error: any) {
      throw new Error(`Failed to process product ${sportsProduct.ITEMNO}: ${error.message}`);
    }
  }

  /**
   * Check if product data has meaningful changes
   */
  private hasProductChanges(existingProduct: any, newData: any): boolean {
    // Compare key fields that matter for updates
    const fieldsToCompare = [
      'upc', 'name', 'manufacturerPartNumber', 'brand', 'model', 
      'description', 'imageUrl', 'serialized', 'status'
    ];
    
    for (const field of fieldsToCompare) {
      const existingValue = existingProduct[field];
      const newValue = newData[field];
      
      // Handle null/undefined/empty string equivalence
      const normalizeValue = (val: any) => {
        if (val === null || val === undefined || val === '') return null;
        return typeof val === 'string' ? val.trim() : val;
      };
      
      const normalizedExisting = normalizeValue(existingValue);
      const normalizedNew = normalizeValue(newValue);
      
      if (normalizedExisting !== normalizedNew) {
        return true;
      }
    }
    
    // Check specifications object for changes
    if (JSON.stringify(existingProduct.specifications || {}) !== JSON.stringify(newData.specifications || {})) {
      return true;
    }
    
    return false;
  }

  /**
   * Smart merge existing product data with Sports South data
   */
  private smartMergeProductData(existingProduct: any, newData: any): any {
    const merged = { ...existingProduct };

    // Update image if missing or Sports South has better quality
    if (this.syncSettings.imageHandling.updateIfMissing && !existingProduct.imageUrl && newData.imageUrl) {
      merged.imageUrl = newData.imageUrl;
      merged.imageSource = getSportsSouthImageSource();
    } else if (this.syncSettings.imageHandling.replaceWithHigherQuality && newData.imageUrl) {
      // Could implement image quality comparison logic here
      merged.imageUrl = newData.imageUrl;
      merged.imageSource = getSportsSouthImageSource();
    }

    // Update description if missing
    if (this.syncSettings.descriptionHandling.addIfMissing && !existingProduct.description && newData.description) {
      merged.description = newData.description;
    } else if (this.syncSettings.descriptionHandling.overwriteExisting && newData.description) {
      merged.description = newData.description;
    }

    // Update category if more specific
    if (this.syncSettings.categoryHandling.updateIfMoreSpecific && newData.category && (!existingProduct.category || newData.category.length > existingProduct.category.length)) {
      merged.category = newData.category;
    } else if (this.syncSettings.categoryHandling.overwriteExisting && newData.category) {
      merged.category = newData.category;
    }

    // Always update MPN if missing
    if (!existingProduct.manufacturerPartNumber && newData.manufacturerPartNumber) {
      merged.manufacturerPartNumber = newData.manufacturerPartNumber;
    }

    // Always update brand if missing
    if (!existingProduct.brand && newData.brand) {
      merged.brand = newData.brand;
    }

    // Always update weight if missing
    if (!existingProduct.weight && newData.weight) {
      merged.weight = newData.weight;
    }

    return merged;
  }

  /**
   * Create or update vendor product mapping
   */
  private async upsertVendorMapping(productId: number, sportsSouthVendorId: number, sportsProduct: SportsSouthProduct): Promise<void> {
    try {
      // Check if mapping already exists
      const existingMapping = await storage.getVendorProductMapping(productId, sportsSouthVendorId);


      if (existingMapping) {
        // Update existing mapping
        await storage.updateVendorProductMapping(existingMapping.id, {
          vendorSku: sportsProduct.ITEMNO
        });
      } else {
        // Create new mapping
        await storage.createVendorProductMapping({
          productId,
          supportedVendorId: sportsSouthVendorId,
          vendorSku: sportsProduct.ITEMNO
        });
      }
    } catch (error: any) {
      console.error(`Failed to upsert vendor mapping for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Update product description from Sports South TXTREF
   */
  private async updateProductDescription(productId: number, txtRef: string, existingDescription?: string | null): Promise<void> {
    try {
      if (existingDescription && !this.syncSettings.descriptionHandling.overwriteExisting) {
        return; // Don't overwrite existing descriptions unless configured to do so
      }

      // Note: getProductDescription is not available in Sports South API
      // This feature would need to be implemented if Sports South provides description lookup
      // For now, skip description updates from txtRef
      console.log(`Description update skipped for product ${productId} - txtRef: ${txtRef}`);
    } catch (error: any) {
      console.error(`Failed to update description for product ${productId}:`, error);
      // Don't throw - description update is not critical
    }
  }

  /**
   * Get image URL for Sports South product using centralized service
   */
  private async getImageUrl(sportsProduct: SportsSouthProduct): Promise<string | null> {
    try {
      if (sportsProduct.PICREF || sportsProduct.ITEMNO) {
        const { VendorImageService } = await import('./vendor-image-urls');
        const identifier = sportsProduct.ITEMNO;
        return VendorImageService.getImageUrl('Sports South', identifier, sportsProduct.PICREF);
      }
      return null;
    } catch (error) {
      console.error(`Failed to get image URL for ${sportsProduct.ITEMNO}:`, error);
      return null;
    }
  }

  /**
   * Safely extract string value from XML-parsed field that might be an array or object
   * Fixes "[object Object]" issue when xml2js converts single elements to arrays
   */
  private extractStringValue(value: any): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    
    // If it's already a string, return it (most common case)
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    
    // Handle arrays from xml2js explicitArray: true
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      
      // Recursively extract from first element
      const firstElement = value[0];
      return this.extractStringValue(firstElement);
    }
    
    // Handle numbers
    if (typeof value === 'number') {
      return String(value);
    }
    
    // Handle objects - this indicates a parsing issue
    if (typeof value === 'object') {
      // Log the problematic data for debugging
      console.error('SPORTS SOUTH: Found object type for model field, this indicates XML parsing issue:', JSON.stringify(value));
      
      // Try to extract meaningful string data from common object patterns
      if (value._ && typeof value._ === 'string') {
        // xml2js sometimes creates {_: "value"} objects
        return this.extractStringValue(value._);
      }
      
      // If it has a toString method that's not just "[object Object]"
      const stringRepresentation = String(value);
      if (stringRepresentation !== '[object Object]') {
        return stringRepresentation.trim() || null;
      }
      
      // Last resort: return null instead of "[object Object]"
      console.error('SPORTS SOUTH: Unable to extract string from object, setting model to null:', value);
      return null;
    }
    
    // For any other type, convert to string
    return String(value).trim() || null;
  }

  /**
   * Build specifications object from Sports South attributes
   */
  private buildSpecifications(sportsProduct: SportsSouthProduct): Record<string, any> {
    return {
      sportsSouthAttributes: {
        ITATR1: sportsProduct.ITATR1,
        ITATR2: sportsProduct.ITATR2,
        ITATR3: sportsProduct.ITATR3,
        ITATR4: sportsProduct.ITATR4,
        ITATR5: sportsProduct.ITATR5
      }
    };
  }

  /**
   * Category resolution is now handled via CategoryUpdate API
   * CATID → CATDES lookup using Sports South CategoryUpdate endpoint
   * Categories are vendor-specific and should NOT be stored in Master Product Catalog
   */

  /**
   * Determine if product is a firearm based on category
   */
  private isFirearmProduct(sportsProduct: SportsSouthProduct): boolean {
    if (!sportsProduct.CATID) return false;
    
    return isSportsSouthFirearmCategory(sportsProduct.CATID);
  }

  /**
   * Update sync status in supported_vendors table
   */
  private async updateSyncStatus(success: boolean, errorMessage?: string, syncResult?: CatalogSyncResult): Promise<void> {
    try {
      const syncTime = new Date();
      const supportedVendors = await storage.getAllSupportedVendors();
      
      // Use vendor registry ID to identify Sports South vendor
      const sportsSouthVendor = supportedVendors.find(vendor =>
        vendor.vendorShortCode === getSportsSouthVendorId() || 
        vendor.name?.toLowerCase().includes('sports south')
      );
      
      if (sportsSouthVendor) {
        console.log(`SPORTS SOUTH CATALOG SYNC: Updating last sync time to: ${syncTime.toISOString()}`);
        
        const updates: any = {
          lastCatalogSync: syncTime,
          catalogSyncStatus: success ? 'success' : 'error',
          catalogSyncError: errorMessage || null
        };
        
        // Update sync statistics if provided
        if (syncResult) {
          updates.lastSyncNewRecords = syncResult.newProducts;
          updates.lastSyncRecordsUpdated = syncResult.updatedProducts;
          updates.lastSyncRecordsSkipped = syncResult.skippedProducts;
          
          updates.lastSyncImagesAdded = 0; // We're not tracking images in incremental sync
          updates.lastSyncImagesUpdated = 0;
          
          console.log(`SPORTS SOUTH CATALOG SYNC: Updating stats - New: ${updates.lastSyncNewRecords}, Updated: ${updates.lastSyncRecordsUpdated}, Skipped: ${updates.lastSyncRecordsSkipped}, Total: ${syncResult.productsProcessed}`);
        }
        
        await storage.updateSupportedVendor(sportsSouthVendor.id, updates);
        console.log(`SPORTS SOUTH CATALOG SYNC: Successfully updated sync status and statistics`);
      }
    } catch (error: any) {
      console.error('Failed to update sync status:', error);
    }
  }
}
import { storage } from './storage';
import { LipseyAPI, LipseyCredentials, LipseyProduct } from './lipsey-api';
import { RETAIL_VERTICALS } from '../shared/retail-vertical-config';
import { LipseysSyncSettings, DEFAULT_LIPSEYS_SYNC_SETTINGS } from '../shared/lipseys-sync-config';
import { LIPSEYS_CONFIG, getLipseysVendorId, constructLipseysImageUrl, generateLipseysProductName, buildLipseysSpecifications } from '../shared/lipseys-config';
import { shouldReplaceProduct } from './simple-quality-priority';
import { db } from './db';
import { products, vendorProductMappings } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

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

export class LipseysCatalogSyncService {
  private api: LipseyAPI;
  private retailVerticalId: number;
  private lipseysVendorId: number | null = null;
  private lipseysVendorName: string | null = null; // Store full vendor name for priority matching
  private syncSettings: LipseysSyncSettings;

  constructor(
    credentials: LipseyCredentials,
    retailVerticalId: number = RETAIL_VERTICALS.FIREARMS.id,
    syncSettings: LipseysSyncSettings = DEFAULT_LIPSEYS_SYNC_SETTINGS
  ) {
    this.api = new LipseyAPI(credentials);
    this.retailVerticalId = retailVerticalId;
    this.syncSettings = syncSettings;
  }

  private async getLipseysVendorId(): Promise<number> {
    if (this.lipseysVendorId !== null) {
      return this.lipseysVendorId;
    }
    
    // Find Lipsey's using vendor registry pattern
    const supportedVendors = await storage.getAllSupportedVendors();
    
    const lipseys = supportedVendors.find(vendor => 
      vendor.vendorShortCode === getLipseysVendorId() || 
      vendor.name?.toLowerCase().includes('lipsey')
    );
    
    if (!lipseys) {
      throw new Error(`Lipsey's vendor not found in supported vendors (looking for ID: ${getLipseysVendorId()})`);
    }
    
    this.lipseysVendorId = lipseys.id;
    this.lipseysVendorName = lipseys.name; // Store full vendor name for priority matching
    console.log(`LIPSEYS SYNC: Using vendor name "${this.lipseysVendorName}" for priority comparison`);
    return lipseys.id;
  }

  private async getLipseysVendorName(): Promise<string> {
    if (this.lipseysVendorName !== null) {
      return this.lipseysVendorName;
    }
    // This will also set lipseysVendorName
    await this.getLipseysVendorId();
    return this.lipseysVendorName!;
  }

  /**
   * Perform full catalog sync from Lipsey's
   * @param limit Optional limit on number of products to process (for testing)
   */
  async performFullCatalogSync(limit?: number): Promise<CatalogSyncResult> {
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
      console.log('LIPSEYS CATALOG SYNC: Starting full catalog sync...');
      
      // Step 1: Authenticate
      const authenticated = await this.api.authenticate();
      if (!authenticated) {
        throw new Error('Failed to authenticate with Lipsey\'s API');
      }
      console.log('✅ LIPSEYS CATALOG SYNC: Authenticated successfully');
      
      // Step 2: Get full catalog from Lipsey's
      let products = await this.api.getCatalogFeed();
      
      // Apply limit if specified (for testing)
      if (limit && limit > 0) {
        console.log(`LIPSEYS CATALOG SYNC: Limiting to first ${limit} products for testing`);
        products = products.slice(0, limit);
      }
      
      result.productsProcessed = products.length;
      
      if (products.length === 0) {
        result.success = false;
        result.message = 'No products retrieved from Lipsey\'s catalog';
        result.errors.push('No products returned from Lipsey\'s API');
        return result;
      }

      console.log(`LIPSEYS CATALOG SYNC: Processing ${products.length} products...`);

      // Step 3: Process each product
      for (const lipseyProduct of products) {
        try {
          await this.processProduct(lipseyProduct, result);
        } catch (error: any) {
          console.error(`LIPSEYS CATALOG SYNC: Error processing product ${lipseyProduct.itemNo}:`, error);
          result.errors.push(`Product ${lipseyProduct.itemNo}: ${error.message}`);
        }
      }

      // Step 4: Update sync status
      await this.updateSyncStatus(true, undefined, result);

      result.success = true;
      result.message = `Successfully synced ${result.newProducts} new products and updated ${result.updatedProducts} existing products`;
      
      console.log(`LIPSEYS CATALOG SYNC: Completed. New: ${result.newProducts}, Updated: ${result.updatedProducts}, Errors: ${result.errors.length}`);
      
    } catch (error: any) {
      console.error('LIPSEYS CATALOG SYNC: Full sync failed:', error);
      result.success = false;
      result.message = `Catalog sync failed: ${error.message}`;
      result.errors.push(error.message);
      
      await this.updateSyncStatus(false, error.message, result);
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
      console.log('LIPSEYS CATALOG SYNC: Starting incremental sync...');
      
      // Get last sync date from supported_vendors table
      const supportedVendors = await storage.getAllSupportedVendors();
      
      const lipseysVendor = supportedVendors.find(vendor =>
        vendor.vendorShortCode === getLipseysVendorId() || 
        vendor.name?.toLowerCase().includes('lipsey')
      );
      
      if (!lipseysVendor || !lipseysVendor.lipseysLastCatalogSync) {
        console.log('LIPSEYS CATALOG SYNC: No previous sync found, performing full sync instead');
        return await this.performFullCatalogSync();
      }

      const lastSyncDate = new Date(lipseysVendor.lipseysLastCatalogSync);
      const now = new Date();
      const timeSinceLastSync = now.getTime() - lastSyncDate.getTime();
      
      console.log(`LIPSEYS CATALOG SYNC: Last sync was: ${lastSyncDate.toISOString()}`);
      console.log(`LIPSEYS CATALOG SYNC: Current time: ${now.toISOString()}`);
      console.log(`LIPSEYS CATALOG SYNC: Time since last sync: ${Math.round(timeSinceLastSync / 1000)} seconds`);
      
      // Authenticate
      const authenticated = await this.api.authenticate();
      if (!authenticated) {
        throw new Error('Failed to authenticate with Lipsey\'s API');
      }

      // Get incremental updates - Lipsey's API doesn't have a built-in incremental endpoint
      // So we'll fetch the full catalog and filter based on lastSyncDate
      // Note: In future, if Lipsey's adds an updatedSince parameter, we can use it here
      console.log('LIPSEYS CATALOG SYNC: Fetching full catalog (Lipsey\'s API does not support incremental queries)');
      const allProducts = await this.api.getCatalogFeed();
      
      // For now, process all products but optimize by checking if they need updates
      result.productsProcessed = allProducts.length;
      console.log(`LIPSEYS CATALOG SYNC: Processing ${allProducts.length} products...`);

      // Process each product
      for (const lipseyProduct of allProducts) {
        try {
          await this.processProduct(lipseyProduct, result);
        } catch (error: any) {
          console.error(`LIPSEYS CATALOG SYNC: Error processing product ${lipseyProduct.itemNo}:`, error);
          result.errors.push(`Product ${lipseyProduct.itemNo}: ${error.message}`);
        }
      }

      // Update sync status with statistics
      await this.updateSyncStatus(true, undefined, result);

      result.success = true;
      result.message = `Successfully processed ${result.newProducts} new products and ${result.updatedProducts} updated products`;
      
      console.log(`LIPSEYS CATALOG SYNC: Incremental sync completed. New: ${result.newProducts}, Updated: ${result.updatedProducts}, Errors: ${result.errors.length}`);
      
    } catch (error: any) {
      console.error('LIPSEYS CATALOG SYNC: Incremental sync failed:', error);
      result.success = false;
      result.message = `Incremental sync failed: ${error.message}`;
      result.errors.push(error.message);
      
      await this.updateSyncStatus(false, error.message, result);
    }

    return result;
  }

  /**
   * Process a single Lipsey's product
   */
  private async processProduct(lipseyProduct: LipseyProduct, result: CatalogSyncResult): Promise<void> {
    // Skip products without UPC (required for Master Catalog)
    if (!lipseyProduct.upc || lipseyProduct.upc.trim() === '' || lipseyProduct.upc === '0') {
      result.skippedProducts++;
      result.warnings.push(`Product ${lipseyProduct.itemNo} skipped: Missing valid UPC`);
      return;
    }

    const upc = lipseyProduct.upc.trim();
    
    // Check if product exists in Master Catalog
    const [existingProduct] = await db
      .select()
      .from(products)
      .where(eq(products.upc, upc))
      .limit(1);

    if (existingProduct) {
      // Product exists - check if Lipsey's should update it (priority 2)
      const shouldUpdate = await shouldReplaceProduct(
        existingProduct,
        { source: 'lipseys' },
        'lipseys'
      );

      if (shouldUpdate) {
        await this.updateExistingProduct(existingProduct.id, lipseyProduct);
        result.updatedProducts++;
      } else {
        result.skippedProducts++;
        result.warnings.push(
          `Product ${lipseyProduct.itemNo} (UPC: ${upc}) skipped: Already exists with higher/equal priority data (current source: ${existingProduct.source || 'unknown'})`
        );
      }
    } else {
      // New product - add to Master Catalog
      await this.createNewProduct(lipseyProduct);
      result.newProducts++;
    }

    // Always update vendor_product_mappings (for price comparison)
    await this.updateVendorProductMapping(lipseyProduct, existingProduct?.id);
  }

  /**
   * Create a new product in Master Catalog from Lipsey's data
   */
  private async createNewProduct(lipseyProduct: LipseyProduct): Promise<void> {
    const productData = this.mapLipseyProductToMasterCatalog(lipseyProduct);
    
    // Insert into Master Catalog
    const [newProduct] = await db
      .insert(products)
      .values(productData)
      .returning();
    
    console.log(`LIPSEYS CATALOG SYNC: Created new product - UPC: ${lipseyProduct.upc}, Name: ${productData.name}`);
  }

  /**
   * Update an existing product in Master Catalog with Lipsey's data
   */
  private async updateExistingProduct(productId: number, lipseyProduct: LipseyProduct): Promise<void> {
    const productData = this.mapLipseyProductToMasterCatalog(lipseyProduct);
    
    // Update Master Catalog
    await db
      .update(products)
      .set({
        ...productData,
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));
    
    console.log(`LIPSEYS CATALOG SYNC: Updated product - UPC: ${lipseyProduct.upc}, Name: ${productData.name}`);
  }

  /**
   * Map Lipsey's product data to Master Catalog schema
   */
  private mapLipseyProductToMasterCatalog(lipseyProduct: LipseyProduct): any {
    return {
      // Core identification (UNIVERSAL - no vendor SKUs)
      upc: lipseyProduct.upc.trim(),
      name: generateLipseysProductName({
        description1: lipseyProduct.description1,
        description2: lipseyProduct.description2,
        manufacturer: lipseyProduct.manufacturer,
        model: lipseyProduct.model,
        itemNo: lipseyProduct.itemNo
      }),
      description: lipseyProduct.description2?.trim() || lipseyProduct.description1?.trim() || null,
      brand: lipseyProduct.manufacturer?.trim() || null,
      model: lipseyProduct.model?.trim() || null,
      manufacturerPartNumber: lipseyProduct.manufacturerModelNo?.trim() || null,
      
      // Classification
      category: lipseyProduct.type?.trim() || null,
      subcategory1: lipseyProduct.itemType?.trim() || null,
      subcategory2: lipseyProduct.action?.trim() || null,
      
      // Specifications
      caliber: lipseyProduct.caliberGauge?.trim() || null,
      barrelLength: lipseyProduct.barrelLength?.toString() || null,
      specifications: buildLipseysSpecifications(lipseyProduct),
      
      // Image
      imageUrl: constructLipseysImageUrl(lipseyProduct.imageName),
      imageSource: LIPSEYS_CONFIG.IMAGE_SOURCE_NAME,
      
      // Compliance
      serialized: lipseyProduct.fflRequired || false,
      allocated: lipseyProduct.allocated || false,
      
      // Tracking
      source: LIPSEYS_CONFIG.VENDOR_IDENTIFIER,
      retailVerticalId: this.retailVerticalId,
      
      // Timestamps
      updatedAt: new Date()
    };
  }

  /**
   * Update vendor_product_mappings table with Lipsey's SKU and pricing
   */
  private async updateVendorProductMapping(lipseyProduct: LipseyProduct, productId?: number): Promise<void> {
    // If productId not provided, look it up by UPC
    if (!productId) {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.upc, lipseyProduct.upc.trim()))
        .limit(1);
      
      if (!product) {
        console.warn(`LIPSEYS MAPPING: Product not found for UPC ${lipseyProduct.upc}`);
        return;
      }
      productId = product.id;
    }

    const lipseysVendorId = await this.getLipseysVendorId();

    // Check if mapping exists
    const [existingMapping] = await db
      .select()
      .from(vendorProductMappings)
      .where(and(
        eq(vendorProductMappings.productId, productId),
        eq(vendorProductMappings.supportedVendorId, lipseysVendorId)
      ))
      .limit(1);

    const mappingData = {
      productId,
      supportedVendorId: lipseysVendorId,
      vendorSku: lipseyProduct.itemNo,
      companyId: null, // Admin-level mapping
      price: lipseyProduct.price || null,
      msrp: lipseyProduct.msrp || null,
      map: lipseyProduct.retailMap || null,
      quantity: lipseyProduct.quantity || 0,
      lastUpdated: new Date()
    };

    if (existingMapping) {
      // Update existing mapping
      await db
        .update(vendorProductMappings)
        .set(mappingData)
        .where(eq(vendorProductMappings.id, existingMapping.id));
    } else {
      // Create new mapping
      await db
        .insert(vendorProductMappings)
        .values(mappingData);
    }
  }

  /**
   * Update sync status in supported_vendors table
   */
  private async updateSyncStatus(
    success: boolean,
    errorMessage?: string,
    stats?: CatalogSyncResult
  ): Promise<void> {
    try {
      const lipseysVendorId = await this.getLipseysVendorId();
      
      const updateData: any = {
        // Lipsey-specific fields (used in sync settings dialog)
        lipseysCatalogSyncStatus: success ? 'success' : 'error',
        lipseysLastCatalogSync: new Date(),
        lipseysCatalogSyncError: errorMessage || null,
        
        // Generic fields (used for main table badge display)
        catalogSyncStatus: success ? 'success' : 'error',
        lastCatalogSync: new Date(),
        catalogSyncError: errorMessage || null,
        
        updatedAt: new Date()
      };

      if (stats) {
        // Lipsey-specific stats
        updateData.lipseysRecordsAdded = stats.newProducts;
        updateData.lipseysRecordsUpdated = stats.updatedProducts;
        updateData.lipseysRecordsSkipped = stats.skippedProducts;
        updateData.lipseysRecordsFailed = stats.errors.length;
        updateData.lipseysTotalRecords = stats.productsProcessed;
        
        // Generic stats (for main table display)
        updateData.lastSyncNewRecords = stats.newProducts;
        updateData.lastSyncRecordsUpdated = stats.updatedProducts;
        updateData.lastSyncRecordsSkipped = stats.skippedProducts;
      }

      await storage.updateSupportedVendor(lipseysVendorId, updateData);
      
      console.log(`LIPSEYS CATALOG SYNC: Updated sync status - Success: ${success}`);
    } catch (error: any) {
      console.error('LIPSEYS CATALOG SYNC: Failed to update sync status:', error);
    }
  }
}


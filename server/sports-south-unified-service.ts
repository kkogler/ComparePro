/**
 * Unified Sports South Service
 * Consolidates all Sports South sync implementations into a single, maintainable service
 */

import { storage } from './storage';
import { createSportsSouthAPI, SportsSouthCredentials, SportsSouthProduct } from './sports-south-api';
import { RETAIL_VERTICALS } from '../shared/retail-vertical-config';
import { SportsSouthSyncSettings, DEFAULT_SPORTS_SOUTH_SYNC_SETTINGS } from '../shared/sports-south-sync-config';
import { SPORTS_SOUTH_CONFIG, getSportsSouthVendorId } from '../shared/sports-south-config';
import { vendorRegistry } from './vendor-registry';
import { shouldReplaceProduct } from './simple-quality-priority';
import * as cron from 'node-cron';
import { toZonedTime, format, fromZonedTime } from 'date-fns-tz';

// Unified result interface
interface SportsSouthSyncResult {
  success: boolean;
  message: string;
  productsProcessed: number;
  newProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  mappingsCreated: number;
  imagesAdded: number;
  imagesUpdated: number;
  errors: string[];
  warnings: string[];
  syncType: 'full' | 'incremental' | 'mapping_only';
  duration: number;
}

// Scheduler interface
interface ScheduledJob {
  task: cron.ScheduledTask | null;
  schedule: string;
  isRunning: boolean;
}

/**
 * Unified Sports South Service
 * Combines catalog sync, scheduling, and vendor management
 */
export class SportsSouthUnifiedService {
  private api: any;
  private retailVerticalId: number;
  private sportsSouthVendorId: number | null = null;
  private syncSettings: SportsSouthSyncSettings;
  private scheduler: SportsSouthScheduler;

  constructor(
    credentials: SportsSouthCredentials, 
    retailVerticalId: number = RETAIL_VERTICALS.FIREARMS.id,
    syncSettings: SportsSouthSyncSettings = DEFAULT_SPORTS_SOUTH_SYNC_SETTINGS
  ) {
    this.api = createSportsSouthAPI(credentials);
    this.retailVerticalId = retailVerticalId;
    this.syncSettings = syncSettings;
    this.scheduler = new SportsSouthScheduler();
  }

  /**
   * Get or find Sports South vendor ID
   */
  private async getSportsSouthVendorId(): Promise<number> {
    if (this.sportsSouthVendorId !== null) {
      return this.sportsSouthVendorId;
    }
    
    const supportedVendors = await storage.getAllSupportedVendors();
    const sportsSouth = supportedVendors.find(vendor => 
      vendor.vendorShortCode === getSportsSouthVendorId() || 
      vendor.name?.toLowerCase().includes('sports south')
    );
    
    if (!sportsSouth) {
      throw new Error(`Sports South vendor not found in supported vendors`);
    }
    
    this.sportsSouthVendorId = sportsSouth.id;
    return sportsSouth.id;
  }

  /**
   * Extract manufacturer part number from product name
   */
  private extractManufacturerPartNumber(productName: string, brand: string): string | null {
    if (!productName || !brand) return null;
    
    const cleanName = productName.trim();
    const cleanBrand = brand.trim();
    
    let nameWithoutBrand = cleanName;
    if (cleanName.toUpperCase().startsWith(cleanBrand.toUpperCase())) {
      nameWithoutBrand = cleanName.substring(cleanBrand.length).trim();
    }
    
    // Look for number patterns after brand
    const numberAfterBrand = nameWithoutBrand.match(/^(\d+)/);
    if (numberAfterBrand) {
      return numberAfterBrand[1];
    }
    
    // Look for model patterns
    const modelPattern = nameWithoutBrand.match(/^([A-Z0-9\-]+)/);
    if (modelPattern && modelPattern[1].length >= 3 && modelPattern[1].length <= 20) {
      return modelPattern[1];
    }
    
    return null;
  }

  /**
   * Process a single Sports South product
   */
  private async processProduct(
    sportsProduct: SportsSouthProduct, 
    result: SportsSouthSyncResult,
    syncType: 'full' | 'incremental' | 'mapping_only' = 'full'
  ): Promise<void> {
    try {
      const vendorId = await this.getSportsSouthVendorId();
      
      // Extract product data
      const productData = {
        upc: sportsProduct.ITUPC,
        name: sportsProduct.IDESC,
        brand: sportsProduct.SCNAM1,
        manufacturerPartNumber: this.extractManufacturerPartNumber(sportsProduct.IDESC, sportsProduct.SCNAM1),
        model: sportsProduct.SERIES,
        description: sportsProduct.IDESC,
        retailVerticalId: this.retailVerticalId,
        status: 'active' as const
      };

      // For mapping-only sync, just create vendor mappings
      if (syncType === 'mapping_only') {
        await this.createVendorMapping(sportsProduct, vendorId, result);
        return;
      }

      // Check if product exists
      const existingProduct = await storage.getProductByUPC(productData.upc);
      
      if (existingProduct) {
        // Update existing product if needed
        if (shouldReplaceProduct(existingProduct, productData)) {
          await storage.updateProduct(existingProduct.id, productData);
          result.updatedProducts++;
        } else {
          result.skippedProducts++;
        }
      } else {
        // Create new product
        await storage.createProduct(productData);
        result.newProducts++;
      }

      // Create vendor mapping
      await this.createVendorMapping(sportsProduct, vendorId, result);

    } catch (error: any) {
      result.errors.push(`Product ${sportsProduct.ITEMNO}: ${error.message}`);
    }
  }

  /**
   * Create vendor product mapping
   */
  private async createVendorMapping(
    sportsProduct: SportsSouthProduct, 
    vendorId: number, 
    result: SportsSouthSyncResult
  ): Promise<void> {
    try {
      const mappingData = {
        vendorId,
        productId: null, // Will be set after product creation
        vendorProductId: sportsProduct.ITEMNO,
        vendorSku: sportsProduct.ITEMNO,
        vendorProductName: sportsProduct.IDESC,
        vendorBrand: sportsProduct.SCNAM1,
        vendorModel: sportsProduct.SERIES,
        vendorUpc: sportsProduct.ITUPC,
        isActive: true
      };

      await storage.createVendorProductMapping(mappingData);
      result.mappingsCreated++;
    } catch (error: any) {
      result.warnings.push(`Mapping creation failed for ${sportsProduct.ITEMNO}: ${error.message}`);
    }
  }

  /**
   * Perform full catalog sync
   */
  async performFullCatalogSync(): Promise<SportsSouthSyncResult> {
    const startTime = Date.now();
    const result: SportsSouthSyncResult = {
      success: false,
      message: '',
      productsProcessed: 0,
      newProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      mappingsCreated: 0,
      imagesAdded: 0,
      imagesUpdated: 0,
      errors: [],
      warnings: [],
      syncType: 'full',
      duration: 0
    };

    try {
      // Get full catalog from Sports South
      const products = await this.api.getFullCatalog();
      result.productsProcessed = products.length;
      
      if (products.length === 0) {
        result.message = 'No products retrieved from Sports South catalog';
        result.errors.push('No products returned from Sports South API');
        return result;
      }

      // Process each product
      for (const sportsProduct of products) {
        await this.processProduct(sportsProduct, result, 'full');
      }

      // Update sync status
      await this.updateSyncStatus(true);
      
      result.success = true;
      result.message = `Full catalog sync completed: ${result.newProducts} new, ${result.updatedProducts} updated, ${result.skippedProducts} skipped`;
      
    } catch (error: any) {
      result.success = false;
      result.message = `Full catalog sync failed: ${error.message}`;
      result.errors.push(error.message);
      await this.updateSyncStatus(false, error.message);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Perform incremental sync
   */
  async performIncrementalSync(): Promise<SportsSouthSyncResult> {
    const startTime = Date.now();
    const result: SportsSouthSyncResult = {
      success: false,
      message: '',
      productsProcessed: 0,
      newProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      mappingsCreated: 0,
      imagesAdded: 0,
      imagesUpdated: 0,
      errors: [],
      warnings: [],
      syncType: 'incremental',
      duration: 0
    };

    try {
      // Get incremental updates from Sports South
      const products = await this.api.getIncrementalUpdates();
      result.productsProcessed = products.length;

      if (products.length === 0) {
        result.message = 'No incremental updates available';
        result.success = true;
        return result;
      }

      // Process each product
      for (const sportsProduct of products) {
        await this.processProduct(sportsProduct, result, 'incremental');
      }

      await this.updateSyncStatus(true);
      result.success = true;
      result.message = `Incremental sync completed: ${result.newProducts} new, ${result.updatedProducts} updated`;
      
    } catch (error: any) {
      result.success = false;
      result.message = `Incremental sync failed: ${error.message}`;
      result.errors.push(error.message);
      await this.updateSyncStatus(false, error.message);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Perform mapping-only sync (creates UPC→ITEMNO mappings)
   */
  async performMappingOnlySync(): Promise<SportsSouthSyncResult> {
    const startTime = Date.now();
    const result: SportsSouthSyncResult = {
      success: false,
      message: '',
      productsProcessed: 0,
      newProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      mappingsCreated: 0,
      imagesAdded: 0,
      imagesUpdated: 0,
      errors: [],
      warnings: [],
      syncType: 'mapping_only',
      duration: 0
    };

    try {
      const products = await this.api.getFullCatalog();
      result.productsProcessed = products.length;

      for (const sportsProduct of products) {
        await this.processProduct(sportsProduct, result, 'mapping_only');
      }

      result.success = true;
      result.message = `Mapping sync completed: ${result.mappingsCreated} mappings created`;
      
    } catch (error: any) {
      result.success = false;
      result.message = `Mapping sync failed: ${error.message}`;
      result.errors.push(error.message);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Update sync status in database
   */
  private async updateSyncStatus(success: boolean, errorMessage?: string): Promise<void> {
    try {
      const vendorId = await this.getSportsSouthVendorId();
      await storage.updateSupportedVendor(vendorId, {
        catalogSyncStatus: success ? 'completed' : 'error',
        catalogSyncError: errorMessage || null,
        lastCatalogSync: new Date()
      });
    } catch (error) {
      // Log error but don't fail the sync
      console.error('Failed to update sync status:', error);
    }
  }

  /**
   * Start scheduled sync
   */
  async startScheduledSync(): Promise<void> {
    await this.scheduler.start();
  }

  /**
   * Stop scheduled sync
   */
  async stopScheduledSync(): Promise<void> {
    await this.scheduler.stop();
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<any> {
    return await this.scheduler.getStatus();
  }
}

/**
 * Sports South Scheduler
 * Handles scheduled sync operations
 */
class SportsSouthScheduler {
  private currentJob: ScheduledJob = {
    task: null,
    schedule: '',
    isRunning: false
  };

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize scheduler
  }

  async start(): Promise<void> {
    if (this.currentJob.isRunning) {
      return;
    }

    // Get schedule from admin settings
    const adminSettings = await storage.getAdminSettings();
    const scheduleTime = adminSettings?.sportsSouthScheduleTime || '07:15';
    const systemTimezone = adminSettings?.systemTimeZone || 'America/New_York';

    // Create cron schedule
    const [hours, minutes] = scheduleTime.split(':');
    const cronExpression = `${minutes} ${hours} * * *`;

    this.currentJob.task = cron.schedule(cronExpression, async () => {
      await this.runScheduledSync();
    }, {
      scheduled: true,
      timezone: systemTimezone
    });

    this.currentJob.schedule = cronExpression;
    this.currentJob.isRunning = true;
  }

  async stop(): Promise<void> {
    if (this.currentJob.task) {
      this.currentJob.task.stop();
      this.currentJob.task = null;
    }
    this.currentJob.isRunning = false;
  }

  private async runScheduledSync(): Promise<void> {
    try {
      // Get credentials and run sync
      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(v => v.name.toLowerCase().includes('sports south'));
      
      if (!sportsSouth) {
        throw new Error('Sports South vendor not found');
      }

      // Create service and run incremental sync
      const service = new SportsSouthUnifiedService(
        sportsSouth.credentials as SportsSouthCredentials
      );
      
      const result = await service.performIncrementalSync();
      
      if (!result.success) {
        throw new Error(`Scheduled sync failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Scheduled Sports South sync failed:', error);
    }
  }

  async getStatus(): Promise<any> {
    return {
      isRunning: this.currentJob.isRunning,
      schedule: this.currentJob.schedule,
      nextRun: this.currentJob.task?.nextDate()?.toISOString() || null
    };
  }
}

// Export the unified service
export { SportsSouthUnifiedService as SportsSouthService };
export default SportsSouthUnifiedService;


























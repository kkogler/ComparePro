import { storage } from './storage';
import { ChattanoogaAPI } from './chattanooga-api';
import * as cron from 'node-cron';

interface CatalogRefreshJob {
  schedule: string;
  task: cron.ScheduledTask | null;
  isRunning: boolean;
}

class CatalogRefreshService {
  private currentJob: CatalogRefreshJob = {
    schedule: '',
    task: null,
    isRunning: false
  };

  async initializeScheduler(): Promise<void> {
    console.log('Initializing catalog refresh scheduler...');
    
    const adminSettings = await storage.getAdminSettings();
    if (!adminSettings || !adminSettings.catalogRefreshEnabled) {
      console.log('Catalog refresh disabled in admin settings');
      return;
    }

    await this.updateSchedule();
  }

  async updateSchedule(): Promise<void> {
    const adminSettings = await storage.getAdminSettings();
    if (!adminSettings) {
      console.log('No admin settings found, skipping schedule update');
      return;
    }

    // Stop existing job
    if (this.currentJob.task) {
      this.currentJob.task.stop();
      this.currentJob.task.destroy();
      console.log('Stopped existing catalog refresh job');
    }

    if (!adminSettings.catalogRefreshEnabled) {
      console.log('Catalog refresh is disabled');
      return;
    }

    const cronExpression = this.buildCronExpression(
      adminSettings.catalogRefreshTime || '14:00',
      adminSettings.catalogRefreshFrequency,
      adminSettings.catalogRefreshDays
    );

    console.log(`Setting up catalog refresh with cron: ${cronExpression}`);

    this.currentJob.schedule = cronExpression;
    this.currentJob.task = cron.schedule(cronExpression, async () => {
      await this.runCatalogRefresh();
    }, {
      timezone: adminSettings.systemTimeZone || "America/New_York"
    });

    console.log('Catalog refresh scheduler updated successfully');
  }

  private buildCronExpression(time: string, frequency: string, customDays?: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    
    switch (frequency) {
      case 'daily':
        return `${minutes} ${hours} * * *`;
      
      case 'weekdays':
        return `${minutes} ${hours} * * 1-5`; // Monday to Friday
      
      case 'weekly':
        try {
          const days = customDays ? JSON.parse(customDays) : [1]; // Default to Monday
          const dayString = days.join(',');
          return `${minutes} ${hours} * * ${dayString}`;
        } catch {
          return `${minutes} ${hours} * * 1`; // Fallback to Monday
        }
      
      default:
        return `${minutes} ${hours} * * *`; // Default to daily
    }
  }

  private async runCatalogRefresh(): Promise<void> {
    if (this.currentJob.isRunning) {
      console.log('Catalog refresh already running, skipping...');
      return;
    }

    this.currentJob.isRunning = true;
    console.log('Starting scheduled catalog refresh...');

    try {
      // Update admin settings to indicate refresh is in progress
      await storage.updateAdminSettings({
        refreshInProgress: true,
        lastCatalogRefresh: new Date(),
      });

      // Get all organizations and their vendors
      const organizations = await storage.getAllCompanies();
      let totalImported = 0;
      let totalErrors = 0;

      for (const org of organizations) {
        console.log(`Processing catalog refresh for organization: ${org.name} (${org.id})`);
        
        // Get vendors for this organization
        const vendors = await storage.getVendorsByCompany(org.id);
        
        for (const vendor of vendors) {
          if (vendor.connectionStatus === 'online' && vendor.credentials) {
            // Skip Chattanooga - it has its own dedicated scheduler in chattanooga-scheduler.ts
            if (vendor.name && vendor.name.toLowerCase().includes('chattanooga')) {
              console.log(`Skipping ${vendor.name} - handled by dedicated Chattanooga scheduler`);
              continue;
            }
            
            try {
              // Use vendor registry for catalog refresh
              const { vendorRegistry } = await import('./vendor-registry');
              const syncResult = await vendorRegistry.syncVendorCatalog(vendor);
              
              if (syncResult.newProducts > 0 || syncResult.updatedProducts > 0) {
                console.log(`Refreshing ${vendor.name} catalog for vendor ${vendor.id}...`);
                
                totalImported += syncResult.newProducts + syncResult.updatedProducts;
                
                // Update vendor with new catalog count - remove properties that may not exist
                await storage.updateVendor(vendor.id, {
                  updatedAt: new Date(),
                });

                console.log(`${vendor.name} refresh completed: ${syncResult.newProducts} new, ${syncResult.updatedProducts} updated`);
              }
              // Add other vendor types (Lipsey's, GunBroker, etc.) here
              
            } catch (error) {
              console.error(`Error refreshing vendor ${vendor.id}:`, error);
              totalErrors++;
              
              await storage.updateVendor(vendor.id, {
                updatedAt: new Date(),
              });
            }
          }
        }
      }

      console.log(`Catalog refresh completed: ${totalImported} total products imported, ${totalErrors} errors`);

    } catch (error: any) {
      console.error('Catalog refresh failed:', error);
    } finally {
      // Update admin settings to indicate refresh is complete
      await storage.updateAdminSettings({
        refreshInProgress: false,
      });
      
      this.currentJob.isRunning = false;
    }
  }

  private async getVendorsByCompany(companyId: number) {
    // This would need to be implemented in storage
    // For now, return all vendors (not ideal for multi-tenant)
    const allVendors = await storage.getAllVendors();
    return allVendors.filter(v => v.companyId === companyId);
  }

  async manualRefresh(): Promise<{ success: boolean; message: string }> {
    if (this.currentJob.isRunning) {
      return {
        success: false,
        message: 'Catalog refresh is already in progress'
      };
    }

    try {
      // Run refresh immediately
      this.runCatalogRefresh();
      return {
        success: true,
        message: 'Manual catalog refresh started'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to start manual refresh: ${error.message}`
      };
    }
  }

  getStatus() {
    return {
      isScheduled: !!this.currentJob.task,
      isRunning: this.currentJob.isRunning,
      schedule: this.currentJob.schedule,
      nextRun: this.currentJob.task ? 'Next run calculated by cron' : null
    };
  }

  /**
   * Sync Chattanooga catalog using system-wide CSV download
   * Downloads complete catalog once at system level, then creates vendor relationships for organizations
   */
  private async syncChattanoogaCatalogFromCSV(vendorId: number, credentials: any, organizationId: number): Promise<{ imported: number; errors: number }> {
    try {
      // Step 1: Download system-wide Chattanooga catalog (if not already cached)
      const systemCatalogResult = await this.downloadSystemChattanoogaCatalog();
      if (!systemCatalogResult.success) {
        console.error(`CHATTANOOGA SYSTEM: Catalog download failed - ${systemCatalogResult.message}`);
        return { imported: 0, errors: 1 };
      }

      // Step 2: Create vendor product relationships for this organization
      console.log(`CHATTANOOGA ORG: Creating vendor relationships for organization ${organizationId}, vendor ${vendorId}...`);
      const relationshipResult = await this.createChattanoogaVendorRelationships(vendorId, organizationId);
      
      return {
        imported: relationshipResult.created,
        errors: relationshipResult.errors
      };

    } catch (error) {
      console.error('CHATTANOOGA CSV: Error during CSV sync:', error);
      return { imported: 0, errors: 1 };
    }
  }

  /**
   * Download and cache Chattanooga catalog at system level
   * Only downloads if cache is older than 24 hours or doesn't exist
   */
  private async downloadSystemChattanoogaCatalog(): Promise<{ success: boolean; message: string; csvPath?: string }> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Check for existing cached catalog
      const catalogCacheDir = path.join(process.cwd(), 'catalog-cache');
      const chattanoogaCachePath = path.join(catalogCacheDir, 'chattanooga-catalog.csv');
      const cacheAgeHours = 24; // Refresh every 24 hours
      
      // Ensure cache directory exists
      if (!fs.existsSync(catalogCacheDir)) {
        fs.mkdirSync(catalogCacheDir, { recursive: true });
      }

      // Check if cache is fresh
      if (fs.existsSync(chattanoogaCachePath)) {
        const stats = fs.statSync(chattanoogaCachePath);
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageHours < cacheAgeHours) {
          console.log(`CHATTANOOGA SYSTEM: Using cached catalog (${ageHours.toFixed(1)} hours old)`);
          return {
            success: true,
            message: 'Using cached catalog',
            csvPath: chattanoogaCachePath
          };
        }
      }

      // Download fresh catalog using any available Chattanooga credentials
      console.log('CHATTANOOGA SYSTEM: Downloading fresh catalog for system cache...');
      const credentials = await this.getSystemChattanoogaCredentials();
      
      if (!credentials) {
        return {
          success: false,
          message: 'No Chattanooga credentials available for system download'
        };
      }

      const chattanoogaAPI = new ChattanoogaAPI(credentials);
      const downloadResult = await chattanoogaAPI.downloadCatalogCSV();
      
      if (!downloadResult.success || !downloadResult.csvPath) {
        return {
          success: false,
          message: `System catalog download failed: ${downloadResult.message}`
        };
      }

      // Move downloaded file to cache location
      fs.copyFileSync(downloadResult.csvPath, chattanoogaCachePath);
      fs.unlinkSync(downloadResult.csvPath); // Clean up temp file
      
      console.log(`CHATTANOOGA SYSTEM: Fresh catalog cached at ${chattanoogaCachePath}`);
      return {
        success: true,
        message: 'Fresh catalog downloaded and cached',
        csvPath: chattanoogaCachePath
      };

    } catch (error: any) {
      console.error('CHATTANOOGA SYSTEM: Error downloading system catalog:', error);
      return {
        success: false,
        message: `System catalog download error: ${error.message}`
      };
    }
  }

  /**
   * Get Chattanooga credentials from any organization for system-level downloads
   */
  private async getSystemChattanoogaCredentials(): Promise<any> {
    try {
      // Find any organization with Chattanooga credentials
      const organizations = await storage.getAllCompanies();
      
      for (const org of organizations) {
        const vendors = await storage.getVendorsByOrganization(org.id);
        const chattanoogaVendor = vendors.find(v => 
          v.name.toLowerCase().includes('chattanooga') && 
          v.credentials && 
          v.credentials.sid && 
          v.credentials.token
        );
        
        if (chattanoogaVendor) {
          console.log(`CHATTANOOGA SYSTEM: Using credentials from organization ${org.name}`);
          return chattanoogaVendor.credentials;
        }
      }
      
      return null;
    } catch (error) {
      console.error('CHATTANOOGA SYSTEM: Error finding credentials:', error);
      return null;
    }
  }

  /**
   * Create vendor product relationships for Chattanooga products in organization
   */
  private async createChattanoogaVendorRelationships(vendorId: number, organizationId: number): Promise<{ created: number; errors: number }> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Use cached catalog file
      const catalogCacheDir = path.join(process.cwd(), 'catalog-cache');
      const chattanoogaCachePath = path.join(catalogCacheDir, 'chattanooga-catalog.csv');
      
      if (!fs.existsSync(chattanoogaCachePath)) {
        console.error('CHATTANOOGA ORG: No cached catalog available');
        return { created: 0, errors: 1 };
      }

      // Import CSV for this specific organization using cached file
      const { ChattanoogaCSVImporter } = await import('./chattanooga-csv-importer');
      const importResult = await ChattanoogaCSVImporter.importFromCSV(chattanoogaCachePath);
      
      console.log(`CHATTANOOGA ORG: Created ${importResult.imported} vendor relationships for organization ${organizationId}`);
      
      return {
        created: importResult.imported,
        errors: importResult.errors.length
      };

    } catch (error: any) {
      console.error('CHATTANOOGA ORG: Error creating vendor relationships:', error);
      return { created: 0, errors: 1 };
    }
  }
}

export const catalogRefreshService = new CatalogRefreshService();
export default catalogRefreshService;
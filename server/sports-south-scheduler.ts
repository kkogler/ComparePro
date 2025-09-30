import * as cron from 'node-cron';
import { storage } from './storage.js';
import { SportsSouthCatalogSyncService } from './sports-south-catalog-sync.js';
import { RETAIL_VERTICALS } from '../shared/retail-vertical-config.js';
import { toZonedTime, format, fromZonedTime } from 'date-fns-tz';

interface ScheduledJob {
  task: cron.ScheduledTask | null;
  schedule: string;
  isRunning: boolean;
}

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
    console.log('Initializing Sports South scheduler...');
    await this.updateSchedule();
    console.log('Sports South scheduler initialized');
    
    // === STARTUP RECOVERY: CHECK FOR MISSED/STUCK SYNCS ===
    setTimeout(async () => {
      try {
        console.log('🔄 STARTUP RECOVERY: Checking Sports South sync status...');
        
        const supportedVendors = await storage.getAllSupportedVendors();
        const sportsSouth = supportedVendors.find(v => v.name.toLowerCase().includes('sports south'));
        
        if (sportsSouth) {
          // Check if sync is stuck "in progress"
          if (sportsSouth.catalogSyncStatus === 'in_progress') {
            console.log('🚨 STARTUP RECOVERY: Sports South sync stuck "in progress" - resetting status');
            await storage.updateSupportedVendor(sportsSouth.id, {
              catalogSyncStatus: 'error',
              catalogSyncError: 'Sync interrupted by server restart - auto-recovered'
            });
          }
          
          // Check if we missed the scheduled sync based on today's schedule
          const adminSettings = await storage.getAdminSettings();
          const systemTimezone = adminSettings?.systemTimeZone || 'America/New_York';
          const scheduleTime = sportsSouth.sportsSouthScheduleTime || '07:15';
          const frequency = sportsSouth.sportsSouthScheduleFrequency || 'daily';
          
          console.log(`🔄 STARTUP RECOVERY: Sports South schedule: ${frequency} at ${scheduleTime} (${systemTimezone})`);
          
          if (sportsSouth.lastCatalogSync) {
            const lastSync = new Date(sportsSouth.lastCatalogSync);
            const now = new Date();
            const hoursSinceLastSync = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60));
            
            console.log(`🔄 STARTUP RECOVERY: Last Sports South sync was ${hoursSinceLastSync} hours ago (${lastSync.toLocaleString()})`);
            
            // Calculate today's scheduled sync time in system timezone
            const todaysSchedule = this.getTodaysScheduledTime(scheduleTime, frequency, systemTimezone);
            
            if (todaysSchedule && now > todaysSchedule && lastSync < todaysSchedule) {
              console.log(`🔄 STARTUP RECOVERY: Missed today's ${scheduleTime} sync (scheduled: ${todaysSchedule.toLocaleString()}, last sync: ${lastSync.toLocaleString()}) - can be triggered manually from admin panel`);
            } else if (hoursSinceLastSync >= 25) {
              // Fallback: If more than 25 hours since last sync, something is definitely wrong
              console.log(`🔄 STARTUP RECOVERY: ${hoursSinceLastSync} hours since last sync (fallback threshold) - can be triggered manually from admin panel`);
            } else {
              console.log('✅ STARTUP RECOVERY: Sports South sync is up to date');
            }
          } else {
            console.log('🔄 STARTUP RECOVERY: No previous Sports South sync found - skipping automatic initial sync to prevent server blocking');
            console.log('💡 STARTUP RECOVERY: Initial sync can be triggered manually from the admin panel when ready');
          }
        }
      } catch (error) {
        console.error('❌ STARTUP RECOVERY: Failed to check Sports South sync status:', error);
      }
    }, 15000); // 15 second delay to let server finish starting
  }

  async updateSchedule(): Promise<void> {
    try {
      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(v => v.name.toLowerCase().includes('sports south'));
      
      if (!sportsSouth) {
        console.log('Sports South vendor not found, skipping schedule update');
        return;
      }

    // Stop existing job
    if (this.currentJob.task) {
      this.currentJob.task.stop();
      this.currentJob.task.destroy();
      console.log('Stopped existing Sports South sync job');
    }

    if (!sportsSouth.sportsSouthScheduleEnabled) {
      console.log('Sports South scheduling is disabled');
      return;
    }

    const cronExpression = this.buildCronExpression(
      sportsSouth.sportsSouthScheduleTime || '14:00',
      sportsSouth.sportsSouthScheduleFrequency || 'daily'
    );

    console.log(`Setting up Sports South sync with cron: ${cronExpression}`);

    this.currentJob.schedule = cronExpression;
    // Get admin timezone setting
    const adminSettings = await storage.getAdminSettings();
    const systemTimezone = adminSettings?.systemTimeZone || 'America/New_York';
    
    this.currentJob.task = cron.schedule(cronExpression, async () => {
      console.log('🚀 SPORTS SOUTH CRON TRIGGERED: Starting scheduled sync');
      const startTime = Date.now();
      try {
        await this.runSportsSouthSync();
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`✅ SPORTS SOUTH CRON COMPLETED: Sync finished in ${duration} seconds`);
      } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.error(`❌ SPORTS SOUTH CRON FAILED: Sync failed after ${duration} seconds:`, error);
      }
    });

    // Start the cron job explicitly
    this.currentJob.task.start();

    console.log('Sports South scheduler updated successfully');
    } catch (error: any) {
      console.log('Sports South scheduler update failed (likely missing database columns):', error.message);
      console.log('Scheduling will be available after database schema update');
    }
  }

  private getTodaysScheduledTime(scheduleTime: string, frequency: string, timezone: string): Date | null {
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    
    // Create current time in the specified timezone
    const nowInTimezone = toZonedTime(new Date(), timezone);
    const todayInTimezone = nowInTimezone.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Create today's scheduled time in the specified timezone
    const todayDateInTimezone = new Date(nowInTimezone);
    todayDateInTimezone.setHours(hours, minutes, 0, 0);
    
    // Convert back to UTC for comparison with other UTC dates
    const todaysScheduleUTC = fromZonedTime(todayDateInTimezone, timezone);
    
    // Handle frequency-based scheduling using timezone-aware day
    switch (frequency) {
      case 'daily':
        return todaysScheduleUTC;
      
      case 'weekdays':
        // Monday (1) to Friday (5)
        if (todayInTimezone >= 1 && todayInTimezone <= 5) {
          return todaysScheduleUTC;
        }
        return null;
      
      case 'weekly':
        // Every Monday (1)
        if (todayInTimezone === 1) {
          return todaysScheduleUTC;
        }
        return null;
      
      default:
        return todaysScheduleUTC;
    }
  }

  private buildCronExpression(time: string, frequency: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    
    switch (frequency) {
      case 'daily':
        return `${minutes} ${hours} * * *`;
      
      case 'weekdays':
        return `${minutes} ${hours} * * 1-5`; // Monday to Friday
      
      case 'weekly':
        return `${minutes} ${hours} * * 1`; // Every Monday
      
      default:
        return `${minutes} ${hours} * * *`; // Default to daily
    }
  }

  private async runSportsSouthSync(): Promise<void> {
    if (this.currentJob.isRunning) {
      console.log('🔄 SPORTS SOUTH SYNC: Already running, skipping...');
      return;
    }

    this.currentJob.isRunning = true;
    const startTime = Date.now();
    console.log('🚀 SPORTS SOUTH SYNC: Starting incremental sync...');

    try {
      // Get Sports South vendor details
      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(v => v.name.toLowerCase().includes('sports south'));
      
      if (!sportsSouth?.adminCredentials) {
        console.log('Sports South admin credentials not available for scheduled sync');
        if (sportsSouth) {
          await storage.updateSupportedVendor(sportsSouth.id, {
            catalogSyncStatus: 'error',
            catalogSyncError: 'Admin credentials not configured - please update Sports South settings'
          });
        }
        return;
      }

      // Update status to indicate sync is in progress
      await storage.updateSupportedVendor(sportsSouth.id, {
        catalogSyncStatus: 'in_progress'
      });

      // Create catalog sync instance and run incremental sync
      const catalogSync = new SportsSouthCatalogSyncService(
        sportsSouth.adminCredentials as any,
        RETAIL_VERTICALS.FIREARMS.id
      );
      const result = await catalogSync.performIncrementalSync();

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`🏁 SPORTS SOUTH SYNC: Completed in ${duration} seconds:`, {
        success: result.success,
        productsProcessed: result.productsProcessed,
        newProducts: result.newProducts,
        updatedProducts: result.updatedProducts,
        errors: result.errors.length
      });

      // Update status based on sync result
      if (result.success) {
        await storage.updateSupportedVendor(sportsSouth.id, {
          catalogSyncStatus: 'success',
          lastCatalogSync: new Date(),
          catalogSyncError: null,
          // Update sync statistics with accurate counts
          lastSyncNewRecords: result.newProducts || 0,
          lastSyncRecordsUpdated: result.updatedProducts || 0,
          lastSyncRecordsSkipped: result.skippedProducts || 0,
          lastSyncRecordsFailed: result.errors?.length || 0,
          lastSyncImagesAdded: result.imagesAdded || 0,
          lastSyncImagesUpdated: result.imagesUpdated || 0
        });
        console.log('✅ SPORTS SOUTH SYNC: Status updated to success');
      } else {
        await storage.updateSupportedVendor(sportsSouth.id, {
          catalogSyncStatus: 'error',
          catalogSyncError: `Sync completed with errors: ${result.errors.length} errors, ${result.productsProcessed} products processed`,
          // Update sync statistics even for failed syncs
          lastSyncNewRecords: result.newProducts || 0,
          lastSyncRecordsUpdated: result.updatedProducts || 0,
          lastSyncRecordsSkipped: result.skippedProducts || 0,
          lastSyncRecordsFailed: result.errors?.length || 0,
          lastSyncImagesAdded: result.imagesAdded || 0,
          lastSyncImagesUpdated: result.imagesUpdated || 0
        });
        console.log('❌ SPORTS SOUTH SYNC: Status updated to error due to sync failures');
      }

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.error(`❌ SPORTS SOUTH SYNC: Failed after ${duration} seconds:`, error);
      
      // Update status with error
      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(v => v.name.toLowerCase().includes('sports south'));
      
      if (sportsSouth) {
        await storage.updateSupportedVendor(sportsSouth.id, {
          catalogSyncStatus: 'error',
          catalogSyncError: `Scheduled sync failed: ${(error as Error).message}`
        });
        console.log('❌ SPORTS SOUTH SYNC: Status updated to error due to exception');
      }
    } finally {
      this.currentJob.isRunning = false;
      console.log('🔄 SPORTS SOUTH SYNC: Finished, isRunning flag cleared');
    }
  }

  getScheduleInfo(): { schedule: string; isRunning: boolean; enabled: boolean } {
    return {
      schedule: this.currentJob.schedule,
      isRunning: this.currentJob.isRunning,
      enabled: this.currentJob.task !== null
    };
  }

  async enableSchedule(): Promise<void> {
    const supportedVendors = await storage.getAllSupportedVendors();
    const sportsSouth = supportedVendors.find((v: any) => v.name.toLowerCase().includes('sports south'));
    
    if (sportsSouth) {
      await storage.updateSupportedVendor(sportsSouth.id, {
        sportsSouthScheduleEnabled: true
      });
      await this.updateSchedule();
    }
  }

  async disableSchedule(): Promise<void> {
    const supportedVendors = await storage.getAllSupportedVendors();
    const sportsSouth = supportedVendors.find((v: any) => v.name.toLowerCase().includes('sports south'));
    
    if (sportsSouth) {
      await storage.updateSupportedVendor(sportsSouth.id, {
        sportsSouthScheduleEnabled: false
      });
      await this.updateSchedule();
    }
  }

  async updateScheduleSettings(time: string, frequency: string): Promise<void> {
    const supportedVendors = await storage.getAllSupportedVendors();
    const sportsSouth = supportedVendors.find((v: any) => v.name.toLowerCase().includes('sports south'));
    
    if (sportsSouth) {
      await storage.updateSupportedVendor(sportsSouth.id, {
        sportsSouthScheduleTime: time,
        sportsSouthScheduleFrequency: frequency
      });
      await this.updateSchedule();
    }
  }
}

// DISABLED: Cron scheduler removed due to reliability issues
// Create singleton instance
// export const sportsSouthScheduler = new SportsSouthScheduler();
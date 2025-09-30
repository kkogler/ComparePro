/**
 * SIMPLIFIED Bill Hicks Scheduler
 * 
 * Replaces the complex 3-tier scheduler with a simple daily sync
 * Uses the new simplified sync function instead of complex multi-tier approach
 */

import * as cron from 'node-cron';
import { runBillHicksSimpleSync, runBillHicksInventorySync } from './bill-hicks-simple-sync';
import { storage } from './storage';

/**
 * Simple Bill Hicks scheduler with daily catalog sync and hourly inventory sync
 * Replaces the complex master/pricing/inventory tier system
 */
class BillHicksSimpleScheduler {
  private catalogSyncJob: cron.ScheduledTask | null = null;
  private inventorySyncJob: cron.ScheduledTask | null = null;
  private isCatalogSyncRunning = false;
  private isInventorySyncRunning = false;

  async initialize(): Promise<void> {
    console.log('🕒 Initializing Bill Hicks scheduler with daily catalog + hourly inventory sync...');
    await this.setupDailySync();
    await this.setupHourlyInventorySync();
    this.setupTestCron(); // Add test cron to verify functionality
    console.log('✅ Bill Hicks scheduler initialized');
  }

  /**
   * Setup daily catalog sync schedule
   */
  private async setupDailySync(): Promise<void> {
    try {
      // Get Bill Hicks vendor settings
      const billHicksVendorId = await storage.getBillHicksVendorId();
      const vendor = await storage.getSupportedVendorById(billHicksVendorId);
      
      if (!vendor) {
        console.log('⚠️ Bill Hicks vendor not found - daily catalog sync disabled');
        return;
      }

      // Stop existing job if any
      if (this.catalogSyncJob) {
        this.catalogSyncJob.stop();
        this.catalogSyncJob.destroy();
      }

      // Skip if sync is disabled
      if (!vendor.billHicksMasterCatalogSyncEnabled) {
        console.log('⚠️ Bill Hicks catalog sync is disabled');
        return;
      }

      // Determine sync schedule
      const customSyncTime = vendor.billHicksMasterCatalogSyncTime;
      let syncSchedule: string;
      
      if (customSyncTime) {
        // Validate time format and convert HH:MM to cron
        const timeMatch = customSyncTime.match(/^(\d{1,2}):(\d{1,2})$/);
        if (timeMatch) {
          const [, hoursStr, minutesStr] = timeMatch;
          const hours = parseInt(hoursStr, 10);
          const minutes = parseInt(minutesStr, 10);
          
          // Validate time values
          if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            syncSchedule = `${minutes} ${hours} * * *`; // Daily at custom time
            console.log(`🕒 Using custom sync time: ${customSyncTime} (cron: ${syncSchedule})`);
          } else {
            console.log(`⚠️ Invalid time values in ${customSyncTime}, using default`);
            syncSchedule = '0 2 * * *'; // Default: Daily at 2:00 AM
          }
        } else {
          console.log(`⚠️ Invalid time format ${customSyncTime}, using default`);
          syncSchedule = '0 2 * * *'; // Default: Daily at 2:00 AM
        }
      } else {
        syncSchedule = '0 2 * * *'; // Default: Daily at 2:00 AM
        console.log(`🕒 Using default sync schedule: ${syncSchedule}`);
      }

      // Schedule the daily catalog sync (timezone handled globally via process.env.TZ)
      this.catalogSyncJob = cron.schedule(syncSchedule, async () => {
        await this.runDailyCatalogSync();
      });
      
      // Explicitly start the job
      this.catalogSyncJob.start();

      console.log(`✅ Bill Hicks daily catalog sync scheduled: ${syncSchedule} (using global timezone: ${process.env.TZ || 'system default'})`);

    } catch (error) {
      console.error('❌ Failed to setup Bill Hicks daily catalog sync:', error);
    }
  }

  /**
   * Setup hourly inventory sync schedule (restored from original 3-tier system)
   */
  private async setupHourlyInventorySync(): Promise<void> {
    try {
      // Get Bill Hicks vendor settings
      const billHicksVendorId = await storage.getBillHicksVendorId();
      const vendor = await storage.getSupportedVendorById(billHicksVendorId);
      
      if (!vendor) {
        console.log('⚠️ Bill Hicks vendor not found - hourly inventory sync disabled');
        return;
      }

      // Stop existing job if any
      if (this.inventorySyncJob) {
        this.inventorySyncJob.stop();
        this.inventorySyncJob.destroy();
      }

      // Skip if inventory sync is disabled
      if (!vendor.billHicksInventorySyncEnabled) {
        console.log('⚠️ Bill Hicks inventory sync is disabled');
        return;
      }

      // Use the global inventory schedule from config (hourly - every hour at minute 0)
      const inventorySchedule = '0 * * * *'; // Every hour at minute 0

      // Schedule the hourly inventory sync (timezone handled globally via process.env.TZ)
      this.inventorySyncJob = cron.schedule(inventorySchedule, async () => {
        await this.runHourlyInventorySync();
      });
      
      // Explicitly start the job
      this.inventorySyncJob.start();

      console.log(`✅ Bill Hicks hourly inventory sync scheduled: ${inventorySchedule} (using global timezone: ${process.env.TZ || 'system default'})`);

    } catch (error) {
      console.error('❌ Failed to setup Bill Hicks hourly inventory sync:', error);
    }
  }

  /**
   * Run the daily catalog sync job
   */
  private async runDailyCatalogSync(): Promise<void> {
    if (this.isCatalogSyncRunning) {
      console.log('⏭️ Bill Hicks catalog sync already running - skipping');
      return;
    }

    this.isCatalogSyncRunning = true;
    console.log('🚀 Starting scheduled Bill Hicks catalog sync...');

    try {
      // Run the simplified sync (handles catalog)
      const result = await runBillHicksSimpleSync();
      
      if (result.success) {
        console.log(`✅ Scheduled catalog sync completed: ${result.message}`);
      } else {
        console.error(`❌ Scheduled catalog sync failed: ${result.message}`);
      }

    } catch (error) {
      console.error('❌ Scheduled Bill Hicks catalog sync failed:', error);
    } finally {
      this.isCatalogSyncRunning = false;
    }
  }

  /**
   * Run the hourly inventory sync job
   * FIXED: Now calls inventory-specific function instead of catalog sync
   */
  private async runHourlyInventorySync(): Promise<void> {
    if (this.isInventorySyncRunning) {
      console.log('⏭️ Bill Hicks inventory sync already running - skipping');
      return;
    }

    // Don't run inventory sync if catalog sync is running to avoid conflicts
    if (this.isCatalogSyncRunning) {
      console.log('⏭️ Bill Hicks catalog sync running - skipping inventory sync to avoid conflicts');
      return;
    }

    this.isInventorySyncRunning = true;
    console.log('📦 Starting scheduled Bill Hicks inventory sync...');

    try {
      // Call the inventory-only function (lightweight inventory updates only)
      const result = await runBillHicksInventorySync();
      
      if (result.success) {
        console.log(`✅ Scheduled inventory sync completed: ${result.message}`);
      } else {
        console.error(`❌ Scheduled inventory sync failed: ${result.message}`);
      }

    } catch (error) {
      console.error('❌ Scheduled Bill Hicks inventory sync failed:', error);
    } finally {
      this.isInventorySyncRunning = false;
    }
  }

  /**
   * Update schedules when settings change
   */
  async updateSchedule(): Promise<void> {
    console.log('🔄 Updating Bill Hicks sync schedules...');
    await this.setupDailySync();
    await this.setupHourlyInventorySync();
  }

  /**
   * Setup a test cron job to verify cron functionality
   * This logs every minute to confirm cron jobs are working
   * TEMPORARY: Can be removed once sync functionality is confirmed
   */
  private setupTestCron(): void {
    try {
      const testCron = cron.schedule('* * * * *', () => {
        const now = new Date();
        console.log(`🧪 Test cron executed at ${now.toLocaleString()} (TZ: ${process.env.TZ || 'system'})`);
      });
      
      testCron.start();
      console.log('🧪 Test cron job started - should log every minute');
      
      // Auto-disable test cron after 10 minutes to avoid spam
      setTimeout(() => {
        testCron.stop();
        testCron.destroy();
        console.log('🧪 Test cron job automatically stopped after 10 minutes');
      }, 10 * 60 * 1000);
      
    } catch (error) {
      console.error('❌ Failed to setup test cron:', error);
    }
  }

  /**
   * Get current sync status
   */
  getStatus() {
    return {
      catalogSync: {
        scheduled: this.catalogSyncJob !== null,
        running: this.isCatalogSyncRunning,
        schedule: this.catalogSyncJob ? 'Daily catalog sync enabled' : 'No catalog sync scheduled'
      },
      inventorySync: {
        scheduled: this.inventorySyncJob !== null,
        running: this.isInventorySyncRunning,
        schedule: this.inventorySyncJob ? 'Hourly inventory sync enabled' : 'No inventory sync scheduled'
      }
    };
  }
}

// Global scheduler instance
let billHicksScheduler: BillHicksSimpleScheduler | null = null;

/**
 * Initialize the simplified Bill Hicks scheduler
 * Call this from your main app initialization
 */
export async function initializeBillHicksSimpleScheduler(): Promise<void> {
  if (billHicksScheduler) {
    console.log('✅ Bill Hicks scheduler already initialized');
    return;
  }

  billHicksScheduler = new BillHicksSimpleScheduler();
  await billHicksScheduler.initialize();
}

/**
 * Update scheduler settings (call when vendor settings change)
 */
export async function updateBillHicksSchedule(): Promise<void> {
  if (billHicksScheduler) {
    await billHicksScheduler.updateSchedule();
  }
}

/**
 * Get scheduler status
 */
export function getBillHicksSchedulerStatus() {
  return billHicksScheduler?.getStatus() || {
    catalogSync: {
      scheduled: false,
      running: false,
      schedule: 'Not initialized'
    },
    inventorySync: {
      scheduled: false,
      running: false,
      schedule: 'Not initialized'
    }
  };
}

/**
 * Manual trigger for testing/admin use
 */
export async function triggerBillHicksSyncManually(): Promise<any> {
  console.log('🔄 Manual Bill Hicks sync triggered...');
  return await runBillHicksSimpleSync();
}
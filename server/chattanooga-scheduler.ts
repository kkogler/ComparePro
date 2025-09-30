import * as cron from 'node-cron';
import { storage } from './storage.js';
import { ChattanoogaAPI } from './chattanooga-api.js';
import { writeFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import * as crypto from 'crypto';
import { ChattanoogaCSVImporter } from './chattanooga-csv-importer.js';

interface ScheduledJob {
  task: cron.ScheduledTask | null;
  schedule: string;
  isRunning: boolean;
}

interface ChattanoogaSyncResult {
  success: boolean;
  productsProcessed: number;
  error?: string;
  csvSize?: number;
  newProducts?: number;
  updatedProducts?: number;
  skippedProducts?: number;
  errors?: string[];
}

class ChattanoogaScheduler {
  private currentJob: ScheduledJob = {
    task: null,
    schedule: '',
    isRunning: false
  };

  private cacheDir = join(process.cwd(), 'chattanooga-cache');
  private currentCsvPath = join(process.cwd(), 'chattanooga-cache', 'current-catalog.csv');
  private previousCsvPath = join(process.cwd(), 'chattanooga-cache', 'previous-catalog.csv');

  constructor() {
    // DISABLED: Auto-initialization removed to prevent endless loops
    // this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('Initializing Chattanooga scheduler...');
    this.ensureCacheDirectory();
    await this.updateSchedule();
    console.log('Chattanooga scheduler initialized');
    
    // STARTUP RECOVERY: Check for missed/stuck syncs (like Sports South pattern)
    setTimeout(async () => {
      try {
        console.log('🔄 STARTUP RECOVERY: Checking Chattanooga sync status...');
        
        const supportedVendors = await storage.getAllSupportedVendors();
        const chattanooga = supportedVendors.find(v => v.name.toLowerCase().includes('chattanooga'));
        
        if (chattanooga) {
          // Check if sync is stuck "in progress"
          if (chattanooga.chattanoogaCsvSyncStatus === 'in_progress') {
            console.log('🚨 STARTUP RECOVERY: Chattanooga sync stuck "in progress" - resetting status');
            await storage.updateSupportedVendor(chattanooga.id, {
              chattanoogaCsvSyncStatus: 'error',
              chattanoogaCsvSyncError: 'Sync interrupted by server restart - auto-recovered'
            });
          }
          
          // Check if we missed the scheduled sync based on today's schedule
          const adminSettings = await storage.getAdminSettings();
          const systemTimezone = adminSettings?.systemTimeZone || 'America/New_York';
          const scheduleTime = chattanooga.chattanoogaScheduleTime || '15:00';
          const frequency = chattanooga.chattanoogaScheduleFrequency || 'daily';
          
          console.log(`🔄 STARTUP RECOVERY: Chattanooga schedule: ${frequency} at ${scheduleTime} (${systemTimezone})`);
          
          if (chattanooga.lastCatalogSync) {
            const lastSync = new Date(chattanooga.lastCatalogSync);
            const now = new Date();
            const hoursSinceLastSync = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60));
            
            console.log(`🔄 STARTUP RECOVERY: Last Chattanooga sync was ${hoursSinceLastSync} hours ago (${lastSync.toLocaleString()})`);
            
            // Calculate today's scheduled sync time in system timezone
            const todaysSchedule = this.getTodaysScheduledTime(scheduleTime, frequency, systemTimezone);
            
            if (todaysSchedule && now > todaysSchedule && lastSync < todaysSchedule) {
              console.log(`🚨 STARTUP RECOVERY: Missed today's ${scheduleTime} sync (scheduled: ${todaysSchedule.toLocaleString()}, last sync: ${lastSync.toLocaleString()}) - triggering immediate Chattanooga sync!`);
              
              try {
                await this.runChattanoogaSync();
                console.log('✅ STARTUP RECOVERY: Chattanooga sync completed successfully');
              } catch (error) {
                console.error('❌ STARTUP RECOVERY: Chattanooga sync failed:', error);
              }
            } else if (hoursSinceLastSync >= 25) {
              // Fallback: If more than 25 hours since last sync, something is definitely wrong
              console.log(`🚨 STARTUP RECOVERY: ${hoursSinceLastSync} hours since last sync (fallback threshold) - triggering immediate Chattanooga sync!`);
              
              try {
                await this.runChattanoogaSync();
                console.log('✅ STARTUP RECOVERY: Chattanooga sync completed successfully');
              } catch (error) {
                console.error('❌ STARTUP RECOVERY: Chattanooga sync failed:', error);
              }
            } else {
              console.log('✅ STARTUP RECOVERY: Chattanooga sync is up to date');
              
              // Clear any old recovery error messages since everything is working correctly
              if (chattanooga.chattanoogaCsvSyncError && chattanooga.chattanoogaCsvSyncError.includes('auto-recovered')) {
                console.log('🧹 STARTUP RECOVERY: Clearing old recovery error message');
                await storage.updateSupportedVendor(chattanooga.id, {
                  chattanoogaCsvSyncError: null
                });
              }
            }
          } else {
            console.log('🔄 STARTUP RECOVERY: No previous Chattanooga sync found - triggering initial sync');
            try {
              await this.runChattanoogaSync();
              console.log('✅ STARTUP RECOVERY: Initial Chattanooga sync completed successfully');
            } catch (error) {
              console.error('❌ STARTUP RECOVERY: Initial Chattanooga sync failed:', error);
            }
          }
        }
      } catch (error) {
        console.error('❌ STARTUP RECOVERY: Failed to check Chattanooga sync status:', error);
      }
    }, 15000); // 15 second delay to let server finish starting
  }

  private ensureCacheDirectory(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
      console.log('CHATTANOOGA SCHEDULER: Created cache directory');
    }
  }

  async updateSchedule(): Promise<void> {
    try {
      const supportedVendors = await storage.getAllSupportedVendors();
      const chattanooga = supportedVendors.find(v => v.name.toLowerCase().includes('chattanooga'));
      
      if (!chattanooga) {
        console.log('Chattanooga vendor not found, skipping schedule update');
        return;
      }

      // Stop existing job
      if (this.currentJob.task) {
        this.currentJob.task.stop();
        this.currentJob.task.destroy();
        console.log('Stopped existing Chattanooga sync job');
      }

      if (!chattanooga.chattanoogaScheduleEnabled) {
        console.log('Chattanooga scheduling is disabled');
        return;
      }

      if (!chattanooga.adminCredentials) {
        console.log('Chattanooga admin credentials not configured, skipping scheduling');
        return;
      }

      const cronExpression = this.buildCronExpression(
        chattanooga.chattanoogaScheduleTime || '15:00',
        chattanooga.chattanoogaScheduleFrequency || 'daily'
      );

      console.log(`Setting up Chattanooga sync with cron: ${cronExpression}`);

      this.currentJob.schedule = cronExpression;
      // Get admin timezone setting
      const adminSettings = await storage.getAdminSettings();
      const systemTimezone = adminSettings?.systemTimeZone || 'America/New_York';
      
      this.currentJob.task = cron.schedule(cronExpression, async () => {
        console.log('🚀 CHATTANOOGA CRON TRIGGERED: Starting scheduled sync');
        const startTime = Date.now();
        try {
          await this.runChattanoogaSync();
          const duration = Math.round((Date.now() - startTime) / 1000);
          console.log(`✅ CHATTANOOGA CRON COMPLETED: Sync finished in ${duration} seconds`);
        } catch (error) {
          const duration = Math.round((Date.now() - startTime) / 1000);
          console.error(`❌ CHATTANOOGA CRON FAILED: Sync failed after ${duration} seconds:`, error);
        }
      }, {
        timezone: systemTimezone
      });

      console.log('Chattanooga scheduler updated successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log('Chattanooga scheduler update failed (likely missing database columns):', errorMessage);
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
        // Every Sunday (0)
        if (todayInTimezone === 0) {
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
        return `${minutes} ${hours} * * 1-5`;
      case 'weekly':
        return `${minutes} ${hours} * * 0`; // Sunday
      default:
        return `${minutes} ${hours} * * *`; // Default to daily
    }
  }

  private async runChattanoogaSync(forceDownload: boolean = false): Promise<void> {
    if (this.currentJob.isRunning) {
      console.log('🔄 CHATTANOOGA SYNC: Already running, skipping...');
      return;
    }

    this.currentJob.isRunning = true;
    const startTime = Date.now();
    const syncType = forceDownload ? 'manual' : 'scheduled';
    console.log(`🚀 CHATTANOOGA SYNC: Starting ${syncType} CSV sync...`);

    try {
      // Get Chattanooga vendor details
      const supportedVendors = await storage.getAllSupportedVendors();
      const chattanooga = supportedVendors.find(v => v.name.toLowerCase().includes('chattanooga'));
      
      if (!chattanooga?.adminCredentials) {
        console.log('Chattanooga admin credentials not available for scheduled sync');
        if (chattanooga) {
          await storage.updateSupportedVendor(chattanooga.id, {
            chattanoogaCsvSyncStatus: 'error',
            chattanoogaCsvSyncError: 'Admin credentials not configured - please update Chattanooga settings'
          });
        }
        return;
      }

      // Update status to indicate sync is in progress
      await storage.updateSupportedVendor(chattanooga.id, {
        chattanoogaCsvSyncStatus: 'in_progress'
      });

      // Perform the sync
      const result = await this.performCsvSync(chattanooga.adminCredentials);

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`🏁 CHATTANOOGA SYNC: Completed in ${duration} seconds:`, {
        success: result.success,
        productsProcessed: result.productsProcessed,
        csvSize: result.csvSize
      });

      // Update status based on sync result
      if (result.success) {
        await storage.updateSupportedVendor(chattanooga.id, {
          chattanoogaCsvSyncStatus: 'success',
          lastCatalogSync: new Date(),
          chattanoogaCsvSyncError: null,
          // Update sync statistics with accurate counts
          chattanoogaTotalRecords: result.productsProcessed,
          chattanoogaRecordsUpdated: result.updatedProducts || 0,
          chattanoogaRecordsAdded: result.newProducts || 0,
          chattanoogaRecordsSkipped: result.skippedProducts || 0,
          chattanoogaRecordsFailed: result.errors?.length || 0,
          // Save CSV info
          chattanoogaLastCsvDownload: new Date(),
          chattanoogaLastCsvSize: result.csvSize
        });
        console.log('✅ CHATTANOOGA SYNC: Status updated to success');
      } else {
        await storage.updateSupportedVendor(chattanooga.id, {
          chattanoogaCsvSyncStatus: 'error',
          chattanoogaCsvSyncError: `${syncType} sync failed: ${result.error}`
        });
        console.log('❌ CHATTANOOGA SYNC: Status updated to error due to sync failure');
      }

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.error(`❌ CHATTANOOGA SYNC: Failed after ${duration} seconds:`, error);
      
      // Update status with error
      const supportedVendors = await storage.getAllSupportedVendors();
      const chattanooga = supportedVendors.find(v => v.name.toLowerCase().includes('chattanooga'));
      
      if (chattanooga) {
        await storage.updateSupportedVendor(chattanooga.id, {
          chattanoogaCsvSyncStatus: 'error',
          chattanoogaCsvSyncError: `${syncType} sync failed: ${(error as Error).message}`
        });
        console.log('❌ CHATTANOOGA SYNC: Status updated to error due to exception');
      }
    } finally {
      this.currentJob.isRunning = false;
      console.log('🔄 CHATTANOOGA SYNC: Finished, isRunning flag cleared');
    }
  }

  private async performCsvSync(credentials: any): Promise<ChattanoogaSyncResult> {
    try {
      console.log('CHATTANOOGA SYNC: Creating API client and fetching product feed...');

      // Create API client with credentials
      const api = new ChattanoogaAPI({
        accountNumber: credentials.accountNumber || '',
        username: credentials.username || '',
        password: credentials.password || '',
        sid: credentials.sid,
        token: credentials.token
      });

      // Simple retry logic (max 3 attempts)
      let attempt = 0;
      let productFeedResult;
      
      while (attempt < 3) {
        attempt++;
        console.log(`CHATTANOOGA SYNC: Attempting to get product feed (attempt ${attempt}/3)`);
        
        productFeedResult = await api.getProductFeed();
        
        if (productFeedResult.success && productFeedResult.data) {
          break;
        }
        
        if (attempt < 3) {
          const delay = attempt === 1 ? 5000 : 10000; // 5s first retry, 10s second retry
          console.log(`CHATTANOOGA SYNC: Attempt ${attempt} failed, retrying in ${delay/1000} seconds...`);
          console.log(`CHATTANOOGA SYNC: Error: ${productFeedResult?.message || 'Unknown error'}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!productFeedResult?.success || !productFeedResult.data) {
        const errorMsg = `Failed to get product feed after 3 attempts. Last error: ${productFeedResult?.message || 'Unknown error'}`;
        console.error('CHATTANOOGA SYNC:', errorMsg);
        return { success: false, productsProcessed: 0, error: errorMsg };
      }

      // Process the CSV data  
      const csvData = typeof productFeedResult.data === 'string' 
        ? productFeedResult.data 
        : String(productFeedResult.data);
      const csvSize = csvData.length;
      
      // Count total products (lines minus header)
      const lines = csvData.split('\n').filter(line => line.trim());
      const totalProducts = Math.max(0, lines.length - 1); // Subtract header
      
      console.log(`CHATTANOOGA SYNC: Downloaded CSV with ${totalProducts} products (${(csvSize / 1024 / 1024).toFixed(2)} MB)`);

      // STEP 1: Line-by-line differential detection (like Bill Hicks)
      const changeResult = await this.detectChangedLines(csvData);
      
      if (!changeResult.hasChanges) {
        console.log('📋 CHATTANOOGA SYNC: No changes detected - skipping import');
        console.log(`✅ All ${totalProducts} products unchanged`);
        
        // Don't update the previous CSV since nothing changed
        return {
          success: true,
          productsProcessed: totalProducts,
          csvSize,
          newProducts: 0,
          updatedProducts: 0,
          skippedProducts: totalProducts, // All products skipped due to no changes
          errors: []
        };
      }

      // STEP 2: Log differential statistics
      console.log(`🎯 DIFFERENTIAL SYNC: Found ${changeResult.stats.changedLines} changed lines out of ${changeResult.stats.totalLines} total`);
      console.log(`📊 Added: ${changeResult.stats.addedLines}, Removed: ${changeResult.stats.removedLines}`);
      console.log(`⚡ Processing only ${changeResult.stats.changedLines} products instead of ${totalProducts}! (${Math.round((1 - changeResult.stats.changedLines / totalProducts) * 100)}% reduction)`);

      // STEP 3: Save full CSV for future comparison
      await this.saveCsvFiles(csvData);

      // STEP 4: Create temporary CSV with ONLY changed lines
      const changedCsvPath = join(this.cacheDir, 'changed-products.csv');
      const changedCsvContent = changeResult.changedLines.join('\n');
      writeFileSync(changedCsvPath, changedCsvContent);
      console.log(`📝 CHATTANOOGA SYNC: Created differential CSV with ${changeResult.stats.changedLines} changed products`);

      // STEP 5: Import ONLY changed products
      console.log('CHATTANOOGA SYNC: Starting differential product import...');
      const importResult = await ChattanoogaCSVImporter.importFromCSV(changedCsvPath);

      console.log(`CHATTANOOGA SYNC: Import completed - ${importResult.imported} imported, ${importResult.skipped} skipped, ${importResult.errors.length} errors`);
      
      // STEP 6: Clean up temporary file
      if (existsSync(changedCsvPath)) {
        unlinkSync(changedCsvPath);
        console.log('🧹 CHATTANOOGA SYNC: Cleaned up temporary differential CSV');
      }

      return {
        success: true,
        productsProcessed: totalProducts,
        csvSize,
        newProducts: importResult.imported, // Simplified - CSV importer doesn't distinguish new vs updated
        updatedProducts: 0,
        skippedProducts: importResult.skipped,
        errors: importResult.errors
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('CHATTANOOGA SYNC: CSV sync failed:', error);
      return { success: false, productsProcessed: 0, error: errorMessage };
    }
  }

  /**
   * Line-by-line differential detection (like Bill Hicks optimization)
   * Returns only the changed lines instead of a boolean
   * This is MUCH more efficient than processing all 78,000+ products
   */
  private async detectChangedLines(newContent: string): Promise<{
    hasChanges: boolean;
    changedLines: string[];
    stats: {
      totalLines: number;
      changedLines: number;
      addedLines: number;
      removedLines: number;
    };
  }> {
    try {
      // Check if previous CSV exists
      if (!existsSync(this.previousCsvPath)) {
        console.log('📝 CHATTANOOGA SYNC: No previous CSV found - processing all records (first sync)');
        const allLines = newContent.split('\n').filter(line => line.trim());
        return {
          hasChanges: true,
          changedLines: allLines,
          stats: {
            totalLines: allLines.length,
            changedLines: allLines.length - 1, // Subtract header
            addedLines: allLines.length - 1,
            removedLines: 0
          }
        };
      }

      // Read previous CSV
      const previousContent = readFileSync(this.previousCsvPath, 'utf-8');
      const previousLines = new Set(previousContent.split('\n').filter(line => line.trim()));
      const newLines = newContent.split('\n').filter(line => line.trim());
      const newLinesSet = new Set(newLines);

      // Find added/modified lines (lines that exist in new but not in previous)
      const changedLines = [];
      const headerLine = newLines[0]; // Always include header
      if (headerLine) {
        changedLines.push(headerLine);
      }

      for (let i = 1; i < newLines.length; i++) { // Skip header
        const line = newLines[i];
        if (!previousLines.has(line)) {
          changedLines.push(line);
        }
      }

      // Calculate stats
      const addedLines = newLines.filter(line => !previousLines.has(line)).length;
      const removedLines = Array.from(previousLines).filter(line => !newLinesSet.has(line)).length;

      const stats = {
        totalLines: newLines.length,
        changedLines: changedLines.length - 1, // Subtract header
        addedLines: addedLines,
        removedLines: removedLines
      };

      const hasChanges = changedLines.length > 1; // More than just header

      if (hasChanges) {
        console.log(`🎯 CHATTANOOGA DIFFERENTIAL: Found ${stats.changedLines} changed lines out of ${stats.totalLines} total`);
        console.log(`📊 Added: ${stats.addedLines}, Removed: ${stats.removedLines}`);
      } else {
        console.log('✅ CHATTANOOGA DIFFERENTIAL: No changes detected - all lines identical');
      }

      return {
        hasChanges,
        changedLines,
        stats
      };

    } catch (error) {
      console.log(`⚠️ CHATTANOOGA DIFFERENTIAL: Error detecting changes: ${(error as Error).message} - assuming changes exist`);
      // On error, process all lines to be safe
      const allLines = newContent.split('\n').filter(line => line.trim());
      return {
        hasChanges: true,
        changedLines: allLines,
        stats: {
          totalLines: allLines.length,
          changedLines: allLines.length - 1,
          addedLines: allLines.length - 1,
          removedLines: 0
        }
      };
    }
  }

  /**
   * Save CSV files for future comparison
   * Moves current to previous, saves new CSV as current
   */
  private async saveCsvFiles(csvData: string): Promise<void> {
    try {
      // Move current to previous (if it exists)
      if (existsSync(this.currentCsvPath)) {
        const currentCsv = readFileSync(this.currentCsvPath, 'utf-8');
        writeFileSync(this.previousCsvPath, currentCsv);
        console.log('📁 CHATTANOOGA SYNC: Backed up previous CSV');
      }

      // Save new CSV as current
      writeFileSync(this.currentCsvPath, csvData);
      console.log('📁 CHATTANOOGA SYNC: Saved new CSV');

    } catch (error) {
      console.error(`📁 CHATTANOOGA SYNC: Error saving CSV files: ${(error as Error).message}`);
      // Don't fail the sync for file save errors
    }
  }

  // Public API methods for UI integration
  getScheduleInfo(): { schedule: string; isRunning: boolean; enabled: boolean } {
    return {
      schedule: this.currentJob.schedule,
      isRunning: this.currentJob.isRunning,
      enabled: this.currentJob.task !== null
    };
  }

  async enableSchedule(): Promise<void> {
    const supportedVendors = await storage.getAllSupportedVendors();
    const chattanooga = supportedVendors.find((v: any) => v.name.toLowerCase().includes('chattanooga'));
    
    if (chattanooga) {
      await storage.updateSupportedVendor(chattanooga.id, {
        chattanoogaScheduleEnabled: true
      });
      await this.updateSchedule();
    }
  }

  async disableSchedule(): Promise<void> {
    const supportedVendors = await storage.getAllSupportedVendors();
    const chattanooga = supportedVendors.find((v: any) => v.name.toLowerCase().includes('chattanooga'));
    
    if (chattanooga) {
      await storage.updateSupportedVendor(chattanooga.id, {
        chattanoogaScheduleEnabled: false
      });
      await this.updateSchedule();
    }
  }

  async updateScheduleSettings(time: string, frequency: string): Promise<void> {
    const supportedVendors = await storage.getAllSupportedVendors();
    const chattanooga = supportedVendors.find((v: any) => v.name.toLowerCase().includes('chattanooga'));
    
    if (chattanooga) {
      await storage.updateSupportedVendor(chattanooga.id, {
        chattanoogaScheduleTime: time,
        chattanoogaScheduleFrequency: frequency
      });
      await this.updateSchedule();
    }
  }

  // Manual sync trigger for UI
  async triggerManualSync(): Promise<void> {
    await this.runChattanoogaSync(true);
  }
}

// DISABLED: Singleton instance removed to prevent endless loops
// export const chattanoogaScheduler = new ChattanoogaScheduler();

// Create scheduler instance only when needed
export function getChattanoogaScheduler(): ChattanoogaScheduler {
  return new ChattanoogaScheduler();
}
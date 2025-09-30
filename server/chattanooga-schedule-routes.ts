import { Request, Response } from 'express';
import { storage } from './storage.js';
// DISABLED: Cron scheduler removed due to reliability issues - using Scheduled Deployments
// import { chattanoogaScheduler } from './chattanooga-scheduler.js';

export function registerChattanoogaScheduleRoutes(app: any) {
  
  // Toggle Chattanooga schedule on/off
  app.post("/api/chattanooga/schedule/toggle", async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'enabled field must be a boolean'
        });
      }

      const supportedVendors = await storage.getAllSupportedVendors();
      const chattanooga = supportedVendors.find(v => v.name.toLowerCase().includes('chattanooga'));
      
      if (!chattanooga) {
        return res.status(404).json({
          success: false,
          message: 'Chattanooga vendor not found'
        });
      }

      // Update the database
      await storage.updateSupportedVendor(chattanooga.id, {
        chattanoogaScheduleEnabled: enabled
      });

      // DISABLED: Cron scheduler removed - database-only update
      // if (enabled) {
      //   await chattanoogaScheduler.enableSchedule();
      // } else {
      //   await chattanoogaScheduler.disableSchedule();
      // }

      console.log(`Chattanooga schedule ${enabled ? 'enabled' : 'disabled'}`);
      
      res.json({
        success: true,
        message: `Chattanooga schedule ${enabled ? 'enabled' : 'disabled'}`,
        enabled
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Chattanooga schedule toggle error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to update schedule: ${errorMessage}`
      });
    }
  });

  // Update Chattanooga schedule settings
  app.post("/api/chattanooga/schedule/update", async (req: Request, res: Response) => {
    try {
      const { time, frequency } = req.body;
      
      if (!time || !frequency) {
        return res.status(400).json({
          success: false,
          message: 'time and frequency are required'
        });
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(time)) {
        return res.status(400).json({
          success: false,
          message: 'time must be in HH:MM format'
        });
      }

      // Validate frequency
      const validFrequencies = ['daily', 'weekdays', 'weekly'];
      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({
          success: false,
          message: 'frequency must be one of: daily, weekdays, weekly'
        });
      }

      const supportedVendors = await storage.getAllSupportedVendors();
      const chattanooga = supportedVendors.find(v => v.name.toLowerCase().includes('chattanooga'));
      
      if (!chattanooga) {
        return res.status(404).json({
          success: false,
          message: 'Chattanooga vendor not found'
        });
      }

      // Update the database
      await storage.updateSupportedVendor(chattanooga.id, {
        chattanoogaScheduleTime: time,
        chattanoogaScheduleFrequency: frequency
      });

      // DISABLED: Cron scheduler removed - database-only update
      // await chattanoogaScheduler.updateScheduleSettings(time, frequency);

      console.log(`Chattanooga schedule updated: ${frequency} at ${time}`);
      
      res.json({
        success: true,
        message: `Chattanooga schedule updated: ${frequency} at ${time}`,
        time,
        frequency
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Chattanooga schedule update error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to update schedule: ${errorMessage}`
      });
    }
  });

  // Get Chattanooga schedule status
  app.get("/api/chattanooga/schedule/status", async (req: Request, res: Response) => {
    try {
      const supportedVendors = await storage.getAllSupportedVendors();
      const chattanooga = supportedVendors.find(v => v.name.toLowerCase().includes('chattanooga'));
      
      if (!chattanooga) {
        return res.status(404).json({
          success: false,
          message: 'Chattanooga vendor not found'
        });
      }

      // DISABLED: Cron scheduler removed - return default values
      // const scheduleInfo = chattanoogaScheduler.getScheduleInfo();
      const scheduleInfo = { isRunning: false, schedule: 'Disabled - using Scheduled Deployments' };

      res.json({
        success: true,
        schedule: {
          enabled: chattanooga.chattanoogaScheduleEnabled || false,
          time: chattanooga.chattanoogaScheduleTime || '15:00',
          frequency: chattanooga.chattanoogaScheduleFrequency || 'daily',
          isRunning: scheduleInfo.isRunning,
          cronExpression: scheduleInfo.schedule,
          csvSyncStatus: chattanooga.chattanoogaCsvSyncStatus || 'never_synced',
          lastCsvDownload: chattanooga.chattanoogaLastCsvDownload,
          csvSyncError: chattanooga.chattanoogaCsvSyncError
        }
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Chattanooga schedule status error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to get schedule status: ${errorMessage}`
      });
    }
  });

  // Manual sync trigger (optimized - uses cached CSV when available)
  app.post("/api/chattanooga/schedule/manual-sync", async (req: Request, res: Response) => {
    try {
      const forceDownload = req.body?.forceDownload === true;
      
      // Import and use the scheduler
      const { getChattanoogaScheduler } = await import('./chattanooga-scheduler.js');
      const scheduler = getChattanoogaScheduler();
      await scheduler.triggerManualSync();
      
      res.json({
        success: true,
        message: 'Manual Chattanooga sync started successfully'
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Chattanooga manual sync error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to start manual sync: ${errorMessage}`
      });
    }
  });

  // Force fresh download sync (for when you need to bypass cache)
  app.post("/api/chattanooga/schedule/force-sync", async (req: Request, res: Response) => {
    try {
      // DISABLED: Force sync removed with cron scheduler
      // const result = await chattanoogaScheduler.manualSync(true);
      const result = { success: false, message: 'Force sync disabled - use Scheduled Deployments for reliable syncing' };
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message
        });
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Chattanooga force sync error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to start force sync: ${errorMessage}`
      });
    }
  });

  // Clear sync error - admin only endpoint
  app.post("/api/chattanooga/schedule/clear-error", async (req: Request, res: Response) => {
    try {
      const { storage } = await import('./storage.js');
      
      // Get Chattanooga vendor
      const supportedVendors = await storage.getAllSupportedVendors();
      const chattanooga = supportedVendors.find(v => v.name.toLowerCase().includes('chattanooga'));
      
      if (!chattanooga) {
        return res.status(404).json({
          success: false,
          message: 'Chattanooga vendor not found'
        });
      }
      
      // Clear the error
      await storage.updateSupportedVendor(chattanooga.id, {
        chattanoogaCsvSyncError: null,
        chattanoogaCsvSyncStatus: 'never_synced'
      });
      
      res.json({
        success: true,
        message: 'Chattanooga sync error cleared successfully'
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Chattanooga clear error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to clear error: ${errorMessage}`
      });
    }
  });
}
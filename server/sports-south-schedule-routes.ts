/**
 * Sports South Schedule Management Routes
 * 
 * NOTE: Cron-based scheduling disabled - using Scheduled Deployments for automation
 * These routes manage schedule settings in the database and trigger manual syncs
 */

import { Request, Response } from 'express';
import { storage } from './storage.js';

export function registerSportsSouthScheduleRoutes(app: any) {
  
  // Toggle Sports South schedule on/off
  app.post("/api/sports-south/schedule/toggle", async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'enabled field must be a boolean'
        });
      }

      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(v => v.name.toLowerCase().includes('sports south'));
      
      if (!sportsSouth) {
        return res.status(404).json({
          success: false,
          message: 'Sports South vendor not found'
        });
      }

      // Update the database
      await storage.updateSupportedVendor(sportsSouth.id, {
        sportsSouthScheduleEnabled: enabled
      });

      // DISABLED: Cron scheduler removed - database-only update
      // if (enabled) {
      //   await sportsSouthScheduler.enableSchedule();
      // } else {
      //   await sportsSouthScheduler.disableSchedule();
      // }

      console.log(`Sports South schedule ${enabled ? 'enabled' : 'disabled'}`);
      
      res.json({
        success: true,
        message: `Sports South schedule ${enabled ? 'enabled' : 'disabled'}`,
        enabled
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Sports South schedule toggle error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to update schedule: ${errorMessage}`
      });
    }
  });

  // Update Sports South schedule settings
  app.post("/api/sports-south/schedule/update", async (req: Request, res: Response) => {
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
      const sportsSouth = supportedVendors.find(v => v.name.toLowerCase().includes('sports south'));
      
      if (!sportsSouth) {
        return res.status(404).json({
          success: false,
          message: 'Sports South vendor not found'
        });
      }

      // Update the database
      await storage.updateSupportedVendor(sportsSouth.id, {
        sportsSouthScheduleTime: time,
        sportsSouthScheduleFrequency: frequency
      });

      // DISABLED: Cron scheduler removed - database-only update
      // await sportsSouthScheduler.updateScheduleSettings(time, frequency);

      console.log(`Sports South schedule updated: ${frequency} at ${time}`);
      
      res.json({
        success: true,
        message: `Sports South schedule updated: ${frequency} at ${time}`,
        time,
        frequency
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Sports South schedule update error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to update schedule: ${errorMessage}`
      });
    }
  });

  // Get Sports South schedule status
  app.get("/api/sports-south/schedule/status", async (req: Request, res: Response) => {
    try {
      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(v => v.name.toLowerCase().includes('sports south'));
      
      if (!sportsSouth) {
        return res.status(404).json({
          success: false,
          message: 'Sports South vendor not found'
        });
      }

      // DISABLED: Cron scheduler removed - return default values
      // const scheduleInfo = sportsSouthScheduler.getScheduleInfo();
      const scheduleInfo = { isRunning: false, schedule: 'Disabled - using Scheduled Deployments' };

      res.json({
        success: true,
        schedule: {
          enabled: sportsSouth.sportsSouthScheduleEnabled || false,
          time: sportsSouth.sportsSouthScheduleTime || '14:00',
          frequency: sportsSouth.sportsSouthScheduleFrequency || 'daily',
          isRunning: scheduleInfo.isRunning,
          cronExpression: scheduleInfo.schedule
        }
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Sports South schedule status error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to get schedule status: ${errorMessage}`
      });
    }
  });
}
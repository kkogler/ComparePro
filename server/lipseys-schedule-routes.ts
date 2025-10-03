import { Request, Response } from 'express';
import { storage } from './storage.js';

export function registerLipseysScheduleRoutes(app: any) {
  
  // Toggle Lipsey's schedule on/off
  app.post("/api/admin/lipseys/schedule/toggle", async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'enabled field must be a boolean'
        });
      }

      const supportedVendors = await storage.getAllSupportedVendors();
      const lipseys = supportedVendors.find(v => v.name.toLowerCase().includes('lipsey'));
      
      if (!lipseys) {
        return res.status(404).json({
          success: false,
          message: 'Lipsey\'s vendor not found'
        });
      }

      // Update the database
      await storage.updateSupportedVendor(lipseys.id, {
        lipseysCatalogSyncEnabled: enabled
      });

      console.log(`Lipsey's schedule ${enabled ? 'enabled' : 'disabled'}`);
      
      res.json({
        success: true,
        message: `Lipsey's schedule ${enabled ? 'enabled' : 'disabled'}`,
        enabled
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Lipsey\'s schedule toggle error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to update schedule: ${errorMessage}`
      });
    }
  });

  // Update Lipsey's schedule settings
  app.post("/api/admin/lipseys/schedule/update", async (req: Request, res: Response) => {
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
      const lipseys = supportedVendors.find(v => v.name.toLowerCase().includes('lipsey'));
      
      if (!lipseys) {
        return res.status(404).json({
          success: false,
          message: 'Lipsey\'s vendor not found'
        });
      }

      // Update the database
      await storage.updateSupportedVendor(lipseys.id, {
        lipseysCatalogSyncTime: time,
        lipseysCatalogSyncFrequency: frequency
      });

      console.log(`Lipsey's schedule updated: ${frequency} at ${time}`);
      
      res.json({
        success: true,
        message: `Lipsey's schedule updated: ${frequency} at ${time}`,
        time,
        frequency
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Lipsey\'s schedule update error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to update schedule: ${errorMessage}`
      });
    }
  });

  // Get Lipsey's schedule status
  app.get("/api/admin/lipseys/schedule/status", async (req: Request, res: Response) => {
    try {
      const supportedVendors = await storage.getAllSupportedVendors();
      const lipseys = supportedVendors.find(v => v.name.toLowerCase().includes('lipsey'));
      
      if (!lipseys) {
        return res.status(404).json({
          success: false,
          message: 'Lipsey\'s vendor not found'
        });
      }

      res.json({
        success: true,
        schedule: {
          enabled: (lipseys as any).lipseysCatalogSyncEnabled || false,
          time: (lipseys as any).lipseysCatalogSyncTime || '08:00',
          frequency: (lipseys as any).lipseysCatalogSyncFrequency || 'daily',
          syncStatus: (lipseys as any).lipseysCatalogSyncStatus || 'not_configured',
          lastSync: (lipseys as any).lipseysLastCatalogSync,
          syncError: (lipseys as any).lipseysCatalogSyncError
        }
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Lipsey\'s schedule status error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to get schedule status: ${errorMessage}`
      });
    }
  });

  // Clear sync error - admin only endpoint
  app.post("/api/admin/lipseys/schedule/clear-error", async (req: Request, res: Response) => {
    try {
      const { storage } = await import('./storage.js');
      
      // Get Lipsey's vendor
      const supportedVendors = await storage.getAllSupportedVendors();
      const lipseys = supportedVendors.find(v => v.name.toLowerCase().includes('lipsey'));
      
      if (!lipseys) {
        return res.status(404).json({
          success: false,
          message: 'Lipsey\'s vendor not found'
        });
      }
      
      // Clear the error
      await storage.updateSupportedVendor(lipseys.id, {
        lipseysCatalogSyncError: null,
        lipseysCatalogSyncStatus: 'not_configured'
      });
      
      res.json({
        success: true,
        message: 'Lipsey\'s sync error cleared successfully'
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Lipsey\'s clear error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to clear error: ${errorMessage}`
      });
    }
  });
}








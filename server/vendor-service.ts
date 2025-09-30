import { storage } from './storage';
import type { Vendor } from '@shared/schema';
import { vendorRegistry } from './vendor-registry';

export class VendorService {
  // Check vendor health and update status
  static async checkVendorHealth(vendorId: number): Promise<{
    isHealthy: boolean;
    status: string;
    lastChecked: Date;
    errorMessage?: string;
  }> {
    const vendor = await storage.getVendor(vendorId);
    
    if (!vendor) {
      return {
        isHealthy: false,
        status: 'error',
        lastChecked: new Date(),
        errorMessage: 'Vendor not found'
      };
    }

    // Use vendor registry for connection testing
    try {
      // Get supported vendor to determine the correct vendor identifier
      const supportedVendor = await storage.getSupportedVendor(vendor.supportedVendorId);
      if (!supportedVendor) {
        return {
          success: false,
          errorMessage: 'Supported vendor configuration not found'
        };
      }
      
      const testResult = await vendorRegistry.testVendorConnection(
        supportedVendor.shortCode || supportedVendor.name.toLowerCase().replace(/\s+/g, '_'),
        'store',
        vendor.companyId,
        0
      );
      
      if (testResult.success) {
        await storage.updateVendor(vendorId, {
          connectionStatus: 'online',
          lastUpdate: new Date().toISOString(),
        });
        
        return {
          isHealthy: true,
          status: 'online',
          lastChecked: new Date(),
        };
      } else {
        throw new Error(testResult.message || 'Connection test failed');
      }
    } catch (error: any) {
      await storage.updateVendor(vendorId, {
        connectionStatus: 'error',
        lastUpdate: new Date().toISOString(),
      });
      
      return {
        isHealthy: false,
        status: 'error',
        lastChecked: new Date(),
        errorMessage: error.message || 'Connection failed'
      };
    }



    return {
      isHealthy: false,
      status: 'offline',
      lastChecked: new Date(),
      errorMessage: 'Health check not supported for this vendor'
    };
  }

  // Get vendor integration capabilities (using vendor registry)
  static getVendorCapabilities(vendor: Vendor) {
    return vendorRegistry.getVendorCapabilities(vendor);
  }

  // Validate vendor credentials format (using vendor registry)
  static validateCredentials(vendor: Vendor): {
    isValid: boolean;
    errors: string[];
  } {
    return vendorRegistry.validateCredentials(vendor);
  }

  // Get vendor sync recommendations
  static getSyncRecommendations(vendor: Vendor): {
    shouldSync: boolean;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  } {
    const now = new Date();
    const lastUpdate = vendor.lastUpdate ? new Date(vendor.lastUpdate) : null;
    const hoursSinceUpdate = lastUpdate ? 
      (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60) : 
      Infinity;

    if (!lastUpdate || hoursSinceUpdate > 24) {
      return {
        shouldSync: true,
        reason: 'Catalog data is more than 24 hours old',
        priority: 'high'
      };
    }

    if (hoursSinceUpdate > 12) {
      return {
        shouldSync: true,
        reason: 'Catalog data is more than 12 hours old',
        priority: 'medium'
      };
    }

    if (vendor.connectionStatus === 'error') {
      return {
        shouldSync: true,
        reason: 'Vendor connection is in error state',
        priority: 'high'
      };
    }

    return {
      shouldSync: false,
      reason: 'Catalog data is current',
      priority: 'low'
    };
  }
}
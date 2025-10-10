import { credentialVault } from './credential-vault-service';

export interface VendorHandler {
  vendorId: string; // This is actually the vendor slug (e.g., "gunbroker", "chattanooga")
  vendorSlug?: string; // Explicit slug field for clarity
  vendorName: string;
  apiType: 'rest_api' | 'soap' | 'ftp' | 'excel' | 'custom';
  
  // Connection testing
  testConnection?: (credentials: Record<string, string>) => Promise<{ success: boolean; message: string }>;
  
  // Product operations
  searchProducts?: (credentials: Record<string, string>, searchParams: any) => Promise<any>;
  getProduct?: (credentials: Record<string, string>, productId: string) => Promise<any>;
  
  // Inventory operations
  getInventory?: (credentials: Record<string, string>, productIds?: string[]) => Promise<any>;
  
  // Order operations
  createOrder?: (credentials: Record<string, string>, orderData: any) => Promise<any>;
  getOrderStatus?: (credentials: Record<string, string>, orderId: string) => Promise<any>;
  
  // Catalog sync operations
  syncCatalog?: (credentials: Record<string, string>) => Promise<any>;
  syncInventory?: (credentials: Record<string, string>) => Promise<any>;
}

export class VendorRegistry {
  private handlers: Map<string, VendorHandler> = new Map();
  private initialized = false;

  /**
   * Register a vendor handler
   */
  register(handler: VendorHandler): void {
    this.handlers.set(handler.vendorId.toLowerCase(), handler);
    console.log(`📝 Registered vendor handler: ${handler.vendorName} (${handler.vendorId})`);
  }


  /**
   * Get handler by vendor ID (legacy method - vendorId is actually a slug)
   */
  getHandlerById(vendorId: string): VendorHandler | undefined {
    return this.handlers.get(vendorId.toLowerCase());
  }

  /**
   * Get handler by vendor slug (preferred method)
   */
  getHandlerBySlug(slug: string): VendorHandler | undefined {
    return this.handlers.get(slug.toLowerCase());
  }

  /**
   * Get handler by vendor name (more flexible matching)
   */
  getHandlerByVendorName(vendorName: string): VendorHandler | undefined {
    if (!vendorName) return undefined;
    const normalized = vendorName.toLowerCase();
    
    // Normalize function: treats hyphens and underscores as equivalent
    const normalize = (str: string) => str.toLowerCase().replace(/[-_]/g, '');
    
    // Try exact match first
    let handler = this.handlers.get(normalized);
    if (handler) return handler;

    // Try with normalized hyphens/underscores
    const normalizedKey = normalize(vendorName);
    for (const [key, h] of this.handlers.entries()) {
      if (normalize(key) === normalizedKey) {
        return h;
      }
    }

    // Try partial matching for flexibility
    for (const [key, h] of this.handlers.entries()) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return h;
      }
    }

    // Try matching by handler vendorName
    for (const handler of this.handlers.values()) {
      if (handler.vendorName.toLowerCase().includes(normalized) || 
          normalized.includes(handler.vendorName.toLowerCase())) {
        return handler;
      }
    }

    return undefined;
  }


  /**
   * Get all registered handlers
   */
  getAllHandlers(): VendorHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Check if vendor is supported
   */
  isSupported(vendorId: string): boolean {
    return this.handlers.has(vendorId.toLowerCase());
  }

  /**
   * Initialize all vendor handlers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🚀 Initializing vendor registry...');

    // Register existing vendor handlers
    await this.registerExistingHandlers();

    // Auto-discover new vendor handlers
    await this.autoDiscoverHandlers();

    this.initialized = true;
    console.log(`✅ Vendor registry initialized with ${this.handlers.size} handlers`);
  }

  /**
   * Register existing vendor handlers from your current codebase
   */
  private async registerExistingHandlers(): Promise<void> {
    try {
      // Lipsey's
      const { LipseyAPI } = await import('./lipsey-api');
      this.register({
        vendorId: 'lipseys',
        vendorName: "Lipsey's Inc.",
        apiType: 'rest_api',
        testConnection: async (creds) => {
          const api = new LipseyAPI(creds as any);
          return await api.testConnection();
        },
        searchProducts: async (creds, params) => {
          const api = new LipseyAPI(creds as any);
          return await api.searchProducts(params);
        },
        syncCatalog: async (creds) => {
          const api = new LipseyAPI(creds as any);
          return await api.getAllProducts();
        }
      });

      // Sports South
      const { SportsSouthAPI } = await import('./sports-south-api');
      this.register({
        vendorId: 'sports-south',
        vendorName: 'Sports South',
        apiType: 'rest_api',
        testConnection: async (creds) => {
          const api = new SportsSouthAPI(creds as any);
          return await api.testConnection();
        },
        searchProducts: async (creds, params) => {
          const api = new SportsSouthAPI(creds as any);
          return await api.searchProducts(params);
        },
        syncCatalog: async (creds) => {
          const api = new SportsSouthAPI(creds as any);
          return await api.getAllProducts();
        }
      });

      // Chattanooga
      const { ChattanoogaAPI } = await import('./chattanooga-api');
      this.register({
        vendorId: 'chattanooga',
        vendorName: 'Chattanooga Shooting Supplies Inc.',
        apiType: 'rest_api',
        testConnection: async (creds) => {
          console.log('🔍 CHATTANOOGA STORE DEBUG: Received credentials:', {
            sid: creds.sid ? `${creds.sid.substring(0, 8)}...` : 'MISSING',
            token: creds.token ? `${creds.token.substring(0, 8)}...` : 'MISSING',
            keys: Object.keys(creds || {})
          });
          
          if (!creds.sid || !creds.token) {
            return {
              success: false,
              message: `Missing required credentials: ${!creds.sid ? 'SID' : ''} ${!creds.token ? 'Token' : ''}`.trim()
            };
          }
          
          const api = new ChattanoogaAPI(creds as any);
          return await api.testConnection();
        },
        searchProducts: async (creds, params) => {
          const api = new ChattanoogaAPI(creds as any);
          return await api.searchProducts(params);
        }
      });

      // GunBroker
      const { GunBrokerAPI } = await import('./gunbroker-api');
      this.register({
        vendorId: 'gunbroker',
        vendorName: 'GunBroker.com LLC', // Match exact database name
        apiType: 'rest_api',
        testConnection: async (creds) => {
          const api = new GunBrokerAPI(creds as any);
          return await api.testConnection();
        },
        searchProducts: async (creds, params) => {
          const api = new GunBrokerAPI(creds as any);
          return await api.searchProduct(params);
        }
      });

      // Bill Hicks (FTP)
      this.register({
        vendorId: 'bill-hicks',
        vendorName: 'Bill Hicks & Co.',
        apiType: 'ftp',
        testConnection: async (creds) => {
          // Use the BillHicksAPI testConnection method which now properly tests FTP
          try {
            const { BillHicksAPI } = await import('./bill-hicks-api.js');
            const api = new BillHicksAPI();
            
            // Map credential field names (support both formats)
            const ftpCreds = {
              ftpServer: creds.ftpServer || creds.ftpHost,
              ftpUsername: creds.ftpUsername,
              ftpPassword: creds.ftpPassword,
              ftpPort: parseInt(creds.ftpPort) || 21
            };
            
            console.log('🔍 BILL HICKS FTP TEST: Testing with server:', ftpCreds.ftpServer);
            
            // Pass credentials to testConnection for actual FTP test
            return await api.testConnection(0, ftpCreds);
          } catch (error) {
            return { success: false, message: `FTP connection failed: ${error.message}` };
          }
        }
      });

    } catch (error) {
      console.error('Error registering existing handlers:', error);
    }
  }

  /**
   * Auto-discover vendor handlers from the file system
   */
  private async autoDiscoverHandlers(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const serverDir = path.join(process.cwd(), 'server');
      const files = fs.readdirSync(serverDir);
      
      // Look for *-api.ts files that might be new vendor handlers
      const apiFiles = files.filter(file => 
        file.endsWith('-api.ts') && 
        !['lipsey-api.ts', 'sports-south-api.ts', 'chattanooga-api.ts', 'gunbroker-api.ts', 'bill-hicks-api.ts'].includes(file)
      );

      for (const file of apiFiles) {
        try {
          const vendorName = file.replace('-api.ts', '').replace(/-/g, '_');
          const modulePath = `./${file.replace('.ts', '')}`;
          
          // Try to dynamically import and register
          const module = await import(modulePath);
          
          // Look for common API class patterns
          const apiClass = module[`${this.capitalize(vendorName)}API`] || 
                          module[`${vendorName.toUpperCase()}API`] ||
                          module.default;

          if (apiClass && typeof apiClass === 'function') {
            this.register({
              vendorId: vendorName,
              vendorName: this.formatVendorName(vendorName),
              apiType: 'rest_api',
              testConnection: async (creds) => {
                try {
                  const api = new apiClass(creds);
                  if (api.testConnection) {
                    return await api.testConnection();
                  }
                  return { success: true, message: 'API class loaded (test method not implemented)' };
                } catch (error) {
                  return { success: false, message: `API test failed: ${error.message}` };
                }
              }
            });
          }
        } catch (error) {
          console.warn(`Failed to auto-register ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Auto-discovery failed:', error);
    }
  }

  /**
   * Safely test connection for any vendor
   */
  async testVendorConnection(
    vendorId: string, 
    level: 'admin' | 'store',
    companyId?: number,
    userId?: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const handler = this.getHandlerById(vendorId) || this.getHandlerByVendorName(vendorId);
      
      if (!handler) {
        return { 
          success: false, 
          message: `No handler found for vendor: ${vendorId}. The vendor may need to be registered.` 
        };
      }

      if (!handler.testConnection) {
        return { 
          success: true, 
          message: 'Vendor handler loaded (connection test not implemented)' 
        };
      }

      // Get credentials from vault
      let credentials: Record<string, string> | null;
      
      // Import credential vault
      const { credentialVault } = await import('./credential-vault-service');
      
      if (level === 'admin') {
        console.log(`🔍 VENDOR REGISTRY: Fetching admin credentials for ${vendorId}`);
        credentials = await credentialVault.getAdminCredentials(vendorId, userId || 0);
        console.log(`🔍 VENDOR REGISTRY: Admin credentials result:`, credentials ? 'FOUND' : 'NOT FOUND');
      } else {
        if (!companyId) {
          return { success: false, message: 'Company ID required for store-level testing' };
        }
        console.log(`🔍 VENDOR REGISTRY: Fetching store credentials for ${vendorId}, company ${companyId}`);
        credentials = await credentialVault.getStoreCredentials(vendorId, companyId, userId || 0);
        console.log(`🔍 VENDOR REGISTRY: Store credentials result:`, credentials ? 'FOUND' : 'NOT FOUND');
      }

      if (!credentials) {
        console.warn(`❌ VENDOR REGISTRY: No credentials found for ${vendorId} at ${level} level`);
        return { success: false, message: 'No credentials found' };
      }

      console.log(`🔍 VENDOR REGISTRY: Testing connection with credentials:`, Object.keys(credentials));
      
      // Test the connection
      const result = await handler.testConnection(credentials);
      console.log(`🔍 VENDOR REGISTRY: Connection test result:`, result);
      
      return result;
      
    } catch (error) {
      console.error(`Connection test failed for ${vendorId}:`, error);
      return { 
        success: false, 
        message: `Connection test error: ${error.message}` 
      };
    }
  }

  /**
   * Helper to capitalize vendor names
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Helper to format vendor names for display
   */
  private formatVendorName(vendorId: string): string {
    return vendorId
      .split('_')
      .map(word => this.capitalize(word))
      .join(' ');
  }

  /**
   * Register a new vendor dynamically (for when you add new vendors)
   */
  async registerNewVendor(
    vendorId: string,
    vendorName: string,
    apiType: VendorHandler['apiType'],
    handlerModule?: string
  ): Promise<void> {
    try {
      let handler: VendorHandler = {
        vendorId,
        vendorName,
        apiType
      };

      // If a handler module is provided, try to load it
      if (handlerModule) {
        try {
          const module = await import(handlerModule);
          const apiClass = module.default || module[`${vendorId}API`] || module[`${this.capitalize(vendorId)}API`];
          
          if (apiClass) {
            handler.testConnection = async (creds) => {
              const api = new apiClass(creds);
              return api.testConnection ? await api.testConnection() : 
                { success: true, message: 'Handler loaded (test not implemented)' };
            };
            
            if (apiClass.prototype.searchProducts) {
              handler.searchProducts = async (creds, params) => {
                const api = new apiClass(creds);
                return await api.searchProducts(params);
              };
            }
          }
        } catch (error) {
          console.warn(`Failed to load handler module ${handlerModule}:`, error.message);
        }
      }

      this.register(handler);
      console.log(`✅ Successfully registered new vendor: ${vendorName}`);
      
    } catch (error) {
      console.error(`Failed to register new vendor ${vendorId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const vendorRegistry = new VendorRegistry();
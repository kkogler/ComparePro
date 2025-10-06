import { Express } from 'express';
import { credentialVault } from './credential-vault-service';
import { vendorRegistry } from './vendor-registry';
import { requireAdminAuth, requireOrganizationAccess } from './auth';
import { storage } from './storage';

/**
 * Convert numeric vendor database ID to string vendor identifier for vendor registry
 */
async function getVendorStringId(vendorId: string): Promise<string> {
  try {
    // If it's already a string identifier (not numeric), return as-is
    if (isNaN(Number(vendorId))) {
      return vendorId;
    }

    // First, get the organization vendor record (contains the actual IDs frontend uses)
    const orgVendor = await storage.getVendor(Number(vendorId));
    if (!orgVendor) {
      throw new Error(`Organization vendor not found for ID: ${vendorId}`);
    }

    // Get the supported vendor record using the supportedVendorId
    const supportedVendor = await storage.getSupportedVendor(orgVendor.supportedVendorId!);
    if (!supportedVendor) {
      throw new Error(`Supported vendor not found for supportedVendorId: ${orgVendor.supportedVendorId}`);
    }

    // For credential vault, return the vendor short code (not the full name)
    // The credential vault and vendor registry use short codes for consistency
    const shortCode = supportedVendor.vendorShortCode || supportedVendor.name;
    console.log(`✅ VENDOR MAPPING: ${vendorId} → supportedVendorId:${orgVendor.supportedVendorId} → '${supportedVendor.name}' → shortCode:'${shortCode}'`);
    return shortCode;
  } catch (error) {
    console.error(`❌ Error converting vendor ID ${vendorId}:`, error);
    throw error;
  }
}

/**
 * Register credential management routes
 * These routes provide a unified, extensible API for managing vendor credentials
 */
export function registerCredentialManagementRoutes(app: Express): void {
  
  // ====== ADMIN-LEVEL CREDENTIAL ROUTES ======

  /**
   * Get vendor credential schema (what fields are needed)
   */
  app.get('/api/admin/vendors/:vendorId/credential-schema', requireAdminAuth, async (req, res) => {
    try {
      const { vendorId } = req.params;
      
      const schema = await credentialVault.getVendorSchema(vendorId);
      if (!schema) {
        return res.status(404).json({ 
          success: false, 
          message: `No credential schema found for vendor: ${vendorId}` 
        });
      }

      res.json({
        success: true,
        schema
      });
    } catch (error: any) {
      console.error('Failed to get credential schema:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to get credential schema: ${error.message}` 
      });
    }
  });

  /**
   * Store admin-level credentials for a vendor
   */
  app.post('/api/admin/vendors/:vendorId/credentials', requireAdminAuth, async (req, res) => {
    try {
      const { vendorId } = req.params;
      const credentials = req.body.credentials || req.body; // Support both formats
      const userId = (req as any).user?.id || 0;
      const auditInfo = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      console.log('🔍 ADMIN CREDENTIALS: VendorId:', vendorId);
      console.log('🔍 ADMIN CREDENTIALS: Credentials keys:', Object.keys(credentials || {}));

      await credentialVault.storeAdminCredentials(vendorId, credentials, userId, auditInfo);

      res.json({
        success: true,
        message: `Admin credentials stored successfully for ${vendorId}`
      });
    } catch (error: any) {
      console.error('Failed to store admin credentials:', error);
      res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  /**
   * Test admin-level connection for a vendor
   */
  app.post('/api/admin/vendors/:vendorId/test-connection', requireAdminAuth, async (req, res) => {
    try {
      const { vendorId } = req.params;
      const userId = (req as any).user?.id || 0;

      console.log(`🔍 ADMIN TEST CONNECTION: Starting test for vendor: ${vendorId}, userId: ${userId}`);
      
      // Verify the vendor exists first
      const supportedVendor = await storage.getSupportedVendorByName(vendorId);
      if (!supportedVendor) {
        console.error(`❌ ADMIN TEST CONNECTION: Vendor not found: ${vendorId}`);
        return res.status(404).json({
          success: false,
          status: 'error',
          message: `Vendor not found: ${vendorId}. Please check the vendor configuration.`
        });
      }
      
      const result = await vendorRegistry.testVendorConnection(vendorId, 'admin', undefined, userId);
      
      console.log(`🔍 ADMIN TEST CONNECTION: Result for ${vendorId}:`, {
        success: result.success,
        message: result.message
      });

      // Update the vendor's admin connection status in the database
      try {
        await storage.updateSupportedVendor(supportedVendor.id, {
          adminConnectionStatus: result.success ? 'online' : 'error'
        });
      } catch (updateError) {
        console.warn('Failed to update admin connection status:', updateError);
      }

      if (result.success) {
        res.json({
          success: true,
          status: 'connected',
          message: result.message
        });
      } else {
        console.error(`❌ ADMIN TEST CONNECTION: Failed for ${vendorId}: ${result.message}`);
        res.status(400).json({
          success: false,
          status: 'error',
          message: result.message
        });
      }
    } catch (error: any) {
      console.error(`❌ ADMIN CONNECTION TEST: Exception for vendor ${req.params.vendorId}:`, error);
      res.status(500).json({ 
        success: false, 
        status: 'error',
        message: `Connection test failed: ${error.message}` 
      });
    }
  });

  /**
   * Get redacted admin credentials for display
   */
  app.get('/api/admin/vendors/:vendorId/credentials', requireAdminAuth, async (req, res) => {
    try {
      const { vendorId } = req.params;

      const credentials = await credentialVault.getRedactedCredentials(vendorId, 'admin');
      
      res.json({
        success: true,
        credentials: credentials || {}
      });
    } catch (error: any) {
      console.error('Failed to get admin credentials:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to retrieve credentials: ${error.message}` 
      });
    }
  });

  // ====== STORE-LEVEL CREDENTIAL ROUTES ======

  /**
   * Get vendor credential schema for store users (what fields are needed)
   */
  app.get('/org/:slug/api/vendors/:vendorSlug/credential-schema', requireOrganizationAccess, async (req, res) => {
    try {
      const { vendorSlug } = req.params;
      
      // Use vendor slug directly - no conversion needed
      const stringVendorId = vendorSlug;
      
      const schema = await credentialVault.getVendorSchema(stringVendorId);
      if (!schema) {
        return res.status(404).json({ 
          success: false, 
          message: `No credential schema found for vendor: ${stringVendorId}` 
        });
      }

      res.json({
        success: true,
        schema
      });
    } catch (error: any) {
      console.error('Failed to get store credential schema:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to get credential schema: ${error.message}` 
      });
    }
  });

  /**
   * Store store-level credentials for a vendor
   */
  app.post('/org/:slug/api/vendors/:vendorSlug/credentials', requireOrganizationAccess, async (req, res) => {
    try {
      const { vendorSlug } = req.params;
      const credentials = req.body.credentials || req.body; // Support both formats
      const companyId = (req as any).organizationId;
      const userId = (req as any).user?.id || 0;
      const auditInfo = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      // Use vendor slug directly - no conversion needed
      const stringVendorId = vendorSlug;
      console.log(`🔄 CREDENTIAL SAVE: Using vendor slug ${stringVendorId}`);
      
      // Special case: GunBroker uses admin-level shared credentials for all stores
      // Match both 'gunbroker' and 'gunbroker-123' patterns
      if (stringVendorId.toLowerCase().startsWith('gunbroker')) {
        console.log(`🔍 CREDENTIAL SAVE: GunBroker detected, rejecting store-level credential save`);
        return res.json({
          success: true,
          message: 'GunBroker uses shared admin credentials. No store-level configuration needed.'
        });
      }
      
      // Enhanced debugging for Chattanooga credentials
      if (stringVendorId.toLowerCase().includes('chattanooga')) {
        console.log('🔍 CHATTANOOGA CREDENTIAL SAVE DEBUG:');
        console.log('  - Raw request body:', JSON.stringify(req.body, null, 2));
        console.log('  - Extracted credentials:', JSON.stringify(credentials, null, 2));
        console.log('  - SID value:', credentials.sid);
        console.log('  - Token value:', credentials.token ? `${credentials.token.substring(0, 8)}...` : 'MISSING');
        console.log('  - Company ID:', companyId);
        console.log('  - User ID:', userId);
      }

      // Enhanced debugging for Sports South credentials
      if (stringVendorId.toLowerCase().includes('sports') && stringVendorId.toLowerCase().includes('south')) {
        console.log('🔍 SPORTS SOUTH CREDENTIAL SAVE DEBUG:');
        console.log('  - Raw request body:', JSON.stringify(req.body, null, 2));
        console.log('  - Extracted credentials:', JSON.stringify(credentials, null, 2));
        console.log('  - Company ID:', companyId);
        console.log('  - User ID:', userId);
      }

      // Enhanced debugging for Bill Hicks credentials
      if (stringVendorId.toLowerCase().includes('bill') && stringVendorId.toLowerCase().includes('hicks')) {
        console.log('🔍 BILL HICKS CREDENTIAL SAVE DEBUG:');
        console.log('  - Raw request body:', JSON.stringify(req.body, null, 2));
        console.log('  - Extracted credentials:', JSON.stringify(credentials, null, 2));
        console.log('  - ftp_base_path value:', credentials.ftp_base_path);
        console.log('  - Company ID:', companyId);
        console.log('  - User ID:', userId);
      }

      // Field name validation and mapping for Sports South
      if (stringVendorId.toLowerCase().includes('sports') && stringVendorId.toLowerCase().includes('south')) {
        console.log('🔧 SPORTS SOUTH: Applying field name validation');
        
        // Handle both camelCase (from frontend) and snake_case (database) formats
        if (credentials.userName && !credentials.user_name) {
          console.log('🔧 SPORTS SOUTH: Mapping userName → user_name');
          credentials.user_name = credentials.userName;
          delete credentials.userName;
        }
        if (credentials.customerNumber && !credentials.customer_number) {
          console.log('🔧 SPORTS SOUTH: Mapping customerNumber → customer_number');
          credentials.customer_number = credentials.customerNumber;
          delete credentials.customerNumber;
        }
        
        console.log('🔧 SPORTS SOUTH: Final credentials after mapping:', Object.keys(credentials));
      }

      await credentialVault.storeStoreCredentials(stringVendorId, companyId, credentials, userId, auditInfo);

      res.json({
        success: true,
        message: `Store credentials saved successfully for ${stringVendorId}`
      });
    } catch (error: any) {
      console.error('Failed to store store credentials:', error);
      res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  /**
   * Test store-level connection for a vendor
   */
  app.post('/org/:slug/api/vendors/:vendorSlug/test-connection-alt', requireOrganizationAccess, async (req, res) => {
    try {
      const { vendorSlug } = req.params;
      const companyId = (req as any).organizationId;
      const userId = (req as any).user?.id || 0;

      // Use vendor slug directly - no conversion needed
      const stringVendorId = vendorSlug;
      console.log(`🔄 CONNECTION TEST: Using vendor slug ${stringVendorId}`);

      // Special case: GunBroker uses admin-level shared credentials for all stores
      // Match both 'gunbroker' and 'gunbroker-123' patterns
      if (stringVendorId.toLowerCase().startsWith('gunbroker')) {
        console.log(`🔍 CONNECTION TEST: GunBroker detected, using admin credentials`);
        const result = await vendorRegistry.testVendorConnection('gunbroker', 'admin', undefined, userId);
        return res.status(result.success ? 200 : 400).json({
          success: result.success,
          status: result.success ? 'connected' : 'error',
          message: result.message
        });
      }

      const result = await vendorRegistry.testVendorConnection(stringVendorId, 'store', companyId, userId);

      if (result.success) {
        res.json({
          success: true,
          status: 'connected',
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          status: 'error',
          message: result.message
        });
      }
    } catch (error: any) {
      console.error('Store connection test failed:', error);
      res.status(500).json({ 
        success: false, 
        status: 'error',
        message: `Connection test failed: ${error.message}` 
      });
    }
  });

  /**
   * Get redacted store credentials for display
   */
  app.get('/org/:slug/api/vendors/:vendorSlug/credentials', requireOrganizationAccess, async (req, res) => {
    try {
      const { vendorSlug } = req.params;
      const companyId = (req as any).organizationId;
      // Use vendor slug directly - no conversion needed
      const stringVendorId = vendorSlug;
      
      // Special case: GunBroker uses admin-level shared credentials for all stores
      // Match both 'gunbroker' and 'gunbroker-123' patterns
      let credentials;
      if (stringVendorId.toLowerCase().startsWith('gunbroker')) {
        console.log(`🔍 GET CREDENTIALS: GunBroker detected, fetching admin credentials`);
        credentials = await credentialVault.getRedactedCredentials('gunbroker', 'admin');
      } else {
        credentials = await credentialVault.getRedactedCredentials(stringVendorId, 'store', companyId);
      }
      
      res.json({
        success: true,
        credentials: credentials || {}
      });
    } catch (error: any) {
      console.error('Failed to get store credentials:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to retrieve credentials: ${error.message}` 
      });
    }
  });

  // ====== VENDOR DISCOVERY & MANAGEMENT ROUTES ======

  /**
   * Get all configured vendors with their status
   */
  app.get('/api/admin/vendors/configured', requireAdminAuth, async (req, res) => {
    try {
      const vendors = await credentialVault.getConfiguredVendors();
      
      res.json({
        success: true,
        vendors
      });
    } catch (error: any) {
      console.error('Failed to get configured vendors:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to get configured vendors: ${error.message}` 
      });
    }
  });

  /**
   * Get all available vendor handlers
   */
  app.get('/api/admin/vendors/handlers', requireAdminAuth, async (req, res) => {
    try {
      const handlers = vendorRegistry.getAllHandlers();
      
      res.json({
        success: true,
        handlers: handlers.map(h => ({
          vendorId: h.vendorId,
          vendorName: h.vendorName,
          apiType: h.apiType,
          capabilities: {
            testConnection: !!h.testConnection,
            searchProducts: !!h.searchProducts,
            getInventory: !!h.getInventory,
            createOrder: !!h.createOrder,
            syncCatalog: !!h.syncCatalog
          }
        }))
      });
    } catch (error: any) {
      console.error('Failed to get vendor handlers:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to get vendor handlers: ${error.message}` 
      });
    }
  });

  /**
   * Register a new vendor handler dynamically
   */
  app.post('/api/admin/vendors/register', requireAdminAuth, async (req, res) => {
    try {
      const { vendorId, vendorName, apiType, handlerModule } = req.body;

      if (!vendorId || !vendorName || !apiType) {
        return res.status(400).json({
          success: false,
          message: 'vendorId, vendorName, and apiType are required'
        });
      }

      await vendorRegistry.registerNewVendor(vendorId, vendorName, apiType, handlerModule);

      res.json({
        success: true,
        message: `Successfully registered new vendor: ${vendorName}`
      });
    } catch (error: any) {
      console.error('Failed to register new vendor:', error);
      res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // ====== CREDENTIAL HEALTH & MONITORING ======

  /**
   * Get credential health status across all vendors
   */
  app.get('/api/admin/credentials/health', requireAdminAuth, async (req, res) => {
    try {
      const vendors = await credentialVault.getConfiguredVendors();
      const health = [];

      for (const vendor of vendors) {
        const adminStatus = vendor.hasAdminCredentials ? 'configured' : 'missing';
        const storeStatus = vendor.storeCount > 0 ? `${vendor.storeCount} stores configured` : 'no stores configured';
        
        health.push({
          vendorId: vendor.vendorId,
          vendorName: vendor.vendorName,
          adminCredentials: {
            status: adminStatus,
            connectionStatus: vendor.adminConnectionStatus
          },
          storeCredentials: {
            status: storeStatus,
            count: vendor.storeCount
          }
        });
      }

      res.json({
        success: true,
        health,
        summary: {
          totalVendors: vendors.length,
          vendorsWithAdminCreds: vendors.filter(v => v.hasAdminCredentials).length,
          totalStoreCredentials: vendors.reduce((sum, v) => sum + v.storeCount, 0)
        }
      });
    } catch (error: any) {
      console.error('Failed to get credential health:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to get credential health: ${error.message}` 
      });
    }
  });

  /**
   * Debug endpoint for credential troubleshooting
   */
  app.get('/org/:slug/api/vendors/:vendorSlug/credentials/debug', requireOrganizationAccess, async (req, res) => {
    try {
      const { vendorSlug } = req.params;
      const companyId = (req as any).organizationId;
      
      console.log(`🔍 CREDENTIAL DEBUG: Starting debug for vendor ${vendorSlug}, company ${companyId}`);
      
      const stringVendorId = vendorSlug;
      console.log(`🔍 CREDENTIAL DEBUG: Converted to string vendor ID: ${stringVendorId}`);
      
      const supportedVendor = await storage.getSupportedVendorByName(stringVendorId);
      
      if (!supportedVendor) {
        return res.status(404).json({ 
          success: false, 
          message: 'Vendor not found',
          debug: {
            originalVendorSlug: vendorSlug,
            stringVendorId,
            supportedVendorFound: false
          }
        });
      }
      
      // Get raw credentials from database
      const rawCreds = await storage.getCompanyVendorCredentials(companyId, supportedVendor.id);
      
      // Get schema
      const schema = await credentialVault.getVendorSchema(stringVendorId);
      
      // Get processed credentials (this will show if filtering is working)
      const processedCreds = await credentialVault.getStoreCredentials(stringVendorId, companyId, 0);
      
      console.log(`🔍 CREDENTIAL DEBUG: Results for ${stringVendorId}:`, {
        hasRawCredentials: !!rawCreds,
        hasSchema: !!schema,
        hasProcessedCredentials: !!processedCreds,
        rawFields: Object.keys(rawCreds || {}),
        schemaFields: schema?.storeCredentials?.map(f => f.name) || [],
        processedFields: Object.keys(processedCreds || {})
      });
      
      res.json({
        success: true,
        debug: {
          vendorInfo: {
            originalVendorSlug: vendorSlug,
            stringVendorId,
            supportedVendorId: supportedVendor.id,
            vendorName: supportedVendor.name,
            vendorShortCode: supportedVendor.vendorShortCode
          },
          credentials: {
            hasRawCredentials: !!rawCreds,
            hasProcessedCredentials: !!processedCreds,
            rawCredentialsFields: Object.keys(rawCreds || {}),
            processedCredentialsFields: Object.keys(processedCreds || {}),
            rawCredentialsCount: Object.keys(rawCreds || {}).length,
            processedCredentialsCount: Object.keys(processedCreds || {}).length
          },
          schema: {
            hasSchema: !!schema,
            schemaFields: schema?.storeCredentials?.map(f => f.name) || [],
            schemaFieldCount: schema?.storeCredentials?.length || 0,
            authenticationMethod: schema?.authenticationMethod || 'unknown'
          },
          analysis: {
            credentialsSaveWorking: !!rawCreds,
            credentialsRetrievalWorking: !!processedCreds,
            schemaExists: !!schema,
            fieldMismatchDetected: !!rawCreds && !processedCreds,
            recommendation: !!rawCreds && !processedCreds 
              ? 'Credentials exist in database but cannot be retrieved - likely field name mismatch'
              : !!rawCreds && !!processedCreds
              ? 'Credentials working correctly'
              : !rawCreds
              ? 'No credentials found - need to save credentials first'
              : 'Unknown issue'
          }
        }
      });
    } catch (error: any) {
      console.error('❌ CREDENTIAL DEBUG ERROR:', error);
      res.status(500).json({ 
        success: false, 
        message: `Debug failed: ${error.message}`,
        debug: {
          error: error.message,
          stack: error.stack
        }
      });
    }
  });

  console.log('✅ Credential management routes registered');
}

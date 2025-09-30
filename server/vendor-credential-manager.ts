import { storage } from './storage';
import type { Vendor } from '@shared/schema';
import { credentialVault } from './credential-vault-service';
import { vendorRegistry } from './vendor-registry';

type AnyRecord = Record<string, any>;

interface VendorCredentialMapping {
  toDb: (formCreds: AnyRecord) => AnyRecord;
  toFrontend: (dbCreds: AnyRecord) => AnyRecord;
  toApi: (creds: AnyRecord) => AnyRecord;
  redact: (creds: AnyRecord) => AnyRecord;
}

const chattanoogaMapping: VendorCredentialMapping = {
  // Map frontend form to DB columns without renaming existing DB fields
  toDb: (f) => ({
    sid: f?.sid || '',
    token: f?.token || '',
    accountNumber: f?.accountNumber || '',
    username: f?.username || '',
    // DB uses chattanoogaPassword
    chattanoogaPassword: f?.password || ''
  }),
  // Map DB rows back to frontend shape
  toFrontend: (d) => ({
    sid: d?.sid || '',
    token: d?.token || '',
    accountNumber: d?.accountNumber || '',
    username: d?.username || '',
    password: d?.chattanoogaPassword || ''
  }),
  // Normalize for vendor API/registry usage
  toApi: (c) => ({
    sid: c?.sid || '',
    token: c?.token || '',
    accountNumber: c?.accountNumber || '',
    username: c?.username || '',
    password: c?.password || c?.chattanoogaPassword || ''
  }),
  // Redact sensitive fields for logs
  redact: (c) => ({
    sid: c?.sid ? `${String(c.sid).slice(0, 4)}…` : 'MISSING',
    token: c?.token ? `${String(c.token).slice(0, 4)}…` : 'MISSING',
    accountNumber: c?.accountNumber ? 'SET' : 'MISSING',
    username: c?.username ? 'SET' : 'MISSING',
    password: c?.password || c?.chattanoogaPassword ? 'SET' : 'MISSING'
  })
};

export class VendorCredentialManager {
  constructor(private featureFlags: { chattanooga: boolean; useNewVault: boolean }) {
    // Initialize vendor registry on first use
    this.initializeRegistry();
  }

  private async initializeRegistry(): Promise<void> {
    try {
      await vendorRegistry.initialize();
    } catch (error) {
      console.error('Failed to initialize vendor registry:', error);
    }
  }

  private isChattanooga(vendorName: string): boolean {
    return vendorName.toLowerCase().includes('chattanooga');
  }

  /**
   * Load store-level credentials for a vendor
   * Uses new credential vault system only - NO LEGACY FALLBACKS
   */
  async load(companyId: number, supportedVendorId: number, vendorName: string): Promise<AnyRecord | null> {
    // Use new credential vault system exclusively - NO LEGACY FALLBACKS
    console.log(`🔍 CREDENTIAL LOAD: Using NEW vault system for ${vendorName}, company ${companyId}`);
    const credentials = await credentialVault.getStoreCredentials(vendorName, companyId, 0);
    console.log(`🔍 CREDENTIAL LOAD: Vault result:`, credentials ? 'FOUND' : 'NOT FOUND');
    return credentials;
  }

  /**
   * Save store-level credentials for a vendor
   * Uses new credential vault system only - NO LEGACY FALLBACKS
   */
  async save(companyId: number, vendor: Vendor, formCreds: AnyRecord, userId: number = 0): Promise<void> {
    // Use new credential vault system exclusively - NO LEGACY FALLBACKS
    console.log(`💾 CREDENTIAL SAVE: Using NEW vault system for ${vendor.name}, company ${companyId}`);
    await credentialVault.storeStoreCredentials(vendor.name, companyId, formCreds, userId);
    console.log(`💾 CREDENTIAL SAVE: Successfully saved to vault`);
  }

  /**
   * Convert credentials to API format for vendor handlers
   */
  toApiCredentials(vendorName: string, creds: AnyRecord): AnyRecord {
    if (this.featureFlags.chattanooga && this.isChattanooga(vendorName)) {
      return chattanoogaMapping.toApi(creds);
    }
    return creds;
  }

  /**
   * Redact sensitive information for logging
   */
  redactForLogs(vendorName: string, creds: AnyRecord): AnyRecord {
    // Use new credential vault redaction if available
    if (this.featureFlags.useNewVault) {
      try {
        // The vault service handles redaction internally
        return { status: 'credentials_set', vendor: vendorName };
      } catch (error) {
        console.error('Vault redaction failed:', error);
      }
    }

    // Legacy redaction
    if (this.featureFlags.chattanooga && this.isChattanooga(vendorName)) {
      return chattanoogaMapping.redact(creds);
    }
    
    // Generic redaction
    const clone = { ...creds };
    for (const k of Object.keys(clone)) {
      if (/(pass|token|secret|key)/i.test(k)) {
        clone[k] = clone[k] ? 'SET' : 'MISSING';
      }
    }
    return clone;
  }

  /**
   * Test connection for any vendor using the registry
   */
  async testConnection(
    vendorName: string, 
    level: 'admin' | 'store', 
    companyId?: number,
    userId?: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Use vendor registry for unified connection testing
      return await vendorRegistry.testVendorConnection(vendorName, level, companyId, userId);
    } catch (error) {
      console.error(`Connection test failed for ${vendorName}:`, error);
      return { success: false, message: `Connection test error: ${error.message}` };
    }
  }

  /**
   * Get supported vendors with their credential schemas
   */
  async getSupportedVendors(): Promise<Array<{
    vendorId: string;
    vendorName: string;
    hasHandler: boolean;
    credentialSchema?: any;
  }>> {
    try {
      const supportedVendors = await storage.getAllSupportedVendors();
      const handlers = vendorRegistry.getAllHandlers();
      
      return supportedVendors.map(vendor => ({
        vendorId: vendor.name,
        vendorName: vendor.name,
        hasHandler: handlers.some(h => 
          h.vendorId.toLowerCase() === vendor.name.toLowerCase() ||
          h.vendorName.toLowerCase().includes(vendor.name.toLowerCase())
        ),
        credentialSchema: vendor.credentialFields
      }));
    } catch (error) {
      console.error('Failed to get supported vendors:', error);
      return [];
    }
  }
}

export function createVendorCredentialManager() {
  const flags = {
    chattanooga: String(process.env.FEATURE_VCM_CHATTANOOGA || 'true').toLowerCase() === 'true',
    useNewVault: String(process.env.FEATURE_NEW_CREDENTIAL_VAULT || 'false').toLowerCase() === 'true'
  };
  return new VendorCredentialManager(flags);
}












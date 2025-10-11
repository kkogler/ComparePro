/**
 * ============================================================================
 * VENDOR CREDENTIAL VAULT SERVICE
 * ============================================================================
 * 
 * ⚠️  CRITICAL POLICY: NO ENCRYPTION - PLAIN TEXT STORAGE ONLY ⚠️
 * 
 * All vendor credentials (passwords, API keys, tokens) are stored as PLAIN TEXT
 * in the database. NO ENCRYPTION is used or should be added.
 * 
 * WHY PLAIN TEXT?
 * - Prevents password corruption from lost/changed encryption keys
 * - Ensures consistent, reliable credential storage across deployments
 * - Simplifies debugging and verification
 * - Avoids multi-tenant encryption key management complexity
 * 
 * SECURITY:
 * - Database access should be properly restricted
 * - Use database-level encryption at rest if required
 * - Network-level security (VPN, private networks)
 * - API access controlled with proper authentication
 * 
 * DO NOT:
 * ❌ Add encryption logic to this file
 * ❌ Set CREDENTIAL_ENCRYPTION_KEY environment variable
 * ❌ Use crypto.createCipheriv() or similar encryption
 * ❌ Use bcrypt/scrypt for vendor passwords (those are for user passwords only)
 * 
 * SEE: VENDOR_PASSWORD_POLICY.md for complete documentation
 * ============================================================================
 */

import crypto from 'crypto';
import { storage } from './storage';

// Credential types that vendors can use
export type CredentialFieldType = 
  | 'text' 
  | 'password' 
  | 'email' 
  | 'url' 
  | 'number' 
  | 'apiKey' 
  | 'secret' 
  | 'token'
  | 'certificate'
  | 'privateKey';

export interface CredentialField {
  name: string;
  label: string;
  type: CredentialFieldType;
  required: boolean;
  encrypted: boolean; // Legacy field - no longer used (all fields stored as plain text)
  placeholder?: string;
  description?: string;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string; // regex pattern
  };
}

export interface VendorCredentialSchema {
  vendorId: string;
  vendorName: string;
  adminCredentials: CredentialField[];
  storeCredentials: CredentialField[];
  connectionTestEndpoint?: string;
  authenticationMethod: 'basic' | 'oauth2' | 'apiKey' | 'custom';
}

export interface CredentialSet {
  id?: string;
  vendorId: string;
  level: 'admin' | 'store';
  companyId?: number; // null for admin-level credentials
  credentials: Record<string, string>;
  encrypted: boolean; // Legacy field - no longer used
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
  status: 'active' | 'expired' | 'revoked' | 'pending_rotation';
}

export interface AuditLogEntry {
  id: string;
  action: 'created' | 'updated' | 'accessed' | 'deleted' | 'rotated' | 'test_connection';
  vendorId: string;
  level: 'admin' | 'store';
  companyId?: number;
  userId: number;
  timestamp: Date;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class CredentialVaultService {
  constructor() {
    // No encryption - credentials stored as plain text for reliability
    console.log('✅ CREDENTIAL VAULT: Using plain text storage (no encryption)');
  }

  // Encryption/decryption methods removed - using plain text storage for reliability

  /**
   * Get vendor credential schema - defines what credentials are needed
   */
  async getVendorSchema(vendorId: string): Promise<VendorCredentialSchema | null> {
    try {
      console.log('🔍 SCHEMA LOOKUP: Looking up vendor schema for:', vendorId);
      const supportedVendor = await storage.getSupportedVendorByName(vendorId);
      console.log('🔍 SCHEMA LOOKUP: Found vendor:', supportedVendor ? supportedVendor.name : 'NOT FOUND');
      
      if (!supportedVendor || !supportedVendor.credentialFields) {
        console.log('🔍 SCHEMA LOOKUP: No vendor or credential fields found');
        return null;
      }

      // Convert existing credentialFields to our new schema format
      let adminFields: CredentialField[] = supportedVendor.credentialFields.map(field => ({
        ...field,
        encrypted: false // No encryption - all fields stored as plain text
      }));

      // For store credentials, default to a subset of admin fields
      // and apply vendor-specific overrides where necessary
      let storeFields: CredentialField[] = adminFields.filter(field =>
        !['adminApiKey', 'masterKey', 'systemToken'].includes(field.name.toLowerCase())
      );

      // Vendor-specific field overrides
      const vendorNameNormalized = (supportedVendor.name || '').toLowerCase();
      
      // Chattanooga store-level creds require only SID and Token
      if (vendorNameNormalized.includes('chattanooga')) {
        const sidField: CredentialField = {
          name: 'sid',
          label: 'SID',
          type: 'text',
          required: true,
          encrypted: false // No encryption
        };
        const tokenField: CredentialField = {
          name: 'token',
          label: 'Token',
          type: 'token',
          required: true,
          encrypted: false // No encryption
        };
        storeFields = [sidField, tokenField];
      }
      
      // Bill Hicks field name mapping: Ensure consistency between admin/store
      if (vendorNameNormalized.includes('bill') && vendorNameNormalized.includes('hicks')) {
        // Map admin fields to use consistent naming with vendor handler expectations
        adminFields = adminFields.map(field => {
          const normalizedName = field.name.toLowerCase().replace(/_/g, '');
          if (normalizedName === 'ftphost' || normalizedName === 'ftpserver') {
            return { ...field, name: 'ftpServer' }; // Keep as ftpServer (matches database)
          }
          if (normalizedName === 'ftpusername') {
            return { ...field, name: 'ftpUsername' };
          }
          if (normalizedName === 'ftppassword') {
            return { ...field, name: 'ftpPassword' };
          }
          if (normalizedName === 'ftpport') {
            return { ...field, name: 'ftpPort' };
          }
          if (normalizedName === 'ftpbasepath') {
            return { ...field, name: 'ftpBasePath' };
          }
          return field;
        });
        
        // Map store fields to match database schema (ftp_server, not ftpHost)
        storeFields = storeFields.map(field => {
          const normalizedName = field.name.toLowerCase().replace(/_/g, '');
          if (normalizedName === 'ftphost' || normalizedName === 'ftpserver') {
            return { ...field, name: 'ftp_server' }; // Use ftp_server for store (matches DB column)
          }
          if (normalizedName === 'ftpusername') {
            return { ...field, name: 'ftp_username' };
          }
          if (normalizedName === 'ftppassword') {
            return { ...field, name: 'ftp_password' };
          }
          if (normalizedName === 'ftpport') {
            return { ...field, name: 'ftp_port' };
          }
          if (normalizedName === 'ftpbasepath') {
            return { ...field, name: 'ftp_base_path' };
          }
          return field;
        });
      }

      return {
        vendorId: supportedVendor.name,
        vendorName: supportedVendor.name,
        adminCredentials: adminFields,
        storeCredentials: storeFields,
        authenticationMethod: this.determineAuthMethod(adminFields)
      };
    } catch (error) {
      console.error('Failed to get vendor schema:', error);
      return null;
    }
  }

  // shouldEncryptField method removed - no encryption used

  /**
   * Determine authentication method based on credential fields
   */
  private determineAuthMethod(fields: CredentialField[]): 'basic' | 'oauth2' | 'apiKey' | 'custom' {
    const fieldNames = fields.map(f => f.name.toLowerCase());
    
    if (fieldNames.includes('apikey') || fieldNames.includes('api_key')) {
      return 'apiKey';
    }
    if (fieldNames.includes('clientid') && fieldNames.includes('clientsecret')) {
      return 'oauth2';
    }
    if (fieldNames.includes('username') && fieldNames.includes('password')) {
      return 'basic';
    }
    return 'custom';
  }

  /**
   * Store admin-level credentials (system-wide)
   */
  async storeAdminCredentials(
    vendorId: string,
    credentials: Record<string, string>,
    userId: number,
    auditInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    try {
      console.log('🔍 CREDENTIAL VAULT: Storing admin credentials for:', vendorId);
      console.log('🔍 CREDENTIAL VAULT: Credentials received:', Object.keys(credentials || {}));
      
      const schema = await this.getVendorSchema(vendorId);
      if (!schema) {
        throw new Error(`No credential schema found for vendor: ${vendorId}`);
      }

      console.log('🔍 CREDENTIAL VAULT: Schema admin fields:', schema.adminCredentials.map(f => f.name));

      // Get existing vendor to check for existing credentials
      const supportedVendor = await storage.getSupportedVendorByName(vendorId);
      if (!supportedVendor) {
        throw new Error(`Vendor not found: ${vendorId}`);
      }

      const existingCredentials = supportedVendor.adminCredentials || {};
      const isPartialUpdate = Object.keys(existingCredentials).length > 0 && Object.keys(credentials).length < schema.adminCredentials.length;
      
      console.log('🔍 CREDENTIAL VAULT: Existing credentials:', Object.keys(existingCredentials));
      console.log('🔍 CREDENTIAL VAULT: Is partial update:', isPartialUpdate);

      // Merge with existing credentials for partial updates
      const mergedCredentials = { ...existingCredentials, ...credentials };

      // For partial updates, only validate the merged result (not just the incoming fields)
      // This allows updating just one field without requiring all fields again
      if (isPartialUpdate) {
        console.log('🔍 CREDENTIAL VAULT: Performing partial update - validating merged credentials');
        this.validateCredentials(mergedCredentials, schema.adminCredentials);
      } else {
        // For new credentials, validate the incoming fields
        console.log('🔍 CREDENTIAL VAULT: Performing full update - validating incoming credentials');
        this.validateCredentials(credentials, schema.adminCredentials);
      }

      // Process credentials (no encryption)
      const processedCredentials = this.processCredentials(mergedCredentials, schema.adminCredentials);

      // Store in database
      await storage.updateSupportedVendor(supportedVendor.id, {
        adminCredentials: processedCredentials,
        adminConnectionStatus: 'pending_test'
      });

      // Audit log
      await this.logCredentialAccess({
        action: 'created',
        vendorId,
        level: 'admin',
        userId,
        timestamp: new Date(),
        details: { fieldsUpdated: Object.keys(credentials) },
        ...auditInfo
      });

      console.log(`✅ Admin credentials stored for vendor: ${vendorId}`);
    } catch (error) {
      console.error('Failed to store admin credentials:', error);
      throw error;
    }
  }

  /**
   * Store store-level credentials (company-specific)
   */
  async storeStoreCredentials(
    vendorId: string,
    companyId: number,
    credentials: Record<string, string>,
    userId: number,
    auditInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    try {
      const schema = await this.getVendorSchema(vendorId);
      if (!schema) {
        throw new Error(`No credential schema found for vendor: ${vendorId}`);
      }

      // Load existing stored credentials to support masked placeholders on update
      const supportedVendor = await storage.getSupportedVendorByName(vendorId);
      if (!supportedVendor) {
        throw new Error(`Vendor not found: ${vendorId}`);
      }

      const existing = await storage.getCompanyVendorCredentials(companyId, supportedVendor.id).catch(() => null);

      // ✅ FIX: Apply field aliases to existing credentials BEFORE merging
      // This ensures existing credentials use the same field names as the schema
      const existingWithAliases = existing ? await this.applyFieldAliases(vendorId, existing) : null;

      // Merge incoming credentials with existing ones (preserve existing values if masked)
      const merged: Record<string, string> = { ...(existingWithAliases || {}) };
      
      console.log('🔍 CREDENTIAL MERGE DEBUG:', {
        vendorId,
        schemaFieldNames: schema.storeCredentials.map(f => f.name),
        incomingKeys: Object.keys(credentials),
        existingKeys: Object.keys(existing || {}),
        existingWithAliasesKeys: Object.keys(existingWithAliases || {})
      });
      
      for (const field of schema.storeCredentials) {
        const incoming = credentials[field.name];
        // ✅ FIX: Safely check for masked value with proper type checking
        const incomingStr = typeof incoming === 'string' ? incoming : String(incoming || '');
        const isMasked = incomingStr.trim().startsWith('•');
        
        console.log(`🔍 FIELD MERGE: ${field.name}`, {
          incoming: incomingStr ? `${incomingStr.substring(0, 2)}...` : 'NONE',
          isMasked,
          willUseExisting: incoming === undefined || incoming === null || (incoming === '' || isMasked)
        });
        
        if (incoming === undefined || incoming === null || (incoming === '' || isMasked)) {
          // Preserve existing value (if any) - use aliased existing credentials
          if (existingWithAliases && existingWithAliases[field.name] !== undefined) {
            merged[field.name] = existingWithAliases[field.name];
          } else if (incoming) {
            merged[field.name] = incoming;
          }
        } else {
          merged[field.name] = incoming;
        }
      }

      console.log('🔍 MERGED CREDENTIALS:', {
        keys: Object.keys(merged),
        nonEmptyKeys: Object.entries(merged).filter(([k,v]) => {
          // ✅ FIX: Safely check for non-empty values
          const vStr = typeof v === 'string' ? v : String(v || '');
          return vStr.trim().length > 0;
        }).map(([k]) => k)
      });

      // Validate merged credentials against schema
      this.validateCredentials(merged, schema.storeCredentials);

      // HYBRID APPROACH: Pass credentials through directly (no transformation)
      // Storage layer will save to JSON column as-is (matches admin pattern)
      // 
      // TECHNICAL DEBT: This bypasses processCredentials() which causes field name issues
      // See: docs/CREDENTIAL_MANAGEMENT_TECHNICAL_DEBT.md
      // PROPOSED FIX: Apply processCredentials() here to normalize field names automatically
      //   const processedCredentials = this.processCredentials(merged, schema.storeCredentials);
      //   await storage.saveCompanyVendorCredentials(companyId, supportedVendor.id, processedCredentials);
      console.log('🔐 CREDENTIAL VAULT (HYBRID): Passing credentials to storage without transformation');
      console.log('🔐 CREDENTIAL VAULT (HYBRID): Credential keys:', Object.keys(merged));

      // Store in database (storage layer handles JSON + legacy columns)
      await storage.saveCompanyVendorCredentials(companyId, supportedVendor.id, merged);

      // Audit log
      await this.logCredentialAccess({
        action: 'created',
        vendorId,
        level: 'store',
        companyId,
        userId,
        timestamp: new Date(),
        details: { fieldsUpdated: Object.keys(credentials) },
        ...auditInfo
      });

      console.log(`✅ Store credentials stored for vendor: ${vendorId}, company: ${companyId}`);
    } catch (error) {
      console.error('Failed to store store credentials:', error);
      throw error;
    }
  }

  /**
   * Retrieve admin credentials (plain text)
   */
  async getAdminCredentials(vendorId: string, userId: number): Promise<Record<string, string> | null> {
    try {
      // Try name match first, then fall back to short code (e.g., 'gunbroker')
      let supportedVendor = await storage.getSupportedVendorByName(vendorId);
      if (!supportedVendor) {
        supportedVendor = await storage.getSupportedVendorByShortCode(vendorId);
      }
      
      // Note: Name variations are now handled by getSupportedVendorByName() using nameAliases
      
      if (!supportedVendor) {
        console.warn(`No supported vendor found for: ${vendorId}`);
        return null;
      }

      // Check if this vendor has credentials
      if (!supportedVendor.adminCredentials) {
        console.warn(`No admin credentials found for vendor: ${vendorId}`);
        return null;
      }

      // All credentials are now stored as plain text
      console.log(`✅ PLAIN TEXT CREDENTIALS: Found admin credentials for ${vendorId}`);
      
      // Check for placeholder credentials that need admin configuration
      const credentialValues = Object.values(supportedVendor.adminCredentials);
      const hasPlaceholders = credentialValues.some(value => 
        typeof value === 'string' && (
          value.includes('NEEDS_UPDATE') || 
          value === 'PLACEHOLDER' ||
          value === 'CONFIGURE_IN_ADMIN'
        )
      );
      
      if (hasPlaceholders) {
        console.log(`⚠️ PLACEHOLDER CREDENTIALS: Admin credentials contain placeholders for ${vendorId}, returning null`);
        return null;
      }
      
      // Apply vendor-specific field aliasing for compatibility
      const legacyCredentials = await this.applyFieldAliases(vendorId, supportedVendor.adminCredentials);
      
      console.log('🔍 LEGACY ADMIN CREDENTIALS: Final credentials keys:', Object.keys(legacyCredentials || {}));
      return legacyCredentials;

    } catch (error) {
      console.error('Failed to retrieve admin credentials:', error);
      return null;
    }
  }

  /**
   * Retrieve store credentials (plain text)
   */
  async getStoreCredentials(
    vendorId: string, 
    companyId: number, 
    userId: number
  ): Promise<Record<string, string> | null> {
    try {
      // Try name match first, then fall back to short code
      let supportedVendor = await storage.getSupportedVendorByName(vendorId);
      if (!supportedVendor) {
        supportedVendor = await storage.getSupportedVendorByShortCode(vendorId);
      }
      
      // Note: Name variations are now handled by getSupportedVendorByName() using nameAliases
      
      if (!supportedVendor) {
        return null;
      }

      const rawCredentials = await storage.getCompanyVendorCredentials(companyId, supportedVendor.id);
      if (!rawCredentials) {
        return null;
      }

      const schema = await this.getVendorSchema(vendorId);
      if (!schema) {
        return null;
      }

      // HYBRID APPROACH: Credentials are already in correct format from JSON column
      // Storage layer handles fallback to legacy columns if needed
      console.log(`🔍 CREDENTIAL VAULT (HYBRID): Retrieved credentials for ${vendorId}`);
      console.log(`🔍 CREDENTIAL VAULT (HYBRID): Credential keys:`, Object.keys(rawCredentials));

      // ✅ FIX: Apply field aliases BEFORE filtering (handles vendor-specific field name variations)
      const aliasedCredentials = await this.applyFieldAliases(vendorId, rawCredentials);
      console.log(`🔍 CREDENTIAL VAULT (HYBRID): Aliased fields:`, Object.keys(aliasedCredentials));

      // Filter to only include fields defined in the schema for this vendor
      const schemaFieldNames = schema.storeCredentials.map(field => field.name);
      const filteredCredentials: Record<string, string> = {};
      
      for (const fieldName of schemaFieldNames) {
        if (aliasedCredentials[fieldName] !== undefined) {
          filteredCredentials[fieldName] = aliasedCredentials[fieldName];
        }
      }
      
      console.log(`🔍 CREDENTIAL VAULT (HYBRID): Schema fields:`, schemaFieldNames);
      console.log(`🔍 CREDENTIAL VAULT (HYBRID): Filtered credentials:`, Object.keys(filteredCredentials));

      // Audit log
      await this.logCredentialAccess({
        action: 'accessed',
        vendorId,
        level: 'store',
        companyId,
        userId,
        timestamp: new Date()
      });

      // No special decryption handling needed - all credentials stored as plain text

      // Return filtered credentials (aliases already applied)
      return filteredCredentials;
    } catch (error) {
      console.error('Failed to retrieve store credentials:', error);
      return null;
    }
  }

  /**
   * Validate credentials against schema
   * Supports both snake_case (schema) and camelCase (frontend) field names
   */
  private validateCredentials(credentials: Record<string, string>, schema: CredentialField[]): void {
    // Bidirectional case conversion helpers
    const snakeToCamel = (str: string) => {
      return str.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    };
    
    const camelToSnake = (str: string) => {
      return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    };
    
    for (const field of schema) {
      // Generate all possible variations of the field name
      const originalName = field.name;
      const snakeCaseName = originalName.includes('_') ? originalName : camelToSnake(originalName);
      const camelCaseName = originalName.includes('_') ? snakeToCamel(originalName) : originalName;
      const lowerCaseName = originalName.toLowerCase();
      
      // Try to find the value in credentials using various name formats
      let value = credentials[originalName] || 
                  credentials[snakeCaseName] || 
                  credentials[camelCaseName];
      
      // If not found, try case-insensitive match
      if (!value) {
        const credentialKey = Object.keys(credentials).find(key => 
          key.toLowerCase() === lowerCaseName || 
          key.toLowerCase().replace(/_/g, '') === lowerCaseName.replace(/_/g, '')
        );
        if (credentialKey) {
          value = credentials[credentialKey];
        }
      }
      
      // ✅ FIX: Ensure value is a string before calling .trim()
      const stringValue = value != null ? String(value) : '';
      
      if (field.required && (!stringValue || stringValue.trim() === '')) {
        throw new Error(`Required field missing: ${field.label}`);
      }

      if (stringValue && field.validation) {
        const validation = field.validation;

        if (validation.minLength && stringValue.length < validation.minLength) {
          throw new Error(`${field.label} must be at least ${validation.minLength} characters`);
        }

        if (validation.maxLength && stringValue.length > validation.maxLength) {
          throw new Error(`${field.label} must be no more than ${validation.maxLength} characters`);
        }

        if (validation.pattern && !new RegExp(validation.pattern).test(stringValue)) {
          throw new Error(`${field.label} format is invalid`);
        }
      }
    }
  }

  /**
   * Process credentials (no encryption - pass through)
   * Normalizes field names to match schema (snake_case or camelCase)
   */
  private processCredentials(
    credentials: Record<string, string>, 
    schema: CredentialField[]
  ): Record<string, string> {
    // Helper to convert snake_case to camelCase
    const snakeToCamel = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    
    // Helper to normalize field names for comparison (lowercase, no underscores/spaces)
    const normalizeForComparison = (str: string) => 
      str.toLowerCase().replace(/[_\s]/g, '');
    
    // Normalize credentials to include both naming conventions for compatibility
    const normalized: Record<string, string> = {};
    
    for (const field of schema) {
      const schemaFieldNorm = normalizeForComparison(field.name);
      let foundValue: string | undefined = undefined;
      let foundKey: string | undefined = undefined;
      
      // Try to find matching credential key using flexible matching
      for (const [credKey, credValue] of Object.entries(credentials)) {
        if (normalizeForComparison(credKey) === schemaFieldNorm) {
          foundValue = credValue;
          foundKey = credKey;
          break;
        }
      }
      
      if (foundValue !== undefined) {
        const snakeCaseName = field.name;
        const camelCaseName = snakeToCamel(field.name);
        
        // Store in both formats for maximum compatibility
        normalized[snakeCaseName] = foundValue;
        normalized[camelCaseName] = foundValue;
        
        // Also preserve the original key name if different
        if (foundKey && foundKey !== snakeCaseName && foundKey !== camelCaseName) {
          normalized[foundKey] = foundValue;
        }
      }
    }
    
    // Also include any extra fields from original credentials
    for (const key in credentials) {
      if (!normalized[key]) {
        normalized[key] = credentials[key];
      }
    }
    
    return normalized;
  }

  /**
   * Unprocess credentials (no decryption - pass through)
   */
  private unprocessCredentials(
    storedCredentials: Record<string, string>, 
    schema: CredentialField[]
  ): Record<string, string> {
    // No decryption - return credentials as-is, but filter out metadata
    const unprocessed: Record<string, string> = {};

    for (const [key, value] of Object.entries(storedCredentials)) {
      if (key === 'lastUsed' || key === 'createdAt' || key === 'updatedAt') {
        continue; // Skip metadata fields
      }
      unprocessed[key] = value;
    }

    return unprocessed;
  }

  /**
   * Test connection using stored credentials
   */
  async testConnection(
    vendorId: string, 
    level: 'admin' | 'store', 
    companyId?: number,
    userId?: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      let credentials: Record<string, string> | null;

      if (level === 'admin') {
        credentials = await this.getAdminCredentials(vendorId, userId || 0);
      } else {
        if (!companyId) {
          throw new Error('Company ID required for store-level credential testing');
        }
        credentials = await this.getStoreCredentials(vendorId, companyId, userId || 0);
      }

      if (!credentials) {
        return { success: false, message: 'No credentials found' };
      }

      // Use existing vendor-specific connection testing
      const { vendorRegistry } = await import('./vendor-registry');
      const handler = vendorRegistry.getHandlerByVendorName(vendorId);

      if (handler && handler.testConnection) {
        const result = await handler.testConnection(credentials);
        
        // Audit log
        if (userId) {
          await this.logCredentialAccess({
            action: 'test_connection',
            vendorId,
            level,
            companyId,
            userId,
            timestamp: new Date(),
            details: { success: result.success, message: result.message }
          });
        }

        return result;
      } else {
        return { success: true, message: 'Credentials stored (connection test not implemented)' };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Connection test failed:', error);
      return { success: false, message: `Connection test failed: ${errorMessage}` };
    }
  }

  /**
   * Apply vendor-specific field aliases for compatibility with vendor handlers
   */
  private async applyFieldAliases(vendorId: string, credentials: Record<string, string>): Promise<Record<string, string>> {
    try {
      const result = { ...credentials };
      
      // ✅ LIPSEY'S: Map userName ↔ email (Lipsey's uses email as username)
      if (vendorId.toLowerCase().includes('lipsey')) {
        console.log('🔧 LIPSEYS: Applying field aliases');
        
        // Map database userName field back to email for frontend
        if (result['userName'] && !result['email']) {
          result['email'] = result['userName'];
          console.log('🔧 ALIAS: userName → email');
        }
        // Also support reverse mapping
        if (result['email'] && !result['userName']) {
          result['userName'] = result['email'];
          console.log('🔧 ALIAS: email → userName');
        }
      }
      
      // ✅ ENHANCED: Sports South comprehensive field mapping
      if (vendorId.toLowerCase().includes('sports') && vendorId.toLowerCase().includes('south')) {
        console.log('🔧 SPORTS SOUTH: Applying comprehensive field aliases');
        
        // Bidirectional mapping: camelCase ↔ snake_case
        const fieldMappings = [
          ['userName', 'user_name'],
          ['customerNumber', 'customer_number']
        ];
        
        for (const [camelCase, snakeCase] of fieldMappings) {
          if (result[snakeCase] && !result[camelCase]) {
            result[camelCase] = result[snakeCase];
            console.log(`🔧 ALIAS: ${snakeCase} → ${camelCase}`);
          }
          if (result[camelCase] && !result[snakeCase]) {
            result[snakeCase] = result[camelCase];
            console.log(`🔧 ALIAS: ${camelCase} → ${snakeCase}`);
          }
        }
      }
      
      // ✅ ENHANCED: Chattanooga field mapping
      if (vendorId.toLowerCase().includes('chattanooga')) {
        console.log('🔧 CHATTANOOGA: Applying field aliases');
        
        // Handle password field variations
        if (result.chattanooga_password && !result.password) {
          result.password = result.chattanooga_password;
          console.log('🔧 ALIAS: chattanooga_password → password');
        }
        if (result.password && !result.chattanooga_password) {
          result.chattanooga_password = result.password;
          console.log('🔧 ALIAS: password → chattanooga_password');
        }
        
        // Handle account number variations
        if (result.account_number && !result.accountNumber) {
          result.accountNumber = result.account_number;
          console.log('🔧 ALIAS: account_number → accountNumber');
        }
        if (result.accountNumber && !result.account_number) {
          result.account_number = result.accountNumber;
          console.log('🔧 ALIAS: accountNumber → account_number');
        }
      }
      
      // ✅ BILL HICKS: Map FTP field variations (snake_case ↔ camelCase)
      // TECHNICAL DEBT: This vendor-specific aliasing is a workaround for inconsistent use of processCredentials()
      // See: docs/CREDENTIAL_MANAGEMENT_TECHNICAL_DEBT.md
      // TODO: Remove this when processCredentials() is applied to store credentials (Phase 3)
      if (vendorId.toLowerCase().includes('bill') && vendorId.toLowerCase().includes('hicks')) {
        console.log('🔧 BILL HICKS: Applying FTP field aliases');
        
        // Bidirectional mapping: camelCase ↔ snake_case
        const ftpFieldMappings = [
          ['ftpServer', 'ftp_server'],
          ['ftpUsername', 'ftp_username'],
          ['ftpPassword', 'ftp_password'],
          ['ftpPort', 'ftp_port'],
          ['ftpBasePath', 'ftp_base_path']
        ];
        
        for (const [camelCase, snakeCase] of ftpFieldMappings) {
          if (result[snakeCase] && !result[camelCase]) {
            result[camelCase] = result[snakeCase];
            console.log(`🔧 ALIAS: ${snakeCase} → ${camelCase}`);
          }
          if (result[camelCase] && !result[snakeCase]) {
            result[snakeCase] = result[camelCase];
            console.log(`🔧 ALIAS: ${camelCase} → ${snakeCase}`);
          }
        }
      }
      
      // Get vendor from database to access credential field schema
      let supportedVendor = await storage.getSupportedVendorByName(vendorId);
      if (!supportedVendor) {
        supportedVendor = await storage.getSupportedVendorByShortCode(vendorId);
      }
      
      // Apply schema-based aliases if available
      if (supportedVendor && supportedVendor.credentialFields) {
        for (const field of supportedVendor.credentialFields) {
          if (field.aliases && Array.isArray(field.aliases)) {
            for (const alias of field.aliases) {
              // If we have the main field but not the alias, add alias
              if (result[field.name] && !result[alias]) {
                result[alias] = result[field.name];
                console.log(`🔧 SCHEMA ALIAS: ${field.name} → ${alias}`);
              }
              // If we have the alias but not the main field, add main field
              if (result[alias] && !result[field.name]) {
                result[field.name] = result[alias];
                console.log(`🔧 SCHEMA ALIAS: ${alias} → ${field.name}`);
              }
            }
          }
        }
      }
      
      console.log(`🔧 FIELD ALIASES: Final fields for ${vendorId}:`, Object.keys(result));
      return result;
    } catch (error) {
      console.error('Error applying field aliases:', error);
      // Fallback to legacy logic on error
      return this.applyLegacyFieldAliases(vendorId, credentials);
    }
  }

  /**
   * Legacy hardcoded field aliases (fallback)
   */
  private applyLegacyFieldAliases(vendorId: string, credentials: Record<string, string>): Record<string, string> {
    const vendorIdNormalized = vendorId.toLowerCase();
    const result = { ...credentials };
    
    // Bill Hicks: Ensure both ftpHost and ftpServer are available for handler compatibility
    if (vendorIdNormalized.includes('bill') && vendorIdNormalized.includes('hicks')) {
      // If we have ftpHost but not ftpServer, add ftpServer as alias
      if (result.ftpHost && !result.ftpServer) {
        result.ftpServer = result.ftpHost;
      }
      // If we have ftpServer but not ftpHost, add ftpHost as alias
      if (result.ftpServer && !result.ftpHost) {
        result.ftpHost = result.ftpServer;
      }
    }
    
    return result;
  }

  /**
   * Log credential access for audit purposes
   */
  private async logCredentialAccess(entry: Omit<AuditLogEntry, 'id'>): Promise<void> {
    try {
      // For now, just console log. In production, store in dedicated audit table
      console.log('🔐 CREDENTIAL AUDIT:', JSON.stringify({
        ...entry,
        id: crypto.randomUUID(),
        timestamp: entry.timestamp.toISOString()
      }, null, 2));

      // TODO: Store in dedicated audit_logs table
      // await storage.createAuditLogEntry(entry);
    } catch (error) {
      console.error('Failed to log credential access:', error);
      // Don't throw - audit logging failure shouldn't break credential operations
    }
  }

  /**
   * Get redacted credentials for display purposes (never show actual sensitive values)
   */
  async getRedactedCredentials(
    vendorId: string, 
    level: 'admin' | 'store', 
    companyId?: number
  ): Promise<Record<string, string> | null> {
    try {
      const schema = await this.getVendorSchema(vendorId);
      if (!schema) {
        return null;
      }

      let storedCredentials: Record<string, string> | null;

      if (level === 'admin') {
        const supportedVendor = await storage.getSupportedVendorByName(vendorId);
        storedCredentials = supportedVendor?.adminCredentials || null;
      } else {
        if (!companyId) return null;
        const supportedVendor = await storage.getSupportedVendorByName(vendorId);
        if (!supportedVendor) return null;
        storedCredentials = await storage.getCompanyVendorCredentials(companyId, supportedVendor.id);
        
        // ✅ FIX: Apply field aliases for store credentials (userName → email for Lipsey's)
        if (storedCredentials) {
          storedCredentials = await this.applyFieldAliases(vendorId, storedCredentials);
          console.log('🔧 REDACTED CREDS: Applied field aliases for', vendorId, 'Fields:', Object.keys(storedCredentials));
        }
      }

      if (!storedCredentials) {
        return null;
      }

      const fieldSchema = level === 'admin' ? schema.adminCredentials : schema.storeCredentials;
      const redacted: Record<string, string> = {};

      for (const field of fieldSchema) {
        const value = storedCredentials[field.name];
        if (value) {
          if (field.type === 'password' || field.type === 'token' || field.type === 'apiKey' || field.type === 'secret') {
            redacted[field.name] = '••••••••';
          } else {
            redacted[field.name] = value;
          }
        } else {
          redacted[field.name] = '';
        }
      }

      return redacted;
    } catch (error) {
      console.error('Failed to get redacted credentials:', error);
      return null;
    }
  }

  /**
   * List all vendors that have credentials configured
   */
  async getConfiguredVendors(): Promise<{
    vendorId: string;
    vendorName: string;
    hasAdminCredentials: boolean;
    adminConnectionStatus?: string;
    storeCount: number;
  }[]> {
    try {
      const supportedVendors = await storage.getAllSupportedVendors();
      const result = [];

      for (const vendor of supportedVendors) {
        const storeCredentialsCount = await storage.getCompanyVendorCredentialsCount(vendor.id);
        
        result.push({
          vendorId: vendor.name,
          vendorName: vendor.name,
          hasAdminCredentials: !!(vendor.adminCredentials && Object.keys(vendor.adminCredentials).length > 0),
          adminConnectionStatus: vendor.adminConnectionStatus || undefined,
          storeCount: storeCredentialsCount
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to get configured vendors:', error);
      return [];
    }
  }
}

// Singleton instance
export const credentialVault = new CredentialVaultService();

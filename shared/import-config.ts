// Centralized Import Configuration
// This file manages all import-related configuration to eliminate hardcoded references

export interface ImportConfig {
  defaultAdminUserId: () => Promise<number>;
  maxFileSize: number;
  allowedFileTypes: string[];
  defaultSettings: {
    duplicateHandling: 'ignore' | 'overwrite';
    retailVerticalId: number;
  };
}

// Get the first available admin user ID dynamically
export async function getDefaultAdminUserId(): Promise<number> {
  const { storage } = await import('../server/storage');
  
  // Get any admin user (companyId is null for admin users)
  const adminUsers = await storage.getAllUsers();
  const adminUser = adminUsers.find(user => user.companyId === null);
  
  if (!adminUser) {
    throw new Error('No admin user found in database');
  }
  
  return adminUser.id;
}

export const IMPORT_CONFIG: ImportConfig = {
  defaultAdminUserId: getDefaultAdminUserId,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedFileTypes: ['.csv', 'text/csv'],
  defaultSettings: {
    duplicateHandling: 'ignore',
    retailVerticalId: 1 // This should be dynamically determined from retail-vertical-config
  }
};

// Helper function to get import configuration
export function getImportConfig(): ImportConfig {
  return IMPORT_CONFIG;
}
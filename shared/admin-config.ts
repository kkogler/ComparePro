// Admin Configuration System
// Centralized configuration for administrator roles and permissions

export const ADMIN_CONFIG = {
  ROLE_NAMES: {
    SUPER_ADMIN: 'Super Administrator',
    SYSTEM_ADMIN: 'System Administrator', 
    PLATFORM_ADMIN: 'Platform Administrator',
    DEVOPS_ADMIN: 'DevOps Administrator'
  },
  
  ACCESS_MESSAGES: {
    REQUIRED: 'Administrator access required',
    UNAUTHORIZED: 'Unauthorized - Administrator access required',
    INSUFFICIENT: 'Insufficient administrator privileges',
    LOGIN_REQUIRED: 'Administrator login required'
  },

  COMPANY_INDICATORS: {
    ADMIN_COMPANY_ID: null as null, // Admins have null companyId
    IS_ADMIN_CHECK: (companyId: any) => companyId === null
  },

  PERMISSIONS: {
    MANAGE_ORGANIZATIONS: 'manage_organizations',
    MANAGE_USERS: 'manage_users',
    MANAGE_BILLING: 'manage_billing',
    SYSTEM_SETTINGS: 'system_settings',
    VIEW_ANALYTICS: 'view_analytics',
    MANAGE_VENDORS: 'manage_vendors'
  },

  DEFAULT_ADMIN: {
    USERNAME: 'admin',
    ROLE: 'Super Administrator',
    DESCRIPTION: 'Primary system administrator account'
  }
} as const;

export type AdminRole = typeof ADMIN_CONFIG.ROLE_NAMES[keyof typeof ADMIN_CONFIG.ROLE_NAMES];
export type AdminPermission = typeof ADMIN_CONFIG.PERMISSIONS[keyof typeof ADMIN_CONFIG.PERMISSIONS];

export function isAdministrator(user: { companyId: any } | null): boolean {
  return user ? ADMIN_CONFIG.COMPANY_INDICATORS.IS_ADMIN_CHECK(user.companyId) : false;
}

export function getAdminAccessMessage(type: 'REQUIRED' | 'UNAUTHORIZED' | 'INSUFFICIENT' | 'LOGIN_REQUIRED' = 'REQUIRED'): string {
  return ADMIN_CONFIG.ACCESS_MESSAGES[type];
}

export function getAdminRole(roleKey?: keyof typeof ADMIN_CONFIG.ROLE_NAMES): string {
  return roleKey ? ADMIN_CONFIG.ROLE_NAMES[roleKey] : ADMIN_CONFIG.ROLE_NAMES.SUPER_ADMIN;
}
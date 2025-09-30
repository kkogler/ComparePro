/**
 * Centralized Retail Vertical Configuration
 * 
 * This file contains all retail vertical-related constants and configuration
 * to eliminate hardcoded references throughout the codebase.
 * 
 * Architectural Rule: All retail vertical logic must use this configuration
 * instead of hardcoded ID checks or string comparisons.
 */

export interface RetailVerticalConfig {
  id: number;
  name: string;
  slug: string;
  displayName: string;
  features: {
    requiresFFL: boolean;
    supportsSerialNumbers: boolean;
    hasSpecialCompliance: boolean;
  };
  validationRules: {
    fflRequired: boolean;
    serialNumberTracking: boolean;
  };
}

/**
 * Retail Vertical Configurations
 * 
 * These configurations define the behavior and requirements for each retail vertical.
 */
export const RETAIL_VERTICALS: Record<string, RetailVerticalConfig> = {
  FIREARMS: {
    id: 1,
    name: 'Firearms1',
    slug: 'firearms1',
    displayName: 'Firearms & Equipment',
    features: {
      requiresFFL: true,
      supportsSerialNumbers: true,
      hasSpecialCompliance: true,
    },
    validationRules: {
      fflRequired: true,
      serialNumberTracking: true,
    },
  },
  // Additional verticals can be added here as the platform expands
};

/**
 * Default retail vertical for new products and organizations
 */
export const DEFAULT_RETAIL_VERTICAL = RETAIL_VERTICALS.FIREARMS;

/**
 * Helper Functions for Retail Vertical Operations
 */

/**
 * Get retail vertical configuration by ID
 */
export function getRetailVerticalById(id: number): RetailVerticalConfig | null {
  return Object.values(RETAIL_VERTICALS).find(vertical => vertical.id === id) || null;
}

/**
 * Get retail vertical configuration by slug
 */
export function getRetailVerticalBySlug(slug: string): RetailVerticalConfig | null {
  return Object.values(RETAIL_VERTICALS).find(vertical => vertical.slug === slug) || null;
}

/**
 * Check if a retail vertical requires FFL for orders
 */
export function isFFLRequired(retailVerticalId: number): boolean {
  const vertical = getRetailVerticalById(retailVerticalId);
  return vertical?.validationRules.fflRequired || false;
}

/**
 * Check if a retail vertical supports serial number tracking
 */
export function supportsSerialNumbers(retailVerticalId: number): boolean {
  const vertical = getRetailVerticalById(retailVerticalId);
  return vertical?.features.supportsSerialNumbers || false;
}

/**
 * Check if a retail vertical has special compliance requirements
 */
export function hasSpecialCompliance(retailVerticalId: number): boolean {
  const vertical = getRetailVerticalById(retailVerticalId);
  return vertical?.features.hasSpecialCompliance || false;
}

/**
 * Get display name for a retail vertical
 */
export function getRetailVerticalDisplayName(retailVerticalId: number): string {
  const vertical = getRetailVerticalById(retailVerticalId);
  return vertical?.displayName || 'Unknown Vertical';
}

/**
 * Check if retail vertical ID is the firearms vertical
 */
export function isFirearmsVertical(retailVerticalId: number): boolean {
  return retailVerticalId === RETAIL_VERTICALS.FIREARMS.id;
}

/**
 * Get all available retail verticals
 */
export function getAllRetailVerticals(): RetailVerticalConfig[] {
  return Object.values(RETAIL_VERTICALS);
}
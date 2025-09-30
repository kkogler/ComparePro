/**
 * Centralized Product Category Configuration
 * 
 * This file contains all product category-related constants and configuration
 * to eliminate hardcoded references throughout the codebase.
 * 
 * Architectural Rule: All category logic must use this configuration
 * instead of hardcoded string comparisons or category lists.
 */

export interface ProductCategoryConfig {
  id: number;
  name: string;
  slug: string;
  displayName: string;
  isActive: boolean;
  sortOrder: number;
  description?: string;
}

/**
 * Default Product Categories
 * 
 * These are the initial categories that will be created for new organizations.
 */
export const DEFAULT_CATEGORIES: Omit<ProductCategoryConfig, 'id'>[] = [
  {
    name: 'firearms',
    slug: 'firearms', 
    displayName: 'Firearms',
    isActive: true,
    sortOrder: 1,
    description: 'Firearms and related products'
  },
  {
    name: 'ammunition',
    slug: 'ammunition',
    displayName: 'Ammunition', 
    isActive: true,
    sortOrder: 2,
    description: 'Ammunition and cartridges'
  },
  {
    name: 'accessories',
    slug: 'accessories',
    displayName: 'Accessories',
    isActive: true,
    sortOrder: 3,
    description: 'Firearm accessories and attachments'
  },
  {
    name: 'optics',
    slug: 'optics',
    displayName: 'Optics',
    isActive: true,
    sortOrder: 4,
    description: 'Scopes, sights, and optical equipment'
  },
  {
    name: 'parts',
    slug: 'parts',
    displayName: 'Parts',
    isActive: true,
    sortOrder: 5,
    description: 'Firearm parts and components'
  }
];

/**
 * Helper Functions for Category Operations
 */

/**
 * Get default category for new products
 */
export function getDefaultCategory(): Omit<ProductCategoryConfig, 'id'> {
  return DEFAULT_CATEGORIES[0]; // firearms
}

/**
 * Get category display name by slug
 */
export function getCategoryDisplayName(slug: string): string {
  const category = DEFAULT_CATEGORIES.find(cat => cat.slug === slug);
  return category?.displayName || slug;
}

/**
 * Validate category data
 */
export function validateCategoryData(data: Partial<ProductCategoryConfig>): boolean {
  return !!(data.name && data.slug && data.displayName);
}

/**
 * Generate slug from name
 */
export function generateCategorySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
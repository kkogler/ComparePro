import { pgTable, serial, text, integer, decimal, timestamp, boolean, json, unique, index, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies table for multi-tenant support
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier
  plan: text("plan").notNull().default("free"), // 'free', 'basic', 'professional', 'enterprise'
  status: text("status").notNull().default("active"), // 'active', 'trial', 'expired', 'cancelled', 'paused', 'past_due'
  email: text("email"), // Company contact email
  phone: text("phone"), // Company contact phone
  logoUrl: text("logo_url"), // Company logo image URL
  billingProvider: text("billing_provider"), // 'zoho', 'recurly', etc.
  billingCustomerId: text("billing_customer_id"),
  billingSubscriptionId: text("billing_subscription_id"), // Store subscription number (SUB-00037) not internal ID
  billingSubscriptionNumber: text("billing_subscription_number"), // For compatibility
  trialStatus: text("trial_status"), // 'active', 'expired', 'converted', 'cancelled', null
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  trialExtensions: integer("trial_extensions").default(0),
  maxUsers: integer("max_users").default(10),
  maxVendors: integer("max_vendors").default(5),
  maxOrders: integer("max_orders").default(500),
  features: json("features").$type<{ advancedAnalytics: boolean; apiAccess: boolean }>(),
  settings: json("settings").$type<{ timezone: string; currency: string; requireCategoryOnVendorOrders?: boolean }>(),
  retailVerticalId: integer("retail_vertical_id").references(() => retailVerticals.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Organization domains table for host-based tenant routing
export const orgDomains = pgTable("org_domains", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  domain: text("domain").notNull().unique(), // e.g., "demo-gun-store.bestprice.app"
  subdomain: text("subdomain").notNull(), // e.g., "demo-gun-store" (extracted from domain)
  isActive: boolean("is_active").default(true),
  isPrimary: boolean("is_primary").default(false), // Primary domain for the organization
  sslEnabled: boolean("ssl_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    domainUnique: unique("org_domain_unique").on(table.domain),
    subdomainIndex: index("org_subdomain_idx").on(table.subdomain),
  };
});

// Retail verticals for industry categorization
export const retailVerticals = pgTable("retail_verticals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order"),
  color: varchar("color", { length: 7 }), // Hex color code
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Retail stores within companies
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(), // URL-friendly identifier within company
  shortName: text("short_name").notNull(), // Derived from name, 8-character alphanumeric limit
  storeNumber: text("store_number").notNull(), // Numeric store number (01, 02, 03, etc.)
  address1: text("address1"),
  address2: text("address2"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("US"), // Country code (ISO 3166-1 alpha-2)
  phone: text("phone"),
  email: text("email"),
  fflNumber: text("ffl_number"), // Federal Firearms License number
  isActive: boolean("is_active").default(true), // Keep for backwards compatibility
  status: text("status").default("active"), // 'active', 'inactive', 'archived'
  timezone: text("timezone").default("America/New_York"),
  currency: text("currency").default("USD"),
  settings: json("settings").$type<Record<string, any>>(), // Store-specific settings
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    companyStoreSlugUnique: unique("company_store_slug_unique").on(table.companyId, table.slug),
    companyStoreNumberUnique: unique("company_store_number_unique").on(table.companyId, table.storeNumber),
  };
});

// Pricing configurations for webhook retail price calculation
export const pricingConfigurations = pgTable("pricing_configurations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(), // Configuration name
  description: text("description"), // Optional description
  isDefault: boolean("is_default").default(false), // Default configuration for company
  isActive: boolean("is_active").default(true),
  
  // Pricing strategy
  strategy: text("strategy").notNull(), // 'map', 'msrp', 'cost_markup', 'cost_margin', 'map_premium', 'msrp_discount'
  
  // Strategy-specific values
  markupPercentage: decimal("markup_percentage", { precision: 5, scale: 2 }), // For cost_markup (e.g., 25.50 for 25.5%)
  marginPercentage: decimal("margin_percentage", { precision: 5, scale: 2 }), // For cost_margin (e.g., 20.00 for 20%)
  premiumAmount: decimal("premium_amount", { precision: 10, scale: 2 }), // For map_premium (e.g., 5.00 for +$5.00)
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }), // For msrp_discount (e.g., 10.00 for 10% off)
  
  // Rounding rules
  roundingRule: text("rounding_rule").notNull().default("none"), // 'none', 'up_99', 'down_99', 'up_95', 'down_95', 'up_10cent', 'down_10cent', 'nearest_dollar', 'up_dollar'
  roundingAmount: decimal("rounding_amount", { precision: 3, scale: 2 }), // For custom rounding (e.g., 0.99, 0.95)
  
  // Fallback strategy if primary fails
  fallbackStrategy: text("fallback_strategy"), // 'none', 'map', 'msrp', 'cost_markup', 'cost_margin'
  fallbackMarkupPercentage: decimal("fallback_markup_percentage", { precision: 5, scale: 2 }),
  
  // Cross-vendor MSRP/MAP fallback option
  useCrossVendorFallback: boolean("use_cross_vendor_fallback").default(false), // Use highest MSRP/MAP from other vendors
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    companyDefaultUnique: unique("company_default_unique").on(table.companyId, table.isDefault),
  };
});

// Users can belong to companies
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id), // Nullable for DevOps users
  username: text("username").notNull(),
  email: text("email").notNull(),
  password: text("password"), // Nullable until account activation
  role: text("role").notNull().default("user"), // 'admin', 'manager', 'user', 'devops'
  firstName: text("first_name"),
  lastName: text("last_name"),
  displayName: text("display_name"), // User's preferred display name
  defaultStoreId: integer("default_store_id").references(() => stores.id), // User's default store for order creation
  isAdmin: boolean("is_admin").default(false), // Non-deletable admin flag for organizations
  
  // User activation state - enhanced security model
  status: text("status").notNull().default("pending_activation"), // 'pending_activation', 'active', 'suspended', 'inactive'
  activationToken: text("activation_token"), // Secure random token for account activation
  activationTokenExpires: timestamp("activation_token_expires"), // Token expiration time
  
  // Password reset functionality
  passwordResetToken: text("password_reset_token"), // Secure token for password resets
  passwordResetTokenExpires: timestamp("password_reset_token_expires"), // Reset token expiration
  
  // Legacy field for backward compatibility (DEPRECATED - use status instead)
  isActive: boolean("is_active").default(true),
  
  lastLogin: timestamp("last_login"),
  emailVerifiedAt: timestamp("email_verified_at"), // When user verified email via activation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    usernameCompanyUnique: unique("users_username_company_unique").on(table.username, table.companyId),
    activationTokenIndex: index("users_activation_token_idx").on(table.activationToken),
    passwordResetTokenIndex: index("users_password_reset_token_idx").on(table.passwordResetToken),
  };
});

// Junction table for user-store assignments (many-to-many)
export const userStores = pgTable("user_stores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  role: text("role").notNull().default("employee"), // 'manager', 'employee', 'viewer'
  permissions: json("permissions").$type<string[]>(), // Array of permission strings
  isActive: boolean("is_active").default(true),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    userStoreUnique: unique("user_store_unique").on(table.userId, table.storeId),
  };
});



export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  upc: text("upc").notNull().unique(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  model: text("model"),

  manufacturerPartNumber: text("manufacturer_part_number"),
  altId1: text("alt_id_1"), // Alternative ID 1 for additional search capability
  altId2: text("alt_id_2"), // Alternative ID 2 for additional search capability
  caliber: text("caliber"),
  category: text("category"),
  subcategory1: text("subcategory1"),
  subcategory2: text("subcategory2"),
  subcategory3: text("subcategory3"),
  description: text("description"),
  barrelLength: varchar("barrel_length"), // Barrel length for firearms
  imageUrl: text("image_url"),
  imageSource: text("image_source"), // Track which vendor provided the image
  source: text("source"), // Track import source (vendor name, manual, API, etc.)
  
  // DEPRECATED: Source locking system replaced by vendor priority system
  // These fields are kept for database compatibility but are no longer used in business logic
  sourceLocked: boolean("source_locked").default(true), // DEPRECATED: No longer prevents automatic source changes
  sourceLockedAt: timestamp("source_locked_at").defaultNow(), // DEPRECATED: No longer tracked
  sourceLockedBy: varchar("source_locked_by"), // DEPRECATED: No longer used for lock tracking
  lastQualityScore: integer("last_quality_score"), // Last calculated quality score
  
  // Firearms industry compliance fields (NO PRICING OR VENDOR-SPECIFIC DATA)
  serialized: boolean("serialized").default(false), // serialized_flag from vendors
  allocated: boolean("allocated").default(false), // Special ordering requirements
  specifications: json("specifications").$type<Record<string, any>>(), // Enhanced product specs

  // Differential priority system - avoids recalculating scores on every sync
  priorityScore: integer("priority_score"), // Cached completeness score
  prioritySource: text("priority_source"), // Winning vendor source for this record
  priorityCalculatedAt: timestamp("priority_calculated_at"), // When priority was last calculated
  dataHash: text("data_hash"), // Hash of key product data to detect changes

  customProperties: json("custom_properties").$type<Record<string, any>>(), // Flexible additional data
  status: text("status").notNull().default("active"), // 'active', 'archived'
  retailVerticalId: integer("retail_vertical_id").references(() => retailVerticals.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // NOTE: No pricing stored here - all pricing comes from real-time vendor APIs
});

// Vendor Product Mappings - Mapping for vendor SKU lookups with cached pricing for FTP vendors
export const vendorProductMappings = pgTable("vendor_product_mappings", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  supportedVendorId: integer("supported_vendor_id").references(() => supportedVendors.id).notNull(),
  
  // For FTP-based multi-tenant vendors (like Bill Hicks), scope by company for store-specific pricing
  companyId: integer("company_id").references(() => companies.id), // NULL for universal mappings (Sports South, etc.)
  
  // Vendor's internal SKU/ID for this product
  vendorSku: text("vendor_sku").notNull(), // Sports South ITEMNO, Lipsey's item number, Bill Hicks product name, etc.
  
  // Cached pricing for FTP-based vendors (NULL for real-time API vendors)
  vendorCost: decimal("vendor_cost", { precision: 10, scale: 2 }), // Bill Hicks product_price
  mapPrice: decimal("map_price", { precision: 10, scale: 2 }), // Bill Hicks marp 
  msrpPrice: decimal("msrp_price", { precision: 10, scale: 2 }), // Bill Hicks msrp
  lastPriceUpdate: timestamp("last_price_update"), // When pricing was last updated from FTP feed
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    // For universal vendors: one mapping per product per vendor (companyId = NULL)
    // For multi-tenant vendors: one mapping per product per vendor per company
    productVendorCompanyUnique: unique("product_vendor_company_unique").on(table.productId, table.supportedVendorId, table.companyId),
    // Index for fast vendor SKU lookups
    vendorSkuIndex: index("vendor_sku_idx").on(table.supportedVendorId, table.vendorSku),
    // Index for company-scoped lookups
    companyVendorIndex: index("company_vendor_idx").on(table.companyId, table.supportedVendorId),
  };
});

// Supported Vendors (admin-managed template vendors)
export const supportedVendors = pgTable("supported_vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  vendorShortCode: text("vendor_short_code"), // Short code for display (e.g., "Lipsey's")
  description: text("description").notNull(),
  apiType: text("api_type").notNull(), // 'rest_api', 'soap', 'ftp', 'excel'
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  documentationUrl: text("documentation_url"),
  credentialFields: json("credential_fields").$type<Array<{
    name: string;
    label: string;
    type: 'text' | 'password' | 'email' | 'url';
    required: boolean;
    aliases?: string[]; // Field aliases for vendor compatibility
    placeholder?: string;
    description?: string;
  }>>().notNull(),
  features: json("features").$type<{
    electronicOrdering: boolean;
    realTimePricing: boolean;
    inventorySync: boolean;
    productCatalog: boolean;
  }>().notNull(),
  
  // System-level admin credentials for Master Product Catalog sync
  adminCredentials: json("admin_credentials").$type<Record<string, string>>(), // Admin credentials for catalog sync
  adminConnectionStatus: text("admin_connection_status").default("not_configured"), // 'not_configured', 'online', 'offline', 'error'
  lastCatalogSync: timestamp("last_catalog_sync"), // When we last synced products to Master Catalog
  catalogSyncStatus: text("catalog_sync_status"), // 'success', 'error', 'in_progress', 'never_synced'
  catalogSyncError: text("catalog_sync_error"), // Error details if sync fails
  lastSyncNewRecords: integer("last_sync_new_records").default(0), // Number of new records created in last sync
  
  // Sports South specific scheduling
  sportsSouthScheduleEnabled: boolean("sports_south_schedule_enabled").default(false),
  sportsSouthScheduleTime: text("sports_south_schedule_time").default("14:00"), // HH:MM format for incremental sync
  sportsSouthScheduleFrequency: text("sports_south_schedule_frequency").default("daily"), // daily, weekdays, weekly
  lastSyncRecordsUpdated: integer("last_sync_records_updated").default(0), // Number of records updated in last sync
  lastSyncRecordsSkipped: integer("last_sync_records_skipped").default(0), // Number of records skipped in last sync
  lastSyncImagesAdded: integer("last_sync_images_added").default(0), // Number of new images added in last sync
  lastSyncImagesUpdated: integer("last_sync_images_updated").default(0), // Number of images updated in last sync
  
  // Chattanooga Shooting Supplies specific scheduling
  chattanoogaScheduleEnabled: boolean("chattanooga_schedule_enabled").default(false),
  chattanoogaScheduleTime: text("chattanooga_schedule_time").default("15:00"), // HH:MM format for CSV download
  chattanoogaScheduleFrequency: text("chattanooga_schedule_frequency").default("daily"), // daily, weekdays, weekly  
  chattanoogaLastCsvDownload: timestamp("chattanooga_last_csv_download"), // When CSV was last downloaded
  chattanoogaCsvSyncStatus: text("chattanooga_csv_sync_status").default("never_synced"), // 'success', 'error', 'in_progress', 'never_synced'
  chattanoogaCsvSyncError: text("chattanooga_csv_sync_error"), // Error details if CSV sync fails
  chattanoogaLastCsvSize: integer("chattanooga_last_csv_size").default(0), // Size in bytes for diff comparison
  chattanoogaLastCsvHash: text("chattanooga_last_csv_hash"), // MD5 hash for change detection
  
  // Chattanooga sync statistics
  chattanoogaRecordsAdded: integer("chattanooga_records_added").default(0), // Number of new records added in last sync
  chattanoogaRecordsUpdated: integer("chattanooga_records_updated").default(0), // Number of records updated in last sync
  chattanoogaRecordsSkipped: integer("chattanooga_records_skipped").default(0), // Number of records skipped in last sync
  chattanoogaRecordsFailed: integer("chattanooga_records_failed").default(0), // Number of records failed in last sync
  chattanoogaTotalRecords: integer("chattanooga_total_records").default(0), // Total records processed in last sync
  
  // Bill Hicks & Co. specific inventory sync tracking
  billHicksInventorySyncEnabled: boolean("bill_hicks_inventory_sync_enabled").default(true), // Enable automated inventory sync
  billHicksInventorySyncTime: text("bill_hicks_inventory_sync_time").default("03:00"), // Time to run daily inventory sync
  billHicksLastInventorySync: timestamp("bill_hicks_last_inventory_sync"), // When inventory was last synced from FTP
  billHicksInventorySyncStatus: text("bill_hicks_inventory_sync_status").default("never_synced"), // 'success', 'error', 'in_progress', 'never_synced'
  billHicksInventorySyncError: text("bill_hicks_inventory_sync_error"), // Error details if inventory sync fails
  billHicksLastSyncRecordsUpdated: integer("bill_hicks_last_sync_records_updated").default(0), // Number of inventory records updated in last sync
  billHicksLastSyncRecordsSkipped: integer("bill_hicks_last_sync_records_skipped").default(0), // Number of inventory records skipped in last sync
  billHicksLastSyncRecordsFailed: integer("bill_hicks_last_sync_records_failed").default(0), // Number of inventory records that failed in last sync
  billHicksInventoryRecordsAdded: integer("bill_hicks_inventory_records_added").default(0), // Number of inventory records added
  billHicksInventoryRecordsFailed: integer("bill_hicks_inventory_records_failed").default(0), // Number of inventory records that failed
  billHicksInventoryTotalRecords: integer("bill_hicks_inventory_total_records").default(0), // Total inventory records processed
  
  // Enhanced differential sync statistics for Bill Hicks
  billHicksLastSyncRecordsAdded: integer("bill_hicks_last_sync_records_added").default(0), // Number of new inventory records added in last sync
  billHicksLastSyncRecordsRemoved: integer("bill_hicks_last_sync_records_removed").default(0), // Number of inventory records removed (set to 0) in last sync
  billHicksLastSyncRecordsUnchanged: integer("bill_hicks_last_sync_records_unchanged").default(0), // Number of inventory records with no changes in last sync
  billHicksLastSyncTotalRecords: integer("bill_hicks_last_sync_total_records").default(0), // Total number of records processed in last sync
  
  // Bill Hicks master catalog sync settings and status (admin-level)
  billHicksMasterCatalogSyncEnabled: boolean("bill_hicks_master_catalog_sync_enabled").default(true),
  billHicksMasterCatalogSyncTime: varchar("bill_hicks_master_catalog_sync_time", { length: 5 }).default('02:00'),
  billHicksMasterCatalogSyncStatus: varchar("bill_hicks_master_catalog_sync_status", { length: 20 }).default('not_configured'), // 'not_configured', 'in_progress', 'success', 'error'
  billHicksMasterCatalogLastSync: timestamp("bill_hicks_master_catalog_last_sync"),
  billHicksMasterCatalogSyncError: text("bill_hicks_master_catalog_sync_error"),
  
  // Bill Hicks master catalog sync statistics
  billHicksMasterCatalogRecordsAdded: integer("bill_hicks_master_catalog_records_added").default(0),
  billHicksMasterCatalogRecordsUpdated: integer("bill_hicks_master_catalog_records_updated").default(0),
  billHicksMasterCatalogRecordsFailed: integer("bill_hicks_master_catalog_records_failed").default(0),
  billHicksMasterCatalogRecordsSkipped: integer("bill_hicks_master_catalog_records_skipped").default(0),
  billHicksMasterCatalogTotalRecords: integer("bill_hicks_master_catalog_total_records").default(0),
  
  // Lipsey's catalog sync settings and status (admin-level)
  lipseysCatalogSyncEnabled: boolean("lipseys_catalog_sync_enabled").default(false),
  lipseysCatalogSyncTime: varchar("lipseys_catalog_sync_time", { length: 5 }).default('08:00'),
  lipseysCatalogSyncFrequency: text("lipseys_catalog_sync_frequency").default('daily'),
  lipseysCatalogSyncStatus: varchar("lipseys_catalog_sync_status", { length: 20 }).default('not_configured'), // 'not_configured', 'in_progress', 'success', 'error'
  lipseysLastCatalogSync: timestamp("lipseys_last_catalog_sync"),
  lipseysCatalogSyncError: text("lipseys_catalog_sync_error"),
  
  // Lipsey's catalog sync statistics
  lipseysRecordsAdded: integer("lipseys_records_added").default(0),
  lipseysRecordsUpdated: integer("lipseys_records_updated").default(0),
  lipseysRecordsSkipped: integer("lipseys_records_skipped").default(0),
  lipseysRecordsFailed: integer("lipseys_records_failed").default(0),
  lipseysTotalRecords: integer("lipseys_total_records").default(0),
  lipseysImagesAdded: integer("lipseys_images_added").default(0),
  lipseysImagesUpdated: integer("lipseys_images_updated").default(0),
  
  vendorType: text("vendor_type").default("vendor"), // 'vendor' or 'marketplace'
  nameAliases: text("name_aliases").array(), // Alternative names for vendor lookup
  isEnabled: boolean("is_enabled").default(true),
  sortOrder: integer("sort_order").default(0),
  productRecordPriority: integer("product_record_priority").notNull().unique(), // 1-N priority for product data quality (1 = highest priority, N = lowest)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Junction table for many-to-many relationship between supportedVendors and retailVerticals
export const supportedVendorRetailVerticals = pgTable("supported_vendor_retail_verticals", {
  id: serial("id").primaryKey(),
  supportedVendorId: integer("supported_vendor_id").references(() => supportedVendors.id).notNull(),
  retailVerticalId: integer("retail_vertical_id").references(() => retailVerticals.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Unique constraint to prevent duplicates
  vendorVerticalUnique: unique("vendor_vertical_unique").on(table.supportedVendorId, table.retailVerticalId),
}));

// Vendor field mappings for CSV imports - saves column mappings per vendor
export const vendorFieldMappings = pgTable("vendor_field_mappings", {
  id: serial("id").primaryKey(),
  vendorSource: text("vendor_source").notNull(), // e.g., "Lipsey's", "Chattanooga", "Generic CSV Import"
  mappingName: text("mapping_name").notNull().default("Default"), // Allow multiple mappings per vendor
  columnMappings: json("column_mappings").$type<Record<string, string>>().notNull(), // e.g., {"upc": "Item UPC", "name": "Description"}
  
  // Contract approval system - CRITICAL SECURITY
  status: text("status").notNull().default("draft"), // 'draft', 'approved', 'active', 'inactive', 'rejected'
  approvedAt: timestamp("approved_at"), // When mapping was approved for use
  approvedBy: text("approved_by"), // User ID who approved the mapping
  
  lastUsed: timestamp("last_used").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  vendorMappingUnique: unique("vendor_mapping_unique").on(table.vendorSource, table.mappingName),
}));

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  supportedVendorId: integer("supported_vendor_id").references(() => supportedVendors.id),
  name: text("name").notNull(), // Full vendor name (e.g., "Lipsey's Inc.")
  vendorShortCode: text("vendor_short_code"), // Short code for display (e.g., "Lipsey's")
  slug: text("slug").notNull(), // Auto-generated from vendorShortCode, immutable, used for all system references
  status: text("status").notNull().default('offline'), // 'online', 'offline', 'syncing', 'error'
  isArchived: boolean("is_archived").default(false), // Organization can archive vendors
  integrationType: text("integration_type").notNull(), // 'api', 'excel'
  apiEndpoint: text("api_endpoint"),
  lastSyncDate: timestamp("last_sync_date"),
  syncStatus: text("sync_status"), // 'success', 'error', 'in_progress'
  syncError: text("sync_error"),
  credentials: json("credentials"), // Store vendor-specific credentials
  logoUrl: text("logo_url"), // URL to vendor logo for display
  enabledForPriceComparison: boolean("enabled_for_price_comparison").default(true), // Whether vendor appears in price comparison searches
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorProducts = pgTable("vendor_products", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").references(() => vendors.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  vendorSku: text("vendor_sku").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  orderNumber: text("order_number").notNull(),
  vendorId: integer("vendor_id").references(() => vendors.id).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  status: text("status").notNull().default('draft'), // 'draft', 'open', 'complete', 'cancelled'
  orderDate: timestamp("order_date").defaultNow().notNull(),
  expectedDate: timestamp("expected_date"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default('0'),
  itemCount: integer("item_count").default(0),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default('0'),
  externalOrderNumber: text("external_order_number"), // Vendor's order number from API
  notes: text("notes"),
  vendorInvoiceNumber: text("vendor_invoice_number"),
  
  // Chattanooga API: Ship-to address (can be different from store address for drop-ship)
  shipToName: text("ship_to_name"),
  shipToLine1: text("ship_to_line_1"),
  shipToLine2: text("ship_to_line_2"),
  shipToCity: text("ship_to_city"),
  shipToStateCode: text("ship_to_state_code"),
  shipToZip: text("ship_to_zip"),
  
  // Chattanooga API: Drop-ship and delivery options
  dropShipFlag: boolean("drop_ship_flag").default(false),
  customer: text("customer"), // Required when drop_ship_flag = true
  deliveryOption: text("delivery_option"), // "best", "fastest", "economy", "ground", "next_day_air", "second_day_air"
  insuranceFlag: boolean("insurance_flag").default(false),
  adultSignatureFlag: boolean("adult_signature_flag").default(false),
  fflNumber: text("ffl_number"), // For firearms orders, hyphens must be removed
  
  // Lipsey's API: Additional order fields
  orderType: text("order_type").default('standard'), // 'standard', 'dropship_accessory', 'dropship_firearm'
  warehouse: text("warehouse"), // Lipsey's warehouse selection
  customerPhone: text("customer_phone"), // Required for Lipsey's firearm drop-ship
  delayShipping: boolean("delay_shipping").default(false), // Lipsey's delay shipping option
  overnight: boolean("overnight").default(false), // Lipsey's overnight shipping
  messageForSalesExec: text("message_for_sales_exec"), // Lipsey's internal notes
  
  // Universal billing address for drop-ship orders
  billingName: text("billing_name"),
  billingLine1: text("billing_line_1"),
  billingLine2: text("billing_line_2"),
  billingCity: text("billing_city"),
  billingStateCode: text("billing_state_code"),
  billingZip: text("billing_zip"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orderNumberUnq: unique().on(table.companyId, table.orderNumber),
}));

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  // NOTE: No vendor_product_id - all vendor SKUs come from real-time API calls
  quantity: integer("quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  
  // Store vendor SKU at time of order creation (like unit cost) for webhook and historical purposes
  vendorSku: text("vendor_sku"), // Captured from real-time API call when item added to order
  
  // Store vendor pricing data at time of order creation for accurate webhook reporting
  vendorMsrp: decimal("vendor_msrp", { precision: 10, scale: 2 }), // MSRP from vendor API
  vendorMapPrice: decimal("vendor_map_price", { precision: 10, scale: 2 }), // MAP from vendor API
  
  // Store calculated retail pricing using organization's pricing configuration
  retailPrice: decimal("retail_price", { precision: 10, scale: 2 }), // Final retail price after applying pricing rules
  pricingStrategy: varchar("pricing_strategy", { length: 50 }), // Which pricing strategy was used (e.g., 'msrp', 'cost_markup')
  
  // Chattanooga API: Customer reference for tracking individual items
  customerReference: text("customer_reference"), // Optional tracking reference per item
  vendorProductId: integer("vendor_product_id").references(() => vendorProducts.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const asns = pgTable("asns", {
  id: serial("id").primaryKey(),
  asnNumber: text("asn_number").notNull().unique(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  vendorId: integer("vendor_id").references(() => vendors.id).notNull(),
  status: text("status").notNull().default('open'), // 'open', 'complete', 'cancelled'
  
  // Basic shipping fields that exist in database
  shipDate: timestamp("ship_date"),
  trackingNumber: text("tracking_number"),
  itemsShipped: integer("items_shipped").default(0),
  itemsTotal: integer("items_total").default(0),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default('0'),
  notes: text("notes"),
  rawData: json("raw_data"), // Store original webhook data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // Future ASN enhancement fields can be added via migrations
});

export const asnItems = pgTable("asn_items", {
  id: serial("id").primaryKey(),
  asnId: integer("asn_id").references(() => asns.id).notNull(),
  orderItemId: integer("order_item_id").references(() => orderItems.id).notNull(),
  
  // Basic shipping details that exist in database
  quantityShipped: integer("quantity_shipped").notNull(),
  quantityBackordered: integer("quantity_backordered").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // Additional ASN item fields can be added via migrations as needed
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull().unique(),
  platformAccountNumber: text("platform_account_number").notNull(),
  storeAddress1: text("store_address1").notNull(),
  storeAddress2: text("store_address2"),
  storeCity: text("store_city").notNull(),
  storeState: text("store_state").notNull(),
  storeZipCode: text("store_zip_code").notNull(),
  microbizEndpoint: text("microbiz_endpoint"),
  microbizApiKey: text("microbiz_api_key"),
  microbizEnabled: boolean("microbiz_enabled").default(false),
  showVendorCosts: boolean("show_vendor_costs").default(true),
  autoRefreshResults: boolean("auto_refresh_results").default(false),
  includeUnmatchedUpcs: boolean("include_unmatched_upcs").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Integration Settings for webhooks and third-party integrations
export const integrationSettings = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull().unique(),
  webhookUrl: text("webhook_url"),
  apiKey: text("api_key"),
  swipeSimpleTax: text("swipe_simple_tax").default("TRUE"),
  swipeSimpleTrackInventory: text("swipe_simple_track_inventory").default("TRUE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Billing Events and Webhooks
export const billingEvents = pgTable("billing_events", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  eventType: text("event_type").notNull(), // 'subscription_created', 'subscription_cancelled', etc.
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: text("currency").default("USD"),
  billingProvider: text("billing_provider").notNull(), // 'zoho', 'recurly', etc.
  externalId: text("external_id"), // External billing system ID
  metadata: json("metadata"), // Additional event data
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Organization status audit log for tracking manual admin changes
export const organizationStatusAuditLog = pgTable("organization_status_audit_log", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  reason: text("reason"),
  changedBy: text("changed_by").notNull(), // Admin username who made the change
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  metadata: json("metadata").$type<Record<string, any>>(), // Additional context (syncToZoho, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Usage Tracking for Billing
export const usageMetrics = pgTable("usage_metrics", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  metric: text("metric").notNull(), // 'orders_created', 'api_calls', 'storage_used'
  value: integer("value").notNull(),
  period: text("period").notNull(), // 'daily', 'monthly'
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  unq: unique().on(table.companyId, table.metric, table.period, table.date),
}));

// Search History for tracking recent searches
export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  searchQuery: text("search_query").notNull(),
  searchType: text("search_type").notNull(), // 'name', 'upc', 'partNumber', 'sku'
  productName: text("product_name"), // Store found product name if search was successful
  productUpc: text("product_upc"), // Store found product UPC
  productPartNumber: text("product_part_number"), // Store found product part number
  searchedAt: timestamp("searched_at").defaultNow().notNull(),
});

// PO Sequences for tracking sequential PO numbers per store
export const poSequences = pgTable("po_sequences", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull().unique(),
  lastSequence: integer("last_sequence").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Admin System Settings (platform-wide settings)
export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  sendgridApiKey: text("sendgrid_api_key"),
  smtp2goApiKey: text("smtp2go_api_key"), // SMTP2GO API key for alternative email service
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"),
  systemEmail: text("system_email").default("noreply@pricecompare.com"),
  systemTimeZone: text("system_time_zone").default("America/New_York"),
  maintenanceMode: boolean("maintenance_mode").default(false),
  registrationEnabled: boolean("registration_enabled").default(true),
  maxOrganizations: integer("max_organizations").default(1000),
  supportEmail: text("support_email").default("support@pricecompare.com"),
  companyName: text("company_name").default("Retail Management Platform"),
  brandName: text("brand_name").default("PriceCompare Pro"),
  supportDomain: text("support_domain").default("pricecompare.com"),
  logoUrl: text("logo_url"),
  // Zoho Billing API credentials (optional - fallback to env vars if not set)
  zohoBillingClientId: text("zoho_billing_client_id"),
  zohoBillingClientSecret: text("zoho_billing_client_secret"),
  zohoBillingRefreshToken: text("zoho_billing_refresh_token"),
  zohoBillingOrgId: text("zoho_billing_org_id"),
  zohoBillingBaseUrl: text("zoho_billing_base_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});



// Relations
export const supportedVendorsRelations = relations(supportedVendors, ({ many }) => ({
  vendors: many(vendors),
  supportedVendorRetailVerticals: many(supportedVendorRetailVerticals),
}));

export const supportedVendorRetailVerticalsRelations = relations(supportedVendorRetailVerticals, ({ one }) => ({
  supportedVendor: one(supportedVendors, {
    fields: [supportedVendorRetailVerticals.supportedVendorId],
    references: [supportedVendors.id],
  }),
  retailVertical: one(retailVerticals, {
    fields: [supportedVendorRetailVerticals.retailVerticalId],
    references: [retailVerticals.id],
  }),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  users: many(users),
  vendors: many(vendors),
  orders: many(orders),
  settings: many(settings),
  billingEvents: many(billingEvents),
  usageMetrics: many(usageMetrics),
  searchHistory: many(searchHistory),
  retailVertical: one(retailVerticals, {
    fields: [companies.retailVerticalId],
    references: [retailVerticals.id],
  }),
}));

export const retailVerticalsRelations = relations(retailVerticals, ({ many }) => ({
  companies: many(companies),
  products: many(products),
  supportedVendorRetailVerticals: many(supportedVendorRetailVerticals),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  company: one(companies, {
    fields: [stores.companyId],
    references: [companies.id],
  }),
  orders: many(orders),
  userStores: many(userStores),
}));

export const userStoresRelations = relations(userStores, ({ one }) => ({
  user: one(users, {
    fields: [userStores.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [userStores.storeId],
    references: [stores.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  orders: many(orders),
  searchHistory: many(searchHistory),
  userStores: many(userStores),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  retailVertical: one(retailVerticals, {
    fields: [products.retailVerticalId],
    references: [retailVerticals.id],
  }),
  orderItems: many(orderItems),
  asnItems: many(asnItems),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  company: one(companies, {
    fields: [vendors.companyId],
    references: [companies.id],
  }),
  supportedVendor: one(supportedVendors, {
    fields: [vendors.supportedVendorId],
    references: [supportedVendors.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  company: one(companies, {
    fields: [orders.companyId],
    references: [companies.id],
  }),
  store: one(stores, {
    fields: [orders.storeId],
    references: [stores.id],
  }),
  vendor: one(vendors, {
    fields: [orders.vendorId],
    references: [vendors.id],
  }),
  createdBy: one(users, {
    fields: [orders.createdBy],
    references: [users.id],
  }),
  orderItems: many(orderItems),
  asns: many(asns),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  company: one(companies, {
    fields: [searchHistory.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});



export const insertAdminUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
  companyId: true,
}).extend({
  role: z.enum(['devops', 'admin', 'support']).default('devops'),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
});

export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});

export const insertSupportedVendorSchema = createInsertSchema(supportedVendors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorProductSchema = createInsertSchema(vendorProducts).omit({
  id: true,
  lastUpdated: true,
});

export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
});



export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertASNSchema = createInsertSchema(asns).omit({
  id: true,
  createdAt: true,
});

export const insertASNItemSchema = createInsertSchema(asnItems).omit({
  id: true,
  createdAt: true,
});

export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({
  id: true,
  searchedAt: true,
});

// Type exports
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;

// Product Categories table for company-specific category management
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    companySlugUnique: unique("company_category_slug_unique").on(table.companyId, table.slug),
    companyNameUnique: unique("company_category_name_unique").on(table.companyId, table.name),
  };
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// Zod schemas for categories
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCategoryData = z.infer<typeof insertCategorySchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type SupportedVendor = typeof supportedVendors.$inferSelect;
export type InsertSupportedVendor = z.infer<typeof insertSupportedVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type ASN = typeof asns.$inferSelect;
export type InsertASN = z.infer<typeof insertASNSchema>;
export type ASNItem = typeof asnItems.$inferSelect;
export type InsertASNItem = z.infer<typeof insertASNItemSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type UsageMetric = typeof usageMetrics.$inferSelect;
export type AdminSettings = typeof adminSettings.$inferSelect;
export type PoSequence = typeof poSequences.$inferSelect;
export type InsertPoSequence = typeof poSequences.$inferInsert;
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type VendorProductMapping = typeof vendorProductMappings.$inferSelect;
export type InsertVendorProductMapping = typeof vendorProductMappings.$inferInsert;

// Retail verticals schemas
export const insertRetailVerticalSchema = createInsertSchema(retailVerticals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RetailVertical = typeof retailVerticals.$inferSelect;
export type InsertRetailVertical = z.infer<typeof insertRetailVerticalSchema>;

// Junction table schemas
export const insertSupportedVendorRetailVerticalSchema = createInsertSchema(supportedVendorRetailVerticals).omit({
  id: true,
  createdAt: true,
});

export type SupportedVendorRetailVertical = typeof supportedVendorRetailVerticals.$inferSelect;
export type InsertSupportedVendorRetailVertical = z.infer<typeof insertSupportedVendorRetailVerticalSchema>;

// Import jobs for tracking bulk imports
export const importJobs = pgTable("import_jobs", {
  id: text("id").primaryKey(), // UUID-style ID
  companyId: integer("organization_id").references(() => companies.id),
  filename: text("filename").notNull(),
  totalRows: integer("total_rows").notNull(),
  processedRows: integer("processed_rows").default(0),
  successfulRows: integer("successful_rows").default(0),
  errorRows: integer("error_rows").default(0),
  skippedRows: integer("skipped_rows").default(0),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  settings: json("settings").$type<{
    duplicateHandling: 'ignore' | 'overwrite';
    vendorId?: number;
    createVendorRelationships: boolean;
    columnMapping: Record<string, string>;
    requiredFields: string[];
  }>().notNull(),
  errors: json("errors").$type<Array<{ row: number; error: string; data: any }>>().default([]),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
});

export const insertImportJobSchema = createInsertSchema(importJobs).omit({
  startTime: true,
});

export type ImportJob = typeof importJobs.$inferSelect;
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;

// Store schemas and types
export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;

// User-Store assignment schemas and types
export const insertUserStoreSchema = createInsertSchema(userStores).omit({
  id: true,
  assignedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  permissions: z.array(z.string()).default(['read']).optional()
});

export type UserStore = typeof userStores.$inferSelect;
export type InsertUserStore = z.infer<typeof insertUserStoreSchema>;

// Pricing Configuration schemas and types
export const insertPricingConfigurationSchema = createInsertSchema(pricingConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PricingConfiguration = typeof pricingConfigurations.$inferSelect;
export type InsertPricingConfiguration = z.infer<typeof insertPricingConfigurationSchema>;

export type VendorProduct = typeof vendorProducts.$inferSelect;
export type InsertVendorProduct = z.infer<typeof insertVendorProductSchema>;

// Vendor Inventory - Shared stock levels for FTP vendors (like Bill Hicks)
export const vendorInventory = pgTable("vendor_inventory", {
  id: serial("id").primaryKey(),
  supportedVendorId: integer("supported_vendor_id").references(() => supportedVendors.id).notNull(),
  vendorSku: text("vendor_sku").notNull(), // Bill Hicks Product field
  quantityAvailable: integer("quantity_available").notNull().default(0), // Bill Hicks "Qty Avail"
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    // One inventory record per vendor SKU per vendor
    vendorSkuUnique: unique("vendor_inventory_sku_unique").on(table.supportedVendorId, table.vendorSku),
    // Index for fast inventory lookups
    vendorSkuInventoryIndex: index("vendor_sku_inventory_idx").on(table.supportedVendorId, table.vendorSku),
  };
});

// Company Vendor Credentials - Store-level vendor credentials for multi-tenant vendors
export const companyVendorCredentials = pgTable("company_vendor_credentials", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  supportedVendorId: integer("supported_vendor_id").references(() => supportedVendors.id).notNull(),
  
  // FTP credentials for Bill Hicks
  ftpServer: text("ftp_server"),
  ftpPort: integer("ftp_port").default(21),
  ftpUsername: text("ftp_username"),
  ftpPassword: text("ftp_password"), // Encrypted storage
  ftpBasePath: text("ftp_base_path").default("/"),
  
  // API credentials for Sports South and other API-based vendors
  userName: text("user_name"),
  password: text("password"), // Encrypted storage
  source: text("source"),
  customerNumber: text("customer_number"),
  
  // API credentials for Chattanooga and other API-based vendors
  apiKey: text("api_key"),
  apiSecret: text("api_secret"), // Encrypted storage
  
  // Chattanooga-specific credentials
  sid: text("sid"),
  token: text("token"), // Encrypted storage
  
  // Sync configuration 
  catalogSyncEnabled: boolean("catalog_sync_enabled").default(true),
  catalogSyncSchedule: text("catalog_sync_schedule").default("0 4 * * *"), // Daily at 4 AM
  inventorySyncEnabled: boolean("inventory_sync_enabled").default(true),
  inventorySyncSchedule: text("inventory_sync_schedule").default("0 */6 * * *"), // Every 6 hours
  
  // Sync status tracking
  lastCatalogSync: timestamp("last_catalog_sync"),
  catalogSyncStatus: text("catalog_sync_status").default("never_synced"), // 'success', 'error', 'in_progress', 'never_synced'
  catalogSyncError: text("catalog_sync_error"),
  lastCatalogRecordsCreated: integer("last_catalog_records_created").default(0),
  lastCatalogRecordsUpdated: integer("last_catalog_records_updated").default(0),
  lastCatalogRecordsDeactivated: integer("last_catalog_records_deactivated").default(0),
  lastCatalogRecordsSkipped: integer("last_catalog_records_skipped").default(0),
  lastCatalogRecordsFailed: integer("last_catalog_records_failed").default(0),
  lastCatalogRecordsProcessed: integer("last_catalog_records_processed").default(0),
  
  lastInventorySync: timestamp("last_inventory_sync"),
  inventorySyncStatus: text("inventory_sync_status").default("never_synced"), // 'success', 'error', 'in_progress', 'never_synced'
  inventorySyncError: text("inventory_sync_error"),
  lastInventoryRecordsUpdated: integer("last_inventory_records_updated").default(0),
  lastInventorySkusProcessed: integer("last_inventory_skus_processed").default(0),
  
  // Connection testing
  connectionStatus: text("connection_status").default("not_tested"), // 'not_tested', 'online', 'offline', 'error'
  lastConnectionTest: timestamp("last_connection_test"),
  connectionError: text("connection_error"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    // One credential set per company per vendor
    companyVendorUnique: unique("company_vendor_credentials_unique").on(table.companyId, table.supportedVendorId),
  };
});

// Vendor inventory schemas and types
export const insertVendorInventorySchema = createInsertSchema(vendorInventory).omit({
  id: true,
  createdAt: true,
});

export type VendorInventory = typeof vendorInventory.$inferSelect;
export type InsertVendorInventory = z.infer<typeof insertVendorInventorySchema>;

// Company vendor credentials schemas and types
export const insertCompanyVendorCredentialsSchema = createInsertSchema(companyVendorCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CompanyVendorCredentials = typeof companyVendorCredentials.$inferSelect;
export type InsertCompanyVendorCredentials = z.infer<typeof insertCompanyVendorCredentialsSchema>;

// Enhanced Subscription Management Tables

// Subscription details with full Zoho integration
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  planId: text("plan_id").notNull(), // 'free', 'standard', 'enterprise'
  status: text("status").notNull(), // 'active', 'trial', 'cancelled', 'suspended', 'past_due'
  
  // Billing provider integration
  billingProvider: text("billing_provider").notNull().default("zoho"), // 'zoho', 'recurly'
  externalSubscriptionId: text("external_subscription_id"), // Zoho subscription ID
  externalCustomerId: text("external_customer_id"), // Zoho customer ID
  externalSubscriptionNumber: text("external_subscription_number"), // SUB-00037 format
  
  // Subscription periods
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  
  // Billing details
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: text("currency").default("USD"),
  billingCycle: text("billing_cycle").default("month"), // 'month', 'year'
  nextBillingDate: timestamp("next_billing_date"),
  
  // Cancellation details
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  
  // Auto-renewal
  autoRenew: boolean("auto_renew").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Plan Settings Configuration - Dynamic plan management
export const planSettings = pgTable("plan_settings", {
  id: serial("id").primaryKey(),
  planId: text("plan_id").notNull().unique(), // 'free', 'standard', 'enterprise'
  planName: text("plan_name").notNull(), // Display name
  
  // Plan duration and trial settings
  trialLengthDays: integer("trial_length_days"), // null for no trial, number for trial days
  planLengthDays: integer("plan_length_days"), // null for unlimited, number for limited plans
  
  // User and vendor limits
  maxUsers: integer("max_users"), // null for unlimited, number for limit
  maxVendors: integer("max_vendors"), // null for unlimited, number for limit
  
  // Feature toggles
  onlineOrdering: boolean("online_ordering").default(false),
  asnProcessing: boolean("asn_processing").default(false),
  webhookExport: boolean("webhook_export").default(false),
  
  // Metadata
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Subscription plan change history
export const subscriptionPlanChanges = pgTable("subscription_plan_changes", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  
  // Plan change details
  fromPlanId: text("from_plan_id"), // Previous plan
  toPlanId: text("to_plan_id").notNull(), // New plan
  changeType: text("change_type").notNull(), // 'upgrade', 'downgrade', 'plan_change'
  changeReason: text("change_reason"), // User-provided reason
  
  // Billing adjustments
  proratedAmount: decimal("prorated_amount", { precision: 10, scale: 2 }),
  effectiveDate: timestamp("effective_date").notNull(),
  
  // External system tracking
  externalEventId: text("external_event_id"), // Zoho event ID
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Payment history and invoices
export const subscriptionPayments = pgTable("subscription_payments", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  
  // Payment details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  status: text("status").notNull(), // 'paid', 'pending', 'failed', 'refunded'
  paymentMethod: text("payment_method"), // 'card', 'ach', 'check'
  
  // External system references
  externalPaymentId: text("external_payment_id"), // Zoho payment ID
  externalInvoiceId: text("external_invoice_id"), // Zoho invoice ID
  externalInvoiceNumber: text("external_invoice_number"), // INV-00123 format
  
  // Timing
  paidAt: timestamp("paid_at"),
  dueDate: timestamp("due_date"),
  
  // Failure handling
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Enhanced webhook events for subscription management
export const subscriptionWebhookEvents = pgTable("subscription_webhook_events", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id),
  
  // Webhook details
  eventType: text("event_type").notNull(), // 'subscription_created', 'subscription_cancelled', 'payment_succeeded', etc.
  source: text("source").notNull().default("zoho"), // 'zoho', 'recurly', 'manual'
  externalEventId: text("external_event_id"), // Unique event ID from billing provider
  
  // Event data
  eventData: json("event_data"), // Raw webhook payload
  processedData: json("processed_data"), // Extracted/processed data
  
  // Processing status
  status: text("status").default("pending"), // 'pending', 'processed', 'failed', 'ignored'
  processedAt: timestamp("processed_at"),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  
  // Response tracking
  responseStatus: integer("response_status"), // HTTP status code
  responseBody: text("response_body"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Usage tracking for plan limits
export const subscriptionUsage = pgTable("subscription_usage", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id).notNull(),
  
  // Usage metrics
  currentVendors: integer("current_vendors").default(0),
  currentUsers: integer("current_users").default(0),
  currentOrders: integer("current_orders").default(0),
  
  // Monthly aggregates
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  ordersThisMonth: integer("orders_this_month").default(0),
  asnsProcessedThisMonth: integer("asns_processed_this_month").default(0),
  
  // Limit violations
  vendorLimitExceeded: boolean("vendor_limit_exceeded").default(false),
  userLimitExceeded: boolean("user_limit_exceeded").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    companyMonthYear: unique("company_month_year_unique").on(table.companyId, table.month, table.year),
  };
});

// Subscription schemas and types
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlanSettingsSchema = createInsertSchema(planSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionPlanChangeSchema = createInsertSchema(subscriptionPlanChanges).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPayments).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionWebhookEventSchema = createInsertSchema(subscriptionWebhookEvents).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionUsageSchema = createInsertSchema(subscriptionUsage).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type PlanSettings = typeof planSettings.$inferSelect;
export type InsertPlanSettings = z.infer<typeof insertPlanSettingsSchema>;

export type SubscriptionPlanChange = typeof subscriptionPlanChanges.$inferSelect;
export type InsertSubscriptionPlanChange = z.infer<typeof insertSubscriptionPlanChangeSchema>;

export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type InsertSubscriptionPayment = z.infer<typeof insertSubscriptionPaymentSchema>;

export type SubscriptionWebhookEvent = typeof subscriptionWebhookEvents.$inferSelect;
export type InsertSubscriptionWebhookEvent = z.infer<typeof insertSubscriptionWebhookEventSchema>;

export type SubscriptionUsage = typeof subscriptionUsage.$inferSelect;
export type InsertSubscriptionUsage = z.infer<typeof insertSubscriptionUsageSchema>;

// Vendor field mapping schemas and types
export const insertVendorFieldMappingSchema = createInsertSchema(vendorFieldMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VendorFieldMapping = typeof vendorFieldMappings.$inferSelect;
export type InsertVendorFieldMapping = z.infer<typeof insertVendorFieldMappingSchema>;

// Organization domains schemas and types
export const insertOrgDomainSchema = createInsertSchema(orgDomains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrgDomain = typeof orgDomains.$inferSelect;
export type InsertOrgDomain = z.infer<typeof insertOrgDomainSchema>;

// Organization status audit log schemas and types
export const insertOrganizationStatusAuditLogSchema = createInsertSchema(organizationStatusAuditLog).omit({
  id: true,
  createdAt: true,
});

export type OrganizationStatusAuditLog = typeof organizationStatusAuditLog.$inferSelect;
export type InsertOrganizationStatusAuditLog = z.infer<typeof insertOrganizationStatusAuditLogSchema>;
import { pgTable, foreignKey, serial, integer, numeric, timestamp, text, varchar, unique, json, jsonb, boolean, uniqueIndex, index, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const orderItems = pgTable("order_items", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	productId: integer("product_id").notNull(),
	quantity: integer().notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  2 }).notNull(),
	totalCost: numeric("total_cost", { precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	customerReference: text("customer_reference"),
	vendorProductId: integer("vendor_product_id"),
	vendorSku: text("vendor_sku"),
	vendorMsrp: numeric("vendor_msrp", { precision: 10, scale:  2 }),
	vendorMapPrice: numeric("vendor_map_price", { precision: 10, scale:  2 }),
	retailPrice: numeric("retail_price", { precision: 10, scale:  2 }),
	pricingStrategy: varchar("pricing_strategy", { length: 50 }),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_orders_id_fk"
		}),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "order_items_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.vendorProductId],
			foreignColumns: [vendorProducts.id],
			name: "order_items_vendor_product_id_fkey"
		}),
]);

export const asns = pgTable("asns", {
	id: serial().primaryKey().notNull(),
	asnNumber: text("asn_number").notNull(),
	orderId: integer("order_id").notNull(),
	vendorId: integer("vendor_id").notNull(),
	status: text().default('open').notNull(),
	shipDate: timestamp("ship_date", { mode: 'string' }),
	trackingNumber: text("tracking_number"),
	itemsShipped: integer("items_shipped").default(0),
	itemsTotal: integer("items_total").default(0),
	shippingCost: numeric("shipping_cost", { precision: 10, scale:  2 }).default('0'),
	notes: text(),
	rawData: json("raw_data"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "asns_order_id_orders_id_fk"
		}),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "asns_vendor_id_vendors_id_fk"
		}),
	unique("asns_asn_number_unique").on(table.asnNumber),
]);

export const companies = pgTable("companies", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	plan: text().default('basic').notNull(),
	status: text().default('active').notNull(),
	billingProvider: text("billing_provider"),
	billingCustomerId: text("billing_customer_id"),
	billingSubscriptionId: text("billing_subscription_id"),
	trialEndsAt: timestamp("trial_ends_at", { mode: 'string' }),
	maxUsers: integer("max_users").default(3).notNull(),
	maxVendors: integer("max_vendors").default(2).notNull(),
	maxOrdersPerMonth: integer("max_orders_per_month").default(100).notNull(),
	features: jsonb().default({}).notNull(),
	settings: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	email: text(),
	phone: text(),
	billingSubscriptionNumber: text("billing_subscription_number"),
	maxOrders: integer("max_orders").default(500),
	logoUrl: text("logo_url"),
	trialStatus: text("trial_status"),
	trialStartedAt: timestamp("trial_started_at", { mode: 'string' }),
	trialExtensions: integer("trial_extensions").default(0),
	retailVerticalId: integer("retail_vertical_id"),
}, (table) => [
	foreignKey({
			columns: [table.retailVerticalId],
			foreignColumns: [retailVerticals.id],
			name: "organizations_retail_vertical_id_fkey"
		}),
	unique("organizations_slug_key").on(table.slug),
]);

export const billingEvents = pgTable("billing_events", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	eventType: text("event_type").notNull(),
	amount: numeric({ precision: 10, scale:  2 }),
	currency: text().default('USD').notNull(),
	billingProvider: text("billing_provider").notNull(),
	externalId: text("external_id"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	processed: boolean().default(false),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "billing_events_organization_id_fkey"
		}),
]);

export const asnItems = pgTable("asn_items", {
	id: serial().primaryKey().notNull(),
	asnId: integer("asn_id").notNull(),
	orderItemId: integer("order_item_id").notNull(),
	quantityShipped: integer("quantity_shipped").notNull(),
	quantityBackordered: integer("quantity_backordered").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.asnId],
			foreignColumns: [asns.id],
			name: "asn_items_asn_id_asns_id_fk"
		}),
	foreignKey({
			columns: [table.orderItemId],
			foreignColumns: [orderItems.id],
			name: "asn_items_order_item_id_order_items_id_fk"
		}),
]);

export const vendors = pgTable("vendors", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	status: text().default('connected').notNull(),
	credentials: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	companyId: integer("company_id").default(1).notNull(),
	supportedVendorId: integer("supported_vendor_id"),
	integrationType: text("integration_type").default('api').notNull(),
	isArchived: boolean("is_archived").default(false),
	apiEndpoint: text("api_endpoint"),
	lastSyncDate: timestamp("last_sync_date", { mode: 'string' }),
	syncStatus: text("sync_status"),
	syncError: text("sync_error"),
	vendorShortCode: text("vendor_short_code"),
	logoUrl: text("logo_url"),
	enabledForPriceComparison: boolean("enabled_for_price_comparison").default(true),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "vendors_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.supportedVendorId],
			foreignColumns: [supportedVendors.id],
			name: "vendors_supported_vendor_id_fkey"
		}),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	password: text(),
	companyId: integer("company_id"),
	email: text(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	role: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	lastLogin: timestamp("last_login", { mode: 'string' }),
	displayName: text("display_name"),
	isAdmin: boolean("is_admin").default(false),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	defaultStoreId: integer("default_store_id"),
	status: text().default('pending_activation').notNull(),
	activationToken: text("activation_token"),
	activationTokenExpires: timestamp("activation_token_expires", { mode: 'string' }),
	passwordResetToken: text("password_reset_token"),
	passwordResetTokenExpires: timestamp("password_reset_token_expires", { mode: 'string' }),
	emailVerifiedAt: timestamp("email_verified_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.defaultStoreId],
			foreignColumns: [stores.id],
			name: "users_default_store_id_fkey"
		}),
	unique("users_username_org_unique").on(table.username, table.companyId),
]);

export const adminSettings = pgTable("admin_settings", {
	id: serial().primaryKey().notNull(),
	sendgridApiKey: text("sendgrid_api_key"),
	smtpHost: text("smtp_host"),
	smtpPort: integer("smtp_port"),
	smtpUser: text("smtp_user"),
	smtpPassword: text("smtp_password"),
	systemEmail: text("system_email").default('noreply@bestprice.com'),
	maintenanceMode: boolean("maintenance_mode").default(false),
	registrationEnabled: boolean("registration_enabled").default(true),
	maxOrganizations: integer("max_organizations").default(1000),
	supportEmail: text("support_email").default('support@bestprice.com'),
	companyName: text("company_name").default('BestPrice'),
	logoUrl: text("logo_url"),
	catalogRefreshEnabled: boolean("catalog_refresh_enabled").default(true),
	catalogRefreshTime: text("catalog_refresh_time").default('02:00'),
	catalogRefreshFrequency: text("catalog_refresh_frequency").default('daily'),
	catalogRefreshDays: text("catalog_refresh_days"),
	lastCatalogRefresh: timestamp("last_catalog_refresh", { mode: 'string' }),
	refreshInProgress: boolean("refresh_in_progress").default(false),
	refreshJobId: text("refresh_job_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	brandName: text("brand_name").default('PriceCompare Pro'),
	supportDomain: text("support_domain").default('pricecompare.com'),
	systemTimeZone: text("system_time_zone").default('America/New_York'),
	zohoWebhookSecret: text("zoho_webhook_secret"),
});

export const searchHistory = pgTable("search_history", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	userId: integer("user_id").notNull(),
	searchQuery: text("search_query").notNull(),
	searchType: text("search_type").notNull(),
	productName: text("product_name"),
	productUpc: text("product_upc"),
	productPartNumber: text("product_part_number"),
	searchedAt: timestamp("searched_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "search_history_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "search_history_user_id_fkey"
		}),
]);

export const vendorFieldMappings = pgTable("vendor_field_mappings", {
	id: serial().primaryKey().notNull(),
	vendorSource: text("vendor_source").notNull(),
	mappingName: text("mapping_name").default('Default').notNull(),
	columnMappings: jsonb("column_mappings").notNull(),
	lastUsed: timestamp("last_used", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	status: varchar({ length: 20 }).default('draft'),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	approvedBy: varchar("approved_by", { length: 100 }),
}, (table) => [
	unique("vendor_field_mappings_vendor_source_mapping_name_key").on(table.vendorSource, table.mappingName),
]);

export const retailVerticals = pgTable("retail_verticals", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	isActive: boolean("is_active").default(true),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	color: varchar({ length: 7 }).default('#3B82F6'),
}, (table) => [
	unique("retail_verticals_name_key").on(table.name),
	unique("retail_verticals_slug_key").on(table.slug),
]);

export const importJobs = pgTable("import_jobs", {
	id: text().primaryKey().notNull(),
	organizationId: integer("organization_id"),
	filename: text().notNull(),
	totalRows: integer("total_rows").notNull(),
	processedRows: integer("processed_rows").default(0),
	successfulRows: integer("successful_rows").default(0),
	errorRows: integer("error_rows").default(0),
	status: text().default('pending').notNull(),
	settings: jsonb().notNull(),
	errors: jsonb().default([]),
	startTime: timestamp("start_time", { mode: 'string' }).defaultNow().notNull(),
	endTime: timestamp("end_time", { mode: 'string' }),
	createdBy: integer("created_by").notNull(),
	skippedRows: integer("skipped_rows").default(0),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [companies.id],
			name: "import_jobs_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "import_jobs_created_by_fkey"
		}),
]);

export const userStores = pgTable("user_stores", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	storeId: integer("store_id").notNull(),
	role: text().default('employee').notNull(),
	permissions: json(),
	isActive: boolean("is_active").default(true),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_stores_user_id_fkey"
		}),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [stores.id],
			name: "user_stores_store_id_fkey"
		}),
	unique("user_stores_user_id_store_id_key").on(table.userId, table.storeId),
]);

export const settings = pgTable("settings", {
	id: serial().primaryKey().notNull(),
	platformAccountNumber: text("platform_account_number").notNull(),
	storeAddress: text("store_address").notNull(),
	microbizEndpoint: text("microbiz_endpoint"),
	microbizApiKey: text("microbiz_api_key"),
	showVendorCosts: boolean("show_vendor_costs").default(true),
	autoRefreshResults: boolean("auto_refresh_results").default(false),
	includeUnmatchedUpcs: boolean("include_unmatched_upcs").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	companyId: integer("company_id"),
	microbizEnabled: boolean("microbiz_enabled").default(false),
	storeAddress1: text("store_address1").default(').notNull(),
	storeAddress2: text("store_address2"),
	storeCity: text("store_city").default(').notNull(),
	storeState: text("store_state").default(').notNull(),
	storeZipCode: text("store_zip_code").default(').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "settings_organization_id_fkey"
		}),
]);

export const userPreferences = pgTable("user_preferences", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	preferenceType: text("preference_type").notNull(),
	preferences: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_preferences_user_id_fkey"
		}),
	unique("user_preferences_user_id_preference_type_key").on(table.userId, table.preferenceType),
]);

export const stores = pgTable("stores", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	phone: text(),
	email: text(),
	fflNumber: text("ffl_number"),
	storeNumber: text("store_number"),
	isActive: boolean("is_active").default(true),
	timezone: text().default('America/New_York'),
	currency: text().default('USD'),
	settings: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	status: text().default('active'),
	address1: text(),
	address2: text(),
	city: text(),
	state: text(),
	zipCode: text("zip_code"),
	shortName: text("short_name").notNull(),
	country: text().default('US'),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "stores_company_id_fkey"
		}),
	unique("stores_company_id_slug_key").on(table.companyId, table.slug),
]);

export const vendorProducts = pgTable("vendor_products", {
	id: serial().primaryKey().notNull(),
	vendorId: integer("vendor_id").notNull(),
	productId: integer("product_id").notNull(),
	vendorSku: text("vendor_sku").notNull(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "vendor_products_vendor_id_fkey"
		}),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "vendor_products_product_id_fkey"
		}),
]);

export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	orderNumber: text("order_number").notNull(),
	vendorId: integer("vendor_id").notNull(),
	status: text().default('draft').notNull(),
	orderDate: timestamp("order_date", { mode: 'string' }).defaultNow().notNull(),
	expectedDate: timestamp("expected_date", { mode: 'string' }),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).default('0'),
	itemCount: integer("item_count").default(0),
	shippingCost: numeric("shipping_cost", { precision: 10, scale:  2 }).default('0'),
	notes: text(),
	vendorInvoiceNumber: text("vendor_invoice_number"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	externalOrderNumber: text("external_order_number"),
	companyId: integer("company_id").default(1).notNull(),
	createdBy: integer("created_by"),
	storeId: integer("store_id"),
	shipToName: text("ship_to_name"),
	shipToLine1: text("ship_to_line_1"),
	shipToLine2: text("ship_to_line_2"),
	shipToCity: text("ship_to_city"),
	shipToStateCode: text("ship_to_state_code"),
	shipToZip: text("ship_to_zip"),
	dropShipFlag: boolean("drop_ship_flag").default(false),
	customer: text(),
	deliveryOption: text("delivery_option"),
	insuranceFlag: boolean("insurance_flag").default(false),
	adultSignatureFlag: boolean("adult_signature_flag").default(false),
	warehouse: text(),
	customerPhone: text("customer_phone"),
	delayShipping: boolean("delay_shipping").default(false),
	overnight: boolean().default(false),
	messageForSalesExec: text("message_for_sales_exec"),
	fflNumber: text("ffl_number"),
	orderType: text("order_type").default('standard'),
	billingName: text("billing_name"),
	billingLine1: text("billing_line_1"),
	billingLine2: text("billing_line_2"),
	billingCity: text("billing_city"),
	billingStateCode: text("billing_state_code"),
	billingZip: text("billing_zip"),
}, (table) => [
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "orders_vendor_id_vendors_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "orders_organization_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "orders_created_by_fkey"
		}),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [stores.id],
			name: "orders_store_id_fkey"
		}),
	unique("orders_order_number_unique").on(table.orderNumber),
]);

export const poSequences = pgTable("po_sequences", {
	id: serial().primaryKey().notNull(),
	storeId: integer("store_id").notNull(),
	lastSequence: integer("last_sequence").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [stores.id],
			name: "po_sequences_store_id_fkey"
		}),
]);

export const pricingConfigurations = pgTable("pricing_configurations", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	strategy: varchar({ length: 50 }).notNull(),
	markupPercentage: numeric("markup_percentage", { precision: 5, scale:  2 }),
	isDefault: boolean("is_default").default(false),
	isActive: boolean("is_active").default(true),
	retailVerticalId: integer("retail_vertical_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	marginPercentage: numeric("margin_percentage", { precision: 5, scale:  2 }),
	premiumAmount: numeric("premium_amount", { precision: 10, scale:  2 }),
	discountPercentage: numeric("discount_percentage", { precision: 5, scale:  2 }),
	roundingAmount: numeric("rounding_amount", { precision: 3, scale:  2 }),
	fallbackStrategy: text("fallback_strategy"),
	fallbackMarkupPercentage: numeric("fallback_markup_percentage", { precision: 5, scale:  2 }),
	roundingRule: text("rounding_rule").default('none'),
	useCrossVendorFallback: boolean("use_cross_vendor_fallback").default(false),
}, (table) => [
	uniqueIndex("idx_pricing_configurations_company_default").using("btree", table.companyId.asc().nullsLast().op("int4_ops")).where(sql`(is_default = true)`),
	index("idx_pricing_configurations_company_id").using("btree", table.companyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "pricing_configurations_company_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.retailVerticalId],
			foreignColumns: [retailVerticals.id],
			name: "pricing_configurations_retail_vertical_id_fkey"
		}),
	check("pricing_configurations_strategy_check", sql`(strategy)::text = ANY ((ARRAY['map'::character varying, 'msrp'::character varying, 'cost_markup'::character varying, 'cost_margin'::character varying, 'map_premium'::character varying, 'msrp_discount'::character varying])::text[])`),
]);

export const vendorProductMappings = pgTable("vendor_product_mappings", {
	id: serial().primaryKey().notNull(),
	productId: integer("product_id").notNull(),
	supportedVendorId: integer("supported_vendor_id").notNull(),
	vendorSku: text("vendor_sku").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	companyId: integer("company_id"),
	vendorCost: numeric("vendor_cost", { precision: 10, scale:  2 }),
	mapPrice: numeric("map_price", { precision: 10, scale:  2 }),
	msrpPrice: numeric("msrp_price", { precision: 10, scale:  2 }),
	lastPriceUpdate: timestamp("last_price_update", { mode: 'string' }),
}, (table) => [
	index("company_vendor_idx").using("btree", table.companyId.asc().nullsLast().op("int4_ops"), table.supportedVendorId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "vendor_product_mappings_product_id_fkey"
		}),
	foreignKey({
			columns: [table.supportedVendorId],
			foreignColumns: [supportedVendors.id],
			name: "vendor_product_mappings_supported_vendor_id_fkey"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "vendor_product_mappings_company_id_fkey"
		}),
	unique("product_vendor_company_unique").on(table.productId, table.supportedVendorId, table.companyId),
]);

export const companyVendorCredentials = pgTable("company_vendor_credentials", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	supportedVendorId: integer("supported_vendor_id").notNull(),
	ftpServer: text("ftp_server"),
	ftpPort: integer("ftp_port").default(21),
	ftpUsername: text("ftp_username"),
	ftpPassword: text("ftp_password"),
	ftpBasePath: text("ftp_base_path").default('/'),
	catalogSyncEnabled: boolean("catalog_sync_enabled").default(true),
	catalogSyncSchedule: text("catalog_sync_schedule").default('0 4 * * *'),
	inventorySyncEnabled: boolean("inventory_sync_enabled").default(true),
	inventorySyncSchedule: text("inventory_sync_schedule").default('0 */6 * * *'),
	lastCatalogSync: timestamp("last_catalog_sync", { mode: 'string' }),
	catalogSyncStatus: text("catalog_sync_status").default('never_synced'),
	catalogSyncError: text("catalog_sync_error"),
	lastCatalogRecordsCreated: integer("last_catalog_records_created").default(0),
	lastCatalogRecordsUpdated: integer("last_catalog_records_updated").default(0),
	lastCatalogRecordsDeactivated: integer("last_catalog_records_deactivated").default(0),
	lastInventorySync: timestamp("last_inventory_sync", { mode: 'string' }),
	inventorySyncStatus: text("inventory_sync_status").default('never_synced'),
	inventorySyncError: text("inventory_sync_error"),
	lastInventoryRecordsUpdated: integer("last_inventory_records_updated").default(0),
	lastInventorySkusProcessed: integer("last_inventory_skus_processed").default(0),
	connectionStatus: text("connection_status").default('not_tested'),
	lastConnectionTest: timestamp("last_connection_test", { mode: 'string' }),
	connectionError: text("connection_error"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	userName: text("user_name"),
	password: text(),
	source: text(),
	customerNumber: text("customer_number"),
	apiKey: text("api_key"),
	apiSecret: text("api_secret"),
	sid: text(),
	token: text(),
	accountNumber: text("account_number"),
	username: text(),
	chattanoogaPassword: text("chattanooga_password"),
}, (table) => [
	uniqueIndex("company_vendor_credentials_unique").using("btree", table.companyId.asc().nullsLast().op("int4_ops"), table.supportedVendorId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_vendor_credentials_company_id_fkey"
		}),
	foreignKey({
			columns: [table.supportedVendorId],
			foreignColumns: [supportedVendors.id],
			name: "company_vendor_credentials_supported_vendor_id_fkey"
		}),
]);

export const vendorInventory = pgTable("vendor_inventory", {
	id: serial().primaryKey().notNull(),
	supportedVendorId: integer("supported_vendor_id").notNull(),
	vendorSku: text("vendor_sku").notNull(),
	quantityAvailable: integer("quantity_available").default(0).notNull(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("vendor_inventory_sku_unique").using("btree", table.supportedVendorId.asc().nullsLast().op("text_ops"), table.vendorSku.asc().nullsLast().op("text_ops")),
	index("vendor_sku_inventory_idx").using("btree", table.supportedVendorId.asc().nullsLast().op("int4_ops"), table.vendorSku.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.supportedVendorId],
			foreignColumns: [supportedVendors.id],
			name: "vendor_inventory_supported_vendor_id_fkey"
		}),
]);

export const categories = pgTable("categories", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	name: varchar({ length: 100 }).notNull(),
	slug: varchar({ length: 100 }).notNull(),
	displayName: varchar("display_name", { length: 100 }).notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "categories_company_id_fkey"
		}),
	unique("categories_company_id_slug_key").on(table.companyId, table.slug),
	unique("categories_company_id_name_key").on(table.companyId, table.name),
]);

export const supportedVendorRetailVerticals = pgTable("supported_vendor_retail_verticals", {
	id: serial().primaryKey().notNull(),
	supportedVendorId: integer("supported_vendor_id").notNull(),
	retailVerticalId: integer("retail_vertical_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.supportedVendorId],
			foreignColumns: [supportedVendors.id],
			name: "supported_vendor_retail_verticals_supported_vendor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.retailVerticalId],
			foreignColumns: [retailVerticals.id],
			name: "supported_vendor_retail_verticals_retail_vertical_id_fkey"
		}).onDelete("cascade"),
	unique("supported_vendor_retail_verti_supported_vendor_id_retail_ve_key").on(table.supportedVendorId, table.retailVerticalId),
]);

export const subscriptionPlanChanges = pgTable("subscription_plan_changes", {
	id: serial().primaryKey().notNull(),
	subscriptionId: integer("subscription_id").notNull(),
	fromPlanId: text("from_plan_id").notNull(),
	toPlanId: text("to_plan_id").notNull(),
	changeType: text("change_type").notNull(),
	effectiveDate: timestamp("effective_date", { mode: 'string' }),
	prorationAmount: numeric("proration_amount", { precision: 10, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "subscription_plan_changes_subscription_id_fkey"
		}),
]);

export const subscriptions = pgTable("subscriptions", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	planId: text("plan_id").notNull(),
	status: text().notNull(),
	billingProvider: text("billing_provider").default('zoho').notNull(),
	externalSubscriptionId: text("external_subscription_id"),
	externalCustomerId: text("external_customer_id"),
	externalSubscriptionNumber: text("external_subscription_number"),
	currentPeriodStart: timestamp("current_period_start", { mode: 'string' }),
	currentPeriodEnd: timestamp("current_period_end", { mode: 'string' }),
	trialStart: timestamp("trial_start", { mode: 'string' }),
	trialEnd: timestamp("trial_end", { mode: 'string' }),
	amount: numeric({ precision: 10, scale:  2 }),
	currency: text().default('USD'),
	billingCycle: text("billing_cycle").default('month'),
	nextBillingDate: timestamp("next_billing_date", { mode: 'string' }),
	
	// Cancellation details
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
	cancelledAt: timestamp("cancelled_at", { mode: 'string' }),
	cancellationReason: text("cancellation_reason"),
	
	// Auto-renewal
	autoRenew: boolean("auto_renew").default(true),
	
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "subscriptions_company_id_fkey"
		}),
]);

export const subscriptionPayments = pgTable("subscription_payments", {
	id: serial().primaryKey().notNull(),
	subscriptionId: integer("subscription_id").notNull(),
	externalPaymentId: text("external_payment_id"),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	currency: text().default('USD'),
	status: text().notNull(),
	paymentMethod: text("payment_method"),
	externalInvoiceId: text("external_invoice_id"),
	paymentDate: timestamp("payment_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "subscription_payments_subscription_id_fkey"
		}),
]);

export const subscriptionWebhookEvents = pgTable("subscription_webhook_events", {
	id: serial().primaryKey().notNull(),
	subscriptionId: integer("subscription_id"),
	eventType: text("event_type").notNull(),
	externalEventId: text("external_event_id"),
	payload: jsonb(),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	processingStatus: text("processing_status").default('pending'),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "subscription_webhook_events_subscription_id_fkey"
		}),
]);

export const subscriptionUsage = pgTable("subscription_usage", {
	id: serial().primaryKey().notNull(),
	subscriptionId: integer("subscription_id").notNull(),
	usageType: text("usage_type").notNull(),
	currentUsage: integer("current_usage").default(0),
	usageLimit: integer("usage_limit"),
	periodStart: timestamp("period_start", { mode: 'string' }),
	periodEnd: timestamp("period_end", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "subscription_usage_subscription_id_fkey"
		}),
]);

export const planSettings = pgTable("plan_settings", {
	id: serial().primaryKey().notNull(),
	planId: text("plan_id").notNull(),
	planName: text("plan_name").notNull(),
	trialLengthDays: integer("trial_length_days"),
	planLengthDays: integer("plan_length_days"),
	maxUsers: integer("max_users"),
	maxVendors: integer("max_vendors"),
	onlineOrdering: boolean("online_ordering").default(false),
	asnProcessing: boolean("asn_processing").default(false),
	webhookExport: boolean("webhook_export").default(false),
	isActive: boolean("is_active").default(true),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("plan_settings_plan_id_key").on(table.planId),
]);

export const products = pgTable("products", {
	id: serial().primaryKey().notNull(),
	upc: text().notNull(),
	name: text().notNull(),
	brand: text().notNull(),
	model: text(),
	caliber: text(),
	category: text(),
	description: text(),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	serialized: boolean().default(false),
	allocated: boolean().default(false),
	specifications: jsonb(),
	customProperties: jsonb("custom_properties"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	imageSource: text("image_source"),
	status: text().default('active').notNull(),
	source: text(),
	retailVerticalId: integer("retail_vertical_id"),
	subcategory1: text(),
	subcategory2: text(),
	subcategory3: text(),
	manufacturerPartNumber: text("manufacturer_part_number"),
	barrelLength: varchar("barrel_length"),
	altId1: text("alt_id_1"),
	altId2: text("alt_id_2"),
	priorityScore: integer("priority_score"),
	prioritySource: text("priority_source"),
	priorityCalculatedAt: timestamp("priority_calculated_at", { mode: 'string' }),
	dataHash: text("data_hash"),
	sourceLocked: boolean("source_locked").default(true),
	sourceLockedAt: timestamp("source_locked_at", { mode: 'string' }).defaultNow(),
	sourceLockedBy: varchar("source_locked_by"),
	lastQualityScore: integer("last_quality_score"),
}, (table) => [
	index("idx_products_retail_vertical_search").using("btree", table.retailVerticalId.asc().nullsLast().op("int4_ops"), table.status.asc().nullsLast().op("int4_ops")).where(sql`((status = 'active'::text) OR (status IS NULL))`),
	foreignKey({
			columns: [table.retailVerticalId],
			foreignColumns: [retailVerticals.id],
			name: "products_retail_vertical_id_fkey"
		}),
	unique("products_upc_unique").on(table.upc),
]);

export const supportedVendors = pgTable("supported_vendors", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	features: jsonb().default({"inventorySync":false,"productCatalog":false,"realTimePricing":false,"electronicOrdering":false}).notNull(),
	description: text().notNull(),
	apiType: text("api_type").default('api').notNull(),
	logoUrl: text("logo_url"),
	documentationUrl: text("documentation_url"),
	apiEndpoint: text("api_endpoint"),
	credentialFields: jsonb("credential_fields").default(["username","password"]).notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	websiteUrl: text("website_url"),
	retailVerticalId: integer("retail_vertical_id"),
	adminCredentials: jsonb("admin_credentials"),
	adminConnectionStatus: text("admin_connection_status").default('not_configured'),
	catalogSyncEnabled: boolean("catalog_sync_enabled").default(false),
	catalogSyncStatus: text("catalog_sync_status").default('idle'),
	lastCatalogSync: timestamp("last_catalog_sync", { mode: 'string' }),
	catalogSyncError: text("catalog_sync_error"),
	vendorShortCode: text("vendor_short_code"),
	vendorType: text("vendor_type").default('vendor'),
	lastSyncImagesUpdated: integer("last_sync_images_updated").default(0),
	lastSyncRecordsUpdated: integer("last_sync_records_updated").default(0),
	lastSyncRecordsSkipped: integer("last_sync_records_skipped").default(0),
	lastSyncNewRecords: integer("last_sync_new_records").default(0),
	lastSyncImagesAdded: integer("last_sync_images_added").default(0),
	sportsSouthScheduleEnabled: boolean("sports_south_schedule_enabled").default(false),
	sportsSouthScheduleTime: text("sports_south_schedule_time").default('14:00'),
	sportsSouthScheduleFrequency: text("sports_south_schedule_frequency").default('daily'),
	chattanoogaScheduleEnabled: boolean("chattanooga_schedule_enabled").default(false),
	chattanoogaScheduleTime: text("chattanooga_schedule_time").default('15:00'),
	chattanoogaScheduleFrequency: text("chattanooga_schedule_frequency").default('daily'),
	chattanoogaLastCsvDownload: timestamp("chattanooga_last_csv_download", { mode: 'string' }),
	chattanoogaCsvSyncStatus: text("chattanooga_csv_sync_status").default('never_synced'),
	chattanoogaCsvSyncError: text("chattanooga_csv_sync_error"),
	chattanoogaLastCsvSize: integer("chattanooga_last_csv_size").default(0),
	chattanoogaLastCsvHash: text("chattanooga_last_csv_hash"),
	billHicksLastInventorySync: timestamp("bill_hicks_last_inventory_sync", { mode: 'string' }),
	billHicksInventorySyncStatus: varchar("bill_hicks_inventory_sync_status", { length: 20 }),
	billHicksInventorySyncError: text("bill_hicks_inventory_sync_error"),
	billHicksLastSyncRecordsUpdated: integer("bill_hicks_last_sync_records_updated"),
	billHicksLastSyncRecordsSkipped: integer("bill_hicks_last_sync_records_skipped"),
	billHicksLastSyncRecordsFailed: integer("bill_hicks_last_sync_records_failed"),
	billHicksLastSyncRecordsAdded: integer("bill_hicks_last_sync_records_added").default(0),
	billHicksLastSyncRecordsRemoved: integer("bill_hicks_last_sync_records_removed").default(0),
	billHicksLastSyncRecordsUnchanged: integer("bill_hicks_last_sync_records_unchanged").default(0),
	billHicksLastSyncTotalRecords: integer("bill_hicks_last_sync_total_records").default(0),
	billHicksMasterCatalogSyncEnabled: boolean("bill_hicks_master_catalog_sync_enabled").default(true),
	billHicksMasterCatalogSyncTime: varchar("bill_hicks_master_catalog_sync_time", { length: 5 }).default('02:00'),
	billHicksMasterCatalogSyncStatus: varchar("bill_hicks_master_catalog_sync_status", { length: 20 }).default('not_configured'),
	billHicksMasterCatalogLastSync: timestamp("bill_hicks_master_catalog_last_sync", { mode: 'string' }),
	billHicksMasterCatalogSyncError: text("bill_hicks_master_catalog_sync_error"),
	billHicksMasterCatalogRecordsAdded: integer("bill_hicks_master_catalog_records_added").default(0),
	billHicksMasterCatalogRecordsUpdated: integer("bill_hicks_master_catalog_records_updated").default(0),
	billHicksMasterCatalogRecordsFailed: integer("bill_hicks_master_catalog_records_failed").default(0),
	billHicksMasterCatalogRecordsSkipped: integer("bill_hicks_master_catalog_records_skipped").default(0),
	billHicksMasterCatalogTotalRecords: integer("bill_hicks_master_catalog_total_records").default(0),
	billHicksInventorySyncEnabled: boolean("bill_hicks_inventory_sync_enabled").default(true),
	billHicksInventorySyncTime: text("bill_hicks_inventory_sync_time").default('03:00'),
	billHicksInventoryRecordsAdded: integer("bill_hicks_inventory_records_added").default(0),
	billHicksInventoryRecordsFailed: integer("bill_hicks_inventory_records_failed").default(0),
	billHicksInventoryTotalRecords: integer("bill_hicks_inventory_total_records").default(0),
	chattanoogaRecordsUpdated: integer("chattanooga_records_updated").default(0),
	chattanoogaRecordsSkipped: integer("chattanooga_records_skipped").default(0),
	chattanoogaRecordsFailed: integer("chattanooga_records_failed").default(0),
	chattanoogaRecordsAdded: integer("chattanooga_records_added").default(0),
	chattanoogaTotalRecords: integer("chattanooga_total_records").default(0),
	productRecordPriority: integer("product_record_priority"),
}, (table) => [
	foreignKey({
			columns: [table.retailVerticalId],
			foreignColumns: [retailVerticals.id],
			name: "supported_vendors_retail_vertical_id_fkey"
		}),
]);

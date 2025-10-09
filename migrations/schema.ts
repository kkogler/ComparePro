import { pgTable, serial, text, integer, boolean, numeric, timestamp, foreignKey, unique, json, varchar, index, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const adminSettings = pgTable("admin_settings", {
	id: serial().primaryKey().notNull(),
	sendgridApiKey: text("sendgrid_api_key"),
	smtp2GoApiKey: text("smtp2go_api_key"),
	smtpHost: text("smtp_host"),
	smtpPort: integer("smtp_port"),
	smtpUser: text("smtp_user"),
	smtpPassword: text("smtp_password"),
	systemEmail: text("system_email").default('noreply@pricecompare.com'),
	systemTimeZone: text("system_time_zone").default('America/New_York'),
	maintenanceMode: boolean("maintenance_mode").default(false),
	registrationEnabled: boolean("registration_enabled").default(true),
	maxOrganizations: integer("max_organizations").default(1000),
	supportEmail: text("support_email").default('support@pricecompare.com'),
	companyName: text("company_name").default('Retail Management Platform'),
	brandName: text("brand_name").default('PriceCompare Pro'),
	supportDomain: text("support_domain").default('pricecompare.com'),
	logoUrl: text("logo_url"),
	zohoBillingClientId: text("zoho_billing_client_id"),
	zohoBillingClientSecret: text("zoho_billing_client_secret"),
	zohoBillingRefreshToken: text("zoho_billing_refresh_token"),
	zohoBillingOrgId: text("zoho_billing_org_id"),
	zohoBillingBaseUrl: text("zoho_billing_base_url"),
	defaultPricingStrategy: text("default_pricing_strategy").default('msrp'),
	defaultPricingMarkupPercentage: numeric("default_pricing_markup_percentage", { precision: 5, scale:  2 }),
	defaultPricingMarginPercentage: numeric("default_pricing_margin_percentage", { precision: 5, scale:  2 }),
	defaultPricingPremiumAmount: numeric("default_pricing_premium_amount", { precision: 10, scale:  2 }),
	defaultPricingDiscountPercentage: numeric("default_pricing_discount_percentage", { precision: 5, scale:  2 }),
	defaultPricingRoundingRule: text("default_pricing_rounding_rule").default('none'),
	defaultPricingFallbackStrategy: text("default_pricing_fallback_strategy").default('map'),
	defaultPricingFallbackMarkupPercentage: numeric("default_pricing_fallback_markup_percentage", { precision: 5, scale:  2 }),
	defaultPricingUseCrossVendorFallback: boolean("default_pricing_use_cross_vendor_fallback").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const companies = pgTable("companies", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	plan: text().default('free').notNull(),
	status: text().default('active').notNull(),
	email: text(),
	phone: text(),
	logoUrl: text("logo_url"),
	billingProvider: text("billing_provider"),
	billingCustomerId: text("billing_customer_id"),
	billingSubscriptionId: text("billing_subscription_id"),
	billingSubscriptionNumber: text("billing_subscription_number"),
	trialStatus: text("trial_status"),
	trialStartedAt: timestamp("trial_started_at", { mode: 'string' }),
	trialEndsAt: timestamp("trial_ends_at", { mode: 'string' }),
	trialExtensions: integer("trial_extensions").default(0),
	maxUsers: integer("max_users").default(10),
	maxVendors: integer("max_vendors").default(5),
	maxOrders: integer("max_orders").default(500),
	features: json(),
	settings: json(),
	retailVerticalId: integer("retail_vertical_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.retailVerticalId],
			foreignColumns: [retailVerticals.id],
			name: "companies_retail_vertical_id_retail_verticals_id_fk"
		}),
	unique("companies_slug_unique").on(table.slug),
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
			name: "categories_company_id_companies_id_fk"
		}),
	unique("company_category_slug_unique").on(table.companyId, table.slug),
	unique("company_category_name_unique").on(table.companyId, table.name),
]);

export const categoryTemplates = pgTable("category_templates", {
	id: serial().primaryKey().notNull(),
	retailVerticalId: integer("retail_vertical_id").notNull(),
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
			columns: [table.retailVerticalId],
			foreignColumns: [retailVerticals.id],
			name: "category_templates_retail_vertical_id_retail_verticals_id_fk"
		}),
	unique("retail_vertical_category_slug_unique").on(table.retailVerticalId, table.slug),
	unique("retail_vertical_category_name_unique").on(table.retailVerticalId, table.name),
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

export const billingEvents = pgTable("billing_events", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	eventType: text("event_type").notNull(),
	amount: numeric({ precision: 10, scale:  2 }),
	currency: text().default('USD'),
	billingProvider: text("billing_provider").notNull(),
	externalId: text("external_id"),
	metadata: json(),
	processed: boolean().default(false),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	error: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "billing_events_company_id_companies_id_fk"
		}),
]);

export const integrationSettings = pgTable("integration_settings", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	webhookUrl: text("webhook_url"),
	apiKey: text("api_key"),
	swipeSimpleTax: text("swipe_simple_tax").default('TRUE'),
	swipeSimpleTrackInventory: text("swipe_simple_track_inventory").default('TRUE'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "integration_settings_company_id_companies_id_fk"
		}),
	unique("integration_settings_company_id_unique").on(table.companyId),
]);

export const importJobs = pgTable("import_jobs", {
	id: text().primaryKey().notNull(),
	organizationId: integer("organization_id"),
	filename: text().notNull(),
	totalRows: integer("total_rows").notNull(),
	processedRows: integer("processed_rows").default(0),
	successfulRows: integer("successful_rows").default(0),
	errorRows: integer("error_rows").default(0),
	skippedRows: integer("skipped_rows").default(0),
	status: text().default('pending').notNull(),
	settings: json().notNull(),
	errors: json().default([]),
	startTime: timestamp("start_time", { mode: 'string' }).defaultNow().notNull(),
	endTime: timestamp("end_time", { mode: 'string' }),
	createdBy: integer("created_by").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [companies.id],
			name: "import_jobs_organization_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "import_jobs_created_by_users_id_fk"
		}),
]);

export const orderItems = pgTable("order_items", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	productId: integer("product_id").notNull(),
	quantity: integer().notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  2 }).notNull(),
	totalCost: numeric("total_cost", { precision: 10, scale:  2 }).notNull(),
	vendorSku: text("vendor_sku"),
	vendorMsrp: numeric("vendor_msrp", { precision: 10, scale:  2 }),
	vendorMapPrice: numeric("vendor_map_price", { precision: 10, scale:  2 }),
	retailPrice: numeric("retail_price", { precision: 10, scale:  2 }),
	pricingStrategy: varchar("pricing_strategy", { length: 50 }),
	category: varchar({ length: 100 }),
	customerReference: text("customer_reference"),
	vendorProductId: integer("vendor_product_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
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
			name: "order_items_vendor_product_id_vendor_products_id_fk"
		}),
]);

export const organizationStatusAuditLog = pgTable("organization_status_audit_log", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	previousStatus: text("previous_status").notNull(),
	newStatus: text("new_status").notNull(),
	reason: text(),
	changedBy: text("changed_by").notNull(),
	changedAt: timestamp("changed_at", { mode: 'string' }).defaultNow().notNull(),
	metadata: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "organization_status_audit_log_company_id_companies_id_fk"
		}),
]);

export const poSequences = pgTable("po_sequences", {
	id: serial().primaryKey().notNull(),
	storeId: integer("store_id").notNull(),
	lastSequence: integer("last_sequence").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [stores.id],
			name: "po_sequences_store_id_stores_id_fk"
		}),
	unique("po_sequences_store_id_unique").on(table.storeId),
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
	unique("plan_settings_plan_id_unique").on(table.planId),
]);

export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	storeId: integer("store_id").notNull(),
	orderNumber: text("order_number").notNull(),
	vendorId: integer("vendor_id").notNull(),
	createdBy: integer("created_by").notNull(),
	status: text().default('draft').notNull(),
	orderDate: timestamp("order_date", { mode: 'string' }).defaultNow().notNull(),
	expectedDate: timestamp("expected_date", { mode: 'string' }),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).default('0'),
	itemCount: integer("item_count").default(0),
	shippingCost: numeric("shipping_cost", { precision: 10, scale:  2 }).default('0'),
	externalOrderNumber: text("external_order_number"),
	notes: text(),
	vendorInvoiceNumber: text("vendor_invoice_number"),
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
	fflNumber: text("ffl_number"),
	orderType: text("order_type").default('standard'),
	warehouse: text(),
	customerPhone: text("customer_phone"),
	delayShipping: boolean("delay_shipping").default(false),
	overnight: boolean().default(false),
	messageForSalesExec: text("message_for_sales_exec"),
	billingName: text("billing_name"),
	billingLine1: text("billing_line_1"),
	billingLine2: text("billing_line_2"),
	billingCity: text("billing_city"),
	billingStateCode: text("billing_state_code"),
	billingZip: text("billing_zip"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "orders_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [stores.id],
			name: "orders_store_id_stores_id_fk"
		}),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "orders_vendor_id_vendors_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "orders_created_by_users_id_fk"
		}),
	unique("orders_company_id_order_number_unique").on(table.companyId, table.orderNumber),
]);

export const orgDomains = pgTable("org_domains", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	domain: text().notNull(),
	subdomain: text().notNull(),
	isActive: boolean("is_active").default(true),
	isPrimary: boolean("is_primary").default(false),
	sslEnabled: boolean("ssl_enabled").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("org_subdomain_idx").using("btree", table.subdomain.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "org_domains_company_id_companies_id_fk"
		}),
	unique("org_domains_domain_unique").on(table.domain),
]);

export const pricingConfigurations = pgTable("pricing_configurations", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	name: text().notNull(),
	description: text(),
	isDefault: boolean("is_default").default(false),
	isActive: boolean("is_active").default(true),
	strategy: text().notNull(),
	markupPercentage: numeric("markup_percentage", { precision: 5, scale:  2 }),
	marginPercentage: numeric("margin_percentage", { precision: 5, scale:  2 }),
	premiumAmount: numeric("premium_amount", { precision: 10, scale:  2 }),
	discountPercentage: numeric("discount_percentage", { precision: 5, scale:  2 }),
	roundingRule: text("rounding_rule").default('none').notNull(),
	roundingAmount: numeric("rounding_amount", { precision: 3, scale:  2 }),
	fallbackStrategy: text("fallback_strategy"),
	fallbackMarkupPercentage: numeric("fallback_markup_percentage", { precision: 5, scale:  2 }),
	useCrossVendorFallback: boolean("use_cross_vendor_fallback").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "pricing_configurations_company_id_companies_id_fk"
		}),
	unique("company_default_unique").on(table.companyId, table.isDefault),
]);

export const products = pgTable("products", {
	id: serial().primaryKey().notNull(),
	upc: text().notNull(),
	name: text().notNull(),
	brand: text().notNull(),
	model: text(),
	manufacturerPartNumber: text("manufacturer_part_number"),
	altId1: text("alt_id_1"),
	altId2: text("alt_id_2"),
	caliber: text(),
	category: text(),
	subcategory1: text(),
	subcategory2: text(),
	subcategory3: text(),
	description: text(),
	barrelLength: varchar("barrel_length"),
	imageUrl: text("image_url"),
	imageSource: text("image_source"),
	source: text(),
	sourceLocked: boolean("source_locked").default(true),
	sourceLockedAt: timestamp("source_locked_at", { mode: 'string' }).defaultNow(),
	sourceLockedBy: varchar("source_locked_by"),
	lastQualityScore: integer("last_quality_score"),
	serialized: boolean().default(false),
	allocated: boolean().default(false),
	specifications: json(),
	priorityScore: integer("priority_score"),
	prioritySource: text("priority_source"),
	priorityCalculatedAt: timestamp("priority_calculated_at", { mode: 'string' }),
	dataHash: text("data_hash"),
	customProperties: json("custom_properties"),
	status: text().default('active').notNull(),
	retailVerticalId: integer("retail_vertical_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.retailVerticalId],
			foreignColumns: [retailVerticals.id],
			name: "products_retail_vertical_id_retail_verticals_id_fk"
		}),
	unique("products_upc_unique").on(table.upc),
]);

export const settings = pgTable("settings", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
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
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "settings_company_id_companies_id_fk"
		}),
	unique("settings_company_id_unique").on(table.companyId),
]);

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
			name: "search_history_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "search_history_user_id_users_id_fk"
		}),
]);

export const retailVerticals = pgTable("retail_verticals", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	isActive: boolean("is_active").default(true),
	sortOrder: integer("sort_order"),
	color: varchar({ length: 7 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("retail_verticals_slug_unique").on(table.slug),
]);

export const stores = pgTable("stores", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	shortName: text("short_name").notNull(),
	storeNumber: text("store_number").notNull(),
	address1: text(),
	address2: text(),
	city: text(),
	state: text(),
	zipCode: text("zip_code"),
	country: text().default('US'),
	phone: text(),
	fflNumber: text("ffl_number"),
	isActive: boolean("is_active").default(true),
	status: text().default('active'),
	timezone: text().default('America/New_York'),
	currency: text().default('USD'),
	settings: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "stores_company_id_companies_id_fk"
		}),
	unique("company_store_slug_unique").on(table.companyId, table.slug),
	unique("company_store_number_unique").on(table.companyId, table.storeNumber),
]);

export const subscriptionUsage = pgTable("subscription_usage", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	subscriptionId: integer("subscription_id").notNull(),
	currentVendors: integer("current_vendors").default(0),
	currentUsers: integer("current_users").default(0),
	currentOrders: integer("current_orders").default(0),
	month: integer().notNull(),
	year: integer().notNull(),
	ordersThisMonth: integer("orders_this_month").default(0),
	asnsProcessedThisMonth: integer("asns_processed_this_month").default(0),
	vendorLimitExceeded: boolean("vendor_limit_exceeded").default(false),
	userLimitExceeded: boolean("user_limit_exceeded").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "subscription_usage_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "subscription_usage_subscription_id_subscriptions_id_fk"
		}),
	unique("company_month_year_unique").on(table.companyId, table.month, table.year),
]);

export const subscriptionPlanChanges = pgTable("subscription_plan_changes", {
	id: serial().primaryKey().notNull(),
	subscriptionId: integer("subscription_id").notNull(),
	companyId: integer("company_id").notNull(),
	fromPlanId: text("from_plan_id"),
	toPlanId: text("to_plan_id").notNull(),
	changeType: text("change_type").notNull(),
	changeReason: text("change_reason"),
	proratedAmount: numeric("prorated_amount", { precision: 10, scale:  2 }),
	effectiveDate: timestamp("effective_date", { mode: 'string' }).notNull(),
	externalEventId: text("external_event_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "subscription_plan_changes_subscription_id_subscriptions_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "subscription_plan_changes_company_id_companies_id_fk"
		}),
]);

export const subscriptionWebhookEvents = pgTable("subscription_webhook_events", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id"),
	subscriptionId: integer("subscription_id"),
	eventType: text("event_type").notNull(),
	source: text().default('zoho').notNull(),
	externalEventId: text("external_event_id"),
	eventData: json("event_data"),
	processedData: json("processed_data"),
	status: text().default('pending'),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	failureReason: text("failure_reason"),
	retryCount: integer("retry_count").default(0),
	responseStatus: integer("response_status"),
	responseBody: text("response_body"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "subscription_webhook_events_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "subscription_webhook_events_subscription_id_subscriptions_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id"),
	username: text().notNull(),
	email: text().notNull(),
	password: text(),
	role: text().default('user').notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	displayName: text("display_name"),
	defaultStoreId: integer("default_store_id"),
	isAdmin: boolean("is_admin").default(false),
	status: text().default('pending_activation').notNull(),
	activationToken: text("activation_token"),
	activationTokenExpires: timestamp("activation_token_expires", { mode: 'string' }),
	passwordResetToken: text("password_reset_token"),
	passwordResetTokenExpires: timestamp("password_reset_token_expires", { mode: 'string' }),
	isActive: boolean("is_active").default(true),
	lastLogin: timestamp("last_login", { mode: 'string' }),
	emailVerifiedAt: timestamp("email_verified_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("users_activation_token_idx").using("btree", table.activationToken.asc().nullsLast().op("text_ops")),
	index("users_password_reset_token_idx").using("btree", table.passwordResetToken.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "users_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.defaultStoreId],
			foreignColumns: [stores.id],
			name: "users_default_store_id_stores_id_fk"
		}),
	unique("users_username_company_unique").on(table.companyId, table.username),
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
			name: "user_stores_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [stores.id],
			name: "user_stores_store_id_stores_id_fk"
		}),
	unique("user_store_unique").on(table.userId, table.storeId),
]);

export const vendorInventory = pgTable("vendor_inventory", {
	id: serial().primaryKey().notNull(),
	supportedVendorId: integer("supported_vendor_id").notNull(),
	vendorSku: text("vendor_sku").notNull(),
	quantityAvailable: integer("quantity_available").default(0).notNull(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("vendor_sku_inventory_idx").using("btree", table.supportedVendorId.asc().nullsLast().op("int4_ops"), table.vendorSku.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.supportedVendorId],
			foreignColumns: [supportedVendors.id],
			name: "vendor_inventory_supported_vendor_id_supported_vendors_id_fk"
		}),
	unique("vendor_inventory_sku_unique").on(table.supportedVendorId, table.vendorSku),
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
	billingCycle: text("billing_cycle"),
	nextBillingDate: timestamp("next_billing_date", { mode: 'string' }),
	cancelledAt: timestamp("cancelled_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "subscriptions_company_id_companies_id_fk"
		}),
]);

export const vendorFieldMappings = pgTable("vendor_field_mappings", {
	id: serial().primaryKey().notNull(),
	vendorSource: text("vendor_source").notNull(),
	mappingName: text("mapping_name").default('Default').notNull(),
	columnMappings: json("column_mappings").notNull(),
	status: text().default('draft').notNull(),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	approvedBy: text("approved_by"),
	lastUsed: timestamp("last_used", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("vendor_mapping_unique").on(table.vendorSource, table.mappingName),
]);

export const supportedVendors = pgTable("supported_vendors", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	vendorShortCode: text("vendor_short_code"),
	description: text().notNull(),
	apiType: text("api_type").notNull(),
	logoUrl: text("logo_url"),
	websiteUrl: text("website_url"),
	documentationUrl: text("documentation_url"),
	credentialFields: json("credential_fields").notNull(),
	features: json().notNull(),
	adminCredentials: json("admin_credentials"),
	adminConnectionStatus: text("admin_connection_status").default('not_configured'),
	lastCatalogSync: timestamp("last_catalog_sync", { mode: 'string' }),
	catalogSyncStatus: text("catalog_sync_status"),
	catalogSyncError: text("catalog_sync_error"),
	lastSyncNewRecords: integer("last_sync_new_records").default(0),
	sportsSouthScheduleEnabled: boolean("sports_south_schedule_enabled").default(false),
	sportsSouthScheduleTime: text("sports_south_schedule_time").default('14:00'),
	sportsSouthScheduleFrequency: text("sports_south_schedule_frequency").default('daily'),
	lastSyncRecordsUpdated: integer("last_sync_records_updated").default(0),
	lastSyncRecordsSkipped: integer("last_sync_records_skipped").default(0),
	lastSyncImagesAdded: integer("last_sync_images_added").default(0),
	lastSyncImagesUpdated: integer("last_sync_images_updated").default(0),
	chattanoogaScheduleEnabled: boolean("chattanooga_schedule_enabled").default(false),
	chattanoogaScheduleTime: text("chattanooga_schedule_time").default('15:00'),
	chattanoogaScheduleFrequency: text("chattanooga_schedule_frequency").default('daily'),
	chattanoogaLastCsvDownload: timestamp("chattanooga_last_csv_download", { mode: 'string' }),
	chattanoogaCsvSyncStatus: text("chattanooga_csv_sync_status").default('never_synced'),
	chattanoogaCsvSyncError: text("chattanooga_csv_sync_error"),
	chattanoogaLastCsvSize: integer("chattanooga_last_csv_size").default(0),
	chattanoogaLastCsvHash: text("chattanooga_last_csv_hash"),
	chattanoogaRecordsAdded: integer("chattanooga_records_added").default(0),
	chattanoogaRecordsUpdated: integer("chattanooga_records_updated").default(0),
	chattanoogaRecordsSkipped: integer("chattanooga_records_skipped").default(0),
	chattanoogaRecordsFailed: integer("chattanooga_records_failed").default(0),
	chattanoogaTotalRecords: integer("chattanooga_total_records").default(0),
	billHicksInventorySyncEnabled: boolean("bill_hicks_inventory_sync_enabled").default(true),
	billHicksInventorySyncTime: text("bill_hicks_inventory_sync_time").default('03:00'),
	billHicksLastInventorySync: timestamp("bill_hicks_last_inventory_sync", { mode: 'string' }),
	billHicksInventorySyncStatus: text("bill_hicks_inventory_sync_status").default('never_synced'),
	billHicksInventorySyncError: text("bill_hicks_inventory_sync_error"),
	billHicksLastSyncRecordsUpdated: integer("bill_hicks_last_sync_records_updated").default(0),
	billHicksLastSyncRecordsSkipped: integer("bill_hicks_last_sync_records_skipped").default(0),
	billHicksLastSyncRecordsFailed: integer("bill_hicks_last_sync_records_failed").default(0),
	billHicksInventoryRecordsAdded: integer("bill_hicks_inventory_records_added").default(0),
	billHicksInventoryRecordsFailed: integer("bill_hicks_inventory_records_failed").default(0),
	billHicksInventoryTotalRecords: integer("bill_hicks_inventory_total_records").default(0),
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
	lipseysCatalogSyncEnabled: boolean("lipseys_catalog_sync_enabled").default(false),
	lipseysCatalogSyncTime: varchar("lipseys_catalog_sync_time", { length: 5 }).default('08:00'),
	lipseysCatalogSyncFrequency: text("lipseys_catalog_sync_frequency").default('daily'),
	lipseysCatalogSyncStatus: varchar("lipseys_catalog_sync_status", { length: 20 }).default('not_configured'),
	lipseysLastCatalogSync: timestamp("lipseys_last_catalog_sync", { mode: 'string' }),
	lipseysCatalogSyncError: text("lipseys_catalog_sync_error"),
	lipseysRecordsAdded: integer("lipseys_records_added").default(0),
	lipseysRecordsUpdated: integer("lipseys_records_updated").default(0),
	lipseysRecordsSkipped: integer("lipseys_records_skipped").default(0),
	lipseysRecordsFailed: integer("lipseys_records_failed").default(0),
	lipseysTotalRecords: integer("lipseys_total_records").default(0),
	lipseysImagesAdded: integer("lipseys_images_added").default(0),
	lipseysImagesUpdated: integer("lipseys_images_updated").default(0),
	vendorType: text("vendor_type").default('vendor'),
	nameAliases: text("name_aliases").array(),
	isEnabled: boolean("is_enabled").default(true),
	sortOrder: integer("sort_order").default(0),
	productRecordPriority: integer("product_record_priority").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("supported_vendors_name_unique").on(table.name),
	unique("supported_vendors_product_record_priority_unique").on(table.productRecordPriority),
]);

export const supportedVendorRetailVerticals = pgTable("supported_vendor_retail_verticals", {
	id: serial().primaryKey().notNull(),
	supportedVendorId: integer("supported_vendor_id").notNull(),
	retailVerticalId: integer("retail_vertical_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	priority: integer().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.supportedVendorId],
			foreignColumns: [supportedVendors.id],
			name: "supported_vendor_retail_verticals_supported_vendor_id_supported"
		}),
	foreignKey({
			columns: [table.retailVerticalId],
			foreignColumns: [retailVerticals.id],
			name: "supported_vendor_retail_verticals_retail_vertical_id_retail_ver"
		}),
	unique("vendor_vertical_unique").on(table.supportedVendorId, table.retailVerticalId),
	unique("unique_priority_per_vertical").on(table.retailVerticalId, table.priority),
	check("priority_range", sql`(priority >= 1) AND (priority <= 25)`),
]);

export const usageMetrics = pgTable("usage_metrics", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	metric: text().notNull(),
	value: integer().notNull(),
	period: text().notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "usage_metrics_company_id_companies_id_fk"
		}),
	unique("usage_metrics_company_id_metric_period_date_unique").on(table.companyId, table.metric, table.period, table.date),
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
	companyId: integer("company_id").notNull(),
	supportedVendorId: integer("supported_vendor_id"),
	name: text().notNull(),
	vendorShortCode: text("vendor_short_code"),
	slug: text().notNull(),
	status: text().default('offline').notNull(),
	isArchived: boolean("is_archived").default(false),
	integrationType: text("integration_type").notNull(),
	apiEndpoint: text("api_endpoint"),
	lastSyncDate: timestamp("last_sync_date", { mode: 'string' }),
	syncStatus: text("sync_status"),
	syncError: text("sync_error"),
	credentials: json(),
	logoUrl: text("logo_url"),
	enabledForPriceComparison: boolean("enabled_for_price_comparison").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "vendors_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.supportedVendorId],
			foreignColumns: [supportedVendors.id],
			name: "vendors_supported_vendor_id_supported_vendors_id_fk"
		}),
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
	userName: text("user_name"),
	password: text(),
	source: text(),
	customerNumber: text("customer_number"),
	apiKey: text("api_key"),
	apiSecret: text("api_secret"),
	sid: text(),
	token: text(),
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
	lastCatalogRecordsSkipped: integer("last_catalog_records_skipped").default(0),
	lastCatalogRecordsFailed: integer("last_catalog_records_failed").default(0),
	lastCatalogRecordsProcessed: integer("last_catalog_records_processed").default(0),
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
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_vendor_credentials_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.supportedVendorId],
			foreignColumns: [supportedVendors.id],
			name: "company_vendor_credentials_supported_vendor_id_supported_vendor"
		}),
	unique("company_vendor_credentials_unique").on(table.companyId, table.supportedVendorId),
]);

export const vendorProducts = pgTable("vendor_products", {
	id: serial().primaryKey().notNull(),
	vendorId: integer("vendor_id").notNull(),
	productId: integer("product_id").notNull(),
	vendorSku: text("vendor_sku").notNull(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "vendor_products_vendor_id_vendors_id_fk"
		}),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "vendor_products_product_id_products_id_fk"
		}),
]);

export const subscriptionPayments = pgTable("subscription_payments", {
	id: serial().primaryKey().notNull(),
	subscriptionId: integer("subscription_id").notNull(),
	companyId: integer("company_id").notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	currency: text().default('USD'),
	status: text().notNull(),
	paymentMethod: text("payment_method"),
	externalPaymentId: text("external_payment_id"),
	externalInvoiceId: text("external_invoice_id"),
	externalInvoiceNumber: text("external_invoice_number"),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	dueDate: timestamp("due_date", { mode: 'string' }),
	failureReason: text("failure_reason"),
	retryCount: integer("retry_count").default(0),
	nextRetryAt: timestamp("next_retry_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "subscription_payments_subscription_id_subscriptions_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "subscription_payments_company_id_companies_id_fk"
		}),
]);

export const vendorProductMappings = pgTable("vendor_product_mappings", {
	id: serial().primaryKey().notNull(),
	productId: integer("product_id").notNull(),
	supportedVendorId: integer("supported_vendor_id").notNull(),
	companyId: integer("company_id"),
	vendorSku: text("vendor_sku").notNull(),
	vendorCost: numeric("vendor_cost", { precision: 10, scale:  2 }),
	mapPrice: numeric("map_price", { precision: 10, scale:  2 }),
	msrpPrice: numeric("msrp_price", { precision: 10, scale:  2 }),
	lastPriceUpdate: timestamp("last_price_update", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("company_vendor_idx").using("btree", table.companyId.asc().nullsLast().op("int4_ops"), table.supportedVendorId.asc().nullsLast().op("int4_ops")),
	index("vendor_sku_idx").using("btree", table.supportedVendorId.asc().nullsLast().op("text_ops"), table.vendorSku.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "vendor_product_mappings_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.supportedVendorId],
			foreignColumns: [supportedVendors.id],
			name: "vendor_product_mappings_supported_vendor_id_supported_vendors_i"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "vendor_product_mappings_company_id_companies_id_fk"
		}),
	unique("product_vendor_company_unique").on(table.productId, table.supportedVendorId, table.companyId),
]);

import { relations } from "drizzle-orm/relations";
import { retailVerticals, companies, categories, categoryTemplates, orders, asns, vendors, billingEvents, integrationSettings, importJobs, users, orderItems, products, vendorProducts, organizationStatusAuditLog, stores, poSequences, orgDomains, pricingConfigurations, settings, searchHistory, subscriptionUsage, subscriptions, subscriptionPlanChanges, subscriptionWebhookEvents, userStores, supportedVendors, vendorInventory, supportedVendorRetailVerticals, usageMetrics, asnItems, companyVendorCredentials, subscriptionPayments, vendorProductMappings } from "./schema";

export const companiesRelations = relations(companies, ({one, many}) => ({
	retailVertical: one(retailVerticals, {
		fields: [companies.retailVerticalId],
		references: [retailVerticals.id]
	}),
	categories: many(categories),
	billingEvents: many(billingEvents),
	integrationSettings: many(integrationSettings),
	importJobs: many(importJobs),
	organizationStatusAuditLogs: many(organizationStatusAuditLog),
	orders: many(orders),
	orgDomains: many(orgDomains),
	pricingConfigurations: many(pricingConfigurations),
	settings: many(settings),
	searchHistories: many(searchHistory),
	stores: many(stores),
	subscriptionUsages: many(subscriptionUsage),
	subscriptionPlanChanges: many(subscriptionPlanChanges),
	subscriptionWebhookEvents: many(subscriptionWebhookEvents),
	users: many(users),
	subscriptions: many(subscriptions),
	usageMetrics: many(usageMetrics),
	vendors: many(vendors),
	companyVendorCredentials: many(companyVendorCredentials),
	subscriptionPayments: many(subscriptionPayments),
	vendorProductMappings: many(vendorProductMappings),
}));

export const retailVerticalsRelations = relations(retailVerticals, ({many}) => ({
	companies: many(companies),
	categoryTemplates: many(categoryTemplates),
	products: many(products),
	supportedVendorRetailVerticals: many(supportedVendorRetailVerticals),
}));

export const categoriesRelations = relations(categories, ({one}) => ({
	company: one(companies, {
		fields: [categories.companyId],
		references: [companies.id]
	}),
}));

export const categoryTemplatesRelations = relations(categoryTemplates, ({one}) => ({
	retailVertical: one(retailVerticals, {
		fields: [categoryTemplates.retailVerticalId],
		references: [retailVerticals.id]
	}),
}));

export const asnsRelations = relations(asns, ({one, many}) => ({
	order: one(orders, {
		fields: [asns.orderId],
		references: [orders.id]
	}),
	vendor: one(vendors, {
		fields: [asns.vendorId],
		references: [vendors.id]
	}),
	asnItems: many(asnItems),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	asns: many(asns),
	orderItems: many(orderItems),
	company: one(companies, {
		fields: [orders.companyId],
		references: [companies.id]
	}),
	store: one(stores, {
		fields: [orders.storeId],
		references: [stores.id]
	}),
	vendor: one(vendors, {
		fields: [orders.vendorId],
		references: [vendors.id]
	}),
	user: one(users, {
		fields: [orders.createdBy],
		references: [users.id]
	}),
}));

export const vendorsRelations = relations(vendors, ({one, many}) => ({
	asns: many(asns),
	orders: many(orders),
	company: one(companies, {
		fields: [vendors.companyId],
		references: [companies.id]
	}),
	supportedVendor: one(supportedVendors, {
		fields: [vendors.supportedVendorId],
		references: [supportedVendors.id]
	}),
	vendorProducts: many(vendorProducts),
}));

export const billingEventsRelations = relations(billingEvents, ({one}) => ({
	company: one(companies, {
		fields: [billingEvents.companyId],
		references: [companies.id]
	}),
}));

export const integrationSettingsRelations = relations(integrationSettings, ({one}) => ({
	company: one(companies, {
		fields: [integrationSettings.companyId],
		references: [companies.id]
	}),
}));

export const importJobsRelations = relations(importJobs, ({one}) => ({
	company: one(companies, {
		fields: [importJobs.organizationId],
		references: [companies.id]
	}),
	user: one(users, {
		fields: [importJobs.createdBy],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	importJobs: many(importJobs),
	orders: many(orders),
	searchHistories: many(searchHistory),
	company: one(companies, {
		fields: [users.companyId],
		references: [companies.id]
	}),
	store: one(stores, {
		fields: [users.defaultStoreId],
		references: [stores.id]
	}),
	userStores: many(userStores),
}));

export const orderItemsRelations = relations(orderItems, ({one, many}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	product: one(products, {
		fields: [orderItems.productId],
		references: [products.id]
	}),
	vendorProduct: one(vendorProducts, {
		fields: [orderItems.vendorProductId],
		references: [vendorProducts.id]
	}),
	asnItems: many(asnItems),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	orderItems: many(orderItems),
	retailVertical: one(retailVerticals, {
		fields: [products.retailVerticalId],
		references: [retailVerticals.id]
	}),
	vendorProducts: many(vendorProducts),
	vendorProductMappings: many(vendorProductMappings),
}));

export const vendorProductsRelations = relations(vendorProducts, ({one, many}) => ({
	orderItems: many(orderItems),
	vendor: one(vendors, {
		fields: [vendorProducts.vendorId],
		references: [vendors.id]
	}),
	product: one(products, {
		fields: [vendorProducts.productId],
		references: [products.id]
	}),
}));

export const organizationStatusAuditLogRelations = relations(organizationStatusAuditLog, ({one}) => ({
	company: one(companies, {
		fields: [organizationStatusAuditLog.companyId],
		references: [companies.id]
	}),
}));

export const poSequencesRelations = relations(poSequences, ({one}) => ({
	store: one(stores, {
		fields: [poSequences.storeId],
		references: [stores.id]
	}),
}));

export const storesRelations = relations(stores, ({one, many}) => ({
	poSequences: many(poSequences),
	orders: many(orders),
	company: one(companies, {
		fields: [stores.companyId],
		references: [companies.id]
	}),
	users: many(users),
	userStores: many(userStores),
}));

export const orgDomainsRelations = relations(orgDomains, ({one}) => ({
	company: one(companies, {
		fields: [orgDomains.companyId],
		references: [companies.id]
	}),
}));

export const pricingConfigurationsRelations = relations(pricingConfigurations, ({one}) => ({
	company: one(companies, {
		fields: [pricingConfigurations.companyId],
		references: [companies.id]
	}),
}));

export const settingsRelations = relations(settings, ({one}) => ({
	company: one(companies, {
		fields: [settings.companyId],
		references: [companies.id]
	}),
}));

export const searchHistoryRelations = relations(searchHistory, ({one}) => ({
	company: one(companies, {
		fields: [searchHistory.companyId],
		references: [companies.id]
	}),
	user: one(users, {
		fields: [searchHistory.userId],
		references: [users.id]
	}),
}));

export const subscriptionUsageRelations = relations(subscriptionUsage, ({one}) => ({
	company: one(companies, {
		fields: [subscriptionUsage.companyId],
		references: [companies.id]
	}),
	subscription: one(subscriptions, {
		fields: [subscriptionUsage.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const subscriptionsRelations = relations(subscriptions, ({one, many}) => ({
	subscriptionUsages: many(subscriptionUsage),
	subscriptionPlanChanges: many(subscriptionPlanChanges),
	subscriptionWebhookEvents: many(subscriptionWebhookEvents),
	company: one(companies, {
		fields: [subscriptions.companyId],
		references: [companies.id]
	}),
	subscriptionPayments: many(subscriptionPayments),
}));

export const subscriptionPlanChangesRelations = relations(subscriptionPlanChanges, ({one}) => ({
	subscription: one(subscriptions, {
		fields: [subscriptionPlanChanges.subscriptionId],
		references: [subscriptions.id]
	}),
	company: one(companies, {
		fields: [subscriptionPlanChanges.companyId],
		references: [companies.id]
	}),
}));

export const subscriptionWebhookEventsRelations = relations(subscriptionWebhookEvents, ({one}) => ({
	company: one(companies, {
		fields: [subscriptionWebhookEvents.companyId],
		references: [companies.id]
	}),
	subscription: one(subscriptions, {
		fields: [subscriptionWebhookEvents.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const userStoresRelations = relations(userStores, ({one}) => ({
	user: one(users, {
		fields: [userStores.userId],
		references: [users.id]
	}),
	store: one(stores, {
		fields: [userStores.storeId],
		references: [stores.id]
	}),
}));

export const vendorInventoryRelations = relations(vendorInventory, ({one}) => ({
	supportedVendor: one(supportedVendors, {
		fields: [vendorInventory.supportedVendorId],
		references: [supportedVendors.id]
	}),
}));

export const supportedVendorsRelations = relations(supportedVendors, ({many}) => ({
	vendorInventories: many(vendorInventory),
	supportedVendorRetailVerticals: many(supportedVendorRetailVerticals),
	vendors: many(vendors),
	companyVendorCredentials: many(companyVendorCredentials),
	vendorProductMappings: many(vendorProductMappings),
}));

export const supportedVendorRetailVerticalsRelations = relations(supportedVendorRetailVerticals, ({one}) => ({
	supportedVendor: one(supportedVendors, {
		fields: [supportedVendorRetailVerticals.supportedVendorId],
		references: [supportedVendors.id]
	}),
	retailVertical: one(retailVerticals, {
		fields: [supportedVendorRetailVerticals.retailVerticalId],
		references: [retailVerticals.id]
	}),
}));

export const usageMetricsRelations = relations(usageMetrics, ({one}) => ({
	company: one(companies, {
		fields: [usageMetrics.companyId],
		references: [companies.id]
	}),
}));

export const asnItemsRelations = relations(asnItems, ({one}) => ({
	asn: one(asns, {
		fields: [asnItems.asnId],
		references: [asns.id]
	}),
	orderItem: one(orderItems, {
		fields: [asnItems.orderItemId],
		references: [orderItems.id]
	}),
}));

export const companyVendorCredentialsRelations = relations(companyVendorCredentials, ({one}) => ({
	company: one(companies, {
		fields: [companyVendorCredentials.companyId],
		references: [companies.id]
	}),
	supportedVendor: one(supportedVendors, {
		fields: [companyVendorCredentials.supportedVendorId],
		references: [supportedVendors.id]
	}),
}));

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({one}) => ({
	subscription: one(subscriptions, {
		fields: [subscriptionPayments.subscriptionId],
		references: [subscriptions.id]
	}),
	company: one(companies, {
		fields: [subscriptionPayments.companyId],
		references: [companies.id]
	}),
}));

export const vendorProductMappingsRelations = relations(vendorProductMappings, ({one}) => ({
	product: one(products, {
		fields: [vendorProductMappings.productId],
		references: [products.id]
	}),
	supportedVendor: one(supportedVendors, {
		fields: [vendorProductMappings.supportedVendorId],
		references: [supportedVendors.id]
	}),
	company: one(companies, {
		fields: [vendorProductMappings.companyId],
		references: [companies.id]
	}),
}));
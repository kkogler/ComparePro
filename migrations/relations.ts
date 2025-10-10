import { relations } from "drizzle-orm/relations";
import { companies, vendorProductMappings, products, supportedVendors, orders, orderItems, vendorProducts, stores, users, supportedVendorRetailVerticals, retailVerticals, companyVendorCredentials, vendorInventory, categoryTemplates, billingEvents, categories, importJobs, integrationSettings, orgDomains, vendors, asns, poSequences, userStores, organizationStatusAuditLog, pricingConfigurations, searchHistory, settings, subscriptionPayments, subscriptions, subscriptionPlanChanges, subscriptionUsage, subscriptionWebhookEvents, usageMetrics, asnItems } from "./schema";

export const vendorProductMappingsRelations = relations(vendorProductMappings, ({one}) => ({
	company: one(companies, {
		fields: [vendorProductMappings.companyId],
		references: [companies.id]
	}),
	product: one(products, {
		fields: [vendorProductMappings.productId],
		references: [products.id]
	}),
	supportedVendor: one(supportedVendors, {
		fields: [vendorProductMappings.supportedVendorId],
		references: [supportedVendors.id]
	}),
}));

export const companiesRelations = relations(companies, ({one, many}) => ({
	vendorProductMappings: many(vendorProductMappings),
	stores: many(stores),
	users: many(users),
	companyVendorCredentials: many(companyVendorCredentials),
	retailVertical: one(retailVerticals, {
		fields: [companies.retailVerticalId],
		references: [retailVerticals.id]
	}),
	billingEvents: many(billingEvents),
	categories: many(categories),
	importJobs: many(importJobs),
	integrationSettings: many(integrationSettings),
	orgDomains: many(orgDomains),
	vendors: many(vendors),
	orders: many(orders),
	organizationStatusAuditLogs: many(organizationStatusAuditLog),
	pricingConfigurations: many(pricingConfigurations),
	searchHistories: many(searchHistory),
	settings: many(settings),
	subscriptionPayments: many(subscriptionPayments),
	subscriptionPlanChanges: many(subscriptionPlanChanges),
	subscriptionUsages: many(subscriptionUsage),
	subscriptionWebhookEvents: many(subscriptionWebhookEvents),
	subscriptions: many(subscriptions),
	usageMetrics: many(usageMetrics),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	vendorProductMappings: many(vendorProductMappings),
	orderItems: many(orderItems),
	retailVertical: one(retailVerticals, {
		fields: [products.retailVerticalId],
		references: [retailVerticals.id]
	}),
	vendorProducts: many(vendorProducts),
}));

export const supportedVendorsRelations = relations(supportedVendors, ({many}) => ({
	vendorProductMappings: many(vendorProductMappings),
	supportedVendorRetailVerticals: many(supportedVendorRetailVerticals),
	companyVendorCredentials: many(companyVendorCredentials),
	vendorInventories: many(vendorInventory),
	vendors: many(vendors),
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

export const ordersRelations = relations(orders, ({one, many}) => ({
	orderItems: many(orderItems),
	asns: many(asns),
	company: one(companies, {
		fields: [orders.companyId],
		references: [companies.id]
	}),
	user: one(users, {
		fields: [orders.createdBy],
		references: [users.id]
	}),
	store: one(stores, {
		fields: [orders.storeId],
		references: [stores.id]
	}),
	vendor: one(vendors, {
		fields: [orders.vendorId],
		references: [vendors.id]
	}),
}));

export const vendorProductsRelations = relations(vendorProducts, ({one, many}) => ({
	orderItems: many(orderItems),
	product: one(products, {
		fields: [vendorProducts.productId],
		references: [products.id]
	}),
	vendor: one(vendors, {
		fields: [vendorProducts.vendorId],
		references: [vendors.id]
	}),
}));

export const storesRelations = relations(stores, ({one, many}) => ({
	company: one(companies, {
		fields: [stores.companyId],
		references: [companies.id]
	}),
	users: many(users),
	poSequences: many(poSequences),
	userStores: many(userStores),
	orders: many(orders),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	company: one(companies, {
		fields: [users.companyId],
		references: [companies.id]
	}),
	store: one(stores, {
		fields: [users.defaultStoreId],
		references: [stores.id]
	}),
	importJobs: many(importJobs),
	userStores: many(userStores),
	orders: many(orders),
	searchHistories: many(searchHistory),
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

export const retailVerticalsRelations = relations(retailVerticals, ({many}) => ({
	supportedVendorRetailVerticals: many(supportedVendorRetailVerticals),
	categoryTemplates: many(categoryTemplates),
	companies: many(companies),
	products: many(products),
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

export const vendorInventoryRelations = relations(vendorInventory, ({one}) => ({
	supportedVendor: one(supportedVendors, {
		fields: [vendorInventory.supportedVendorId],
		references: [supportedVendors.id]
	}),
}));

export const categoryTemplatesRelations = relations(categoryTemplates, ({one}) => ({
	retailVertical: one(retailVerticals, {
		fields: [categoryTemplates.retailVerticalId],
		references: [retailVerticals.id]
	}),
}));

export const billingEventsRelations = relations(billingEvents, ({one}) => ({
	company: one(companies, {
		fields: [billingEvents.companyId],
		references: [companies.id]
	}),
}));

export const categoriesRelations = relations(categories, ({one}) => ({
	company: one(companies, {
		fields: [categories.companyId],
		references: [companies.id]
	}),
}));

export const importJobsRelations = relations(importJobs, ({one}) => ({
	user: one(users, {
		fields: [importJobs.createdBy],
		references: [users.id]
	}),
	company: one(companies, {
		fields: [importJobs.organizationId],
		references: [companies.id]
	}),
}));

export const integrationSettingsRelations = relations(integrationSettings, ({one}) => ({
	company: one(companies, {
		fields: [integrationSettings.companyId],
		references: [companies.id]
	}),
}));

export const orgDomainsRelations = relations(orgDomains, ({one}) => ({
	company: one(companies, {
		fields: [orgDomains.companyId],
		references: [companies.id]
	}),
}));

export const vendorsRelations = relations(vendors, ({one, many}) => ({
	vendorProducts: many(vendorProducts),
	company: one(companies, {
		fields: [vendors.companyId],
		references: [companies.id]
	}),
	supportedVendor: one(supportedVendors, {
		fields: [vendors.supportedVendorId],
		references: [supportedVendors.id]
	}),
	asns: many(asns),
	orders: many(orders),
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

export const poSequencesRelations = relations(poSequences, ({one}) => ({
	store: one(stores, {
		fields: [poSequences.storeId],
		references: [stores.id]
	}),
}));

export const userStoresRelations = relations(userStores, ({one}) => ({
	store: one(stores, {
		fields: [userStores.storeId],
		references: [stores.id]
	}),
	user: one(users, {
		fields: [userStores.userId],
		references: [users.id]
	}),
}));

export const organizationStatusAuditLogRelations = relations(organizationStatusAuditLog, ({one}) => ({
	company: one(companies, {
		fields: [organizationStatusAuditLog.companyId],
		references: [companies.id]
	}),
}));

export const pricingConfigurationsRelations = relations(pricingConfigurations, ({one}) => ({
	company: one(companies, {
		fields: [pricingConfigurations.companyId],
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

export const settingsRelations = relations(settings, ({one}) => ({
	company: one(companies, {
		fields: [settings.companyId],
		references: [companies.id]
	}),
}));

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({one}) => ({
	company: one(companies, {
		fields: [subscriptionPayments.companyId],
		references: [companies.id]
	}),
	subscription: one(subscriptions, {
		fields: [subscriptionPayments.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const subscriptionsRelations = relations(subscriptions, ({one, many}) => ({
	subscriptionPayments: many(subscriptionPayments),
	subscriptionPlanChanges: many(subscriptionPlanChanges),
	subscriptionUsages: many(subscriptionUsage),
	subscriptionWebhookEvents: many(subscriptionWebhookEvents),
	company: one(companies, {
		fields: [subscriptions.companyId],
		references: [companies.id]
	}),
}));

export const subscriptionPlanChangesRelations = relations(subscriptionPlanChanges, ({one}) => ({
	company: one(companies, {
		fields: [subscriptionPlanChanges.companyId],
		references: [companies.id]
	}),
	subscription: one(subscriptions, {
		fields: [subscriptionPlanChanges.subscriptionId],
		references: [subscriptions.id]
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
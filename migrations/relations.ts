import { relations } from "drizzle-orm/relations";
import { orders, orderItems, products, vendorProducts, asns, vendors, retailVerticals, companies, billingEvents, asnItems, supportedVendors, stores, users, searchHistory, importJobs, userStores, settings, userPreferences, poSequences, pricingConfigurations, vendorProductMappings, companyVendorCredentials, vendorInventory, categories, supportedVendorRetailVerticals, subscriptions, subscriptionPlanChanges, subscriptionPayments, subscriptionWebhookEvents, subscriptionUsage } from "./schema";

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
	vendor: one(vendors, {
		fields: [orders.vendorId],
		references: [vendors.id]
	}),
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
}));

export const productsRelations = relations(products, ({one, many}) => ({
	orderItems: many(orderItems),
	vendorProducts: many(vendorProducts),
	vendorProductMappings: many(vendorProductMappings),
	retailVertical: one(retailVerticals, {
		fields: [products.retailVerticalId],
		references: [retailVerticals.id]
	}),
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

export const vendorsRelations = relations(vendors, ({one, many}) => ({
	asns: many(asns),
	company: one(companies, {
		fields: [vendors.companyId],
		references: [companies.id]
	}),
	supportedVendor: one(supportedVendors, {
		fields: [vendors.supportedVendorId],
		references: [supportedVendors.id]
	}),
	vendorProducts: many(vendorProducts),
	orders: many(orders),
}));

export const companiesRelations = relations(companies, ({one, many}) => ({
	retailVertical: one(retailVerticals, {
		fields: [companies.retailVerticalId],
		references: [retailVerticals.id]
	}),
	billingEvents: many(billingEvents),
	vendors: many(vendors),
	searchHistories: many(searchHistory),
	importJobs: many(importJobs),
	settings: many(settings),
	stores: many(stores),
	orders: many(orders),
	pricingConfigurations: many(pricingConfigurations),
	vendorProductMappings: many(vendorProductMappings),
	companyVendorCredentials: many(companyVendorCredentials),
	categories: many(categories),
	subscriptions: many(subscriptions),
}));

export const retailVerticalsRelations = relations(retailVerticals, ({many}) => ({
	companies: many(companies),
	pricingConfigurations: many(pricingConfigurations),
	supportedVendorRetailVerticals: many(supportedVendorRetailVerticals),
	products: many(products),
	supportedVendors: many(supportedVendors),
}));

export const billingEventsRelations = relations(billingEvents, ({one}) => ({
	company: one(companies, {
		fields: [billingEvents.companyId],
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

export const supportedVendorsRelations = relations(supportedVendors, ({one, many}) => ({
	vendors: many(vendors),
	vendorProductMappings: many(vendorProductMappings),
	companyVendorCredentials: many(companyVendorCredentials),
	vendorInventories: many(vendorInventory),
	supportedVendorRetailVerticals: many(supportedVendorRetailVerticals),
	retailVertical: one(retailVerticals, {
		fields: [supportedVendors.retailVerticalId],
		references: [retailVerticals.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	store: one(stores, {
		fields: [users.defaultStoreId],
		references: [stores.id]
	}),
	searchHistories: many(searchHistory),
	importJobs: many(importJobs),
	userStores: many(userStores),
	userPreferences: many(userPreferences),
	orders: many(orders),
}));

export const storesRelations = relations(stores, ({one, many}) => ({
	users: many(users),
	userStores: many(userStores),
	company: one(companies, {
		fields: [stores.companyId],
		references: [companies.id]
	}),
	orders: many(orders),
	poSequences: many(poSequences),
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

export const settingsRelations = relations(settings, ({one}) => ({
	company: one(companies, {
		fields: [settings.companyId],
		references: [companies.id]
	}),
}));

export const userPreferencesRelations = relations(userPreferences, ({one}) => ({
	user: one(users, {
		fields: [userPreferences.userId],
		references: [users.id]
	}),
}));

export const poSequencesRelations = relations(poSequences, ({one}) => ({
	store: one(stores, {
		fields: [poSequences.storeId],
		references: [stores.id]
	}),
}));

export const pricingConfigurationsRelations = relations(pricingConfigurations, ({one}) => ({
	company: one(companies, {
		fields: [pricingConfigurations.companyId],
		references: [companies.id]
	}),
	retailVertical: one(retailVerticals, {
		fields: [pricingConfigurations.retailVerticalId],
		references: [retailVerticals.id]
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

export const categoriesRelations = relations(categories, ({one}) => ({
	company: one(companies, {
		fields: [categories.companyId],
		references: [companies.id]
	}),
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

export const subscriptionPlanChangesRelations = relations(subscriptionPlanChanges, ({one}) => ({
	subscription: one(subscriptions, {
		fields: [subscriptionPlanChanges.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const subscriptionsRelations = relations(subscriptions, ({one, many}) => ({
	subscriptionPlanChanges: many(subscriptionPlanChanges),
	company: one(companies, {
		fields: [subscriptions.companyId],
		references: [companies.id]
	}),
	subscriptionPayments: many(subscriptionPayments),
	subscriptionWebhookEvents: many(subscriptionWebhookEvents),
	subscriptionUsages: many(subscriptionUsage),
}));

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({one}) => ({
	subscription: one(subscriptions, {
		fields: [subscriptionPayments.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const subscriptionWebhookEventsRelations = relations(subscriptionWebhookEvents, ({one}) => ({
	subscription: one(subscriptions, {
		fields: [subscriptionWebhookEvents.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const subscriptionUsageRelations = relations(subscriptionUsage, ({one}) => ({
	subscription: one(subscriptions, {
		fields: [subscriptionUsage.subscriptionId],
		references: [subscriptions.id]
	}),
}));
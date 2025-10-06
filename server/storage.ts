import { 
  users, products, supportedVendors, vendors, vendorProducts, orders, orderItems, asns, asnItems, settings, integrationSettings, companies, orgDomains, billingEvents, adminSettings, searchHistory, retailVerticals, stores, userStores, poSequences, pricingConfigurations, vendorProductMappings, categories, categoryTemplates, supportedVendorRetailVerticals, subscriptions, subscriptionPayments, subscriptionPlanChanges, subscriptionWebhookEvents, subscriptionUsage, planSettings, vendorFieldMappings, organizationStatusAuditLog,
  type User, type InsertUser, type Product, type InsertProduct, type SupportedVendor, type InsertSupportedVendor,
  type Vendor, type InsertVendor, type VendorProduct, type InsertVendorProduct, type Order, type InsertOrder, type OrderItem, type InsertOrderItem,
  type ASN, type InsertASN, type ASNItem, type InsertASNItem, type Settings, type InsertSettings, type IntegrationSettings, type InsertIntegrationSettings,
  type Company, type InsertCompany, type AdminSettings, type InsertAdminSettings, type SearchHistory, type InsertSearchHistory,
  type RetailVertical, type InsertRetailVertical, type Store, type InsertStore, type UserStore, type InsertUserStore, type PoSequence, type InsertPoSequence,
  type PricingConfiguration, type InsertPricingConfiguration, type VendorProductMapping, type InsertVendorProductMapping, type Category, type InsertCategory, type CategoryTemplate, type InsertCategoryTemplate, type SupportedVendorRetailVertical, type InsertSupportedVendorRetailVertical,
  type Subscription, type InsertSubscription, type SubscriptionPayment, type InsertSubscriptionPayment, type SubscriptionPlanChange, type InsertSubscriptionPlanChange, type SubscriptionWebhookEvent, type InsertSubscriptionWebhookEvent, type SubscriptionUsage, type InsertSubscriptionUsage, type PlanSettings, type InsertPlanSettings,
  type VendorFieldMapping, type InsertVendorFieldMapping, type OrganizationStatusAuditLog, type InsertOrganizationStatusAuditLog
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, and, desc, asc, inArray, isNull, gte, sql } from "drizzle-orm";

export interface IStorage {
  // Company methods
  getAllCompanies(): Promise<Company[]>;
  getAllCompaniesWithStats(): Promise<any[]>;
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyBySlug(slug: string): Promise<Company | undefined>;
  getOrganizationByDomain(domain: string): Promise<Company | undefined>;
  getOrganizationBySubdomain(subdomain: string): Promise<Company | undefined>;
  createCompany(data: any): Promise<Company>;
  updateCompany(id: number, updates: any): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;
  getAdminStats(): Promise<any>;
  getAllUsers(): Promise<User[]>;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAdminUserByUsername(username: string): Promise<User | undefined>;
  getUserByUsernameAndCompany(username: string, companyId: number): Promise<User | undefined>;
  getUserByEmailAndCompany(email: string, companyId: number): Promise<User | undefined>;
  getUserByActivationToken(token: string, companyId: number): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string, companyId: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserLastLogin(id: number): Promise<User | undefined>;
  activateUser(id: number, hashedPassword: string): Promise<User | undefined>;
  setPasswordResetToken(id: number, token: string, expires: Date): Promise<User | undefined>;
  resetUserPassword(id: number, hashedPassword: string): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAdminUsers(): Promise<User[]>;
  isDevOpsUser?(user: User): boolean;

  // Company User methods (using unified users table)
  getCompanyUsers(companyId: number): Promise<User[]>;

  // Store methods
  getStore(id: number): Promise<Store | undefined>;
  getStoreBySlug(companyId: number, slug: string): Promise<Store | undefined>;
  getStoresByCompany(companyId: number): Promise<Store[]>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: number, updates: Partial<Store>): Promise<Store | undefined>;
  deleteStore(id: number): Promise<boolean>;

  // User preferences methods
  getUserPreference(userId: number, preferenceType: string): Promise<any | undefined>;
  setUserPreference(userId: number, preferenceType: string, preferences: any): Promise<void>;

  // User-Store methods
  getUserStores(userId: number): Promise<(UserStore & { store: Store })[]>;
  getStoreUsers(storeId: number): Promise<(UserStore & { user: User })[]>;
  assignUserToStore(assignment: InsertUserStore): Promise<UserStore>;
  removeUserFromStore(userId: number, storeId: number): Promise<boolean>;
  updateUserStoreRole(userId: number, storeId: number, role: string, permissions?: string[]): Promise<UserStore | undefined>;

  // PO Sequence methods
  getNextPoSequence(storeId: number): Promise<number>;

  // Product methods
  getProduct(id: number): Promise<Product | undefined>;
  getProductByUPC(upc: string): Promise<Product | undefined>;
  getProductByPartNumber(partNumber: string): Promise<Product | undefined>;
  searchProducts(query: string, type: 'upc' | 'name' | 'partNumber' | 'manufacturerPartNumber' | 'sku' | 'altId1' | 'altId2', limit?: number, retailVerticalId?: number): Promise<Product[]>;
  searchProductsWithCount(query: string, type: 'upc' | 'name' | 'partNumber' | 'manufacturerPartNumber' | 'sku' | 'altId1' | 'altId2', page?: number, limit?: number, retailVerticalId?: number): Promise<{ products: Product[], totalCount: number, currentPage: number, totalPages: number }>;
  createProduct(product: any): Promise<Product>;
  updateProduct(id: number, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  getAllProducts(): Promise<(Product & { retailVertical: string | null })[]>;
  getProductsByRetailVertical(retailVerticalId: number): Promise<Product[]>;

  // Supported Vendor methods (Admin only)
  getAllSupportedVendors(): Promise<SupportedVendor[]>;
  getSupportedVendor(id: number): Promise<SupportedVendor | undefined>;
  getSupportedVendorById(id: number): Promise<SupportedVendor | undefined>;
  getSupportedVendorByName(name: string): Promise<SupportedVendor | undefined>;
  createSupportedVendor(vendor: InsertSupportedVendor): Promise<SupportedVendor>;
  updateSupportedVendor(id: number, updates: Partial<SupportedVendor>): Promise<SupportedVendor | undefined>;
  deleteSupportedVendor(id: number): Promise<boolean>;

  // Vendor methods
  getVendor(id: number): Promise<Vendor | undefined>;
  getVendorBySlug(slug: string, companyId: number): Promise<Vendor | undefined>;
  getAllVendors(): Promise<Vendor[]>;
  getVendorsByCompany(companyId: number, includeArchived?: boolean): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: number, updates: Partial<Vendor>): Promise<Vendor | undefined>;
  updateVendorBySlug(slug: string, companyId: number, updates: Partial<Vendor>): Promise<Vendor | undefined>;
  updateVendorEnabledStatusBySlug(companyId: number, vendorSlug: string, enabled: boolean): Promise<void>;
  updateVendorCredentials(id: number, companyId: number, credentials: any): Promise<Vendor | undefined>;
  updateVendorLogo(vendorId: number, logoUrl: string, companyId: number): Promise<Vendor | undefined>;
  createVendorsFromSupported(companyId: number, retailVerticalId?: number): Promise<void>;

  // Vendor product methods
  getVendorProduct(id: number): Promise<VendorProduct | undefined>;
  getVendorProductBySku(vendorId: number, sku: string): Promise<VendorProduct | undefined>;
  getAllVendorProducts(): Promise<VendorProduct[]>;
  getVendorProductsByProductId(productId: number): Promise<VendorProduct[]>;
  getVendorProductsByProductIds(productIds: number[]): Promise<VendorProduct[]>;
  getVendorProductsByProduct(productId: number): Promise<VendorProduct[]>;
  createVendorProduct(vendorProduct: InsertVendorProduct): Promise<VendorProduct>;
  updateVendorProduct(id: number, updates: Partial<VendorProduct>): Promise<VendorProduct | undefined>;

  // Vendor Product Mapping methods (new vendor-agnostic architecture)
  getVendorProductMapping(productId: number, supportedVendorId: number): Promise<VendorProductMapping | undefined>;
  getVendorProductMappingByVendorSku(supportedVendorId: number, vendorSku: string): Promise<VendorProductMapping | undefined>;
  getVendorProductMappingsByProduct(productId: number): Promise<VendorProductMapping[]>;
  getVendorProductMappingsByVendor(supportedVendorId: number): Promise<VendorProductMapping[]>;
  createVendorProductMapping(mapping: InsertVendorProductMapping): Promise<VendorProductMapping>;
  updateVendorProductMapping(id: number, updates: Partial<VendorProductMapping>): Promise<VendorProductMapping | undefined>;
  deleteVendorProductMapping(id: number): Promise<boolean>;

  // Vendor Field Mapping methods (for CSV import column mappings)
  getVendorFieldMapping(vendorSource: string, mappingName?: string): Promise<VendorFieldMapping | undefined>;
  getVendorFieldMappingsByVendor(vendorSource: string): Promise<VendorFieldMapping[]>;
  getAllVendorFieldMappings(): Promise<VendorFieldMapping[]>;
  createVendorFieldMapping(mapping: InsertVendorFieldMapping): Promise<VendorFieldMapping>;
  updateVendorFieldMapping(id: number, updates: Partial<VendorFieldMapping>): Promise<VendorFieldMapping | undefined>;
  deleteVendorFieldMapping(id: number): Promise<boolean>;
  upsertVendorFieldMapping(vendorSource: string, mappingName: string, columnMappings: Record<string, string>): Promise<VendorFieldMapping>;

  // Order methods
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getOrderByExternalNumber(externalOrderNumber: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;

  // Order item methods
  getOrderItem(id: number): Promise<OrderItem | undefined>;
  getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;

  // ASN methods
  getASN(id: number): Promise<ASN | undefined>;
  getASNByNumber(asnNumber: string): Promise<ASN | undefined>;
  getAllASNs(): Promise<ASN[]>;
  getASNsByStatus(status: string): Promise<ASN[]>;
  createASN(asn: InsertASN): Promise<ASN>;
  updateASN(id: number, updates: Partial<ASN>): Promise<ASN | undefined>;

  // ASN item methods
  getASNItem(id: number): Promise<ASNItem | undefined>;
  getASNItemsByASNId(asnId: number): Promise<ASNItem[]>;
  createASNItem(asnItem: InsertASNItem): Promise<ASNItem>;

  // Settings methods
  getSettings(companyId?: number): Promise<Settings | undefined>;
  createSettings(settings: InsertSettings): Promise<Settings>;
  updateSettings(companyId: number, updates: Partial<Settings>): Promise<Settings | undefined>;
  
  // Admin Settings methods
  getAdminSettings(): Promise<AdminSettings | undefined>;
  createAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings>;
  updateAdminSettings(updates: Partial<AdminSettings>): Promise<AdminSettings | undefined>;

  // Billing Events methods
  getAllBillingEvents(): Promise<any[]>;
  createBillingEvent(event: any): Promise<any>;

  // Company-specific methods
  getOrdersByCompany(companyId: number): Promise<Order[]>;
  getASNsByCompany(companyId: number): Promise<ASN[]>;

  // Search History methods
  createSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory>;
  getRecentSearchHistory(companyId: number, userId: number, limit?: number): Promise<SearchHistory[]>;

  // Model extraction methods
  getProductsWithMissingModels(): Promise<Product[]>;

  // Retail Verticals methods
  getAllRetailVerticals(): Promise<RetailVertical[]>;
  getRetailVerticals(): Promise<RetailVertical[]>;
  getRetailVertical(id: number): Promise<RetailVertical | undefined>;
  getRetailVerticalBySlug(slug: string): Promise<RetailVertical | undefined>;
  createRetailVertical(vertical: InsertRetailVertical): Promise<RetailVertical>;
  updateRetailVertical(id: number, updates: Partial<RetailVertical>): Promise<RetailVertical | undefined>;
  deleteRetailVertical(id: number): Promise<boolean>;

  // Pricing Configuration methods
  getPricingConfigurations(companyId: number): Promise<PricingConfiguration[]>;
  getPricingConfiguration(id: number): Promise<PricingConfiguration | undefined>;
  getDefaultPricingConfiguration(companyId: number): Promise<PricingConfiguration | undefined>;
  createPricingConfiguration(config: InsertPricingConfiguration): Promise<PricingConfiguration>;
  updatePricingConfiguration(id: number, updates: Partial<PricingConfiguration>): Promise<PricingConfiguration | undefined>;
  deletePricingConfiguration(id: number): Promise<boolean>;
  setDefaultPricingConfiguration(companyId: number, configId: number): Promise<boolean>;

  // Bill Hicks Vendor Credentials methods
  getCompanyVendorCredentials(companyId: number, supportedVendorId: number): Promise<any | undefined>;
  upsertCompanyVendorCredentials(credentials: any): Promise<any>;
  saveCompanyVendorCredentials(companyId: number, supportedVendorId: number, credentials: any): Promise<any>;
  getVendorMappingCount(companyId: number, supportedVendorId: number): Promise<number>;
  getBillHicksInventoryCount(): Promise<number>;

  // Category methods
  getCategory(id: number): Promise<Category | undefined>;
  getCategoriesByCompany(companyId: number): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, updates: Partial<Category>): Promise<Category | undefined>;
  updateCategorySortOrder(id: number, sortOrder: number): Promise<boolean>;
  deleteCategory(id: number, reassignToId?: number): Promise<boolean>;
  getProductCountByCategory(categorySlug: string): Promise<number>;

  // Category Template methods
  getCategoryTemplatesByRetailVertical(retailVerticalId: number): Promise<any[]>;
  createCategoryTemplate(template: any): Promise<any>;
  updateCategoryTemplate(id: number, updates: any): Promise<any>;
  deleteCategoryTemplate(id: number): Promise<boolean>;
  copyCategoryTemplatesToCompany(companyId: number, retailVerticalId: number): Promise<number>;

  // Subscription methods
  getSubscription(id: number): Promise<Subscription | undefined>;
  getSubscriptionByCompany(companyId: number): Promise<Subscription | undefined>;
  getSubscriptionByZohoId(zohoSubscriptionId: string): Promise<Subscription | undefined>;
  getAllSubscriptions(): Promise<Subscription[]>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: number, updates: Partial<Subscription>): Promise<Subscription | undefined>;
  cancelSubscription(id: number): Promise<boolean>;

  // Subscription Payment methods
  createSubscriptionPayment(payment: InsertSubscriptionPayment): Promise<SubscriptionPayment>;
  getPaymentsBySubscription(subscriptionId: number): Promise<SubscriptionPayment[]>;

  // Subscription Plan Change methods
  createSubscriptionPlanChange(change: InsertSubscriptionPlanChange): Promise<SubscriptionPlanChange>;
  getPlanChangesBySubscription(subscriptionId: number): Promise<SubscriptionPlanChange[]>;

  // Subscription Webhook Event methods
  createSubscriptionWebhookEvent(event: InsertSubscriptionWebhookEvent): Promise<SubscriptionWebhookEvent>;
  getWebhookEventsBySubscription(subscriptionId: number): Promise<SubscriptionWebhookEvent[]>;

  // Subscription Usage methods
  createSubscriptionUsage(usage: InsertSubscriptionUsage): Promise<SubscriptionUsage>;
  getUsageBySubscription(subscriptionId: number): Promise<SubscriptionUsage[]>;
  getCurrentUsage(companyId: number): Promise<SubscriptionUsage | undefined>;

  // Plan Settings methods
  getAllPlanSettings(): Promise<PlanSettings[]>;
  getPlanSettings(planId: string): Promise<PlanSettings | undefined>;
  updatePlanSettings(planId: string, updates: Partial<PlanSettings>): Promise<PlanSettings | undefined>;

  // Organization Status Audit Log methods
  logOrganizationStatusChange(data: InsertOrganizationStatusAuditLog): Promise<OrganizationStatusAuditLog>;
  getOrganizationStatusHistory(companyId: number): Promise<OrganizationStatusAuditLog[]>;
}

export class DatabaseStorage implements IStorage {

  // Implement all required IStorage methods...
  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async getAllCompaniesWithStats(): Promise<any[]> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const result = await db.execute(sql`
        SELECT 
          c.*,
          COALESCE(store_counts.count, 0) as store_count,
          COALESCE(order_counts.count, 0) as monthly_orders,
          user_stats.last_login,
          sub_events.subscription_created_at,
          COALESCE(c.email, admin_users.email) as signup_email
        FROM companies c
        LEFT JOIN (
          SELECT company_id, COUNT(*) as count
          FROM stores
          GROUP BY company_id
        ) store_counts ON c.id = store_counts.company_id
        LEFT JOIN (
          SELECT company_id, COUNT(*) as count
          FROM orders
          WHERE created_at >= ${startOfMonth}
          GROUP BY company_id
        ) order_counts ON c.id = order_counts.company_id
        LEFT JOIN (
          SELECT company_id, MAX(last_login) as last_login
          FROM users
          GROUP BY company_id
        ) user_stats ON c.id = user_stats.company_id
        LEFT JOIN (
          SELECT DISTINCT ON (company_id) company_id, created_at as subscription_created_at
          FROM billing_events
          WHERE event_type = 'subscription_created'
          ORDER BY company_id, created_at ASC
        ) sub_events ON c.id = sub_events.company_id
        LEFT JOIN (
          SELECT DISTINCT ON (company_id) company_id, email
          FROM users
          WHERE role = 'admin'
          ORDER BY company_id, id ASC
        ) admin_users ON c.id = admin_users.company_id
        ORDER BY c.id
      `);

      return result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        plan: row.plan,
        email: row.email,
        billingEmail: row.billing_email,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        storeCount: parseInt(row.store_count || '0'),
        monthlyOrders: parseInt(row.monthly_orders || '0'),
        lastLogin: row.last_login,
        subscriptionCreatedAt: row.subscription_created_at,
        signupEmail: row.signup_email
      }));
    } catch (error) {
      console.error('Error getting companies with stats:', error);
      return [];
    }
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [result] = await db.select().from(companies).where(eq(companies.id, id));
    return result || undefined;
  }

  async createCompany(data: any): Promise<Company> {
    const [result] = await db.insert(companies).values(data).returning();
    
    // Create default pricing configuration for new company
    await this.createDefaultPricingConfiguration(result.id);
    
    return result;
  }

  // Helper method to create default pricing configuration
  // NOTE: This is now handled by BillingService.provisionCompanyOnboarding()
  // which reads from admin_settings instead of using hardcoded values.
  // This method is kept for backward compatibility but should not be used.
  private async createDefaultPricingConfiguration(companyId: number): Promise<void> {
    console.warn('⚠️ DEPRECATED: createDefaultPricingConfiguration() should not be used. Pricing configs are created by BillingService using admin_settings.');
    // Do nothing - pricing configs should be created via provisioning
  }

  async updateCompany(id: number, updates: any): Promise<Company | undefined> {
    const [result] = await db
      .update(companies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return result || undefined;
  }

  async deleteCompany(id: number): Promise<boolean> {
    try {
      // Delete related records first to avoid foreign key constraint violations
      await db.delete(searchHistory).where(eq(searchHistory.companyId, id));
      await db.delete(settings).where(eq(settings.companyId, id));
      
      // Delete user-store relationships before deleting users
      await db.delete(userStores).where(
        inArray(userStores.userId, db.select({ id: users.id }).from(users).where(eq(users.companyId, id)))
      );
      
      // Clear user default store references before deleting stores
      await db.update(users)
        .set({ defaultStoreId: null })
        .where(eq(users.companyId, id));
      
      // Now we can safely delete stores and then users
      await db.delete(stores).where(eq(stores.companyId, id));
      await db.delete(users).where(eq(users.companyId, id));
      await db.delete(vendors).where(eq(vendors.companyId, id));
      await db.delete(orders).where(eq(orders.companyId, id));
      
      // Finally delete the company
      const result = await db.delete(companies).where(eq(companies.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting company:', error);
      throw error;
    }
  }

  async getAdminStats(): Promise<any> {
    const allCompanies = await db.select().from(companies);
    const totalUsers = await db.select().from(users);
    
    // Calculate monthly orders - orders created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthlyOrdersQuery = await db.select().from(orders).where(
      gte(orders.createdAt, startOfMonth)
    );
    
    return {
      totalCompanies: allCompanies.length,
      newCompaniesThisMonth: allCompanies.filter(company => 
        new Date(company.createdAt).getMonth() === new Date().getMonth() &&
        new Date(company.createdAt).getFullYear() === new Date().getFullYear()
      ).length,
      monthlyRevenue: allCompanies.reduce((sum, company) => 
        sum + (company.plan === "enterprise" ? 199 : company.plan === "professional" ? 99 : 29), 0
      ),
      revenueGrowth: 15.3,
      monthlyOrders: monthlyOrdersQuery.length
    };
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.id, id));
    return result || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.username, username));
    return result || undefined;
  }

  async getAdminUserByUsername(username: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(
      and(eq(users.username, username), isNull(users.companyId))
    );
    return result || undefined;
  }

  async getUserByUsernameAndCompany(username: string, companyId: number): Promise<User | undefined> {
    const [result] = await db.select().from(users)
      .where(and(eq(users.username, username), eq(users.companyId, companyId)));
    return result || undefined;
  }

  async getUserByEmailAndCompany(email: string, companyId: number): Promise<User | undefined> {
    const [result] = await db.select().from(users)
      .where(and(eq(users.email, email), eq(users.companyId, companyId)));
    return result || undefined;
  }

  async getUserByActivationToken(token: string, companyId: number): Promise<User | undefined> {
    const [result] = await db.select().from(users)
      .where(and(
        eq(users.activationToken, token), 
        eq(users.companyId, companyId),
        eq(users.isActive, false)
      ));
    return result || undefined;
  }

  async getUserByPasswordResetToken(token: string, companyId: number): Promise<User | undefined> {
    const [result] = await db.select().from(users)
      .where(and(
        eq(users.passwordResetToken, token), 
        eq(users.companyId, companyId),
        eq(users.isActive, true)
      ));
    return result || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [result] = await db.insert(users).values(user).returning();
    return result;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [result] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return result || undefined;
  }

  async updateUserLastLogin(id: number): Promise<User | undefined> {
    const [result] = await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result || undefined;
  }

  async activateUser(id: number, hashedPassword: string): Promise<User | undefined> {
    const [result] = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        status: 'active',
        isActive: true, // Legacy field
        activationToken: null, // Clear activation token
        activationTokenExpires: null,
        emailVerifiedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return result || undefined;
  }

  async setPasswordResetToken(id: number, token: string, expires: Date): Promise<User | undefined> {
    const [result] = await db
      .update(users)
      .set({ 
        passwordResetToken: token,
        passwordResetTokenExpires: expires
      })
      .where(eq(users.id, id))
      .returning();
    return result || undefined;
  }

  async resetUserPassword(id: number, hashedPassword: string): Promise<User | undefined> {
    const [result] = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        passwordResetToken: null, // Clear reset token
        passwordResetTokenExpires: null
      })
      .where(eq(users.id, id))
      .returning();
    return result || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAdminUsers(): Promise<User[]> {
    return await db.select().from(users).where(isNull(users.companyId));
  }

  isDevOpsUser(user: User): boolean {
    // DevOps users are admin users without organization restrictions
    return user.companyId === null;
  }

  // User preferences methods
  async getUserPreference(userId: number, preferenceType: string): Promise<any | undefined> {
    console.log('*** STORAGE: getUserPreference called with userId:', userId, 'preferenceType:', preferenceType);
    
    const result = await db.execute(sql`
      SELECT preferences FROM user_preferences 
      WHERE user_id = ${userId} AND preference_type = ${preferenceType}
    `);
    
    console.log('*** STORAGE: Query result:', result);
    
    if (result.rows && result.rows.length > 0) {
      const preferences = result.rows[0].preferences;
      console.log('*** STORAGE: Raw preferences:', preferences);
      const parsed = typeof preferences === 'string' ? JSON.parse(preferences) : preferences;
      console.log('*** STORAGE: Parsed preferences:', parsed);
      return parsed;
    }
    
    console.log('*** STORAGE: No preferences found, returning undefined');
    return undefined;
  }

  async setUserPreference(userId: number, preferenceType: string, preferences: any): Promise<void> {
    await db.execute(sql`
      INSERT INTO user_preferences (user_id, preference_type, preferences, updated_at)
      VALUES (${userId}, ${preferenceType}, ${JSON.stringify(preferences)}, NOW())
      ON CONFLICT (user_id, preference_type)
      DO UPDATE SET preferences = ${JSON.stringify(preferences)}, updated_at = NOW()
    `);
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    const [result] = await db.select().from(products).where(eq(products.id, id));
    return result || undefined;
  }

  async getProductByUPC(upc: string): Promise<Product | undefined> {
    const [result] = await db.select().from(products).where(eq(products.upc, upc));
    return result || undefined;
  }

  async getProductByPartNumber(partNumber: string): Promise<Product | undefined> {
    const [result] = await db.select().from(products).where(eq(products.manufacturerPartNumber, partNumber));
    return result || undefined;
  }

  async searchProducts(query: string, type: 'upc' | 'name' | 'partNumber' | 'manufacturerPartNumber' | 'sku' | 'altId1' | 'altId2', limit: number = 100, retailVerticalId?: number): Promise<Product[]> {
    console.log(`STORAGE searchProducts: query="${query}", type="${type}", limit=${limit}, retailVerticalId=${retailVerticalId}`);
    
    if (type === 'sku') {
      // Search vendor products for SKU match
      const vendorProductResults = await db
        .select({ productId: vendorProducts.productId })
        .from(vendorProducts)
        .where(ilike(vendorProducts.vendorSku, `%${query}%`))
        .limit(limit);
      
      if (vendorProductResults.length === 0) return [];
      
      const productIds = vendorProductResults.map(vp => vp.productId);
      
      // Build condition with retail vertical scoping
      const baseCondition = and(
        inArray(products.id, productIds),
        or(eq(products.status, 'active'), isNull(products.status))
      );
      
      const finalCondition = retailVerticalId 
        ? and(baseCondition, eq(products.retailVerticalId, retailVerticalId))
        : baseCondition;
        
      return await db.select().from(products)
        .where(finalCondition)
        .limit(limit);
    }
    
    let baseCondition;
    switch (type) {
      case 'upc':
        // Handle UPC exact matches with and without leading zeros
        const upcQuery = query.trim();
        const paddedUpc = upcQuery.padStart(12, '0'); // Pad to 12 digits
        const trimmedUpc = upcQuery.replace(/^0+/, '') || '0'; // Remove leading zeros, keep at least one digit
        
        baseCondition = and(
          or(
            eq(products.upc, upcQuery),
            eq(products.upc, paddedUpc),
            eq(products.upc, trimmedUpc)
          ),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'name':
        baseCondition = and(
          ilike(products.name, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'partNumber':
        baseCondition = and(
          ilike(products.manufacturerPartNumber, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'manufacturerPartNumber':
        baseCondition = and(
          ilike(products.manufacturerPartNumber, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'altId1':
        baseCondition = and(
          ilike(products.altId1, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'altId2':
        baseCondition = and(
          ilike(products.altId2, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      default:
        baseCondition = and(
          ilike(products.name, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
    }
    
    // Add retail vertical scoping if specified
    const finalCondition = retailVerticalId 
      ? and(baseCondition, eq(products.retailVerticalId, retailVerticalId))
      : baseCondition;
    
    const results = await db.select().from(products).where(finalCondition).limit(limit);
    console.log(`STORAGE searchProducts result: ${results.length} products found (limited to ${limit}) for retailVerticalId=${retailVerticalId}`);
    return results;
  }

  async searchProductsWithCount(query: string, type: 'upc' | 'name' | 'partNumber' | 'manufacturerPartNumber' | 'sku' | 'altId1' | 'altId2' | 'multi_id', page: number = 1, limit: number = 100, retailVerticalId?: number): Promise<{ products: Product[], totalCount: number, currentPage: number, totalPages: number }> {
    console.log(`STORAGE searchProductsWithCount: query="${query}", type="${type}", page=${page}, limit=${limit}, retailVerticalId=${retailVerticalId}`);
    
    if (type === 'sku') {
      // For SKU searches, we need to handle vendor products differently
      const vendorProductResults = await db
        .select({ productId: vendorProducts.productId })
        .from(vendorProducts)
        .where(ilike(vendorProducts.vendorSku, `%${query}%`));
      
      if (vendorProductResults.length === 0) {
        return { products: [], totalCount: 0, currentPage: 1, totalPages: 0 };
      }
      
      const productIds = vendorProductResults.map(vp => vp.productId);
      
      // Build base condition with retail vertical scoping
      const baseCondition = and(
        inArray(products.id, productIds),
        or(eq(products.status, 'active'), isNull(products.status))
      );
      
      const finalCondition = retailVerticalId 
        ? and(baseCondition, eq(products.retailVerticalId, retailVerticalId))
        : baseCondition;
      
      // Count total matching products
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(finalCondition);
      
      const totalCount = countResult.count;
      const totalPages = Math.ceil(totalCount / limit);
      const offset = (page - 1) * limit;
      
      // Get paginated results
      const results = await db.select().from(products)
        .where(finalCondition)
        .limit(limit)
        .offset(offset);
      
      console.log(`STORAGE searchProductsWithCount result: ${results.length} of ${totalCount} products found (page ${page}/${totalPages}) for retailVerticalId=${retailVerticalId}`);
      return { products: results, totalCount, currentPage: page, totalPages };
    }
    
    let baseCondition;
    switch (type) {
      case 'upc':
        // Handle UPC exact matches with and without leading zeros
        const upcQuery = query.trim();
        const paddedUpc = upcQuery.padStart(12, '0'); // Pad to 12 digits
        const trimmedUpc = upcQuery.replace(/^0+/, '') || '0'; // Remove leading zeros, keep at least one digit
        
        baseCondition = and(
          or(
            eq(products.upc, upcQuery),
            eq(products.upc, paddedUpc),
            eq(products.upc, trimmedUpc)
          ),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'name':
        baseCondition = and(
          ilike(products.name, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'partNumber':
        baseCondition = and(
          ilike(products.manufacturerPartNumber, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'manufacturerPartNumber':
        baseCondition = and(
          ilike(products.manufacturerPartNumber, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'altId1':
        baseCondition = and(
          ilike(products.altId1, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'altId2':
        baseCondition = and(
          ilike(products.altId2, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      case 'multi_id':
        // Search across all ID fields with partial matching
        baseCondition = and(
          or(
            ilike(products.upc, `%${query}%`),
            ilike(products.manufacturerPartNumber, `%${query}%`),
            ilike(products.model, `%${query}%`),
            ilike(products.name, `%${query}%`)
          ),
          or(eq(products.status, 'active'), isNull(products.status))
        );
        break;
      default:
        baseCondition = and(
          ilike(products.name, `%${query}%`),
          or(eq(products.status, 'active'), isNull(products.status))
        );
    }
    
    // Add retail vertical scoping if specified
    const finalCondition = retailVerticalId 
      ? and(baseCondition, eq(products.retailVerticalId, retailVerticalId))
      : baseCondition;
    
    
    if (type === 'manufacturerPartNumber') {
      console.log(`*** STORAGE DEBUG: Final condition for manufacturerPartNumber search:`);
      console.log(`*** STORAGE DEBUG: retailVerticalId = ${retailVerticalId}`);
      console.log(`*** STORAGE DEBUG: About to run count query...`);
    }
    
    // Query 1: Get total count (fast)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(finalCondition);
    
    if (type === 'manufacturerPartNumber') {
      console.log(`*** STORAGE DEBUG: Count query result: ${countResult.count}`);
    }
    
    const totalCount = countResult.count;
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;
    
    // Query 2: Get paginated results (fast)
    const results = await db.select().from(products)
      .where(finalCondition)
      .limit(limit)
      .offset(offset);
    
    console.log(`STORAGE searchProductsWithCount result: ${results.length} of ${totalCount} products found (page ${page}/${totalPages}) for retailVerticalId=${retailVerticalId}`);
    return { products: results, totalCount, currentPage: page, totalPages };
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [result] = await db.insert(products).values(product).returning();
    return result;
  }

  async updateProduct(id: number, updates: Partial<Product>): Promise<Product | undefined> {
    const [result] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    return result || undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    try {
      const result = await db.delete(products).where(eq(products.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting product:', error);
      return false;
    }
  }

  async getAllProducts(): Promise<(Product & { retailVertical: string | null })[]> {
    const results = await db.select({
      id: products.id,
      upc: products.upc,
      name: products.name,
      brand: products.brand,
      model: products.model,
      manufacturerPartNumber: products.manufacturerPartNumber,
      category: products.category,
      subcategory1: products.subcategory1,
      subcategory2: products.subcategory2,
      subcategory3: products.subcategory3,
      caliber: products.caliber,
      barrelLength: products.barrelLength,
      description: products.description,
      imageUrl: products.imageUrl,
      imageSource: products.imageSource,
      serialized: products.serialized,
      allocated: products.allocated,
      source: products.source,
      status: products.status,
      retailVerticalId: products.retailVerticalId,
      retailVertical: retailVerticals.name,
      specifications: products.specifications,
      customProperties: products.customProperties,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(retailVerticals, eq(products.retailVerticalId, retailVerticals.id));
    
    return results as (Product & { retailVertical: string | null })[];
  }

  async getProductsByRetailVertical(retailVerticalId: number): Promise<Product[]> {
    console.log(`STORAGE getProductsByRetailVertical: fetching products for retailVerticalId=${retailVerticalId}`);
    const results = await db.select().from(products).where(eq(products.retailVerticalId, retailVerticalId));
    console.log(`STORAGE getProductsByRetailVertical result: ${results.length} products found for retailVerticalId=${retailVerticalId}`);
    return results;
  }

  async getProductsWithMissingModels(): Promise<Product[]> {
    console.log('STORAGE getProductsWithMissingModels: fetching products with null model field');
    const results = await db.select().from(products).where(
      and(
        isNull(products.model),
        or(eq(products.status, 'active'), isNull(products.status))
      )
    );
    console.log(`STORAGE getProductsWithMissingModels result: ${results.length} products found with missing models`);
    return results;
  }

  // Vendor methods
  async getVendor(id: number): Promise<Vendor | undefined> {
    const [result] = await db.select().from(vendors).where(eq(vendors.id, id));
    return result || undefined;
  }

  async getVendorBySlug(slug: string, companyId: number): Promise<Vendor | undefined> {
    const [result] = await db.select().from(vendors).where(
      and(eq(vendors.slug, slug), eq(vendors.companyId, companyId))
    );
    return result || undefined;
  }

  async getAllVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors);
  }

  async getVendorsByCompany(companyId: number, includeArchived?: boolean): Promise<Vendor[]> {
    if (!includeArchived) {
      return await db.select().from(vendors).where(and(eq(vendors.companyId, companyId), eq(vendors.isArchived, false)));
    }
    return await db.select().from(vendors).where(eq(vendors.companyId, companyId));
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [result] = await db.insert(vendors).values(vendor).returning();
    return result;
  }

  async updateVendor(id: number, updates: Partial<Vendor>): Promise<Vendor | undefined> {
    const [result] = await db
      .update(vendors)
      .set(updates)
      .where(eq(vendors.id, id))
      .returning();
    return result || undefined;
  }

  async updateVendorBySlug(slug: string, companyId: number, updates: Partial<Vendor>): Promise<Vendor | undefined> {
    // Prevent slug updates to maintain immutability
    const safeUpdates = { ...updates };
    delete safeUpdates.slug;
    
    const [result] = await db
      .update(vendors)
      .set(safeUpdates)
      .where(and(eq(vendors.slug, slug), eq(vendors.companyId, companyId)))
      .returning();
    return result || undefined;
  }

  async updateVendorEnabledStatusBySlug(companyId: number, vendorSlug: string, enabled: boolean): Promise<void> {
    await db.update(vendors)
      .set({ 
        enabledForPriceComparison: enabled,
        updatedAt: new Date()
      })
      .where(and(
        eq(vendors.slug, vendorSlug),
        eq(vendors.companyId, companyId)
      ));
  }

  async updateVendorCredentials(id: number, companyId: number, credentials: any): Promise<Vendor | undefined> {
    const [result] = await db
      .update(vendors)
      .set({ credentials })
      .where(and(eq(vendors.id, id), eq(vendors.companyId, companyId)))
      .returning();
    return result || undefined;
  }

  async updateVendorLogo(vendorId: number, logoUrl: string, companyId: number): Promise<Vendor | undefined> {
    const [result] = await db
      .update(vendors)
      .set({ logoUrl: logoUrl })
      .where(and(eq(vendors.id, vendorId), eq(vendors.companyId, companyId)))
      .returning();
    
    return result || undefined;
  }

  // Vendor product methods
  async getVendorProduct(id: number): Promise<VendorProduct | undefined> {
    const [result] = await db.select().from(vendorProducts).where(eq(vendorProducts.id, id));
    return result || undefined;
  }

  async getVendorProductByDetails(vendorId: number, productId: number): Promise<VendorProduct | undefined> {
    const [result] = await db.select()
      .from(vendorProducts)
      .where(
        and(
          eq(vendorProducts.vendorId, vendorId),
          eq(vendorProducts.productId, productId)
        )
      );
    return result || undefined;
  }

  async getVendorProductBySku(vendorId: number, sku: string): Promise<VendorProduct | undefined> {
    const [result] = await db.select().from(vendorProducts)
      .where(and(eq(vendorProducts.vendorId, vendorId), eq(vendorProducts.vendorSku, sku)));
    return result || undefined;
  }

  async getAllVendorProducts(): Promise<VendorProduct[]> {
    return await db.select().from(vendorProducts);
  }

  async getVendorProductsByProductId(productId: number): Promise<VendorProduct[]> {
    return await db.select().from(vendorProducts).where(eq(vendorProducts.productId, productId));
  }

  async getVendorProductsByProductIds(productIds: number[]): Promise<VendorProduct[]> {
    if (productIds.length === 0) return [];
    return await db.select().from(vendorProducts).where(inArray(vendorProducts.productId, productIds));
  }

  async getVendorProductsByProduct(productId: number): Promise<VendorProduct[]> {
    return this.getVendorProductsByProductId(productId);
  }

  async createVendorProduct(vendorProduct: InsertVendorProduct): Promise<VendorProduct> {
    const [result] = await db.insert(vendorProducts).values(vendorProduct).returning();
    return result;
  }

  async updateVendorProduct(id: number, updates: Partial<VendorProduct>): Promise<VendorProduct | undefined> {
    const [result] = await db
      .update(vendorProducts)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(vendorProducts.id, id))
      .returning();
    return result || undefined;
  }


  // Order methods - simplified implementation
  async getOrder(id: number): Promise<Order | undefined> {
    const [result] = await db.select().from(orders).where(eq(orders.id, id));
    return result || undefined;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [result] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return result || undefined;
  }

  async getOrderByExternalNumber(externalOrderNumber: string): Promise<Order | undefined> {
    const [result] = await db.select().from(orders).where(eq(orders.externalOrderNumber, externalOrderNumber));
    return result || undefined;
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.status, status));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [result] = await db.insert(orders).values(order).returning();
    return result;
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined> {
    const [result] = await db
      .update(orders)
      .set(updates)
      .where(eq(orders.id, id))
      .returning();
    return result || undefined;
  }

  async deleteOrder(id: number): Promise<boolean> {
    try {
      // First delete all order items
      await db.delete(orderItems).where(eq(orderItems.orderId, id));
      
      // Then delete the order
      const result = await db.delete(orders).where(eq(orders.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting order:', error);
      return false;
    }
  }

  // Order item methods
  async getOrderItem(id: number): Promise<OrderItem | undefined> {
    const [result] = await db.select().from(orderItems).where(eq(orderItems.id, id));
    return result || undefined;
  }

  async getOrderItemsByOrderId(orderId: number): Promise<any[]> {
    return await db.select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      vendorProductId: orderItems.vendorProductId,
      quantity: orderItems.quantity,
      unitCost: orderItems.unitCost,
      totalCost: orderItems.totalCost,
      retailPrice: orderItems.retailPrice, // Get calculated retail price stored during order creation
      customerReference: orderItems.customerReference,
      createdAt: orderItems.createdAt,
      vendorSku: orderItems.vendorSku, // Get vendor SKU from order_items table where it's stored
      vendor_msrp: orderItems.vendorMsrp, // Get vendor MSRP from order_items table where it's stored
      vendor_map_price: orderItems.vendorMapPrice, // Get vendor MAP from order_items table where it's stored
      productName: products.name,
      productUpc: products.upc,
      productMfgPartNumber: products.manufacturerPartNumber,
      productBrand: products.brand,
      productModel: products.model,
      productCategory: products.category,
      productSubcategory1: products.subcategory1,
      productSubcategory2: products.subcategory2,
      productSubcategory3: products.subcategory3,
      productDescription: products.description,
      productImageUrl: products.imageUrl,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [result] = await db.insert(orderItems).values(orderItem).returning();
    return result;
  }

  async updateOrderItem(id: number, updates: Partial<OrderItem>): Promise<OrderItem | undefined> {
    const [result] = await db
      .update(orderItems)
      .set(updates)
      .where(eq(orderItems.id, id))
      .returning();
    return result || undefined;
  }

  async deleteOrderItem(id: number): Promise<boolean> {
    const result = await db.delete(orderItems).where(eq(orderItems.id, id));
    return (result.rowCount || 0) > 0;
  }

  async consolidateOrderItems(orderId: number): Promise<{ consolidated: number; remaining: number }> {
    try {
      const orderItemsList = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      
      // Group items by productId and vendorProductId (same product from same vendor)
      const itemGroups = new Map<string, OrderItem[]>();
      
      for (const item of orderItemsList) {
        const groupKey = `${item.productId}-${item.vendorProductId || 'null'}`;
        if (!itemGroups.has(groupKey)) {
          itemGroups.set(groupKey, []);
        }
        itemGroups.get(groupKey)!.push(item);
      }
      
      let consolidatedCount = 0;
      let remainingCount = 0;
      
      // Process each group
      for (const [groupKey, items] of Array.from(itemGroups.entries())) {
        if (items.length > 1) {
          // Multiple items for same product - consolidate them
          const keepItem = items[0]; // Keep the first item
          const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
          const avgUnitCost = items.reduce((sum: number, item: any) => sum + parseFloat(item.unitCost), 0) / items.length;
          const newTotalCost = (totalQuantity * avgUnitCost).toFixed(2);
          
          // Combine customer references (notes) from all items
          const allNotes = items
            .map((item: any) => item.customerReference)
            .filter((note: string | null) => note && note.trim())
            .join(' | ');
          
          // Update the kept item with consolidated quantities, costs, and combined notes
          await db
            .update(orderItems)
            .set({
              quantity: totalQuantity,
              unitCost: avgUnitCost.toFixed(2),
              totalCost: newTotalCost,
              customerReference: allNotes || keepItem.customerReference
            })
            .where(eq(orderItems.id, keepItem.id));
          
          // Delete the duplicate items
          const itemsToDelete = items.slice(1);
          for (const item of itemsToDelete) {
            await db.delete(orderItems).where(eq(orderItems.id, item.id));
          }
          
          consolidatedCount += itemsToDelete.length;
          remainingCount += 1;
        } else {
          remainingCount += 1;
        }
      }
      
      return { consolidated: consolidatedCount, remaining: remainingCount };
    } catch (error) {
      console.error('Error consolidating order items:', error);
      throw error;
    }
  }

  // ASN methods - simplified implementation
  async getASN(id: number): Promise<ASN | undefined> {
    const [result] = await db.select().from(asns).where(eq(asns.id, id));
    return result || undefined;
  }

  async getASNByNumber(asnNumber: string): Promise<ASN | undefined> {
    const [result] = await db.select().from(asns).where(eq(asns.asnNumber, asnNumber));
    return result || undefined;
  }

  async getAllASNs(): Promise<ASN[]> {
    return await db.select().from(asns);
  }

  async getASNsByCompany(companyId: number): Promise<ASN[]> {
    try {
      // Get all ASNs that belong to orders from this organization
      const result = await db
        .select({
          id: asns.id,
          asnNumber: asns.asnNumber,
          orderId: asns.orderId,
          vendorId: asns.vendorId,
          status: asns.status,
          shipDate: asns.shipDate,
          trackingNumber: asns.trackingNumber,
          itemsShipped: asns.itemsShipped,
          itemsTotal: asns.itemsTotal,
          shippingCost: asns.shippingCost,
          notes: asns.notes,
          rawData: asns.rawData,
          createdAt: asns.createdAt
        })
        .from(asns)
        .leftJoin(orders, eq(asns.orderId, orders.id))
        .where(eq(orders.companyId, companyId));
      
      return result;
    } catch (error: any) {
      console.error('Get ASNs error:', error);
      // If there's a column error, return empty array for now
      if (error.message?.includes('does not exist')) {
        console.log('Database column compatibility issue - returning empty ASNs array');
        return [];
      }
      throw error;
    }
  }

  async getASNsByStatus(status: string): Promise<ASN[]> {
    return await db.select().from(asns).where(eq(asns.status, status));
  }

  async createASN(asn: InsertASN): Promise<ASN> {
    try {
      // Only use columns that exist in the actual database schema
      const validASN = {
        asnNumber: asn.asnNumber,
        orderId: asn.orderId,
        vendorId: asn.vendorId,
        status: asn.status,
        shipDate: asn.shipDate,
        trackingNumber: asn.trackingNumber,
        itemsShipped: asn.itemsShipped,
        itemsTotal: asn.itemsTotal,
        shippingCost: asn.shippingCost,
        notes: asn.notes,
        rawData: asn.rawData
      };
      
      const [result] = await db.insert(asns).values(validASN).returning();
      return result;
    } catch (error: any) {
      console.error('Create ASN error:', error);
      throw error;
    }
  }

  async updateASN(id: number, updates: Partial<ASN>): Promise<ASN | undefined> {
    const [result] = await db
      .update(asns)
      .set(updates)
      .where(eq(asns.id, id))
      .returning();
    return result || undefined;
  }

  // ASN item methods
  async getASNItem(id: number): Promise<ASNItem | undefined> {
    const [result] = await db.select().from(asnItems).where(eq(asnItems.id, id));
    return result || undefined;
  }

  async getASNItemsByASNId(asnId: number): Promise<any[]> {
    try {
      // First get the basic ASN items
      const basicItems = await db
        .select()
        .from(asnItems)
        .where(eq(asnItems.asnId, asnId));
      
      if (basicItems.length === 0) {
        return [];
      }
      
      // Then enrich with order and product details
      const enrichedItems = [];
      for (const item of basicItems) {
        try {
          // Get order item details
          const [orderItem] = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.id, item.orderItemId));
          
          if (orderItem) {
            // Get product details
            const [product] = await db
              .select()
              .from(products)
              .where(eq(products.id, orderItem.productId));
            
            // Get vendor product details if available
            let vendorProduct = null;
            if (orderItem.vendorProductId) {
              const [vp] = await db
                .select()
                .from(vendorProducts)
                .where(eq(vendorProducts.id, orderItem.vendorProductId));
              vendorProduct = vp;
            }
            
            enrichedItems.push({
              id: item.id,
              asnId: item.asnId,
              orderItemId: item.orderItemId,
              quantityShipped: item.quantityShipped,
              quantityBackordered: item.quantityBackordered,
              createdAt: item.createdAt,
              // Order item details
              quantity: orderItem.quantity,
              unitCost: orderItem.unitCost,
              totalCost: orderItem.totalCost,
              // Product details
              productName: product?.name || null,
              upc: product?.upc || null,
              manufacturerPartNumber: product?.manufacturerPartNumber || null,
              brand: product?.brand || '',
              model: product?.model || '',
              // Vendor product details
              vendorSku: vendorProduct?.vendorSku || null
            });
          }
        } catch (itemError: any) {
          console.error('Error enriching ASN item:', itemError);
          // Add basic item if enrichment fails
          enrichedItems.push({
            ...item,
            productName: null,
            upc: null,
            vendorSku: null,
            quantity: 0,
            unitCost: '0.00',
            totalCost: '0.00'
          });
        }
      }
      
      return enrichedItems;
    } catch (error: any) {
      console.error('Get ASN items error:', error);
      return [];
    }
  }

  async createASNItem(asnItem: InsertASNItem): Promise<ASNItem> {
    const [result] = await db.insert(asnItems).values(asnItem).returning();
    return result;
  }

  // Enhanced ASN methods for detailed ship notices
  async getDetailedASNs(companyId?: number, status?: string): Promise<any[]> {
    const query = db
      .select({
        id: asns.id,
        asnNumber: asns.asnNumber,
        orderId: asns.orderId,
        vendorId: asns.vendorId,
        status: asns.status,
        shipDate: asns.shipDate,
        trackingNumber: asns.trackingNumber,
        itemsShipped: asns.itemsShipped,
        itemsTotal: asns.itemsTotal,
        shippingCost: asns.shippingCost,
        notes: asns.notes,
        rawData: asns.rawData,
        createdAt: asns.createdAt,
        vendorName: vendors.name,
        orderNumber: orders.orderNumber,
      })
      .from(asns)
      .leftJoin(vendors, eq(asns.vendorId, vendors.id))
      .leftJoin(orders, eq(asns.orderId, orders.id));

    if (companyId) {
      query.where(eq(orders.companyId, companyId));
    }

    if (status && status !== 'all') {
      query.where(eq(asns.status, status));
    }

    const results = await query.orderBy(desc(asns.createdAt));
    
    return results.map(result => ({
      ...result,
      vendor: result.vendorName,
      shipDate: result.shipDate?.toISOString() || '',
      createdAt: result.createdAt.toISOString()
    }));
  }

  async getDetailedASNItems(asnId: number): Promise<any[]> {
    return await db
      .select({
        id: asnItems.id,
        asnId: asnItems.asnId,
        orderItemId: asnItems.orderItemId,
        quantityShipped: asnItems.quantityShipped,
        quantityBackordered: asnItems.quantityBackordered,
        createdAt: asnItems.createdAt,
      })
      .from(asnItems)
      .where(eq(asnItems.asnId, asnId))
      .orderBy(asnItems.id);
  }

  async createDetailedASN(asnData: any): Promise<any> {
    const [asn] = await db.insert(asns).values({
      asnNumber: asnData.asnNumber,
      orderId: asnData.orderId,
      vendorId: asnData.vendorId,
      status: asnData.status || 'open',
      shipDate: asnData.shipDate ? new Date(asnData.shipDate) : new Date(),
      trackingNumber: asnData.trackingNumber,
      itemsShipped: asnData.itemsShipped || 0,
      itemsTotal: asnData.itemsTotal || 0,
      shippingCost: asnData.shippingCost?.toString() || '0',
      notes: asnData.notes,
      rawData: asnData.rawData,
    }).returning();

    return asn;
  }

  async createDetailedASNItem(itemData: any): Promise<any> {
    const [item] = await db.insert(asnItems).values({
      asnId: itemData.asnId,
      orderItemId: itemData.orderItemId,
      quantityShipped: itemData.quantityShipped,
      quantityBackordered: itemData.quantityBackordered || 0,
    }).returning();

    return item;
  }

  // Supported Vendor methods
  async getAllSupportedVendors(): Promise<(SupportedVendor & { retailVerticals: { id: number; name: string; slug: string }[] })[]> {
    // Get all supported vendors first
    const vendors = await db.select().from(supportedVendors).orderBy(asc(supportedVendors.sortOrder));
    
    // Get all retail verticals for all vendors in one query
    const vendorRetailVerticals = await db
      .select({
        supportedVendorId: supportedVendorRetailVerticals.supportedVendorId,
        retailVerticalId: supportedVendorRetailVerticals.retailVerticalId,
        id: retailVerticals.id,
        name: retailVerticals.name,
        slug: retailVerticals.slug,
      })
      .from(supportedVendorRetailVerticals)
      .innerJoin(retailVerticals, eq(supportedVendorRetailVerticals.retailVerticalId, retailVerticals.id));
    
    // Group retail verticals by vendor ID
    const verticalsByVendor = vendorRetailVerticals.reduce((acc, item) => {
      if (!acc[item.supportedVendorId]) {
        acc[item.supportedVendorId] = [];
      }
      acc[item.supportedVendorId].push({
        id: item.id,
        name: item.name,
        slug: item.slug,
      });
      return acc;
    }, {} as Record<number, { id: number; name: string; slug: string }[]>);
    
    // Combine vendors with their retail verticals
    return vendors.map(vendor => ({
      ...vendor,
      retailVerticals: verticalsByVendor[vendor.id] || [],
    }));
  }

  async getSupportedVendor(id: number): Promise<SupportedVendor | undefined> {
    const [result] = await db.select().from(supportedVendors).where(eq(supportedVendors.id, id));
    return result || undefined;
  }

  async getSupportedVendorById(id: number): Promise<SupportedVendor | undefined> {
    const [result] = await db.select().from(supportedVendors).where(eq(supportedVendors.id, id));
    return result || undefined;
  }


  async createSupportedVendor(vendor: any): Promise<SupportedVendor> {
    // ✅ ENFORCE: vendorShortCode MUST be lowercase to match handler IDs
    if (vendor.vendorShortCode) {
      const normalized = vendor.vendorShortCode.toLowerCase();
      if (vendor.vendorShortCode !== normalized) {
        console.warn(`⚠️  Auto-normalizing vendorShortCode: "${vendor.vendorShortCode}" → "${normalized}"`);
        vendor.vendorShortCode = normalized;
      }
    }
    
    const [result] = await db.insert(supportedVendors).values(vendor).returning();
    return result;
  }

  async updateSupportedVendor(id: number, updates: any): Promise<SupportedVendor | undefined> {
    // ✅ ENFORCE: vendorShortCode MUST be lowercase to match handler IDs
    if (updates.vendorShortCode) {
      const normalized = updates.vendorShortCode.toLowerCase();
      if (updates.vendorShortCode !== normalized) {
        console.warn(`⚠️  Auto-normalizing vendorShortCode: "${updates.vendorShortCode}" → "${normalized}"`);
        updates.vendorShortCode = normalized;
      }
    }
    
    // Handle retail vertical assignments if provided
    if ('retailVerticalIds' in updates && Array.isArray(updates.retailVerticalIds)) {
      const retailVerticalIds = updates.retailVerticalIds as number[];
      
      // Remove existing retail vertical assignments for this vendor
      await db.delete(supportedVendorRetailVerticals)
        .where(eq(supportedVendorRetailVerticals.supportedVendorId, id));
      
      // Add new retail vertical assignments
      if (retailVerticalIds.length > 0) {
        const assignments = retailVerticalIds.map(retailVerticalId => ({
          supportedVendorId: id,
          retailVerticalId,
        }));
        
        await db.insert(supportedVendorRetailVerticals).values(assignments);
      }
      
      // Remove retailVerticalIds from updates as it's not a direct field on supportedVendors
      const { retailVerticalIds: _, ...vendorUpdates } = updates;
      updates = vendorUpdates;
    }
    
    // Update the vendor record itself
    const [result] = await db
      .update(supportedVendors)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(supportedVendors.id, id))
      .returning();
    return result || undefined;
  }

  async deleteSupportedVendor(id: number): Promise<boolean> {
    const result = await db.delete(supportedVendors).where(eq(supportedVendors.id, id));
    return (result.rowCount || 0) > 0;
  }



  // Settings methods
  async getSettings(companyId?: number): Promise<Settings | undefined> {
    try {
      if (!companyId) {
        // Return global settings if no companyId provided
        const [result] = await db.select().from(settings).limit(1);
        return result || undefined;
      }
      
      // Return company-specific settings
      const [result] = await db.select().from(settings).where(eq(settings.companyId, companyId));
      return result || undefined;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return undefined;
    }
  }

  async updateSettings(companyId: number, updates: Partial<Settings>): Promise<Settings | undefined> {
    // For now, update the first settings record since we don't have company_id in settings table
    const [result] = await db
      .update(settings)
      .set(updates)
      .returning();
    return result || undefined;
  }

  async getAdminSettings(): Promise<AdminSettings | undefined> {
    const [result] = await db.select().from(adminSettings).limit(1);
    return result || undefined;
  }

  async updateAdminSettings(updates: Partial<AdminSettings>): Promise<AdminSettings | undefined> {
    try {
      // Try to update the first record (assuming there's only one admin settings record)
      const [result] = await db
        .update(adminSettings)
        .set({ ...updates, updatedAt: new Date() })
        .returning();
      
      if (result) {
        return result;
      }
      
      // If no record was updated, create a new one
      const [created] = await db
        .insert(adminSettings)
        .values({ ...updates, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return created;
    } catch (error) {
      console.error('Error updating admin settings:', error);
      return undefined;
    }
  }

  // Missing interface methods
  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    const [result] = await db.select().from(companies).where(eq(companies.slug, slug));
    return result || undefined;
  }

  async getOrganizationByDomain(domain: string): Promise<Company | undefined> {
    const [result] = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        plan: companies.plan,
        status: companies.status,
        email: companies.email,
        phone: companies.phone,
        logoUrl: companies.logoUrl,
        billingProvider: companies.billingProvider,
        billingCustomerId: companies.billingCustomerId,
        billingSubscriptionId: companies.billingSubscriptionId,
        billingSubscriptionNumber: companies.billingSubscriptionNumber,
        trialStatus: companies.trialStatus,
        trialStartedAt: companies.trialStartedAt,
        trialEndsAt: companies.trialEndsAt,
        trialExtensions: companies.trialExtensions,
        maxUsers: companies.maxUsers,
        maxVendors: companies.maxVendors,
        maxOrders: companies.maxOrders,
        features: companies.features,
        settings: companies.settings,
        retailVerticalId: companies.retailVerticalId,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
      })
      .from(companies)
      .leftJoin(orgDomains, eq(orgDomains.companyId, companies.id))
      .where(and(eq(orgDomains.domain, domain), eq(orgDomains.isActive, true)));
    return result || undefined;
  }

  async getOrganizationBySubdomain(subdomain: string): Promise<Company | undefined> {
    const [result] = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        plan: companies.plan,
        status: companies.status,
        email: companies.email,
        phone: companies.phone,
        logoUrl: companies.logoUrl,
        billingProvider: companies.billingProvider,
        billingCustomerId: companies.billingCustomerId,
        billingSubscriptionId: companies.billingSubscriptionId,
        billingSubscriptionNumber: companies.billingSubscriptionNumber,
        trialStatus: companies.trialStatus,
        trialStartedAt: companies.trialStartedAt,
        trialEndsAt: companies.trialEndsAt,
        trialExtensions: companies.trialExtensions,
        maxUsers: companies.maxUsers,
        maxVendors: companies.maxVendors,
        maxOrders: companies.maxOrders,
        features: companies.features,
        settings: companies.settings,
        retailVerticalId: companies.retailVerticalId,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
      })
      .from(companies)
      .leftJoin(orgDomains, eq(orgDomains.companyId, companies.id))
      .where(and(eq(orgDomains.subdomain, subdomain), eq(orgDomains.isActive, true)));
    return result || undefined;
  }

  async createVendorsFromSupported(companyId: number, retailVerticalId?: number): Promise<void> {
    // Check subscription limits before creating vendors
    const { canAddMoreVendors } = await import('./subscription-gates');
    const currentVendors = await this.getVendorsByCompany(companyId);
    
    const supportedVendorsList = await this.getAllSupportedVendors();
    let enabledVendors = supportedVendorsList.filter(v => v.isEnabled);
    
    // Filter by retail vertical if specified
    if (retailVerticalId) {
      console.log(`VENDOR CREATION: Filtering vendors by retail vertical ID: ${retailVerticalId}`);
      enabledVendors = enabledVendors.filter(v => 
        v.retailVerticals && v.retailVerticals.some(rv => rv.id === retailVerticalId)
      );
      console.log(`VENDOR CREATION: ${enabledVendors.length} vendors match retail vertical (before subscription limits)`);
    }
    
    // Check if adding these vendors would exceed the limit
    let vendorsToAdd = 0;
    for (const supported of enabledVendors) {
      const vendorAccess = await canAddMoreVendors(companyId);
      if (!vendorAccess.allowed) {
        console.log(`SUBSCRIPTION LIMIT: Cannot add vendor ${supported.name} - ${vendorAccess.message}`);
        break; // Stop adding vendors once limit is reached
      }
      
      // Generate slug from vendorShortCode (or fallback to name)
      const { generateVendorSlug, generateVendorSlugFromName } = await import('./slug-utils');
      const slug = supported.vendorShortCode 
        ? generateVendorSlug(supported.vendorShortCode)
        : generateVendorSlugFromName(supported.name);
      
      await this.createVendor({
        name: supported.name,
        slug, // ✅ Required field for vendor identification
        vendorShortCode: supported.vendorShortCode || null,
        companyId,
        supportedVendorId: supported.id,
        integrationType: 'api', // Default integration type
        status: 'offline',
        isArchived: false,
        apiEndpoint: null, // Will be configured per vendor
        credentials: {},
        lastSyncDate: null,
        syncStatus: null,
        syncError: null
      });
      
      vendorsToAdd++;
    }
    
    if (vendorsToAdd < enabledVendors.length) {
      console.log(`SUBSCRIPTION LIMIT: Added ${vendorsToAdd} of ${enabledVendors.length} vendors due to subscription limits`);
    }
  }

  async createSettings(settingsData: InsertSettings): Promise<Settings> {
    const [result] = await db.insert(settings).values(settingsData).returning();
    return result;
  }

  async createAdminSettings(adminSettingsData: InsertAdminSettings): Promise<AdminSettings> {
    const [result] = await db.insert(adminSettings).values(adminSettingsData).returning();
    return result;
  }

  // Company-specific methods
  async getUsersByCompany(companyId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.companyId, companyId));
  }

  async getOrdersByCompany(companyId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.companyId, companyId)).orderBy(desc(orders.createdAt));
  }

  async getOrdersWithVendorInfo(companyId: number, status?: string): Promise<any[]> {
    try {
      const whereConditions = [eq(orders.companyId, companyId)];
      if (status) {
        whereConditions.push(eq(orders.status, status));
      }

      const query = db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          vendorId: orders.vendorId,
          vendorName: vendors.name,
          vendorShortCode: vendors.vendorShortCode,
          storeId: orders.storeId,
          storeName: stores.name,
          status: orders.status,
          total: orders.totalAmount,
          createdAt: orders.createdAt,
          orderDate: orders.orderDate,
          itemCount: orders.itemCount
        })
        .from(orders)
        .leftJoin(vendors, eq(orders.vendorId, vendors.id))
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(and(...whereConditions))
        .orderBy(desc(orders.createdAt));

      return await query;
    } catch (error: any) {
      console.error('Error getting orders with vendor info:', error);
      return [];
    }
  }



  // Search History methods
  async createSearchHistory(searchHistoryData: InsertSearchHistory): Promise<SearchHistory> {
    const [result] = await db.insert(searchHistory).values(searchHistoryData).returning();
    return result;
  }

  async getRecentSearchHistory(companyId: number, userId: number, limit: number = 10): Promise<SearchHistory[]> {
    return await db.select()
      .from(searchHistory)
      .where(and(
        eq(searchHistory.companyId, companyId),
        eq(searchHistory.userId, userId)
      ))
      .orderBy(desc(searchHistory.searchedAt))
      .limit(limit);
  }

  // Company User methods (using unified users table)
  async getCompanyUsers(companyId: number): Promise<User[]> {
    const companyUsers = await db
      .select()
      .from(users)
      .where(eq(users.companyId, companyId))
      .orderBy(asc(users.lastName), asc(users.firstName));
    return companyUsers;
  }

  // Retail Verticals methods
  async getAllRetailVerticals(): Promise<RetailVertical[]> {
    return await db
      .select()
      .from(retailVerticals)
      .orderBy(asc(retailVerticals.sortOrder));
  }

  async getRetailVerticals(): Promise<RetailVertical[]> {
    return await this.getAllRetailVerticals();
  }

  async getRetailVertical(id: number): Promise<RetailVertical | undefined> {
    const [result] = await db
      .select()
      .from(retailVerticals)
      .where(eq(retailVerticals.id, id));
    return result || undefined;
  }

  async getRetailVerticalBySlug(slug: string): Promise<RetailVertical | undefined> {
    const [result] = await db
      .select()
      .from(retailVerticals)
      .where(eq(retailVerticals.slug, slug));
    return result || undefined;
  }

  async createRetailVertical(vertical: InsertRetailVertical): Promise<RetailVertical> {
    const [result] = await db
      .insert(retailVerticals)
      .values(vertical)
      .returning();
    return result;
  }

  async updateRetailVertical(id: number, updates: Partial<RetailVertical>): Promise<RetailVertical | undefined> {
    const [result] = await db
      .update(retailVerticals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(retailVerticals.id, id))
      .returning();
    return result || undefined;
  }

  async deleteRetailVertical(id: number): Promise<boolean> {
    try {
      await db
        .delete(retailVerticals)
        .where(eq(retailVerticals.id, id));
      return true;
    } catch (error) {
      console.error('Delete retail vertical error:', error);
      return false;
    }
  }

  // Store methods
  async getStore(id: number): Promise<Store | undefined> {
    const [result] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, id));
    return result || undefined;
  }

  async getStoreBySlug(companyId: number, slug: string): Promise<Store | undefined> {
    const [result] = await db
      .select()
      .from(stores)
      .where(and(eq(stores.companyId, companyId), eq(stores.slug, slug)));
    return result || undefined;
  }

  async getStoresByCompany(companyId: number): Promise<Store[]> {
    return await db
      .select()
      .from(stores)
      .where(eq(stores.companyId, companyId))
      .orderBy(asc(stores.name));
  }

  async createStore(store: InsertStore): Promise<Store> {
    // Auto-generate store number if not provided
    if (!store.storeNumber && store.companyId) {
      const existingStores = await db
        .select({ storeNumber: stores.storeNumber })
        .from(stores)
        .where(eq(stores.companyId, store.companyId));
      
      // Extract numeric values from existing store numbers, default to 0 if none found
      const existingNumbers = existingStores
        .map(s => s.storeNumber ? parseInt(s.storeNumber.replace(/\D/g, '')) : 0)
        .filter(n => !isNaN(n));
      
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      store.storeNumber = nextNumber.toString().padStart(2, '0');
    }

    // Auto-generate short name if not provided
    if (!store.shortName && store.name) {
      store.shortName = store.name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 8);
    }

    const [result] = await db
      .insert(stores)
      .values(store)
      .returning();
    return result;
  }

  async updateStore(id: number, updates: Partial<Store>): Promise<Store | undefined> {
    const [result] = await db
      .update(stores)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stores.id, id))
      .returning();
    return result || undefined;
  }

  async deleteStore(id: number): Promise<boolean> {
    try {
      await db.delete(stores).where(eq(stores.id, id));
      return true;
    } catch (error) {
      console.error('Delete store error:', error);
      return false;
    }
  }

  // User-Store methods
  async getUserStores(userId: number): Promise<(UserStore & { store: Store })[]> {
    const results = await db
      .select()
      .from(userStores)
      .innerJoin(stores, eq(userStores.storeId, stores.id))
      .where(and(eq(userStores.userId, userId), eq(userStores.isActive, true)))
      .orderBy(asc(stores.name));
    
    return results.map(result => ({
      ...result.user_stores,
      store: result.stores
    }));
  }

  async getStoreUsers(storeId: number): Promise<(UserStore & { user: User })[]> {
    const results = await db
      .select()
      .from(userStores)
      .innerJoin(users, eq(userStores.userId, users.id))
      .where(and(eq(userStores.storeId, storeId), eq(userStores.isActive, true)))
      .orderBy(asc(users.lastName), asc(users.firstName));
    
    return results.map(result => ({
      ...result.user_stores,
      user: result.users
    }));
  }

  async assignUserToStore(assignment: InsertUserStore): Promise<UserStore> {
    try {
      const [result] = await db
        .insert(userStores)
        .values([assignment as any])
        .returning();
      return result;
    } catch (error) {
      console.error('Error assigning user to store:', error);
      throw error;
    }
  }

  async removeUserFromStore(userId: number, storeId: number): Promise<boolean> {
    try {
      await db
        .delete(userStores)
        .where(and(eq(userStores.userId, userId), eq(userStores.storeId, storeId)));
      return true;
    } catch (error) {
      console.error('Remove user from store error:', error);
      return false;
    }
  }

  async updateUserStoreRole(userId: number, storeId: number, role: string, permissions?: string[]): Promise<UserStore | undefined> {
    const updates: Partial<UserStore> = { 
      role,
      updatedAt: new Date()
    };
    if (permissions) {
      updates.permissions = permissions as any;
    }

    const [result] = await db
      .update(userStores)
      .set(updates)
      .where(and(eq(userStores.userId, userId), eq(userStores.storeId, storeId)))
      .returning();
    return result || undefined;
  }

  // Billing Events methods
  async getAllBillingEvents(): Promise<any[]> {
    try {
      return await db.select().from(billingEvents);
    } catch (error) {
      console.error('Get all billing events error:', error);
      return [];
    }
  }

  async createBillingEvent(event: any): Promise<any> {
    try {
      const [result] = await db.insert(billingEvents).values(event).returning();
      return result;
    } catch (error) {
      console.error('Create billing event error:', error);
      throw error;
    }
  }

  // PO Sequence methods for sequential PO numbering
  async getNextPoSequence(storeId: number): Promise<number> {
    // Try to increment existing sequence
    const result = await db
      .update(poSequences)
      .set({ 
        lastSequence: sql`${poSequences.lastSequence} + 1`,
        updatedAt: new Date()
      })
      .where(eq(poSequences.storeId, storeId))
      .returning({ lastSequence: poSequences.lastSequence });
    
    if (result.length > 0) {
      return result[0].lastSequence;
    }
    
    // Create new sequence if doesn't exist
    const [newSequence] = await db
      .insert(poSequences)
      .values({ storeId, lastSequence: 1 })
      .returning({ lastSequence: poSequences.lastSequence });
    
    return newSequence.lastSequence;
  }

  // Pricing Configuration methods
  async getPricingConfigurations(companyId: number): Promise<PricingConfiguration[]> {
    return await db
      .select()
      .from(pricingConfigurations)
      .where(eq(pricingConfigurations.companyId, companyId))
      .orderBy(desc(pricingConfigurations.isDefault), asc(pricingConfigurations.name));
  }

  async getPricingConfiguration(id: number): Promise<PricingConfiguration | undefined> {
    const [result] = await db
      .select()
      .from(pricingConfigurations)
      .where(eq(pricingConfigurations.id, id));
    return result || undefined;
  }

  async getDefaultPricingConfiguration(companyId: number): Promise<PricingConfiguration | undefined> {
    const [result] = await db
      .select()
      .from(pricingConfigurations)
      .where(and(
        eq(pricingConfigurations.companyId, companyId),
        eq(pricingConfigurations.isDefault, true),
        eq(pricingConfigurations.isActive, true)
      ));
    return result || undefined;
  }

  async createPricingConfiguration(config: InsertPricingConfiguration): Promise<PricingConfiguration> {
    const [result] = await db
      .insert(pricingConfigurations)
      .values(config)
      .returning();
    return result;
  }

  async updatePricingConfiguration(id: number, updates: Partial<PricingConfiguration>): Promise<PricingConfiguration | undefined> {
    const [result] = await db
      .update(pricingConfigurations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pricingConfigurations.id, id))
      .returning();
    return result || undefined;
  }

  async deletePricingConfiguration(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(pricingConfigurations)
        .where(eq(pricingConfigurations.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Delete pricing configuration error:', error);
      return false;
    }
  }

  async setDefaultPricingConfiguration(companyId: number, configId: number): Promise<boolean> {
    try {
      // First, remove default flag from all configurations in this company
      await db
        .update(pricingConfigurations)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(pricingConfigurations.companyId, companyId));
      
      // Then set the specified configuration as default
      await db
        .update(pricingConfigurations)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(pricingConfigurations.id, configId));
      
      return true;
    } catch (error) {
      console.error('Set default pricing configuration error:', error);
      return false;
    }
  }

  // Vendor Product Mapping methods (for Sports South UPC→ITEMNO mapping)
  async getVendorProductMapping(productId: number, supportedVendorId: number): Promise<VendorProductMapping | undefined> {
    const [result] = await db
      .select()
      .from(vendorProductMappings)
      .where(and(
        eq(vendorProductMappings.productId, productId),
        eq(vendorProductMappings.supportedVendorId, supportedVendorId)
      ));
    return result || undefined;
  }

  async getVendorProductMappingByVendorSku(supportedVendorId: number, vendorSku: string): Promise<VendorProductMapping | undefined> {
    const [result] = await db
      .select()
      .from(vendorProductMappings)
      .where(and(
        eq(vendorProductMappings.supportedVendorId, supportedVendorId),
        eq(vendorProductMappings.vendorSku, vendorSku)
      ));
    return result || undefined;
  }

  async getVendorProductMappingsByProduct(productId: number): Promise<VendorProductMapping[]> {
    return await db
      .select()
      .from(vendorProductMappings)
      .where(eq(vendorProductMappings.productId, productId));
  }

  async getVendorProductMappingsByVendor(supportedVendorId: number): Promise<VendorProductMapping[]> {
    return await db
      .select()
      .from(vendorProductMappings)
      .where(eq(vendorProductMappings.supportedVendorId, supportedVendorId));
  }

  async createVendorProductMapping(mapping: InsertVendorProductMapping): Promise<VendorProductMapping> {
    const [result] = await db
      .insert(vendorProductMappings)
      .values(mapping)
      .returning();
    return result;
  }

  async updateVendorProductMapping(id: number, updates: Partial<VendorProductMapping>): Promise<VendorProductMapping | undefined> {
    const [result] = await db
      .update(vendorProductMappings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vendorProductMappings.id, id))
      .returning();
    return result || undefined;
  }

  async deleteVendorProductMapping(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(vendorProductMappings)
        .where(eq(vendorProductMappings.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Delete vendor product mapping error:', error);
      return false;
    }
  }

  async getVendorProductMappingByCompanyAndVendor(companyId: number, productId: number, supportedVendorId: number): Promise<VendorProductMapping | undefined> {
    const [result] = await db.select()
      .from(vendorProductMappings)
      .where(
        and(
          eq(vendorProductMappings.companyId, companyId),
          eq(vendorProductMappings.productId, productId),
          eq(vendorProductMappings.supportedVendorId, supportedVendorId)
        )
      );
    return result || undefined;
  }

  // Vendor Field Mapping methods (for CSV import column mappings)
  async getVendorFieldMapping(vendorSource: string, mappingName: string = 'Default'): Promise<VendorFieldMapping | undefined> {
    const [result] = await db
      .select()
      .from(vendorFieldMappings)
      .where(and(
        eq(vendorFieldMappings.vendorSource, vendorSource),
        eq(vendorFieldMappings.mappingName, mappingName)
      ));
    return result || undefined;
  }

  async getVendorFieldMappingsByVendor(vendorSource: string): Promise<VendorFieldMapping[]> {
    return await db
      .select()
      .from(vendorFieldMappings)
      .where(eq(vendorFieldMappings.vendorSource, vendorSource))
      .orderBy(vendorFieldMappings.mappingName);
  }

  async getAllVendorFieldMappings(): Promise<VendorFieldMapping[]> {
    return await db
      .select()
      .from(vendorFieldMappings)
      .orderBy(vendorFieldMappings.vendorSource, vendorFieldMappings.mappingName);
  }

  async createVendorFieldMapping(mapping: InsertVendorFieldMapping): Promise<VendorFieldMapping> {
    const [result] = await db
      .insert(vendorFieldMappings)
      .values(mapping)
      .returning();
    return result;
  }

  async updateVendorFieldMapping(id: number, updates: Partial<VendorFieldMapping>): Promise<VendorFieldMapping | undefined> {
    const [result] = await db
      .update(vendorFieldMappings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vendorFieldMappings.id, id))
      .returning();
    return result || undefined;
  }

  async deleteVendorFieldMapping(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(vendorFieldMappings)
        .where(eq(vendorFieldMappings.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Delete vendor field mapping error:', error);
      return false;
    }
  }

  async upsertVendorFieldMapping(vendorSource: string, mappingName: string, columnMappings: Record<string, string>): Promise<VendorFieldMapping> {
    // Try to find existing mapping
    const existing = await this.getVendorFieldMapping(vendorSource, mappingName);
    
    if (existing) {
      // Update existing mapping
      return await this.updateVendorFieldMapping(existing.id, {
        columnMappings,
        lastUsed: new Date()
      }) as VendorFieldMapping;
    } else {
      // Create new mapping
      return await this.createVendorFieldMapping({
        vendorSource,
        mappingName,
        columnMappings,
        lastUsed: new Date()
      });
    }
  }

  // Bill Hicks Vendor Credentials methods implementation
  async getCompanyVendorCredentials(companyId: number, supportedVendorId: number): Promise<any | undefined> {
    const { companyVendorCredentials } = await import('@shared/schema');
    const [result] = await db
      .select()
      .from(companyVendorCredentials)
      .where(
        and(
          eq(companyVendorCredentials.companyId, companyId),
          eq(companyVendorCredentials.supportedVendorId, supportedVendorId)
        )
      );
    return result || undefined;
  }

  async upsertCompanyVendorCredentials(credentials: any): Promise<any> {
    const { companyVendorCredentials } = await import('@shared/schema');
    
    // Validate required fields
    if (!credentials.company_id) {
      throw new Error('company_id is required for vendor credentials');
    }
    if (!credentials.supported_vendor_id) {
      throw new Error('supported_vendor_id is required for vendor credentials');
    }
    
    // Map the credentials to the correct field names
    const mappedCredentials = {
      companyId: credentials.company_id,
      supportedVendorId: credentials.supported_vendor_id,
      ftpServer: credentials.ftp_server,
      ftpPort: credentials.ftp_port || 21,
      ftpUsername: credentials.ftp_username,
      ftpPassword: credentials.ftp_password,
      ftpBasePath: credentials.ftp_base_path || '/',
      catalogSyncEnabled: credentials.catalog_sync_enabled,
      inventorySyncEnabled: credentials.inventory_sync_enabled
    };
    
    const [result] = await db
      .insert(companyVendorCredentials)
      .values(mappedCredentials)
      .onConflictDoUpdate({
        target: [companyVendorCredentials.companyId, companyVendorCredentials.supportedVendorId],
        set: {
          ftpServer: mappedCredentials.ftpServer,
          ftpPort: mappedCredentials.ftpPort,
          ftpUsername: mappedCredentials.ftpUsername,
          ftpPassword: mappedCredentials.ftpPassword,
          ftpBasePath: mappedCredentials.ftpBasePath,
          catalogSyncEnabled: mappedCredentials.catalogSyncEnabled,
          inventorySyncEnabled: mappedCredentials.inventorySyncEnabled,
          updatedAt: new Date()
        }
      })
      .returning();
    return result;
  }

  async saveCompanyVendorCredentials(companyId: number, supportedVendorId: number, credentials: any): Promise<any> {
    const { companyVendorCredentials } = await import('@shared/schema');
    
    console.log('💾 STORAGE: Saving company vendor credentials');
    console.log('💾 STORAGE: Company ID:', companyId);
    console.log('💾 STORAGE: Supported Vendor ID:', supportedVendorId);
    console.log('💾 STORAGE: Credentials:', credentials);
    
    // Map snake_case fields to camelCase for Drizzle ORM
    const mappedCredentials: any = {
      companyId: companyId,
      supportedVendorId: supportedVendorId,
      updatedAt: new Date()
    };
    
    // Map common FTP fields
    if (credentials.ftp_server !== undefined) mappedCredentials.ftpServer = credentials.ftp_server;
    if (credentials.ftp_port !== undefined) mappedCredentials.ftpPort = credentials.ftp_port;
    if (credentials.ftp_username !== undefined) mappedCredentials.ftpUsername = credentials.ftp_username;
    if (credentials.ftp_password !== undefined) mappedCredentials.ftpPassword = credentials.ftp_password;
    if (credentials.ftp_base_path !== undefined) mappedCredentials.ftpBasePath = credentials.ftp_base_path;
    
    // Map sync fields
    if (credentials.catalog_sync_enabled !== undefined) mappedCredentials.catalogSyncEnabled = credentials.catalog_sync_enabled;
    if (credentials.catalog_sync_schedule !== undefined) mappedCredentials.catalogSyncSchedule = credentials.catalog_sync_schedule;
    if (credentials.inventory_sync_enabled !== undefined) mappedCredentials.inventorySyncEnabled = credentials.inventory_sync_enabled;
    if (credentials.inventory_sync_schedule !== undefined) mappedCredentials.inventorySyncSchedule = credentials.inventory_sync_schedule;
    
    // Map API fields (for non-FTP vendors)
    // Priority: email > user_name (Lipsey's uses email, Sports South uses user_name)
    if (credentials.email !== undefined) {
      mappedCredentials.userName = credentials.email;
      console.log('💾 STORAGE: Mapped email to userName:', credentials.email);
    } else if (credentials.user_name !== undefined) {
      mappedCredentials.userName = credentials.user_name;
      console.log('💾 STORAGE: Mapped user_name to userName:', credentials.user_name);
    }
    if (credentials.password !== undefined) mappedCredentials.password = credentials.password;
    if (credentials.customer_number !== undefined) mappedCredentials.customerNumber = credentials.customer_number;
    if (credentials.api_key !== undefined) mappedCredentials.apiKey = credentials.api_key;
    if (credentials.api_secret !== undefined) mappedCredentials.apiSecret = credentials.api_secret;
    if (credentials.sid !== undefined) mappedCredentials.sid = credentials.sid;
    if (credentials.token !== undefined) mappedCredentials.token = credentials.token;
    
    // Also accept camelCase fields (for backward compatibility) - but only if snake_case wasn't provided
    if (credentials.ftpServer !== undefined && credentials.ftp_server === undefined) mappedCredentials.ftpServer = credentials.ftpServer;
    if (credentials.ftpPort !== undefined && credentials.ftp_port === undefined) mappedCredentials.ftpPort = credentials.ftpPort;
    if (credentials.ftpUsername !== undefined && credentials.ftp_username === undefined) mappedCredentials.ftpUsername = credentials.ftpUsername;
    if (credentials.ftpPassword !== undefined && credentials.ftp_password === undefined) mappedCredentials.ftpPassword = credentials.ftpPassword;
    if (credentials.ftpBasePath !== undefined && credentials.ftp_base_path === undefined) mappedCredentials.ftpBasePath = credentials.ftpBasePath;
    
    console.log('💾 STORAGE: Mapped credentials for Drizzle:', mappedCredentials);
    
    const [result] = await db
      .insert(companyVendorCredentials)
      .values(mappedCredentials)
      .onConflictDoUpdate({
        target: [companyVendorCredentials.companyId, companyVendorCredentials.supportedVendorId],
        set: mappedCredentials // Use mapped credentials in update too
      })
      .returning();
    
    console.log('💾 STORAGE: Successfully saved credentials');
    return result;
  }

  async getVendorMappingCount(companyId: number, supportedVendorId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vendorProductMappings)
      .where(
        and(
          eq(vendorProductMappings.companyId, companyId),
          eq(vendorProductMappings.supportedVendorId, supportedVendorId)
        )
      );
    return result?.count || 0;
  }

  async getBillHicksInventoryCount(): Promise<number> {
    const { vendorInventory } = await import('@shared/schema');
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vendorInventory)
      .where(eq(vendorInventory.supportedVendorId, await this.getBillHicksVendorId()));
    return result?.count || 0;
  }

  // Category methods implementation
  async getCategory(id: number): Promise<Category | undefined> {
    const result = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    return result[0];
  }

  async getCategoriesByCompany(companyId: number): Promise<Category[]> {
    return await db
      .select()
      .from(categories)
      .where(and(eq(categories.companyId, companyId), eq(categories.isActive, true)))
      .orderBy(asc(categories.sortOrder), asc(categories.displayName));
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const result = await db
      .insert(categories)
      .values(category)
      .returning();
    return result[0];
  }

  async updateCategory(id: number, updates: Partial<Category>): Promise<Category | undefined> {
    const result = await db
      .update(categories)
      .set({ 
        ...updates, 
        updatedAt: new Date() 
      })
      .where(eq(categories.id, id))
      .returning();
    return result[0];
  }

  async updateCategorySortOrder(id: number, sortOrder: number): Promise<boolean> {
    try {
      await db
        .update(categories)
        .set({ 
          sortOrder, 
          updatedAt: new Date() 
        })
        .where(eq(categories.id, id));
      return true;
    } catch (error) {
      console.error('Error updating category sort order:', error);
      return false;
    }
  }

  async deleteCategory(id: number, reassignToId?: number): Promise<boolean> {
    try {
      // Start a transaction for category deletion and product reassignment
      await db.transaction(async (tx) => {
        // Get the category to delete
        const categoryToDelete = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, id));
        
        if (!categoryToDelete.length) {
          throw new Error('Category not found');
        }

        const categorySlug = categoryToDelete[0].slug;

        // If reassignToId is provided, reassign products to the new category
        if (reassignToId) {
          const reassignCategory = await tx
            .select()
            .from(categories)
            .where(eq(categories.id, reassignToId));
          
          if (!reassignCategory.length) {
            throw new Error('Reassignment category not found');
          }

          // Update all products with this category to the new category
          await tx
            .update(products)
            .set({ category: reassignCategory[0].slug })
            .where(eq(products.category, categorySlug));
        } else {
          // If no reassignment, set category to null for affected products
          await tx
            .update(products)
            .set({ category: null })
            .where(eq(products.category, categorySlug));
        }

        // Delete the category
        await tx
          .delete(categories)
          .where(eq(categories.id, id));
      });

      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      return false;
    }
  }

  async getProductCountByCategory(categorySlug: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.category, categorySlug));
    return result[0]?.count || 0;
  }

  // Category Template methods implementation
  async getCategoryTemplatesByRetailVertical(retailVerticalId: number): Promise<CategoryTemplate[]> {
    return await db
      .select()
      .from(categoryTemplates)
      .where(eq(categoryTemplates.retailVerticalId, retailVerticalId))
      .orderBy(asc(categoryTemplates.sortOrder), asc(categoryTemplates.displayName));
  }

  async createCategoryTemplate(template: InsertCategoryTemplate): Promise<CategoryTemplate> {
    const result = await db
      .insert(categoryTemplates)
      .values(template)
      .returning();
    return result[0];
  }

  async updateCategoryTemplate(id: number, updates: Partial<CategoryTemplate>): Promise<CategoryTemplate | undefined> {
    const result = await db
      .update(categoryTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(categoryTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteCategoryTemplate(id: number): Promise<boolean> {
    try {
      await db
        .delete(categoryTemplates)
        .where(eq(categoryTemplates.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting category template:', error);
      return false;
    }
  }

  async copyCategoryTemplatesToCompany(companyId: number, retailVerticalId: number): Promise<number> {
    try {
      // Get all templates for this retail vertical
      const templates = await this.getCategoryTemplatesByRetailVertical(retailVerticalId);
      
      if (templates.length === 0) {
        console.log(`No category templates found for retail vertical ${retailVerticalId}`);
        return 0;
      }

      // Convert templates to company categories
      const categoriesToCreate: InsertCategory[] = templates.map(template => ({
        companyId,
        name: template.name,
        slug: template.slug,
        displayName: template.displayName,
        description: template.description,
        isActive: template.isActive,
        sortOrder: template.sortOrder
      }));

      // Insert all categories
      await db.insert(categories).values(categoriesToCreate);

      console.log(`✅ Copied ${templates.length} category templates to company ${companyId}`);
      return templates.length;
    } catch (error) {
      console.error(`❌ Error copying category templates to company ${companyId}:`, error);
      throw error;
    }
  }

  // Subscription methods implementation
  async getSubscription(id: number): Promise<Subscription | undefined> {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id));
    return result[0];
  }

  async getSubscriptionByCompany(companyId: number): Promise<Subscription | undefined> {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId));
    return result[0];
  }

  async getSubscriptionByZohoId(zohoSubscriptionId: string): Promise<Subscription | undefined> {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.externalSubscriptionId, zohoSubscriptionId));
    return result[0];
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return await db.select().from(subscriptions);
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const result = await db
      .insert(subscriptions)
      .values(subscription)
      .returning();
    return result[0];
  }

  async updateSubscription(id: number, updates: Partial<Subscription>): Promise<Subscription | undefined> {
    const result = await db
      .update(subscriptions)
      .set({ 
        ...updates, 
        updatedAt: new Date() 
      })
      .where(eq(subscriptions.id, id))
      .returning();
    return result[0];
  }

  async cancelSubscription(id: number): Promise<boolean> {
    try {
      await db
        .update(subscriptions)
        .set({ 
          status: 'cancelled', 
          cancelledAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(subscriptions.id, id));
      return true;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  }

  // Subscription Payment methods
  async createSubscriptionPayment(payment: InsertSubscriptionPayment): Promise<SubscriptionPayment> {
    const result = await db
      .insert(subscriptionPayments)
      .values(payment)
      .returning();
    return result[0];
  }

  async getPaymentsBySubscription(subscriptionId: number): Promise<SubscriptionPayment[]> {
    return await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionPayments.createdAt));
  }

  // Subscription Plan Change methods
  async createSubscriptionPlanChange(change: InsertSubscriptionPlanChange): Promise<SubscriptionPlanChange> {
    const result = await db
      .insert(subscriptionPlanChanges)
      .values(change)
      .returning();
    return result[0];
  }

  async getPlanChangesBySubscription(subscriptionId: number): Promise<SubscriptionPlanChange[]> {
    return await db
      .select()
      .from(subscriptionPlanChanges)
      .where(eq(subscriptionPlanChanges.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionPlanChanges.createdAt));
  }

  // Subscription Webhook Event methods
  async createSubscriptionWebhookEvent(event: InsertSubscriptionWebhookEvent): Promise<SubscriptionWebhookEvent> {
    const result = await db
      .insert(subscriptionWebhookEvents)
      .values(event)
      .returning();
    return result[0];
  }

  async getWebhookEventsBySubscription(subscriptionId: number): Promise<SubscriptionWebhookEvent[]> {
    return await db
      .select()
      .from(subscriptionWebhookEvents)
      .where(eq(subscriptionWebhookEvents.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionWebhookEvents.createdAt));
  }

  // Subscription Usage methods
  async createSubscriptionUsage(usage: InsertSubscriptionUsage): Promise<SubscriptionUsage> {
    const result = await db
      .insert(subscriptionUsage)
      .values(usage)
      .returning();
    return result[0];
  }

  async getUsageBySubscription(subscriptionId: number): Promise<SubscriptionUsage[]> {
    return await db
      .select()
      .from(subscriptionUsage)
      .where(eq(subscriptionUsage.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionUsage.createdAt));
  }

  async getCurrentUsage(companyId: number): Promise<SubscriptionUsage | undefined> {
    const result = await db
      .select()
      .from(subscriptionUsage)
      .innerJoin(subscriptions, eq(subscriptionUsage.subscriptionId, subscriptions.id))
      .where(eq(subscriptions.companyId, companyId))
      .orderBy(desc(subscriptionUsage.createdAt))
      .limit(1);
    return result[0]?.subscription_usage;
  }

  // Plan Settings methods
  async getAllPlanSettings(): Promise<PlanSettings[]> {
    return await db
      .select()
      .from(planSettings)
      .orderBy(asc(planSettings.sortOrder));
  }

  async getPlanSettings(planId: string): Promise<PlanSettings | undefined> {
    const result = await db
      .select()
      .from(planSettings)
      .where(eq(planSettings.planId, planId))
      .limit(1);
    return result[0];
  }

  async updatePlanSettings(planId: string, updates: Partial<PlanSettings>): Promise<PlanSettings | undefined> {
    const result = await db
      .update(planSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(planSettings.planId, planId))
      .returning();
    return result[0];
  }

  // Organization Status Audit Log methods
  async logOrganizationStatusChange(data: InsertOrganizationStatusAuditLog): Promise<OrganizationStatusAuditLog> {
    const result = await db
      .insert(organizationStatusAuditLog)
      .values(data)
      .returning();
    return result[0];
  }

  async getOrganizationStatusHistory(companyId: number): Promise<OrganizationStatusAuditLog[]> {
    return await db
      .select()
      .from(organizationStatusAuditLog)
      .where(eq(organizationStatusAuditLog.companyId, companyId))
      .orderBy(desc(organizationStatusAuditLog.changedAt));
  }

  // Vendor lookup utility functions for dynamic vendor ID resolution
  // Replaces hardcoded vendor ID comparisons with name-based lookups
  
  /**
   * Get a supported vendor by name (case-insensitive, partial match)
   * @param name Vendor name to search for
   * @returns SupportedVendor or undefined if not found
   */
  async getSupportedVendorByName(name: string): Promise<SupportedVendor | undefined> {
    const vendors = await this.getAllSupportedVendors();
    const normalize = (s: string | null | undefined) => (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const searchName = normalize(name);
    
    // Try exact normalized match against name or short code
    let vendor = vendors.find(v => normalize(v.name) === searchName || normalize(v.vendorShortCode) === searchName);
    if (vendor) return vendor;
    
    // Try normalized partial match in either name or short code
    vendor = vendors.find(v => normalize(v.name).includes(searchName) || normalize(v.vendorShortCode).includes(searchName));
    if (vendor) return vendor;
    
    return undefined;
  }
  
  /**
   * Get a supported vendor by short code
   * @param shortCode Vendor short code to search for
   * @returns SupportedVendor or undefined if not found
   */
  async getSupportedVendorByShortCode(shortCode: string): Promise<SupportedVendor | undefined> {
    const vendors = await this.getAllSupportedVendors();
    return vendors.find(v => v.vendorShortCode?.toLowerCase() === shortCode.toLowerCase());
  }
  
  /**
   * Get Bill Hicks vendor ID dynamically
   * @returns Bill Hicks vendor ID or throws error if not found
   */
  async getBillHicksVendorId(): Promise<number> {
    // Try common short code variants first
    const aliases = ['bill-hicks', 'BillHicks', 'billhicks', 'bh', 'bill_hicks', 'bill hicks'];
    for (const alias of aliases) {
      const byShort = await this.getSupportedVendorByShortCode(alias);
      if (byShort) return byShort.id;
    }
    // Try name-based lookup (case-insensitive, partial)
    const byName = await this.getSupportedVendorByName('bill hicks');
    if (byName) return byName.id;
    throw new Error('Bill Hicks vendor not found in supported vendors');
  }

  /**
   * Get Bill Hicks vendor record robustly (by short code or name, normalized)
   */
  async getBillHicksVendor(): Promise<SupportedVendor | undefined> {
    const vendors = await this.getAllSupportedVendors();
    const normalize = (s: string | null | undefined) => (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const matches = (v: SupportedVendor) => {
      const name = normalize(v.name);
      const code = normalize(v.vendorShortCode || '');
      const hasBillHicks = (str: string) => str.includes('bill') && str.includes('hicks');
      return hasBillHicks(name) || hasBillHicks(code) || code === 'billhicks' || code === 'bill-hicks';
    };
    return vendors.find(matches);
  }
  
  /**
   * Get Sports South vendor ID dynamically
   * @returns Sports South vendor ID or throws error if not found
   */
  async getSportsSouthVendorId(): Promise<number> {
    const aliases = ['sports-south', 'sportssouth', 'sports south', 'ss'];
    for (const alias of aliases) {
      const byShort = await this.getSupportedVendorByShortCode(alias);
      if (byShort) return byShort.id;
    }
    const byName = await this.getSupportedVendorByName('sports south');
    if (byName) return byName.id;
    throw new Error('Sports South vendor not found in supported vendors');
  }
  
  /**
   * Get Chattanooga vendor ID dynamically
   * @returns Chattanooga vendor ID or throws error if not found
   */
  async getChattanoogaVendorId(): Promise<number> {
    const aliases = ['chattanooga', 'chattanooga-shooting', 'chattanoogashooting', 'chattanooga shooting'];
    for (const alias of aliases) {
      const byShort = await this.getSupportedVendorByShortCode(alias);
      if (byShort) return byShort.id;
    }
    const byName = await this.getSupportedVendorByName('chattanooga');
    if (byName) return byName.id;
    throw new Error('Chattanooga Shooting Supplies vendor not found in supported vendors');
  }
  
  /**
   * Get Lipsey's vendor ID dynamically
   * @returns Lipsey's vendor ID or throws error if not found
   */
  async getLipseysVendorId(): Promise<number> {
    const aliases = ['lipseys', 'lipsey', "lipsey's", 'lipsey-s'];
    for (const alias of aliases) {
      const byShort = await this.getSupportedVendorByShortCode(alias);
      if (byShort) return byShort.id;
    }
    const byName = await this.getSupportedVendorByName('lipsey');
    if (byName) return byName.id;
    throw new Error("Lipsey's vendor not found in supported vendors");
  }
  
  /**
   * Update vendor enabled status for price comparison
   * @param companyId Company ID
   * @param vendorId Vendor ID
   * @param enabled Whether vendor should be enabled for price comparison
   */
  async updateVendorEnabledStatus(companyId: number, vendorId: number, enabled: boolean): Promise<void> {
    // For now, we'll store this in the vendors table
    // In the future, this could be moved to a separate table for better organization
    await db.update(vendors)
      .set({ 
        enabledForPriceComparison: enabled,
        updatedAt: new Date()
      })
      .where(and(
        eq(vendors.id, vendorId),
        eq(vendors.companyId, companyId)
      ));
  }


  /**
   * Get count of company vendor credentials for a supported vendor
   * @param supportedVendorId Supported vendor ID
   * @returns Count of companies with credentials for this vendor
   */
  async getCompanyVendorCredentialsCount(supportedVendorId: number): Promise<number> {
    const { companyVendorCredentials } = await import('@shared/schema');
    const results = await db.select({ count: sql<number>`count(*)` })
      .from(companyVendorCredentials)
      .where(eq(companyVendorCredentials.supportedVendorId, supportedVendorId));
    
    return results[0]?.count || 0;
  }

  /**
   * Get integration settings for a company
   * @param companyId Company ID
   * @returns Integration settings or null if not found
   */
  async getIntegrationSettings(companyId: number): Promise<IntegrationSettings | null> {
    try {
      const results = await db.select()
        .from(integrationSettings)
        .where(eq(integrationSettings.companyId, companyId))
        .limit(1);
      
      return results[0] || null;
    } catch (error) {
      console.log('Error fetching integration settings (table may not exist):', error);
      // Return null if table doesn't exist yet
      return null;
    }
  }

  /**
   * Update integration settings for a company
   * @param companyId Company ID
   * @param updates Integration settings updates
   * @returns Updated integration settings
   */
  async updateIntegrationSettings(companyId: number, updates: Partial<InsertIntegrationSettings>): Promise<IntegrationSettings> {
    try {
      // Check if settings exist
      const existingSettings = await this.getIntegrationSettings(companyId);
      
      if (existingSettings) {
        // Update existing settings
        const [updated] = await db.update(integrationSettings)
          .set({
            ...updates,
            updatedAt: new Date()
          })
          .where(eq(integrationSettings.companyId, companyId))
          .returning();
        
        return updated;
      } else {
        // Create new settings
        const [created] = await db.insert(integrationSettings)
          .values({
            companyId,
            ...updates,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        return created;
      }
    } catch (error) {
      console.error('Error updating integration settings:', error);
      throw new Error('Integration settings table may not exist. Please run database migration.');
    }
  }
}

export const storage = new DatabaseStorage();

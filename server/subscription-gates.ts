import { storage } from './storage';
import { SUBSCRIPTION_PLANS } from '@shared/subscription-config';

export interface SubscriptionLimits {
  maxVendors: number;
  maxUsers: number;
  maxOrders: number;
  features: {
    orderProcessing: boolean;
    asnProcessing: boolean;
    advancedAnalytics: boolean;
    apiAccess: boolean;
  };
}

export async function getCompanySubscriptionLimits(companyId: number): Promise<SubscriptionLimits> {
  try {
    const company = await storage.getCompany(companyId);
    if (!company) {
      throw new Error('Company not found');
    }
    
    const config = SUBSCRIPTION_PLANS[company.plan] || SUBSCRIPTION_PLANS.free;
    
    return {
      maxVendors: config.limits.maxVendors,
      maxUsers: config.limits.maxUsers, 
      maxOrders: config.limits.maxOrders,
      features: {
        orderProcessing: config.limits.canOrder,
        asnProcessing: config.limits.canProcessASNs,
        advancedAnalytics: false, // Not defined in current schema
        apiAccess: false // Not defined in current schema
      }
    };
  } catch (error) {
    console.error('Error getting subscription limits:', error);
    // Default to free tier limits on error
    const freeConfig = SUBSCRIPTION_PLANS.free;
    return {
      maxVendors: freeConfig.limits.maxVendors,
      maxUsers: freeConfig.limits.maxUsers,
      maxOrders: freeConfig.limits.maxOrders,
      features: {
        orderProcessing: freeConfig.limits.canOrder,
        asnProcessing: freeConfig.limits.canProcessASNs,
        advancedAnalytics: false,
        apiAccess: false
      }
    };
  }
}

export async function canAddMoreVendors(companyId: number): Promise<{ allowed: boolean; current: number; limit: number; message?: string }> {
  try {
    const limits = await getCompanySubscriptionLimits(companyId);
    const currentVendors = await storage.getVendorsByCompany(companyId);
    const currentCount = currentVendors.length;
    
    const allowed = limits.maxVendors === -1 || currentCount < limits.maxVendors;
    
    return {
      allowed,
      current: currentCount,
      limit: limits.maxVendors,
      message: allowed ? undefined : `Vendor limit reached. Your plan allows ${limits.maxVendors} vendors, you currently have ${currentCount}.`
    };
  } catch (error) {
    console.error('Error checking vendor limits:', error);
    return { allowed: false, current: 0, limit: 0, message: 'Unable to verify vendor limits' };
  }
}

export async function canUseOrderProcessing(companyId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    const limits = await getCompanySubscriptionLimits(companyId);
    const allowed = limits.features.orderProcessing;
    
    return {
      allowed,
      message: allowed ? undefined : 'Order processing requires Enterprise plan. Upgrade to process orders and manage procurement workflows.'
    };
  } catch (error) {
    console.error('Error checking order processing access:', error);
    return { allowed: false, message: 'Unable to verify order processing access' };
  }
}

export async function canUseASNProcessing(companyId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    const limits = await getCompanySubscriptionLimits(companyId);
    const allowed = limits.features.asnProcessing;
    
    return {
      allowed,
      message: allowed ? undefined : 'ASN processing requires Enterprise plan. Upgrade to manage Advanced Ship Notices and inventory tracking.'
    };
  } catch (error) {
    console.error('Error checking ASN processing access:', error);
    return { allowed: false, message: 'Unable to verify ASN processing access' };
  }
}

export async function canUseAdvancedAnalytics(companyId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    const limits = await getCompanySubscriptionLimits(companyId);
    const allowed = limits.features.advancedAnalytics;
    
    return {
      allowed,
      message: allowed ? undefined : 'Advanced analytics requires Standard or Enterprise plan. Upgrade for detailed reporting and insights.'
    };
  } catch (error) {
    console.error('Error checking advanced analytics access:', error);
    return { allowed: false, message: 'Unable to verify advanced analytics access' };
  }
}

export async function canUseAPIAccess(companyId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    const limits = await getCompanySubscriptionLimits(companyId);
    const allowed = limits.features.apiAccess;
    
    return {
      allowed,
      message: allowed ? undefined : 'API access requires Standard or Enterprise plan. Upgrade for programmatic access to your data.'
    };
  } catch (error) {
    console.error('Error checking API access:', error);
    return { allowed: false, message: 'Unable to verify API access' };
  }
}

export async function validateSubscriptionLimits(companyId: number, action: 'vendor' | 'order' | 'asn' | 'analytics' | 'api'): Promise<{ allowed: boolean; message?: string }> {
  switch (action) {
    case 'vendor':
      return await canAddMoreVendors(companyId);
    case 'order':
      return await canUseOrderProcessing(companyId);
    case 'asn':
      return await canUseASNProcessing(companyId);
    case 'analytics':
      return await canUseAdvancedAnalytics(companyId);
    case 'api':
      return await canUseAPIAccess(companyId);
    default:
      return { allowed: false, message: 'Unknown action' };
  }
}
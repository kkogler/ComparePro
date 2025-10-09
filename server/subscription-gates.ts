import { storage } from './storage';

export interface SubscriptionLimits {
  maxVendors: number;
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
    
    // ✅ Read from database plan_settings table instead of hardcoded config
    const planSettings = await storage.getPlanSettings(company.plan);
    
    if (!planSettings) {
      throw new Error(`Plan settings not found for plan: ${company.plan}`);
    }
    
    return {
      maxVendors: planSettings.maxVendors || -1, // null = unlimited (-1)
      maxOrders: planSettings.maxOrders || -1, // null = unlimited (-1)
      features: {
        orderProcessing: planSettings.onlineOrdering,
        asnProcessing: planSettings.asnProcessing,
        advancedAnalytics: true, // ✅ ENABLED: All plans have analytics
        apiAccess: true // ✅ ENABLED: All plans have API access
      }
    };
  } catch (error) {
    console.error('Error getting subscription limits:', error);
    // Default to safe fallback limits on error
    return {
      maxVendors: 3,
      maxOrders: 100,
      features: {
        orderProcessing: true,
        asnProcessing: true,
        advancedAnalytics: true,
        apiAccess: true
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
      message: allowed ? undefined : 'Order processing is not enabled for your plan. Please upgrade to process orders and manage procurement workflows.'
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
      message: allowed ? undefined : 'ASN processing is not enabled for your plan. Please upgrade to manage Advanced Ship Notices and inventory tracking.'
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
      message: allowed ? undefined : 'Advanced analytics is not enabled for your plan. Please upgrade for detailed reporting and insights.'
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
      message: allowed ? undefined : 'API access is not enabled for your plan. Please upgrade for programmatic access to your data.'
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
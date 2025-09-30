import { storage } from './storage';

/**
 * Service to enforce plan settings and feature limits
 */

export interface PlanLimits {
  maxUsers: number;
  maxVendors: number;
  maxOrders: number;
  features: {
    advancedAnalytics: boolean;
    apiAccess: boolean;
    orderProcessing: boolean;
    asnProcessing: boolean;
    [key: string]: boolean;
  };
}

/**
 * Get plan limits from Plan Settings configuration
 */
export async function getPlanLimits(planName: string): Promise<PlanLimits | null> {
  try {
    console.log(`PLAN ENFORCEMENT: Getting limits for plan: ${planName}`);
    
    // Get all plan settings from database
    const allPlanSettings = await storage.getAllPlanSettings();
    if (!allPlanSettings || allPlanSettings.length === 0) {
      console.log('PLAN ENFORCEMENT: No plan settings found, using default limits');
      return getDefaultPlanLimits(planName);
    }

    // Find the specific plan
    const plan = allPlanSettings.find((p: any) => p.planName.toLowerCase() === planName.toLowerCase());
    if (!plan) {
      console.log(`PLAN ENFORCEMENT: Plan '${planName}' not found in settings, using defaults`);
      return getDefaultPlanLimits(planName);
    }

    const limits: PlanLimits = {
      maxUsers: plan.maxUsers || 5,
      maxVendors: plan.maxVendors || 3,
      maxOrders: plan.maxOrders || 100,
      features: {
        advancedAnalytics: plan.advancedAnalytics || false,
        apiAccess: plan.apiAccess || false,
        orderProcessing: plan.orderProcessing || false,
        asnProcessing: plan.asnProcessing || false
      }
    };

    console.log(`PLAN ENFORCEMENT: Loaded limits for ${planName}:`, limits);
    return limits;

  } catch (error) {
    console.error('PLAN ENFORCEMENT ERROR:', error);
    return getDefaultPlanLimits(planName);
  }
}

/**
 * Default plan limits when Plan Settings are not available
 */
function getDefaultPlanLimits(planName: string): PlanLimits {
  const defaults: Record<string, PlanLimits> = {
    free: {
      maxUsers: 2,
      maxVendors: 1,
      maxOrders: 50,
      features: {
        advancedAnalytics: false,
        apiAccess: false,
        orderProcessing: false,
        asnProcessing: false
      }
    },
    standard: {
      maxUsers: 25,
      maxVendors: 6,
      maxOrders: 1000,
      features: {
        advancedAnalytics: true,
        apiAccess: true,
        orderProcessing: false,
        asnProcessing: false
      }
    },
    enterprise: {
      maxUsers: 100,
      maxVendors: 999,
      maxOrders: 10000,
      features: {
        advancedAnalytics: true,
        apiAccess: true,
        orderProcessing: true,
        asnProcessing: true
      }
    }
  };

  return defaults[planName.toLowerCase()] || defaults.free;
}

/**
 * Check if a feature is available for a given plan
 */
export async function isFeatureAvailable(planName: string, featureName: string): Promise<boolean> {
  const limits = await getPlanLimits(planName);
  if (!limits) return false;
  
  return limits.features[featureName] === true;
}

/**
 * Check usage limits for a company
 */
export async function checkUsageLimits(companyId: number): Promise<{
  users: { current: number; limit: number; available: number; atLimit: boolean };
  vendors: { current: number; limit: number; available: number; atLimit: boolean };
  orders: { current: number; limit: number; available: number; atLimit: boolean };
}> {
  try {
    const company = await storage.getCompany(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const limits = await getPlanLimits(company.plan);
    if (!limits) {
      throw new Error('Plan limits not found');
    }

    // Get current usage
    const users = await storage.getCompanyUsers(companyId);
    const currentUsers = users.length;

    // TODO: Implement vendor count
    const currentVendors = 0;

    // TODO: Implement monthly order count
    const currentOrders = 0;

    return {
      users: {
        current: currentUsers,
        limit: limits.maxUsers,
        available: Math.max(0, limits.maxUsers - currentUsers),
        atLimit: currentUsers >= limits.maxUsers
      },
      vendors: {
        current: currentVendors,
        limit: limits.maxVendors,
        available: Math.max(0, limits.maxVendors - currentVendors),
        atLimit: currentVendors >= limits.maxVendors
      },
      orders: {
        current: currentOrders,
        limit: limits.maxOrders,
        available: Math.max(0, limits.maxOrders - currentOrders),
        atLimit: currentOrders >= limits.maxOrders
      }
    };

  } catch (error) {
    console.error('USAGE LIMITS CHECK ERROR:', error);
    throw error;
  }
}

/**
 * Validate if an action is allowed based on plan limits
 */
export async function validatePlanAction(
  companyId: number, 
  action: 'add_user' | 'add_vendor' | 'create_order' | 'access_feature',
  featureName?: string
): Promise<{ allowed: boolean; message?: string; upgradeUrl?: string }> {
  try {
    const company = await storage.getCompany(companyId);
    if (!company) {
      return { allowed: false, message: 'Company not found' };
    }

    // Check subscription status first
    if (['expired', 'cancelled', 'paused'].includes(company.status)) {
      return {
        allowed: false,
        message: `Account is ${company.status}. Please update your subscription to continue.`,
        upgradeUrl: `/org/${company.slug}/billing`
      };
    }

    const limits = await getPlanLimits(company.plan);
    if (!limits) {
      return { allowed: false, message: 'Plan configuration not found' };
    }

    const usage = await checkUsageLimits(companyId);

    switch (action) {
      case 'add_user':
        if (usage.users.atLimit) {
          return {
            allowed: false,
            message: `User limit reached (${usage.users.limit}). Upgrade your plan to add more users.`,
            upgradeUrl: `/org/${company.slug}/billing/upgrade`
          };
        }
        break;

      case 'add_vendor':
        if (usage.vendors.atLimit) {
          return {
            allowed: false,
            message: `Vendor limit reached (${usage.vendors.limit}). Upgrade your plan to add more vendors.`,
            upgradeUrl: `/org/${company.slug}/billing/upgrade`
          };
        }
        break;

      case 'create_order':
        if (usage.orders.atLimit) {
          return {
            allowed: false,
            message: `Monthly order limit reached (${usage.orders.limit}). Upgrade your plan or wait for next month.`,
            upgradeUrl: `/org/${company.slug}/billing/upgrade`
          };
        }
        break;

      case 'access_feature':
        if (!featureName) {
          return { allowed: false, message: 'Feature name required' };
        }
        
        const hasFeature = await isFeatureAvailable(company.plan, featureName);
        if (!hasFeature) {
          return {
            allowed: false,
            message: `Feature '${featureName}' is not available on your current plan (${company.plan}).`,
            upgradeUrl: `/org/${company.slug}/billing/upgrade`
          };
        }
        break;

      default:
        return { allowed: false, message: 'Unknown action' };
    }

    return { allowed: true };

  } catch (error) {
    console.error('PLAN ACTION VALIDATION ERROR:', error);
    return { allowed: false, message: 'Validation failed. Please try again.' };
  }
}

/**
 * Get comprehensive plan status for a company
 */
export async function getCompanyPlanStatus(companyId: number) {
  try {
    const company = await storage.getCompany(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const limits = await getPlanLimits(company.plan);
    const usage = await checkUsageLimits(companyId);

    // Calculate trial days remaining
    const now = new Date();
    const trialDaysRemaining = company.trialEndsAt ? 
      Math.max(0, Math.ceil((company.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    return {
      subscription: {
        status: company.status,
        trialStatus: company.trialStatus,
        plan: company.plan,
        trialEndsAt: company.trialEndsAt,
        trialDaysRemaining,
        billingProvider: company.billingProvider
      },
      limits,
      usage,
      warnings: {
        trialExpiring: company.status === 'trial' && trialDaysRemaining <= 3,
        userLimitClose: usage.users.available <= 2,
        vendorLimitClose: usage.vendors.available <= 1,
        orderLimitClose: usage.orders.available <= 50
      }
    };

  } catch (error) {
    console.error('PLAN STATUS ERROR:', error);
    throw error;
  }
}

/**
 * Initialize subscription jobs
 */
export async function initializeSubscriptionServices() {
  try {
    console.log('🔧 Initializing subscription services...');

    // Start background jobs for trial expiration and payments
    const { startSubscriptionJobs } = await import('./subscription-jobs');
    startSubscriptionJobs();

    console.log('✅ Subscription services initialized successfully');
  } catch (error) {
    console.error('SUBSCRIPTION SERVICES INIT ERROR:', error);
  }
}
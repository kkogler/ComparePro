import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { validatePlanAction, isFeatureAvailable } from './plan-enforcement-service';

// Extend Request interface to include subscription data
interface AuthenticatedRequest extends Request {
  user?: any;
  organizationId?: number;
  subscriptionStatus?: {
    status: string;
    trialStatus?: string;
    trialEndsAt?: Date;
    plan: string;
    features: any;
  };
}

/**
 * Middleware to check subscription status and enforce access controls
 * This middleware should run after authentication but before business logic
 */
export function requireActiveSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return async function subscriptionCheck(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Skip subscription checks for admin users
      if (req.user?.companyId === null) {
        console.log('SUBSCRIPTION: Admin user - skipping subscription check');
        return next();
      }

      // Skip if no organization context
      if (!req.organizationId) {
        console.log('SUBSCRIPTION: No organization context - skipping check');
        return next();
      }

      // Get company subscription status
      const company = await storage.getCompany(req.organizationId);
      if (!company) {
        console.log('SUBSCRIPTION: Company not found:', req.organizationId);
        return res.status(404).json({ 
          error: 'Organization not found',
          code: 'ORG_NOT_FOUND' 
        });
      }

      // Check subscription status
      const status = company.status;
      const trialStatus = company.trialStatus;
      const trialEndsAt = company.trialEndsAt;
      const now = new Date();

      console.log(`SUBSCRIPTION CHECK: Company ${company.name} - Status: ${status}, Trial: ${trialStatus}, Trial Ends: ${trialEndsAt}`);

      // Set subscription data on request for use in route handlers
      req.subscriptionStatus = {
        status: status,
        trialStatus: trialStatus,
        trialEndsAt: trialEndsAt,
        plan: company.plan,
        features: company.features
      };

      // Check for expired trial
      if (status === 'trial' && trialEndsAt && trialEndsAt < now) {
        console.log('SUBSCRIPTION: Trial expired, updating status to expired');
        
        // Update company status to expired
        await storage.updateCompany(company.id, {
          status: 'expired',
          trialStatus: 'expired',
          updatedAt: new Date()
        });

        return res.status(402).json({
          error: 'Trial period has expired',
          code: 'TRIAL_EXPIRED',
          message: 'Your trial period has ended. Please upgrade to continue using the service.',
          trialEndedAt: trialEndsAt,
          upgradeUrl: `/org/${company.slug}/billing/upgrade`
        });
      }

      // Block access for certain statuses
      const blockedStatuses = ['expired', 'cancelled', 'paused'];
      if (blockedStatuses.includes(status)) {
        const errorMessages = {
          expired: 'Your subscription has expired. Please renew to continue.',
          cancelled: 'Your subscription has been cancelled. Please reactivate to continue.',
          paused: 'Your account has been temporarily suspended. Please contact support.'
        };

        const errorCodes = {
          expired: 'SUBSCRIPTION_EXPIRED',
          cancelled: 'SUBSCRIPTION_CANCELLED', 
          paused: 'ACCOUNT_PAUSED'
        };

        console.log(`SUBSCRIPTION: Access blocked - Status: ${status}`);
        
        return res.status(402).json({
          error: errorMessages[status as keyof typeof errorMessages],
          code: errorCodes[status as keyof typeof errorCodes],
          status: status,
          upgradeUrl: status === 'expired' ? `/org/${company.slug}/billing/upgrade` : undefined,
          contactUrl: status === 'paused' ? `/org/${company.slug}/support` : undefined
        });
      }

      // Check for past due status (soft block - show warning but allow access)
      if (status === 'past_due') {
        console.log('SUBSCRIPTION: Past due status - allowing access with warning');
        // Set warning header but allow access
        res.setHeader('X-Subscription-Warning', 'Payment is past due');
      }

      // All checks passed, continue to route handler
      console.log('SUBSCRIPTION: Access granted');
      next();

    } catch (error) {
      console.error('SUBSCRIPTION MIDDLEWARE ERROR:', error);
      // On error, allow access to prevent system failures
      // but log the error for investigation
      next();
    }
  }(req, res, next);
}

/**
 * Middleware to check plan-specific feature access
 */
export function requireFeature(feature: string) {
  return function(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Skip for admin users
      if (req.user?.companyId === null) {
        return next();
      }

      // Check if subscription status was set by requireActiveSubscription
      if (!req.subscriptionStatus) {
        console.log('FEATURE CHECK: No subscription status available');
        return res.status(403).json({
          error: 'Subscription status required for feature access',
          code: 'SUBSCRIPTION_CHECK_REQUIRED'
        });
      }

      const { features, plan } = req.subscriptionStatus;

      // Check if feature is enabled for this plan
      const hasFeature = features?.[feature] === true;
      
      if (!hasFeature) {
        console.log(`FEATURE CHECK: Feature '${feature}' not available on plan '${plan}'`);
        return res.status(402).json({
          error: `Feature '${feature}' not available on your current plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          currentPlan: plan,
          requiredFeature: feature,
          upgradeUrl: `/org/${req.params.slug}/billing/upgrade`
        });
      }

      console.log(`FEATURE CHECK: Feature '${feature}' access granted`);
      next();

    } catch (error) {
      console.error('FEATURE MIDDLEWARE ERROR:', error);
      // On error, deny access for security
      res.status(500).json({
        error: 'Feature check failed',
        code: 'FEATURE_CHECK_ERROR'
      });
    }
  };
}

/**
 * Middleware to check usage limits (users, vendors, orders)
 */
export function checkUsageLimit(limitType: 'users' | 'vendors' | 'orders') {
  return async function(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Skip for admin users
      if (req.user?.companyId === null) {
        return next();
      }

      if (!req.organizationId) {
        return next();
      }

      const company = await storage.getCompany(req.organizationId);
      if (!company) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Get current usage based on limit type
      let currentUsage = 0;
      let limit = 0;

      switch (limitType) {
        case 'users':
          const users = await storage.getCompanyUsers(company.id);
          currentUsage = users.length;
          limit = company.maxUsers;
          break;
          
        case 'vendors':
          // TODO: Implement vendor count check
          currentUsage = 0;
          limit = company.maxVendors;
          break;
          
        case 'orders':
          // TODO: Implement monthly order count check  
          currentUsage = 0;
          limit = company.maxOrders || company.maxOrdersPerMonth || 1000;
          break;
      }

      // Check if limit is exceeded
      if (limit > 0 && currentUsage >= limit) {
        console.log(`USAGE LIMIT: ${limitType} limit exceeded - ${currentUsage}/${limit}`);
        return res.status(402).json({
          error: `${limitType} limit exceeded`,
          code: 'USAGE_LIMIT_EXCEEDED',
          currentUsage,
          limit,
          upgradeUrl: `/org/${company.slug}/billing/upgrade`
        });
      }

      console.log(`USAGE LIMIT: ${limitType} check passed - ${currentUsage}/${limit}`);
      next();

    } catch (error) {
      console.error('USAGE LIMIT MIDDLEWARE ERROR:', error);
      // On error, allow access to prevent system failures
      next();
    }
  };
}

/**
 * Helper function to get trial days remaining
 */
export function getTrialDaysRemaining(trialEndsAt: Date | null): number {
  if (!trialEndsAt) return 0;
  
  const now = new Date();
  const diffTime = trialEndsAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Helper function to check if subscription is active
 */
export function isSubscriptionActive(status: string, trialStatus?: string, trialEndsAt?: Date): boolean {
  if (status === 'active') return true;
  
  if (status === 'trial' && trialEndsAt) {
    const now = new Date();
    return trialEndsAt > now;
  }
  
  return false;
}
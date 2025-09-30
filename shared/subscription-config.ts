// Subscription Configuration System
// Centralized configuration for subscription plans and pricing

export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  features: string[];
  limits: {
    maxUsers: number;
    maxVendors: number;
    maxOrders: number;
    canOrder: boolean;
    canProcessASNs: boolean;
  };
  billingProvider?: 'zoho' | 'recurly';
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'free',
    displayName: 'Free',
    features: [
      'Up to 3 vendors', 
      'Product search & comparison', 
      'Basic reporting', 
      'Email support'
    ],
    limits: {
      maxUsers: 2,
      maxVendors: 3,
      maxOrders: 0, // No ordering
      canOrder: false,
      canProcessASNs: false
    }
  },
  standard: {
    id: 'standard',
    name: 'standard',
    displayName: 'Standard',
    features: [
      'Up to 6 vendors',
      'Product search & comparison',
      'Advanced reporting', 
      'Priority email support'
    ],
    limits: {
      maxUsers: 5,
      maxVendors: 6,
      maxOrders: 0, // No ordering
      canOrder: false,
      canProcessASNs: false
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    features: [
      'Unlimited vendors',
      'Full ordering system',
      'ASN processing', 
      'Phone support',
      'Custom integrations',
      'Dedicated account manager'
    ],
    limits: {
      maxUsers: -1, // unlimited
      maxVendors: -1, // unlimited
      maxOrders: -1, // unlimited
      canOrder: true,
      canProcessASNs: true
    }
  }
};

export const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[keyof typeof SUBSCRIPTION_STATUSES];

export function getSubscriptionPlan(planId: string): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS[planId] || null;
}

// Revenue calculation removed - pricing handled by Zoho Billing

export function getPlanColor(planId: string): string {
  const plan = getSubscriptionPlan(planId);
  if (!plan) return 'bg-gray-100 text-gray-800 border-gray-200';
  
  switch (plan.id) {
    case 'free':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'basic':
    case 'monthly-standard':
    case 'annual-standard':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'professional':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'enterprise':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case SUBSCRIPTION_STATUSES.ACTIVE: 
      return 'bg-green-100 text-green-800';
    case SUBSCRIPTION_STATUSES.TRIAL: 
      return 'bg-blue-100 text-blue-800';
    case SUBSCRIPTION_STATUSES.SUSPENDED: 
      return 'bg-yellow-100 text-yellow-800';
    case SUBSCRIPTION_STATUSES.CANCELLED:
    case SUBSCRIPTION_STATUSES.EXPIRED: 
      return 'bg-red-100 text-red-800';
    default: 
      return 'bg-gray-100 text-gray-800';
  }
}

export function getUniquePlans(organizations: any[]): string[] {
  return Array.from(new Set(organizations.map(org => org.plan).filter(Boolean)));
}

// Zoho Billing Integration
export const ZOHO_PLAN_CODES: Record<string, string> = {
  'free': 'free-plan-v1',
  'standard': 'standard-plan-v1', 
  'enterprise': 'enterprise-plan-v1'
};

// Feature Gate Functions
export function canUseOrdering(planId: string): boolean {
  const plan = getSubscriptionPlan(planId);
  return plan?.limits.canOrder || false;
}

export function canProcessASNs(planId: string): boolean {
  const plan = getSubscriptionPlan(planId);
  return plan?.limits.canProcessASNs || false;
}

export function getMaxVendors(planId: string): number {
  const plan = getSubscriptionPlan(planId);
  return plan?.limits.maxVendors || 0;
}

export function canAddMoreVendors(planId: string, currentVendorCount: number): boolean {
  const maxVendors = getMaxVendors(planId);
  if (maxVendors === -1) return true; // unlimited
  return currentVendorCount < maxVendors;
}

export function getMaxUsers(planId: string): number {
  const plan = getSubscriptionPlan(planId);
  return plan?.limits.maxUsers || 0;
}

export function canAddMoreUsers(planId: string, currentUserCount: number): boolean {
  const maxUsers = getMaxUsers(planId);
  if (maxUsers === -1) return true; // unlimited
  return currentUserCount < maxUsers;
}
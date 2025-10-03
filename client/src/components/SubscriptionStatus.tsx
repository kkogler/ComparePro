import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Clock, CreditCard, Users, Building2, ShoppingCart } from 'lucide-react';
import { useParams } from 'wouter';

interface SubscriptionStatus {
  id: string;
  plan: {
    name: string;
    code: string;
    price: number;
    interval: string;
  };
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  trialEndsAt?: string;
  nextBillingAt: string;
  usage: {
    users: { current: number; limit: number };
    vendors: { current: number; limit: number };
    orders: { current: number; limit: number };
  };
}

export function SubscriptionStatus() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Fetch subscription data (includes usage)
  const { data: status, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: [`/org/${slug}/api/subscription`],
    enabled: !!slug
  });

  // Get billing portal URL for self-service management
  const portalMutation = useMutation({
    mutationFn: () => {
      // Navigate to the customer portal endpoint which will redirect
      window.location.href = `/org/${slug}/api/billing/customer-portal`;
      return Promise.resolve();
    },
    onSuccess: () => {
      console.log('Redirecting to customer portal...');
    }
  });

  // Fetch invoices
  const { data: invoices } = useQuery({
    queryKey: [`/org/${slug}/api/billing/invoices`],
    enabled: !!slug
  });

  // Download invoices
  const invoicesMutation = useMutation({
    mutationFn: () => {
      window.open(`/org/${slug}/api/billing/invoices`, '_blank');
      return Promise.resolve();
    },
    onSuccess: () => {
      console.log('Opening invoices in new tab...');
    }
  });

  // Get upgrade payment page URL
  const upgradeMutation = useMutation({
    mutationFn: (planCode: string) => apiRequest(`/org/${slug}/api/billing/upgrade-url`, 'POST', { planCode }),
    onSuccess: (data: any) => {
      // Redirect to Zoho hosted payment page
      window.location.href = data.paymentPageUrl;
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unable to load subscription status.
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: 'default' as const, icon: CheckCircle, text: 'Active' },
      trial: { variant: 'secondary' as const, icon: Clock, text: 'Trial' },
      expired: { variant: 'destructive' as const, icon: AlertTriangle, text: 'Expired' },
      cancelled: { variant: 'destructive' as const, icon: AlertTriangle, text: 'Cancelled' },
      paused: { variant: 'secondary' as const, icon: AlertTriangle, text: 'Paused' },
      past_due: { variant: 'destructive' as const, icon: CreditCard, text: 'Past Due' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  const getPlanBadge = (plan: string) => {
    const planConfig = {
      free: { variant: 'outline' as const, text: 'Free Plan' },
      standard: { variant: 'default' as const, text: 'Standard Plan' },
      enterprise: { variant: 'default' as const, text: 'Enterprise Plan' }
    };

    const config = planConfig[plan as keyof typeof planConfig] || planConfig.free;

    return (
      <Badge variant={config.variant}>
        {config.text}
      </Badge>
    );
  };

  const getUsageColor = (current: number, limit: number) => {
    const percentage = (current / limit) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Subscription Status
                {getStatusBadge(status.status)}
              </CardTitle>
              <CardDescription>
                Current plan: {getPlanBadge(status.plan.code)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Trial Warning */}
          {status.status === 'trial' && status.trialEndsAt && (() => {
            const daysRemaining = Math.max(0, Math.ceil((new Date(status.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            return (
              <Alert className="mb-4">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Your trial expires in <strong>{daysRemaining} days</strong>.
                  {daysRemaining <= 3 && (
                    <Button asChild variant="link" className="p-0 h-auto ml-2">
                      <a href={`/org/${slug}/billing/upgrade`}>Upgrade now</a>
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            );
          })()}

          {/* Expired Status */}
          {['expired', 'cancelled'].includes(status.status) && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your subscription is {status.status}. 
                <Button 
                  variant="link" 
                  className="p-0 h-auto ml-2"
                  onClick={() => upgradeMutation.mutate('standard-plan-v1')}
                  disabled={upgradeMutation.isPending}
                >
                  {status.status === 'expired' ? 'Renew now' : 'Reactivate subscription'}
                </Button>
              </AlertDescription>
            </Alert>
          )}


          {/* Usage Limits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UsageCard
              title="Users"
              icon={Users}
              current={status.usage.users.current}
              limit={status.usage.users.limit}
              color={getUsageColor(status.usage.users.current, status.usage.users.limit)}
            />
            <UsageCard
              title="Vendors"
              icon={Building2}
              current={status.usage.vendors.current}
              limit={status.usage.vendors.limit}
              color={getUsageColor(status.usage.vendors.current, status.usage.vendors.limit)}
            />
            <UsageCard
              title="Monthly Orders"
              icon={ShoppingCart}
              current={status.usage.orders.current}
              limit={status.usage.orders.limit}
              color={getUsageColor(status.usage.orders.current, status.usage.orders.limit)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Plan Information */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
          <CardDescription>
            Your current subscription: {status.plan.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Plan</span>
              <span className="font-medium">{status.plan.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Price</span>
              <span className="font-medium">${status.plan.price}/{status.plan.interval}</span>
            </div>
            {status.nextBillingAt && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Next Billing</span>
                <span className="font-medium">{new Date(status.nextBillingAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Management</CardTitle>
          <CardDescription>
            All billing is managed securely through Zoho Billing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Upgrade Options */}
            <div>
              <h4 className="font-medium mb-2">Upgrade Your Plan</h4>
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={() => upgradeMutation.mutate('standard-plan-v1')}
                  disabled={upgradeMutation.isPending || status.plan.code === 'standard'}
                >
                  {status.plan.code === 'standard' ? 'Current Plan' : 'Upgrade to Standard'}
                </Button>
                <Button 
                  onClick={() => upgradeMutation.mutate('enterprise-plan-v1')}
                  disabled={upgradeMutation.isPending || status.plan.code === 'enterprise'}
                >
                  {status.plan.code === 'enterprise' ? 'Current Plan' : 'Upgrade to Enterprise'}
                </Button>
              </div>
            </div>

            {/* Billing Management */}
            <div>
              <h4 className="font-medium mb-2">Billing Management</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Access your customer portal to update payment methods, view invoices, download receipts, and manage your subscription.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-billing-portal"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Subscription & Payment Methods
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => invoicesMutation.mutate()}
                  disabled={invoicesMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-view-invoices"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  View Invoices and Billing History
                </Button>
              </div>
            </div>

            {/* Security Notice */}
            <div className="text-xs text-muted-foreground border-t pt-4">
              <p>🔒 All payments are processed securely through Zoho Billing.</p>
              <p>Your payment information is never stored on our servers.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsageCard({ title, icon: Icon, current, limit, color }: {
  title: string;
  icon: any;
  current: number;
  limit: number;
  color: string;
}) {
  const percentage = (current / limit) * 100;

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" />
        <h3 className="font-medium">{title}</h3>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{current} used</span>
          <span>{limit} limit</span>
        </div>
        <Progress value={percentage} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {limit - current} remaining
        </p>
      </div>
    </div>
  );
}

function formatFeatureName(feature: string): string {
  return feature
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
}
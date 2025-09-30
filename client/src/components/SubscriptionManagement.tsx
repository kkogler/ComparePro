import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar, 
  CreditCard, 
  Users, 
  Building, 
  ShoppingCart, 
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Receipt
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionData {
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

export default function SubscriptionManagement() {
  const { organizationSlug } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Get current subscription data
  const { data: subscription, isLoading } = useQuery<SubscriptionData>({
    queryKey: [`/org/${organizationSlug}/api/subscription`],
    enabled: !!organizationSlug,
  });

  // Get available plans for upgrade/downgrade
  const { data: availablePlans } = useQuery<any[]>({
    queryKey: [`/org/${organizationSlug}/api/subscription/plans`],
    enabled: !!organizationSlug,
  });

  // Plan change mutation
  const changePlanMutation = useMutation({
    mutationFn: async ({ planCode, changeType }: { planCode: string; changeType: 'upgrade' | 'downgrade' }) => {
      const response = await apiRequest(`/org/${organizationSlug}/api/subscription/change-plan`, 'POST', {
        planCode,
        changeType
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan Change Requested",
        description: "Your plan change has been processed. Changes will take effect according to your billing cycle.",
      });
      setSelectedPlan(null);
    },
    onError: (error) => {
      toast({
        title: "Plan Change Failed",
        description: error.message || "Failed to change plan. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Trial extension mutation
  const extendTrialMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/org/${organizationSlug}/api/subscription/extend-trial`, 'POST');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Trial Extended",
        description: "Your trial has been extended by 7 days.",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-200 h-64 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unable to load subscription information. Please contact support if this issue persists.
        </AlertDescription>
      </Alert>
    );
  }

  const isTrialActive = subscription.status === 'trial';
  const trialDaysLeft = subscription.trialEndsAt 
    ? Math.ceil((new Date(subscription.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const getUsagePercentage = (current: number, limit: number) => {
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 75) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Billing & Subscription</h2>
        {isTrialActive && trialDaysLeft > 0 && (
          <Badge variant={trialDaysLeft <= 3 ? "destructive" : "secondary"} className="text-sm">
            <Clock className="w-3 h-3 mr-1" />
            {trialDaysLeft} days left in trial
          </Badge>
        )}
      </div>

      {/* Trial Alert */}
      {isTrialActive && (
        <Alert className={trialDaysLeft <= 3 ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                Your trial expires in {trialDaysLeft} days. 
                {trialDaysLeft <= 3 && " Choose a plan now to avoid service interruption."}
              </span>
              {trialDaysLeft > 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => extendTrialMutation.mutate()}
                  disabled={extendTrialMutation.isPending}
                >
                  {extendTrialMutation.isPending ? "Extending..." : "Extend Trial"}
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{subscription.plan.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Managed by Zoho Billing
                </p>
              </div>
              <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                {subscription.status}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Next billing date</span>
                <span className="font-medium">
                  {new Date(subscription.nextBillingAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            {/* Billing Management Actions */}
            <div className="pt-4 border-t space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(`/org/${organizationSlug}/api/billing/customer-portal`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Subscription
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`/org/${organizationSlug}/api/billing/invoices`, '_blank')}
                >
                  <Receipt className="h-3 w-3 mr-1" />
                  Invoices
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`/org/${organizationSlug}/api/billing/payment-methods`, '_blank')}
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  Payment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Usage Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Users */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Users</span>
                </div>
                <span className={getUsageColor(getUsagePercentage(subscription.usage.users.current, subscription.usage.users.limit))}>
                  {subscription.usage.users.current} / {subscription.usage.users.limit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(subscription.usage.users.current, subscription.usage.users.limit)} 
                className="h-2"
              />
            </div>

            {/* Vendors */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  <span>Vendors</span>
                </div>
                <span className={getUsageColor(getUsagePercentage(subscription.usage.vendors.current, subscription.usage.vendors.limit))}>
                  {subscription.usage.vendors.current} / {subscription.usage.vendors.limit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(subscription.usage.vendors.current, subscription.usage.vendors.limit)} 
                className="h-2"
              />
            </div>

            {/* Orders */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span>Monthly Orders</span>
                </div>
                <span className={getUsageColor(getUsagePercentage(subscription.usage.orders.current, subscription.usage.orders.limit))}>
                  {subscription.usage.orders.current} / {subscription.usage.orders.limit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(subscription.usage.orders.current, subscription.usage.orders.limit)} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Plans */}
      {availablePlans && availablePlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
            <CardDescription>
              Upgrade or downgrade your plan to better fit your needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availablePlans.map((plan) => (
                <div
                  key={plan.code}
                  className={`p-4 border rounded-lg ${
                    plan.code === subscription.plan.code 
                      ? 'border-primary bg-primary/5' 
                      : 'border-gray-200 hover:border-primary'
                  }`}
                >
                  <div className="space-y-2">
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">View pricing in billing portal</p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• {plan.features.maxUsers} users</li>
                      <li>• {plan.features.maxVendors} vendors</li>
                      <li>• {plan.features.maxOrders} orders/month</li>
                      {plan.features.advancedAnalytics && <li>• Advanced analytics</li>}
                      {plan.features.apiAccess && <li>• API access</li>}
                    </ul>
                    
                    {plan.code !== subscription.plan.code && (
                      <Button
                        variant="default"
                        className="w-full mt-3"
                        onClick={() => {
                          changePlanMutation.mutate({ planCode: plan.code, changeType: 'upgrade' });
                        }}
                        disabled={changePlanMutation.isPending}
                      >
                        {changePlanMutation.isPending ? "Processing..." : "Change Plan"}
                      </Button>
                    )}
                    
                    {plan.code === subscription.plan.code && (
                      <Badge variant="default" className="w-full justify-center mt-3">
                        Current Plan
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
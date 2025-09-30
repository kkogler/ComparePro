import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar, 
  CreditCard, 
  ExternalLink,
  Receipt,
  X,
  ArrowLeft
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

interface SubscriptionData {
  id: string;
  plan: {
    name: string;
    code: string;
  };
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  nextBillingAt: string;
}

export default function BillingManagement() {
  const { organizationSlug } = useAuth();

  // Get current subscription data
  const { data: subscription, isLoading } = useQuery<SubscriptionData>({
    queryKey: [`/org/${organizationSlug}/api/subscription`],
    enabled: !!organizationSlug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading billing information...</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href={`/org/${organizationSlug}/`}>
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
            <p className="text-gray-600 mt-2">Manage your subscription and billing settings</p>
          </div>

          {/* Current Subscription */}
          <Card data-testid="card-current-subscription">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Current Subscription</span>
                {subscription && (
                  <Badge className={getStatusColor(subscription.status)}>
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription ? (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Plan</p>
                    <p className="text-lg font-semibold">{subscription.plan.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Next Billing Date</p>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>{new Date(subscription.nextBillingAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </>
              ) : (
                <Alert>
                  <AlertDescription>
                    No active subscription found.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Billing Actions */}
          <Card data-testid="card-billing-actions">
            <CardHeader>
              <CardTitle>Billing Management</CardTitle>
              <CardDescription>
                Access your customer portal to manage payment methods, view invoices, and update your subscription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <Button 
                  asChild 
                  className="w-full justify-start"
                  data-testid="button-customer-portal"
                >
                  <a href={`/org/${organizationSlug}/api/billing/customer-portal`} target="_blank">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Manage Subscription & Payment Methods
                    <ExternalLink className="w-4 h-4 ml-auto" />
                  </a>
                </Button>
                
                <Button 
                  asChild 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-view-invoices"
                >
                  <a href={`/org/${organizationSlug}/api/billing/invoices`} target="_blank">
                    <Receipt className="w-4 h-4 mr-2" />
                    View Invoices & Billing History
                    <ExternalLink className="w-4 h-4 ml-auto" />
                  </a>
                </Button>
              </div>
              
              <Alert>
                <AlertDescription>
                  These links will open your secure billing portal where you can safely change your subscription, 
                  update payment methods, cancel your subscription, or download invoices.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Subscription Changes */}
          <Card data-testid="card-subscription-changes">
            <CardHeader>
              <CardTitle className="text-red-700">Cancel Subscription</CardTitle>
              <CardDescription>
                Need to cancel your subscription? You can do this securely through your customer portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                asChild 
                variant="destructive" 
                className="w-full"
                data-testid="button-cancel-subscription"
              >
                <a href={`/org/${organizationSlug}/api/billing/customer-portal`} target="_blank">
                  <X className="w-4 h-4 mr-2" />
                  Cancel Subscription
                  <ExternalLink className="w-4 h-4 ml-auto" />
                </a>
              </Button>
              
              <Alert className="mt-4">
                <AlertDescription>
                  Cancellation will take effect at the end of your current billing period. 
                  Your data will remain accessible until then.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
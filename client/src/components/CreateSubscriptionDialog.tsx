import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

interface CreateSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
];

export function CreateSubscriptionDialog({ open, onOpenChange }: CreateSubscriptionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [formData, setFormData] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address1: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    timezone: 'America/New_York',
    retailVerticalId: '',
    plan: 'free',
    customerAccountNumber: ''
  });

  // Fetch retail verticals
  const { data: retailVerticals = [], isLoading: isLoadingVerticals, error: verticalsError } = useQuery<Array<{ id: number; name: string; slug: string }>>({
    queryKey: ['/api/admin/retail-verticals'],
    enabled: open
  });

  // Fetch plan settings
  const { data: planSettings = [], isLoading: isLoadingPlans, error: plansError } = useQuery<Array<{ 
    id: number; 
    planId: string; 
    planName: string;
    maxUsers: number | null;
    maxVendors: number | null;
  }>>({
    queryKey: ['/api/admin/plan-settings'],
    enabled: open
  });

  // Show loading state
  const isLoading = isLoadingVerticals || isLoadingPlans;
  
  // Show error if data fails to load
  if (open && (verticalsError || plansError)) {
    console.error('Failed to load form data:', { verticalsError, plansError });
  }

  // Create subscription mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest('/api/admin/subscriptions/create', 'POST', data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/organizations'] });
      
      const loginUrl = data?.company?.loginUrl || `Login credentials sent to ${formData.email}`;
      
      toast({
        title: 'Success',
        description: (
          <div className="space-y-2">
            <p>{data.message || 'Subscription created successfully'}</p>
            {data?.company?.loginUrl && (
              <p className="text-sm text-muted-foreground">
                Login URL: {data.company.loginUrl}
              </p>
            )}
            <p className="text-sm text-green-600 font-medium">
              ✓ Welcome email sent to {formData.email}
            </p>
          </div>
        ),
        duration: 10000,
      });
      
      // Reset form and close dialog
      setFormData({
        companyName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address1: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
        timezone: 'America/New_York',
        retailVerticalId: '',
        plan: 'free',
        customerAccountNumber: ''
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create subscription',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.companyName || !formData.firstName || !formData.lastName || !formData.email || !formData.retailVerticalId) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields (Company Name, First Name, Last Name, Email, Retail Vertical)',
        variant: 'destructive',
      });
      return;
    }
    
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Subscription</DialogTitle>
          <DialogDescription>
            Create a test subscription for development or manually onboard a new customer. 
            A welcome email with login credentials will be automatically sent.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading form data...</span>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Selection */}
          <div className="space-y-2">
            <Label htmlFor="plan">
              Plan <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.plan} 
              onValueChange={(value) => setFormData({ ...formData, plan: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {planSettings.length > 0 ? (
                  planSettings.map((plan) => (
                    <SelectItem key={plan.id} value={plan.planId}>
                      {plan.planName}
                      {plan.maxUsers && ` (${plan.maxUsers} users, ${plan.maxVendors || 0} vendors)`}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    No plans configured - Go to Admin &gt; Plan Settings
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Company Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Company Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="companyName">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="retailVertical">
                  Retail Vertical <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={formData.retailVerticalId} 
                  onValueChange={(value) => setFormData({ ...formData, retailVerticalId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vertical" />
                  </SelectTrigger>
                  <SelectContent>
                    {retailVerticals.map((vertical: any) => (
                      <SelectItem key={vertical.id} value={vertical.id.toString()}>
                        {vertical.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={formData.timezone} 
                  onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Admin User Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Admin User</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Store Address</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address1">Street Address</Label>
                <Input
                  id="address1"
                  value={formData.address1}
                  onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    maxLength={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Optional Fields */}
          <div className="space-y-2">
            <Label htmlFor="customerAccountNumber">
              Customer Account Number (Optional)
            </Label>
            <Input
              id="customerAccountNumber"
              value={formData.customerAccountNumber}
              onChange={(e) => setFormData({ ...formData, customerAccountNumber: e.target.value })}
              placeholder="Leave empty for auto-generation"
            />
            <p className="text-xs text-muted-foreground">
              For manual subscriptions, this is optional. Production subscriptions will use the Zoho Subscription ID.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {createMutation.isPending ? 'Creating...' : 'Create Subscription'}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}


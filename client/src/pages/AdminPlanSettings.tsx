import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Edit, 
  Users, 
  Building, 
  ShoppingCart, 
  FileText, 
  Webhook,
  Calendar,
  Infinity,
  DollarSign,
  Save
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PlanSettings {
  id: number;
  planId: string;
  planName: string;
  trialLengthDays: number | null;
  planLengthDays: number | null;
  maxUsers: number | null;
  maxVendors: number | null;
  onlineOrdering: boolean;
  asnProcessing: boolean;
  webhookExport: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const planSettingsSchema = z.object({
  planName: z.string().min(1, "Plan name is required"),
  trialLengthDays: z.number().nullable(),
  planLengthDays: z.number().nullable(),
  maxUsers: z.number().nullable(),
  maxVendors: z.number().nullable(),
  onlineOrdering: z.boolean(),
  asnProcessing: z.boolean(),
  webhookExport: z.boolean(),
});

type PlanSettingsForm = z.infer<typeof planSettingsSchema>;

function EditPlanDialog({ plan, onUpdate }: { plan: PlanSettings; onUpdate: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<PlanSettingsForm>({
    resolver: zodResolver(planSettingsSchema),
    defaultValues: {
      planName: plan.planName,
      trialLengthDays: plan.trialLengthDays,
      planLengthDays: plan.planLengthDays,
      maxUsers: plan.maxUsers,
      maxVendors: plan.maxVendors,
      onlineOrdering: plan.onlineOrdering,
      asnProcessing: plan.asnProcessing,
      webhookExport: plan.webhookExport,
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (data: PlanSettingsForm) => {
      const response = await apiRequest(`/api/admin/plan-settings/${plan.planId}`, 'PUT', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan updated successfully",
        description: `${plan.planName} plan settings have been updated.`,
      });
      onUpdate();
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error updating plan",
        description: error.message || "Failed to update plan settings",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PlanSettingsForm) => {
    updatePlanMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {plan.planName} Plan Settings</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="planName"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Plan Name</label>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="trialLengthDays"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Trial Length (Days)</label>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Leave empty for no trial"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="maxUsers"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Max Users</label>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Leave empty for unlimited"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="maxVendors"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Max Vendors</label>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Leave empty for unlimited"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Features</h4>
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="onlineOrdering"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <label className="text-sm font-medium">Online Ordering</label>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="asnProcessing"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <label className="text-sm font-medium">ASN Processing</label>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="webhookExport"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <label className="text-sm font-medium">Webhook/Export</label>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatePlanMutation.isPending}>
                {updatePlanMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPlanSettings() {
  const { toast } = useToast();

  const { data: planSettings, isLoading } = useQuery({
    queryKey: ['/api/admin/plan-settings'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/plan-settings', 'GET');
      return response.json();
    },
  });

  // Fetch admin settings for default pricing configuration
  const { data: adminSettings, isLoading: isLoadingAdmin } = useQuery({
    queryKey: ['/api/admin/settings'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/settings', 'GET');
      return response.json();
    },
  });

  // All state for pricing configuration
  const [defaultStrategy, setDefaultStrategy] = useState<string>('msrp');
  const [defaultMarkupPercentage, setDefaultMarkupPercentage] = useState<string>('');
  const [defaultMarginPercentage, setDefaultMarginPercentage] = useState<string>('');
  const [defaultPremiumAmount, setDefaultPremiumAmount] = useState<string>('');
  const [defaultDiscountPercentage, setDefaultDiscountPercentage] = useState<string>('');
  const [defaultRoundingRule, setDefaultRoundingRule] = useState<string>('none');
  const [defaultFallbackStrategy, setDefaultFallbackStrategy] = useState<string>('map');
  const [defaultFallbackMarkupPercentage, setDefaultFallbackMarkupPercentage] = useState<string>('');
  const [defaultUseCrossVendorFallback, setDefaultUseCrossVendorFallback] = useState<boolean>(false);

  // Update local state when admin settings load
  useEffect(() => {
    if (adminSettings) {
      setDefaultStrategy(adminSettings.defaultPricingStrategy || 'msrp');
      setDefaultMarkupPercentage(adminSettings.defaultPricingMarkupPercentage || '');
      setDefaultMarginPercentage(adminSettings.defaultPricingMarginPercentage || '');
      setDefaultPremiumAmount(adminSettings.defaultPricingPremiumAmount || '');
      setDefaultDiscountPercentage(adminSettings.defaultPricingDiscountPercentage || '');
      setDefaultRoundingRule(adminSettings.defaultPricingRoundingRule || 'none');
      setDefaultFallbackStrategy(adminSettings.defaultPricingFallbackStrategy || 'map');
      setDefaultFallbackMarkupPercentage(adminSettings.defaultPricingFallbackMarkupPercentage || '');
      setDefaultUseCrossVendorFallback(adminSettings.defaultPricingUseCrossVendorFallback || false);
    }
  }, [adminSettings]);

  const updateDefaultPricingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/admin/settings', 'PATCH', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Default pricing updated",
        description: "The default pricing rule for new subscriptions has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating settings",
        description: error.message || "Failed to update default pricing configuration",
        variant: "destructive",
      });
    },
  });

  const handleSaveDefaultPricing = () => {
    updateDefaultPricingMutation.mutate({
      defaultPricingStrategy: defaultStrategy,
      defaultPricingMarkupPercentage: defaultMarkupPercentage || null,
      defaultPricingMarginPercentage: defaultMarginPercentage || null,
      defaultPricingPremiumAmount: defaultPremiumAmount || null,
      defaultPricingDiscountPercentage: defaultDiscountPercentage || null,
      defaultPricingRoundingRule: defaultRoundingRule,
      defaultPricingFallbackStrategy: defaultFallbackStrategy,
      defaultPricingFallbackMarkupPercentage: defaultFallbackMarkupPercentage || null,
      defaultPricingUseCrossVendorFallback: defaultUseCrossVendorFallback,
    });
  };

  const refetchData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/plan-settings'] });
  };

  const formatLimit = (value: number | null, icon: React.ReactNode) => {
    if (value === null) {
      return (
        <div className="flex items-center text-blue-600">
          <Infinity className="h-4 w-4 mr-1" />
          Unlimited
        </div>
      );
    }
    return (
      <div className="flex items-center">
        {icon}
        <span className="ml-1">{value}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading plan settings...</p>
        </div>
      </div>
    );
  }

  const strategyOptions = [
    { value: 'msrp', label: 'Use MSRP (Manufacturer\'s Suggested Retail Price)' },
    { value: 'map', label: 'Use MAP (Minimum Advertised Price)' },
    { value: 'cost_markup', label: 'Cost + Markup %' },
    { value: 'cost_margin', label: 'Cost + Target Margin %' },
    { value: 'map_premium', label: 'MAP + Premium Amount' },
    { value: 'msrp_discount', label: 'MSRP - Discount %' },
  ];

  const fallbackOptions = [
    { value: 'none', label: 'None (No fallback)' },
    { value: 'map', label: 'MAP (Minimum Advertised Price)' },
    { value: 'msrp', label: 'MSRP (Manufacturer\'s Suggested Retail Price)' },
    { value: 'cost_markup', label: 'Cost + Markup %' },
    { value: 'cost_margin', label: 'Cost + Target Margin %' },
  ];

  const roundingRuleOptions = [
    { value: 'none', label: 'No Rounding', description: 'Keep exact calculated price' },
    { value: 'up_99', label: 'Round Up to .99', description: 'Example: $24.67 → $24.99' },
    { value: 'down_99', label: 'Round Down to .99', description: 'Example: $24.67 → $23.99' },
    { value: 'up_95', label: 'Round Up to .95', description: 'Example: $24.67 → $24.95' },
    { value: 'down_95', label: 'Round Down to .95', description: 'Example: $24.67 → $23.95' },
    { value: 'up_10cent', label: 'Round Up to Nearest 10¢', description: 'Example: $24.67 → $24.70' },
    { value: 'down_10cent', label: 'Round Down to Nearest 10¢', description: 'Example: $24.67 → $24.60' },
    { value: 'nearest_dollar', label: 'Round to Closest $1', description: 'Example: $24.67 → $25.00' },
    { value: 'up_dollar', label: 'Round Up to $1', description: 'Example: $24.67 → $25.00' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plan Settings</h1>
          <p className="text-muted-foreground">
            Manage subscription plan features and limits
          </p>
        </div>
      </div>

      {/* Subscription Plan Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Subscription Plan Configuration
          </CardTitle>
          <CardDescription>
            Configure features and limits for each subscription plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Trial Length</TableHead>
                <TableHead>Max Users</TableHead>
                <TableHead>Max Vendors</TableHead>
                <TableHead>Online Ordering</TableHead>
                <TableHead>ASN</TableHead>
                <TableHead>Webhook/Export</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planSettings?.map((plan: PlanSettings) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{plan.planName}</div>
                      <div className="text-sm text-gray-500">{plan.planId}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {plan.trialLengthDays ? (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-blue-500" />
                        {plan.trialLengthDays} days
                      </div>
                    ) : (
                      <span className="text-gray-500">No trial</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatLimit(plan.maxUsers, <Users className="h-4 w-4 text-green-500" />)}
                  </TableCell>
                  <TableCell>
                    {formatLimit(plan.maxVendors, <Building className="h-4 w-4 text-purple-500" />)}
                  </TableCell>
                  <TableCell>
                    {plan.onlineOrdering ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {plan.asnProcessing ? (
                      <Badge variant="default" className="bg-blue-100 text-blue-800">
                        <FileText className="h-3 w-3 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {plan.webhookExport ? (
                      <Badge variant="default" className="bg-orange-100 text-orange-800">
                        <Webhook className="h-3 w-3 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <EditPlanDialog plan={plan} onUpdate={refetchData} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Default Pricing Configuration for New Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Default Pricing Rule for New Subscriptions
          </CardTitle>
          <CardDescription>
            Configure the default pricing strategy that will be applied to all new subscriptions (manual or via Zoho Billing)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary Strategy */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="primary-strategy" className="text-base font-semibold">Primary Pricing Strategy</Label>
              <p className="text-sm text-muted-foreground mb-2">Choose how retail prices should be calculated</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="primary-strategy">Strategy</Label>
              <Select value={defaultStrategy} onValueChange={setDefaultStrategy}>
                <SelectTrigger id="primary-strategy">
                  <SelectValue placeholder="Select primary strategy" />
                </SelectTrigger>
                <SelectContent>
                  {strategyOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Strategy-specific fields */}
            {defaultStrategy === 'cost_markup' && (
              <div className="space-y-2">
                <Label htmlFor="markup-percentage">Markup Percentage</Label>
                <Input
                  id="markup-percentage"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 25.50 for 25.5%"
                  value={defaultMarkupPercentage}
                  onChange={(e) => setDefaultMarkupPercentage(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Retail Price = Cost × (1 + Markup%). Example: Cost $10 + 25% = $12.50
                </p>
              </div>
            )}

            {defaultStrategy === 'cost_margin' && (
              <div className="space-y-2">
                <Label htmlFor="margin-percentage">Target Margin Percentage</Label>
                <Input
                  id="margin-percentage"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 20.00 for 20% margin"
                  value={defaultMarginPercentage}
                  onChange={(e) => setDefaultMarginPercentage(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Retail Price = Cost ÷ (1 - Margin%). Example: Cost $10 ÷ (1 - 0.20) = $12.50
                </p>
              </div>
            )}

            {defaultStrategy === 'map_premium' && (
              <div className="space-y-2">
                <Label htmlFor="premium-amount">Premium Amount ($)</Label>
                <Input
                  id="premium-amount"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 5.00 for +$5.00"
                  value={defaultPremiumAmount}
                  onChange={(e) => setDefaultPremiumAmount(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Retail Price = MAP + Premium Amount. Example: MAP $25.00 + $5.00 = $30.00
                </p>
              </div>
            )}

            {defaultStrategy === 'msrp_discount' && (
              <div className="space-y-2">
                <Label htmlFor="discount-percentage">Discount Percentage</Label>
                <Input
                  id="discount-percentage"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 10.00 for 10% off"
                  value={defaultDiscountPercentage}
                  onChange={(e) => setDefaultDiscountPercentage(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Retail Price = MSRP × (1 - Discount%). Example: MSRP $30.00 × (1 - 0.10) = $27.00
                </p>
              </div>
            )}

            {/* Cross-vendor fallback for MAP/MSRP strategies */}
            {(defaultStrategy === 'map' || defaultStrategy === 'msrp' || defaultStrategy === 'map_premium' || defaultStrategy === 'msrp_discount') && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">
                    Use Cross-Vendor {defaultStrategy === 'map' || defaultStrategy === 'map_premium' ? 'MAP' : 'MSRP'} Fallback
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    If the selected vendor doesn't provide {defaultStrategy === 'map' || defaultStrategy === 'map_premium' ? 'MAP' : 'MSRP'}, use the highest {defaultStrategy === 'map' || defaultStrategy === 'map_premium' ? 'MAP' : 'MSRP'} from other vendors.
                  </p>
                </div>
                <Switch
                  checked={defaultUseCrossVendorFallback}
                  onCheckedChange={setDefaultUseCrossVendorFallback}
                />
              </div>
            )}
          </div>

          {/* Fallback Strategy */}
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label className="text-base font-semibold">Fallback Strategy</Label>
              <p className="text-sm text-muted-foreground mb-2">What to do when primary pricing data is not available</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fallback-strategy">Fallback Strategy (Optional)</Label>
              <Select value={defaultFallbackStrategy} onValueChange={setDefaultFallbackStrategy}>
                <SelectTrigger id="fallback-strategy">
                  <SelectValue placeholder="Select fallback strategy" />
                </SelectTrigger>
                <SelectContent>
                  {fallbackOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(defaultFallbackStrategy === 'cost_markup' || defaultFallbackStrategy === 'cost_margin') && (
              <div className="space-y-2">
                <Label htmlFor="fallback-markup">Fallback Markup Percentage</Label>
                <Input
                  id="fallback-markup"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 50.00 for 50%"
                  value={defaultFallbackMarkupPercentage}
                  onChange={(e) => setDefaultFallbackMarkupPercentage(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Used when primary strategy fails but cost data is available
                </p>
              </div>
            )}
          </div>

          {/* Rounding Rules */}
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label className="text-base font-semibold">Rounding Rules</Label>
              <p className="text-sm text-muted-foreground mb-2">Apply rounding to final calculated prices</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rounding-rule">Rounding Rule</Label>
              <Select value={defaultRoundingRule} onValueChange={setDefaultRoundingRule}>
                <SelectTrigger id="rounding-rule">
                  <SelectValue placeholder="Select rounding rule" />
                </SelectTrigger>
                <SelectContent>
                  {roundingRuleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="space-y-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {defaultRoundingRule !== 'none' && (
              <div className="p-3 bg-blue-50 rounded-lg border">
                <p className="text-sm text-blue-800">
                  <strong>Example:</strong> A calculated price of $24.67 would become{' '}
                  {defaultRoundingRule === 'up_99' && '$24.99'}
                  {defaultRoundingRule === 'down_99' && '$23.99'}
                  {defaultRoundingRule === 'up_95' && '$24.95'}
                  {defaultRoundingRule === 'down_95' && '$23.95'}
                  {defaultRoundingRule === 'up_10cent' && '$24.70'}
                  {defaultRoundingRule === 'down_10cent' && '$24.60'}
                  {defaultRoundingRule === 'nearest_dollar' && '$25.00'}
                  {defaultRoundingRule === 'up_dollar' && '$25.00'}
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end">
            <Button 
              onClick={handleSaveDefaultPricing}
              disabled={updateDefaultPricingMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateDefaultPricingMutation.isPending ? 'Saving...' : 'Save Default Pricing'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
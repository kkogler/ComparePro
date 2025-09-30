import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit, DollarSign, Percent, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { PricingConfiguration } from "@shared/schema";

// Pricing configuration form schema
const pricingConfigSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  strategy: z.enum(['map', 'msrp', 'cost_markup', 'cost_margin', 'map_premium', 'msrp_discount']),
  markupPercentage: z.string().optional(),
  marginPercentage: z.string().optional(), 
  premiumAmount: z.string().optional(),
  discountPercentage: z.string().optional(),
  roundingRule: z.enum(['none', 'up_99', 'down_99', 'up_95', 'down_95', 'up_10cent', 'down_10cent', 'nearest_dollar', 'up_dollar']).default('none'),
  roundingAmount: z.string().optional(),
  fallbackStrategy: z.enum(['none', 'map', 'msrp', 'cost_markup', 'cost_margin']).optional(),
  fallbackMarkupPercentage: z.string().optional(),
  useCrossVendorFallback: z.boolean().default(false),
});

type PricingConfigFormData = z.infer<typeof pricingConfigSchema>;

const strategyOptions = [
  { value: 'map', label: 'Use MAP (Minimum Advertised Price)', icon: DollarSign },
  { value: 'msrp', label: 'Use MSRP (Manufacturer\'s Suggested Retail Price)', icon: DollarSign },
  { value: 'cost_markup', label: 'Cost + Markup %', icon: Percent },
  { value: 'cost_margin', label: 'Cost + Target Margin %', icon: Calculator },
  { value: 'map_premium', label: 'MAP + Premium Amount', icon: Plus },
  { value: 'msrp_discount', label: 'MSRP - Discount %', icon: Percent },
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

interface PricingConfigDialogProps {
  config?: PricingConfiguration;
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

function PricingConfigDialog({ config, trigger, onSuccess }: PricingConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { organizationSlug } = useAuth();

  const form = useForm<PricingConfigFormData>({
    resolver: zodResolver(pricingConfigSchema),
    defaultValues: {
      name: config?.name || '',
      description: config?.description || '',
      isDefault: config?.isDefault || false,
      isActive: config?.isActive !== false,
      strategy: config?.strategy as any || 'map',
      markupPercentage: config?.markupPercentage?.toString() || '',
      marginPercentage: config?.marginPercentage?.toString() || '',
      premiumAmount: config?.premiumAmount?.toString() || '',
      discountPercentage: config?.discountPercentage?.toString() || '',
      roundingRule: config?.roundingRule as any || 'none',
      roundingAmount: config?.roundingAmount?.toString() || '',
      fallbackStrategy: config?.fallbackStrategy as any || undefined,
      fallbackMarkupPercentage: config?.fallbackMarkupPercentage?.toString() || '',
      useCrossVendorFallback: config?.useCrossVendorFallback || false,
    }
  });

  const watchStrategy = form.watch('strategy');
  const watchRoundingRule = form.watch('roundingRule');

  const createMutation = useMutation({
    mutationFn: async (data: PricingConfigFormData) => {
      const endpoint = config ? 
        `/org/${organizationSlug}/api/pricing-configurations/${config.id}` :
        `/org/${organizationSlug}/api/pricing-configurations`;
      
      const response = await apiRequest(endpoint, config ? 'PATCH' : 'POST', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/pricing-configurations`] });
      toast({
        title: "Success",
        description: `Pricing configuration ${config ? 'updated' : 'created'} successfully.`
      });
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save pricing configuration.",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: PricingConfigFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {config ? 'Edit Pricing Configuration' : 'Create Pricing Configuration'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-pricing-config">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Configuration Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Default Retail Pricing" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe when this configuration should be used..." {...field} data-testid="textarea-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center space-x-6">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Active</FormLabel>
                          <FormDescription>Enable this configuration</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-active" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Default</FormLabel>
                          <FormDescription>Use as company default</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-default" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing Strategy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pricing Strategy</CardTitle>
                <CardDescription>Choose how retail prices should be calculated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="strategy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Strategy</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-strategy">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select pricing strategy" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {strategyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <option.icon className="w-4 h-4" />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Strategy-specific fields */}
                {watchStrategy === 'cost_markup' && (
                  <FormField
                    control={form.control}
                    name="markupPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Markup Percentage</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="e.g., 25.50 for 25.5%" 
                            {...field} 
                            data-testid="input-markup-percentage"
                          />
                        </FormControl>
                        <FormDescription>
                          Retail Price = Cost × (1 + Markup%). Example: Cost $10 + 25% = $12.50
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchStrategy === 'cost_margin' && (
                  <FormField
                    control={form.control}
                    name="marginPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Margin Percentage</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="e.g., 20.00 for 20% margin" 
                            {...field}
                            data-testid="input-margin-percentage"
                          />
                        </FormControl>
                        <FormDescription>
                          Retail Price = Cost ÷ (1 - Margin%). Example: Cost $10 ÷ (1 - 0.20) = $12.50
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchStrategy === 'map_premium' && (
                  <FormField
                    control={form.control}
                    name="premiumAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Premium Amount ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="e.g., 5.00 for +$5.00" 
                            {...field}
                            data-testid="input-premium-amount"
                          />
                        </FormControl>
                        <FormDescription>
                          Retail Price = MAP + Premium Amount. Example: MAP $25.00 + $5.00 = $30.00
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchStrategy === 'msrp_discount' && (
                  <FormField
                    control={form.control}
                    name="discountPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount Percentage</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="e.g., 10.00 for 10% off" 
                            {...field}
                            data-testid="input-discount-percentage"
                          />
                        </FormControl>
                        <FormDescription>
                          Retail Price = MSRP × (1 - Discount%). Example: MSRP $30.00 × (1 - 0.10) = $27.00
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Cross-vendor fallback for MAP/MSRP strategies */}
                {(watchStrategy === 'map' || watchStrategy === 'msrp' || watchStrategy === 'map_premium' || watchStrategy === 'msrp_discount') && (
                  <FormField
                    control={form.control}
                    name="useCrossVendorFallback"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Use Cross-Vendor {watchStrategy === 'map' || watchStrategy === 'map_premium' ? 'MAP' : 'MSRP'} Fallback
                          </FormLabel>
                          <FormDescription>
                            If the selected vendor doesn't provide {watchStrategy === 'map' || watchStrategy === 'map_premium' ? 'MAP' : 'MSRP'}, 
                            use the highest {watchStrategy === 'map' || watchStrategy === 'map_premium' ? 'MAP' : 'MSRP'} from other vendors in the price comparison.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-cross-vendor-fallback"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Fallback Strategy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fallback Strategy</CardTitle>
                <CardDescription>What to do when primary pricing data is not available</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="fallbackStrategy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fallback Strategy (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} data-testid="select-fallback-strategy">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select fallback strategy" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None - Skip if primary data unavailable</SelectItem>
                          <SelectItem value="map">Use MAP if available</SelectItem>
                          <SelectItem value="msrp">Use MSRP if available</SelectItem>
                          <SelectItem value="cost_markup">Use Cost + Markup</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(form.watch('fallbackStrategy') === 'cost_markup') && (
                  <FormField
                    control={form.control}
                    name="fallbackMarkupPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fallback Markup Percentage</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="e.g., 50.00 for 50%" 
                            {...field}
                            data-testid="input-fallback-markup"
                          />
                        </FormControl>
                        <FormDescription>
                          Used when primary strategy fails but cost data is available
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Rounding Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rounding Rules</CardTitle>
                <CardDescription>Apply rounding to final calculated prices from both pricing and fallback strategies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="roundingRule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rounding Rule</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-rounding-rule">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select rounding rule" />
                          </SelectTrigger>
                        </FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchRoundingRule !== 'none' && (
                  <div className="p-3 bg-blue-50 rounded-lg border">
                    <p className="text-sm text-blue-800">
                      <strong>Example:</strong> A calculated price of $24.67 would become{' '}
                      {watchRoundingRule === 'up_99' && '$24.99'}
                      {watchRoundingRule === 'down_99' && '$23.99'}
                      {watchRoundingRule === 'up_95' && '$24.95'}
                      {watchRoundingRule === 'down_95' && '$23.95'}
                      {watchRoundingRule === 'up_10cent' && '$24.70'}
                      {watchRoundingRule === 'down_10cent' && '$24.60'}
                      {watchRoundingRule === 'nearest_dollar' && '$25.00'}
                      {watchRoundingRule === 'up_dollar' && '$25.00'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                data-testid="button-save"
              >
                {createMutation.isPending ? 'Saving...' : config ? 'Update Configuration' : 'Create Configuration'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function PricingConfiguration() {
  const { organizationSlug } = useAuth();
  const { toast } = useToast();

  const { data: configurations, isLoading } = useQuery({
    queryKey: [`/org/${organizationSlug}/api/pricing-configurations`],
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (configId: number) => {
      return apiRequest(`/org/${organizationSlug}/api/pricing-configurations/${configId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/pricing-configurations`] });
      toast({
        title: "Success",
        description: "Pricing configuration deleted successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete pricing configuration.",
        variant: "destructive"
      });
    }
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (configId: number) => {
      return apiRequest(`/org/${organizationSlug}/api/pricing-configurations/${configId}/set-default`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/pricing-configurations`] });
      toast({
        title: "Success",
        description: "Default pricing configuration updated."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set default configuration.",
        variant: "destructive"
      });
    }
  });

  const getStrategyLabel = (strategy: string) => {
    return strategyOptions.find(opt => opt.value === strategy)?.label || strategy;
  };

  const getRoundingLabel = (rule: string) => {
    return roundingRuleOptions.find(opt => opt.value === rule)?.label || rule;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-pricing">Pricing Rules</h1>
        </div>
        <PricingConfigDialog 
          trigger={
            <Button data-testid="button-create-config">
              <Plus className="w-4 h-4 mr-2" />
              New Configuration
            </Button>
          }
        />
      </div>

      {/* Informational Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 text-sm leading-relaxed">
          When exporting or syncing product information for use with other applications, many applications require a product price.
          <br /><br />
          If available, the system will use the MSRP or MAP from the vendor. But if this suggested price is not available from the vendor, the system will create a 'price' for the product based on the pricing rule configured below. This can be based on a mark up over cost or a targeted gross margin.
        </p>
      </div>

      {/* Configurations List */}
      <div className="grid gap-4">
        {!configurations || !Array.isArray(configurations) || configurations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <DollarSign className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pricing configurations</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first pricing configuration to generate retail prices for webhook data.
              </p>
              <PricingConfigDialog 
                trigger={
                  <Button data-testid="button-create-first-config">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Configuration
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          Array.isArray(configurations) && configurations.map((config: PricingConfiguration) => (
            <Card key={config.id} className="relative" data-testid={`card-config-${config.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl">{config.name}</CardTitle>
                    <div className="flex gap-2">
                      {config.isDefault && (
                        <Badge variant="default" data-testid={`badge-default-${config.id}`}>Default</Badge>
                      )}
                      {!config.isActive && (
                        <Badge variant="secondary" data-testid={`badge-inactive-${config.id}`}>Inactive</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!config.isDefault && config.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(config.id)}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`button-set-default-${config.id}`}
                      >
                        Set as Default
                      </Button>
                    )}
                    <PricingConfigDialog 
                      config={config}
                      trigger={
                        <Button 
                          variant="default" 
                          size="default" 
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
                          data-testid={`button-edit-${config.id}`}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Rule
                        </Button>
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(config.id)}
                      disabled={deleteMutation.isPending || (config.isDefault ?? false)}
                      data-testid={`button-delete-${config.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {config.description && (
                  <CardDescription>{config.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground">STRATEGY</h4>
                    <p className="mt-1">{getStrategyLabel(config.strategy)}</p>
                    {config.strategy === 'cost_markup' && config.markupPercentage && (
                      <p className="text-sm text-muted-foreground">+{config.markupPercentage}%</p>
                    )}
                    {config.strategy === 'cost_margin' && config.marginPercentage && (
                      <p className="text-sm text-muted-foreground">{config.marginPercentage}% margin</p>
                    )}
                    {config.strategy === 'map_premium' && config.premiumAmount && (
                      <p className="text-sm text-muted-foreground">+${config.premiumAmount}</p>
                    )}
                    {config.strategy === 'msrp_discount' && config.discountPercentage && (
                      <p className="text-sm text-muted-foreground">-{config.discountPercentage}%</p>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground">ROUNDING</h4>
                    <p className="mt-1">{getRoundingLabel(config.roundingRule)}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground">FALLBACK</h4>
                    <p className="mt-1">
                      {config.fallbackStrategy ? getStrategyLabel(config.fallbackStrategy) : 'None'}
                    </p>
                    {config.fallbackStrategy === 'cost_markup' && config.fallbackMarkupPercentage && (
                      <p className="text-sm text-muted-foreground">+{config.fallbackMarkupPercentage}%</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
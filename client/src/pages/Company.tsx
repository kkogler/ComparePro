import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Save, Copy, Upload, X, Clock, CheckCircle, Eye, EyeOff, Server, RefreshCw, Building2, Network } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { UserSettings } from "@/lib/types";

// Common timezones for business use
const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "America/Toronto", label: "Eastern Time - Canada" },
  { value: "America/Vancouver", label: "Pacific Time - Canada" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
  { value: "Europe/Berlin", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
];

// Common currencies
const currencies = [
  { value: "USD", label: "US Dollar (USD)" },
  { value: "CAD", label: "Canadian Dollar (CAD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "British Pound (GBP)" },
  { value: "JPY", label: "Japanese Yen (JPY)" },
  { value: "AUD", label: "Australian Dollar (AUD)" },
];

const companySchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyEmail: z.string().email("Must be a valid email").optional().or(z.literal("")),
  companyPhone: z.string().optional(),
  retailVerticalId: z.number().min(1, "Retail vertical is required"),
  storeAddress1: z.string().optional(),
  storeAddress2: z.string().optional(),
  storeCity: z.string().optional(),
  storeState: z.string().optional(),
  storeZipCode: z.string().optional(),
  defaultTimezone: z.string().min(1, "Timezone is required"),
  currency: z.string().min(1, "Currency is required"),
});

const integrationsSchema = z.object({
  microbizEndpoint: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  microbizApiKey: z.string().optional(),
  microbizEnabled: z.boolean().optional(),
  showVendorCosts: z.boolean(),
});

const billHicksSchema = z.object({
  ftpServer: z.string().min(1, "FTP server is required"),
  ftpUsername: z.string().min(1, "FTP username is required"),
  ftpPassword: z.string().min(1, "FTP password is required"),
  catalogSyncEnabled: z.boolean().optional(),
  inventorySyncEnabled: z.boolean().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;
type IntegrationsFormData = z.infer<typeof integrationsSchema>;
type BillHicksFormData = z.infer<typeof billHicksSchema>;

export default function Company() {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showBillHicksPassword, setShowBillHicksPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationSlug } = useAuth();

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: [`/org/${organizationSlug}/api/settings`],
    staleTime: 60000, // 1 minute
    enabled: !!organizationSlug
  });

  // Get organization data
  const { data: organization } = useQuery<{name: string, email?: string, phone?: string, logoUrl?: string, billingSubscriptionId?: string, billingProvider?: string, retailVerticalId?: number, settings?: {timezone: string, currency: string}}>({
    queryKey: [`/org/${organizationSlug}/api/organization`],
    staleTime: 60000, // 1 minute
    enabled: !!organizationSlug
  });

  // Get retail verticals for selection
  const { data: retailVerticals = [] } = useQuery<{id: number, name: string, slug: string, description?: string, isActive: boolean}[]>({
    queryKey: [`/org/${organizationSlug}/api/retail-verticals`],
    staleTime: 300000, // 5 minutes
  });

  // Fetch supported vendors to get accurate count
  const { data: supportedVendors = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/supported-vendors'],
    staleTime: 300000, // 5 minutes
  });

  // Bill Hicks vendor credentials
  const { data: billHicksCredentials, refetch: refetchBillHicksCredentials } = useQuery<{
    exists: boolean;
    credentials: {
      ftpServer: string;
      ftpUsername: string;
      catalogSyncEnabled: boolean;
      inventorySyncEnabled: boolean;
      catalogSyncStatus: string;
      inventorySyncStatus: string;
      lastCatalogRecordsCreated: number;
      lastCatalogRecordsUpdated: number;
      lastInventoryRecordsUpdated: number;
      lastCatalogSync: string;
      lastInventorySync: string;
    } | null;
  }>({
    queryKey: [`/org/${organizationSlug}/api/vendor-credentials/bill-hicks`],
    staleTime: 30000, // 30 seconds
    enabled: !!organizationSlug
  });

  // Bill Hicks sync statistics
  const { data: billHicksStats } = useQuery<{
    vendorMappings: number;
    inventoryRecords: number;
  }>({
    queryKey: [`/org/${organizationSlug}/api/vendor-credentials/bill-hicks/stats`],
    staleTime: 30000, // 30 seconds
    enabled: !!organizationSlug
  });

  console.log('Company page data:', { settings, organization, organizationSlug });

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyName: "",
      companyEmail: "",
      companyPhone: "",
      retailVerticalId: 1,
      storeAddress1: "",
      storeAddress2: "",
      storeCity: "",
      storeState: "",
      storeZipCode: "",
      defaultTimezone: "America/New_York",
      currency: "USD",
    },
  });

  const integrationsForm = useForm<IntegrationsFormData>({
    resolver: zodResolver(integrationsSchema),
    defaultValues: {
      microbizEndpoint: "",
      microbizApiKey: "",
      microbizEnabled: false,
      showVendorCosts: true,
    },
  });

  const billHicksForm = useForm<BillHicksFormData>({
    resolver: zodResolver(billHicksSchema),
    defaultValues: {
      ftpServer: "",
      ftpUsername: "",
      ftpPassword: "",
      catalogSyncEnabled: true,
      inventorySyncEnabled: true,
    },
  });

  // Update forms when data loads
  useEffect(() => {
    if (organization) {
      console.log('Updating form with company data:', organization);
      const formData = {
        companyName: organization.name || "",
        companyEmail: organization.email || "",
        companyPhone: organization.phone || "",
        retailVerticalId: organization.retailVerticalId || 1,
        storeAddress1: settings?.storeAddress1 || "",
        storeAddress2: settings?.storeAddress2 || "",
        storeCity: settings?.storeCity || "",
        storeState: settings?.storeState || "",
        storeZipCode: settings?.storeZipCode || "",
        defaultTimezone: organization.settings?.timezone || "America/New_York",
        currency: organization.settings?.currency || "USD",
      };
      console.log('Form data being set:', formData);
      form.reset(formData);
    }
  }, [settings, organization, form]);

  useEffect(() => {
    if (settings) {
      integrationsForm.reset({
        microbizEndpoint: settings.microbizEndpoint || "",
        microbizApiKey: settings.microbizApiKey || "",
        microbizEnabled: settings.microbizEnabled || false,
        showVendorCosts: settings.showVendorCosts ?? true,
      });
    }
  }, [settings, integrationsForm]);

  useEffect(() => {
    if (billHicksCredentials?.exists && billHicksCredentials.credentials) {
      billHicksForm.reset({
        ftpServer: billHicksCredentials.credentials.ftpServer || "",
        ftpUsername: billHicksCredentials.credentials.ftpUsername || "",
        ftpPassword: "", // Always start empty for security
        catalogSyncEnabled: billHicksCredentials.credentials.catalogSyncEnabled,
        inventorySyncEnabled: billHicksCredentials.credentials.inventorySyncEnabled,
      });
    }
  }, [billHicksCredentials, billHicksForm]);

  const mutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const settingsPayload = {
        storeAddress1: data.storeAddress1 || "",
        storeAddress2: data.storeAddress2 || "",
        storeCity: data.storeCity || "",
        storeState: data.storeState || "",
        storeZipCode: data.storeZipCode || "",
      };
      
      const organizationPayload = {
        name: data.companyName,
        email: data.companyEmail,
        phone: data.companyPhone,
        retailVerticalId: data.retailVerticalId,
        settings: {
          timezone: data.defaultTimezone,
          currency: data.currency,
        },
      };

      // Update settings first
      await apiRequest(`/org/${organizationSlug}/api/settings`, 'PATCH', settingsPayload);
      
      // Then update organization
      await apiRequest(`/org/${organizationSlug}/api/organization`, 'PATCH', organizationPayload);
      
      return { settings: settingsPayload, organization: organizationPayload };
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "Company information has been successfully updated.",
      });
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/settings`] });
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/organization`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    }
  });

  const updateIntegrationsMutation = useMutation({
    mutationFn: async (data: IntegrationsFormData) => {
      const response = await apiRequest(`/org/${organizationSlug}/api/settings`, 'PATCH', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/settings`] });
      toast({
        title: "Success",
        description: "Integration settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to save integration settings",
        variant: "destructive",
      });
    }
  });

  const updateBillHicksMutation = useMutation({
    mutationFn: async (data: BillHicksFormData) => {
      const response = await apiRequest(`/org/${organizationSlug}/api/vendor-credentials/bill-hicks`, 'POST', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/vendor-credentials/bill-hicks`] });
      toast({
        title: "Success",
        description: "Bill Hicks credentials saved successfully",
      });
      billHicksForm.setValue('ftpPassword', ''); // Clear password field
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save Bill Hicks credentials",
        variant: "destructive",
      });
    }
  });

  const syncBillHicksMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/org/${organizationSlug}/api/vendor-credentials/bill-hicks/sync`, 'POST', {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/vendor-credentials/bill-hicks`] });
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/vendor-credentials/bill-hicks/stats`] });
      toast({
        title: "Success",
        description: "Bill Hicks sync started successfully. Check sync status for progress.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start Bill Hicks sync",
        variant: "destructive",
      });
    }
  });

  const onSubmit = async (data: CompanyFormData) => {
    try {
      // First update company data
      await mutation.mutateAsync(data);
      
      // Then handle logo upload if a new logo was selected
      if (selectedLogo) {
        setUploadingLogo(true);
        const formData = new FormData();
        formData.append('logo', selectedLogo);
        
        try {
          await apiRequest(`/org/${organizationSlug}/api/organization/upload-logo`, 'POST', formData);
          toast({
            title: "Success",
            description: "Company information and logo updated successfully.",
          });
        } catch (error: any) {
          toast({
            title: "Partial success",
            description: "Company info saved, but logo upload failed: " + (error.message || "Unknown error"),
            variant: "destructive",
          });
        } finally {
          setUploadingLogo(false);
          setSelectedLogo(null);
        }
      }
      
      // Refresh the organization data
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/organization`] });
    } catch (error: any) {
      // Error handling is already done by the mutation
    }
  };

  const onIntegrationsSubmit = (data: IntegrationsFormData) => {
    updateIntegrationsMutation.mutate(data);
  };

  const onBillHicksSubmit = (data: BillHicksFormData) => {
    updateBillHicksMutation.mutate(data);
  };

  const handleSyncBillHicks = () => {
    syncBillHicksMutation.mutate();
  };

  const copyWebhookUrl = () => {
    const webhookUrl = "https://api.bestprice.com/webhook/asn";
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedLogo(file || null);
  };

  const removeLogo = async () => {
    try {
      await apiRequest(`/org/${organizationSlug}/api/organization/logo`, 'DELETE');
      toast({
        title: "Logo removed",
        description: "Company logo has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/organization`] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove logo",
        variant: "destructive",
      });
    }
  };

  const copyAccountNumber = () => {
    if (settings?.platformAccountNumber) {
      navigator.clipboard.writeText(settings.platformAccountNumber);
      toast({
        title: "Copied",
        description: "Company account number copied to clipboard",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Settings</h1>
          <p className="text-muted-foreground">
            Manage your company information and business details
          </p>
        </div>
      </div>

      <div className="space-y-6">
          {/* Details Section */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Account Number
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="text"
                        value={settings?.platformAccountNumber || 'Not assigned'}
                        readOnly
                        className="bg-gray-50"
                        data-testid="input-platform-account"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyAccountNumber}
                        disabled={!settings?.platformAccountNumber}
                        data-testid="button-copy-account"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Enter company name"
                            data-testid="input-company-name"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retailVerticalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retail Vertical</FormLabel>
                        <FormDescription>
                          Select the industry vertical for your company. This determines available vendors and product catalogs.
                        </FormDescription>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))} 
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-retail-vertical">
                              <SelectValue placeholder="Select retail vertical" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {retailVerticals.filter(v => v.isActive).map((vertical) => (
                              <SelectItem key={vertical.id} value={vertical.id.toString()}>
                                {vertical.name}
                                {vertical.description && (
                                  <span className="text-sm text-gray-500 ml-2">
                                    - {vertical.description}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="defaultTimezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Default Timezone
                          </FormLabel>
                          <FormDescription>
                            Timezone used for documents and timestamps
                          </FormDescription>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-timezone">
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {timezones.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                  {tz.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Currency</FormLabel>
                          <FormDescription>
                            Currency used for pricing and orders
                          </FormDescription>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-currency">
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {currencies.map((curr) => (
                                <SelectItem key={curr.value} value={curr.value}>
                                  {curr.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Company Logo Section */}
          <Card>
            <CardHeader>
              <CardTitle>Company Logo</CardTitle>
            </CardHeader>
            <CardContent>
                      
                      {organization?.logoUrl && (
                        <div className="flex items-center space-x-4 mb-4">
                          <img
                            src={organization.logoUrl}
                            alt="Company Logo"
                            className="w-16 h-16 object-contain border rounded-lg"
                          />
                          <div className="flex flex-col space-y-1">
                            <span className="text-sm font-medium text-gray-700">Current Logo</span>
                            <span className="text-xs text-gray-500">This logo appears throughout your platform</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeLogo}
                            data-testid="button-remove-logo"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remove Logo
                          </Button>
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Upload New Logo
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoSelect}
                          disabled={mutation.isPending || uploadingLogo}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          data-testid="input-logo-upload"
                        />
                        {selectedLogo && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ New logo selected: {selectedLogo.name}
                          </p>
                        )}
                      </div>
            </CardContent>
          </Card>

          {/* Company Billing Information Section */}
          <Card>
            <CardHeader>
              <CardTitle>Company Billing Information (Optional)</CardTitle>
              <p className="text-sm text-gray-500">
                This information is used for billing and administrative purposes. Individual store addresses are managed separately in Settings → Stores.
              </p>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="companyEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Email</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="billing@company.com"
                                type="email"
                                data-testid="input-billing-email"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="companyPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Phone</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="(555) 123-4567"
                                data-testid="input-billing-phone"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="storeAddress1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Street Address</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="123 Corporate Drive"
                              data-testid="input-billing-address1"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="storeAddress2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Suite / Unit (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Suite 100, Floor 5, etc."
                              data-testid="input-billing-address2"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="storeCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing City</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="City"
                                data-testid="input-billing-city"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="storeState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="CA"
                                data-testid="input-billing-state"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="storeZipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Code</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="94025"
                                data-testid="input-billing-zip"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                  <div className="flex justify-end pt-6 border-t">
                    <Button 
                      type="submit" 
                      disabled={mutation.isPending || uploadingLogo}
                      data-testid="button-save-company"
                      className="min-w-[200px]"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {mutation.isPending || uploadingLogo ? 'Saving...' : 'Save Company Information'}
                    </Button>
                  </div>
                  
                  {uploadingLogo && (
                    <div className="flex items-center justify-center space-x-2 pt-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-gray-600">Uploading logo...</span>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

      </div>
    </div>
  );
}
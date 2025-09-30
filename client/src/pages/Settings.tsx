import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Copy, CheckCircle, Eye, EyeOff, User, Upload, X, CreditCard, Network, Server, RefreshCw } from "lucide-react";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { UserSettings } from "@/lib/types";

const settingsSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  organizationEmail: z.string().email("Must be a valid email").optional().or(z.literal("")),
  organizationPhone: z.string().optional(),
  storeAddress: z.string().min(1, "Store address is required"),
  microbizEndpoint: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  microbizApiKey: z.string().optional(),
  microbizEnabled: z.boolean().optional(),
  showVendorCosts: z.boolean(),
});

const userAccountSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Must be a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  defaultStoreId: z.number().optional(),
});

const billHicksSchema = z.object({
  ftpServer: z.string().min(1, "FTP server is required"),
  ftpUsername: z.string().min(1, "FTP username is required"),
  ftpPassword: z.string().min(1, "FTP password is required"),
  catalogSyncEnabled: z.boolean().optional(),
  inventorySyncEnabled: z.boolean().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;
type UserAccountFormData = z.infer<typeof userAccountSchema>;
type BillHicksFormData = z.infer<typeof billHicksSchema>;

export default function Settings() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showBillHicksPassword, setShowBillHicksPassword] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, organizationSlug } = useAuth();

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: [`/org/${organizationSlug}/api/settings`],
    staleTime: 60000, // 1 minute
    enabled: !!organizationSlug
  });

  // Fetch supported vendors to get accurate count
  const { data: supportedVendors = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/supported-vendors'],
    staleTime: 300000, // 5 minutes
  });

  // Get organization data
  const { data: organization } = useQuery<{name: string, email?: string, phone?: string, logoUrl?: string, billingSubscriptionId?: string, billingProvider?: string}>({
    queryKey: [`/org/${organizationSlug}/api/organization`],
    staleTime: 60000, // 1 minute
    enabled: !!organizationSlug
  });

  // Get user data
  const { data: userData } = useQuery<{username: string, email: string, firstName?: string, lastName?: string, defaultStoreId?: number}>({
    queryKey: [`/org/${organizationSlug}/api/user`],
    staleTime: 60000, // 1 minute
    enabled: !!organizationSlug
  });

  // Get stores for default store selection
  const { data: stores = [] } = useQuery<Array<{id: number, name: string}>>({
    queryKey: [`/org/${organizationSlug}/api/stores`],
    staleTime: 60000, // 1 minute
    enabled: !!organizationSlug
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

  console.log('Settings page data:', { settings, organization, userData, organizationSlug });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      organizationName: "",
      organizationEmail: "",
      organizationPhone: "",
      storeAddress: "",
      microbizEndpoint: "",
      microbizApiKey: "",
      microbizEnabled: false,
      showVendorCosts: true,
    },
  });

  const userForm = useForm<UserAccountFormData>({
    resolver: zodResolver(userAccountSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      defaultStoreId: undefined,
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
      console.log('Updating form with organization data:', organization);
      const formData = {
        organizationName: organization.name || "",
        organizationEmail: organization.email || "",
        organizationPhone: organization.phone || "",
        storeAddress: settings?.storeAddress || "",
        microbizEndpoint: settings?.microbizEndpoint || "",
        microbizApiKey: settings?.microbizApiKey || "",
        microbizEnabled: settings?.microbizEnabled || false,
        showVendorCosts: settings?.showVendorCosts ?? true,
      };
      console.log('Form data being set:', formData);
      form.reset(formData);
    }
  }, [settings, organization]);

  useEffect(() => {
    if (userData) {
      userForm.reset({
        username: userData.username || "",
        email: userData.email || "",
        password: "", // Always start empty for security
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        defaultStoreId: userData.defaultStoreId,
      });
    }
  }, [userData]);

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
  }, [billHicksCredentials]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      try {
        console.log('Saving settings:', data);
        console.log('Organization slug:', organizationSlug);
        
        // Update organization info if provided
        const orgUpdates: any = {};
        let hasOrgUpdates = false;
        
        if (data.organizationName && organization && data.organizationName !== organization.name) {
          orgUpdates.name = data.organizationName;
          hasOrgUpdates = true;
        }
        if (data.organizationEmail !== organization?.email) {
          orgUpdates.email = data.organizationEmail || null;
          hasOrgUpdates = true;
        }
        if (data.organizationPhone !== organization?.phone) {
          orgUpdates.phone = data.organizationPhone || null;
          hasOrgUpdates = true;
        }
        
        if (hasOrgUpdates) {
          console.log('Updating organization info:', orgUpdates);
          const orgResponse = await apiRequest(`/org/${organizationSlug}/api/organization`, 'PATCH', orgUpdates);
          if (!orgResponse.ok) {
            const errorText = await orgResponse.text();
            console.error('Organization update failed:', errorText);
            throw new Error('Failed to update organization information');
          }
          console.log('Organization info update successful');
        }
        
        // Update settings (excluding organization fields)
        const { organizationName, organizationEmail, organizationPhone, ...settingsData } = data;
        console.log('Updating settings data:', settingsData);
        const response = await apiRequest(`/org/${organizationSlug}/api/settings`, 'PATCH', settingsData);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Settings update failed:', errorText);
          throw new Error('Failed to update settings');
        }
        return response.json();
      } catch (error) {
        console.error('Mutation function error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('Settings save successful');
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/settings`] });
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/organization`] });
      // Also invalidate sidebar queries to update the organization name display
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/dashboard`] });
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    },
    onError: (error) => {
      console.error('Settings save error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save settings",
        variant: "destructive",
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: UserAccountFormData) => {
      // Remove password if it's empty (no change requested)
      const updateData = { ...data };
      if (!updateData.password) {
        delete updateData.password;
      }
      const response = await apiRequest(`/org/${organizationSlug}/api/user`, 'PATCH', updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/user`] });
      toast({
        title: "Success",
        description: "Account information updated successfully",
      });
      // Clear password field after successful update
      userForm.setValue('password', '');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update account information",
        variant: "destructive",
      });
    }
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch(`/org/${organizationSlug}/api/organization/upload-logo`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload logo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/organization`] });
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
      setUploadingLogo(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
      setUploadingLogo(false);
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

  const onSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const onUserSubmit = (data: UserAccountFormData) => {
    updateUserMutation.mutate(data);
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

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setUploadingLogo(true);
      uploadLogoMutation.mutate(file);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      
      <Tabs defaultValue="system" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="system">System Settings</TabsTrigger>
          <TabsTrigger value="vendors">
            <Network className="w-4 h-4 mr-2" />
            Supported Vendors
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <CreditCard className="w-4 h-4 mr-2" />
            Billing & Subscription
          </TabsTrigger>
          <TabsTrigger value="account">
            <User className="w-4 h-4 mr-2" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-6">

        {/* MicroBiz Integration */}
        <Card>
          <CardHeader>
            <CardTitle>MicroBiz Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="microbizEndpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Endpoint</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://api.microbiz.com/webhook" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="microbizApiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showApiKey ? "text" : "password"}
                            placeholder="Enter your MicroBiz API key"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? (
                              <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Connection Status
                  </label>
                  <div className="flex items-center space-x-2">
                    {settings?.microbizEnabled && settings?.microbizEndpoint && settings?.microbizApiKey ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                        <X className="h-3 w-3 mr-1" />
                        Not Configured
                      </Badge>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-primary hover:text-blue-700"
                      disabled={!settings?.microbizEndpoint || !settings?.microbizApiKey}
                    >
                      Test Connection
                    </Button>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  disabled={updateSettingsMutation.isPending}
                  className="w-full btn-orange-action"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Integration Settings"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Display Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Display Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="showVendorCosts"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div>
                        <FormLabel className="text-sm font-medium text-gray-700">
                          Show Vendor Costs
                        </FormLabel>
                        <p className="text-xs text-gray-500">
                          Hide costs when customers are present
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                


                
                <Button 
                  type="submit" 
                  disabled={updateSettingsMutation.isPending}
                  className="w-full btn-orange-action"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Display Preferences"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ASN Webhook URL
              </label>
              <div className="flex">
                <Input
                  type="text"
                  value="https://api.bestprice.com/webhook/asn"
                  readOnly
                  className="flex-1 bg-gray-50 rounded-r-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="px-4 rounded-l-none border-l-0"
                  onClick={copyWebhookUrl}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Connected Vendors
              </label>
              <div className="text-sm text-gray-600">
                <p>{(supportedVendors as any[]).length} vendors configured to send ASN notifications</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(supportedVendors as any[]).length === 0 ? 
                    "No vendor integrations configured" : 
                    `Available integrations: ${(supportedVendors as any[]).slice(0, 3).map((v: any) => v.vendorShortCode || v.name).join(', ')}${(supportedVendors as any[]).length > 3 ? ` and ${(supportedVendors as any[]).length - 3} more` : ''}`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="vendors" className="space-y-6">
          {/* Bill Hicks & Co. Vendor Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Bill Hicks & Co. FTP Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...billHicksForm}>
                <form onSubmit={billHicksForm.handleSubmit(onBillHicksSubmit)} className="space-y-4">
                  <FormField
                    control={billHicksForm.control}
                    name="ftpServer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>FTP Server</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ftp.billhicksco.com" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={billHicksForm.control}
                    name="ftpUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>FTP Username</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Your store's FTP username" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={billHicksForm.control}
                    name="ftpPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>FTP Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showBillHicksPassword ? "text" : "password"}
                              placeholder={billHicksCredentials?.exists ? "Enter new password to change" : "Enter your FTP password"}
                              className="pr-10"
                              autoComplete="new-password"
                              data-lpignore="true"
                              data-1p-ignore="true"
                              data-bwignore="true"
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowBillHicksPassword(!showBillHicksPassword)}
                            >
                              {showBillHicksPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={billHicksForm.control}
                      name="catalogSyncEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel className="text-sm font-medium text-gray-700">
                              Catalog Sync
                            </FormLabel>
                            <p className="text-xs text-gray-500">
                              Daily product catalog updates
                            </p>
                          </div>
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
                      control={billHicksForm.control}
                      name="inventorySyncEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel className="text-sm font-medium text-gray-700">
                              Inventory Sync
                            </FormLabel>
                            <p className="text-xs text-gray-500">
                              Hourly inventory updates
                            </p>
                          </div>
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

                  {/* Connection Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Connection Status
                    </label>
                    <div className="flex items-center space-x-2">
                      {billHicksCredentials?.exists ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                          <X className="h-3 w-3 mr-1" />
                          Not Configured
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Sync Statistics */}
                  {billHicksCredentials?.exists && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Sync Statistics</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Product Mappings:</span>
                          <span className="ml-2 font-medium text-gray-900">{billHicksStats?.vendorMappings || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Inventory Records:</span>
                          <span className="ml-2 font-medium text-gray-900">{billHicksStats?.inventoryRecords || 0}</span>
                        </div>
                      </div>
                      {billHicksCredentials.credentials && (
                        <div className="mt-3 text-xs text-gray-500">
                          <div>Last Catalog Sync: {billHicksCredentials.credentials.lastCatalogSync ? new Date(billHicksCredentials.credentials.lastCatalogSync).toLocaleString() : 'Never'}</div>
                          <div>Last Inventory Sync: {billHicksCredentials.credentials.lastInventorySync ? new Date(billHicksCredentials.credentials.lastInventorySync).toLocaleString() : 'Never'}</div>
                          <div>Status: Catalog {billHicksCredentials.credentials.catalogSyncStatus}, Inventory {billHicksCredentials.credentials.inventorySyncStatus}</div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      disabled={updateBillHicksMutation.isPending}
                      className="btn-orange-action flex-1"
                      data-testid="button-save-bill-hicks"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {updateBillHicksMutation.isPending ? "Saving..." : "Save Credentials"}
                    </Button>
                    
                    {billHicksCredentials?.exists && (
                      <Button 
                        type="button"
                        variant="outline"
                        disabled={syncBillHicksMutation.isPending}
                        onClick={handleSyncBillHicks}
                        data-testid="button-sync-bill-hicks"
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${syncBillHicksMutation.isPending ? 'animate-spin' : ''}`} />
                        {syncBillHicksMutation.isPending ? "Syncing..." : "Sync Now"}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Other Vendor Integrations */}
          <Card>
            <CardHeader>
              <CardTitle>Other Vendor Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                <p>Additional vendor integrations are configured automatically based on your plan:</p>
                <ul className="mt-2 space-y-1">
                  <li>• Sports South - API integration (automatic sync)</li>
                  <li>• Lipsey's - API integration</li>
                  <li>• Chattanooga Shooting - API integration</li>
                  <li>• GunBroker - Marketplace integration</li>
                </ul>
                <p className="mt-3 text-xs text-gray-500">
                  Contact support for additional vendor integration requests.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionManagement />
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          {/* User Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>User Account</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...userForm}>
                <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
                  <FormField
                    control={userForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter your username" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={userForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="Enter your email" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={userForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter your first name" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={userForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter your last name" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={userForm.control}
                    name="defaultStoreId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Store for Orders</FormLabel>
                        <FormControl>
                          <Select 
                            value={field.value?.toString()} 
                            onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select default store for new orders" />
                            </SelectTrigger>
                            <SelectContent>
                              {stores.map((store) => (
                                <SelectItem key={store.id} value={store.id.toString()}>
                                  {store.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={userForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password (Optional)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              {...field} 
                              type={showPassword ? "text" : "password"} 
                              placeholder="Enter new password (leave blank to keep current)" 
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <Button
                    type="submit"
                    disabled={updateUserMutation.isPending}
                    className="w-full btn-orange-action"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updateUserMutation.isPending ? "Updating..." : "Update Account"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod"; 
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Database, Zap, FileText, AlertCircle, RefreshCw, Download, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const billHicksConfigSchema = z.object({
  // FTP Connection Settings
  ftpHost: z.string().min(1, "FTP Host is required"),
  ftpUsername: z.string().min(1, "FTP Username is required"),
  ftpPassword: z.string().min(1, "FTP Password is required"),
  ftpPort: z.string().optional().default("21"),
  ftpBasePath: z.string().optional().default("/MicroBiz/Feeds"),
  
  // Sync Settings
  enableAutomaticSync: z.boolean().default(true),
  syncTime: z.string().default("01:30"), // HH:MM format
});

type BillHicksConfigForm = z.infer<typeof billHicksConfigSchema>;

interface BillHicksConfigProps {
  vendor: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  organizationSlug: string;
}

export function BillHicksConfig({ 
  vendor, 
  isOpen, 
  onClose, 
  onSuccess,
  organizationSlug
}: BillHicksConfigProps) {
  console.log('🔄 BILL HICKS CONFIG: Component rendered with isOpen:', isOpen, 'vendor:', vendor);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [shortCode, setShortCode] = useState<string>(vendor?.vendorShortCode || '');

  // Get company data for timezone display
  const { data: companyData } = useQuery({
    queryKey: ['/api/organization'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get vendor data for last sync info
  const vendorData = vendor?.credentials;

  // Format last sync date
  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return "Never";
    const date = new Date(lastSync);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // Parse existing sync time from cron format (e.g., "30 1 * * *" -> "01:30")
  const parseSyncTime = (cronExpression: string | null) => {
    if (!cronExpression) return "01:30";
    const parts = cronExpression.split(' ');
    if (parts.length >= 2) {
      const hour = parseInt(parts[1]).toString().padStart(2, '0');
      const minute = parseInt(parts[0]).toString().padStart(2, '0');
      return `${hour}:${minute}`;
    }
    return "01:30";
  };

  const form = useForm<BillHicksConfigForm>({
    resolver: zodResolver(billHicksConfigSchema),
    defaultValues: {
      ftpHost: vendor?.credentials?.ftpServer || vendor?.credentials?.ftpHost || "ftp.billhicks.com",
      ftpUsername: vendor?.credentials?.ftpUsername || "",
      ftpPassword: vendor?.credentials?.ftpPassword || "",
      ftpPort: vendor?.credentials?.ftpPort || "21",
      ftpBasePath: vendor?.credentials?.ftpBasePath || "/MicroBiz/Feeds",
      enableAutomaticSync: vendor?.credentials?.enableAutomaticSync ?? true,
      syncTime: parseSyncTime(vendor?.credentials?.catalogSyncSchedule),
    },
  });

  // Reset form when vendor data changes or modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 BILL HICKS CONFIG: useEffect triggered, vendor credentials:', vendor?.credentials);
      
      const formData = {
        ftpHost: vendor?.credentials?.ftpServer || vendor?.credentials?.ftpHost || "ftp.billhicks.com",
        ftpUsername: vendor?.credentials?.ftpUsername || "",
        ftpPassword: vendor?.credentials?.ftpPassword || "",
        ftpPort: vendor?.credentials?.ftpPort || "21",
        ftpBasePath: vendor?.credentials?.ftpBasePath || "/MicroBiz/Feeds",
        enablePriceComparison: vendor?.credentials?.enablePriceComparison ?? true,
        enableAutomaticSync: vendor?.credentials?.enableAutomaticSync ?? true,
        syncTime: parseSyncTime(vendor?.credentials?.catalogSyncSchedule),
      };
      
      console.log('🔄 BILL HICKS CONFIG: Resetting form with data:', formData);
      // Reset form when modal opens or when vendor credentials change
      form.reset(formData);
    }
    if (isOpen && vendor?.vendorShortCode !== undefined) {
      setShortCode(vendor.vendorShortCode || '');
    }
  }, [isOpen, vendor?.credentials?.ftpUsername, vendor?.credentials?.ftpPassword, vendor?.credentials?.ftpServer, vendor?.credentials?.ftpHost, vendor?.credentials?.ftpPort, vendor?.credentials?.ftpBasePath, form]);

  const testConnectionMutation = useMutation({
    mutationFn: async (formData: BillHicksConfigForm) => {
      setIsTestingConnection(true);
      
      try {
        const response = await apiRequest(`/org/demo-gun-store/api/vendors/${vendor.id}/test-ftp-connection`, 'POST', {
          ftpHost: formData.ftpHost,
          ftpUsername: formData.ftpUsername,
          ftpPassword: formData.ftpPassword,
          ftpPort: parseInt(formData.ftpPort || "21"),
        });
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'FTP connection test failed');
        }
        
        return result;
      } finally {
        setIsTestingConnection(false);
      }
    },
    onSuccess: (data) => {
      toast({
        title: "FTP Connection Successful", 
        description: data.message || "Successfully connected to Bill Hicks FTP server",
      });
    },
    onError: (error: any) => {
      toast({
        title: "FTP Connection Failed",
        description: error.message || "Failed to connect to Bill Hicks FTP server", 
        variant: "destructive",
      });
    }
  });

  // Mutation for manual download
  const manualDownloadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/org/${organizationSlug}/api/vendor-credentials/bill-hicks/sync`, 'POST');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Started",
        description: data.message || "Bill Hicks sync has been initiated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/supported-vendors`] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to start Bill Hicks sync",
        variant: "destructive",
      });
    },
  });

  // Handle manual download
  const handleManualDownload = async () => {
    manualDownloadMutation.mutate();
  };

  const saveConfigMutation = useMutation({
    mutationFn: async (formData: BillHicksConfigForm) => {
      console.log('🔄 BILL HICKS CONFIG: Starting form submission with data:', formData);
      
      // Convert time to cron expression (e.g., "01:30" -> "30 1 * * *")
      const [hours, minutes] = formData.syncTime.split(':');
      const catalogSyncSchedule = `${parseInt(minutes)} ${parseInt(hours)} * * *`;
      
      const credentials = {
        ftpHost: formData.ftpHost,
        ftpUsername: formData.ftpUsername,
        ftpPassword: formData.ftpPassword,
        ftpPort: formData.ftpPort,
        enableAutomaticSync: formData.enableAutomaticSync,
        catalogSyncSchedule: catalogSyncSchedule,
        lastConfigured: new Date().toISOString(),
      };

      console.log('🔄 BILL HICKS CONFIG: Sending credentials to API:', {
        ftpServer: credentials.ftpHost,
        ftpUsername: credentials.ftpUsername,
        ftpPassword: credentials.ftpPassword,
        inventorySyncEnabled: credentials.enableAutomaticSync
      });

      const response = await apiRequest(`/org/${organizationSlug}/api/vendors/bill-hicks/credentials`, 'POST', {
        ftp_server: credentials.ftpHost,
        ftp_username: credentials.ftpUsername,
        ftp_password: credentials.ftpPassword,
        ftp_port: credentials.ftpPort || '21',
        ftp_base_path: formData.ftpBasePath || '/MicroBiz/Feeds',
        catalog_sync_enabled: true, // Always enable catalog sync for store-level
        catalog_sync_schedule: catalogSyncSchedule,
        inventory_sync_enabled: credentials.enableAutomaticSync
      });
      
      console.log('🔄 BILL HICKS CONFIG: API response:', response);
      return response.json();
    },
    onSuccess: (response) => {
      console.log('🔄 BILL HICKS CONFIG: Save successful, response:', response);
      console.log('🔄 BILL HICKS CONFIG: Calling onSuccess to refresh vendor data');
      // Let parent component handle query invalidation to avoid race conditions
      toast({
        title: "Configuration Saved",
        description: "Bill Hicks & Co. settings have been saved successfully.",
      });
      onSuccess?.();
      // Don't close the modal - keep it open for further testing/configuration
    },
    onError: (error: any) => {
      console.log('🔄 BILL HICKS CONFIG: Save failed with error:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save Bill Hicks configuration",
        variant: "destructive",
      });
    }
  });


  const onSubmit = (data: BillHicksConfigForm) => {
    console.log('🔄 BILL HICKS CONFIG: onSubmit called with data:', data);
    saveConfigMutation.mutate(data);
  };

  const handleTestConnection = () => {
    const formData = form.getValues();
    testConnectionMutation.mutate(formData);
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[900px] md:max-w-[1100px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Bill Hicks Connection Settings
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-6">

              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                <p><strong>Bill Hicks Catalog Feed Credentials Required!</strong></p>
                <ul className="list-disc ml-4 mt-2">
                  <li>Daily catalog feed - FTP connection to Bill Hicks server required to download your store-specific catalog from Bill Hicks.</li>
                  <li>Your catalog contains pricing and product data tailored specifically for your store.</li>
                  <li>Please contact Bill Hicks to set up your store-specific catalog feed and to obtain credentials to access your catalog feed.</li>
                </ul>
              </div>

              {/* FTP Connection Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-4 w-4" />
                  FTP Connection Settings
                </CardTitle>
                <CardDescription>
                  Enter your Bill Hicks FTP credentials to download your store-specific catalog file daily
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="ftpUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FTP Username</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter FTP username"
                          data-testid="input-ftp-username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ftpPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FTP Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter FTP password"
                            data-testid="input-ftp-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ftpHost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>FTP Server Host</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="ftp.billhicks.com"
                            data-testid="input-ftp-host"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="ftpPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>FTP Port</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="21"
                            type="number"
                            data-testid="input-ftp-port"
                          />
                        </FormControl>
                        <FormDescription>
                          Port 21 is typically used for FTP connections
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="ftpBasePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Directory</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="/MicroBiz/Feeds"
                          data-testid="input-ftp-base-path"
                        />
                      </FormControl>
                      <FormDescription>
                        The FTP directory path where your store-specific pricing file (MicroBiz_Daily_Catalog.csv) is located. We recommend using <strong>/MicroBiz/Feeds</strong> unless Bill Hicks has provided a different path for your store.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || testConnectionMutation.isPending}
                    data-testid="button-test-ftp-connection"
                  >
                    {isTestingConnection ? "Testing..." : "Test FTP Connection"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RefreshCw className="h-4 w-4" />
                  Store Catalog Sync Management
                </CardTitle>
                <CardDescription>
                  Daily download of your store-specific product catalog and pricing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Automatic Sync Toggle */}
                <FormField
                  control={form.control}
                  name="enableAutomaticSync"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Automatic Sync</FormLabel>
                        <FormDescription>
                          Automatically download your store catalog daily via FTP
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enable-automatic-sync"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Daily Catalog Sync Info */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      <h3 className="font-medium">Daily Catalog Sync</h3>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={handleManualDownload}
                      disabled={manualDownloadMutation.isPending}
                      data-testid="button-manual-download"
                    >
                      {manualDownloadMutation.isPending ? "Syncing..." : "Manual Sync"}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your store-specific catalog containing current pricing and product availability is automatically downloaded at the time set below.
                  </p>
                  {/* Sync Time Configuration - Only show when automatic sync is enabled */}
                  {form.watch('enableAutomaticSync') && (
                    <FormField
                      control={form.control}
                      name="syncTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Daily Sync Time
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="time"
                              data-testid="input-sync-time"
                              className="w-40"
                            />
                          </FormControl>
                          <FormDescription>
                            Time for daily catalog sync in your store's timezone
                            {(companyData as any)?.settings?.timezone && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({(companyData as any).settings.timezone})
                              </span>
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {/* Catalog Sync Status Section */}
                  <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                    {/* Catalog Sync Status */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Catalog Sync Status
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Status:</span>
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            vendorData?.catalogSyncStatus === 'success' ? 'bg-green-100 text-green-800' :
                            vendorData?.catalogSyncStatus === 'error' ? 'bg-red-100 text-red-800' :
                            vendorData?.catalogSyncStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {vendorData?.catalogSyncStatus === 'success' ? 'Success' :
                             vendorData?.catalogSyncStatus === 'error' ? 'Error' :
                             vendorData?.catalogSyncStatus === 'in_progress' ? 'In Progress' : 'Never'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Last Sync:</span>
                          <span className="ml-2 text-gray-600">
                            {vendorData?.lastCatalogSync 
                              ? new Date(vendorData.lastCatalogSync).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }) + ' at ' + new Date(vendorData.lastCatalogSync).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' })
                              : 'Never'
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    
                    {/* Catalog sync stats - store level only includes catalog sync */}
                    {(vendorData?.lastCatalogRecordsCreated || vendorData?.lastCatalogRecordsUpdated || 
                      vendorData?.lastCatalogRecordsDeactivated) && (
                      <div className="pt-3 border-t space-y-3">
                        <h4 className="font-medium text-sm">Last Sync Statistics</h4>
                        
                        {/* Catalog Sync Stats */}
                        <div>
                          <div className="text-xs font-medium text-gray-700 mb-2">Catalog Sync</div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {vendorData?.lastCatalogRecordsCreated !== undefined && (
                              <div>
                                <span className="font-medium">Added:</span>
                                <span className="ml-2 text-green-600">{vendorData.lastCatalogRecordsCreated.toLocaleString()}</span>
                              </div>
                            )}
                            {vendorData?.lastCatalogRecordsUpdated !== undefined && (
                              <div>
                                <span className="font-medium">Updated:</span>
                                <span className="ml-2 text-blue-600">{vendorData.lastCatalogRecordsUpdated.toLocaleString()}</span>
                              </div>
                            )}
                            {vendorData?.lastCatalogRecordsDeactivated !== undefined && (
                              <div>
                                <span className="font-medium">Deactivated:</span>
                                <span className="ml-2 text-orange-600">{vendorData.lastCatalogRecordsDeactivated.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    
                    {/* Error display for catalog sync */}
                    {vendorData?.catalogSyncError && (
                      <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <div className="font-medium text-red-800 mb-1">Catalog Sync Error</div>
                            <div className="text-red-700">{vendorData.catalogSyncError}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>


            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saveConfigMutation.isPending}
                data-testid="button-save-bill-hicks-config"
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {saveConfigMutation.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
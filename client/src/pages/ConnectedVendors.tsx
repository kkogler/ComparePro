import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Store, Plus, Settings, Check, FileText, Circle, Eye, EyeOff, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "wouter";
import ChattanoogaConfig from "./ChattanoogaConfig";
import type { VendorInfo } from "@/lib/types";


const lipseyConfigSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});



const chattanoogaConfigSchema = z.object({
  accountNumber: z.string().min(1, "Account Number is required"),
  username: z.string().min(1, "Username is required"), 
  password: z.string().min(1, "Password is required"),
  sid: z.string().min(1, "SID is required"),
  token: z.string().min(1, "Token is required"),
});

type LipseyConfigForm = z.infer<typeof lipseyConfigSchema>;

type ChattanoogaConfigForm = z.infer<typeof chattanoogaConfigSchema>;

export default function ConnectedVendors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { slug } = useParams();
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [chattanoogaConfigOpen, setChattanoogaConfigOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorInfo | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingVendor, setEditingVendor] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', vendorShortCode: '' });

  const lipseyForm = useForm<LipseyConfigForm>({
    resolver: zodResolver(lipseyConfigSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });



  const { data: vendors, isLoading } = useQuery<VendorInfo[]>({
    queryKey: [`/org/${slug}/api/vendors`],
    staleTime: 30000 // 30 seconds
  });

  const updateVendorMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<VendorInfo> }) => {
      const response = await apiRequest(`/org/${slug}/api/vendors/${id}`, 'PATCH', updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/vendors`] });
      toast({
        title: "Success",
        description: "Vendor updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update vendor",
        variant: "destructive",
      });
    }
  });

  const handleStatusChange = (vendorId: number, newStatus: string) => {
    // For destructive actions, show confirmation
    if (newStatus === 'disabled') {
      const confirmed = window.confirm(
        'This will disable the vendor connection and stop all data synchronization. Continue?'
      );
      if (!confirmed) return;
    }

    // Handle credential cleanup for disabled vendors
    const updates: any = { status: newStatus };
    if (newStatus === 'disabled') {
      updates.credentials = null;
      updates.connectionStatus = 'offline';
      updates.catalogItems = 0;
    } else if (newStatus === 'paused') {
      updates.connectionStatus = 'offline';
    } else if (newStatus === 'connected') {
      // If re-enabling, keep credentials but mark as offline until tested
      updates.connectionStatus = 'offline';
    }

    updateVendorMutation.mutate({ 
      id: vendorId, 
      updates 
    });
  };

  const handleConfigureVendor = (vendor: VendorInfo) => {
    setSelectedVendor(vendor);
    
    if (vendor.name.toLowerCase().includes('chattanooga')) {
      setChattanoogaConfigOpen(true);
    } else {
      setConfigModalOpen(true);
      
      // Pre-fill form with existing credentials if available
      if (vendor.credentials) {
        if (vendor.name.toLowerCase().includes('lipsey')) {
          lipseyForm.reset({
            email: vendor.credentials.email || "",
            password: vendor.credentials.password || "",
          });
        }
      }
    }
  };

  const handleEditVendor = (vendor: VendorInfo) => {
    setEditingVendor(vendor.id);
    setEditForm({
      name: vendor.name,
      vendorShortCode: vendor.vendorShortCode || ''
    });
  };

  const handleSaveEdit = async (vendorId: number) => {
    try {
      await updateVendorMutation.mutateAsync({ 
        id: vendorId, 
        updates: {
          name: editForm.name,
          vendorShortCode: editForm.vendorShortCode
        }
      });
      setEditingVendor(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCancelEdit = () => {
    setEditingVendor(null);
    setEditForm({ name: '', vendorShortCode: '' });
  };

  const testLipseyConnection = async (email: string, password: string) => {
    try {
      const response = await fetch('https://api.lipseys.com/api/Integration/Authentication/Login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Email: email,
          Password: password,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.token) {
        return { success: true, token: result.token, data: result.econtact };
      } else {
        throw new Error(result.errors?.[0] || 'Authentication failed');
      }
    } catch (error) {
      console.error('Lipsey connection test failed:', error);
      throw error;
    }
  };

  const saveVendorConfigMutation = useMutation({
    mutationFn: async (formData: LipseyConfigForm) => {
      if (!selectedVendor) throw new Error('No vendor selected');
      
      setIsTestingConnection(true);
      
      try {
        // Test the connection first
        const testResult = await testLipseyConnection(formData.email, formData.password);
        
        // If successful, save the credentials
        const updates = {
          credentials: {
            email: formData.email,
            password: formData.password,
            token: testResult.token,
            lastAuthenticated: new Date().toISOString(),
          },
          connectionStatus: 'online',
          lastUpdate: new Date().toISOString(),
        };
        
        const response = await apiRequest(`/api/vendors/${selectedVendor.id}`, 'PATCH', updates);
        return response.json();
      } finally {
        setIsTestingConnection(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      setConfigModalOpen(false);
      setSelectedVendor(null);
      lipseyForm.reset();
      toast({
        title: "Success",
        description: "Lipsey's API connection configured successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Lipsey's API",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: LipseyConfigForm) => {
    saveVendorConfigMutation.mutate(data);
  };



  const handleTestConnection = async (vendorId: number) => {
    setIsTestingConnection(true);
    try {
      const response = await apiRequest(`/api/vendors/${vendorId}/test-connection`, 'POST', {});
      const result = await response.json();
      
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
        toast({
          title: "Connection Successful",
          description: "Vendor connection tested successfully",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Failed to test connection",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to test connection",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSyncCatalog = async (vendorId: number) => {
    setIsSyncing(true);
    try {
      const response = await apiRequest(`/api/vendors/${vendorId}/sync`, 'POST', {});
      const result = await response.json();
      
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
        toast({
          title: "Sync Successful",
          description: result.message || "Catalog synchronized successfully",
        });
      } else {
        toast({
          title: "Sync Failed",
          description: result.error || "Failed to sync catalog",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Failed to sync vendor catalog",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportProducts = async (vendorId: number) => {
    setIsSyncing(true);
    try {
      const response = await apiRequest(`/api/vendors/${vendorId}/import`, 'POST', {});
      const result = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      toast({
        title: "Import Started",
        description: "Product import started in background",
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to start product import",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };



  const getVendorLogo = (vendorName: string, logoUrl?: string) => {
    // If custom logo is uploaded, show that first
    if (logoUrl) {
      return (
        <div className="flex items-center justify-center w-10 h-6 rounded border border-gray-200 dark:border-gray-600 overflow-hidden">
          <img 
            src={logoUrl} 
            alt={`${vendorName} logo`}
            className="w-full h-full object-contain"
            onError={(e) => {
              // Fallback to default icon if logo fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = '<Building2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />';
            }}
          />
        </div>
      );
    }
    
    if (!vendorName) return <Building2 className="h-6 w-6" />;
    
    const name = vendorName.toLowerCase();
    
    // Return default branded icons
    if (name.includes('lipsey')) {
      return (
        <div className="flex items-center justify-center w-10 h-6 bg-blue-100 dark:bg-blue-900 rounded border border-blue-200 dark:border-blue-700">
          <span className="text-xs font-bold text-blue-800 dark:text-blue-200">L</span>
        </div>
      );
    } else if (name.includes('chattanooga')) {
      return (
        <div className="flex items-center justify-center w-10 h-6 bg-green-100 dark:bg-green-900 rounded border border-green-200 dark:border-green-700">
          <span className="text-xs font-bold text-green-800 dark:text-green-200">CSS</span>
        </div>
      );
    } else if (name.includes('gunbroker')) {
      return (
        <div className="flex items-center justify-center w-10 h-6 bg-orange-100 dark:bg-orange-900 rounded border border-orange-200 dark:border-orange-700">
          <span className="text-xs font-bold text-orange-800 dark:text-orange-200">GB</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-center w-10 h-6 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
          <Building2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </div>
      );
    }
  };

  const getConnectionStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <Circle className="h-2 w-2 mr-1 fill-current" />
            Online
          </Badge>
        );
      case 'syncing':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Circle className="h-2 w-2 mr-1 fill-current animate-pulse" />
            Syncing
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <Circle className="h-2 w-2 mr-1 fill-current" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <Circle className="h-2 w-2 mr-1 fill-current" />
            Offline
          </Badge>
        );
    }
  };

  const getElectronicOrdersStatus = (electronicOrders: boolean, type: string) => {
    if (electronicOrders) {
      return (
        <span className="text-gray-600 font-medium">
          Supported
        </span>
      );
    } else if (type === 'excel') {
      return (
        <span className="text-orange-600 font-medium">
          <FileText className="h-4 w-4 mr-1 inline" />
          Excel File
        </span>
      );
    } else {
      return (
        <span className="text-gray-600 font-medium">
          Not Supported
        </span>
      );
    }
  };

  const getLastUpdateText = (lastUpdate?: string) => {
    if (!lastUpdate) return 'Never';
    
    const now = new Date();
    const updateDate = new Date(lastUpdate);
    const diffMs = now.getTime() - updateDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Less than 1 hour ago';
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  const getSyncRecommendation = (vendor: VendorInfo) => {
    const now = new Date();
    const lastUpdate = vendor.lastUpdate ? new Date(vendor.lastUpdate) : null;
    const hoursSinceUpdate = lastUpdate ? 
      (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60) : 
      Infinity;

    if (!lastUpdate || hoursSinceUpdate > 24) {
      return { shouldSync: true, priority: 'high', reason: 'Data is more than 24 hours old' };
    }
    if (hoursSinceUpdate > 12) {
      return { shouldSync: true, priority: 'medium', reason: 'Data is more than 12 hours old' };
    }
    if (vendor.connectionStatus === 'error') {
      return { shouldSync: true, priority: 'high', reason: 'Connection is in error state' };
    }
    return { shouldSync: false, priority: 'low', reason: 'Data is current' };
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Supported Vendors</h1>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>
      </div>

      {/* Vendors Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-12 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : vendors && vendors.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {vendors.map((vendor) => (
            <Card key={vendor.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getVendorLogo(vendor.name, vendor.logoUrl)}
                    <div className="flex-1">
                      {editingVendor === vendor.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="text-lg font-medium"
                            placeholder="Vendor Name"
                          />
                          <Input
                            value={editForm.vendorShortCode}
                            onChange={(e) => setEditForm({ ...editForm, vendorShortCode: e.target.value })}
                            className="text-sm"
                            placeholder="Short Code (e.g., Lipsey's)"
                          />
                          <div className="flex space-x-1">
                            <Button 
                              size="sm" 
                              onClick={() => handleSaveEdit(vendor.id)}
                              className="h-6 px-2 text-xs"
                            >
                              Save
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={handleCancelEdit}
                              className="h-6 px-2 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div onClick={() => handleEditVendor(vendor)} className="cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <h3 className="text-lg font-medium text-gray-900">{vendor.name}</h3>
                          {vendor.vendorShortCode && (
                            <p className="text-sm font-medium text-blue-600">Short Code: {vendor.vendorShortCode}</p>
                          )}
                          <p className="text-sm text-gray-500">
                            {vendor.type === 'api' ? 'API Integration' : 'Excel Integration'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <Select 
                      value={vendor.status} 
                      onValueChange={(value) => handleStatusChange(vendor.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connected">Connected</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Electronic Orders:</span>
                    {getElectronicOrdersStatus(vendor.electronicOrders, vendor.type)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Catalog Items:</span>
                    <span className="font-medium">{vendor.catalogItems.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Last Update:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-900">{getLastUpdateText(vendor.lastUpdate)}</span>
                      {getSyncRecommendation(vendor).shouldSync && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            getSyncRecommendation(vendor).priority === 'high' 
                              ? 'border-red-200 text-red-700' 
                              : 'border-yellow-200 text-yellow-700'
                          }`}
                        >
                          Sync Needed
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Connection Status:</span>
                    {getConnectionStatusBadge(vendor.connectionStatus)}
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      className="flex-1 text-primary hover:text-blue-700"
                      onClick={() => handleConfigureVendor(vendor)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configure Settings
                    </Button>
                  </div>
                  
                  {vendor.name === "Lipsey's" && vendor.credentials?.token && (
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleTestConnection(vendor.id)}
                        disabled={isTestingConnection}
                      >
                        {isTestingConnection ? "Testing..." : "Test Connection"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className={`flex-1 text-xs ${
                          getSyncRecommendation(vendor).shouldSync 
                            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' 
                            : ''
                        }`}
                        onClick={() => handleSyncCatalog(vendor.id)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? "Syncing..." : "Sync Catalog"}
                      </Button>
                    </div>
                  )}
                  
                  {vendor.name === "Lipsey's" && !vendor.credentials?.token && (
                    <div className="text-center py-2">
                      <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
                        Authentication Required
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No vendors connected</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first vendor integration.</p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>
      )}

      {/* Vendor Configuration Modal */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Configure {selectedVendor?.name || 'Vendor'} API Connection
            </DialogTitle>
            <DialogDescription>
              Set up secure API credentials for vendor integration and catalog synchronization.
            </DialogDescription>
          </DialogHeader>
          
          {selectedVendor?.name === "Lipsey's" && (
            <Form {...lipseyForm}>
              <form onSubmit={lipseyForm.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Enter your Lipsey's API credentials to establish a connection. 
                    Your credentials will be securely stored and used for authentication.
                  </p>
                </div>
                
                <FormField
                  control={lipseyForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your-email@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={lipseyForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Your password"
                            {...field}
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfigModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isTestingConnection}
                  >
                    {isTestingConnection ? "Testing Connection..." : "Save & Test Connection"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
          

          
          {selectedVendor?.name !== "Lipsey's" && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                Configuration for {selectedVendor?.name} is not yet available.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Chattanooga Configuration Modal */}
      <ChattanoogaConfig
        vendor={selectedVendor}
        isOpen={chattanoogaConfigOpen}
        onClose={() => {
          setChattanoogaConfigOpen(false);
          setSelectedVendor(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/vendors`] });
        }}
      />
    </div>
  );
}

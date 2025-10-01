import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, Key, CheckCircle, XCircle, AlertTriangle, Plus, Settings, Eye, EyeOff, Clock } from 'lucide-react';
// import { apiRequest } from '@/lib/api';

// Temporary API request function until we find the correct import
const apiRequest = async (url: string, method: string = 'GET', body?: any) => {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  return fetch(url, options);
};

interface VendorCredentialSchema {
  vendorId: string;
  vendorName: string;
  adminCredentials: CredentialField[];
  storeCredentials: CredentialField[];
  authenticationMethod: 'basic' | 'oauth2' | 'apiKey' | 'custom';
}

interface CredentialField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'url' | 'number' | 'apiKey' | 'secret' | 'token';
  required: boolean;
  encrypted: boolean;
  placeholder?: string;
  description?: string;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

interface ConfiguredVendor {
  vendorId: string;
  vendorName: string;
  hasAdminCredentials: boolean;
  adminConnectionStatus?: string;
  storeCount: number;
}

interface VendorHandler {
  vendorId: string;
  vendorName: string;
  apiType: string;
  capabilities: {
    testConnection: boolean;
    searchProducts: boolean;
    getInventory: boolean;
    createOrder: boolean;
    syncCatalog: boolean;
  };
}

export default function CredentialManagementAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch configured vendors
  const { data: configuredVendors, isLoading: loadingVendors } = useQuery({
    queryKey: ['/api/admin/vendors/configured'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/vendors/configured');
      if (!response.ok) throw new Error('Failed to fetch configured vendors');
      const data = await response.json();
      return data.vendors as ConfiguredVendor[];
    }
  });

  // Fetch available handlers
  const { data: handlers } = useQuery({
    queryKey: ['/api/admin/vendors/handlers'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/vendors/handlers');
      if (!response.ok) throw new Error('Failed to fetch vendor handlers');
      const data = await response.json();
      return data.handlers as VendorHandler[];
    }
  });

  // Fetch credential health
  const { data: credentialHealth } = useQuery({
    queryKey: ['/api/admin/credentials/health'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/credentials/health');
      if (!response.ok) throw new Error('Failed to fetch credential health');
      return await response.json();
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Credential Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage vendor credentials and authentication for your platform
          </p>
        </div>
        <RegisterNewVendorDialog />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="admin-credentials">Admin Credentials</TabsTrigger>
          <TabsTrigger value="store-credentials">Store Credentials</TabsTrigger>
          <TabsTrigger value="handlers">Vendor Handlers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CredentialOverview 
            health={credentialHealth} 
            configuredVendors={configuredVendors || []}
            loading={loadingVendors}
          />
        </TabsContent>

        <TabsContent value="admin-credentials">
          <AdminCredentialsTab vendors={configuredVendors || []} />
        </TabsContent>

        <TabsContent value="store-credentials">
          <StoreCredentialsTab vendors={configuredVendors || []} />
        </TabsContent>

        <TabsContent value="handlers">
          <VendorHandlersTab handlers={handlers || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CredentialOverview({ 
  health, 
  configuredVendors, 
  loading 
}: { 
  health: any; 
  configuredVendors: ConfiguredVendor[]; 
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-center py-8">Loading credential overview...</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Online</Badge>;
      case 'pending_test':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Pending Test</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case 'not_configured':
        return <Badge className="bg-gray-100 text-gray-800"><AlertTriangle className="w-3 h-3 mr-1" />Not Configured</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{health?.summary?.totalVendors || 0}</div>
            <div className="text-sm text-gray-600">Total Vendors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{health?.summary?.vendorsWithAdminCreds || 0}</div>
            <div className="text-sm text-gray-600">Admin Configured</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{health?.summary?.totalStoreCredentials || 0}</div>
            <div className="text-sm text-gray-600">Store Credentials</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {configuredVendors.filter(v => v.adminConnectionStatus === 'online').length}
            </div>
            <div className="text-sm text-gray-600">Online Connections</div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Status Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-2 text-left">Vendor</th>
                  <th className="border border-gray-200 px-4 py-2 text-left">Admin Credentials</th>
                  <th className="border border-gray-200 px-4 py-2 text-left">Connection Status</th>
                  <th className="border border-gray-200 px-4 py-2 text-left">Store Count</th>
                </tr>
              </thead>
              <tbody>
                {configuredVendors.map((vendor) => (
                  <tr key={vendor.vendorId} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-4 py-2 font-medium">
                      {vendor.vendorName}
                    </td>
                    <td className="border border-gray-200 px-4 py-2">
                      {vendor.hasAdminCredentials ? (
                        <Badge className="bg-green-100 text-green-800">Configured</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">Missing</Badge>
                      )}
                    </td>
                    <td className="border border-gray-200 px-4 py-2">
                      {getStatusBadge(vendor.adminConnectionStatus || 'not_configured')}
                    </td>
                    <td className="border border-gray-200 px-4 py-2">
                      {vendor.storeCount > 0 ? (
                        <span className="text-blue-600 font-medium">{vendor.storeCount} stores</span>
                      ) : (
                        <span className="text-gray-400">No stores</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminCredentialsTab({ vendors }: { vendors: ConfiguredVendor[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admin-Level Credentials</h2>
          <p className="text-gray-600">
            System-wide credentials used for catalog synchronization and admin operations
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {vendors.map((vendor) => (
          <VendorCredentialCard 
            key={vendor.vendorId} 
            vendor={vendor} 
            level="admin" 
          />
        ))}
      </div>
    </div>
  );
}

function StoreCredentialsTab({ vendors }: { vendors: ConfiguredVendor[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Store-Level Credentials</h2>
          <p className="text-gray-600">
            Store-specific credentials for price comparison and ordering
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {vendors.filter(v => v.storeCount > 0).map((vendor) => (
          <Card key={vendor.vendorId}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{vendor.vendorName}</span>
                <Badge>{vendor.storeCount} stores configured</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                This vendor has credentials configured for {vendor.storeCount} store(s). 
                Store owners can manage their own credentials through their store settings.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function VendorHandlersTab({ handlers }: { handlers: VendorHandler[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vendor Handlers</h2>
          <p className="text-gray-600">
            Available vendor integration handlers and their capabilities
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {handlers.map((handler) => (
          <Card key={handler.vendorId}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{handler.vendorName}</span>
                <Badge>{handler.apiType}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(handler.capabilities).map(([capability, supported]) => (
                    <Badge 
                      key={capability}
                      className={supported ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}
                    >
                      {capability}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function VendorCredentialCard({ 
  vendor, 
  level 
}: { 
  vendor: ConfiguredVendor; 
  level: 'admin' | 'store';
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/admin/vendors/${vendor.vendorId}/test-connection`, 'POST');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Connection test failed');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connection Successful",
        description: `${vendor.vendorName} credentials are working correctly`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vendors/configured'] });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending_test':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            <span>{vendor.vendorName}</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(vendor.adminConnectionStatus || 'not_configured')}
            <Badge className={
              vendor.hasAdminCredentials 
                ? "bg-green-100 text-green-800" 
                : "bg-red-100 text-red-800"
            }>
              {vendor.hasAdminCredentials ? 'Configured' : 'Not Configured'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCredentialsDialog(true)}
          >
            <Settings className="w-4 h-4 mr-1" />
            Configure
          </Button>
          
          {vendor.hasAdminCredentials && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending}
            >
              {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
            </Button>
          )}
        </div>

        <CredentialConfigDialog
          vendor={vendor}
          level={level}
          open={showCredentialsDialog}
          onClose={() => setShowCredentialsDialog(false)}
        />
      </CardContent>
    </Card>
  );
}

function CredentialConfigDialog({
  vendor,
  level,
  open,
  onClose
}: {
  vendor: ConfiguredVendor;
  level: 'admin' | 'store';
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [schema, setSchema] = useState<VendorCredentialSchema | null>(null);

  // Fetch credential schema
  useEffect(() => {
    if (open) {
      const fetchSchema = async () => {
        try {
          const response = await apiRequest(`/api/admin/vendors/${vendor.vendorId}/credential-schema`);
          if (response.ok) {
            const data = await response.json();
            setSchema(data.schema);
          }
        } catch (error) {
          console.error('Failed to fetch schema:', error);
        }
      };

      const fetchExistingCredentials = async () => {
        try {
          const response = await apiRequest(`/api/admin/vendors/${vendor.vendorId}/credentials`);
          if (response.ok) {
            const data = await response.json();
            setCredentials(data.credentials || {});
          }
        } catch (error) {
          console.error('Failed to fetch existing credentials:', error);
        }
      };

      fetchSchema();
      fetchExistingCredentials();
    }
  }, [open, vendor.vendorId]);

  // Save credentials mutation
  const saveCredentialsMutation = useMutation({
    mutationFn: async (creds: Record<string, string>) => {
      const response = await apiRequest(
        `/api/admin/vendors/${vendor.vendorId}/credentials`, 
        'POST',
        { credentials: creds }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save credentials');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Credentials Saved",
        description: `${vendor.vendorName} credentials have been saved successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vendors/configured'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    saveCredentialsMutation.mutate(credentials);
  };

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  const isPasswordType = (type: string) => {
    return ['password', 'secret', 'token', 'apiKey'].includes(type);
  };

  if (!schema) {
    return null;
  }

  const fields = level === 'admin' ? schema.adminCredentials : schema.storeCredentials;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Configure {vendor.vendorName} Credentials
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Sensitive credential fields are encrypted and securely stored. 
              Authentication method: <strong>{schema.authenticationMethod}</strong>
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name} className="flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                  {field.encrypted && <Shield className="w-3 h-3 text-blue-500" />}
                </Label>
                
                <div className="relative">
                  <Input
                    id={field.name}
                    type={isPasswordType(field.type) && !showPasswords[field.name] ? 'password' : 'text'}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    value={credentials[field.name] || ''}
                    onChange={(e) => setCredentials(prev => ({
                      ...prev,
                      [field.name]: e.target.value
                    }))}
                    required={field.required}
                  />
                  
                  {isPasswordType(field.type) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => togglePasswordVisibility(field.name)}
                    >
                      {showPasswords[field.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
                
                {field.description && (
                  <p className="text-sm text-gray-600">{field.description}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveCredentialsMutation.isPending}
            >
              {saveCredentialsMutation.isPending ? 'Saving...' : 'Save Credentials'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RegisterNewVendorDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [vendorData, setVendorData] = useState({
    vendorId: '',
    vendorName: '',
    apiType: 'rest_api',
    handlerModule: ''
  });

  const registerVendorMutation = useMutation({
    mutationFn: async (data: typeof vendorData) => {
      const response = await apiRequest('/api/admin/vendors/register', 'POST', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to register vendor');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Vendor Registered",
        description: `${vendorData.vendorName} has been registered successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vendors/handlers'] });
      setOpen(false);
      setVendorData({ vendorId: '', vendorName: '', apiType: 'rest_api', handlerModule: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerVendorMutation.mutate(vendorData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-1" />
          Register New Vendor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register New Vendor</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendorId">Vendor ID</Label>
            <Input
              id="vendorId"
              placeholder="e.g., new_vendor"
              value={vendorData.vendorId}
              onChange={(e) => setVendorData(prev => ({ ...prev, vendorId: e.target.value }))}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="vendorName">Vendor Name</Label>
            <Input
              id="vendorName"
              placeholder="e.g., New Vendor Inc."
              value={vendorData.vendorName}
              onChange={(e) => setVendorData(prev => ({ ...prev, vendorName: e.target.value }))}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="apiType">API Type</Label>
            <select
              id="apiType"
              value={vendorData.apiType}
              onChange={(e) => setVendorData(prev => ({ ...prev, apiType: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="rest_api">REST API</option>
              <option value="soap">SOAP</option>
              <option value="ftp">FTP</option>
              <option value="excel">Excel</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="handlerModule">Handler Module (Optional)</Label>
            <Input
              id="handlerModule"
              placeholder="e.g., ./new-vendor-api"
              value={vendorData.handlerModule}
              onChange={(e) => setVendorData(prev => ({ ...prev, handlerModule: e.target.value }))}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={registerVendorMutation.isPending}>
              {registerVendorMutation.isPending ? 'Registering...' : 'Register Vendor'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Settings, Mail, Shield, Building, Clock, Upload, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// US Time Zones for dropdown
const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Mountain Time - Arizona (MST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
] as const;

const adminSettingsSchema = z.object({
  systemEmail: z.string().email().optional(),
  systemTimeZone: z.string().optional(),
  maintenanceMode: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),
  maxOrganizations: z.number().optional(),
  supportEmail: z.string().email().optional(),
  companyName: z.string().optional(),
  logoUrl: z.string().optional(),
  includeUnmatchedUpcs: z.boolean().optional(),
});

type AdminSettingsForm = z.infer<typeof adminSettingsSchema>;




interface AdminSettings {
  id: number;
  systemEmail: string;
  systemTimeZone: string | null;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  maxOrganizations: number;
  supportEmail: string;
  companyName: string;
  logoUrl: string | null;
  includeUnmatchedUpcs: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);

  // Fetch admin settings
  const { data: adminSettings, isLoading } = useQuery<AdminSettings>({
    queryKey: ['/api/admin/settings'],
  });

  const form = useForm<AdminSettingsForm>({
    resolver: zodResolver(adminSettingsSchema),
    defaultValues: {
      systemEmail: 'noreply@pricecompare.com',
      systemTimeZone: 'America/New_York',
      maintenanceMode: false,
      registrationEnabled: true,
      maxOrganizations: 1000,
      supportEmail: 'support@pricecompare.com',
      companyName: 'Retail Management Platform',
      logoUrl: '',
      includeUnmatchedUpcs: true,
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (adminSettings) {
      form.reset({
        systemEmail: adminSettings.systemEmail || 'noreply@pricecompare.com',
        systemTimeZone: adminSettings.systemTimeZone || 'America/New_York',
        maintenanceMode: adminSettings.maintenanceMode || false,
        registrationEnabled: adminSettings.registrationEnabled || true,
        maxOrganizations: adminSettings.maxOrganizations || 1000,
        supportEmail: adminSettings.supportEmail || 'support@pricecompare.com',
        companyName: adminSettings.companyName || 'Retail Management Platform',
        includeUnmatchedUpcs: adminSettings.includeUnmatchedUpcs || true,
        logoUrl: adminSettings.logoUrl || '',
      });
    }
  }, [adminSettings, form]);

  // Update admin settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: AdminSettingsForm) => {
      // Use PUT for broader proxy compatibility (server supports PATCH/PUT/POST)
      const response = await apiRequest('/api/admin/settings', 'PUT', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({
        title: "Settings updated",
        description: "Admin settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update admin settings.",
        variant: "destructive",
      });
    },
  });


  const onSubmit = async (data: AdminSettingsForm) => {
    try {
      // First update settings data
      await updateSettingsMutation.mutateAsync(data);
      
      // Then handle logo upload if a new logo was selected
      if (selectedLogo) {
        setUploadingLogo(true);
        const formData = new FormData();
        formData.append('logo', selectedLogo);
        
        try {
          await apiRequest('/api/admin/upload-logo', 'POST', formData);
          toast({
            title: "Success",
            description: "Admin settings and logo updated successfully.",
          });
          // Refresh the admin settings data
          queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
        } catch (error: any) {
          toast({
            title: "Partial success", 
            description: "Settings saved, but logo upload failed: " + (error.message || "Unknown error"),
            variant: "destructive",
          });
        } finally {
          setUploadingLogo(false);
          setSelectedLogo(null);
        }
      }
    } catch (error: any) {
      // Error handling already done by the mutation
    }
  };

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedLogo(file || null);
  };

  const removeLogo = async () => {
    try {
      await apiRequest('/api/admin/logo', 'DELETE');
      toast({
        title: "Logo removed",
        description: "Admin logo has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove logo",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Settings className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading admin settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground">
            Configure system-wide settings for the retail management platform
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Product Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Product Information
              </CardTitle>
              <CardDescription>
                Configure product branding and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Retail Management Platform"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Logo Upload Section */}
              <div className="space-y-4">
                <FormLabel>Admin Logo (Optional)</FormLabel>
                
                {adminSettings?.logoUrl && (
                  <div className="flex items-center space-x-4 mb-4">
                    <img
                      src={adminSettings.logoUrl}
                      alt="Admin Logo"
                      className="w-16 h-16 object-contain border rounded-lg"
                    />
                    <div className="flex flex-col space-y-1">
                      <span className="text-sm font-medium text-gray-700">Current Logo</span>
                      <span className="text-xs text-gray-500">This logo appears in the admin header</span>
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
                    disabled={updateSettingsMutation.isPending || uploadingLogo}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    data-testid="input-logo-upload"
                  />
                  {selectedLogo && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ New logo selected: {selectedLogo.name}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                System Settings
              </CardTitle>
              <CardDescription>
                Configure system-wide settings and limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maintenanceMode"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Maintenance Mode</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Enable maintenance mode to prevent new logins
                        </div>
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
                  control={form.control}
                  name="registrationEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Registration Enabled</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Allow new organization registration
                        </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxOrganizations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Organizations</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1000"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="systemTimeZone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Time Zone
                      </FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select time zone" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <div className="text-sm text-muted-foreground">
                        Default time zone for system displays and scheduling
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Security Configuration */}
              {/* Zoho Webhook Secret moved to Zoho Billing Integration section to avoid duplication */}
            </CardContent>
          </Card>

          {/* System Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Default Email Addresses
              </CardTitle>
              <CardDescription>
                Configure email addresses for system notifications and customer support
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="systemEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="noreply@pricecompare.com"
                          {...field}
                          data-testid="input-system-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supportEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Support Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="support@pricecompare.com"
                          {...field}
                          data-testid="input-support-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="submit"
              disabled={updateSettingsMutation.isPending || uploadingLogo}
              className="btn-orange-action"
            >
              {updateSettingsMutation.isPending || uploadingLogo ? 'Updating...' : 'Update Settings'}
            </Button>
            
            {uploadingLogo && (
              <div className="flex items-center justify-center space-x-2 pt-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                <span className="text-sm text-gray-600">Uploading logo...</span>
              </div>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
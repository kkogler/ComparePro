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
import { Settings, Mail, Shield, Building, Clock, Upload, X, CreditCard } from 'lucide-react';
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
  sendgridApiKey: z.string().optional(),
  smtp2goApiKey: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  systemEmail: z.string().email().optional(),
  systemTimeZone: z.string().optional(),
  maintenanceMode: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),
  maxOrganizations: z.number().optional(),
  supportEmail: z.string().email().optional(),
  companyName: z.string().optional(),
  logoUrl: z.string().optional(),
  includeUnmatchedUpcs: z.boolean().optional(),
  // Zoho Billing integration
  zohoBillingClientId: z.string().optional(),
  zohoBillingClientSecret: z.string().optional(),
  zohoBillingRefreshToken: z.string().optional(),
  zohoBillingOrgId: z.string().optional(),
  zohoBillingBaseUrl: z.string().optional(),
});

type AdminSettingsForm = z.infer<typeof adminSettingsSchema>;




interface AdminSettings {
  id: number;
  sendgridApiKey: string | null;
  smtp2goApiKey: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  systemEmail: string;
  systemTimeZone: string | null;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  maxOrganizations: number;
  supportEmail: string;
  companyName: string;
  logoUrl: string | null;
  includeUnmatchedUpcs: boolean;
  // Optional Zoho Billing credentials
  zohoBillingClientId?: string | null;
  zohoBillingClientSecret?: string | null;
  zohoBillingRefreshToken?: string | null;
  zohoBillingOrgId?: string | null;
  zohoBillingBaseUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingSMTP2GO, setIsTestingSMTP2GO] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);

  // Fetch admin settings
  const { data: adminSettings, isLoading } = useQuery<AdminSettings>({
    queryKey: ['/api/admin/settings'],
  });

  const form = useForm<AdminSettingsForm>({
    resolver: zodResolver(adminSettingsSchema),
    defaultValues: {
      sendgridApiKey: '',
      smtp2goApiKey: '',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      systemEmail: 'noreply@pricecompare.com',
      systemTimeZone: 'America/New_York',
      maintenanceMode: false,
      registrationEnabled: true,
      maxOrganizations: 1000,
      supportEmail: 'support@pricecompare.com',
      companyName: 'Retail Management Platform',
      logoUrl: '',
      includeUnmatchedUpcs: true,
      zohoBillingClientId: '',
      zohoBillingClientSecret: '',
      zohoBillingRefreshToken: '',
      zohoBillingOrgId: '',
      zohoBillingBaseUrl: 'https://www.zohoapis.com/billing/v1',
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (adminSettings) {
      form.reset({
        sendgridApiKey: adminSettings.sendgridApiKey || '',
        smtp2goApiKey: adminSettings.smtp2goApiKey || '',
        smtpHost: adminSettings.smtpHost || '',
        smtpPort: adminSettings.smtpPort || 587,
        smtpUser: adminSettings.smtpUser || '',
        smtpPassword: adminSettings.smtpPassword || '',
        systemEmail: adminSettings.systemEmail || 'noreply@pricecompare.com',
        systemTimeZone: adminSettings.systemTimeZone || 'America/New_York',
        maintenanceMode: adminSettings.maintenanceMode || false,
        registrationEnabled: adminSettings.registrationEnabled || true,
        maxOrganizations: adminSettings.maxOrganizations || 1000,
        supportEmail: adminSettings.supportEmail || 'support@pricecompare.com',
        companyName: adminSettings.companyName || 'Retail Management Platform',
        includeUnmatchedUpcs: adminSettings.includeUnmatchedUpcs || true,
        logoUrl: adminSettings.logoUrl || '',
        zohoBillingClientId: (adminSettings as any).zohoBillingClientId || '',
        zohoBillingClientSecret: (adminSettings as any).zohoBillingClientSecret || '',
        zohoBillingRefreshToken: (adminSettings as any).zohoBillingRefreshToken || '',
        zohoBillingOrgId: (adminSettings as any).zohoBillingOrgId || '',
        zohoBillingBaseUrl: (adminSettings as any).zohoBillingBaseUrl || 'https://www.zohoapis.com/billing/v1',
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

  // Test SendGrid email mutation
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/test-email', 'POST', {
        email: form.getValues('supportEmail') || form.getValues('systemEmail'),
        provider: 'sendgrid',
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "SendGrid test email sent" : "SendGrid test failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "SendGrid test failed",
        description: error.message || "Failed to send test email.",
        variant: "destructive",
      });
    },
  });

  // Test SMTP2GO email mutation
  const testSMTP2GOMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/test-email', 'POST', {
        email: form.getValues('supportEmail') || form.getValues('systemEmail'),
        provider: 'smtp2go',
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "SMTP2GO test email sent" : "SMTP2GO test failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "SMTP2GO test failed",
        description: error.message || "Failed to send test email.",
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

  const handleTestSendGridEmail = async () => {
    setIsTestingEmail(true);
    await testEmailMutation.mutateAsync();
    setIsTestingEmail(false);
  };

  const handleTestSMTP2GOEmail = async () => {
    setIsTestingSMTP2GO(true);
    await testSMTP2GOMutation.mutateAsync();
    setIsTestingSMTP2GO(false);
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
          {/* System Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                System Email Configuration
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

          {/* SendGrid Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SendGrid Email Provider
              </CardTitle>
              <CardDescription>
                Configure SendGrid for email delivery (requires paid subscription)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="sendgridApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SendGrid API Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="SG.****"
                        {...field}
                        data-testid="input-sendgrid-api-key"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestSendGridEmail}
                  disabled={isTestingEmail || testEmailMutation.isPending}
                  data-testid="button-test-sendgrid"
                >
                  {isTestingEmail ? 'Sending...' : 'Test SendGrid'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  Send a test email via SendGrid
                </span>
              </div>
            </CardContent>
          </Card>

          {/* SMTP2GO Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SMTP2GO Email Provider (Alternative)
              </CardTitle>
              <CardDescription>
                Configure SMTP2GO for email delivery (1,000 free emails per month)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="smtp2goApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP2GO API Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="api-****"
                        {...field}
                        data-testid="input-smtp2go-api-key"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestSMTP2GOEmail}
                  disabled={isTestingSMTP2GO || testSMTP2GOMutation.isPending}
                  data-testid="button-test-smtp2go"
                >
                  {isTestingSMTP2GO ? 'Sending...' : 'Test SMTP2GO'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  Send a test email via SMTP2GO
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Legacy SMTP Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Legacy SMTP Configuration (Optional)
              </CardTitle>
              <CardDescription>
                Configure custom SMTP server (advanced users only)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="smtpHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Host</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="smtp.gmail.com"
                          {...field}
                          data-testid="input-smtp-host"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtpPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Port</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="587"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            if (v === '') return field.onChange(undefined);
                            const n = Number(v);
                            if (!Number.isNaN(n)) field.onChange(n);
                          }}
                          data-testid="input-smtp-port"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtpUser"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Username</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="username"
                          {...field}
                          data-testid="input-smtp-user"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

        {/* Zoho Billing Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Zoho Billing Integration
            </CardTitle>
            <CardDescription>
              Configure Zoho Billing credentials and webhook verification secret
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="zohoBillingClientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Zoho OAuth Client ID" {...field} />
                    </FormControl>
                    <div className="text-sm text-muted-foreground">From Zoho API console (OAuth app). Required for API calls; not used for webhooks.</div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zohoBillingClientSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Secret</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Zoho OAuth Client Secret" {...field} />
                    </FormControl>
                    <div className="text-sm text-muted-foreground">Paired with Client ID for OAuth. Keep secure. This is different from the Webhook Secret.</div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zohoBillingRefreshToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Refresh Token</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Zoho OAuth Refresh Token" {...field} />
                    </FormControl>
                    <div className="text-sm text-muted-foreground">Obtained once via OAuth (self-client or redirect). Used to mint access tokens. Not shown on the webhook screen.</div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zohoBillingOrgId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Zoho Billing Organization ID" {...field} />
                    </FormControl>
                    <div className="text-sm text-muted-foreground">Required in header X-com-zoho-subscriptions-organizationid for API requests.</div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="zohoBillingBaseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Base URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.zohoapis.com/billing/v1" {...field} />
                    </FormControl>
                    <div className="text-sm text-muted-foreground">Defaults to US (`zohoapis.com`). Use region-specific base if needed (eu, in, au, jp).</div>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>
          </CardContent>
        </Card>

          {/* System Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                System Configuration
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

          {/* Company Information */}
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
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
import { useToast } from '@/hooks/use-toast';
import { Settings, Mail, CreditCard } from 'lucide-react';

const integrationsSchema = z.object({
  sendgridApiKey: z.string().optional(),
  smtp2goApiKey: z.string().optional(),
  zohoBillingClientId: z.string().optional(),
  zohoBillingClientSecret: z.string().optional(),
  zohoBillingRefreshToken: z.string().optional(),
  zohoBillingOrgId: z.string().optional(),
  zohoBillingBaseUrl: z.string().optional(),
});

type IntegrationsForm = z.infer<typeof integrationsSchema>;

interface AdminSettings {
  id: number;
  sendgridApiKey: string | null;
  smtp2goApiKey: string | null;
  zohoBillingClientId?: string | null;
  zohoBillingClientSecret?: string | null;
  zohoBillingRefreshToken?: string | null;
  zohoBillingOrgId?: string | null;
  zohoBillingBaseUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminIntegrations() {
  const { toast } = useToast();
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingSMTP2GO, setIsTestingSMTP2GO] = useState(false);

  // Fetch admin settings
  const { data: adminSettings, isLoading } = useQuery<AdminSettings>({
    queryKey: ['/api/admin/settings'],
  });

  const form = useForm<IntegrationsForm>({
    resolver: zodResolver(integrationsSchema),
    defaultValues: {
      sendgridApiKey: '',
      smtp2goApiKey: '',
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
        zohoBillingClientId: (adminSettings as any).zohoBillingClientId || '',
        zohoBillingClientSecret: (adminSettings as any).zohoBillingClientSecret || '',
        zohoBillingRefreshToken: (adminSettings as any).zohoBillingRefreshToken || '',
        zohoBillingOrgId: (adminSettings as any).zohoBillingOrgId || '',
        zohoBillingBaseUrl: (adminSettings as any).zohoBillingBaseUrl || 'https://www.zohoapis.com/billing/v1',
      });
    }
  }, [adminSettings, form]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: IntegrationsForm) => {
      const response = await apiRequest('/api/admin/settings', 'PUT', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({
        title: "Integrations updated",
        description: "Integration settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update integration settings.",
        variant: "destructive",
      });
    },
  });

  // Test SendGrid email mutation
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/test-email', 'POST', {
        email: 'test@example.com',
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
      // Get the current user's email or admin settings email for testing
      const testEmail = adminSettings?.systemEmail || 'test@example.com';
      const response = await apiRequest('/api/test-email', 'POST', {
        email: testEmail,
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

  const onSubmit = async (data: IntegrationsForm) => {
    await updateSettingsMutation.mutateAsync(data);
  };

  const handleTestSendGridEmail = async () => {
    setIsTestingEmail(true);
    try {
      await testEmailMutation.mutateAsync();
    } catch (error) {
      // Error already handled by mutation's onError
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleTestSMTP2GOEmail = async () => {
    setIsTestingSMTP2GO(true);
    try {
      await testSMTP2GOMutation.mutateAsync();
    } catch (error) {
      // Error already handled by mutation's onError
    } finally {
      setIsTestingSMTP2GO(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Settings className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">
            Configure third-party service integrations
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Zoho Billing Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Zoho Billing (Subscriptions)
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

          {/* SMTP2GO Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SMTP2GO (Email)
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

          {/* SendGrid Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SendGrid (Email)
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

          {/* Save Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="btn-orange-action"
            >
              {updateSettingsMutation.isPending ? 'Updating...' : 'Update Integrations'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}


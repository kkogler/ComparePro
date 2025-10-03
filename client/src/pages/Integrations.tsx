import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Copy, Upload, X, Clock, CheckCircle, Eye, EyeOff, Server, Building2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { UserSettings } from "@/lib/types";

// Integrations form schema
const integrationsSchema = z.object({
  webhookUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().optional(),
  swipeSimpleTax: z.enum(["TRUE", "FALSE"]).default("TRUE"),
  swipeSimpleTrackInventory: z.enum(["TRUE", "FALSE"]).default("TRUE"),
});

type IntegrationsFormData = z.infer<typeof integrationsSchema>;

export default function Integrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationSlug } = useAuth();
  
  // Form for integrations
  const integrationsForm = useForm<IntegrationsFormData>({
    resolver: zodResolver(integrationsSchema),
    defaultValues: {
      webhookUrl: "",
      apiKey: "",
      swipeSimpleTax: "TRUE",
      swipeSimpleTrackInventory: "TRUE",
    },
  });

  // Fetch current integration settings
  const { data: integrationSettings, isLoading } = useQuery({
    queryKey: [`/org/${organizationSlug}/api/settings/integrations`],
    queryFn: async () => {
      const response = await apiRequest(`/org/${organizationSlug}/api/settings/integrations`, 'GET');
      return await response.json();
    },
    enabled: !!organizationSlug,
  });

  // Update form when data is loaded
  useEffect(() => {
    if (integrationSettings) {
      integrationsForm.reset(integrationSettings);
    }
  }, [integrationSettings, integrationsForm]);

  // Update integrations mutation
  const updateIntegrationsMutation = useMutation({
    mutationFn: async (data: IntegrationsFormData) => {
      if (!organizationSlug) {
        throw new Error('Organization not found');
      }
      const response = await apiRequest(`/org/${organizationSlug}/api/settings/integrations`, 'PUT', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration settings updated",
        description: "Your integration settings have been saved successfully.",
      });
      if (organizationSlug) {
        queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/settings/integrations`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error updating integration settings",
        description: error.message || "Failed to update integration settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onIntegrationsSubmit = (data: IntegrationsFormData) => {
    updateIntegrationsMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="p-6">Loading integration settings...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Manage your third-party integrations and API settings</p>
        </div>
      </div>

      <Form {...integrationsForm}>
        <form onSubmit={integrationsForm.handleSubmit(onIntegrationsSubmit)} className="space-y-6">
          
          {/* Webhook Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Webhook Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={integrationsForm.control}
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://your-webhook-endpoint.com/receive-data" />
                    </FormControl>
                    <FormDescription>
                      The URL where the system will send data for events like new orders or product updates.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={integrationsForm.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter API Key if required for authentication" />
                    </FormControl>
                    <FormDescription>
                      An optional API key to authenticate requests sent to your webhook URL.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Swipe Simple Download Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Swipe Simple Download Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={integrationsForm.control}
                name="swipeSimpleTax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="max-w-xs">
                          <SelectValue placeholder="Select tax setting" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TRUE">TRUE</SelectItem>
                        <SelectItem value="FALSE">FALSE</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Set the tax value for Swipe Simple CSV exports. Default is TRUE.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={integrationsForm.control}
                name="swipeSimpleTrackInventory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Track Inventory</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="max-w-xs">
                          <SelectValue placeholder="Select track inventory setting" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TRUE">TRUE</SelectItem>
                        <SelectItem value="FALSE">FALSE</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Set the track inventory value for Swipe Simple CSV exports. Default is TRUE.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  These settings control the Tax and Track_inventory column values when downloading Swipe Simple CSV files from vendor orders.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button - Bottom Right */}
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={updateIntegrationsMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateIntegrationsMutation.isPending ? "Saving..." : "Save All Settings"}
            </Button>
          </div>

        </form>
      </Form>

    </div>
  );
}

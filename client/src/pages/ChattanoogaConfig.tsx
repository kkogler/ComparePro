import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { TestTube2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { buildVendorApiUrl } from "@/lib/vendor-utils";

// Only SID and Token are required for real-time API calls.
const chattanoogaConfigSchema = z.object({
  sid: z.string().min(1, "SID is required"),
  token: z.string().min(1, "Token is required"),
});

type ChattanoogaConfigForm = z.infer<typeof chattanoogaConfigSchema>;

interface ChattanoogaConfigProps {
  vendor: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChattanoogaConfig({ vendor, isOpen, onClose, onSuccess }: ChattanoogaConfigProps) {
  const { toast } = useToast();
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);

  // Debug logging for slug
  console.log('🔍 CHATTANOOGA CONFIG: Component loaded with slug:', slug);

  const form = useForm<ChattanoogaConfigForm>({
    resolver: zodResolver(chattanoogaConfigSchema),
    defaultValues: {
      sid: "",
      token: "",
    },
  });

  const loadExistingCredentials = useCallback(async () => {
    if (!vendor || !slug) return;
    
    setIsLoadingCredentials(true);
    try {
      const apiUrl = buildVendorApiUrl(slug, vendor, 'credentials');
      console.log('🔍 CHATTANOOGA LOAD: Fetching credentials from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 CHATTANOOGA LOAD: Credentials loaded:', Object.keys(data));
        
        // Response format: { success: true, credentials: { sid, token } }
        const creds = data.credentials || {};
        console.log('🔍 CHATTANOOGA LOAD: Populating form with:', {
          sid: creds.sid ? `${creds.sid.substring(0, 8)}...` : 'EMPTY',
          token: creds.token ? 'PRESENT' : 'EMPTY'
        });
        
        form.reset({
          sid: creds.sid || "",
          token: creds.token || "",
        });
      } else {
        console.log('🔍 CHATTANOOGA LOAD: No existing credentials found (this is OK for new setup)');
      }
    } catch (error) {
      console.error('🔍 CHATTANOOGA LOAD: Error loading credentials:', error);
    } finally {
      setIsLoadingCredentials(false);
    }
  }, [vendor, slug, form]);

  // Load existing credentials when modal opens
  useEffect(() => {
    if (isOpen && vendor && slug) {
      loadExistingCredentials();
    }
  }, [isOpen, vendor, slug, loadExistingCredentials]);

  const handleSave = async (data: ChattanoogaConfigForm) => {
    if (!vendor?.id || !slug) return;
    
    setIsSaving(true);
    try {
      console.log('🔍 CHATTANOOGA SAVE DEBUG:', {
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorShortCode: vendor.vendorShortCode,
        sid: data.sid,
        tokenLength: data.token?.length || 0
      });

      // ✅ STANDARDIZED: Use vendor utility to get correct identifier
      const apiUrl = buildVendorApiUrl(slug, vendor, 'credentials');
      console.log('🔍 CHATTANOOGA SAVE: API URL:', apiUrl);

      // Persist only the required API credentials (SID and Token)
      const response = await apiRequest(apiUrl, 'POST', {
        sid: data.sid,
        token: data.token,
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Chattanooga Shooting Supply credentials saved successfully",
        });
        // Invalidate queries to refresh vendor data
        queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/vendors`] });
        queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/supported-vendors`] });
        onSuccess();
        onClose();
      } else {
        throw new Error('Failed to save credentials');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!vendor?.id || !slug) return;
    
    setIsTestingConnection(true);
    try {
      console.log('🔍 CHATTANOOGA TEST: Starting connection test');
      console.log('🔍 CHATTANOOGA TEST: Using vendor ID:', vendor.id);
      console.log('🔍 CHATTANOOGA TEST: Using vendor short code:', vendor.vendorShortCode);
      
      // ✅ STANDARDIZED: Use vendor utility to get correct identifier
      const apiUrl = buildVendorApiUrl(slug, vendor, 'test-connection');
      console.log('🔍 CHATTANOOGA TEST: API URL:', apiUrl);
      
      const response = await apiRequest(apiUrl, 'POST');
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Connection Successful",
          description: data.message || "Successfully connected to Chattanooga Shooting Supply",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.message || data.error || "Failed to connect to Chattanooga Shooting Supply",
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Connection Failed",
        description: message || "Unable to test connection. Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Chattanooga Shooting Admin Credentials</DialogTitle>
          <DialogDescription>
            SID and Token are required for real-time API access during Vendor Price Comparison. Other fields are not needed.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-2">
            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-xs text-blue-600 font-bold">!</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-1">API Credentials Required</h4>
              <p className="text-sm text-blue-700">
                Provide your SID and Token. These are used for real-time API calls during Vendor Price Comparison searches.
              </p>
            </div>
          </div>
        </div>


        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4" autoComplete="off">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SID *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Session identifier" 
                        autoComplete="off"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token *</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="API token"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTestingConnection || isSaving}
                className="flex-1"
              >
                <TestTube2 className="h-4 w-4 mr-2" />
                {isTestingConnection ? "Testing..." : "Test Connection"}
              </Button>
              
              <Button
                type="submit"
                disabled={isSaving || isTestingConnection}
                className="flex-1 btn-orange-action"
              >
                {isSaving ? "Saving..." : "Save Credentials"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
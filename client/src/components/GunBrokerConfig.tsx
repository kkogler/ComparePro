import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Settings, TestTube } from "lucide-react";
import { buildVendorApiUrl } from "@/lib/vendor-utils";

interface GunBrokerConfigProps {
  vendor?: any;
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  organizationSlug: string; // Required for API calls
}

export function GunBrokerConfig({ vendor, isOpen = false, onClose, onSuccess, organizationSlug }: GunBrokerConfigProps) {
  const [open, setOpen] = useState(isOpen);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [vendorShortCode, setVendorShortCode] = useState(vendor?.vendorShortCode || '');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // GunBroker uses admin credentials - show status only
  const adminCredentials = vendor?.credentials;
  const hasAdminCredentials = !!(adminCredentials?.devKeyLast4 || adminCredentials?.configured !== false);
  const usesAdminCredentials = adminCredentials?.usesAdminCredentials === true;

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  // GunBroker credentials are admin-only - no saving from store level
  const handleAdminRedirect = () => {
    toast({
      title: "Admin Configuration Required",
      description: "GunBroker credentials must be configured by an administrator. Please contact your admin.",
      variant: "default"
    });
  };

  const testConnection = useMutation({
    mutationFn: async () => {
      // ✅ STANDARDIZED: Use vendor utility to get correct identifier
      const apiUrl = buildVendorApiUrl(organizationSlug, vendor, 'test-connection-alt');
      console.log('🔍 GUNBROKER TEST API URL:', apiUrl);
      
      const response = await apiRequest(apiUrl, 'POST', {});
      return await response.json();
    },
    onSuccess: (result: any) => {
      if (result?.success) {
        toast({ title: "Success", description: "GunBroker connection test passed using admin credentials!" });
      } else {
        toast({
          title: "Connection Failed",
          description: result?.message || 'Connection test failed',
          variant: "destructive"
        });
      }
      setIsTestingConnection(false);
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test connection",
        variant: "destructive"
      });
      setIsTestingConnection(false);
    }
  });

  const handleTestConnection = () => {
    setIsTestingConnection(true);
    testConnection.mutate();
  };

  const handleSaveShortCode = async () => {
    if (!vendor?.id || !organizationSlug) return;
    
    setIsSaving(true);
    try {
      const vendorUpdateUrl = `/org/${organizationSlug}/api/vendors/${vendor.id}`;
      await apiRequest(vendorUpdateUrl, 'PATCH', { vendorShortCode });
      
      toast({
        title: "Success",
        description: "Vendor short code saved successfully.",
      });
      
      // Invalidate queries to refresh vendor data
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/vendors`] });
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/supported-vendors`] });
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save vendor short code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      onClose?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-[90vw] sm:max-w-[720px] md:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>GunBroker Connection Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Admin Credentials Status */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              GunBroker uses admin-level credentials shared across all stores.
            </p>
            
            {hasAdminCredentials ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium">Admin credentials configured</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-sm font-medium">Admin credentials not configured</span>
              </div>
            )}
          </div>

          {/* Store-Level Information */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Store Configuration</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              As a store, you can only enable or disable GunBroker for price comparison searches. 
              Credentials are managed by administrators.
            </p>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <p>• No store-level credentials required</p>
              <p>• Uses shared admin API access</p>
              <p>• Control visibility via enable/disable toggle</p>
            </div>
          </div>

          {/* Vendor Short Code */}
          <div>
            <Label htmlFor="vendorShortCode">Vendor Short Code</Label>
            <Input
              id="vendorShortCode"
              type="text"
              placeholder="e.g., GunBroker"
              value={vendorShortCode}
              onChange={(e) => setVendorShortCode(e.target.value)}
            />
            <p className="text-sm text-gray-500 mt-1">
              This value will be used in CSV exports and webhooks for MicroBiz integration.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {hasAdminCredentials && (
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="flex-1"
              >
                <TestTube className="h-4 w-4 mr-2" />
                {isTestingConnection ? "Testing..." : "Test Connection"}
              </Button>
            )}
            
            <Button
              type="button"
              onClick={handleSaveShortCode}
              disabled={isSaving}
              className="flex-1 btn-orange-action"
            >
              {isSaving ? "Saving..." : "Save Vendor Code"}
            </Button>
            
            {!hasAdminCredentials && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAdminRedirect}
                className="flex-1"
              >
                <Settings className="h-4 w-4 mr-2" />
                Contact Admin
              </Button>
            )}
          </div>

          {/* Admin Contact Information */}
          {!hasAdminCredentials && (
            <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Need GunBroker access?</strong> Contact your administrator to configure 
                GunBroker credentials in Admin &gt; Supported Vendors &gt; GunBroker Sync Settings.
              </p>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GunBrokerConfig;
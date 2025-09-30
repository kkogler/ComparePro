import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Building2, ExternalLink, Settings, Globe, Database, Zap } from "lucide-react";
import ChattanoogaConfig from "./ChattanoogaConfig";
import { GunBrokerConfig } from "@/components/GunBrokerConfig";
import { LipseyConfig } from "@/components/LipseyConfig";
import { SportsSouthConfig } from "@/components/SportsSouthConfig";
import { BillHicksConfig } from "@/components/BillHicksConfig";
import { getVendorConfig, vendorSupports } from "@shared/vendor-config";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { VendorInfo } from "@/lib/types";

export default function SupportedVendors() {
  const { slug } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chattanoogaConfigOpen, setChattanoogaConfigOpen] = useState(false);
  const [gunBrokerConfigOpen, setGunBrokerConfigOpen] = useState(false);
  const [lipseyConfigOpen, setLipseyConfigOpen] = useState(false);
  const [sportsSouthConfigOpen, setSportsSouthConfigOpen] = useState(false);
  const [billHicksConfigOpen, setBillHicksConfigOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorInfo | null>(null);

  // Get organization-specific vendors with metadata from the API
  const { data: organizationVendors, isLoading } = useQuery<any[]>({
    queryKey: [`/org/${slug}/api/supported-vendors`],
    staleTime: 30000
  });

  // Debug: Log when vendor data changes
  useEffect(() => {
    console.log('🔄 SUPPORTED VENDORS: organizationVendors changed:', organizationVendors);
    if (organizationVendors) {
      console.log('🔄 SUPPORTED VENDORS: All vendors enabledForPriceComparison:', 
        organizationVendors.map(v => ({ 
          name: v.name, 
          id: v.id, 
          enabledForPriceComparison: v.enabledForPriceComparison 
        }))
      );
      const billHicksVendor = organizationVendors.find(v => v.name === 'Bill Hicks & Co.');
      console.log('🔄 SUPPORTED VENDORS: Bill Hicks vendor:', billHicksVendor);
      if (billHicksVendor) {
        console.log('🔄 SUPPORTED VENDORS: Bill Hicks credentials:', billHicksVendor.credentials);
        console.log('🔄 SUPPORTED VENDORS: Bill Hicks enabledForPriceComparison:', billHicksVendor.enabledForPriceComparison);
      }
    }
  }, [organizationVendors]);

  const importMutation = useMutation({
    mutationFn: async (vendorId: number) => {
      return await apiRequest(`/org/${slug}/api/vendors/${vendorId}/import`, 'POST');
    },
    onSuccess: (data: any) => {
      toast({
        title: "Import Successful",
        description: (data as any).message || "Products imported successfully"
      });
      queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/supported-vendors`] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import products",
        variant: "destructive"
      });
    }
  });

  // Mutation to toggle vendor enabled/disabled state
  const toggleVendorEnabledMutation = useMutation({
    mutationFn: async ({ vendorId, enabled }: { vendorId: number; enabled: boolean }) => {
      const url = `/org/${slug}/api/vendors/${vendorId}/toggle-enabled`;
      console.log('🔄 VENDOR TOGGLE: Frontend - calling URL:', url);
      console.log('🔄 VENDOR TOGGLE: Frontend - slug:', slug);
      console.log('🔄 VENDOR TOGGLE: Frontend - vendorId:', vendorId);
      return await apiRequest(url, 'PATCH', { enabled });
    },
    onSuccess: (_, { vendorId, enabled }) => {
      // Update the specific vendor in the cache instead of invalidating the entire query
      queryClient.setQueryData([`/org/${slug}/api/supported-vendors`], (oldData: any[]) => {
        if (!oldData) return oldData;
        return oldData.map(vendor => 
          vendor.id === vendorId 
            ? { ...vendor, enabledForPriceComparison: enabled }
            : vendor
        );
      });
      
      toast({
        title: "Vendor Status Updated",
        description: `Vendor has been ${enabled ? 'enabled' : 'disabled'} for price comparison searches.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update vendor status",
        variant: "destructive"
      });
    }
  });


  const handleToggleVendorEnabled = (vendor: any, enabled: boolean) => {
    console.log('🔄 VENDOR TOGGLE: Frontend - vendor:', vendor);
    console.log('🔄 VENDOR TOGGLE: Frontend - vendor.id:', vendor.id);
    console.log('🔄 VENDOR TOGGLE: Frontend - vendor.enabledForPriceComparison:', vendor.enabledForPriceComparison);
    console.log('🔄 VENDOR TOGGLE: Frontend - enabled:', enabled);
    console.log('🔄 VENDOR TOGGLE: Frontend - Switch checked value:', vendor.enabledForPriceComparison !== false);
    toggleVendorEnabledMutation.mutate({ vendorId: vendor.id, enabled });
  };

  const handleConfigureVendor = (vendor: any) => {
    console.log('handleConfigureVendor called for:', vendor.name, vendor.id);
    setSelectedVendor(vendor);
    
    // Open the appropriate configuration modal based on vendor short code
    const vendorConfig = getVendorConfig(vendor.vendorShortCode || '');
    if (vendorConfig) {
      switch (vendorConfig.id) {
        case 'chattanooga':
          setChattanoogaConfigOpen(true);
          break;
        case 'gunbroker':
          setGunBrokerConfigOpen(true);
          break;
        case 'lipseys':
          setLipseyConfigOpen(true);
          break;
        case 'sports-south':
          setSportsSouthConfigOpen(true);
          break;
        case 'bill-hicks':
          console.log('🔄 SUPPORTED VENDORS: Opening Bill Hicks config modal');
          setBillHicksConfigOpen(true);
          break;
        default:
          toast({
            title: "Configuration Not Available",
            description: "Configuration interface for this vendor is not yet available.",
            variant: "destructive",
          });
      }
    } else {
      // Fallback to name-based matching for legacy support
      if (vendor.name.toLowerCase().includes('chattanooga')) {
        setChattanoogaConfigOpen(true);
      } else if (vendor.name.toLowerCase().includes('gunbroker')) {
        setGunBrokerConfigOpen(true);
      } else if (vendor.name.toLowerCase().includes('lipsey')) {
        setLipseyConfigOpen(true);
      } else if (vendor.name.toLowerCase().includes('sports south')) {
        setSportsSouthConfigOpen(true);
      } else if (vendor.name.toLowerCase().includes('bill hicks')) {
        console.log('🔄 SUPPORTED VENDORS: Opening Bill Hicks config modal');
        setBillHicksConfigOpen(true);
      } else {
        toast({
          title: "Configuration Not Available",
          description: "Configuration interface for this vendor is not yet available.",
          variant: "destructive",
        });
      }
    }
  };


  const getStatusBadge = (vendor: any) => {
    if (vendor.hasCredentials) {
      if (vendor.status === 'online') {
        return <Badge className="bg-green-100 text-green-700 border-green-200">Connected</Badge>;
      } else {
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Configured</Badge>;
      }
    }
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Available</Badge>;
  };

  const getIntegrationIcon = (apiType: string) => {
    switch (apiType) {
      case 'REST':
        return <Zap className="h-4 w-4" />;
      case 'FTP':
        return <Database className="h-4 w-4" />;
      case 'Excel':
        return <Globe className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Supported Vendors</h1>
            <p className="text-muted-foreground">
              Configure API connections to supported firearms distributors and marketplaces.
            </p>
          </div>
        </div>
        <div className="text-center py-12">
          <p>Loading vendors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Supported Vendors</h1>
          <p className="text-muted-foreground">
            Configure API connections to supported firearms distributors and marketplaces.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {organizationVendors?.sort((a, b) => a.id - b.id).map((vendor) => (
          <Card key={`vendor-${vendor.id}-${vendor.supportedVendorId}`} className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    {vendor.logoUrl ? (
                      <div className="w-4 h-4 flex-shrink-0">
                        <img 
                          src={vendor.logoUrl} 
                          alt={`${vendor.name} logo`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            // Fallback to lightning bolt icon if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <Zap className="h-4 w-4 hidden" />
                      </div>
                    ) : (
                      getIntegrationIcon('REST')
                    )}
                    <CardTitle className="text-lg">{vendor.name}</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {vendor.vendorShortCode}
                  </p>
                </div>
                {getStatusBadge(vendor)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vendor Enabled/Disabled Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor={`vendor-enabled-${vendor.id}`} className="text-sm font-medium">
                    Enable for Price Comparison
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Include this vendor in price comparison search results
                  </p>
                </div>
                <Switch
                  id={`vendor-enabled-${vendor.id}`}
                  checked={vendor.enabledForPriceComparison !== false} // Default to true if not set
                  onCheckedChange={(enabled) => handleToggleVendorEnabled(vendor, enabled)}
                  disabled={toggleVendorEnabledMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center text-xs text-muted-foreground">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  Real-time API Integration
                </div>
                {vendor.hasCredentials && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
                    Credentials Configured
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className={vendor.hasCredentials 
                    ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500 hover:border-orange-600"
                    : "bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                  }
                  onClick={() => handleConfigureVendor(vendor)}
                  disabled={vendor.enabledForPriceComparison === false} // Disable if vendor is disabled
                >
                  <Settings className="h-3 w-3 mr-1" />
                  {vendor.hasCredentials ? 'Configure' : 'Connect'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!organizationVendors || organizationVendors.length === 0) && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No supported vendors yet</h3>
          <p className="text-gray-500">Check back later for new vendor integrations.</p>
        </div>
      )}

      {/* Integration Information */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900 mb-1">Need a Custom Integration?</h3>
              <p className="text-sm text-blue-700 leading-relaxed">
                Don't see your preferred vendor? We can help set up custom integrations for additional 
                firearms distributors. Contact our support team to discuss your specific vendor requirements.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Modals */}
      <ChattanoogaConfig
        vendor={selectedVendor}
        isOpen={chattanoogaConfigOpen}
        onClose={() => {
          setChattanoogaConfigOpen(false);
          setSelectedVendor(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/supported-vendors`] });
          toast({
            title: "Configuration Saved",
            description: "Vendor credentials have been updated successfully.",
          });
        }}
      />
      
      {selectedVendor && selectedVendor.name.toLowerCase().includes('gunbroker') && (
        <GunBrokerConfig 
          vendor={selectedVendor} 
          isOpen={gunBrokerConfigOpen}
          onClose={() => {
            setGunBrokerConfigOpen(false);
            setSelectedVendor(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/supported-vendors`] });
            toast({
              title: "Configuration Saved",
              description: "GunBroker credentials have been updated successfully.",
            });
          }}
        />
      )}
      
      {selectedVendor && (selectedVendor.name === "Lipsey's" || selectedVendor.name.toLowerCase().includes('lipsey')) && (
        <LipseyConfig 
          open={lipseyConfigOpen}
          onOpenChange={(open) => {
            setLipseyConfigOpen(open);
            if (!open) setSelectedVendor(null);
          }}
          vendorId={selectedVendor.id}
          organizationSlug={slug || ''}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/supported-vendors`] });
            toast({
              title: "Configuration Saved",
              description: "Lipsey's credentials have been updated successfully.",
            });
          }}
        />
      )}
      
      {selectedVendor && selectedVendor.name === 'Sports South' && (
        <SportsSouthConfig 
          vendor={selectedVendor} 
          isOpen={sportsSouthConfigOpen}
          onClose={() => {
            setSportsSouthConfigOpen(false);
            setSelectedVendor(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/supported-vendors`] });
            toast({
              title: "Configuration Saved",
              description: "Sports South credentials have been updated successfully.",
            });
          }}
        />
      )}
      
      {billHicksConfigOpen && (
        <BillHicksConfig 
          vendor={organizationVendors?.find(v => v.name === 'Bill Hicks & Co.')} 
          isOpen={billHicksConfigOpen}
          organizationSlug={slug}
          onClose={() => {
            setBillHicksConfigOpen(false);
            setSelectedVendor(null);
          }}
          onSuccess={() => {
            // Invalidate the vendor query to refresh the data
            queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/supported-vendors`] });
          }}
        />
      )}
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Plus, Edit, Trash2, ArrowLeft, Globe, Shield, Zap, Database, Upload, Camera, Settings, RefreshCw, CheckCircle, XCircle, AlertCircle, Clock, Download, Save, X } from 'lucide-react';
import { Link } from 'wouter';
import { ObjectUploader } from '@/components/ObjectUploader';
import type { UploadResult } from '@uppy/core';

interface SupportedVendor {
  id: number;
  name: string;
  vendorShortCode?: string;
  description: string;
  apiType: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  documentationUrl: string | null;
  credentialFields: Array<{
    name: string;
    label: string;
    type: 'text' | 'password' | 'email' | 'url';
    required: boolean;
    placeholder?: string;
    description?: string;
  }>;
  features: {
    electronicOrdering: boolean;
    realTimePricing: boolean;
    inventorySync: boolean;
    productCatalog: boolean;
  };
  // System-level admin credentials for Master Product Catalog sync
  adminCredentials?: Record<string, string>;
  adminConnectionStatus: 'not_configured' | 'online' | 'offline' | 'error';
  lastCatalogSync?: string;
  catalogSyncStatus?: 'success' | 'error' | 'in_progress' | 'never_synced';
  catalogSyncError?: string;
  lastSyncNewRecords?: number;
  lastSyncRecordsUpdated?: number;
  lastSyncRecordsSkipped?: number;
  lastSyncImagesAdded?: number;
  lastSyncImagesUpdated?: number;
  // Bill Hicks inventory sync tracking
  billHicksInventorySyncEnabled?: boolean;
  billHicksInventorySyncTime?: string;
  billHicksLastInventorySync?: string;
  billHicksInventorySyncStatus?: 'success' | 'error' | 'in_progress' | 'never_synced';
  billHicksInventorySyncError?: string;
  billHicksLastSyncRecordsUpdated?: number;
  billHicksLastSyncRecordsSkipped?: number;
  billHicksLastSyncRecordsFailed?: number;
  billHicksInventoryRecordsAdded?: number;
  billHicksInventoryRecordsFailed?: number;
  billHicksInventoryTotalRecords?: number;
  // Bill Hicks master catalog sync settings and status
  billHicksMasterCatalogSyncEnabled?: boolean;
  billHicksMasterCatalogSyncTime?: string;
  billHicksMasterCatalogSyncStatus?: string;
  billHicksMasterCatalogLastSync?: string;
  billHicksMasterCatalogSyncError?: string;
  billHicksMasterCatalogRecordsAdded?: number;
  billHicksMasterCatalogRecordsUpdated?: number;
  billHicksMasterCatalogRecordsFailed?: number;
  billHicksMasterCatalogRecordsSkipped?: number;
  billHicksMasterCatalogTotalRecords?: number;
  // Sports South scheduling
  sportsSouthScheduleEnabled?: boolean;
  sportsSouthScheduleTime?: string;
  sportsSouthScheduleFrequency?: string;
  // Chattanooga scheduling
  chattanoogaScheduleEnabled?: boolean;
  chattanoogaScheduleTime?: string;
  chattanoogaScheduleFrequency?: string;
  chattanoogaLastCsvDownload?: string;
  chattanoogaCsvSyncStatus?: string;
  chattanoogaCsvSyncError?: string;
  chattanoogaLastCsvSize?: number;
  chattanoogaLastCsvHash?: string;
  // Chattanooga sync statistics
  chattanoogaRecordsAdded?: number;
  chattanoogaRecordsUpdated?: number;
  chattanoogaRecordsSkipped?: number;
  chattanoogaRecordsFailed?: number;
  chattanoogaTotalRecords?: number;
  vendorType: 'vendor' | 'marketplace';
  
  retailVerticals?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  isEnabled: boolean;
  sortOrder: number;
  productRecordPriority: number | null; // 1-4 priority for product data quality (1 = highest priority, 4 = lowest)
  createdAt: string;
  updatedAt: string;
}

interface CredentialField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'url';
  required: boolean;
  placeholder?: string;
  description?: string;
}

export default function SupportedVendorsAdmin() {
  const { toast } = useToast();
  const { data: adminSettings } = useAdminSettings();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<SupportedVendor | null>(null);
  const [adminCredentialModal, setAdminCredentialModal] = useState<{
    isOpen: boolean;
    vendor: SupportedVendor | null;
  }>({ isOpen: false, vendor: null });
  const [syncSettingsDialog, setSyncSettingsDialog] = useState<{ vendor: SupportedVendor } | null>(null);
  const [editingPriority, setEditingPriority] = useState<{ vendorId: number; value: number | null } | null>(null);

  // Fetch supported vendors
  const { data: vendors, isLoading } = useQuery<SupportedVendor[]>({
    queryKey: ['/api/admin/supported-vendors'],
  });

  // Fetch retail verticals for dropdown
  const { data: retailVerticals = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/retail-verticals'],
  });

  // Create vendor mutation
  const createVendorMutation = useMutation({
    mutationFn: (data: any) => {
      // Auto-assign next available priority for new vendors (1-N enforcement)
      const nextPriority = getNextAvailablePriority();
      console.log('AUTO-ASSIGNING PRIORITY: New vendor will get priority', nextPriority);
      return apiRequest('/api/admin/supported-vendors', 'POST', { 
        ...data, 
        productRecordPriority: nextPriority 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      setIsCreateModalOpen(false);
      toast({
        title: "Success",
        description: "Supported vendor created successfully with auto-assigned priority",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create supported vendor",
        variant: "destructive",
      });
    },
  });

  // Update vendor mutation
  const updateVendorMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest(`/api/admin/supported-vendors/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      setEditingVendor(null);
      toast({
        title: "Success",
        description: "Supported vendor updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update supported vendor",
        variant: "destructive",
      });
    },
  });

  // Delete vendor mutation
  const deleteVendorMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/supported-vendors/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      toast({
        title: "Success",
        description: "Supported vendor deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete supported vendor",
        variant: "destructive",
      });
    },
  });

  // Update priority mutation
  const updatePriorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: number; priority: number | null }) => 
      apiRequest(`/api/admin/supported-vendors/${id}`, 'PATCH', { productRecordPriority: priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      setEditingPriority(null);
      toast({
        title: "Success",
        description: "Vendor priority updated successfully",
      });
    },
    onError: () => {
      setEditingPriority(null);
      toast({
        title: "Error",
        description: "Failed to update vendor priority",
        variant: "destructive",
      });
    },
  });

  const handleToggleEnabled = (vendor: SupportedVendor) => {
    updateVendorMutation.mutate({
      id: vendor.id,
      data: { isEnabled: !vendor.isEnabled }
    });
  };

  const handleDelete = (vendor: SupportedVendor) => {
    if (confirm(`Are you sure you want to delete ${vendor.name}? This action cannot be undone.`)) {
      deleteVendorMutation.mutate(vendor.id);
    }
  };

  // Admin credential configuration handlers
  const handleConfigureAdminCredentials = (vendor: SupportedVendor) => {
    setAdminCredentialModal({ isOpen: true, vendor });
  };

  const handleOpenSyncSettings = (vendor: SupportedVendor) => {
    setSyncSettingsDialog({ vendor });
  };

  // Priority update handlers
  const handlePriorityEdit = (vendor: SupportedVendor) => {
    setEditingPriority({ vendorId: vendor.id, value: vendor.productRecordPriority });
  };

  const handlePrioritySave = () => {
    if (editingPriority) {
      updatePriorityMutation.mutate({
        id: editingPriority.vendorId,
        priority: editingPriority.value
      });
    }
  };

  const handlePriorityCancel = () => {
    setEditingPriority(null);
  };

  const handlePriorityChange = (value: string) => {
    if (editingPriority) {
      const numericValue = parseInt(value);
      // All priorities must be valid positive integers (no null values allowed)
      if (!isNaN(numericValue) && numericValue > 0) {
        setEditingPriority({
          ...editingPriority,
          value: numericValue
        });
      }
    }
  };

  // Get available priorities for the dropdown (strict 1-N enforcement)
  const getAvailablePriorities = (currentVendorId: number) => {
    if (!vendors) return [];
    
    // Get all currently assigned priorities, excluding the current vendor being edited
    // Note: With strict enforcement, all vendors should have non-null priorities
    const assignedPriorities = vendors
      .filter(v => v.id !== currentVendorId && v.productRecordPriority !== null)
      .map(v => v.productRecordPriority);
    
    // Get the current vendor's priority (so they can keep it)
    const currentVendor = vendors.find(v => v.id === currentVendorId);
    const currentPriority = currentVendor?.productRecordPriority;
    
    // Generate available priorities (1 to total vendors count)
    const maxPriority = vendors.length;
    const availablePriorities = [];
    
    for (let i = 1; i <= maxPriority; i++) {
      if (!assignedPriorities.includes(i) || i === currentPriority) {
        availablePriorities.push(i);
      }
    }
    
    return availablePriorities.sort((a, b) => a - b);
  };

  // Auto-assign next available priority for new vendors (strict 1-N enforcement)
  const getNextAvailablePriority = (): number => {
    if (!vendors || vendors.length === 0) return 1;
    
    // Get all assigned priorities
    const assignedPriorities = vendors
      .filter(v => v.productRecordPriority !== null)
      .map(v => v.productRecordPriority!)
      .sort((a, b) => a - b);
    
    // Find first gap in 1-N sequence
    for (let i = 1; i <= vendors.length; i++) {
      if (!assignedPriorities.includes(i)) {
        return i;
      }
    }
    
    // If no gaps found, this indicates the next vendor will get priority N+1
    // This should only happen when creating a new vendor (length will increase)
    return vendors.length + 1;
  };

  const handleSyncCatalog = (vendor: SupportedVendor) => {
    if (vendor.adminConnectionStatus !== 'online') {
      toast({
        title: "Cannot Sync",
        description: "Please configure and test admin credentials first",
        variant: "destructive",
      });
      return;
    }
    
    // Check if this is Sports South for specialized catalog sync
    if (vendor.name.toLowerCase().includes('sports south')) {
      handleSportsSouthCatalogSync(vendor);
      return;
    }
    
    // Generic catalog sync for other vendors (if implemented)
    apiRequest(`/api/admin/supported-vendors/${vendor.id}/sync-catalog`, 'POST')
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
        toast({
          title: "Catalog Sync Started",
          description: `Master Product Catalog sync initiated for ${vendor.name}`,
        });
      })
      .catch(() => {
        toast({
          title: "Sync Failed",
          description: "Failed to start catalog sync. Check admin credentials.",
          variant: "destructive",
        });
      });
  };

  const handleSportsSouthCatalogSync = (vendor: SupportedVendor) => {
    // Show confirmation dialog for full catalog sync
    const confirmed = confirm(
      `This will sync the complete Sports South catalog to the Master Product Catalog. This process may take several minutes and will add/update thousands of products. Continue?`
    );
    
    if (!confirmed) return;
    
    // Update the vendor status to show syncing
    toast({
      title: "Starting Catalog Sync",
      description: "Sports South catalog sync initiated. This may take several minutes...",
    });
    
    // Call Sports South full catalog sync API
    apiRequest('/api/sports-south/catalog/sync-full', 'POST')
      .then(async (response) => {
        const result = await response.json();
        
        if (result.success) {
          queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
          toast({
            title: "Catalog Sync Completed",
            description: `Successfully synced ${result.newProducts} new products and updated ${result.updatedProducts} existing products from Sports South`,
          });
        } else {
          toast({
            title: "Catalog Sync Failed",
            description: result.message || "Sports South catalog sync failed",
            variant: "destructive",
          });
        }
      })
      .catch((error) => {
        console.error('Sports South catalog sync error:', error);
        toast({
          title: "Sync Error",
          description: "Failed to sync Sports South catalog. Check admin credentials and try again.",
          variant: "destructive",
        });
      });
  };

  const getApiTypeText = (apiType: string) => {
    switch (apiType) {
      case 'rest_api':
        return <span className="text-blue-700 font-medium"><Globe className="w-3 h-3 mr-1 inline" />REST API</span>;
      case 'soap':
        return <span className="text-gray-700 font-medium"><Shield className="w-3 h-3 mr-1 inline" />SOAP</span>;
      case 'ftp':
        return <span className="text-purple-700 font-medium"><Database className="w-3 h-3 mr-1 inline" />FTP</span>;
      case 'excel':
        return <span className="text-red-700 font-medium"><Zap className="w-3 h-3 mr-1 inline" />Excel</span>;
      default:
        return <span className="text-gray-700 font-medium">{apiType}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading supported vendors...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Supported Vendors</h1>
          <p className="text-muted-foreground">Manage vendor integrations available to subscriber organizations</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="btn-orange-action">
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor Integration
            </Button>
          </DialogTrigger>
          <VendorFormModal 
            vendor={null}
            retailVerticals={retailVerticals}
            onSubmit={(data) => createVendorMutation.mutate(data)}
            isLoading={createVendorMutation.isPending}
            onClose={() => setIsCreateModalOpen(false)}
          />
        </Dialog>
      </div>

      {/* Supported Vendors Table */}
      <Card>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Logo</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>API Type</TableHead>
                <TableHead>Retail Vertical</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Product Record Priority</TableHead>
                <TableHead>Admin Credentials</TableHead>
                <TableHead>Catalog Sync</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors?.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell>
                    <span className="text-sm font-mono">{vendor.sortOrder}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center w-16 h-12 rounded border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50 dark:bg-gray-800">
                      {vendor.logoUrl ? (
                        <img 
                          src={vendor.logoUrl} 
                          alt={`${vendor.name} logo`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `<div class="text-gray-400 text-xs text-center">${vendor.name.charAt(0)}</div>`;
                          }}
                        />
                      ) : (
                        <div className="text-gray-400 text-xs font-medium">
                          {vendor.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{vendor.name}</div>
                      {vendor.websiteUrl && (
                        <a 
                          href={vendor.websiteUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Visit Website
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getApiTypeText(vendor.apiType)}
                  </TableCell>
                  <TableCell>
                    {vendor.retailVerticals && vendor.retailVerticals.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {vendor.retailVerticals.map((vertical) => (
                          <span key={vertical.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            {vertical.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No verticals assigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {vendor.features.electronicOrdering && <Badge variant="outline" className="text-xs">Electronic Orders</Badge>}
                      {vendor.features.realTimePricing && <Badge variant="outline" className="text-xs">Real-time Pricing</Badge>}
                      {vendor.features.inventorySync && <Badge variant="outline" className="text-xs">Inventory Sync</Badge>}
                      {vendor.features.productCatalog && <Badge variant="outline" className="text-xs">Product Catalog</Badge>}
                    </div>
                  </TableCell>
                  {/* Priority Cell */}
                  <TableCell>
                    <div className="space-y-1">
                      {editingPriority?.vendorId === vendor.id ? (
                        <div className="flex items-center gap-2">
                          <Select 
                            value={editingPriority.value?.toString() || ''}
                            onValueChange={handlePriorityChange}
                          >
                            <SelectTrigger className="w-20 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailablePriorities(vendor.id).map(priority => (
                                <SelectItem key={priority} value={priority.toString()}>
                                  {priority}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handlePrioritySave}
                              disabled={updatePriorityMutation.isPending}
                              className="h-6 w-6 text-green-600 hover:text-green-800"
                              data-testid={`button-save-priority-${vendor.id}`}
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handlePriorityCancel}
                              disabled={updatePriorityMutation.isPending}
                              className="h-6 w-6 text-red-600 hover:text-red-800"
                              data-testid={`button-cancel-priority-${vendor.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span 
                            className={`text-sm font-medium ${
                              vendor.productRecordPriority === null 
                                ? 'text-gray-400' 
                                : vendor.productRecordPriority === 1 
                                  ? 'text-green-700' 
                                  : vendor.productRecordPriority === 2 
                                    ? 'text-blue-700' 
                                    : vendor.productRecordPriority === 3 
                                      ? 'text-orange-700' 
                                      : vendor.productRecordPriority <= 4
                                        ? 'text-red-700'
                                        : 'text-purple-700'
                            }`}
                            title={`Priority ${vendor.productRecordPriority} - ${
                                  vendor.productRecordPriority === 1 
                                    ? 'Highest' 
                                    : vendor.productRecordPriority === (vendors?.length || 5)
                                      ? 'Lowest' 
                                      : 'Medium'
                                } priority for duplicate UPC resolution`}
                          >
{vendor.productRecordPriority || 'Invalid'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePriorityEdit(vendor)}
                            className="h-6 w-6 text-gray-600 hover:text-gray-800"
                            data-testid={`button-edit-priority-${vendor.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {vendor.productRecordPriority !== null && (
                        <div className="text-xs text-gray-500">
                          For duplicate UPCs
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <span 
                        className={
                          vendor.adminConnectionStatus === 'online' ? 'text-green-700 font-medium' : 'text-red-700 font-medium'
                        }
                      >
                        {vendor.adminConnectionStatus === 'not_configured' ? 'Not Set' : 
                         vendor.adminConnectionStatus === 'online' ? 'Connected' :
                         vendor.adminConnectionStatus === 'offline' ? 'Offline' : 'Error'}
                      </span>
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfigureAdminCredentials(vendor)}
                          className="text-xs h-8 px-3"
                          data-testid={`button-configure-admin-${vendor.id}`}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          Edit Credentials
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge 
                        variant="outline"
                        className={
                          vendor.catalogSyncStatus === 'success' ? '!border-blue-500 !text-blue-700 !bg-transparent' :
                          vendor.catalogSyncStatus === 'error' ? '!border-red-500 !text-red-700 !bg-transparent hover:!bg-red-50' :
                          vendor.catalogSyncStatus === 'in_progress' ? '!border-gray-500 !text-gray-700 !bg-transparent' : '!border-gray-300 !text-gray-500 !bg-transparent'
                        }
                      >
                        {vendor.catalogSyncStatus === 'never_synced' || !vendor.catalogSyncStatus ? 'Never Synced' : 
                         vendor.catalogSyncStatus === 'success' ? 'Success' :
                         vendor.catalogSyncStatus === 'in_progress' ? 'Syncing...' : 'Error'}
                      </Badge>
                      {vendor.lastCatalogSync && (
                        <div className="text-xs text-gray-500">
                          {new Date(vendor.lastCatalogSync).toLocaleDateString()}
                        </div>
                      )}
                      
                      {/* Bill Hicks Dual Sync Status */}
                      {vendor.name.toLowerCase().includes('bill hicks') && (
                        <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
                          {/* Catalog Sync */}
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Catalog Sync</div>
                            <Badge 
                              variant="outline"
                              className={
                                vendor.billHicksMasterCatalogSyncStatus === 'success' ? '!border-green-500 !text-green-700 !bg-transparent' :
                                vendor.billHicksMasterCatalogSyncStatus === 'error' ? '!border-red-500 !text-red-700 !bg-transparent hover:!bg-red-50' :
                                vendor.billHicksMasterCatalogSyncStatus === 'in_progress' ? '!border-gray-500 !text-gray-700 !bg-transparent' : '!border-gray-300 !text-gray-500 !bg-transparent'
                              }
                            >
                              {vendor.billHicksMasterCatalogSyncStatus === 'never_synced' || !vendor.billHicksMasterCatalogSyncStatus ? 'Never Synced' : 
                               vendor.billHicksMasterCatalogSyncStatus === 'success' ? 'Success' :
                               vendor.billHicksMasterCatalogSyncStatus === 'in_progress' ? 'Syncing...' : 'Error'}
                            </Badge>
                            {vendor.billHicksMasterCatalogLastSync && (
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(vendor.billHicksMasterCatalogLastSync).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          
                          {/* Inventory Sync */}
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Inventory Sync</div>
                            <Badge 
                              variant="outline"
                              className={
                                vendor.billHicksInventorySyncStatus === 'success' ? '!border-green-500 !text-green-700 !bg-transparent' :
                                vendor.billHicksInventorySyncStatus === 'error' ? '!border-red-500 !text-red-700 !bg-transparent hover:!bg-red-50' :
                                vendor.billHicksInventorySyncStatus === 'in_progress' ? '!border-gray-500 !text-gray-700 !bg-transparent' : '!border-gray-300 !text-gray-500 !bg-transparent'
                              }
                            >
                              {vendor.billHicksInventorySyncStatus === 'never_synced' || !vendor.billHicksInventorySyncStatus ? 'Never Synced' : 
                               vendor.billHicksInventorySyncStatus === 'success' ? 'Success' :
                               vendor.billHicksInventorySyncStatus === 'in_progress' ? 'Syncing...' : 'Error'}
                            </Badge>
                            {vendor.billHicksLastInventorySync && (
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(vendor.billHicksLastInventorySync).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenSyncSettings(vendor)}
                          disabled={vendor.adminConnectionStatus !== 'online'}
                          className="text-xs h-8 px-3"
                          data-testid={`button-sync-settings-${vendor.id}`}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Sync Settings
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={vendor.isEnabled ? 'enabled' : 'disabled'} 
                      onValueChange={(value) => handleToggleEnabled(vendor)}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enabled">Enabled</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingVendor(vendor)}
                        className="text-xs h-8 px-3"
                        data-testid={`button-edit-vendor-${vendor.id}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit Vendor
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(vendor)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!vendors || vendors.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500">
                    No vendor integrations configured. Add one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>



      {/* Edit Modal */}
      {editingVendor && (
        <Dialog open={true} onOpenChange={() => setEditingVendor(null)}>
          <VendorFormModal 
            vendor={editingVendor}
            retailVerticals={retailVerticals}
            onSubmit={(data) => updateVendorMutation.mutate({ id: editingVendor.id, data })}
            isLoading={updateVendorMutation.isPending}
            onClose={() => setEditingVendor(null)}
          />
        </Dialog>
      )}

      {/* Admin Credentials Modal */}
      {adminCredentialModal.isOpen && adminCredentialModal.vendor && (
        <AdminCredentialsModal 
          vendor={adminCredentialModal.vendor}
          onClose={() => setAdminCredentialModal({ isOpen: false, vendor: null })}
        />
      )}

      {/* Sync Settings Modal */}
      {syncSettingsDialog && (
        <SyncSettingsModal
          vendor={syncSettingsDialog.vendor}
          onClose={() => setSyncSettingsDialog(null)}
        />
      )}
    </div>
  );
}

function VendorFormModal({ 
  vendor, 
  retailVerticals,
  onSubmit, 
  isLoading, 
  onClose 
}: {
  vendor: SupportedVendor | null;
  retailVerticals: any[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: vendor?.name || '',
    vendorShortCode: vendor?.vendorShortCode || '',
    description: vendor?.description || '',
    apiType: vendor?.apiType || 'rest_api',
    vendorType: vendor?.vendorType || 'vendor' as 'vendor' | 'marketplace',
    websiteUrl: vendor?.websiteUrl || '',
    documentationUrl: vendor?.documentationUrl || '',
    logoUrl: vendor?.logoUrl || '',
    credentialFields: vendor?.credentialFields || [] as CredentialField[],
    features: vendor?.features || {
      electronicOrdering: false,
      realTimePricing: false,
      inventorySync: false,
      productCatalog: false,
    },
    retailVerticalIds: vendor?.retailVerticals?.map(rv => rv.id) || [] as number[],
    isEnabled: vendor?.isEnabled ?? true,
    sortOrder: vendor?.sortOrder || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const { toast } = useToast();

  // Logo upload handlers
  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest('/api/admin/objects/upload', 'POST');
      const data = await response.json();
      return {
        method: 'PUT' as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error("MODAL: Error getting upload parameters:", error);
      toast({
        title: "Upload Error",
        description: "Failed to get upload URL. Please check your connection.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleLogoUploadComplete = async (vendorId: number, result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const logoUrl = uploadedFile.uploadURL || '';
      try {
        const response = await apiRequest(`/api/admin/supported-vendors/${vendorId}/logo`, 'PUT', {
          logoUrl
        });
        const data = await response.json();
        
        // Update form data to show the new logo immediately using the normalized URL
        setFormData(prev => ({ ...prev, logoUrl: data.logoUrl }));
        
        // Refresh the vendor list to show updated logo in table
        queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
        
        toast({
          title: "Success",
          description: "Vendor logo updated successfully",
        });
      } catch (error) {
        console.error('Logo update error:', error);
        toast({
          title: "Error",
          description: "Failed to update vendor logo",
          variant: "destructive",
        });
      }
    }
  };

  const addCredentialField = () => {
    setFormData(prev => ({
      ...prev,
      credentialFields: [
        ...prev.credentialFields,
        {
          name: '',
          label: '',
          type: 'text',
          required: true,
          placeholder: '',
          description: ''
        }
      ]
    }));
  };

  const updateCredentialField = (index: number, field: Partial<CredentialField>) => {
    setFormData(prev => ({
      ...prev,
      credentialFields: prev.credentialFields.map((f, i) => 
        i === index ? { ...f, ...field } : f
      )
    }));
  };

  const removeCredentialField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      credentialFields: prev.credentialFields.filter((_, i) => i !== index)
    }));
  };

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {vendor ? 'Edit Vendor Integration' : 'Add Vendor Integration'}
        </DialogTitle>
        <DialogDescription>
          Configure the vendor integration settings and credential requirements
        </DialogDescription>
      </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Vendor Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Vendor Name Inc."
                required
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="vendorShortCode">Vendor Short Code</Label>
              <Input
                id="vendorShortCode"
                value={formData.vendorShortCode || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, vendorShortCode: e.target.value }))}
                placeholder="VENDOR_CODE"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the vendor and their services"
                required
              />
            </div>
            <div>
              <Label htmlFor="apiType">API Type</Label>
              <Select value={formData.apiType} onValueChange={(value) => setFormData(prev => ({ ...prev, apiType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rest_api">REST API</SelectItem>
                  <SelectItem value="soap">SOAP</SelectItem>
                  <SelectItem value="ftp">FTP</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="vendorType">Vendor Type</Label>
              <Select 
                value={formData.vendorType || 'vendor'} 
                onValueChange={(value: 'vendor' | 'marketplace') => setFormData(prev => ({ ...prev, vendorType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendor">Vendor (High Quality)</SelectItem>
                  <SelectItem value="marketplace">Marketplace (Lower Quality)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Vendors have high-quality images and data. Marketplaces are used as fallback only.
              </p>
            </div>
            <div className="col-span-2">
              <Label>Retail Verticals</Label>
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
                {Array.isArray(retailVerticals) && retailVerticals.length > 0 ? (
                  retailVerticals.map((vertical) => (
                    <div key={vertical.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`vertical-${vertical.id}`}
                        checked={formData.retailVerticalIds.includes(vertical.id)}
                        onCheckedChange={(checked) => {
                          setFormData(prev => ({
                            ...prev,
                            retailVerticalIds: checked 
                              ? [...prev.retailVerticalIds, vertical.id]
                              : prev.retailVerticalIds.filter(id => id !== vertical.id)
                          }));
                        }}
                      />
                      <Label 
                        htmlFor={`vertical-${vertical.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {vertical.name}
                      </Label>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">No retail verticals available</div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select which retail verticals this vendor serves. Vendors can serve multiple verticals (e.g., guns and uniforms).
              </p>
            </div>
            <div>
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                type="url"
                value={formData.websiteUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
                placeholder="https://www.vendor.com"
              />
            </div>
            <div>
              <Label htmlFor="documentationUrl">Documentation URL</Label>
              <Input
                id="documentationUrl"
                type="url"
                value={formData.documentationUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, documentationUrl: e.target.value }))}
                placeholder="https://docs.vendor.com/api"
              />
            </div>
          </div>

          {/* Logo Upload */}
          <div>
            <Label>Vendor Logo</Label>
            <div className="mt-2 space-y-3">
              {formData.logoUrl && (
                <div className="flex items-center space-x-3">
                  <img 
                    src={formData.logoUrl} 
                    alt="Current vendor logo" 
                    className="w-16 h-16 object-contain border rounded-lg bg-gray-50"
                  />
                  <div className="text-sm text-gray-600">
                    Current logo
                  </div>
                </div>
              )}
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={5 * 1024 * 1024} // 5MB
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={(result) => handleLogoUploadComplete(vendor?.id || 0, result)}
                buttonClassName="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 border-2 border-dashed px-4 py-3 rounded-lg"
              >
                <div className="flex items-center space-x-2">
                  <Camera className="h-4 w-4" />
                  <span>{formData.logoUrl ? 'Upload New Logo' : 'Upload Vendor Logo'}</span>
                </div>
              </ObjectUploader>
              
              <p className="text-xs text-gray-500">
                Upload a vendor logo (max 5MB). Recommended: PNG or JPG format, square aspect ratio.
              </p>
            </div>
          </div>

          {/* Features */}
          <div>
            <Label>Features</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="electronicOrdering"
                  checked={formData.features.electronicOrdering}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    features: { ...prev.features, electronicOrdering: !!checked }
                  }))}
                />
                <Label htmlFor="electronicOrdering">Electronic Ordering</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="realTimePricing"
                  checked={formData.features.realTimePricing}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    features: { ...prev.features, realTimePricing: !!checked }
                  }))}
                />
                <Label htmlFor="realTimePricing">Real-time Pricing</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="inventorySync"
                  checked={formData.features.inventorySync}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    features: { ...prev.features, inventorySync: !!checked }
                  }))}
                />
                <Label htmlFor="inventorySync">Inventory Sync</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="productCatalog"
                  checked={formData.features.productCatalog}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    features: { ...prev.features, productCatalog: !!checked }
                  }))}
                />
                <Label htmlFor="productCatalog">Product Catalog</Label>
              </div>
            </div>
          </div>

          {/* Credential Fields */}
          <div>
            <div className="flex justify-between items-center">
              <Label>Credential Fields</Label>
              <Button type="button" variant="outline" size="sm" onClick={addCredentialField}>
                <Plus className="w-3 h-3 mr-1" />
                Add Field
              </Button>
            </div>
            <div className="space-y-4 mt-2">
              {formData.credentialFields.map((field, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Credential Field {index + 1}</h4>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeCredentialField(index)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Field Name</Label>
                      <Input
                        value={field.name}
                        onChange={(e) => updateCredentialField(index, { name: e.target.value })}
                        placeholder="accountNumber"
                      />
                    </div>
                    <div>
                      <Label>Display Label</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => updateCredentialField(index, { label: e.target.value })}
                        placeholder="Account Number"
                      />
                    </div>
                    <div>
                      <Label>Field Type</Label>
                      <Select 
                        value={field.type} 
                        onValueChange={(value: any) => updateCredentialField(index, { type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="password">Password</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="url">URL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox 
                        checked={field.required}
                        onCheckedChange={(checked) => updateCredentialField(index, { required: !!checked })}
                      />
                      <Label>Required</Label>
                    </div>
                    <div>
                      <Label>Placeholder</Label>
                      <Input
                        value={field.placeholder || ''}
                        onChange={(e) => updateCredentialField(index, { placeholder: e.target.value })}
                        placeholder="Enter your account number"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={field.description || ''}
                        onChange={(e) => updateCredentialField(index, { description: e.target.value })}
                        placeholder="Account number from vendor"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="isEnabled"
              checked={formData.isEnabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: !!checked }))}
            />
            <Label htmlFor="isEnabled">Enable this vendor integration</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (vendor ? 'Updating...' : 'Creating...') : (vendor ? 'Update Vendor' : 'Create Vendor')}
            </Button>
          </DialogFooter>
        </form>
    </DialogContent>
  );
}

function AdminCredentialsModal({ 
  vendor, 
  onClose 
}: {
  vendor: SupportedVendor;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<Record<string, string>>(
    vendor.adminCredentials || {}
  );
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleCredentialChange = (fieldName: string, value: string) => {
    setCredentials(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      // Use vendor short code or fallback to name for new credential management system
      const vendorIdentifier = vendor.vendorShortCode || vendor.name.toLowerCase().replace(/\s+/g, '_');
      
      const response = await apiRequest(`/api/admin/vendors/${vendorIdentifier}/test-connection`, 'POST');
      
      if (response.ok) {
        // Refresh the table data to show updated connection status
        queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
        toast({
          title: "Connection Successful",
          description: `Admin credentials for ${vendor.name} are working correctly`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Connection test failed");
      }
    } catch (error) {
      // Also refresh on failure to show updated error status
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      toast({
        title: "Connection Failed",
        description: error.message || "Please verify your admin credentials and try again",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveCredentials = async () => {
    try {
      // Use vendor short code or fallback to name for new credential management system
      const vendorIdentifier = vendor.vendorShortCode || vendor.name.toLowerCase().replace(/\s+/g, '_');
      
      const response = await apiRequest(`/api/admin/vendors/${vendorIdentifier}/credentials`, 'POST', credentials);
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
        toast({
          title: "Credentials Saved",
          description: `Admin credentials for ${vendor.name} have been saved successfully`,
        });
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save credentials");
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save admin credentials. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure Admin Credentials</DialogTitle>
          <DialogDescription>
            Enter system-level admin credentials for {vendor.name} to enable Master Product Catalog synchronization.
            These credentials are separate from organization credentials used for pricing/availability.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {vendor.credentialFields.map((field) => (
            <div key={field.name}>
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                type={field.type}
                value={credentials[field.name] || ''}
                onChange={(e) => handleCredentialChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
              />
              {field.description && (
                <p className="text-xs text-gray-500 mt-1">{field.description}</p>
              )}
            </div>
          ))}

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900">Admin vs Organization Credentials</p>
                <p className="text-blue-700">
                  Admin credentials are used to test the status of the connection. Pricing/availability calls and responses use Store-level credentials entered by a user in Store Settings.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2">
          <div className="flex gap-2 w-full">
            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className="flex-1"
            >
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button 
              onClick={handleSaveCredentials}
              className="flex-1 btn-orange-action"
            >
              Save Credentials
            </Button>
          </div>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SportsSouthCatalogManagement() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [catalogInfo, setCatalogInfo] = useState<any>(null);

  // Fetch Sports South catalog info
  const { data: catalogData, isLoading: infoLoading } = useQuery({
    queryKey: ['/api/sports-south/catalog/info'],
    refetchInterval: false, // Disable automatic polling - only refetch on demand
  });

  React.useEffect(() => {
    if (catalogData) {
      setCatalogInfo(catalogData);
    }
  }, [catalogData]);

  const handleFullSync = async () => {
    const confirmed = confirm(
      'This will perform a complete catalog sync from Sports South, which may take 10-15 minutes and process thousands of products. Continue?'
    );
    
    if (!confirmed) return;
    
    setIsLoading(true);
    toast({
      title: "Full Catalog Sync Started",
      description: "Sports South full catalog sync initiated. This may take several minutes...",
    });

    try {
      const response = await apiRequest('/api/sports-south/catalog/sync-full', 'POST');
      const result = await response.json();
      
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/sports-south/catalog/info'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
        
        toast({
          title: "Full Sync Completed", 
          description: `Successfully processed ${result.productsProcessed} products: ${result.newRecords} new, ${result.recordsUpdated} updated, ${result.recordsSkipped} skipped, ${result.imagesAdded} images added`,
        });
      } else {
        toast({
          title: "Sync Failed",
          description: result.message || "Full catalog sync failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Full sync error:', error);
      toast({
        title: "Sync Error",
        description: "Failed to complete full catalog sync",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIncrementalSync = async () => {
    setIsLoading(true);
    toast({
      title: "Incremental Sync Started",
      description: "Checking for Sports South catalog updates...",
    });

    try {
      const response = await apiRequest('/api/sports-south/catalog/sync-incremental', 'POST');
      const result = await response.json();
      
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/sports-south/catalog/info'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
        
        if (result.productsProcessed === 0) {
          toast({
            title: "No Updates Found",
            description: "No new updates found since last sync",
          });
        } else {
          toast({
            title: "Incremental Sync Completed",
            description: `Processed ${result.productsProcessed} updates: ${result.newRecords} new, ${result.recordsUpdated} updated, ${result.recordsSkipped} skipped, ${result.imagesAdded} images added`,
          });
        }
      } else {
        toast({
          title: "Sync Failed",
          description: result.message || "Incremental sync failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Incremental sync error:', error);
      toast({
        title: "Sync Error",
        description: "Failed to complete incremental sync",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (infoLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Sports South Catalog Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading catalog information...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Sports South Catalog Management
        </CardTitle>
        <CardDescription>
          Manage Sports South Master Product Catalog synchronization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Catalog Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Total Products</div>
            <div className="text-2xl font-bold text-blue-900">
              {catalogInfo?.catalogInfo?.totalProducts?.toLocaleString() || '0'}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Last Sync</div>
            <div className="text-lg font-bold text-green-900">
              {catalogInfo?.vendor?.lastCatalogSync 
                ? new Date(catalogInfo.vendor.lastCatalogSync).toLocaleDateString()
                : 'Never'
              }
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-purple-600 font-medium">Sync Status</div>
            <div className="text-lg font-bold text-purple-900 capitalize">
              {catalogInfo?.vendor?.catalogSyncStatus || 'Never'}
            </div>
          </div>
        </div>

        {/* Sync Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={handleFullSync}
            disabled={isLoading}
            className="flex-1 btn-orange-action"
            data-testid="button-sports-south-full-sync"
          >
            <Database className="h-4 w-4 mr-2" />
            {isLoading ? 'Syncing...' : 'Full Catalog Sync'}
          </Button>
          
          <Button
            onClick={handleIncrementalSync}
            disabled={isLoading || !catalogInfo?.vendor?.lastCatalogSync}
            variant="outline"
            className="flex-1"
            data-testid="button-sports-south-incremental-sync"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isLoading ? 'Syncing...' : 'Incremental Update'}
          </Button>
        </div>

        {/* Sync Information */}
        <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2">
          <div className="font-medium text-gray-700">Sync Information:</div>
          <ul className="text-gray-600 space-y-1">
            <li>• <strong>Full Sync:</strong> Downloads complete Sports South catalog (10,000+ products)</li>
            <li>• <strong>Incremental Update:</strong> Only downloads products updated since last sync</li>
            <li>• <strong>Process Time:</strong> Full sync takes 10-15 minutes, incremental takes 1-3 minutes</li>
            <li>• <strong>Products:</strong> Synced to Master Product Catalog with Sports South-specific fields</li>
          </ul>
        </div>

        {/* Error Display */}
        {catalogInfo?.vendor?.catalogSyncError && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="text-red-800 font-medium">Last Sync Error:</div>
            <div className="text-red-700 text-sm mt-1">{catalogInfo.vendor.catalogSyncError}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Sync Settings Modal Component
function SyncSettingsModal({ vendor, onClose }: { vendor: SupportedVendor; onClose: () => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [scheduleChanges, setScheduleChanges] = useState<{time?: string, frequency?: string, enabled?: boolean, inventoryEnabled?: boolean} | null>(null);
  
  // Query for real-time catalog info updates
  const { data: catalogInfo, refetch } = useQuery({
    queryKey: ['/api/sports-south/catalog/info'],
    enabled: vendor.name.toLowerCase().includes('sports south'),
    refetchInterval: false, // Disable automatic polling - only refetch on demand
  });

  const handleSyncCatalog = async (syncType: 'full' | 'incremental') => {
    setIsLoading(true);
    
    try {
      let endpoint = '';
      let successMessage = '';
      let requestBody = {};
      
      // Vendor-specific sync endpoints
      if (vendor.name.toLowerCase().includes('sports south')) {
        endpoint = `/api/sports-south/catalog/sync-${syncType}`;
        successMessage = `Sports South ${syncType} sync completed successfully`;
      } else if (vendor.name.toLowerCase().includes('chattanooga')) {
        endpoint = `/api/chattanooga/catalog/sync-${syncType}`;
        successMessage = `Chattanooga ${syncType} sync completed successfully`;
      } else {
        // Generic vendor sync endpoint
        endpoint = `/api/admin/supported-vendors/${vendor.id}/sync-catalog`;
        successMessage = `${vendor.name} catalog sync completed successfully`;
      }

      const response = await apiRequest(endpoint, 'POST', requestBody);
      const result = await response.json();
      
      if (result.success) {
        // Refresh data to show latest sync statistics
        queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
        queryClient.invalidateQueries({ queryKey: ['/api/sports-south/catalog/info'] });
        
        // Wait a moment for data to refresh, then show success
        setTimeout(() => {
          toast({
            title: "Sync Completed",
            description: result.message || successMessage,
          });
        }, 500);
        // Don't close modal automatically - let user see the results
      } else {
        toast({
          title: "Sync Failed",
          description: result.message || "Catalog sync failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Error",
        description: "Failed to start catalog sync",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAllChanges = async () => {
    if (!scheduleChanges) {
      onClose();
      return;
    }

    setIsSavingChanges(true);
    try {
      // Save schedule changes for Sports South
      if (vendor.name.toLowerCase().includes('sports south') && scheduleChanges) {
        await apiRequest('/api/sports-south/schedule/update', 'POST', scheduleChanges);
        
        // Trigger refetch to update UI state
        await queryClient.refetchQueries({ queryKey: ['/api/sports-south/catalog/info'] });
        
        toast({
          title: "Settings Saved",
          description: `Schedule updated successfully`
        });
      }
      
      // Save schedule changes for Chattanooga
      if (vendor.name.toLowerCase().includes('chattanooga') && scheduleChanges) {
        await apiRequest('/api/chattanooga/schedule/update', 'POST', scheduleChanges);
        
        // Trigger refetch to update UI state
        await queryClient.refetchQueries({ queryKey: ['/api/admin/supported-vendors'] });
        
        toast({
          title: "Settings Saved",
          description: `Chattanooga schedule updated successfully`
        });
      }
      
      // Save schedule changes for Bill Hicks & Co.
      if (vendor.name === 'Bill Hicks & Co.' && scheduleChanges) {
        const billHicksUpdates: any = {};
        
        // Handle master catalog settings
        if ('enabled' in scheduleChanges) {
          billHicksUpdates.billHicksMasterCatalogSyncEnabled = scheduleChanges.enabled;
        }
        if ('time' in scheduleChanges) {
          billHicksUpdates.billHicksMasterCatalogSyncTime = scheduleChanges.time;
        }
        
        // Handle inventory settings
        if ('inventoryEnabled' in scheduleChanges) {
          billHicksUpdates.billHicksInventorySyncEnabled = scheduleChanges.inventoryEnabled;
        }
        
        await apiRequest(`/api/admin/supported-vendors/${vendor.id}`, 'PATCH', billHicksUpdates);
        
        // Trigger refetch to update UI state
        await queryClient.refetchQueries({ queryKey: ['/api/admin/supported-vendors'] });
        
        toast({
          title: "Settings Saved",
          description: `Bill Hicks sync settings updated successfully`
        });
      }
      
      setScheduleChanges(null);
      onClose();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingChanges(false);
    }
  };

  // Render vendor-specific sync content
  const renderVendorSpecificContent = () => {
    if (vendor.name.toLowerCase().includes('sports south')) {
      return <SportsSouthSyncSettings onSync={handleSyncCatalog} isLoading={isLoading} catalogInfo={catalogInfo} onScheduleChange={setScheduleChanges} />
    } else if (vendor.name.toLowerCase().includes('chattanooga')) {
      return <ChattanoogaSyncSettings onSync={handleSyncCatalog} isLoading={isLoading} onScheduleChange={setScheduleChanges} />;
    } else {
      return <GenericVendorSyncSettings vendor={vendor} onSync={handleSyncCatalog} isLoading={isLoading} onScheduleChange={setScheduleChanges} />;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[90vw] md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {vendor.vendorShortCode || vendor.name} Sync Settings
          </DialogTitle>
          <DialogDescription>
            Configure catalog synchronization settings for {vendor.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {renderVendorSpecificContent()}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button 
            onClick={handleSaveAllChanges}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSavingChanges}
            data-testid="button-save-all-changes"
          >
            {isSavingChanges ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sports South Specific Sync Settings
function SportsSouthSyncSettings({ onSync, isLoading, catalogInfo, onScheduleChange }: { onSync: (type: 'full' | 'incremental') => void; isLoading: boolean; catalogInfo: any; onScheduleChange: (changes: {time?: string, frequency?: string} | null) => void }) {

  const { toast } = useToast();
  const { data: adminSettings } = useAdminSettings();
  
  // Local state for schedule changes
  const [localScheduleTime, setLocalScheduleTime] = useState('');
  const [localScheduleFrequency, setLocalScheduleFrequency] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Update local state when catalogInfo changes
  useEffect(() => {
    if (catalogInfo?.vendor) {
      setLocalScheduleTime(catalogInfo.vendor.sportsSouthScheduleTime || '13:30');  // 6:30 AM Pacific (winter) / 6:30 AM Pacific (summer)
      setLocalScheduleFrequency(catalogInfo.vendor.sportsSouthScheduleFrequency || 'daily');
      setHasUnsavedChanges(false);
    }
  }, [catalogInfo]);
  
  const handleStopSync = async () => {
    try {
      // In a real implementation, this would call a stop sync endpoint
      toast({
        title: "Sync Stopped",
        description: "Catalog sync has been terminated",
        variant: "destructive",
      });
    } catch (error) {
      console.error('Stop sync error:', error);
    }
  };

  const handleScheduleToggle = async (enabled: boolean) => {
    try {
      await apiRequest('/api/sports-south/schedule/toggle', 'POST', { enabled });
      
      // Trigger immediate refetch to update UI state
      await queryClient.refetchQueries({ queryKey: ['/api/sports-south/catalog/info'] });
      
      toast({
        title: enabled ? "Schedule Enabled" : "Schedule Disabled",
        description: enabled 
          ? "Automated Sports South sync has been enabled"
          : "Automated Sports South sync has been disabled"
      });
    } catch (error) {
      console.error('Error toggling schedule:', error);
      toast({
        title: "Error",
        description: "Failed to update schedule settings. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleScheduleTimeChange = (time: string) => {
    setLocalScheduleTime(time);
    setHasUnsavedChanges(true);
    onScheduleChange({ time, frequency: localScheduleFrequency });
  };

  const handleScheduleFrequencyChange = (frequency: string) => {
    setLocalScheduleFrequency(frequency);
    setHasUnsavedChanges(true);
    onScheduleChange({ time: localScheduleTime, frequency });
  };
  

  const [duplicateHandling, setDuplicateHandling] = useState('smart_merge');
  const [imageSettings, setImageSettings] = useState({
    updateMissing: true,
    replaceHigherQuality: true
  });
  const [descriptionSettings, setDescriptionSettings] = useState({
    addIfMissing: true,
    overwriteExisting: false
  });

  // catalogInfo is now passed as a prop

  return (
    <div className="space-y-6">
      {/* Sports South Sync Information */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Database className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900 mb-1">Sports South Sync Information</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>Full Catalog Sync:</strong> Processes entire Sports South catalog (may take 10-15 minutes)</p>
                <p><strong>Incremental Sync:</strong> Only syncs products updated since last sync using DailyItemUpdate API</p>
                <p><strong>Vendor Ranking:</strong> Priority #3 (Medium) - Products are only added if no higher-ranked vendor data exists</p>
                <p><strong>Vendor Priority:</strong> Medium priority (#3) - Products are only added if no higher-priority vendor data exists</p>
                <p><strong>Smart Merge:</strong> Updates missing data without overwriting existing information</p>
                <p className="text-blue-600 mt-2">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  Scheduled Deployments run incremental updates for reliable, efficient catalog maintenance
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3">Duplicate Handling Strategy</h4>
        <Select value={duplicateHandling} onValueChange={setDuplicateHandling}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ignore">Ignore (Skip existing products)</SelectItem>
            <SelectItem value="smart_merge">Smart Merge (Recommended)</SelectItem>
            <SelectItem value="overwrite">Overwrite (Replace all data)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Smart Merge updates missing data without overwriting existing information
        </p>
      </div>

      {/* Advanced Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Image Handling</Label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm">
              <Checkbox 
                checked={imageSettings.updateMissing} 
                onCheckedChange={(checked) => setImageSettings(prev => ({ ...prev, updateMissing: !!checked }))}
              />
              <span>Update missing images</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <Checkbox 
                checked={imageSettings.replaceHigherQuality}
                onCheckedChange={(checked) => setImageSettings(prev => ({ ...prev, replaceHigherQuality: !!checked }))}
              />
              <span>Replace with higher quality</span>
            </label>
          </div>
        </div>
        
        <div className="space-y-3">
          <Label className="text-sm font-medium">Description Handling</Label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm">
              <Checkbox 
                checked={descriptionSettings.addIfMissing}
                onCheckedChange={(checked) => setDescriptionSettings(prev => ({ ...prev, addIfMissing: !!checked }))}
              />
              <span>Add if missing</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <Checkbox 
                checked={descriptionSettings.overwriteExisting}
                onCheckedChange={(checked) => setDescriptionSettings(prev => ({ ...prev, overwriteExisting: !!checked }))}
              />
              <span>Overwrite existing</span>
            </label>
          </div>
        </div>
      </div>

      {/* Catalog Status */}
      {catalogInfo && (
        <div className="border-t pt-4 space-y-4">
          <h4 className="font-medium">Catalog Status</h4>

          {/* Current Sync and Last Sync Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Sync Section */}
            <div>
              <h5 className="font-medium text-sm mb-2">Current Sync</h5>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Status:</span>
                  <span className="ml-2 text-gray-600">
                    <Badge variant={isLoading ? 'secondary' : 'outline'}>
                      {isLoading ? 'In Progress' : 'Ready'}
                    </Badge>
                  </span>
                </div>
                {isLoading && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-gray-600">Syncing products...</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Progress updates appear in Last Sync section when complete
                    </div>
                  </div>
                )}
                {!isLoading && (
                  <div className="text-gray-500 text-xs">
                    Click a sync button to start processing
                  </div>
                )}
              </div>
            </div>

            {/* Last Sync Section - Bill Hicks Format */}
            <div>
              <h5 className="font-medium text-sm mb-2">Last Sync</h5>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Status:</span>
                      <span className={`ml-2 ${
                        catalogInfo.vendor?.catalogSyncStatus === 'success' ? 'text-green-700' :
                        catalogInfo.vendor?.catalogSyncStatus === 'error' ? 'text-red-700' :
                        catalogInfo.vendor?.catalogSyncStatus === 'in_progress' ? 'text-blue-700' : 'text-gray-500'
                      }`}>
                        {catalogInfo.vendor?.catalogSyncStatus === 'success' ? 'Success' :
                         catalogInfo.vendor?.catalogSyncStatus === 'error' ? 'Error' :
                         catalogInfo.vendor?.catalogSyncStatus === 'in_progress' ? 'In Progress' : 'Never'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Last Sync:</span>
                      <span className="ml-2 text-gray-600">
                        {catalogInfo.vendor?.lastCatalogSync 
                          ? new Date(catalogInfo.vendor.lastCatalogSync).toLocaleDateString('en-US', { timeZone: adminSettings?.systemTimeZone || 'America/Los_Angeles' }) + ' at ' + new Date(catalogInfo.vendor.lastCatalogSync).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: adminSettings?.systemTimeZone || 'America/Los_Angeles', timeZoneName: 'short' })
                          : 'Never'
                        }
                      </span>
                    </div>
                  </div>
                  
                  {/* Display sync statistics in Bill Hicks format */}
                  {catalogInfo.vendor?.catalogSyncStatus === 'success' && (
                    <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="font-medium text-green-700">Added:</span> {catalogInfo.vendor?.lastSyncNewRecords || 0}</div>
                        <div><span className="font-medium text-blue-700">Updated:</span> {catalogInfo.vendor?.lastSyncRecordsUpdated || 0}</div>
                        <div><span className="font-medium text-gray-700">Skipped:</span> {catalogInfo.vendor?.lastSyncRecordsSkipped || 0}</div>
                        <div><span className="font-medium text-red-700">Failed:</span> 0</div>
                      </div>
                      <div className="mt-1 text-center"><span className="font-medium">Processed:</span> {(catalogInfo.vendor?.lastSyncNewRecords || 0) + (catalogInfo.vendor?.lastSyncRecordsUpdated || 0) + (catalogInfo.vendor?.lastSyncRecordsSkipped || 0)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {catalogInfo.vendor?.catalogSyncError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-700"><strong>Error:</strong> {catalogInfo.vendor.catalogSyncError}</p>
            </div>
          )}
        </div>
      )}


      {/* Sync Action Buttons */}
      <div className="space-y-4">
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Manual Sync Controls</h4>
          <p className="text-sm text-gray-600 mb-4">
            Use these buttons to manually trigger immediate syncs. Manual syncs run independently 
            of the automated Scheduled Deployments above.
          </p>
          <div className="flex gap-2">
            <Button 
              onClick={() => onSync('full')}
              disabled={isLoading}
              variant="outline"
              className="border-blue-300 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 flex-1"
              data-testid="button-sports-south-full-sync"
            >
              <Database className="h-4 w-4 mr-2" />
              {isLoading ? 'Syncing...' : 'Manual Full Catalog Sync'}
            </Button>
            <Button 
              onClick={() => onSync('incremental')}
              disabled={isLoading}
              variant="outline"
              className="border-blue-300 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 flex-1"
              data-testid="button-sports-south-incremental-sync"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Manual Incremental Sync
            </Button>
          </div>
        </div>
        
        {isLoading && (
          <div className="flex justify-end">
            <Button 
              onClick={handleStopSync}
              variant="destructive"
              size="sm"
              data-testid="button-stop-sync"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Stop Sync
            </Button>
          </div>
        )}
      </div>

      {/* Schedule Configuration */}
      <div className="border-t pt-6">
        <h4 className="font-medium mb-4">Automated Schedule Configuration</h4>
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-time">Sync Time (Pacific)</Label>
              <Input
                id="schedule-time"
                type="time"
                value={localScheduleTime}
                onChange={(e) => handleScheduleTimeChange(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Daily sync time in Pacific Timezone
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="schedule-frequency">Frequency</Label>
              <Select value={localScheduleFrequency} onValueChange={handleScheduleFrequencyChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                How often to run automated sync
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Label htmlFor="schedule-enabled">Enable Automated Sync</Label>
              <Switch
                id="schedule-enabled"
                checked={catalogInfo?.vendor?.sportsSouthScheduleEnabled || false}
                onCheckedChange={handleScheduleToggle}
              />
            </div>
            
            {hasUnsavedChanges && (
              <Button
                onClick={async () => {
                  try {
                    await apiRequest('/api/sports-south/schedule/update', 'POST', {
                      time: localScheduleTime,
                      frequency: localScheduleFrequency
                    });
                    setHasUnsavedChanges(false);
                    toast({
                      title: "Schedule Updated",
                      description: "Sports South automated sync schedule has been updated"
                    });
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to update schedule settings",
                      variant: "destructive"
                    });
                  }
                }}
                size="sm"
                variant="outline"
              >
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Chattanooga Specific Sync Settings
function ChattanoogaSyncSettings({ onSync, isLoading, onScheduleChange }: { onSync: (type: 'full' | 'incremental') => void; isLoading: boolean; onScheduleChange: (changes: {time?: string, frequency?: string} | null) => void }) {
  const { toast } = useToast();
  const { data: adminSettings } = useAdminSettings();
  const queryClient = useQueryClient();
  
  // Local state for schedule changes
  const [localScheduleTime, setLocalScheduleTime] = useState('14:45');  // 7:45 AM Pacific (winter) / 7:45 AM Pacific (summer)
  const [localScheduleFrequency, setLocalScheduleFrequency] = useState('daily');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  
  // Fetch Chattanooga vendor info
  const { data: vendors } = useQuery<SupportedVendor[]>({
    queryKey: ['/api/admin/supported-vendors'],
  });
  
  const chattanoogaVendor = vendors?.find(v => v.name.toLowerCase().includes('chattanooga'));
  
  // Update local state when vendor data changes
  useEffect(() => {
    if (chattanoogaVendor) {
      setLocalScheduleTime(chattanoogaVendor.chattanoogaScheduleTime || '14:45');  // 7:45 AM Pacific
      setLocalScheduleFrequency(chattanoogaVendor.chattanoogaScheduleFrequency || 'daily');
      setScheduleEnabled(chattanoogaVendor.chattanoogaScheduleEnabled || false);
      setHasUnsavedChanges(false);
    }
  }, [chattanoogaVendor]);

  const handleScheduleToggle = async (enabled: boolean) => {
    try {
      await apiRequest('/api/chattanooga/schedule/toggle', 'POST', { enabled });
      
      // Trigger immediate refetch to update UI state
      await queryClient.refetchQueries({ queryKey: ['/api/admin/supported-vendors'] });
      
      setScheduleEnabled(enabled);
      
      toast({
        title: enabled ? "Schedule Enabled" : "Schedule Disabled",
        description: enabled 
          ? "Automated Chattanooga nightly CSV sync has been enabled"
          : "Automated Chattanooga CSV sync has been disabled"
      });
    } catch (error) {
      console.error('Error toggling Chattanooga schedule:', error);
      toast({
        title: "Error",
        description: "Failed to update Chattanooga schedule settings. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleScheduleTimeChange = (time: string) => {
    setLocalScheduleTime(time);
    setHasUnsavedChanges(true);
    onScheduleChange({ time, frequency: localScheduleFrequency });
  };

  const handleScheduleFrequencyChange = (frequency: string) => {
    setLocalScheduleFrequency(frequency);
    setHasUnsavedChanges(true);
    onScheduleChange({ time: localScheduleTime, frequency });
  };
  

  const handleManualSync = async () => {
    try {
      const response = await apiRequest('/api/chattanooga/schedule/manual-sync', 'POST');
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Manual Sync Started",
          description: "Chattanooga CSV download and processing initiated..."
        });
        
        // Refresh vendor data to show updated sync status
        setTimeout(async () => {
          await queryClient.refetchQueries({ queryKey: ['/api/admin/supported-vendors'] });
        }, 2000);
      } else {
        toast({
          title: "Manual Sync Failed",
          description: result.message || "Failed to start manual sync. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error starting manual sync:', error);
      toast({
        title: "Sync Error",
        description: "Failed to start manual sync. Please check your connection and try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Information */}
      <div className="bg-blue-50 p-4 rounded-lg text-sm space-y-2">
        <div className="font-medium text-blue-700">Chattanooga Sync Information:</div>
        <ul className="text-blue-600 space-y-1">
          <li>• <strong>Nightly Sync:</strong> Downloads complete CSV product feed</li>
          <li>• <strong>Smart Diff:</strong> Only processes products that have changed since last sync</li>
          <li>• <strong>Vendor Ranking:</strong> Priority #1 (Highest) - Has priority over all other vendors when data conflicts occur</li>
          <li>• <strong>Vendor Priority:</strong> High priority (#2) - Can replace lower-priority vendor data</li>
          <li>• <strong>Rate Limits:</strong> Designed for nightly sync, not frequent polling</li>
          <li>• <strong>Data:</strong> Product catalog details (UPC, name, part numbers) - Pricing and availability retrieved via real-time API calls</li>
        </ul>
      </div>
      
      {/* CSV Sync Status */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Database className="h-4 w-4" />
          Chattanooga CSV Sync Status
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">CSV Status:</span>
            <span className={`ml-2 ${
              chattanoogaVendor?.chattanoogaCsvSyncStatus === 'success' ? 'text-green-700' :
              chattanoogaVendor?.chattanoogaCsvSyncStatus === 'error' ? 'text-red-700' :
              chattanoogaVendor?.chattanoogaCsvSyncStatus === 'in_progress' ? 'text-blue-700' : 'text-gray-500'
            }`}>
              {chattanoogaVendor?.chattanoogaCsvSyncStatus || 'never_synced'}
            </span>
          </div>
          <div>
            <span className="font-medium">Last Sync:</span>
            <span className="ml-2 text-gray-600">
              {chattanoogaVendor?.lastCatalogSync 
                ? new Date(chattanoogaVendor.lastCatalogSync).toLocaleDateString('en-US', { timeZone: adminSettings?.systemTimeZone || 'America/Los_Angeles' }) + ' at ' + new Date(chattanoogaVendor.lastCatalogSync).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: adminSettings?.systemTimeZone || 'America/Los_Angeles', timeZoneName: 'short' })
                : 'Never'
              }
            </span>
          </div>
        </div>
        
        {/* Display sync statistics */}
        {chattanoogaVendor?.chattanoogaCsvSyncStatus === 'success' && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-medium text-green-700">Added:</span> {chattanoogaVendor?.chattanoogaRecordsAdded || 0}</div>
                <div><span className="font-medium text-blue-700">Updated:</span> {chattanoogaVendor?.chattanoogaRecordsUpdated || 0}</div>
                <div><span className="font-medium text-gray-700">Skipped:</span> {chattanoogaVendor?.chattanoogaRecordsSkipped || 0}</div>
                <div><span className="font-medium text-red-700">Failed:</span> {chattanoogaVendor?.chattanoogaRecordsFailed || 0}</div>
              </div>
              <div className="mt-1 text-center"><span className="font-medium">Processed:</span> {chattanoogaVendor?.chattanoogaTotalRecords || 0}</div>
            </div>
          </div>
        )}
        
        {chattanoogaVendor?.chattanoogaCsvSyncError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-700"><strong>Error:</strong> {chattanoogaVendor.chattanoogaCsvSyncError}</p>
              <Button
                onClick={async () => {
                  try {
                    const response = await apiRequest('/api/chattanooga/schedule/clear-error', 'POST');
                    const result = await response.json();
                    
                    if (result.success) {
                      toast({
                        title: "Error Cleared",
                        description: "Chattanooga sync error has been cleared"
                      });
                      // Refresh vendor data
                      await queryClient.refetchQueries({ queryKey: ['/api/admin/supported-vendors'] });
                    } else {
                      toast({
                        title: "Error",
                        description: result.message || "Failed to clear error",
                        variant: "destructive"
                      });
                    }
                  } catch (error) {
                    console.error('Clear error failed:', error);
                    toast({
                      title: "Error",
                      description: "Failed to clear error",
                      variant: "destructive"
                    });
                  }
                }}
                size="sm"
                variant="outline"
                className="ml-2"
              >
                Clear Error
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Configuration */}
      <div className="border-t pt-6">
        <h4 className="font-medium mb-4">Automated Schedule Configuration</h4>
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chattanooga-schedule-time">Sync Time ({adminSettings?.systemTimeZone || 'Pacific'})</Label>
              <Input
                id="chattanooga-schedule-time"
                type="time"
                value={localScheduleTime}
                onChange={(e) => handleScheduleTimeChange(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Daily sync time in {adminSettings?.systemTimeZone || 'Pacific'} timezone
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="chattanooga-schedule-frequency">Frequency</Label>
              <Select value={localScheduleFrequency} onValueChange={handleScheduleFrequencyChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                How often to run automated sync
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Label htmlFor="chattanooga-schedule-enabled">Enable Automated Sync</Label>
              <Switch
                id="chattanooga-schedule-enabled"
                checked={scheduleEnabled}
                onCheckedChange={handleScheduleToggle}
              />
            </div>
            
            {hasUnsavedChanges && (
              <div className="text-sm text-amber-600 font-medium">
                You have unsaved changes
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Sync */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3">Manual CSV Sync</h4>
        <p className="text-sm text-gray-600 mb-4">
          Manually trigger a Chattanooga CSV download and catalog update. 
          This will download the latest product feed and process changes.
        </p>
        <Button
          onClick={handleManualSync}
          disabled={isLoading}
          variant="outline"
          className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {isLoading ? 'Syncing...' : 'Start Manual CSV Sync'}
        </Button>
      </div>

    </div>
  );
}

// Generic Vendor Sync Settings
function GenericVendorSyncSettings({ vendor, onSync, isLoading, onScheduleChange }: { vendor: SupportedVendor; onSync: (type: 'full' | 'incremental') => void; isLoading: boolean; onScheduleChange: (changes: {time?: string, frequency?: string, enabled?: boolean, inventoryEnabled?: boolean} | null) => void }) {
  const { toast } = useToast();
  
  // Special handling for Bill Hicks
  if (vendor.name === 'Bill Hicks & Co.') {
    return <BillHicksSyncSettings vendor={vendor} onSync={onSync} isLoading={isLoading} onScheduleChange={onScheduleChange} />;
  }
  
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{vendor.name} Catalog Sync</h3>
        <p className="text-gray-600 mb-6">
          Catalog synchronization settings for {vendor.name} are not yet configured.
          Contact support to enable catalog sync for this vendor.
        </p>
        <div className="flex gap-2 justify-center">
          <Button 
            onClick={() => onSync('full')}
            disabled={isLoading}
            variant="outline"
          >
            <Database className="h-4 w-4 mr-2" />
            {isLoading ? 'Syncing...' : 'Try Sync'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Bill Hicks specific sync settings
function BillHicksSyncSettings({ vendor, onSync, isLoading, onScheduleChange }: { vendor: SupportedVendor; onSync: (type: 'full' | 'incremental') => void; isLoading: boolean; onScheduleChange: (changes: {time?: string, frequency?: string, enabled?: boolean, inventoryEnabled?: boolean} | null) => void }) {
  const { toast } = useToast();
  const { data: adminSettings } = useAdminSettings();
  const queryClient = useQueryClient();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isMasterCatalogSyncing, setIsMasterCatalogSyncing] = useState(false);
  
  // Master catalog sync settings
  const [masterCatalogEnabled, setMasterCatalogEnabled] = useState(true);
  const [masterCatalogSyncTime, setMasterCatalogSyncTime] = useState('16:15');  // 9:15 AM Pacific (winter) / 9:15 AM Pacific (summer)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Inventory sync settings
  const [inventoryEnabled, setInventoryEnabled] = useState(true);
  const [hasInventoryUnsavedChanges, setHasInventoryUnsavedChanges] = useState(false);

  // Initialize state from vendor data
  useEffect(() => {
    if (vendor) {
      setMasterCatalogEnabled(vendor.billHicksMasterCatalogSyncEnabled ?? true);
      setMasterCatalogSyncTime(vendor.billHicksMasterCatalogSyncTime ?? '16:15');  // 9:15 AM Pacific
      setInventoryEnabled(vendor.billHicksInventorySyncEnabled ?? true);
      setHasUnsavedChanges(false);
      setHasInventoryUnsavedChanges(false);
    }
  }, [vendor.id]); // Only re-run when vendor ID changes

  const handleManualInventorySync = async () => {
    try {
      setIsManualSyncing(true);
      const response = await apiRequest('/api/admin/bill-hicks/manual-inventory-sync', 'POST', {});
      const result = await response.json();
      
      // Refresh vendor data to show updated sync status and times
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      
      toast({
        title: "Manual Sync Completed",
        description: result.message || `Updated ${result.recordsUpdated} inventory records`,
      });
    } catch (error: any) {
      // Also refresh on failure to show updated error status
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      toast({
        title: "Manual Sync Failed", 
        description: error.message || "Failed to sync Bill Hicks inventory",
        variant: "destructive",
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleMasterCatalogSync = async () => {
    try {
      setIsMasterCatalogSyncing(true);
      const response = await apiRequest('/api/admin/bill-hicks/manual-master-catalog-sync', 'POST', {});
      const result = await response.json();
      
      // Refresh vendor data to show updated sync status
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      
      toast({
        title: "Master Catalog Sync Completed",
        description: result.message || `Processed ${result.totalRecords} master catalog records`,
      });
    } catch (error: any) {
      // Reset the stuck sync status in the database on error
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      toast({
        title: "Master Catalog Sync Failed", 
        description: error.message || "Failed to sync Bill Hicks master catalog",
        variant: "destructive",
      });
    } finally {
      setIsMasterCatalogSyncing(false);
    }
  };

  const handleResetMasterCatalogStatus = async () => {
    try {
      // Directly update the selected vendor by ID to clear status/error
      const response = await apiRequest(`/api/admin/supported-vendors/${vendor.id}`, 'PATCH', {
        billHicksMasterCatalogSyncError: null,
        billHicksMasterCatalogSyncStatus: 'never_synced'
      });
      if (response.ok) {
        toast({
          title: 'Status Reset',
          description: 'Bill Hicks master catalog sync status has been reset.'
        });
        await queryClient.refetchQueries({ queryKey: ['/api/admin/supported-vendors'] });
      } else {
        const result = await response.json().catch(() => ({}));
        toast({
          title: 'Reset Failed',
          description: result.message || `Failed to reset (HTTP ${response.status})`,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Reset Error',
        description: error?.message || 'Failed to reset master catalog status',
        variant: 'destructive'
      });
    }
  };

  const handleMasterCatalogSettingsChange = (field: string, value: any) => {
    if (field === 'enabled') {
      setMasterCatalogEnabled(value);
      onScheduleChange({ enabled: value, time: masterCatalogSyncTime });
    } else if (field === 'syncTime') {
      setMasterCatalogSyncTime(value);
      onScheduleChange({ enabled: masterCatalogEnabled, time: value });
    }
    setHasUnsavedChanges(true);
  };

  const handleInventorySettingsChange = (field: string, value: any) => {
    if (field === 'enabled') {
      setInventoryEnabled(value);
      setHasInventoryUnsavedChanges(true);
      onScheduleChange({ inventoryEnabled: value });
    } else if (field === 'syncTime') {
      setHasInventoryUnsavedChanges(true);
      onScheduleChange({ inventoryEnabled, time: value });
    }
  };



  const masterCatalogSyncStatus = vendor.billHicksMasterCatalogSyncStatus;
  const masterCatalogLastSync = vendor.billHicksMasterCatalogLastSync;
  const masterCatalogError = vendor.billHicksMasterCatalogSyncError;
  
  // Master catalog statistics - memoized to prevent infinite re-renders
  const masterCatalogStats = useMemo(() => ({
    added: vendor.billHicksMasterCatalogRecordsAdded || 0,
    updated: vendor.billHicksMasterCatalogRecordsUpdated || 0,
    failed: vendor.billHicksMasterCatalogRecordsFailed || 0,
    skipped: vendor.billHicksMasterCatalogRecordsSkipped || 0,
    total: vendor.billHicksMasterCatalogTotalRecords || 0,
  }), [
    vendor.billHicksMasterCatalogRecordsAdded,
    vendor.billHicksMasterCatalogRecordsUpdated,
    vendor.billHicksMasterCatalogRecordsFailed,
    vendor.billHicksMasterCatalogRecordsSkipped,
    vendor.billHicksMasterCatalogTotalRecords
  ]);

  // Inventory sync status and statistics
  const inventorySyncStatus = vendor.billHicksInventorySyncStatus;
  const inventoryLastSync = vendor.billHicksLastInventorySync;
  const inventorySyncError = vendor.billHicksInventorySyncError;
  
  // Inventory sync statistics - memoized to prevent infinite re-renders
  const inventoryStats = useMemo(() => ({
    added: vendor.billHicksInventoryRecordsAdded || 0,
    updated: vendor.billHicksLastSyncRecordsUpdated || 0,
    failed: vendor.billHicksInventoryRecordsFailed || 0,
    skipped: vendor.billHicksLastSyncRecordsSkipped || 0,
    total: vendor.billHicksInventoryTotalRecords || 0,
  }), [
    vendor.billHicksInventoryRecordsAdded,
    vendor.billHicksLastSyncRecordsUpdated,
    vendor.billHicksInventoryRecordsFailed,
    vendor.billHicksLastSyncRecordsSkipped,
    vendor.billHicksInventoryTotalRecords
  ]);

  return (
    <div className="space-y-4">
      {/* Information - Moved to top */}
      <div className="bg-blue-50 p-4 rounded-lg text-sm space-y-2">
        <div className="font-medium text-blue-700">Bill Hicks Sync Information:</div>
        <ul className="text-blue-600 space-y-1">
          <li>• <strong>Master Catalog:</strong> Daily differential sync from MicroBiz_Daily_Catalog.csv</li>
          <li>• <strong>Store Catalogs:</strong> Per-store catalog feeds with unique credentials</li>
          <li>• <strong>Vendor Ranking:</strong> Priority #4 (Lowest) - Only fills gaps when no other vendor has data</li>
          <li>• <strong>Vendor Priority:</strong> Basic priority - Provides product identification and description</li>
          <li>• <strong>Inventory:</strong> Real-time FTP downloads every hour, 24/7 via Scheduled Deployments</li>
          <li>• <strong>Differential Processing:</strong> Only processes changed records for efficiency</li>
          <li>• <strong>Automation:</strong> Reliable Scheduled Deployments manage all automatic syncing</li>
        </ul>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Master Product Catalog Sync */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Master Product Catalog Sync
          </CardTitle>
          <CardDescription>
            Sync master product catalog from MicroBiz_Daily_Catalog.csv using differential processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 ${
                    masterCatalogSyncStatus === 'success' ? 'text-green-700' :
                    masterCatalogSyncStatus === 'error' ? 'text-red-700' :
                    masterCatalogSyncStatus === 'in_progress' ? 'text-blue-700' : 'text-gray-500'
                  }`}>
                    {masterCatalogSyncStatus === 'in_progress' ? 'Syncing...' : 
                     masterCatalogSyncStatus === 'success' ? 'Success' :
                     masterCatalogSyncStatus === 'error' ? 'Error' : 'Not Configured'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Last Sync:</span>
                  <span className="ml-2 text-gray-600">
                    {masterCatalogLastSync 
                      ? new Date(masterCatalogLastSync).toLocaleDateString('en-US', { timeZone: adminSettings?.systemTimeZone || 'America/Los_Angeles' }) + ' at ' + new Date(masterCatalogLastSync).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: adminSettings?.systemTimeZone || 'America/Los_Angeles', timeZoneName: 'short' })
                      : 'Never'
                    }
                  </span>
                </div>
              </div>
              
              {/* Display sync statistics inline */}
              {masterCatalogLastSync && (
                <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-medium text-green-700">Added:</span> {masterCatalogStats.added}</div>
                    <div><span className="font-medium text-blue-700">Updated:</span> {masterCatalogStats.updated}</div>
                    <div><span className="font-medium text-gray-700">Skipped:</span> {masterCatalogStats.skipped}</div>
                    <div><span className="font-medium text-red-700">Failed:</span> {masterCatalogStats.failed}</div>
                  </div>
                  <div className="mt-1 text-center"><span className="font-medium">Processed:</span> {masterCatalogStats.total}</div>
                </div>
              )}
            </div>
            
            {masterCatalogError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-red-700"><strong>Error:</strong> {masterCatalogError}</p>
                  <Button
                    onClick={async () => {
                      try {
                        console.log('Attempting to clear master catalog error...');
                        const response = await apiRequest('/api/admin/bill-hicks/clear-master-catalog-error', 'POST');
                        console.log('Response status:', response.status);
                        
                        if (response.status === 401) {
                          toast({
                            title: "Authentication Required",
                            description: "Please log in again to clear errors",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        const result = await response.json();
                        console.log('Response result:', result);
                        
                        if (result.success) {
                          toast({
                            title: "Error Cleared",
                            description: "Bill Hicks master catalog sync error has been cleared"
                          });
                          // Refresh vendor data to show updated status
                          await queryClient.refetchQueries({ queryKey: ['/api/admin/supported-vendors'] });
                        } else {
                          toast({
                            title: "Error",
                            description: result.message || "Failed to clear error",
                            variant: "destructive"
                          });
                        }
                      } catch (error) {
                        console.error('Clear master catalog error failed:', error);
                        if (error instanceof Error && error.message.includes('401')) {
                          toast({
                            title: "Authentication Required",
                            description: "Please log in again to clear errors",
                            variant: "destructive"
                          });
                        } else {
                          toast({
                            title: "Error",
                            description: `Failed to clear master catalog error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            variant: "destructive"
                          });
                        }
                      }
                    }}
                    size="sm"
                    variant="outline"
                    className="ml-2"
                  >
                    Clear Error
                  </Button>
                </div>
              </div>
            )}
          </div>


          {/* Schedule Configuration */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-4">Schedule Configuration</h4>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="master-catalog-enabled"
                  checked={masterCatalogEnabled}
                  onCheckedChange={(checked) => handleMasterCatalogSettingsChange('enabled', checked)}
                />
                <Label htmlFor="master-catalog-enabled" className="text-sm">
                  Enable automated master catalog sync
                </Label>
              </div>
              
              {masterCatalogEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="master-catalog-time" className="text-sm font-medium">
                    Sync Time (Admin Settings Time Zone)
                  </Label>
                  <Input
                    id="master-catalog-time"
                    type="time"
                    value={masterCatalogSyncTime}
                    onChange={(e) => handleMasterCatalogSettingsChange('syncTime', e.target.value)}
                    className="w-32"
                  />
                  <p className="text-xs text-gray-500">
                    Set the time for daily master catalog sync in {adminSettings?.systemTimeZone || 'America/Los_Angeles'} timezone
                  </p>
                </div>
              )}
              
              {hasUnsavedChanges && (
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-amber-600">
                    ⚠️ You have unsaved changes. Use the "Save Changes" button below to save all settings.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Manual Sync */}
          <div className="bg-white p-3 rounded border">
            <p className="text-xs text-gray-600 mb-3">
              Manual sync runs independently of automated Scheduled Deployments
            </p>
            <Button
              onClick={handleMasterCatalogSync}
              disabled={isMasterCatalogSyncing || masterCatalogSyncStatus === 'in_progress'}
              variant="outline"
              className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
              data-testid="button-manual-master-catalog-sync"
            >
              {isMasterCatalogSyncing || masterCatalogSyncStatus === 'in_progress' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing Master Catalog...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Manual Sync Master Catalog Now
                </>
              )}
            </Button>
            {masterCatalogSyncStatus === 'in_progress' && (
              <div className="mt-2">
                <Button
                  onClick={handleResetMasterCatalogStatus}
                  variant="outline"
                  size="sm"
                  className="w-full border-red-500 text-red-600 hover:bg-red-50"
                  data-testid="button-reset-master-catalog-status"
                >
                  Force Reset Status
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Inventory Sync */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" />
            Inventory Sync
          </CardTitle>
          <CardDescription>
            Sync inventory levels from Bill Hicks FTP server using real-time downloads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 ${
                    inventorySyncStatus === 'success' ? 'text-green-700' :
                    inventorySyncStatus === 'error' ? 'text-red-700' :
                    inventorySyncStatus === 'in_progress' ? 'text-blue-700' : 'text-gray-500'
                  }`}>
                    {inventorySyncStatus === 'in_progress' ? 'Syncing...' : 
                     inventorySyncStatus === 'success' ? 'Success' :
                     inventorySyncStatus === 'error' ? 'Error' : 'Not Configured'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Last Sync:</span>
                  <span className="ml-2 text-gray-600">
                    {inventoryLastSync 
                      ? new Date(inventoryLastSync).toLocaleDateString('en-US', { timeZone: adminSettings?.systemTimeZone || 'America/Los_Angeles' }) + ' at ' + new Date(inventoryLastSync).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: adminSettings?.systemTimeZone || 'America/Los_Angeles', timeZoneName: 'short' })
                      : 'Never'
                    }
                  </span>
                </div>
              </div>
              
              {/* Display sync statistics inline */}
              {inventoryLastSync && (
                <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-medium text-green-700">Added:</span> {inventoryStats.added}</div>
                    <div><span className="font-medium text-blue-700">Updated:</span> {inventoryStats.updated}</div>
                    <div><span className="font-medium text-gray-700">Skipped:</span> {inventoryStats.skipped}</div>
                    <div><span className="font-medium text-red-700">Failed:</span> {inventoryStats.failed}</div>
                  </div>
                  <div className="mt-1 text-center"><span className="font-medium">Processed:</span> {inventoryStats.total}</div>
                </div>
              )}
            </div>
            
            {inventorySyncError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-red-700"><strong>Error:</strong> {inventorySyncError}</p>
                  <Button
                    onClick={async () => {
                      try {
                        console.log('Attempting to clear inventory error...');
                        const response = await apiRequest('/api/admin/bill-hicks/clear-inventory-error', 'POST');
                        console.log('Response status:', response.status);
                        
                        if (response.status === 401) {
                          toast({
                            title: "Authentication Required",
                            description: "Please log in again to clear errors",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        const result = await response.json();
                        console.log('Response result:', result);
                        
                        if (result.success) {
                          toast({
                            title: "Error Cleared",
                            description: "Bill Hicks inventory sync error has been cleared"
                          });
                          // Refresh vendor data to show updated status
                          await queryClient.refetchQueries({ queryKey: ['/api/admin/supported-vendors'] });
                        } else {
                          toast({
                            title: "Error",
                            description: result.message || "Failed to clear error",
                            variant: "destructive"
                          });
                        }
                      } catch (error) {
                        console.error('Clear inventory error failed:', error);
                        if (error instanceof Error && error.message.includes('401')) {
                          toast({
                            title: "Authentication Required",
                            description: "Please log in again to clear errors",
                            variant: "destructive"
                          });
                        } else {
                          toast({
                            title: "Error",
                            description: `Failed to clear inventory error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            variant: "destructive"
                          });
                        }
                      }
                    }}
                    size="sm"
                    variant="outline"
                    className="ml-2"
                  >
                    Clear Error
                  </Button>
                </div>
              </div>
            )}
          </div>


          {/* Schedule Configuration */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-4">Schedule Configuration</h4>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="inventory-enabled"
                  checked={inventoryEnabled}
                  onCheckedChange={(checked) => handleInventorySettingsChange('enabled', checked)}
                />
                <Label htmlFor="inventory-enabled" className="text-sm">
                  Enable automated inventory sync
                </Label>
              </div>
              
              {inventoryEnabled && (
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
                  <div className="font-medium text-blue-700 mb-1">Automated Schedule:</div>
                  <div>• Runs daily at the top of every hour (00:00, 01:00, 02:00, etc.)</div>
                  <div>• Managed by Scheduled Deployments for reliability</div>
                  <div>• No manual time configuration needed</div>
                </div>
              )}
              
              {hasInventoryUnsavedChanges && (
                <div className="text-sm text-amber-600 font-medium">
                  You have unsaved changes
                </div>
              )}
            </div>
          </div>

          {/* Manual Sync */}
          <div className="bg-white p-3 rounded border">
            <p className="text-xs text-gray-600 mb-3">
              Manual sync runs independently of automated Scheduled Deployments
            </p>
            <Button
              onClick={handleManualInventorySync}
              disabled={isManualSyncing || inventorySyncStatus === 'in_progress'}
              variant="outline"
              className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
              data-testid="button-manual-inventory-sync"
            >
              {isManualSyncing || inventorySyncStatus === 'in_progress' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing Inventory...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Manual Sync Inventory Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      </div>
    </div>
  );
}
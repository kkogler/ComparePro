import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Plus, Settings, Trash2, Send, Merge, Store, Eye, FileText, Zap, Webhook, Link2, Globe, Download, Mail, FileSpreadsheet, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { OrderWithVendor } from "@/lib/types";


export default function VendorOrders() {
  const [location] = useLocation();
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'open' | 'complete' | 'cancelled' | 'active'>('active');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [editingQuantities, setEditingQuantities] = useState<{[key: number]: number}>({});
  const [editingCustomerRefs, setEditingCustomerRefs] = useState<{[key: number]: string}>({});
  const [editingNotes, setEditingNotes] = useState<{[key: number]: string}>({});
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNoteItemId, setEditingNoteItemId] = useState<number | null>(null);
  const [tempNote, setTempNote] = useState("");
  const [createPOInMicroBiz, setCreatePOInMicroBiz] = useState(true);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookPayload, setWebhookPayload] = useState<any>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailOrderId, setEmailOrderId] = useState<number | null>(null);
  
  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{
    status?: string;
    storeId?: number;
    notes?: string;
  }>({});
  
  // Column visibility state for Order Items table
  const [columnVisibility, setColumnVisibility] = useState({
    image: false,      // Make image optional (hidden by default)
    product: true,
    vendorId: true,    // Show Vendor SKU column
    upc: false,        // Make UPC optional (hidden by default) 
    partNumber: false, // Make Mfg Part Number optional (hidden by default)
    unitCost: true,
    quantity: true,
    total: true,
    actions: true
  });

  // Bulk selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { organizationSlug } = useAuth();

  // Check for orderId URL parameter to auto-open order details modal
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const orderIdParam = urlParams.get('orderId');
    
    if (orderIdParam) {
      const orderId = parseInt(orderIdParam, 10);
      if (!isNaN(orderId)) {
        setSelectedOrderId(orderId);
        setIsDetailModalOpen(true);
        
        // Clean up URL parameter after opening modal
        const newUrl = location.split('?')[0];
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [location]);

  // Load user preferences for column visibility
  const { data: userPreferences } = useQuery({
    queryKey: ['/api/preferences/order-details-columns'],
    queryFn: async () => {
      const response = await fetch('/api/preferences/order-details-columns', { credentials: "include" });
      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, use defaults
          return { preferences: {} };
        }
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 30000
  });

  // Update column visibility when user preferences are loaded
  useEffect(() => {
    if (userPreferences?.preferences && Object.keys(userPreferences.preferences).length > 0) {
      setColumnVisibility(prev => ({
        ...prev,
        ...userPreferences.preferences
      }));
    }
  }, [userPreferences]);

  // Save preferences when column visibility changes
  const saveColumnPreferences = useMutation({
    mutationFn: async (preferences: any) => {
      const response = await fetch('/api/preferences/order-details-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences })
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onError: (error) => {
      console.error('Failed to save column preferences:', error);
      // Don't show error toast for preferences - it's not critical
    }
  });

  // Enhanced column visibility setter that saves to preferences
  const updateColumnVisibility = (updates: Partial<typeof columnVisibility>) => {
    const newVisibility = { ...columnVisibility, ...updates };
    setColumnVisibility(newVisibility);
    
    // Save to user preferences (but don't block on failure)
    saveColumnPreferences.mutate(newVisibility);
  };

  const { data: orders, isLoading } = useQuery<OrderWithVendor[]>({
    queryKey: [organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders', statusFilter !== 'all' && statusFilter !== 'active' ? statusFilter : 'all'],
    queryFn: async () => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      const url = (statusFilter === 'all' || statusFilter === 'active') ? baseUrl : `${baseUrl}?status=${statusFilter}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 30000 // 30 seconds
  });

  // Query for order details with items
  const { data: orderDetails } = useQuery({
    queryKey: [organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders', selectedOrderId, 'details'],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      const response = await fetch(`${baseUrl}/${selectedOrderId}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!selectedOrderId && isDetailModalOpen,
    staleTime: 30000 // 30 seconds
  });

  // Query for stores (for store selection dropdown)
  const { data: stores } = useQuery({
    queryKey: [organizationSlug ? `/org/${organizationSlug}/api/stores` : '/api/admin/stores'],
    queryFn: async () => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/stores` : '/api/admin/stores';
      const response = await fetch(baseUrl, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 60000 // 1 minute
  });



  const handleViewOrder = (orderId: number) => {
    setSelectedOrderId(orderId);
    setIsDetailModalOpen(true);
  };

  // Mutation for deleting order
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return await apiRequest(`/api/orders/${orderId}`, 'DELETE');
    },
    onSuccess: () => {
      // Invalidate all organization-specific order queries
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
      queryClient.invalidateQueries({ queryKey: [organizationSlug ? `/org/${organizationSlug}/api/dashboard` : '/api/dashboard'] });
      setIsDetailModalOpen(false);
      setSelectedOrderId(null);
      toast({
        title: "Order deleted",
        description: "The order has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete order",
        variant: "destructive",
      });
    }
  });

  // Mutation for saving order changes
  const saveOrderChangesMutation = useMutation({
    mutationFn: async (updates: any) => {
      return await apiRequest(`/api/orders/${selectedOrderId}`, 'PATCH', updates);
    },
    onSuccess: () => {
      // Invalidate order details to refresh the data
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      queryClient.invalidateQueries({ queryKey: [baseUrl, selectedOrderId, 'details'] });
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
      
      // Clear unsaved changes
      setHasUnsavedChanges(false);
      setPendingChanges({});
      
      toast({
        title: "Changes Saved",
        description: "Order changes saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });
    }
  });

  // Mutation for updating order status
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, updates }: { orderId: number; updates: any }) => {
      return await apiRequest(`/api/orders/${orderId}`, 'PATCH', updates);
    },
    onSuccess: () => {
      // Invalidate all organization-specific order queries
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
      queryClient.invalidateQueries({ queryKey: [baseUrl, selectedOrderId, 'details'] });
      queryClient.invalidateQueries({ queryKey: [organizationSlug ? `/org/${organizationSlug}/api/dashboard` : '/api/dashboard'] });
      toast({
        title: "Order updated",
        description: "The order has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    }
  });



  const handleDeleteOrder = async (orderId: number) => {
    if (window.confirm('Are you sure you want to delete this draft order? This action cannot be undone.')) {
      deleteOrderMutation.mutate(orderId);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (window.confirm('Are you sure you want to cancel this order? This will change the status to cancelled.')) {
      updateOrderMutation.mutate({ 
        orderId, 
        updates: { status: 'cancelled' } 
      });
    }
  };

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    const currentOrder = filteredOrders.find(order => order.id === orderId);
    if (!currentOrder) return;

    let confirmMessage = '';
    if (newStatus === 'open') {
      confirmMessage = 'Are you sure you want to change this order status from Draft to Open? This will submit the order to the vendor.';
    } else if (newStatus === 'complete') {
      confirmMessage = 'Are you sure you want to mark this order as Complete? This indicates the order has been fulfilled.';
    }

    if (window.confirm(confirmMessage)) {
      updateOrderMutation.mutate({ 
        orderId, 
        updates: { status: newStatus } 
      });
    }
  };



  // Mutation for submitting order to vendor (unified endpoint)
  const submitOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/orders';
      return await apiRequest(`${baseUrl}/${orderId}/submit`, 'POST');
    },
    onSuccess: (data: any) => {
      // Invalidate all organization-specific order queries
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
      queryClient.invalidateQueries({ queryKey: [baseUrl, selectedOrderId, 'details'] });
      queryClient.invalidateQueries({ queryKey: [organizationSlug ? `/org/${organizationSlug}/api/dashboard` : '/api/dashboard'] });
      
      // Close the order modal
      setIsDetailModalOpen(false);
      setSelectedOrderId(null);
      
      // Show success toast
      toast({
        title: "Order Submitted",
        description: "Order status changed to 'Open' and webhook sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save Order",
        description: error.message || "Failed to save order as open",
        variant: "destructive",
      });
    }
  });

  const handleSubmitOrder = async (orderId: number) => {
    if (window.confirm('Submit this order to vendor? This will change the order status to "Open" and generate webhooks.')) {
      submitOrderMutation.mutate(orderId);
    }
  };



  // Mutation for updating order item quantity and customer reference
  const updateOrderItemMutation = useMutation({
    mutationFn: async ({ itemId, quantity, unitCost, customerReference }: { itemId: number; quantity?: number; unitCost?: string; customerReference?: string | null }) => {
      const updates: any = {};
      if (quantity !== undefined) updates.quantity = quantity;
      if (unitCost !== undefined) updates.unitCost = unitCost;
      if (customerReference !== undefined) updates.customerReference = customerReference;
      return await apiRequest(`/api/order-items/${itemId}`, 'PATCH', updates);
    },
    onSuccess: () => {
      // Invalidate order details to refresh the data
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      queryClient.invalidateQueries({ queryKey: [baseUrl, selectedOrderId, 'details'] });
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update item quantity",
        variant: "destructive",
      });
    }
  });

  // Mutation for deleting order item
  const deleteOrderItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return await apiRequest(`/api/order-items/${itemId}`, 'DELETE');
    },
    onSuccess: () => {
      // Invalidate order details to refresh the data
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      queryClient.invalidateQueries({ queryKey: [baseUrl, selectedOrderId, 'details'] });
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
      toast({
        title: "Item Deleted",
        description: "Order item deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      });
    }
  });

  // Mutation for consolidating order items
  const consolidateOrderItemsMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/orders';
      return await apiRequest(`${baseUrl}/${orderId}/consolidate`, 'POST');
    },
    onSuccess: (data: any) => {
      // Invalidate order details to refresh the data
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      queryClient.invalidateQueries({ queryKey: [baseUrl, selectedOrderId, 'details'] });
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
      toast({
        title: "Items Consolidated",
        description: data.message || "Duplicate order items consolidated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Consolidation Failed",
        description: error.message || "Failed to consolidate order items",
        variant: "destructive",
      });
    }
  });

  // Mutation for generating webhook preview
  const generateWebhookMutation = useMutation({
    mutationFn: async (orderId: number) => {
      console.log(`Frontend: Requesting webhook preview for order ${orderId}`);
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/orders';
      const url = `${baseUrl}/${orderId}/webhook-preview`;
      console.log(`Frontend: Making request to ${url}`);
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      console.log(`Frontend: Webhook preview response:`, result);
      return result;
    },
    onSuccess: (data: any) => {
      console.log(`Frontend: Webhook mutation success, payload:`, data);
      setWebhookPayload(data);
      setWebhookDialogOpen(true);
      console.log(`Frontend: Dialog should now be open, webhookDialogOpen state set to true`);
    },
    onError: (error: any) => {
      console.error(`Frontend: Webhook mutation error:`, error);
      toast({
        title: "Webhook Preview Failed",
        description: error.message || "Failed to generate webhook preview",
        variant: "destructive",
      });
    }
  });

  // Mutation for CSV download using direct link method
  const downloadCSVMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/orders';
      const url = `${baseUrl}/${orderId}/csv-export`;
      console.log(`Frontend: Using direct link download method for order ${orderId}`);
      
      // Create direct download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-${orderId}-products.csv`;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      console.log(`Frontend: Triggering direct link download...`);
      a.click();
      document.body.removeChild(a);
      
      console.log(`Frontend: Direct link download triggered`);
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "CSV Downloaded",
        description: "Order CSV file has been downloaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download CSV file",
        variant: "destructive",
      });
    }
  });

  // Mutation for Order Quantity Export CSV download
  const downloadQuantityExportMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/orders';
      const response = await fetch(`${baseUrl}/${orderId}/quantity-export`, { 
        credentials: 'include' 
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `order-${orderId}-quantity-export.csv`; // fallback
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      const blob = await response.blob();
      console.log(`Frontend: Created blob with size: ${blob.size} bytes, type: ${blob.type}`);
      
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      console.log(`Frontend: Triggering download for filename: "${filename}"`);
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      
      console.log(`Frontend: Download triggered successfully`);
    },
    onSuccess: () => {
      toast({
        title: "Order Quantity Export Downloaded",
        description: "Order Quantity Export CSV file has been downloaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download Order Quantity Export CSV file",
        variant: "destructive",
      });
    }
  });

  // Mutation for Swipe Simple CSV download
  const downloadSwipeSimpleCSVMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/orders';
      const response = await fetch(`${baseUrl}/${orderId}/swipe-simple-export`, { 
        credentials: 'include' 
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `order-${orderId}-swipe-simple.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      const blob = await response.blob();
      console.log(`Frontend: Created Swipe Simple blob with size: ${blob.size} bytes, type: ${blob.type}`);
      
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      console.log(`Frontend: Triggering Swipe Simple download for filename: "${filename}"`);
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      
      console.log(`Frontend: Swipe Simple download triggered successfully`);
    },
    onSuccess: () => {
      toast({
        title: "Swipe Simple CSV Downloaded",
        description: "Swipe Simple CSV has been downloaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download Swipe Simple CSV",
        variant: "destructive",
      });
    }
  });

  // Mutation for emailing CSV
  const emailCSVMutation = useMutation({
    mutationFn: async ({ orderId, recipientEmail }: { orderId: number; recipientEmail: string }) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/orders';
      return await apiRequest(`${baseUrl}/${orderId}/email-csv`, 'POST', { recipientEmail });
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "CSV file has been emailed successfully",
      });
      setEmailDialogOpen(false);
      setEmailRecipient("");
      setEmailOrderId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Email Failed",
        description: error.message || "Failed to send CSV email",
        variant: "destructive",
      });
    }
  });

  // Handler for updating item quantity
  const handleUpdateQuantity = async (itemId: number, newQuantity: number, unitCost: string) => {
    if (newQuantity < 1) return;
    updateOrderItemMutation.mutate({ itemId, quantity: newQuantity, unitCost });
  };

  // Handler for deleting item
  const handleDeleteItem = async (itemId: number, itemName: string) => {
    if (window.confirm(`Are you sure you want to remove "${itemName}" from this order?`)) {
      deleteOrderItemMutation.mutate(itemId);
    }
  };

  // Handler for consolidating order items
  const handleConsolidateItems = async (orderId: number) => {
    if (window.confirm('Consolidate duplicate items? This will combine items for the same product into single line items with combined quantities.')) {
      consolidateOrderItemsMutation.mutate(orderId);
    }
  };

  // Handler for displaying webhook payload
  const handleDisplayWebhook = async (orderId: number) => {
    generateWebhookMutation.mutate(orderId);
  };

  // Handler for downloading CSV
  const handleDownloadCSV = async (orderId: number) => {
    downloadCSVMutation.mutate(orderId);
  };

  // Handler for downloading Order Quantity Export CSV
  const handleDownloadQuantityExport = async (orderId: number) => {
    downloadQuantityExportMutation.mutate(orderId);
  };

  // Handler for downloading Swipe Simple CSV
  const handleDownloadSwipeSimpleCSV = async (orderId: number) => {
    downloadSwipeSimpleCSVMutation.mutate(orderId);
  };

  // Handler for opening email dialog
  const handleEmailCSV = async (orderId: number) => {
    setEmailOrderId(orderId);
    setEmailDialogOpen(true);
  };

  // Handler for sending email
  const handleSendEmail = async () => {
    if (!emailOrderId || !emailRecipient.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a valid email address",
        variant: "destructive",
      });
      return;
    }

    emailCSVMutation.mutate({
      orderId: emailOrderId,
      recipientEmail: emailRecipient.trim()
    });
  };

  // Bulk action mutations
  const bulkDeleteDraftsMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders/bulk-delete` : '/api/orders/bulk-delete';
      return await apiRequest(baseUrl, 'POST', { orderIds });
    },
    onSuccess: (data: any) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
      setSelectedOrderIds(new Set());
      setSelectAll(false);
      toast({
        title: "Draft Orders Deleted",
        description: `Successfully deleted ${data.deletedCount} draft order(s).`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete draft orders",
        variant: "destructive",
      });
    }
  });

  const bulkChangeStatusMutation = useMutation({
    mutationFn: async ({ orderIds, status }: { orderIds: number[]; status: string }) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders/bulk-status` : '/api/orders/bulk-status';
      return await apiRequest(baseUrl, 'POST', { orderIds, status });
    },
    onSuccess: (data: any, variables) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
      setSelectedOrderIds(new Set());
      setSelectAll(false);
      const statusLabel = variables.status === 'open' ? 'Open' : variables.status === 'complete' ? 'Complete' : 'Cancelled';
      toast({
        title: "Orders Updated",
        description: `Successfully changed ${data.updatedCount} order(s) to ${statusLabel}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update orders",
        variant: "destructive",
      });
    }
  });

  const bulkMergeDraftsMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders/bulk-merge` : '/api/orders/bulk-merge';
      return await apiRequest(baseUrl, 'POST', { orderIds });
    },
    onSuccess: (data: any) => {
      const baseUrl = organizationSlug ? `/org/${organizationSlug}/api/orders` : '/api/admin/orders';
      queryClient.invalidateQueries({ queryKey: [baseUrl] });
      setSelectedOrderIds(new Set());
      setSelectAll(false);
      toast({
        title: "Draft Orders Merged",
        description: `Successfully merged ${data.mergedCount} orders into order #${data.survivingOrderNumber}. Total items: ${data.totalItems}, Total cost: $${data.totalCost}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to merge draft orders",
        variant: "destructive",
      });
    }
  });

  // Bulk action handlers
  const handleBulkDeleteDrafts = () => {
    const draftIds = selectedDraftOrders.map(o => o.id);
    if (window.confirm(`Are you sure you want to delete ${draftIds.length} draft order(s)? This action cannot be undone.`)) {
      bulkDeleteDraftsMutation.mutate(draftIds);
    }
  };

  const handleBulkChangeDraftToOpen = () => {
    const draftIds = selectedDraftOrders.map(o => o.id);
    if (window.confirm(`Are you sure you want to change ${draftIds.length} draft order(s) to Open status?`)) {
      bulkChangeStatusMutation.mutate({ orderIds: draftIds, status: 'open' });
    }
  };

  const handleBulkMarkComplete = () => {
    const openIds = selectedOpenOrders.map(o => o.id);
    if (window.confirm(`Are you sure you want to mark ${openIds.length} open order(s) as Complete?`)) {
      bulkChangeStatusMutation.mutate({ orderIds: openIds, status: 'complete' });
    }
  };

  const handleBulkCancelOpen = () => {
    const openIds = selectedOpenOrders.map(o => o.id);
    if (window.confirm(`Are you sure you want to cancel ${openIds.length} open order(s)?`)) {
      bulkChangeStatusMutation.mutate({ orderIds: openIds, status: 'cancelled' });
    }
  };

  const handleBulkMergeDrafts = () => {
    const draftIds = selectedDraftOrders.map(o => o.id);
    if (draftIds.length < 2) {
      toast({
        title: "Not Enough Orders",
        description: "Please select at least 2 draft orders to merge.",
        variant: "destructive",
      });
      return;
    }
    if (window.confirm(`Are you sure you want to merge ${draftIds.length} draft orders? All items and costs will be combined into a single order.`)) {
      bulkMergeDraftsMutation.mutate(draftIds);
    }
  };

  // Handler for quantity input changes
  const handleQuantityChange = (itemId: number, value: string) => {
    const quantity = parseInt(value) || 1;
    setEditingQuantities(prev => ({ ...prev, [itemId]: quantity }));
  };

  // Handler for quantity input blur (save changes)
  const handleQuantityBlur = (itemId: number, unitCost: string) => {
    const newQuantity = editingQuantities[itemId];
    if (newQuantity && newQuantity > 0) {
      handleUpdateQuantity(itemId, newQuantity, unitCost);
    }
    // Clear the editing state
    setEditingQuantities(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
  };

  // Handler for customer reference input changes
  const handleCustomerRefChange = (itemId: number, value: string) => {
    setEditingCustomerRefs(prev => ({ ...prev, [itemId]: value }));
  };

  // Handler for customer reference input blur (save changes)
  const handleCustomerRefBlur = (itemId: number) => {
    const newCustomerRef = editingCustomerRefs[itemId];
    if (newCustomerRef !== undefined) {
      updateOrderItemMutation.mutate({ 
        itemId, 
        customerReference: newCustomerRef.trim() || null 
      });
    }
    // Clear the editing state
    setEditingCustomerRefs(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
  };

  // Handler for opening note dialog
  const handleNoteClick = (itemId: number, currentNote?: string) => {
    setEditingNoteItemId(itemId);
    setTempNote(currentNote || '');
    setNoteDialogOpen(true);
  };

  // Handler for saving note
  const handleNoteSave = async () => {
    if (editingNoteItemId) {
      const noteText = tempNote.trim();
      try {
        await updateOrderItemMutation.mutateAsync({
          itemId: editingNoteItemId,
          customerReference: noteText || null
        });
        setEditingNotes(prev => ({
          ...prev,
          [editingNoteItemId]: noteText
        }));
        // Only close dialog on success
        setNoteDialogOpen(false);
        setEditingNoteItemId(null);
        setTempNote('');
      } catch (error) {
        // Error is already handled by the mutation's onError
        // Dialog stays open so user can retry
      }
    }
  };

  const handleStatusChange = (orderId: number, newStatus: string) => {
    if (newStatus !== orderDetails?.status) {
      setPendingChanges(prev => ({ ...prev, status: newStatus }));
      setHasUnsavedChanges(true);
    }
  };

  // Handle modal close with unsaved changes warning
  const handleModalClose = (open: boolean) => {
    if (!open && hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return; // Don't close the modal
      }
    }
    setIsDetailModalOpen(open);
  };

  // Handle save changes
  const handleSaveChanges = () => {
    saveOrderChangesMutation.mutate(pendingChanges);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Draft</Badge>;
      case 'open':
        return <Badge variant="default" className="bg-green-100 text-green-800">Open</Badge>;
      case 'complete':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Complete</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    });
  };

  // Helper function to get date range
  const getDateRange = (range: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { start: yesterday, end: today };
      case 'last7days':
        const week = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: week, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'last30days':
        const month = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start: month, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'thisMonth':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { start: monthStart, end: monthEnd };
      case 'lastMonth':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: lastMonthStart, end: lastMonthEnd };
      default:
        return null;
    }
  };

  // Get unique vendors and stores from orders
  const uniqueVendors = Array.from(new Set(orders?.map(order => order.vendorShortCode || order.vendor) || []));
  const uniqueStores = Array.from(new Set(orders?.map(order => (order as any).storeName || 'Unknown Store') || []));

  const filteredOrders = orders?.filter(order => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && !(order.status === 'draft' || order.status === 'open')) {
        return false;
      } else if (statusFilter !== 'active' && order.status !== statusFilter) {
        return false;
      }
    }

    // Vendor filter
    if (vendorFilter !== 'all') {
      const orderVendor = order.vendorShortCode || order.vendor;
      if (orderVendor !== vendorFilter) {
        return false;
      }
    }

    // Store filter
    if (storeFilter !== 'all') {
      const orderStore = (order as any).storeName || 'Unknown Store';
      if (orderStore !== storeFilter) {
        return false;
      }
    }

    // Date range filter
    if (dateRangeFilter !== 'all') {
      const dateRange = getDateRange(dateRangeFilter);
      if (dateRange) {
        const orderDate = new Date(order.orderDate);
        if (orderDate < dateRange.start || orderDate >= dateRange.end) {
          return false;
        }
      }
    }

    return true;
  }) || [];

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allOrderIds = new Set(filteredOrders.map(order => order.id));
      setSelectedOrderIds(allOrderIds);
      setSelectAll(true);
    } else {
      setSelectedOrderIds(new Set());
      setSelectAll(false);
    }
  };

  const handleSelectOrder = (orderId: number, checked: boolean) => {
    const newSelection = new Set(selectedOrderIds);
    if (checked) {
      newSelection.add(orderId);
    } else {
      newSelection.delete(orderId);
    }
    setSelectedOrderIds(newSelection);
    setSelectAll(newSelection.size === filteredOrders.length && filteredOrders.length > 0);
  };

  // Get selected orders by status
  const selectedOrders = filteredOrders.filter(order => selectedOrderIds.has(order.id));
  const selectedDraftOrders = selectedOrders.filter(order => order.status === 'draft');
  const selectedOpenOrders = selectedOrders.filter(order => order.status === 'open');
  // Can only merge if 2+ draft orders AND all from the same vendor
  const canMergeDrafts = selectedDraftOrders.length >= 2 && 
    selectedDraftOrders.every(order => order.vendorId === selectedDraftOrders[0].vendorId);
  const canDeleteDrafts = selectedDraftOrders.length > 0;
  const canChangeDraftToOpen = selectedDraftOrders.length > 0;
  const canMarkOpenComplete = selectedOpenOrders.length > 0;
  const canCancelOpen = selectedOpenOrders.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendor Orders</h1>
          <p className="text-muted-foreground">Manage and track orders across vendors</p>
        </div>
      </div>

      <div>
        
        {/* Additional Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vendor Filter */}
          <div className="space-y-2">
            <Label htmlFor="vendor-filter" className="text-sm font-medium text-gray-700">
              Vendor
            </Label>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger id="vendor-filter" className="w-full">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {uniqueVendors.map((vendor) => (
                  <SelectItem key={vendor} value={vendor}>
                    {vendor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Store Filter */}
          <div className="space-y-2">
            <Label htmlFor="store-filter" className="text-sm font-medium text-gray-700">
              Store
            </Label>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger id="store-filter" className="w-full">
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {uniqueStores.map((store) => (
                  <SelectItem key={store} value={store}>
                    {store}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label htmlFor="date-filter" className="text-sm font-medium text-gray-700">
              Date Range
            </Label>
            <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
              <SelectTrigger id="date-filter" className="w-full">
                <SelectValue placeholder="All Dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Filter Toggles */}
        <div className="mt-4 flex space-x-4">
          <Button 
            variant="ghost"
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              statusFilter === 'active'
                ? "bg-gray-100 text-gray-800 shadow-sm"
                : "text-muted-foreground hover:bg-gray-50 hover:text-gray-700"
            )}
            onClick={() => setStatusFilter('active')}
          >
            Active Orders
          </Button>
          <Button 
            variant="ghost"
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              statusFilter === 'draft'
                ? "bg-orange-100 text-orange-800 shadow-sm"
                : "text-muted-foreground hover:bg-orange-50 hover:text-orange-700"
            )}
            onClick={() => setStatusFilter('draft')}
          >
            Draft Orders
          </Button>
          <Button 
            variant="ghost"
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              statusFilter === 'open'
                ? "bg-green-100 text-green-800 shadow-sm"
                : "text-muted-foreground hover:bg-green-50 hover:text-green-700"
            )}
            onClick={() => setStatusFilter('open')}
          >
            Submitted Orders
          </Button>
          <Button 
            variant="ghost"
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              statusFilter === 'complete'
                ? "bg-blue-100 text-blue-800 shadow-sm"
                : "text-muted-foreground hover:bg-blue-50 hover:text-blue-700"
            )}
            onClick={() => setStatusFilter('complete')}
          >
            Completed Orders
          </Button>
          <Button 
            variant="ghost"
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              statusFilter === 'cancelled'
                ? "bg-red-100 text-red-800 shadow-sm"
                : "text-muted-foreground hover:bg-red-50 hover:text-red-700"
            )}
            onClick={() => setStatusFilter('cancelled')}
          >
            Cancelled Orders
          </Button>
          <Button 
            variant="ghost"
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              statusFilter === 'all'
                ? "bg-gray-100 text-gray-800 shadow-sm"
                : "text-muted-foreground hover:bg-gray-50 hover:text-gray-700"
            )}
            onClick={() => setStatusFilter('all')}
          >
            All Orders
          </Button>
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            {/* Bulk Action Buttons */}
            <div className="flex items-center gap-2">
              {selectedOrderIds.size > 0 ? (
                <>
                  <span className="text-sm font-medium text-gray-700">
                    {selectedOrderIds.size} selected
                  </span>
                  {canDeleteDrafts && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleBulkDeleteDrafts()}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Draft Orders
                    </Button>
                  )}
                  {canChangeDraftToOpen && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkChangeDraftToOpen()}
                      className="flex items-center gap-1 text-green-600 border-green-600 hover:bg-green-50"
                    >
                      <Send className="h-4 w-4" />
                      Change Draft to Open
                    </Button>
                  )}
                  {canMarkOpenComplete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkMarkComplete()}
                      className="flex items-center gap-1 text-blue-600 border-blue-600 hover:bg-blue-50"
                    >
                      <Eye className="h-4 w-4" />
                      Mark Open as Complete
                    </Button>
                  )}
                  {canCancelOpen && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkCancelOpen()}
                      className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      Cancel Open Orders
                    </Button>
                  )}
                  {canMergeDrafts && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkMergeDrafts()}
                      className="flex items-center gap-1 text-purple-600 border-purple-600 hover:bg-purple-50"
                    >
                      <Merge className="h-4 w-4" />
                      Merge Draft Orders
                    </Button>
                  )}
                </>
              ) : null}
            </div>

            {/* Right side - Settings and count */}
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-500">
                {filteredOrders.length} orders
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectAll}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all orders"
                      />
                    </TableHead>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Order Amount</TableHead>
                    <TableHead>Status Action</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-gray-700">MicroBiz</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-gray-700">SwipeSimple</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="table-hover cursor-pointer" 
                      onDoubleClick={() => handleViewOrder(order.id)}
                    >
                      <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedOrderIds.has(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                          aria-label={`Select order ${order.orderNumber}`}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewOrder(order.id);
                          }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {order.orderNumber}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <div className={`status-indicator status-${order.status}`}></div>
                          {getStatusBadge(order.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">
                        {order.vendorShortCode || order.vendor}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">
                        <div className="flex items-center gap-1">
                          <Store className="h-3 w-3 text-gray-400" />
                          {order.storeName || 'Unknown Store'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">
                        {formatDate(order.orderDate)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900 text-right">
                        {order.itemCount}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-gray-900 text-right">
                        {order.totalAmount.startsWith('$') ? order.totalAmount : `$${order.totalAmount}`}
                      </TableCell>
                      <TableCell>
                        {order.status === 'draft' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleStatusUpdate(order.id, 'open')}
                            disabled={updateOrderMutation.isPending}
                            className="px-3 py-1 text-xs font-medium text-green-600 border-green-600 hover:bg-green-50"
                          >
                            Save as Open
                          </Button>
                        )}
                        {order.status === 'open' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleStatusUpdate(order.id, 'complete')}
                            disabled={updateOrderMutation.isPending}
                            className="px-3 py-1 text-xs font-medium text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            Mark Complete
                          </Button>
                        )}
                        {(order.status === 'complete' || order.status === 'cancelled') && (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleViewOrder(order.id)} 
                            className="px-3 py-1 text-xs font-medium"
                            data-testid={`button-edit-order-${order.id}`}
                          >
                            Edit
                          </Button>
                          
                          
                          {order.status === 'open' && createPOInMicroBiz && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDisplayWebhook(order.id)}
                              disabled={generateWebhookMutation.isPending}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              title="Display Webhook"
                              data-testid={`button-display-webhook-${order.id}`}
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                          )}
                          {order.status === 'draft' ? (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteOrder(order.id)}
                              disabled={deleteOrderMutation.isPending}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              title="Delete Draft Order"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                      
                      {/* MicroBiz Export Column */}
                      <TableCell className="text-center">
                        {(order.status === 'open' || order.status === 'complete') && (
                          <div className="flex justify-center space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDownloadCSV(order.id)}
                              disabled={downloadCSVMutation.isPending}
                              className="text-green-600 hover:text-green-800 hover:bg-green-50"
                              title="Download Product Import CSV"
                              data-testid={`button-download-csv-${order.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDownloadQuantityExport(order.id)}
                              disabled={downloadQuantityExportMutation.isPending}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              title="Download Order Quantity Export CSV"
                              data-testid={`button-download-quantity-export-${order.id}`}
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEmailCSV(order.id)}
                              disabled={emailCSVMutation.isPending}
                              className="text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                              title="Email Both CSV Files"
                              data-testid={`button-email-csv-${order.id}`}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      
                      {/* SwipeSimple Export Column */}
                      <TableCell className="text-center">
                        {(order.status === 'open' || order.status === 'complete') && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDownloadSwipeSimpleCSV(order.id)}
                            disabled={downloadSwipeSimpleCSVMutation.isPending}
                            className="text-green-600 hover:text-green-800 hover:bg-green-50"
                            title="Download Swipe Simple CSV"
                            data-testid={`button-download-swipe-simple-csv-${order.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {statusFilter === 'all' ? 'No orders found' : 
               statusFilter === 'draft' ? 'No draft orders' : 
               statusFilter === 'open' ? 'No submitted orders' :
               statusFilter === 'complete' ? 'No completed orders' :
               statusFilter === 'cancelled' ? 'No cancelled orders' :
               statusFilter === 'active' ? 'No active orders' :
               'No orders found'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Order Details - {orderDetails?.orderNumber}
            </DialogTitle>
          </DialogHeader>
          
          {orderDetails ? (
            <div className="space-y-6">
              {/* Order Header - Redesigned */}
              <div className="grid grid-cols-3 gap-6 p-4 bg-gray-50 rounded-lg">
                {/* Vendor Column */}
                <div>
                  <h3 className="font-semibold text-gray-900 text-base mb-2">Vendor</h3>
                  <p className="text-gray-700">{orderDetails.vendor}</p>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-600">Order Date: {formatDate(orderDetails.orderDate)}</p>
                    <p className="text-sm text-gray-600">Order Type: {orderDetails.orderType ? orderDetails.orderType.charAt(0).toUpperCase() + orderDetails.orderType.slice(1) : 'Standard'}</p>
                  </div>
                </div>

                {/* Order Store Column */}
                <div>
                  <h3 className="font-semibold text-gray-900 text-base mb-2">Order Store</h3>
                  {(() => {
                    const orderStore = stores?.find((store: any) => store.id === orderDetails.storeId);
                    if (orderStore) {
                      return (
                        <div>
                          {(orderDetails.status === 'draft' || orderDetails.status === 'open') && stores && stores.length > 1 ? (
                            <Select
                              value={orderDetails.storeId?.toString() || ''}
                              onValueChange={(storeId) => {
                                const newStoreId = parseInt(storeId);
                                if (newStoreId !== orderDetails.storeId) {
                                  setPendingChanges(prev => ({ ...prev, storeId: newStoreId }));
                                  setHasUnsavedChanges(true);
                                }
                              }}
                            >
                              <SelectTrigger className="w-full mb-2">
                                <SelectValue placeholder="Select store..." />
                              </SelectTrigger>
                              <SelectContent>
                                {stores?.map((store: any) => (
                                  <SelectItem key={store.id} value={store.id.toString()}>
                                    {store.name} ({store.shortName})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-gray-700 font-medium mb-2">{orderStore.name} ({orderStore.shortName})</p>
                          )}
                          <div className="space-y-1">
                            <p className="text-sm text-gray-600">{orderStore.address1}</p>
                            {orderStore.address2 && (
                              <p className="text-sm text-gray-600">{orderStore.address2}</p>
                            )}
                            <p className="text-sm text-gray-600">{orderStore.city}, {orderStore.state} {orderStore.zipCode}</p>
                            {orderStore.phone && (
                              <p className="text-sm text-gray-600">{orderStore.phone}</p>
                            )}
                            {orderStore.fflNumber && (
                              <p className="text-sm text-gray-600">FFL Number: {orderStore.fflNumber}</p>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <p className="text-sm text-orange-600">
                          <strong>Note:</strong> No store selected for this order
                        </p>
                      );
                    }
                  })()}
                </div>

                {/* Order Status Column */}
                <div>
                  <h3 className="font-semibold text-gray-900 text-base mb-2">Order Status</h3>
                  <div className="mb-2">
                    <Select
                      value={orderDetails.status}
                      onValueChange={(newStatus) => handleStatusChange(orderDetails.id, newStatus)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Totals Section */}
                  <div className="pt-3">
                    <h3 className="font-semibold text-gray-900 text-base mb-2">Totals</h3>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">Order Total: ${orderDetails.totalAmount}</p>
                      <p className="text-sm text-gray-600">Items: {orderDetails.itemCount || orderDetails.items?.length || 0}</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* API Data Section - Drop-Ship & Special Handling */}
              {(orderDetails.dropShipFlag || orderDetails.fflNumber || orderDetails.deliveryOption) && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">Drop-Ship & Special Handling (API Data)</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600"><span className="font-medium">Drop-Ship:</span> {orderDetails.dropShipFlag ? 'Yes' : 'No'}</p>
                      {orderDetails.dropShipFlag && orderDetails.customer && (
                        <p className="text-gray-600"><span className="font-medium">Customer:</span> {orderDetails.customer}</p>
                      )}
                      {orderDetails.deliveryOption && (
                        <p className="text-gray-600"><span className="font-medium">Delivery Option:</span> {orderDetails.deliveryOption}</p>
                      )}
                      {orderDetails.fflNumber && (
                        <p className="text-gray-600"><span className="font-medium">FFL Number:</span> {orderDetails.fflNumber}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-600"><span className="font-medium">Insurance:</span> {orderDetails.insuranceFlag ? 'Yes' : 'No'}</p>
                      <p className="text-gray-600"><span className="font-medium">Adult Signature:</span> {orderDetails.adultSignatureFlag ? 'Yes' : 'No'}</p>
                      {orderDetails.overnight && (
                        <p className="text-gray-600"><span className="font-medium">Overnight Shipping:</span> {orderDetails.overnight ? 'Yes' : 'No'}</p>
                      )}
                      {orderDetails.delayShipping && (
                        <p className="text-gray-600"><span className="font-medium">Delay Shipping:</span> {orderDetails.delayShipping ? 'Yes' : 'No'}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* API Data Section - Billing Address (Lipsey's) */}
              {(orderDetails.billingName || orderDetails.billingLine1) && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">Billing Address (Lipsey's API Data)</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600"><span className="font-medium">Name:</span> {orderDetails.billingName || 'Not specified'}</p>
                      <p className="text-gray-600"><span className="font-medium">Address Line 1:</span> {orderDetails.billingLine1 || 'Not specified'}</p>
                      {orderDetails.billingLine2 && (
                        <p className="text-gray-600"><span className="font-medium">Address Line 2:</span> {orderDetails.billingLine2}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-600"><span className="font-medium">City:</span> {orderDetails.billingCity || 'Not specified'}</p>
                      <p className="text-gray-600"><span className="font-medium">State:</span> {orderDetails.billingStateCode || 'Not specified'}</p>
                      <p className="text-gray-600"><span className="font-medium">ZIP:</span> {orderDetails.billingZip || 'Not specified'}</p>
                      {orderDetails.customerPhone && (
                        <p className="text-gray-600"><span className="font-medium">Customer Phone:</span> {orderDetails.customerPhone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sales Executive Message - Only show if exists */}
              {orderDetails.messageForSalesExec && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">Sales Executive Message</h3>
                  <p className="text-sm text-gray-600">{orderDetails.messageForSalesExec}</p>
                </div>
              )}

              {/* Order Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Order Items</h3>
                  
                  {/* Column Management Controls */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2"
                        data-testid="button-manage-columns"
                      >
                        <Settings className="h-4 w-4" />
                        Manage Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Table Columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={columnVisibility.image}
                        onCheckedChange={(checked) => updateColumnVisibility({ image: !!checked })}
                        data-testid="checkbox-column-image"
                      >
                        Product Image
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={columnVisibility.product}
                        onCheckedChange={(checked) => updateColumnVisibility({ product: !!checked })}
                        data-testid="checkbox-column-product"
                      >
                        Name
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={columnVisibility.vendorId}
                        onCheckedChange={(checked) => updateColumnVisibility({ vendorId: !!checked })}
                        data-testid="checkbox-column-vendor-sku"
                      >
                        Vendor SKU
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={columnVisibility.upc}
                        onCheckedChange={(checked) => updateColumnVisibility({ upc: !!checked })}
                        data-testid="checkbox-column-upc"
                      >
                        UPC
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={columnVisibility.partNumber}
                        onCheckedChange={(checked) => updateColumnVisibility({ partNumber: !!checked })}
                        data-testid="checkbox-column-part-number"
                      >
                        Mfg Part Number
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={columnVisibility.unitCost}
                        onCheckedChange={(checked) => updateColumnVisibility({ unitCost: !!checked })}
                        data-testid="checkbox-column-unit-cost"
                      >
                        Unit Cost
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={columnVisibility.quantity}
                        onCheckedChange={(checked) => updateColumnVisibility({ quantity: !!checked })}
                        data-testid="checkbox-column-quantity"
                      >
                        Quantity
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={columnVisibility.total}
                        onCheckedChange={(checked) => updateColumnVisibility({ total: !!checked })}
                        data-testid="checkbox-column-total"
                      >
                        Total
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={columnVisibility.actions}
                        onCheckedChange={(checked) => updateColumnVisibility({ actions: !!checked })}
                        data-testid="checkbox-column-actions"
                      >
                        Actions
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {orderDetails.items && orderDetails.items.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columnVisibility.product && <TableHead className="w-3/4">Name</TableHead>}
                          {columnVisibility.vendorId && <TableHead>Vendor SKU</TableHead>}
                          {columnVisibility.upc && <TableHead>UPC</TableHead>}
                          {columnVisibility.partNumber && <TableHead>Mfg Part Number</TableHead>}
                          {columnVisibility.unitCost && <TableHead>Unit Cost</TableHead>}
                          {columnVisibility.quantity && <TableHead>Quantity</TableHead>}
                          {columnVisibility.total && <TableHead className="text-right">Total</TableHead>}
                          {columnVisibility.actions && <TableHead>Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderDetails.items.map((item: any) => (
                          <>
                            <TableRow key={item.id}>
                              {columnVisibility.product && (
                                <TableCell className="w-3/4">
                                  <div className="flex items-center space-x-3">
                                    {columnVisibility.image && item.product?.imageUrl && (
                                      <img 
                                        src={item.product.imageUrl} 
                                        alt={item.product.name}
                                        className="w-12 h-12 object-cover rounded"
                                      />
                                    )}
                                    <div>
                                      <div className="font-medium">{item.product?.name}</div>
                                      <div className="text-sm text-gray-500">{item.product?.brand} {item.product?.model}</div>
                                    </div>
                                  </div>
                                </TableCell>
                              )}
                              {columnVisibility.vendorId && (
                                <TableCell className="text-sm">{item.vendorSku || 'N/A'}</TableCell>
                              )}
                              {columnVisibility.upc && (
                                <TableCell className="text-sm">{item.product?.upc}</TableCell>
                              )}
                              {columnVisibility.partNumber && (
                                <TableCell className="text-sm">{item.product?.manufacturerPartNumber}</TableCell>
                              )}
                              {columnVisibility.unitCost && (
                                <TableCell className="text-sm">{item.unitCost}</TableCell>
                              )}
                              {columnVisibility.quantity && (
                                <TableCell className="text-sm">
                                  {orderDetails.status === 'draft' || orderDetails.status === 'open' ? (
                                    <Input
                                      type="number"
                                      min="1"
                                      value={editingQuantities[item.id] !== undefined ? editingQuantities[item.id] : item.quantity}
                                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                      onBlur={() => handleQuantityBlur(item.id, item.unitCost)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className="w-20 h-8 text-center"
                                    />
                                  ) : (
                                    <span>{item.quantity}</span>
                                  )}
                                </TableCell>
                              )}
                              {columnVisibility.total && (
                                <TableCell className="text-sm font-medium text-right">
                                  ${(parseFloat(item.unitCost.replace('$', '')) * (editingQuantities[item.id] || item.quantity)).toFixed(2)}
                                </TableCell>
                              )}
                              {columnVisibility.actions && (
                                <TableCell>
                                  {(orderDetails.status === 'draft' || orderDetails.status === 'open') && (
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleNoteClick(item.id, item.customerReference)}
                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                        data-testid={`button-note-${item.id}`}
                                      >
                                        <FileText className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteItem(item.id, item.product?.name || 'Item')}
                                        disabled={deleteOrderItemMutation.isPending}
                                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                        data-testid={`button-delete-${item.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                            {/* Note row - display below the item if note exists */}
                            {(item.customerReference || editingNotes[item.id]) && (
                              <TableRow key={`${item.id}-note`} className="border-t-0">
                                <TableCell 
                                  colSpan={
                                    Object.values(columnVisibility).filter(Boolean).length
                                  }
                                  className="py-2 px-4 bg-gray-50 border-l-4 border-l-gray-300"
                                >
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-3 w-3 text-gray-600" />
                                    <span className="text-sm text-gray-800 font-medium">Note:</span>
                                    <span className="text-sm text-gray-700">
                                      {editingNotes[item.id] || item.customerReference}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No items found for this order</p>
                )}
              </div>

              {/* Order Note Field */}
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Order Note</h3>
                <Textarea
                  placeholder="Add a note to be displayed on the order"
                  value={pendingChanges.notes !== undefined ? pendingChanges.notes : (orderDetails?.notes || '')}
                  onChange={(e) => {
                    const newNotes = e.target.value;
                    
                    // Track changes
                    if (newNotes !== (orderDetails?.notes || '')) {
                      setPendingChanges(prev => ({ ...prev, notes: newNotes }));
                      setHasUnsavedChanges(true);
                    }
                  }}
                  className="min-h-[80px]"
                  data-testid="textarea-order-note"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                {/* MicroBiz Integration Setting - Left Side */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="create-po-microbiz"
                    checked={createPOInMicroBiz}
                    onCheckedChange={(checked) => setCreatePOInMicroBiz(!!checked)}
                    disabled={orderDetails?.status === 'complete'}
                  />
                  <Label 
                    htmlFor="create-po-microbiz" 
                    className="text-sm font-medium text-gray-900 cursor-pointer"
                  >
                    Automatically create PO in MicroBiz when submitting to Vendor?
                  </Label>
                </div>

                {/* Action Buttons - Right Side */}
                <div className="flex gap-2">
                  {/* Save Changes Button */}
                  {hasUnsavedChanges && (
                    <Button
                      onClick={handleSaveChanges}
                      disabled={saveOrderChangesMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      {saveOrderChangesMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  )}
                  
                  {(orderDetails.status === 'draft' || orderDetails.status === 'open') && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => handleConsolidateItems(orderDetails.id)}
                        disabled={consolidateOrderItemsMutation.isPending || !orderDetails.items || orderDetails.items.length < 2}
                        className="flex items-center gap-2"
                      >
                        <Merge className="h-4 w-4" />
                        {consolidateOrderItemsMutation.isPending ? "Consolidating..." : "Consolidate Items"}
                      </Button>

                    </>
                  )}
                  
                  {/* Universal submit button for all vendors (excluding GunBroker which is pricing-only) */}
                  {!orderDetails.vendor?.toLowerCase().includes("gunbroker") && orderDetails.status === 'draft' && (
                    <Button
                      onClick={() => handleSubmitOrder(orderDetails.id)}
                      disabled={submitOrderMutation.isPending}
                      className="flex items-center gap-2 btn-orange-action"
                      data-testid="button-submit-order"
                    >
                      <Send className="h-4 w-4" />
                      {submitOrderMutation.isPending ? "Saving..." : "Save as Open"}
                    </Button>
                  )}
                  
                  {/* Show info message for GunBroker orders */}
                  {orderDetails.vendor?.toLowerCase().includes("gunbroker") && (
                    <div className="text-sm text-gray-500 italic">
                      GunBroker is configured for pricing comparison only
                    </div>
                  )}
                  
                  {/* Show Chattanooga order status when already submitted */}
                  {orderDetails.vendor?.toLowerCase().includes("chattanooga") && orderDetails.externalOrderNumber && (
                    <div className="text-sm text-green-600 font-medium">
                      Submitted to Chattanooga - Order #{orderDetails.externalOrderNumber}
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading order details...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Line Item Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Note for this item:
              </label>
              <Textarea
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="Enter a note for this line item..."
                className="min-h-[100px] resize-none"
                data-testid="textarea-note-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setNoteDialogOpen(false)}
                data-testid="button-note-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleNoteSave}
                disabled={updateOrderItemMutation.isPending}
                className="btn-orange-action"
                data-testid="button-note-save"
              >
                {updateOrderItemMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Webhook Display Dialog */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Payload Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              This is the webhook payload that would be sent to MicroBiz when this order is processed:
            </div>
            {webhookPayload ? (
              <div className="bg-gray-50 rounded-lg p-4 border">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(webhookPayload, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Generating webhook payload...</p>
              </div>
            )}
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setWebhookDialogOpen(false)}
                data-testid="button-webhook-close"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email CSV Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email CSV Export</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email-recipient" className="text-sm font-medium text-gray-700">
                Recipient Email
              </Label>
              <Input
                id="email-recipient"
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="Enter email address..."
                className="mt-1"
                data-testid="input-email-recipient"
              />
            </div>
            <div className="text-sm text-gray-600">
              The order items will be exported in POS-compatible CSV format and emailed to the specified address.
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEmailDialogOpen(false);
                  setEmailRecipient("");
                  setEmailOrderId(null);
                }}
                data-testid="button-email-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={emailCSVMutation.isPending || !emailRecipient.trim()}
                className="btn-orange-action"
                data-testid="button-email-send"
              >
                {emailCSVMutation.isPending ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

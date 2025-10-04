import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Store, MapPin, Users, Plus, Settings, UserCheck, Edit, Trash2, ChevronDown, Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Create dynamic schema based on retail vertical
const createStoreSchemaBase = z.object({
  name: z.string().min(1, "Store name is required"),
  slug: z.string().min(1, "Store slug is required"),
  shortName: z.string().min(1, "Short name is required").max(8, "Short name must be 8 characters or less").regex(/^[A-Za-z0-9]+$/, "Short name can only contain letters and numbers"),
  storeNumber: z.string().min(1, "Store number is required").regex(/^\d{1,2}$/, "Store number must be 1-2 digits").transform((val) => val.padStart(2, '0')),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  fflNumber: z.string().optional(),
  timezone: z.string().min(1, "Timezone is required"),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

// FFL Number is now optional for all stores (including firearms)
const createStoreSchemaFirearms = createStoreSchemaBase;

const createStoreSchema = createStoreSchemaBase;

const assignUserSchema = z.object({
  userId: z.number(),
  role: z.enum(["manager", "employee", "viewer"]),
  permissions: z.array(z.string()).optional(),
});

// Common US Timezones for store selection
const timezoneOptions = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona Time (MST)" },
  { value: "America/Indiana/Indianapolis", label: "Indiana Time (ET)" },
  { value: "America/Kentucky/Louisville", label: "Kentucky Time (ET)" },
  { value: "America/North_Dakota/Center", label: "North Dakota Time (CT)" },
];

interface StoreData {
  id: number;
  name: string;
  slug: string;
  shortName: string;
  storeNumber: string; // Store number (01, 02, 03, etc.)
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  fflNumber?: string;
  timezone: string;
  isActive: boolean;
  status: 'active' | 'inactive' | 'archived';
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

interface UserStoreData {
  id: number;
  userId: number;
  storeId: number;
  role: string;
  permissions?: string[];
  isActive: boolean;
  user: {
    id: number;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email: string;
    username: string;
  };
}

interface UserData {
  id: number;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
  username: string;
  role: string;
}

export default function StoreManagement() {
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreData | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const orgSlug = window.location.pathname.split('/')[2]; // Extract from /org/{slug}/stores

  // Fetch company information to check retail vertical
  const { data: company } = useQuery<{id: number, name: string, retailVerticalId: number}>({
    queryKey: [`/org/${orgSlug}/api/company`],
  });

  // Check if company is in Firearms vertical using centralized config
  const isFirearmsVertical = company?.retailVerticalId === 1;

  // Fetch stores
  const { data: stores = [], isLoading: storesLoading } = useQuery<StoreData[]>({
    queryKey: [`/org/${orgSlug}/api/stores`],
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery<UserData[]>({
    queryKey: [`/org/${orgSlug}/api/users`],
  });

  // Fetch store users when a store is selected
  const { data: storeUsers = [] } = useQuery<UserStoreData[]>({
    queryKey: [`/org/${orgSlug}/api/stores/${selectedStore?.id}/users`],
    enabled: !!selectedStore,
  });

  // Create store mutation
  const createStoreMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createStoreSchema>) => {
      return await apiRequest(`/org/${orgSlug}/api/stores`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${orgSlug}/api/stores`] });
      setShowCreateDialog(false);
      toast({
        title: "Success",
        description: "Store created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create store",
        variant: "destructive",
      });
    },
  });

  // Edit store mutation
  const editStoreMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createStoreSchema>) => {
      return await apiRequest(`/org/${orgSlug}/api/stores/${editingStore?.id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${orgSlug}/api/stores`] });
      setShowEditDialog(false);
      setEditingStore(null);
      toast({
        title: "Success",
        description: "Store updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update store",
        variant: "destructive",
      });
    },
  });

  // Assign user to store mutation
  const assignUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof assignUserSchema>) => {
      return await apiRequest(`/org/${orgSlug}/api/stores/${selectedStore?.id}/users`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${orgSlug}/api/stores/${selectedStore?.id}/users`] });
      setShowAssignDialog(false);
      toast({
        title: "Success",
        description: "User assigned to store successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign user to store",
        variant: "destructive",
      });
    },
  });

  // Remove user from store mutation
  const removeUserMutation = useMutation({
    mutationFn: async ({ userId, storeId }: { userId: number; storeId: number }) => {
      return await apiRequest(`/org/${orgSlug}/api/stores/${storeId}/users/${userId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${orgSlug}/api/stores/${selectedStore?.id}/users`] });
      toast({
        title: "Success",
        description: "User removed from store successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user from store",
        variant: "destructive",
      });
    },
  });

  // Update store status mutation
  const updateStoreStatusMutation = useMutation({
    mutationFn: async ({ storeId, status }: { storeId: number; status: string }) => {
      return await apiRequest(`/org/${orgSlug}/api/stores/${storeId}/status`, "PATCH", { status });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/org/${orgSlug}/api/stores`] });
      setShowEditDialog(false);
      setEditingStore(null);
      toast({
        title: "Success",
        description: `Store status updated to ${variables.status} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update store status",
        variant: "destructive",
      });
    },
  });

  // Archive store mutation (legacy - keeping for compatibility)
  const archiveStoreMutation = useMutation({
    mutationFn: async (storeId: number) => {
      return await apiRequest(`/org/${orgSlug}/api/stores/${storeId}/archive`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${orgSlug}/api/stores`] });
      setShowEditDialog(false);
      setEditingStore(null);
      toast({
        title: "Success",
        description: "Store archived successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive store",
        variant: "destructive",
      });
    },
  });

  // Unarchive store mutation (legacy - keeping for compatibility)
  const unarchiveStoreMutation = useMutation({
    mutationFn: async (storeId: number) => {
      return await apiRequest(`/org/${orgSlug}/api/stores/${storeId}/unarchive`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${orgSlug}/api/stores`] });
      setShowEditDialog(false);
      setEditingStore(null);
      toast({
        title: "Success",
        description: "Store unarchived successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unarchive store",
        variant: "destructive",
      });
    },
  });

  // Get appropriate schema based on retail vertical
  const getStoreSchema = () => isFirearmsVertical ? createStoreSchemaFirearms : createStoreSchema;
  
  // Get default timezone from first store or fallback to Eastern
  const getDefaultTimezone = () => {
    return stores.length > 0 && stores[0].timezone ? stores[0].timezone : "America/New_York";
  };

  const createStoreForm = useForm<z.infer<typeof createStoreSchema>>({
    resolver: zodResolver(getStoreSchema()),
    defaultValues: {
      name: "",
      slug: "",
      shortName: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      phone: "",
      fflNumber: "",
      storeNumber: "",
      timezone: getDefaultTimezone(),
      status: "active",
    },
  });

  const editStoreForm = useForm<z.infer<typeof createStoreSchema>>({
    resolver: zodResolver(getStoreSchema()),
    defaultValues: {
      name: "",
      slug: "",
      shortName: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      phone: "",
      fflNumber: "",
      storeNumber: "",
      timezone: getDefaultTimezone(),
      status: "active",
    },
  });

  const assignUserForm = useForm<z.infer<typeof assignUserSchema>>({
    resolver: zodResolver(assignUserSchema),
    defaultValues: {
      role: "employee",
      permissions: [],
    },
  });

  const onCreateStore = (data: z.infer<typeof createStoreSchema>) => {
    createStoreMutation.mutate(data);
  };

  const onEditStore = (data: z.infer<typeof createStoreSchema>) => {
    editStoreMutation.mutate(data);
  };

  const onAssignUser = (data: z.infer<typeof assignUserSchema>) => {
    assignUserMutation.mutate(data);
  };

  // Update form defaults when stores data loads
  useEffect(() => {
    if (stores.length > 0) {
      const defaultTimezone = getDefaultTimezone();
      createStoreForm.setValue("timezone", defaultTimezone);
    }
  }, [stores, createStoreForm]);

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  };

  const generateShortName = (name: string) => {
    // Remove special characters and take first 8 alphanumeric characters, uppercase
    return name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 8);
  };

  const generateStoreNumber = async (companyId: number) => {
    // Get highest store number for this company and increment
    const storeCount = stores.length;
    const nextNumber = (storeCount + 1).toString().padStart(2, '0');
    return nextNumber;
  };

  const handleEditStore = (store: StoreData) => {
    setEditingStore(store);
    editStoreForm.reset({
      name: store.name,
      slug: store.slug,
      shortName: store.shortName || "",
      storeNumber: store.storeNumber || "",
      address1: store.address1 || "",
      address2: store.address2 || "",
      city: store.city || "",
      state: store.state || "",
      zipCode: store.zipCode || "",
      country: store.country || "",
      phone: store.phone || "",
      fflNumber: store.fflNumber || "",
      timezone: store.timezone || "America/New_York",
      status: store.status || "active",
    });
    setShowEditDialog(true);
  };

  const handleArchiveStore = (store: StoreData) => {
    if (store.status === 'archived') {
      unarchiveStoreMutation.mutate(store.id);
    } else {
      archiveStoreMutation.mutate(store.id);
    }
  };

  const updateStoreStatus = (storeId: number, status: 'active' | 'inactive' | 'archived') => {
    updateStoreStatusMutation.mutate({ storeId, status });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'archived': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'archived': return 'Archived';
      default: return 'Unknown';
    }
  };

  // Filter stores based on status
  const filteredStores = stores.filter(store => {
    if (statusFilter === 'all') return true;
    return store.status === statusFilter;
  });

  useEffect(() => {
    if (stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0]);
    }
  }, [stores, selectedStore]);

  if (storesLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Store className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Store Management</h1>
        </div>
        <div className="mt-6">Loading stores...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Store className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Store Management</h1>
          </div>
          <p className="text-muted-foreground">
            Manage store locations and assign users to specific stores
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-store">
              <Plus className="h-4 w-4 mr-2" />
              Create Store
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Create New Store</DialogTitle>
              <DialogDescription>
                Add a new retail location to your company
              </DialogDescription>
            </DialogHeader>
            <Form {...createStoreForm}>
              <form onSubmit={createStoreForm.handleSubmit(onCreateStore)} className="space-y-4">
                <FormField
                  control={createStoreForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store Name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Main Store"
                          data-testid="input-store-name"
                          onChange={(e) => {
                            field.onChange(e);
                            createStoreForm.setValue("slug", generateSlug(e.target.value));
                            createStoreForm.setValue("shortName", generateShortName(e.target.value));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createStoreForm.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL Slug</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="main-store" data-testid="input-store-slug" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createStoreForm.control}
                    name="shortName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short Name (8 chars max)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="MAINSTOR" 
                            maxLength={8}
                            data-testid="input-store-shortname"
                            onChange={(e) => {
                              field.onChange(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createStoreForm.control}
                  name="address1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter street address (e.g., 123 Main Street)" data-testid="input-store-address1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createStoreForm.control}
                  name="address2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Suite, unit, building, floor, etc." data-testid="input-store-address2" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={createStoreForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="City" data-testid="input-store-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createStoreForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="State" data-testid="input-store-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createStoreForm.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="12345" data-testid="input-store-zip" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createStoreForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="(555) 123-4567" data-testid="input-store-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className={`grid gap-4 ${isFirearmsVertical ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {isFirearmsVertical && (
                    <FormField
                      control={createStoreForm.control}
                      name="fflNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>FFL Number (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="FFL-123456" data-testid="input-store-ffl" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={createStoreForm.control}
                    name="storeNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Number (01, 02, 03...)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="01" 
                            maxLength={2}
                            data-testid="input-store-number"
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '').padStart(2, '0').substring(0, 2);
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createStoreForm.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-store-timezone">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {timezoneOptions.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createStoreMutation.isPending} data-testid="button-submit-store">
                    {createStoreMutation.isPending ? "Creating..." : "Create Store"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stores Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Store className="h-5 w-5" />
                <span>Stores ({filteredStores.length})</span>
              </CardTitle>
              <CardDescription>Manage company retail locations</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="status-filter" className="text-sm font-medium">Filter by Status:</Label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-32" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Number</TableHead>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Contact</TableHead>
                  {isFirearmsVertical && <TableHead>FFL Number</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStores.map((store) => (
                  <TableRow key={store.id} data-testid={`store-row-${store.id}`}>
                    <TableCell data-testid={`text-store-number-${store.id}`}>
                      <div className="font-mono font-semibold">
                        {store.storeNumber || "Not set"}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium" data-testid={`text-store-name-${store.id}`}>
                          {store.name}
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-store-slug-${store.id}`}>
                          {store.slug}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-store-address-${store.id}`}>
                      {store.address1 ? (
                        <div className="flex items-start space-x-1">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <div>{store.address1}</div>
                            {store.address2 && <div>{store.address2}</div>}
                            {(store.city || store.state || store.zipCode) && (
                              <div>{[store.city, store.state, store.zipCode].filter(Boolean).join(', ')}</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        "Not set"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {store.phone ? (
                          <div className="text-sm" data-testid={`text-store-phone-${store.id}`}>
                            {store.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </div>
                    </TableCell>
                    {isFirearmsVertical && (
                      <TableCell data-testid={`text-store-ffl-${store.id}`}>
                        {store.fflNumber || "Not set"}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge 
                        variant={getStatusVariant(store.status || 'active')} 
                        data-testid={`badge-store-status-${store.id}`}
                      >
                        {getStatusText(store.status || 'active')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="default"
                        onClick={() => handleEditStore(store)}
                        data-testid={`button-edit-store-${store.id}`}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Store
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredStores.length === 0 && stores.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No stores found with the selected status filter.
                    </TableCell>
                  </TableRow>
                )}
                {stores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No stores found. Create your first store to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Store Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="h-5 w-5" />
              <span>Edit Store</span>
            </DialogTitle>
            <DialogDescription>
              Update store information and settings
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[70vh] pr-2">
            <Form {...editStoreForm}>
              <form onSubmit={editStoreForm.handleSubmit(onEditStore)} className="space-y-6">
                {/* Store Identity Section */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Store Identity</h4>
                    <FormField
                      control={editStoreForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Main Store" 
                              data-testid="input-edit-store-name"
                              onChange={(e) => {
                                field.onChange(e);
                                editStoreForm.setValue("slug", generateSlug(e.target.value));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editStoreForm.control}
                        name="slug"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Store Slug</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="main-store" data-testid="input-edit-store-slug" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editStoreForm.control}
                        name="shortName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Short Name (8 chars max)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="MAINSTOR" 
                                maxLength={8}
                                data-testid="input-edit-store-shortname"
                                onChange={(e) => {
                                  field.onChange(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editStoreForm.control}
                      name="storeNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Number (01, 02, 03...)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="01" 
                              maxLength={2}
                              data-testid="input-edit-store-number"
                              onChange={(e) => {
                                // Only allow digits, limit to 2 characters
                                const value = e.target.value.replace(/[^0-9]/g, '').substring(0, 2);
                                field.onChange(value);
                              }}
                              onBlur={(e) => {
                                // Auto-pad to 2 digits when user leaves the field
                                const value = e.target.value.replace(/[^0-9]/g, '').substring(0, 2);
                                if (value && value.length === 1) {
                                  field.onChange(value.padStart(2, '0'));
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Settings</h4>
                    <FormField
                      control={editStoreForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-store-status">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {isFirearmsVertical && (
                      <FormField
                        control={editStoreForm.control}
                        name="fflNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>FFL Number (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="FFL-123456" data-testid="input-edit-store-ffl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={editStoreForm.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone <span className="text-red-500">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-store-timezone">
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {timezoneOptions.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                  {tz.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

              <FormField
                control={editStoreForm.control}
                name="address1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter street address (e.g., 123 Main Street)" data-testid="input-edit-store-address1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStoreForm.control}
                name="address2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Suite, unit, building, floor, etc." data-testid="input-edit-store-address2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={editStoreForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="City" data-testid="input-edit-store-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editStoreForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="State" data-testid="input-edit-store-state" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editStoreForm.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="12345" data-testid="input-edit-store-zip" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editStoreForm.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="US" data-testid="input-edit-store-country" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editStoreForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(555) 123-4567" data-testid="input-edit-store-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </form>
          </Form>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button 
              type="submit" 
              disabled={editStoreMutation.isPending} 
              data-testid="button-save-store-edit"
              onClick={editStoreForm.handleSubmit(onEditStore)}
            >
              {editStoreMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Store Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Create New Store</span>
            </DialogTitle>
            <DialogDescription>
              Add a new store to your company
            </DialogDescription>
          </DialogHeader>
          <Form {...createStoreForm}>
            <form onSubmit={createStoreForm.handleSubmit(onCreateStore)} className="space-y-4">
              <FormField
                control={createStoreForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Main Store" 
                        data-testid="input-store-name"
                        onChange={(e) => {
                          field.onChange(e);
                          createStoreForm.setValue("slug", generateSlug(e.target.value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createStoreForm.control}
                name="shortName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Short Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="MAIN" 
                        maxLength={8}
                        data-testid="input-store-shortname"
                        onChange={(e) => {
                          // Allow alphanumeric only, convert to uppercase
                          const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 8);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createStoreForm.control}
                name="storeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Number (01, 02, 03...)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="01" 
                        maxLength={2}
                        data-testid="input-store-number"
                        onChange={(e) => {
                          // Only allow digits, limit to 2 characters
                          const value = e.target.value.replace(/[^0-9]/g, '').substring(0, 2);
                          field.onChange(value);
                        }}
                        onBlur={(e) => {
                          // Auto-pad to 2 digits when user leaves the field
                          const value = e.target.value.replace(/[^0-9]/g, '').substring(0, 2);
                          if (value && value.length === 1) {
                            field.onChange(value.padStart(2, '0'));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createStoreForm.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Slug</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="main-store" data-testid="input-store-slug" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createStoreForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-create-store-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isFirearmsVertical && (
                  <FormField
                    control={createStoreForm.control}
                    name="fflNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>FFL Number (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="FFL-123456" data-testid="input-store-ffl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <FormField
                control={createStoreForm.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-create-store-timezone">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timezoneOptions.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createStoreForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(555) 123-4567" data-testid="input-store-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createStoreMutation.isPending} data-testid="button-create-store">
                  {createStoreMutation.isPending ? "Creating..." : "Create Store"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

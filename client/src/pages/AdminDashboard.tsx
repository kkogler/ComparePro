import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Copy, Trash2, Building2, Users, Search, ExternalLink as LinkIcon, Plus } from 'lucide-react';
import { getStatusColor, getPlanColor, getUniquePlans, SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUSES } from "@shared/subscription-config";
import { Link } from 'wouter';
import { CreateSubscriptionDialog } from '@/components/CreateSubscriptionDialog';

interface Organization {
  id: number;
  name: string;
  slug: string;
  plan: string;
  status: string;
  billingProvider: string;
  billingCustomerId: string;
  billingSubscriptionId?: string | null;
  billingSubscriptionNumber?: string | null;
  storeCount: number;
  lastLogin: string | null;
  signupEmail: string | null;
  subscriptionCreatedAt: string | null;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active-paused');
  const [showCreateDialog, setShowCreateDialog] = useState(false);


  // Fetch organizations (subscriptions)
  const { data: organizations, isLoading } = useQuery<Organization[]>({
    queryKey: ['/api/admin/subscriptions'],
  });

  // Remove top stats cards per requirements


  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest(`/api/admin/organizations/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      toast({
        title: 'Success',
        description: 'Organization updated successfully',
      });
    },
  });

  // Copy organization mutation
  const copyOrgMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const response = await apiRequest(`/api/admin/organizations/${orgId}/copy`, 'POST');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: 'Success',
        description: 'Organization copied successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to copy organization',
        variant: 'destructive',
      });
    },
  });

  // Delete organization mutation
  const deleteOrgMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const response = await apiRequest(`/api/admin/organizations/${orgId}`, 'DELETE');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: 'Success',
        description: 'Subscription cancelled successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete organization',
        variant: 'destructive',
      });
    },
  });


  const copyOrganization = (org: Organization) => {
    if (confirm(`Create a copy of "${org.name}"? This will create a new organization with the same configuration.`)) {
      copyOrgMutation.mutate(org.id);
    }
  };

  const deleteOrganization = (org: Organization) => {
    if (org.id === 1) {
      toast({
        title: 'Cannot Cancel',
        description: 'The demo subscription cannot be cancelled.',
        variant: 'destructive',
      });
      return;
    }
    
    if (confirm(`Are you sure you want to cancel the subscription for "${org.name}"?`)) {
      deleteOrgMutation.mutate(org.id);
    }
  };



  // Using centralized configuration instead of hardcoded values

  // Filter organizations by plan and status
  const filteredOrganizations = organizations?.filter(org => {
    // Plan filter
    const planMatch = planFilter === 'all' || org.plan.toLowerCase() === planFilter.toLowerCase();
    
    // Status filter
    let statusMatch = false;
    if (statusFilter === 'all') {
      statusMatch = true;
    } else if (statusFilter === 'active-paused') {
      statusMatch = org.status === 'active' || org.status === 'paused';
    } else {
      statusMatch = org.status === statusFilter;
    }
    
    return planMatch && statusMatch;
  }) || [];


  // Get unique plans for filter dropdown using centralized configuration
  const uniquePlans = getUniquePlans(organizations || []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">Manage subscriptions and billing</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Subscription
        </Button>
      </div>

      {/* Removed summary cards per requirements */}

      {/* Subscriptions Table */}
      <Card>
        <CardContent>
          {/* Filter Controls */}
          <div className="space-y-4 mb-6">
            {/* Filters Row with Padding */}
            <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Label htmlFor="plan-filter" className="text-sm font-medium">Filter by Plan:</Label>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    {uniquePlans.map(plan => (
                      <SelectItem key={plan} value={plan}>
                        {plan === 'copy' ? 'Copy' : plan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="text-sm font-medium">Filter by Status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Active & Paused" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active-paused">Active & Paused</SelectItem>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Centered Search Box with Padding */}
            <div className="flex justify-center px-4 py-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email"
                  onChange={(e) => {
                    // simple local filter via query cache invalidation avoided; handled in render mapping below
                    (window as any)._adminSearch = e.target.value.toLowerCase();
                  }}
                  className="pl-8 w-[27rem] border-2 border-gray-400 dark:border-gray-500 focus:border-gray-600 dark:focus:border-gray-300"
                />
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subscription No.</TableHead>
                <TableHead>Stores</TableHead>
                <TableHead>Signup Email</TableHead>
                <TableHead>Last Log In</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrganizations
                .sort((a, b) => {
                  // Sort by subscription number in descending order (highest first)
                  const aNum = a.billingSubscriptionNumber || '';
                  const bNum = b.billingSubscriptionNumber || '';
                  
                  // Handle empty subscription numbers - put them at the end
                  if (!aNum && !bNum) return 0;
                  if (!aNum) return 1;
                  if (!bNum) return -1;
                  
                  // Sort subscription numbers in descending order (SUB-00088, SUB-00087, etc.)
                  return bNum.localeCompare(aNum);
                })
                .filter((org) => {
                  const q = (window as any)._adminSearch || '';
                  if (!q) return true;
                  return (
                    org.name.toLowerCase().includes(q) ||
                    org.slug.toLowerCase().includes(q) ||
                    (org.signupEmail || '').toLowerCase().includes(q)
                  );
                })
                .map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div>
                      <Link 
                        to={`/org/${org.slug}`}
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {org.name}
                      </Link>
                      <div className="text-sm text-gray-500">/{org.slug}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPlanColor(org.plan)}>
                      {org.plan === 'copy' ? 'Copy' : org.plan}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(org.status)}>
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const subscriptionNumber = org.billingSubscriptionNumber;
                      if (!subscriptionNumber) return '—';
                      const zohoUrl = `https://billing.zoho.com/subscriptions/${encodeURIComponent(subscriptionNumber)}`;
                      return (
                        <a
                          href={zohoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center"
                        >
                          {subscriptionNumber}
                          <LinkIcon className="h-3 w-3 ml-1" />
                        </a>
                      );
                    })()}
                  </TableCell>
                  <TableCell>{org.storeCount}</TableCell>
                  <TableCell>{org.signupEmail || 'Not provided'}</TableCell>
                  <TableCell>
                    {org.lastLogin ? new Date(org.lastLogin).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    {org.subscriptionCreatedAt ? new Date(org.subscriptionCreatedAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyOrganization(org)}
                        title="Copy Subscription"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deleteOrganization(org)}
                        title="Cancel Subscription"
                        disabled={org.id === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Subscription Dialog */}
      <CreateSubscriptionDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
    </div>
  );
}

function SubscriptionSettingsModal({ 
  organization, 
  onUpdate, 
  onClose, 
  isLoading 
}: {
  organization: Organization;
  onUpdate: (data: any) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    plan: organization.plan,
    status: organization.status,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscription Settings</DialogTitle>
          <DialogDescription>
            Update settings for {organization.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="plan">Plan</Label>
            <Select value={formData.plan} onValueChange={(value) => setFormData(prev => ({ ...prev, plan: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(SUBSCRIPTION_PLANS).map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>{plan.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SUBSCRIPTION_STATUSES.ACTIVE}>Active</SelectItem>
                <SelectItem value={SUBSCRIPTION_STATUSES.SUSPENDED}>Suspended</SelectItem>
                <SelectItem value={SUBSCRIPTION_STATUSES.CANCELLED}>Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Settings'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
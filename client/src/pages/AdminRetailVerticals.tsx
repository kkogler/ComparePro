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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';

interface RetailVertical {
  id: number;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminRetailVerticals() {
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVertical, setEditingVertical] = useState<RetailVertical | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    color: '#6366f1',
    sortOrder: 0,
    isActive: true
  });

  // Fetch retail verticals
  const { data: verticals, isLoading } = useQuery<RetailVertical[]>({
    queryKey: ['/api/admin/retail-verticals'],
  });

  // Create vertical mutation
  const createVerticalMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/admin/retail-verticals', 'POST', data),
    onSuccess: () => {
      // Invalidate retail verticals cache AND supported vendors cache
      queryClient.invalidateQueries({ queryKey: ['/api/admin/retail-verticals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      toast({
        title: "Success",
        description: "Retail vertical created successfully",
      });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create retail vertical",
        variant: "destructive",
      });
    }
  });

  // Update vertical mutation
  const updateVerticalMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest(`/api/admin/retail-verticals/${id}`, 'PUT', data),
    onSuccess: () => {
      // Invalidate retail verticals cache AND supported vendors cache
      // This ensures VendorFormModal shows updated retail vertical names immediately
      queryClient.invalidateQueries({ queryKey: ['/api/admin/retail-verticals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      toast({
        title: "Success",
        description: "Retail vertical updated successfully",
      });
      setEditingVertical(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update retail vertical",
        variant: "destructive",
      });
    }
  });

  // Delete vertical mutation
  const deleteVerticalMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/retail-verticals/${id}`, 'DELETE'),
    onSuccess: () => {
      // Invalidate retail verticals cache AND supported vendors cache
      queryClient.invalidateQueries({ queryKey: ['/api/admin/retail-verticals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supported-vendors'] });
      toast({
        title: "Success",
        description: "Retail vertical deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete retail vertical",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      color: '#6366f1',
      sortOrder: 0,
      isActive: true
    });
  };

  const handleCreate = () => {
    createVerticalMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (editingVertical) {
      updateVerticalMutation.mutate({
        id: editingVertical.id,
        data: formData
      });
    }
  };

  const handleEdit = (vertical: RetailVertical) => {
    setEditingVertical(vertical);
    setFormData({
      name: vertical.name,
      slug: vertical.slug,
      description: vertical.description || '',
      color: vertical.color,
      sortOrder: vertical.sortOrder,
      isActive: vertical.isActive
    });
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-64 mb-4"></div>
          <div className="h-32 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  const retailVerticals = verticals || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Retail Verticals</h1>
          <p className="text-muted-foreground">
            Manage industry categories for organizations
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-vertical">
              <Plus className="h-4 w-4 mr-2" />
              Add Vertical
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Retail Vertical</DialogTitle>
              <DialogDescription>
                Add a new industry category for organizations
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Firearms"
                  data-testid="input-vertical-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="e.g., firearms"
                  data-testid="input-vertical-slug"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this vertical"
                  data-testid="input-vertical-description"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  data-testid="input-vertical-color"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  data-testid="input-vertical-sort-order"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  data-testid="switch-vertical-active"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                onClick={handleCreate}
                disabled={createVerticalMutation.isPending || !formData.name.trim()}
                data-testid="button-submit-create"
              >
                {createVerticalMutation.isPending ? 'Creating...' : 'Create Vertical'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingVertical} onOpenChange={() => setEditingVertical(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Retail Vertical</DialogTitle>
            <DialogDescription>
              Update the retail vertical information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Firearms"
                data-testid="input-edit-vertical-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-slug">URL Slug</Label>
              <Input
                id="edit-slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="e.g., firearms"
                data-testid="input-edit-vertical-slug"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this vertical"
                data-testid="input-edit-vertical-description"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-color">Color</Label>
              <Input
                id="edit-color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                data-testid="input-edit-vertical-color"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-sortOrder">Sort Order</Label>
              <Input
                id="edit-sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                data-testid="input-edit-vertical-sort-order"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                data-testid="switch-edit-vertical-active"
              />
              <Label htmlFor="edit-isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="submit" 
              onClick={handleUpdate}
              disabled={updateVerticalMutation.isPending || !formData.name.trim()}
              data-testid="button-submit-update"
            >
              {updateVerticalMutation.isPending ? 'Updating...' : 'Update Vertical'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sort Order</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {retailVerticals.map((vertical) => (
                <TableRow key={vertical.id} data-testid={`row-vertical-${vertical.id}`}>
                  <TableCell className="font-medium" data-testid={`text-vertical-name-${vertical.id}`}>
                    {vertical.name}
                  </TableCell>
                  <TableCell data-testid={`text-vertical-slug-${vertical.id}`}>
                    {vertical.slug}
                  </TableCell>
                  <TableCell data-testid={`text-vertical-description-${vertical.id}`}>
                    {vertical.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={vertical.isActive ? "default" : "secondary"}
                      data-testid={`badge-vertical-status-${vertical.id}`}
                    >
                      {vertical.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-vertical-sort-${vertical.id}`}>
                    {vertical.sortOrder}
                  </TableCell>
                  <TableCell>
                    <div 
                      className="w-6 h-6 rounded border border-gray-300"
                      style={{ backgroundColor: vertical.color }}
                      data-testid={`color-vertical-${vertical.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(vertical)}
                        data-testid={`button-edit-vertical-${vertical.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-delete-vertical-${vertical.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Retail Vertical</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{vertical.name}"? This action cannot be undone and may affect organizations using this vertical.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteVerticalMutation.mutate(vertical.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`button-confirm-delete-vertical-${vertical.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
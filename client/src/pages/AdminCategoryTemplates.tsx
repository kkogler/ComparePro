import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, ArrowLeft, List } from 'lucide-react';
import { Link } from 'wouter';

interface CategoryTemplate {
  id: number;
  retailVerticalId: number;
  name: string;
  slug: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface RetailVertical {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export default function AdminCategoryTemplates() {
  const { id } = useParams();
  const retailVerticalId = parseInt(id || '0');
  console.log('AdminCategoryTemplates - URL param id:', id, 'retailVerticalId:', retailVerticalId);
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CategoryTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<CategoryTemplate | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    displayName: '',
    description: '',
    sortOrder: 0,
    isActive: true
  });

  // Fetch retail vertical info
  const { data: retailVerticals = [] } = useQuery<RetailVertical[]>({
    queryKey: ['/api/admin/retail-verticals'],
  });

  const currentVertical = retailVerticals.find(v => v.id === retailVerticalId);

  // Fetch category templates
  const { data: templates = [], isLoading, error } = useQuery<CategoryTemplate[]>({
    queryKey: [`/api/admin/retail-verticals/${retailVerticalId}/category-templates`],
    enabled: retailVerticalId > 0,
  });

  console.log('Category Templates Query:', {
    retailVerticalId,
    isLoading,
    templatesCount: templates?.length,
    templates,
    error
  });

  // Create template mutation
  const createTemplate = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/admin/category-templates`, 'POST', {
        ...data,
        retailVerticalId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/retail-verticals/${retailVerticalId}/category-templates`] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Product category created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create product category',
        variant: 'destructive',
      });
    },
  });

  // Update template mutation
  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return await apiRequest(`/api/admin/category-templates/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/retail-verticals/${retailVerticalId}/category-templates`] });
      setEditingTemplate(null);
      resetForm();
      toast({
        title: 'Success',
        description: 'Product category updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update product category',
        variant: 'destructive',
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/admin/category-templates/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/retail-verticals/${retailVerticalId}/category-templates`] });
      setDeleteTemplate(null);
      toast({
        title: 'Success',
        description: 'Product category deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete product category',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      displayName: '',
      description: '',
      sortOrder: 0,
      isActive: true
    });
  };

  const handleEdit = (template: CategoryTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      slug: template.slug,
      displayName: template.displayName,
      description: template.description || '',
      sortOrder: template.sortOrder,
      isActive: template.isActive
    });
  };

  const handleSubmit = () => {
    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, ...formData });
    } else {
      createTemplate.mutate(formData);
    }
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      displayName: name
    });
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/retail-verticals">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Retail Verticals
          </Button>
        </Link>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Product Categories</h1>
          <p className="text-gray-600 mt-1">
            {currentVertical?.name || 'Unknown Retail Vertical'} - Manage product categories for new companies
          </p>
        </div>

        <Dialog open={isCreateModalOpen || !!editingTemplate} onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setEditingTemplate(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateModalOpen(true)} className="btn-orange-action">
              <Plus className="h-4 w-4 mr-2" />
              New Product Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Product Category' : 'Add New Product Category'}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate 
                  ? 'Update the product category details' 
                  : 'Create a new product category that will be copied to new companies'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Firearms"
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug (auto-generated)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., firearms"
                />
              </div>
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g., Firearms"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreateModalOpen(false);
                setEditingTemplate(null);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!formData.name || createTemplate.isPending || updateTemplate.isPending}
              >
                {editingTemplate ? 'Update' : 'Create'} Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Product Categories ({templates.length})
          </CardTitle>
          <CardDescription>
            These categories will be automatically copied to new companies with this retail vertical
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No product categories configured. Click "New Product Category" to add one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sort</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-mono text-sm">{template.sortOrder}</TableCell>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="font-mono text-sm text-gray-600">{template.slug}</TableCell>
                      <TableCell>{template.displayName}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-gray-600">
                        {template.description || '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          template.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTemplate(template)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTemplate?.name}"? This will not affect existing companies, only future ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplate && deleteTemplateMutation.mutate(deleteTemplate.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

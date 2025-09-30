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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Lock, Unlock, Trash2, Edit, Key } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface Administrator {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  role: string;
}

const createAdminSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const editAdminSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  password: z.string().optional(),
});

type CreateAdminData = z.infer<typeof createAdminSchema>;
type EditAdminData = z.infer<typeof editAdminSchema>;

export default function AdminUsers() {
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Administrator | null>(null);

  // Forms
  const createForm = useForm<CreateAdminData>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
    },
  });

  const editForm = useForm<EditAdminData>({
    resolver: zodResolver(editAdminSchema),
    defaultValues: {
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
    },
  });

  // Fetch administrators
  const { data: administrators = [], isLoading } = useQuery<Administrator[]>({
    queryKey: ['/api/admin/users'],
  });

  // Create administrator mutation
  const createAdminMutation = useMutation({
    mutationFn: (data: CreateAdminData) => apiRequest('/api/admin/users', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsCreateModalOpen(false);
      createForm.reset();
      toast({
        title: 'Success',
        description: 'Administrator created successfully',
      });
    },
    onError: (error: any) => {
      console.error('CREATE ADMIN MUTATION ERROR:', error);
      console.error('Error details:', error.message, error.stack);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create administrator',
        variant: 'destructive',
      });
    },
  });

  // Update administrator mutation
  const updateAdminMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditAdminData }) => 
      apiRequest(`/api/admin/users/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsEditModalOpen(false);
      setEditingAdmin(null);
      editForm.reset();
      toast({
        title: 'Success',
        description: 'Administrator updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update administrator',
        variant: 'destructive',
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest(`/api/admin/users/${id}`, 'PATCH', { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: 'Success',
        description: 'Administrator status updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update administrator status',
        variant: 'destructive',
      });
    },
  });

  // Delete administrator mutation
  const deleteAdminMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/users/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: 'Success',
        description: 'Administrator deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete administrator',
        variant: 'destructive',
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: (id: number) => {
      const newPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      return apiRequest(`/api/admin/users/${id}`, 'PATCH', { password: newPassword }).then(() => newPassword);
    },
    onSuccess: (newPassword) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      navigator.clipboard.writeText(newPassword);
      toast({
        title: 'Password Reset',
        description: `New password copied to clipboard: ${newPassword}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password',
        variant: 'destructive',
      });
    },
  });

  const onCreateSubmit = async (data: CreateAdminData) => {
    console.log('CREATE FORM SUBMIT:', data);
    try {
      await createAdminMutation.mutateAsync(data);
    } catch (error) {
      console.error('FORM SUBMISSION ERROR:', error);
    }
  };

  const onEditSubmit = (data: EditAdminData) => {
    if (!editingAdmin) return;
    updateAdminMutation.mutate({ id: editingAdmin.id, data });
  };

  const handleEdit = (admin: Administrator) => {
    setEditingAdmin(admin);
    editForm.reset({
      username: admin.username,
      email: admin.email,
      firstName: admin.firstName || '',
      lastName: admin.lastName || '',
      password: '',
    });
    setIsEditModalOpen(true);
  };

  const handleToggleActive = (admin: Administrator) => {
    if (admin.username === 'admin') {
      toast({
        title: 'Cannot Lock Master',
        description: 'The master administrator cannot be locked.',
        variant: 'destructive',
      });
      return;
    }
    toggleActiveMutation.mutate({ id: admin.id, isActive: !admin.isActive });
  };

  const handleDelete = (admin: Administrator) => {
    if (admin.username === 'admin') {
      toast({
        title: 'Cannot Delete Master',
        description: 'The master administrator cannot be deleted.',
        variant: 'destructive',
      });
      return;
    }
    
    if (confirm(`Are you sure you want to delete administrator "${admin.username}"? This action cannot be undone.`)) {
      deleteAdminMutation.mutate(admin.id);
    }
  };

  const handleResetPassword = (admin: Administrator) => {
    if (confirm(`Reset password for administrator "${admin.username}"? The new password will be copied to clipboard.`)) {
      resetPasswordMutation.mutate(admin.id);
    }
  };

  const isMasterAdmin = (admin: Administrator) => admin.username === 'admin';

  // Sort administrators to always show master admin at the top
  const sortedAdministrators = administrators.sort((a, b) => {
    if (isMasterAdmin(a) && !isMasterAdmin(b)) return -1;
    if (!isMasterAdmin(a) && isMasterAdmin(b)) return 1;
    return a.username.localeCompare(b.username);
  });

  if (isLoading) {
    return <div className="p-6">Loading administrators...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Administrators</h1>
          <p className="text-muted-foreground">
            Manage administrators and support staff
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="btn-orange-action">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Administrator
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Administrator</DialogTitle>
              <DialogDescription>
                Add a new administrator to the platform.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAdminMutation.isPending} className="btn-orange-action">
                    {createAdminMutation.isPending ? 'Creating...' : 'Create Administrator'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAdministrators.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {admin.firstName} {admin.lastName}
                      </span>
                      {isMasterAdmin(admin) && (
                        <Badge variant="secondary">Master</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{admin.username}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>
                    <Badge variant={admin.isActive ? "default" : "secondary"}>
                      {admin.isActive ? "Active" : "Locked"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {admin.lastLogin ? new Date(admin.lastLogin).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(admin)}
                        title="Edit Administrator"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(admin)}
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(admin)}
                        disabled={isMasterAdmin(admin)}
                        title={admin.isActive ? "Lock Administrator" : "Unlock Administrator"}
                      >
                        {admin.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(admin)}
                        disabled={isMasterAdmin(admin)}
                        title="Delete Administrator"
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

      {/* Edit Administrator Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Administrator</DialogTitle>
            <DialogDescription>
              Update administrator details. Leave password empty to keep current password.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={editingAdmin?.username === 'admin'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Leave empty to keep current password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingAdmin(null);
                  editForm.reset();
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateAdminMutation.isPending}>
                  {updateAdminMutation.isPending ? 'Updating...' : 'Update Administrator'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
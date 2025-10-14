import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Users, Shield, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useParams } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import type { User, Store } from '@shared/schema';

interface UserStoreAssignment {
  id: number;
  store: {
    id: number;
    name: string;
  };
}

// Component to display user's store assignments
function UserStoreAssignments({ userId, slug }: { userId: number, slug: string }) {
  const { data: userStores = [], isLoading } = useQuery<UserStoreAssignment[]>({
    queryKey: [`/org/${slug}/api/users/${userId}/stores`],
  });

  if (isLoading) return <span className="text-gray-500">Loading...</span>;
  
  if (userStores.length === 0) return <span className="text-gray-500">No assignments</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {userStores.map((assignment) => (
        <Badge key={assignment.store.id} variant="outline" className="text-xs">
          {assignment.store.name}
        </Badge>
      ))}
    </div>
  );
}

export default function CompanyUsers() {
  const { slug } = useParams();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Check if current user is admin (includes both org admins and system admins)
  // System admins have companyId = null, org admins have isAdmin = true
  const isSystemAdmin = currentUser?.companyId === null;
  const isOrgAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
  const isCurrentUserAdmin = isSystemAdmin || isOrgAdmin;
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteUserModal, setDeleteUserModal] = useState<{
    isOpen: boolean;
    user: User | null;
  }>({ isOpen: false, user: null });
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    displayName: '',
    role: 'user',
    isAdmin: false,
    isActive: true,
    defaultStoreId: '',
  });

  // Store assignment state
  const [selectedStores, setSelectedStores] = useState<number[]>([]);

  // Fetch organization users
  const { data: users = [], isLoading, error: usersError, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: [`/org/${slug}/api/users`],
    retry: (failureCount, error) => {
      // Retry up to 2 times for authentication errors
      if (error.message.includes('401') && failureCount < 2) {
        console.log(`Retrying users fetch attempt ${failureCount + 1}`);
        return true;
      }
      return false;
    },
    retryDelay: 1000, // 1 second delay between retries
  });

  // Add debugging
  console.log('CompanyUsers Debug:', {
    slug,
    currentUser,
    isSystemAdmin,
    isOrgAdmin,
    isCurrentUserAdmin,
    users,
    usersCount: users.length,
    isLoading,
    usersError: usersError?.message,
    queryKey: `/org/${slug}/api/users`
  });

  // Additional warning if admin sees no users
  if (!isLoading && isSystemAdmin && users.length === 0) {
    console.warn('⚠️ ADMIN USER ISSUE: System admin sees 0 users for organization. This may indicate an issue with the API endpoint.');
  }

  // Filter users based on role - non-admins can only see themselves
  // Also filter out inactive/system users (like 'Default' user created for internal operations)
  const visibleUsers = isCurrentUserAdmin 
    ? users.filter(user => user.isActive !== false) 
    : users.filter(user => user.id === currentUser?.id && user.isActive !== false);

  // Fetch stores for assignment
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: [`/org/${slug}/api/stores`],
  });

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiRequest(`/org/${slug}/api/users`, 'POST', userData);
      const newUser = await response.json();
      
      // Assign user to selected stores
      if (selectedStores.length > 0) {
        await Promise.all(selectedStores.map(storeId =>
          assignUserToStore.mutateAsync({ 
            userId: newUser.id, 
            storeId, 
            role: userData.role === 'manager' ? 'manager' : 'employee'
          })
        ));
      }
      
      return newUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/users`] });
      queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/stores`] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'User created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    },
  });

  // Update user mutation
  const updateUser = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const response = await apiRequest(`/org/${slug}/api/users/${id}`, 'PATCH', updates);
      const updatedUser = await response.json();
      console.log('FRONTEND: Received updated user:', JSON.stringify(updatedUser, null, 2));
      
      // Get current user store assignments
      const currentStoresResponse = await fetch(`/org/${slug}/api/users/${id}/stores`);
      const currentStores = currentStoresResponse.ok ? await currentStoresResponse.json() : [];
      const currentStoreIds = currentStores.map((us: any) => us.store.id);
      
      // Find stores to add and remove
      const storesToAdd = selectedStores.filter(storeId => !currentStoreIds.includes(storeId));
      const storesToRemove = currentStoreIds.filter((storeId: number) => !selectedStores.includes(storeId));
      
      // Add new store assignments
      await Promise.all(storesToAdd.map(storeId =>
        assignUserToStore.mutateAsync({ 
          userId: id, 
          storeId, 
          role: updates.role === 'manager' ? 'manager' : 'employee'
        })
      ));
      
      // Remove old store assignments
      await Promise.all(storesToRemove.map((storeId: number) =>
        removeUserFromStore.mutateAsync({ userId: id, storeId })
      ));
      
      return updatedUser;
    },
    onSuccess: (updatedUser) => {
      console.log('FRONTEND: onSuccess called with updatedUser:', JSON.stringify(updatedUser, null, 2));
      
      // Update the specific user in the cache immediately
      queryClient.setQueryData([`/org/${slug}/api/users`], (oldData: User[] | undefined) => {
        console.log('FRONTEND: Updating cache, oldData length:', oldData?.length);
        if (!oldData) return oldData;
        const newData = oldData.map(user => {
          if (user.id === updatedUser.id) {
            console.log('FRONTEND: Updating user', user.id, 'defaultStoreId from', user.defaultStoreId, 'to', updatedUser.defaultStoreId);
            return { ...user, ...updatedUser };
          }
          return user;
        });
        return newData;
      });
      
      // Force a refetch of users data to ensure fresh data
      queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/users`] });
      queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/stores`] });
      
      setEditingUser(null);
      resetForm();
      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest(`/org/${slug}/api/users/${userId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/org/${slug}/api/users`] });
      setDeleteUserModal({ isOpen: false, user: null });
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    },
  });

  // Reset password mutation
  const resetPassword = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest(`/org/${slug}/api/users/${userId}/reset-password`, 'POST');
      return await response.json();
    },
    onSuccess: (data) => {
      // Copy the new password to clipboard
      navigator.clipboard.writeText(data.newPassword);
      toast({
        title: 'Password Reset',
        description: (
          <div className="space-y-2">
            <p>Password reset for user: <strong>{data.username}</strong></p>
            <p className="font-mono text-sm bg-gray-100 p-2 rounded">{data.newPassword}</p>
            <p className="text-xs text-gray-600">Password copied to clipboard!</p>
          </div>
        ),
        duration: 10000, // Show for 10 seconds
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password',
        variant: 'destructive',
      });
    },
  });

  // Store assignment mutations
  const assignUserToStore = useMutation({
    mutationFn: async ({ userId, storeId, role }: { userId: number, storeId: number, role: string }) => {
      await apiRequest(`/org/${slug}/api/stores/${storeId}/users`, 'POST', { userId, role, permissions: [] });
    },
  });

  const removeUserFromStore = useMutation({
    mutationFn: async ({ userId, storeId }: { userId: number, storeId: number }) => {
      await apiRequest(`/org/${slug}/api/stores/${storeId}/users/${userId}`, 'DELETE');
    },
  });

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      displayName: '',
      role: 'user',
      isAdmin: false,
      isActive: true,
      defaultStoreId: 'none',
    });
    setSelectedStores([]);
  };

  const handleEdit = async (user: User) => {
    console.log('FRONTEND: handleEdit called with user defaultStoreId:', user.defaultStoreId);
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email || '',
      password: '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      displayName: user.displayName || '',
      role: user.role,
      isAdmin: user.isAdmin || false,
      isActive: user.isActive ?? true,
      defaultStoreId: user.defaultStoreId ? user.defaultStoreId.toString() : 'none',
    });
    
    // Load user's current store assignments
    try {
      const response = await fetch(`/org/${slug}/api/users/${user.id}/stores`);
      if (response.ok) {
        const userStores = await response.json();
        setSelectedStores(userStores.map((us: any) => us.store.id));
      }
    } catch (error) {
      console.error('Failed to load user stores:', error);
      setSelectedStores([]);
    }
  };

  const handleSubmit = () => {
    // Validate required fields
    if (!formData.username.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Username is required',
        variant: 'destructive',
      });
      return;
    }
    
    // Password is required only for new users
    if (!editingUser && !formData.password.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Password is required for new users',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.defaultStoreId || formData.defaultStoreId === 'none') {
      toast({
        title: 'Validation Error',
        description: 'Please select a Default Store for Orders',
        variant: 'destructive',
      });
      return;
    }
    
    if (selectedStores.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one Store Assignment',
        variant: 'destructive',
      });
      return;
    }
    
    if (editingUser) {
      const updateData: any = { ...formData, id: editingUser.id };
      if (!updateData.password) {
        delete updateData.password; // Don't update password if empty
      }
      // Convert defaultStoreId to number or null
      if (updateData.defaultStoreId && updateData.defaultStoreId !== 'none') {
        updateData.defaultStoreId = parseInt(updateData.defaultStoreId);
      } else {
        updateData.defaultStoreId = null;
      }
      console.log('FRONTEND: Sending user update data:', JSON.stringify(updateData, null, 2));
      updateUser.mutate(updateData);
    } else {
      const createData = { ...formData };
      // Convert defaultStoreId to number or null
      if (createData.defaultStoreId && createData.defaultStoreId !== 'none') {
        (createData as any).defaultStoreId = parseInt(createData.defaultStoreId);
      } else {
        (createData as any).defaultStoreId = null;
      }
      createUser.mutate(createData);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'manager':
        return 'default';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Users</h1>
        </div>
        <div className="flex items-center justify-center min-h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle authentication and other errors
  if (usersError) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Users</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="text-red-500 mb-4">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <h3 className="text-lg font-semibold">Unable to Load Users</h3>
              </div>
              
              {usersError.message.includes('401') ? (
                <div className="space-y-3">
                  <p className="text-gray-600">
                    Authentication required to view users. This might be due to a session timeout.
                  </p>
                  <div className="flex justify-center space-x-3">
                    <Button onClick={() => refetchUsers()} variant="outline" data-testid="button-retry-users">
                      Try Again
                    </Button>
                    <Button onClick={() => window.location.reload()} className="btn-orange-action">
                      Refresh Page
                    </Button>
                  </div>
                </div>
              ) : usersError.message.includes('403') ? (
                <div className="space-y-3">
                  <p className="text-gray-600">
                    You don't have permission to view users for this organization.
                  </p>
                  <Button onClick={() => refetchUsers()} variant="outline" data-testid="button-retry-users">
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-gray-600">
                    Error loading users: {usersError.message}
                  </p>
                  <Button onClick={() => refetchUsers()} variant="outline" data-testid="button-retry-users">
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
        </div>
        {isCurrentUserAdmin && (
          <Dialog open={isCreateModalOpen || !!editingUser} onOpenChange={(open) => {
            if (!open) {
              setIsCreateModalOpen(false);
              setEditingUser(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateModalOpen(true)} className="btn-orange-action" data-testid="button-new-user">
                <Plus className="h-4 w-4 mr-2" />
                New User
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Edit User' : 'Add New User'}
              </DialogTitle>
              <DialogDescription>
                {editingUser ? 'Update user information' : 'Create a new user account'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Basic Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="input-email"
                  />
                </div>
                
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Optional display name"
                    data-testid="input-display-name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="username">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    data-testid="input-username"
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">
                    Password {!editingUser && <span className="text-red-500">*</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? 'Leave empty to keep current password' : 'Enter password'}
                      data-testid="input-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Permissions & Settings</h3>
                
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={formData.isActive ? 'active' : 'disabled'} 
                    onValueChange={(value) => setFormData({ ...formData, isActive: value === 'active' })}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="role">
                    Role <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={formData.isAdmin}
                    onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                    data-testid="checkbox-is-admin"
                  />
                  <Label htmlFor="isAdmin">Company Administrator</Label>
                </div>
                
                <div>
                  <Label htmlFor="defaultStore">
                    Default Store for Orders <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={formData.defaultStoreId} 
                    onValueChange={(value) => setFormData({ ...formData, defaultStoreId: value })}
                  >
                    <SelectTrigger data-testid="select-default-store">
                      <SelectValue placeholder="Select default store for this user's orders" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store: any) => (
                        <SelectItem key={store.id} value={store.id.toString()}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-600 mt-1">
                    The store where this user's new orders will be automatically assigned
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="stores">
                    Store Assignments <span className="text-red-500">*</span>
                  </Label>
                  <MultiSelect
                    options={stores.map((store: any) => ({
                      value: store.id.toString(),
                      label: store.name,
                    }))}
                    selected={selectedStores.map(id => id.toString())}
                    onChange={(selected) => setSelectedStores(selected.map(id => parseInt(id)))}
                    placeholder="Select stores for user access..."
                    searchPlaceholder="Search stores..."
                    emptyText="No stores available"
                    data-testid="store-assignments-multiselect"
                  />
                  {selectedStores.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      Selected: {selectedStores.length} store{selectedStores.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t text-xs text-gray-500">
              <span className="text-red-500">*</span> Required
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreateModalOpen(false);
                setEditingUser(null);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createUser.isPending || updateUser.isPending}>
                {editingUser ? 'Update User' : 'Create User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {`Users (${visibleUsers.length})`}
          </CardTitle>
          <CardDescription>
            {isCurrentUserAdmin ? "Manage user accounts and permissions for your company" : "Your account information and store assignments"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && isSystemAdmin && users.length === 0 && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 text-amber-600">
                  ⚠️
                </div>
                <div>
                  <h4 className="font-semibold text-amber-800 mb-1">No Users Found</h4>
                  <p className="text-sm text-amber-700">
                    No users were found for this organization. This may indicate:
                  </p>
                  <ul className="list-disc list-inside text-sm text-amber-700 mt-2 space-y-1">
                    <li>The organization has no user accounts yet</li>
                    <li>There may be a data loading issue</li>
                    <li>Check the browser console for error messages</li>
                  </ul>
                  <p className="text-sm text-amber-700 mt-2">
                    Organization slug: <code className="bg-amber-100 px-1 rounded">{slug}</code>
                  </p>
                </div>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                {isCurrentUserAdmin && <TableHead>Role</TableHead>}
                <TableHead>Store Assignments</TableHead>
                {isCurrentUserAdmin && <TableHead>Status</TableHead>}
                {isCurrentUserAdmin && <TableHead>Last Login</TableHead>}
                {isCurrentUserAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.map((user: User) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-medium">
                        {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}
                      </div>
                      {user.isAdmin && (
                        <div className="flex items-center gap-1 mt-1">
                          <Shield className="h-3 w-3 text-red-500" />
                          <span className="text-xs text-red-600">Admin</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-username-${user.id}`}>{user.username}</TableCell>
                  <TableCell data-testid={`text-email-${user.id}`}>{user.email}</TableCell>
                  {isCurrentUserAdmin && (
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)} data-testid={`badge-role-${user.id}`}>
                        {user.role}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell data-testid={`cell-stores-${user.id}`}>
                    <UserStoreAssignments userId={user.id} slug={slug!} />
                  </TableCell>
                  {isCurrentUserAdmin && (
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'secondary'} data-testid={`badge-status-${user.id}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  )}
                  {isCurrentUserAdmin && (
                    <TableCell data-testid={`text-last-login-${user.id}`}>
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                    </TableCell>
                  )}
                  {isCurrentUserAdmin && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(user)}
                          data-testid={`button-edit-${user.id}`}
                          title="Edit user"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resetPassword.mutate(user.id)}
                          disabled={resetPassword.isPending}
                          data-testid={`button-reset-password-${user.id}`}
                          title="Reset password"
                        >
                          <KeyRound className="h-3 w-3" />
                        </Button>
                        {!user.isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteUserModal({ isOpen: true, user })}
                            data-testid={`button-delete-${user.id}`}
                            title="Delete user"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {visibleUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No users found</p>
                      <p className="text-sm">Add your first user to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteUserModal.isOpen} onOpenChange={(open) => 
        setDeleteUserModal({ isOpen: open, user: deleteUserModal.user })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteUserModal.user?.username}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserModal.user && deleteUser.mutate(deleteUserModal.user.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
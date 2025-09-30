import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Edit, 
  Users, 
  Building, 
  ShoppingCart, 
  FileText, 
  Webhook,
  Calendar,
  Infinity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PlanSettings {
  id: number;
  planId: string;
  planName: string;
  trialLengthDays: number | null;
  planLengthDays: number | null;
  maxUsers: number | null;
  maxVendors: number | null;
  onlineOrdering: boolean;
  asnProcessing: boolean;
  webhookExport: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const planSettingsSchema = z.object({
  planName: z.string().min(1, "Plan name is required"),
  trialLengthDays: z.number().nullable(),
  planLengthDays: z.number().nullable(),
  maxUsers: z.number().nullable(),
  maxVendors: z.number().nullable(),
  onlineOrdering: z.boolean(),
  asnProcessing: z.boolean(),
  webhookExport: z.boolean(),
});

type PlanSettingsForm = z.infer<typeof planSettingsSchema>;

function EditPlanDialog({ plan, onUpdate }: { plan: PlanSettings; onUpdate: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<PlanSettingsForm>({
    resolver: zodResolver(planSettingsSchema),
    defaultValues: {
      planName: plan.planName,
      trialLengthDays: plan.trialLengthDays,
      planLengthDays: plan.planLengthDays,
      maxUsers: plan.maxUsers,
      maxVendors: plan.maxVendors,
      onlineOrdering: plan.onlineOrdering,
      asnProcessing: plan.asnProcessing,
      webhookExport: plan.webhookExport,
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (data: PlanSettingsForm) => {
      const response = await apiRequest(`/api/admin/plan-settings/${plan.planId}`, 'PUT', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan updated successfully",
        description: `${plan.planName} plan settings have been updated.`,
      });
      onUpdate();
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error updating plan",
        description: error.message || "Failed to update plan settings",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PlanSettingsForm) => {
    updatePlanMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {plan.planName} Plan Settings</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="planName"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Plan Name</label>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="trialLengthDays"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Trial Length (Days)</label>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Leave empty for no trial"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="maxUsers"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Max Users</label>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Leave empty for unlimited"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="maxVendors"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Max Vendors</label>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Leave empty for unlimited"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Features</h4>
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="onlineOrdering"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <label className="text-sm font-medium">Online Ordering</label>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="asnProcessing"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <label className="text-sm font-medium">ASN Processing</label>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="webhookExport"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <label className="text-sm font-medium">Webhook/Export</label>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatePlanMutation.isPending}>
                {updatePlanMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPlanSettings() {
  const { toast } = useToast();

  const { data: planSettings, isLoading } = useQuery({
    queryKey: ['/api/admin/plan-settings'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/plan-settings', 'GET');
      return response.json();
    },
  });

  const refetchData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/plan-settings'] });
  };

  const formatLimit = (value: number | null, icon: React.ReactNode) => {
    if (value === null) {
      return (
        <div className="flex items-center text-blue-600">
          <Infinity className="h-4 w-4 mr-1" />
          Unlimited
        </div>
      );
    }
    return (
      <div className="flex items-center">
        {icon}
        <span className="ml-1">{value}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading plan settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plan Settings</h1>
          <p className="text-muted-foreground">
            Manage subscription plan features and limits
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Subscription Plan Configuration
          </CardTitle>
          <CardDescription>
            Configure features and limits for each subscription plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Trial Length</TableHead>
                <TableHead>Max Users</TableHead>
                <TableHead>Max Vendors</TableHead>
                <TableHead>Online Ordering</TableHead>
                <TableHead>ASN</TableHead>
                <TableHead>Webhook/Export</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planSettings?.map((plan: PlanSettings) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{plan.planName}</div>
                      <div className="text-sm text-gray-500">{plan.planId}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {plan.trialLengthDays ? (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-blue-500" />
                        {plan.trialLengthDays} days
                      </div>
                    ) : (
                      <span className="text-gray-500">No trial</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatLimit(plan.maxUsers, <Users className="h-4 w-4 text-green-500" />)}
                  </TableCell>
                  <TableCell>
                    {formatLimit(plan.maxVendors, <Building className="h-4 w-4 text-purple-500" />)}
                  </TableCell>
                  <TableCell>
                    {plan.onlineOrdering ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {plan.asnProcessing ? (
                      <Badge variant="default" className="bg-blue-100 text-blue-800">
                        <FileText className="h-3 w-3 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {plan.webhookExport ? (
                      <Badge variant="default" className="bg-orange-100 text-orange-800">
                        <Webhook className="h-3 w-3 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <EditPlanDialog plan={plan} onUpdate={refetchData} />
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
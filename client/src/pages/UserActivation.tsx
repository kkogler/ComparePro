import { useState } from "react";
import { useLocation, useParams, useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Key, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePublicOrganization } from "@/hooks/use-public-organization";

const activationSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ActivationFormData = z.infer<typeof activationSchema>;

export default function UserActivation() {
  const { slug } = useParams<{ slug: string }>();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isActivated, setIsActivated] = useState(false);

  // Get activation token from URL query parameters
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const token = urlParams.get('token');

  // Get public organization info for branding
  const { data: organization, isLoading: isLoadingOrg } = usePublicOrganization(slug);

  const form = useForm<ActivationFormData>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      password: "",
      confirmPassword: ""
    }
  });

  const activationMutation = useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const response = await apiRequest(`/org/${slug}/api/activate`, 'POST', data);
      return response.json();
    },
    onSuccess: (response) => {
      setIsActivated(true);
      toast({
        title: "Account Activated!",
        description: response.message || "Your account has been successfully activated."
      });
      
      // Redirect to dashboard after 3 seconds if auto-login succeeded
      if (response.user) {
        setTimeout(() => {
          setLocation(`/org/${slug}/`);
        }, 3000);
      } else {
        // Manual login required
        setTimeout(() => {
          setLocation(`/org/${slug}/auth`);
        }, 3000);
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Account activation failed";
      toast({
        variant: "destructive",
        title: "Activation Failed",
        description: errorMessage
      });
    }
  });

  const onSubmit = (data: ActivationFormData) => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Invalid Link",
        description: "No activation token found in the URL"
      });
      return;
    }

    activationMutation.mutate({
      token,
      password: data.password
    });
  };

  if (isLoadingOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <CardTitle>Invalid Activation Link</CardTitle>
            <CardDescription>
              This activation link is invalid or malformed. Please check your email for the correct link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation(`/org/${slug}/auth`)} 
              className="w-full"
              data-testid="button-goto-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isActivated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <CardTitle>Account Activated!</CardTitle>
            <CardDescription>
              Your account for {organization?.name || 'the organization'} has been successfully activated.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              You will be redirected shortly...
            </p>
            <Button 
              onClick={() => setLocation(`/org/${slug}/dashboard`)} 
              className="w-full"
              data-testid="button-goto-dashboard"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle>Activate Your Account</CardTitle>
          <CardDescription>
            {organization?.name && `Welcome to ${organization.name}! `}
            Create a secure password to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          type="password"
                          placeholder="Enter your password"
                          className="pl-10"
                          data-testid="input-password"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          type="password"
                          placeholder="Confirm your password"
                          className="pl-10"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Your password must contain at least 8 characters with uppercase, lowercase, numbers, and special characters.
                </AlertDescription>
              </Alert>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={activationMutation.isPending}
                data-testid="button-activate-account"
              >
                {activationMutation.isPending ? "Activating..." : "Activate Account"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Need help? Contact support for assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Redirect } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { AlertCircle, Store, Users, BarChart, Mail, ShoppingCart, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import microBizLogo from "@assets/microbiz-logo-vertical-on clear w black text 150 x150_1753376920147.png";
import priceCompareProLogo from "@assets/iTunesArtwork@2x_1753411990708.png";

export default function AuthPage() {
  const { user, loginMutation, organizationSlug } = useAuth();
  const [location] = useLocation();
  // Get public admin branding (company name) for login page display
  const { data: adminBranding } = useQuery<{companyName: string | null, logoUrl: string | null}>({
    queryKey: ['/api/admin/branding'],
    staleTime: 300000, // 5 minutes
  });

  // Get organization data for logo display (only for org-specific login pages)
  const { data: organizationData } = useQuery<{id: number, name: string, logoUrl?: string}>({
    queryKey: [`/org/${organizationSlug}/api/organization-public`],
    enabled: !!organizationSlug && !location.startsWith('/admin/auth'),
    staleTime: 300000, // 5 minutes
  });
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isFFLMode, setIsFFLMode] = useState(false);


  const isAdminAuth = location.startsWith('/admin/auth');
  
  // Reset error states when switching modes
  const switchMode = () => {
    setIsFFLMode(!isFFLMode);
    setLoginError(null);
    setLoginData({ username: "", password: "" });
  };


  // Redirect if already logged in
  if (user) {
    if (isAdminAuth) {
      return <Redirect to="/admin/" />;
    } else if (organizationSlug) {
      return <Redirect to={`/org/${organizationSlug}/search`} />;
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null); // Clear previous errors
    try {
      // Pass the mode information to the mutation
      await loginMutation.mutateAsync({ 
        ...loginData, 
        isFFLMode: isAdminAuth && isFFLMode 
      });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed");
    }
  };





  // Show organization not found error for org routes without valid organization
  if (!isAdminAuth && !organizationSlug) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex min-h-screen items-center justify-center">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-red-600">Organization Not Found</CardTitle>
                <CardDescription>
                  The organization URL is invalid or the organization doesn't exist.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please check the URL or contact your administrator for the correct organization link.
                    <br /><br />
                    <strong>Available Test Organizations:</strong><br />
                    {/* Organization links will be dynamically generated */}
                    {/* Available organizations will be listed dynamically */}
                    • <a href="/admin/auth" className="text-primary hover:underline">Admin Login</a>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-6xl relative">

            
            <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-2 pt-16">
              {/* Left side - Authentication */}
              <div className="flex items-center justify-center">
                <Card className="w-full max-w-md">
                  <CardHeader className="text-center">
                    {isAdminAuth && !isFFLMode && (
                      <CardTitle className="text-2xl font-bold mb-4">Administrator Login</CardTitle>
                    )}
                  {!isAdminAuth && organizationData && (
                    <div className="mb-4">
                      <div className="flex flex-col items-center justify-center mb-2">
                        {organizationData.logoUrl ? (
                          <img
                            src={organizationData.logoUrl}
                            alt={`${organizationData.name} Logo`}
                            className="h-32 w-auto object-contain mb-3"
                          />
                        ) : (
                          <img
                            src={microBizLogo}
                            alt="MicroBiz Logo"
                            className="h-32 w-auto object-contain mb-3"
                          />
                        )}
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary">{organizationData.name}</div>
                          <div className="text-sm text-muted-foreground">Store Login</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {isAdminAuth && isFFLMode && (
                    <CardTitle className="text-2xl font-bold">Store Login</CardTitle>
                  )}
                  <CardDescription>
                    {isAdminAuth 
                      ? (isFFLMode 
                          ? adminBranding?.companyName ? `Store login to ${adminBranding.companyName}` : "Store login"
                          : ""
                        )
                      : "Store subscriber access"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isAdminAuth ? (
                    <div className="space-y-4">
                      {!isFFLMode ? (
                        // DevOps Admin login form
                        <>
                          <form onSubmit={handleLogin} className="space-y-4">
                            {loginError && (
                              <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{loginError}</AlertDescription>
                              </Alert>
                            )}
                            <div className="space-y-2">
                              <Label htmlFor="username">Administrator Username</Label>
                              <Input
                                id="username"
                                type="text"
                                value={loginData.username}
                                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                                placeholder="Administrator username"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="password">Password</Label>
                              <Input
                                id="password"
                                type="password"
                                value={loginData.password}
                                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                required
                              />
                            </div>
                            <Button type="submit" className="w-full btn-orange-action" disabled={loginMutation.isPending}>
                              {loginMutation.isPending ? "Signing In..." : "Sign In as Administrator"}
                            </Button>
                            
                            <div className="text-center pt-2">
                              <button 
                                type="button"
                                className="text-sm text-primary hover:underline"
                                onClick={() => window.location.href = '/admin/reset'}
                                data-testid="link-forgot-password-admin"
                              >
                                Forgot your password?
                              </button>
                            </div>
                          </form>
                          <div className="text-center pt-4 border-t">
                            <p className="text-sm text-muted-foreground mb-2">
                              <button 
                                onClick={switchMode}
                                className="text-primary hover:underline font-medium"
                              >
                                Store Subscription?
                              </button>
                            </p>
                          </div>
                        </>
                      ) : (
                        // Store Subscriber login form
                        <>
                          <form onSubmit={handleLogin} className="space-y-4">
                            {loginError && (
                              <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{loginError}</AlertDescription>
                              </Alert>
                            )}
                            <div className="space-y-2">
                              <Label htmlFor="ffl-username">Username</Label>
                              <Input
                                id="ffl-username"
                                type="text"
                                value={loginData.username}
                                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                                placeholder="Your username"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="ffl-password">Password</Label>
                              <Input
                                id="ffl-password"
                                type="password"
                                value={loginData.password}
                                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                required
                              />
                            </div>
                            <Button type="submit" className="w-full btn-orange-action" disabled={loginMutation.isPending}>
                              {loginMutation.isPending ? "Signing In..." : "Sign In to Your Subscription"}
                            </Button>
                            
                            <div className="text-center pt-2">
                              <button 
                                type="button"
                                className="text-sm text-primary hover:underline"
                                onClick={() => window.location.href = `/org/${organizationSlug}/reset`}
                                data-testid="link-forgot-password"
                              >
                                Forgot your password?
                              </button>
                            </div>
                          </form>
                          <div className="text-center pt-4 border-t">
                            <p className="text-sm text-muted-foreground mb-2">
                              <button 
                                onClick={switchMode}
                                className="text-primary hover:underline font-medium"
                              >
                                System Administrator?
                              </button>
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    // Organization login form (registration removed)
                    <div className="w-full space-y-4">
                      <form onSubmit={handleLogin} className="space-y-4">
                        {loginError && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{loginError}</AlertDescription>
                          </Alert>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="login-username">Username</Label>
                          <Input
                            id="login-username"
                            type="text"
                            value={loginData.username}
                            onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="login-password">Password</Label>
                          <Input
                            id="login-password"
                            type="password"
                            value={loginData.password}
                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full btn-orange-action" disabled={loginMutation.isPending}>
                          {loginMutation.isPending ? "Signing In..." : "Sign In"}
                        </Button>
                        
                        <div className="text-center pt-2">
                          <button 
                            type="button"
                            className="text-sm text-primary hover:underline"
                            onClick={() => window.location.href = `/org/${organizationSlug}/reset`}
                            data-testid="link-forgot-password-store"
                          >
                            Forgot your password?
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right side - Hero section */}
            <div className="flex items-center justify-center">
              <div className="text-center space-y-6">
                {/* Company branding above Administrator Console for admin mode */}
                {isAdminAuth && !isFFLMode && (
                  <div className="flex flex-col items-center justify-center mb-6 space-y-4">
                    <div className="text-2xl font-bold text-primary">{adminBranding?.companyName || "Platform"}</div>
                    <img
                      src={microBizLogo}
                      alt="MicroBiz Logo"
                      className="h-36 w-auto object-contain"
                    />
                  </div>
                )}
                
                {/* Title and logo for Store Login */}
                {(isAdminAuth && isFFLMode) || !isAdminAuth ? (
                  <div className="flex flex-col items-center space-y-4 mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">
                      {adminBranding?.companyName || "PriceCompare Pro"}
                    </h1>
                    <img
                      src={microBizLogo}
                      alt="MicroBiz Logo"
                      className="h-36 w-auto object-contain"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">
                      Administrator Console
                    </h1>
                  </div>
                )}
                
                <div className="space-y-2">
                  <p className="text-xl text-muted-foreground">
                    {isAdminAuth 
                      ? (isFFLMode 
                          ? "Distributor price comparison and ordering platform"
                          : "System administration and organization management"
                        )
                      : "Distributor price comparison and ordering platform"
                    }
                  </p>
                </div>

                {/* Only show tiles for non-DevOps admin screens */}
                {!(isAdminAuth && !isFFLMode) && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="flex flex-col items-center space-y-2 p-4 rounded-lg border bg-card">
                      <Store className="h-8 w-8 text-primary" />
                      <h3 className="font-semibold">Find Lowest Prices</h3>
                      <p className="text-sm text-muted-foreground text-center">
                        Compare prices across multiple distributors
                      </p>
                    </div>
                    <div className="flex flex-col items-center space-y-2 p-4 rounded-lg border bg-card">
                      <ShoppingCart className="h-8 w-8 text-primary" />
                      <h3 className="font-semibold">Order Online</h3>
                      <p className="text-sm text-muted-foreground text-center">
                        Submit purchase orders electronically to distributors
                      </p>
                    </div>
                    <div className="flex flex-col items-center space-y-2 p-4 rounded-lg border bg-card">
                      <RefreshCw className="h-8 w-8 text-primary" />
                      <h3 className="font-semibold">POS Sync</h3>
                      <p className="text-sm text-muted-foreground text-center">
                        Publish ship receipt to POS system to better manage inventory
                      </p>
                    </div>
                  </div>
                )}

                {!isAdminAuth && (
                  <div className="text-center pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">
                      <a 
                        href="/admin/auth" 
                        className="text-primary hover:underline font-medium"
                      >
                        System Administrator Login
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
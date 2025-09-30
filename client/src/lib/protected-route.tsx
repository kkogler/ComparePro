import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading, organizationSlug } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        {path.startsWith('/admin') ? (
          <Redirect to="/admin/auth" />
        ) : organizationSlug ? (
          <Redirect to={`/org/${organizationSlug}/auth`} />
        ) : (
          <Redirect to="/admin/auth" />
        )}
      </Route>
    );
  }

  // Allow admin users to access organization pages (they can impersonate organizations)
  // No longer block admin access to organization pages since we have impersonation

  // Check if organization user is trying to access admin pages
  if (path.startsWith('/admin') && (user as any).companyId !== null) {
    return (
      <Route path={path}>
        <Redirect to="/admin/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
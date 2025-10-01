import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export function SimpleNav() {
  const [location] = useLocation();
  const { user, logoutMutation, organizationSlug } = useAuth();
  
  const isAdmin = location.startsWith('/admin');
  const orgSlug = organizationSlug || 'default';

  const adminLinks = [
    { path: "/admin/", label: "Subscriptions" },
    { path: "/admin/administrators", label: "Administrators" },
    { path: "/admin/integrations", label: "Integrations" },
    { path: "/admin/supported-vendors", label: "Vendors" },
    { path: "/admin/retail-verticals", label: "Retail Verticals" },
    { path: "/admin/master-catalog", label: "Master Catalog" },
    { path: "/admin/import", label: "Import" },
    { path: "/admin/settings", label: "Settings" }
  ];

  const orgLinks = [
    { path: `/org/${orgSlug}/`, label: "Dashboard" },
    { path: `/org/${orgSlug}/search`, label: "Product Search" },
    { path: `/org/${orgSlug}/compare`, label: "Compare" },
    { path: `/org/${orgSlug}/orders`, label: "Orders" },
    { path: `/org/${orgSlug}/asn`, label: "ASN" },
    { path: `/org/${orgSlug}/supported-vendors`, label: "Vendors" },
    { path: `/org/${orgSlug}/users`, label: "Users" },
    { path: `/org/${orgSlug}/stores`, label: "Stores" },
    { path: `/org/${orgSlug}/company`, label: "Company" },
    { path: `/org/${orgSlug}/pricing`, label: "Pricing Rules" },
    { path: `/org/${orgSlug}/settings`, label: "Settings" }
  ];

  const links = isAdmin ? adminLinks : orgLinks;

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-gray-900">
            {isAdmin ? "Admin Panel" : "Product Platform"}
          </h1>
          <div className="flex space-x-2">
            {links.map((link) => (
              <Link 
                key={link.path} 
                href={link.path}
                className={`px-3 py-1 text-sm rounded ${
                  location === link.path 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {isAdmin && !location.startsWith('/admin') && (
            <Link href="/admin/" className="text-sm text-blue-600 hover:text-blue-800">
              Back to Admin
            </Link>
          )}
          <span className="text-sm text-gray-600">{user?.username}</span>
          <button 
            onClick={() => logoutMutation.mutate()}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
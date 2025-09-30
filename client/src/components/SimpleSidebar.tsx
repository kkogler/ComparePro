import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  BarChart3, 
  Search, 
  ShoppingCart, 
  Truck, 
  Handshake, 
  Store,
  Building2,
  Settings,
  User,
  Users,
  Shield,
  Database,
  Upload,
  Tag,
  DollarSign,
  Crown,
  ArrowLeft
} from "lucide-react";

export function SimpleSidebar() {
  const [location] = useLocation();
  const { user, logoutMutation, organizationSlug } = useAuth();
  
  const isAdmin = location.startsWith('/admin');
  const orgSlug = organizationSlug || 'default';
  
  // Detect if admin is browsing an organization store
  const isAdminBrowsingOrg = !isAdmin && location.startsWith('/org/') && user?.companyId === null;

  const adminNavItems = [
    { path: "/admin/", icon: Shield, label: "Subscriptions" },
    { path: "/admin/administrators", icon: Users, label: "Administrators" },
    { path: "/admin/supported-vendors", icon: Handshake, label: "Vendors" },
    { path: "/admin/retail-verticals", icon: Tag, label: "Retail Verticals" },
    { path: "/admin/master-catalog", icon: Database, label: "Master Catalog" },
    { path: "/admin/import", icon: Upload, label: "Import" },
    { path: "/admin/settings", icon: Settings, label: "Settings" }
  ];

  const orgNavItems = [
    { path: `/org/${orgSlug}/`, icon: BarChart3, label: "Dashboard" },
    { path: `/org/${orgSlug}/search`, icon: Search, label: "Product Search" },
    { path: `/org/${orgSlug}/compare`, icon: BarChart3, label: "Compare" },
    { path: `/org/${orgSlug}/orders`, icon: ShoppingCart, label: "Orders" },
    { path: `/org/${orgSlug}/asn`, icon: Truck, label: "ASN" },
    { path: `/org/${orgSlug}/supported-vendors`, icon: Handshake, label: "Vendors" },
    { path: `/org/${orgSlug}/users`, icon: Users, label: "Users" },
    { path: `/org/${orgSlug}/stores`, icon: Store, label: "Stores" },
    { path: `/org/${orgSlug}/company`, icon: Building2, label: "Company" },
    { path: `/org/${orgSlug}/pricing`, icon: DollarSign, label: "Pricing Rules" },
    { path: `/org/${orgSlug}/settings`, icon: Settings, label: "Settings" }
  ];

  const navItems = isAdmin ? adminNavItems : orgNavItems;

  return (
    <aside className="w-64 bg-white shadow-lg flex-shrink-0 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        {/* Admin Mode Indicator */}
        {isAdminBrowsingOrg && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Crown className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-800">Admin Mode</span>
              </div>
              <Link href="/admin/" className="text-xs text-amber-600 hover:text-amber-800 flex items-center">
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back
              </Link>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              You're browsing this store as administrator
            </p>
          </div>
        )}
        
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 flex items-center justify-center">
            {isAdmin ? (
              <Shield className="h-6 w-6 text-blue-600" />
            ) : (
              <Store className="h-6 w-6 text-blue-600" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isAdmin ? "Admin Panel" : "Product Platform"}
            </h1>
          </div>
        </div>
      </div>
      
      <nav className="mt-6 flex-1">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <li key={item.path}>
                <Link 
                  href={item.path} 
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive 
                      ? "bg-blue-100 text-blue-700" 
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User info and logout */}
      <div className="mt-auto p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 mb-3">
          <User className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-700">{user?.username}</span>
        </div>
        <button 
          onClick={() => logoutMutation.mutate()}
          className="w-full text-left text-sm text-red-600 hover:text-red-800 px-3 py-2 rounded-lg hover:bg-red-50"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
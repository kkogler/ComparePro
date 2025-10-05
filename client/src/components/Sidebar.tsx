import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
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
  ChevronDown,
  ChevronRight,
  Crown,
  ArrowLeft,
  Network
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import microBizLogo from "@assets/microbiz-logo-vertical-on clear w black text 150 x150_1753376920147.png";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import type { UserSettings } from "@/lib/types";
import { useAdminSettings } from "@/hooks/use-admin-settings";
import { usePublicOrganization } from "@/hooks/use-public-organization";

export function Sidebar() {
  const [location] = useLocation();
  const { user, organizationSlug } = useAuth();
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  const isAdmin = useMemo(() => location.startsWith('/admin'), [location]);
  const orgSlug = useMemo(() => organizationSlug || 'default', [organizationSlug]);
  
  // Detect if admin is browsing an organization store
  const isAdminBrowsingOrg = useMemo(() => !isAdmin && location.startsWith('/org/') && user?.companyId === null, [isAdmin, location, user?.companyId]);
  
  // Get admin settings for branding (admin only)
  const { data: adminSettings } = useAdminSettings();
  
  // Get public organization data for store branding
  const { data: publicOrgData } = usePublicOrganization(isAdmin ? undefined : orgSlug);

  const { data: dashboardData } = useQuery({
    queryKey: [isAdmin ? '/api/admin/dashboard' : `/org/${orgSlug}/api/dashboard`],
    select: (data: any) => data?.stats,
    staleTime: 10000, // 10 seconds
    enabled: !!user
  });

  const { data: settings } = useQuery<UserSettings>({
    queryKey: [isAdmin ? '/api/admin/settings' : `/org/${orgSlug}/api/settings`],
    staleTime: 60000, // 1 minute
    enabled: !!user
  });

  // Get organization info for multi-tenant display
  const { data: organizations } = useQuery({
    queryKey: ['/api/admin/organizations'],
    staleTime: 60000, // 1 minute
    enabled: isAdmin
  });

  // Get current organization data for FFL subscribers
  const { data: currentOrgData } = useQuery({
    queryKey: [`/org/${orgSlug}/api/organization`],
    staleTime: 60000, // 1 minute
    enabled: !isAdmin && !!user
  });

  // Administrators have no organization, FFL subscribers have their organization
  const currentOrg = isAdmin ? null : currentOrgData;

  // Check if any settings submenu item is active
  const settingsSubMenuPaths = [
    `/org/${orgSlug}/company`,
    `/org/${orgSlug}/stores`,
    `/org/${orgSlug}/users`,
    `/org/${orgSlug}/pricing`,
    `/org/${orgSlug}/categories`
  ];
  
  const isSettingsActive = settingsSubMenuPaths.includes(location);

  const navItems = isAdmin ? [
    { 
      path: "/admin/", 
      icon: Shield, 
      label: "Subscriptions" 
    },
    { 
      path: "/admin/supported-vendors", 
      icon: Store, 
      label: "Supported Vendors" 
    },
    { 
      path: "/admin/master-catalog", 
      icon: Database, 
      label: "Master Product Catalog" 
    },
    { 
      path: "/admin/import", 
      icon: Upload, 
      label: "Catalog Import" 
    },
    { 
      path: "/admin/retail-verticals", 
      icon: Tag, 
      label: "Retail Verticals" 
    },
    { 
      path: "/admin/plan-settings", 
      icon: Settings, 
      label: "Plan Settings" 
    },
    { 
      path: "/admin/administrators", 
      icon: User, 
      label: "Administrators" 
    },
    { 
      path: "/admin/integrations", 
      icon: Settings, 
      label: "Integrations" 
    },
    { 
      path: "/admin/settings", 
      icon: Settings, 
      label: "Admin Settings" 
    },

  ] : [
    { 
      path: `/org/${orgSlug}/search`, 
      icon: Search, 
      label: "Product Search" 
    },
    { 
      path: `/org/${orgSlug}/orders`, 
      icon: ShoppingCart, 
      label: "Vendor Orders",
      badge: ((dashboardData?.draftOrders || 0) + (dashboardData?.openOrders || 0)) > 0 ? 
        (dashboardData?.draftOrders || 0) + (dashboardData?.openOrders || 0) : undefined
    },
    { 
      path: `/org/${orgSlug}/ship-notices`, 
      icon: Truck, 
      label: "Ship Notices",
      badge: (dashboardData?.openAsns || 0) > 0 ? dashboardData.openAsns : undefined
    },
    { 
      path: `/org/${orgSlug}/supported-vendors`, 
      icon: Store, 
      label: "Supported Vendors"
    },
    { 
      path: `/org/${orgSlug}/`, 
      icon: BarChart3, 
      label: "Reports" 
    }
  ];

  const settingsSubMenuItems = [
    { 
      path: `/org/${orgSlug}/company`, 
      icon: Building2, 
      label: "Company" 
    },
    { 
      path: `/org/${orgSlug}/stores`, 
      icon: Building2, 
      label: "Stores" 
    },
    { 
      path: `/org/${orgSlug}/users`, 
      icon: Users, 
      label: "Users" 
    },
    { 
      path: `/org/${orgSlug}/pricing`, 
      icon: DollarSign, 
      label: "Pricing Rules" 
    },
    { 
      path: `/org/${orgSlug}/categories`, 
      icon: Tag, 
      label: "Product Categories" 
    },
    { 
      path: `/org/${orgSlug}/integrations`, 
      icon: Network, 
      label: "Integrations" 
    }
  ];

  return (
    <aside className="w-64 shadow-lg flex-shrink-0 flex flex-col" style={{backgroundColor: '#626c73'}}>
      <div className="p-6 border-b border-gray-600">
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
                Back to Admin
              </Link>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              You're browsing this store as administrator
            </p>
          </div>
        )}
        
        <div className="flex items-center">
          <div>
            <h1 className="text-xl font-bold text-white">
              {isAdmin 
                ? "Administrator Panel" 
                : (publicOrgData?.name || "Product Platform")
              }
            </h1>
          </div>
        </div>
      </div>
      
      <nav className="mt-6 flex-1 overflow-y-auto">
        <ul className="space-y-1 px-3 pb-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <li key={item.path}>
                <Link href={item.path} className={cn(
                  "flex flex-col items-center px-3 py-3 text-xs font-medium rounded-lg relative",
                  isActive ? "sidebar-active" : "sidebar-inactive"
                )}>
                  <Icon className="h-5 w-5 mb-1" />
                  <div className="flex items-center gap-1">
                    <span className="text-center">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge variant="secondary" className="h-4 w-4 flex items-center justify-center p-0 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
          
          {/* Settings menu with submenu items (only for non-admin) */}
          {!isAdmin && (
            <li>
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className={cn(
                  "w-full flex flex-col items-center px-3 py-3 text-xs font-medium rounded-lg text-center relative",
                  isSettingsActive ? "sidebar-active" : "sidebar-inactive"
                )}
              >
                <Settings className="h-5 w-5 mb-1" />
                <span>Settings</span>
                <div className="absolute -bottom-1 right-1">
                  {settingsExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </div>
              </button>
              
              {settingsExpanded && (
                <ul className="mt-2 ml-6 space-y-1">
                  {settingsSubMenuItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = location === subItem.path;
                    
                    return (
                      <li key={subItem.path}>
                        <Link href={subItem.path} className={cn(
                          "flex flex-col items-center px-3 py-2 text-xs font-medium rounded-lg",
                          isSubActive ? "sidebar-active" : "sidebar-inactive"
                        )}>
                          <SubIcon className="h-4 w-4 mb-1" />
                          <span className="text-center">{subItem.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          )}

        </ul>
      </nav>
      
    </aside>
  );
}

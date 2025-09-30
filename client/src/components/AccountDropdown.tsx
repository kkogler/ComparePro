import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { User, LogOut, CreditCard, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AccountDropdownProps {
  isAdmin?: boolean;
  organizationSlug?: string;
}

export function AccountDropdown({ isAdmin = false, organizationSlug }: AccountDropdownProps) {
  const { user, logoutMutation } = useAuth();
  
  // Get current organization data for store users
  const { data: currentOrg } = useQuery({
    queryKey: [`/org/${organizationSlug}/api/organization`],
    staleTime: 60000, // 1 minute
    enabled: !isAdmin && !!organizationSlug
  });


  const handleBillingAccess = () => {
    if (organizationSlug) {
      window.location.href = `/org/${organizationSlug}/billing`;
    }
  };

  const handleSignOut = () => {
    logoutMutation.mutate();
  };

  // Display name logic
  const displayName = isAdmin 
    ? user?.username 
    : `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username;
    
  const subtitle = isAdmin 
    ? 'System Administrator' 
    : (currentOrg as any)?.name || 'Loading...';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center space-x-2 border border-white hover:bg-white/10 px-3 py-2 rounded-md"
          data-testid="button-account-dropdown"
        >
          <div className="w-8 h-8 bg-transparent rounded-full flex items-center justify-center">
            <User className="text-white h-4 w-4" />
          </div>
          <div className="flex flex-col items-start text-left min-w-0">
            <span className="text-sm font-medium text-white truncate max-w-32">
              {displayName}
            </span>
            <span className="text-xs text-white/80 truncate max-w-32">
              {subtitle}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-white/60" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="text-gray-700 h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {displayName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />


        {!isAdmin && organizationSlug && (
          <DropdownMenuItem 
            onClick={handleBillingAccess}
            className="cursor-pointer"
            data-testid="menu-billing-access"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Billing Account
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem 
          onClick={handleSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600"
          disabled={logoutMutation.isPending}
          data-testid="menu-sign-out"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {logoutMutation.isPending ? 'Signing Out...' : 'Sign Out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
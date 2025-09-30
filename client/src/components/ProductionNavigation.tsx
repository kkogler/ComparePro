import { AccountDropdown } from './AccountDropdown';
import { usePublicOrganization } from '@/hooks/use-public-organization';
import { useQuery } from '@tanstack/react-query';
import microBizLogo from "@assets/microbiz-logo-vertical-on clear w black text 150 x150_1753376920147.png";

// Simplified, reliable navigation header
// ALWAYS renders a header - no conditional returns that cause disappearing

export function ProductionNavigation() {
  const currentPath = window.location.pathname;
  
  // Hide only on specific login/auth pages
  if (currentPath === '/admin/auth' || currentPath.match(/^\/org\/[^\/]+\/auth$/)) {
    return null;
  }
  
  // Determine page type
  const isAdmin = currentPath.startsWith('/admin');
  const orgMatch = currentPath.match(/^\/org\/([^\/]+)/);
  const orgSlug = orgMatch ? orgMatch[1] : null;
  
  // Fetch all data upfront (hooks at top level)
  const { data: adminBranding } = useQuery<{companyName: string | null, logoUrl: string | null}>({
    queryKey: ['/api/admin/branding'],
    staleTime: 300000,
    enabled: true // Enable for all pages since store headers now use MicroBiz branding
  });
  
  const { data: organization } = usePublicOrganization(orgSlug || undefined);
  
  // Determine header content based on page type
  let logoSrc = microBizLogo;
  let companyName = 'MicroBiz';
  let showAccountDropdown = true;
  let dropdownProps = {};
  
  if (isAdmin) {
    // Admin header
    const hasCustomLogo = adminBranding?.logoUrl;
    logoSrc = hasCustomLogo ? adminBranding.logoUrl! : microBizLogo;
    companyName = adminBranding?.companyName || 'MicroBiz';
    dropdownProps = { isAdmin: true };
  } else if (orgSlug) {
    // Organization header - use MicroBiz branding instead of organization branding
    const hasCustomLogo = adminBranding?.logoUrl;
    logoSrc = hasCustomLogo ? adminBranding.logoUrl! : microBizLogo;
    companyName = adminBranding?.companyName || 'MicroBiz';
    dropdownProps = { isAdmin: false, organizationSlug: orgSlug };
  } else {
    // Default header
    companyName = 'MicroBiz';
    showAccountDropdown = false; // No dropdown for unknown pages
  }
  
  // ALWAYS render the same header structure - just swap content
  return (
    <div className="w-full px-6 py-3 fixed top-0 left-0 right-0 z-[9999]" style={{backgroundColor: '#3f4549', minHeight: '60px'}}>
      <div className="flex items-center justify-between h-full">
        <div className="flex items-center space-x-3">
          {adminBranding?.logoUrl ? (
            // Custom admin logo (full logo)
            <img
              src={logoSrc}
              alt={`${companyName} Logo`}
              className="h-10 object-contain"
            />
          ) : (
            // Standard logo with text
            <>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: '#2f80c2'}}>
                <img
                  src={microBizLogo}
                  alt="Logo"
                  className="h-8 w-8 object-contain"
                />
              </div>
              <span className="text-white font-medium text-lg">{companyName}</span>
            </>
          )}
        </div>
        {showAccountDropdown && <AccountDropdown {...dropdownProps} />}
      </div>
    </div>
  );
}
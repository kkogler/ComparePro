import { useQuery } from '@tanstack/react-query';

export interface AdminSettings {
  id: number;
  sendgridApiKey: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  systemEmail: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  maxOrganizations: number;
  supportEmail: string;
  companyName: string;
  logoUrl: string | null;
  systemTimeZone: string;
  catalogRefreshEnabled: boolean;
  catalogRefreshTime: string;
  catalogRefreshFrequency: string;
  catalogRefreshDays: string | null;
  lastCatalogRefresh: string | null;
  refreshInProgress: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useAdminSettings() {
  return useQuery<AdminSettings>({
    queryKey: ['/api/admin/settings'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
import { useQuery } from '@tanstack/react-query';

export interface PublicOrganization {
  id: number;
  name: string;
  logoUrl: string | null;
}

export function usePublicOrganization(organizationSlug?: string) {
  return useQuery<PublicOrganization>({
    queryKey: [`/org/${organizationSlug}/api/organization-public`],
    enabled: !!organizationSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
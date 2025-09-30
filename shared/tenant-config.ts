// Tenant routing configuration
export type MultiTenantMode = 'host' | 'path';

export interface TenantConfig {
  mode: MultiTenantMode;
  baseDomain?: string; // For host mode: e.g., "bestprice.app"
  enableCanonicalRedirects: boolean;
  enableFallbackRouting: boolean; // Allow path-based as fallback
}

// Load configuration from environment variables
export function getTenantConfig(): TenantConfig {
  const mode = (process.env.MULTI_TENANT_MODE as MultiTenantMode) || 'path';
  const baseDomain = process.env.BASE_DOMAIN || undefined;
  const enableCanonicalRedirects = process.env.ENABLE_CANONICAL_REDIRECTS === 'true';
  const enableFallbackRouting = process.env.ENABLE_FALLBACK_ROUTING !== 'false'; // Default to true

  return {
    mode,
    baseDomain,
    enableCanonicalRedirects,
    enableFallbackRouting,
  };
}

// Validate tenant configuration
export function validateTenantConfig(config: TenantConfig): void {
  if (config.mode === 'host' && !config.baseDomain) {
    throw new Error('BASE_DOMAIN environment variable is required when MULTI_TENANT_MODE=host');
  }

  if (config.mode !== 'host' && config.mode !== 'path') {
    throw new Error('MULTI_TENANT_MODE must be either "host" or "path"');
  }
}

// Environment variables documentation for .env file
export const TENANT_ENV_DOCS = `
# Multi-tenant routing configuration
# MULTI_TENANT_MODE=path    # Development: /org/{slug}/ routing
# MULTI_TENANT_MODE=host    # Production: subdomain.domain.com routing

# Base domain for host mode (required when MULTI_TENANT_MODE=host)
# BASE_DOMAIN=bestprice.app

# Enable canonical URL redirects (recommended for production)
# ENABLE_CANONICAL_REDIRECTS=true

# Enable fallback to path-based routing when host mode fails
# ENABLE_FALLBACK_ROUTING=true
`;

export default getTenantConfig;
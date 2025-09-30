import type { Request, Response, NextFunction } from "express";
import { getTenantConfig, validateTenantConfig } from "@shared/tenant-config";
import { storage } from "./storage";

// Extend Express Request type to include host-based tenant properties
declare global {
  namespace Express {
    interface Request {
      hostBasedSlug?: string;
      resolvedFromHost?: boolean;
      canonicalUrl?: string;
    }
  }
}

export interface HostResolutionResult {
  organizationSlug: string | null;
  resolvedFromHost: boolean;
  canonicalUrl?: string;
  shouldRedirect?: boolean;
}

/**
 * Extract subdomain from hostname
 * Examples:
 * - "demo-gun-store.bestprice.app" → "demo-gun-store"
 * - "localhost:5000" → null
 * - "bestprice.app" → null (no subdomain)
 */
export function extractSubdomain(hostname: string, baseDomain?: string): string | null {
  if (!hostname || !baseDomain) return null;
  
  // Remove port if present
  const host = hostname.split(':')[0];
  
  // Check if hostname ends with base domain
  if (!host.endsWith(baseDomain)) return null;
  
  // Extract subdomain part
  const subdomain = host.slice(0, -(baseDomain.length + 1)); // +1 for the dot
  
  // Return null if no subdomain or if subdomain is empty
  return subdomain && subdomain.length > 0 ? subdomain : null;
}

/**
 * Resolve organization from hostname
 */
export async function resolveOrganizationFromHost(hostname: string, baseDomain?: string): Promise<HostResolutionResult> {
  try {
    const subdomain = extractSubdomain(hostname, baseDomain);
    
    if (!subdomain) {
      return {
        organizationSlug: null,
        resolvedFromHost: false,
      };
    }

    // Look up organization by domain first (exact match)
    const orgByDomain = await storage.getOrganizationByDomain(hostname);
    if (orgByDomain) {
      return {
        organizationSlug: orgByDomain.slug,
        resolvedFromHost: true,
        canonicalUrl: `https://${hostname}`,
      };
    }

    // Fallback: Look up by subdomain (supports legacy subdomain mapping)
    const orgBySubdomain = await storage.getOrganizationBySubdomain(subdomain);
    if (orgBySubdomain) {
      return {
        organizationSlug: orgBySubdomain.slug,
        resolvedFromHost: true,
        canonicalUrl: `https://${hostname}`,
      };
    }

    return {
      organizationSlug: null,
      resolvedFromHost: false,
    };
  } catch (error) {
    console.error('Error resolving organization from host:', error);
    return {
      organizationSlug: null,
      resolvedFromHost: false,
    };
  }
}

/**
 * Host-based tenant resolver middleware
 * Attempts to resolve organization from hostname in host mode
 */
export async function hostBasedTenantResolver(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantConfig = getTenantConfig();
    
    // Only process in host mode
    if (tenantConfig.mode !== 'host') {
      return next();
    }

    // Validate configuration
    validateTenantConfig(tenantConfig);

    const hostname = req.get('host') || req.hostname;
    
    if (!hostname) {
      console.warn('HOST RESOLVER: No hostname found in request');
      return next();
    }

    // Resolve organization from hostname
    const resolution = await resolveOrganizationFromHost(hostname, tenantConfig.baseDomain);
    
    if (resolution.organizationSlug) {
      console.log(`HOST RESOLVER: Resolved ${hostname} → ${resolution.organizationSlug}`);
      
      // Set host-based resolution properties
      req.hostBasedSlug = resolution.organizationSlug;
      req.resolvedFromHost = true;
      req.canonicalUrl = resolution.canonicalUrl;

      // Set organizationSlug for compatibility with existing middleware
      req.organizationSlug = resolution.organizationSlug;
    } else {
      console.log(`HOST RESOLVER: No organization found for hostname: ${hostname}`);
    }

    next();
  } catch (error) {
    console.error('HOST RESOLVER ERROR:', error);
    // Don't fail the request, just continue without host-based resolution
    next();
  }
}

/**
 * Canonical URL redirect middleware
 * Redirects to canonical URLs when enabled
 */
export function canonicalUrlRedirect(req: Request, res: Response, next: NextFunction): void {
  try {
    const tenantConfig = getTenantConfig();
    
    if (!tenantConfig.enableCanonicalRedirects || !req.canonicalUrl) {
      return next();
    }

    const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const canonicalBase = req.canonicalUrl;
    
    // Only redirect if the base URL is different (don't redirect query params or fragments)
    if (!requestUrl.startsWith(canonicalBase)) {
      const canonicalUrl = `${canonicalBase}${req.originalUrl}`;
      console.log(`CANONICAL REDIRECT: ${requestUrl} → ${canonicalUrl}`);
      return res.redirect(301, canonicalUrl);
    }

    next();
  } catch (error) {
    console.error('CANONICAL REDIRECT ERROR:', error);
    next();
  }
}

export default hostBasedTenantResolver;
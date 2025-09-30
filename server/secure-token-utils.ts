import { randomBytes } from "crypto";
import { promisify } from "util";

const randomBytesAsync = promisify(randomBytes);

/**
 * Generate a cryptographically secure random token for user activation or password reset
 * @param length Token length in bytes (default 32 = 256 bits of entropy)
 * @returns Base64url encoded secure token
 */
export async function generateSecureToken(length: number = 32): Promise<string> {
  try {
    const buffer = await randomBytesAsync(length);
    // Use base64url encoding (URL-safe, no padding)
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch (error) {
    console.error('Failed to generate secure token:', error);
    throw new Error('Token generation failed');
  }
}

/**
 * Generate activation token with expiration time
 * @param expirationMinutes Minutes until token expires (default 30 min)
 * @returns Object with token and expiration timestamp
 */
export async function generateActivationToken(expirationMinutes: number = 30): Promise<{
  token: string;
  expires: Date;
}> {
  const token = await generateSecureToken(32); // 256 bits of entropy
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + expirationMinutes);
  
  return { token, expires };
}

/**
 * Generate password reset token with shorter expiration (security best practice)
 * @param expirationMinutes Minutes until token expires (default 15 min)
 * @returns Object with token and expiration timestamp
 */
export async function generatePasswordResetToken(expirationMinutes: number = 15): Promise<{
  token: string;
  expires: Date;
}> {
  const token = await generateSecureToken(32); // 256 bits of entropy
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + expirationMinutes);
  
  return { token, expires };
}

/**
 * Validate if a token has expired
 * @param expirationDate Token expiration timestamp
 * @returns true if token is expired
 */
export function isTokenExpired(expirationDate: Date | null): boolean {
  if (!expirationDate) return true;
  return new Date() > expirationDate;
}

/**
 * Generate secure activation URL for organization
 * @param organizationSlug Organization slug for URL routing
 * @param token Activation token
 * @param baseUrl Base URL of the application (optional)
 * @returns Complete activation URL
 */
export function generateActivationUrl(organizationSlug: string, token: string, baseUrl?: string): string {
  const base = baseUrl || process.env.BASE_URL || 'https://bestprice.app';
  return `${base}/org/${organizationSlug}/activate?token=${token}`;
}

/**
 * Generate secure password reset URL for organization
 * @param organizationSlug Organization slug for URL routing  
 * @param token Password reset token
 * @param baseUrl Base URL of the application (optional)
 * @returns Complete password reset URL
 */
export function generatePasswordResetUrl(organizationSlug: string, token: string, baseUrl?: string): string {
  const base = baseUrl || process.env.BASE_URL || 'https://bestprice.app';
  return `${base}/org/${organizationSlug}/reset?token=${token}`;
}

/**
 * Generate login URL for organization
 * @param organizationSlug Organization slug for URL routing
 * @param baseUrl Base URL of the application (optional)
 * @returns Complete login URL
 */
export function generateLoginUrl(organizationSlug: string, baseUrl?: string): string {
  const base = baseUrl || process.env.BASE_URL || 'https://pricecomparehub.com';
  return `${base}/org/${organizationSlug}/auth`;
}
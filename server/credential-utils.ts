import type { SportsSouthCredentials } from './sports-south-api';

export function normalizeSportsSouthCredentials(input: any): SportsSouthCredentials {
  const src = input || {};
  return {
    userName: (src.userName || src.username || src.UserName || '').toString().trim(),
    customerNumber: (src.customerNumber || src.customer_number || src.CustomerNumber || src.customer || '').toString().trim(),
    password: (src.password || src.Password || '').toString(),
    source: (src.source || src.Source || '').toString().trim()
  };
}

export function validateSportsSouthCredentials(creds: Partial<SportsSouthCredentials>): { isValid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!creds.userName) missing.push('userName');
  if (!creds.customerNumber) missing.push('customerNumber');
  if (!creds.password) missing.push('password');
  if (!creds.source) missing.push('source');
  return { isValid: missing.length === 0, missing };
}







import { randomUUID } from 'crypto';

/**
 * Simplified Zoho webhook payload structure
 * Based on Zoho's standard event wrapper format: { event_type, event_id, data }
 */
export interface NormalizedZohoWebhook {
  eventType: string | null;
  eventId: string;
  subscription: any;
  customer: any;
  rawPayload: any;
}

/**
 * Simplified Zoho webhook payload normalization
 * Zoho webhooks may use different formats depending on configuration
 *
 * @param body Raw webhook payload from Zoho
 * @returns Normalized webhook data
 */
export function normalizeZohoPayload(body: any): NormalizedZohoWebhook {
  // Simple normalization for Zoho webhooks
  // Assume subscription_created if we have subscription data
  const eventType = body.subscription_id || body.subscription_number ? 'subscription_created' : 'customer_created';
  const eventId = body.subscription_id || body.subscription_number || body.customer_id || randomUUID();

  // Extract subscription and customer data
  const subscription = body.subscription_id || body.subscription_number ? body : null;
  const customer = body.customer_id ? body : (body.customer || null);

  return {
    eventType,
    eventId,
    subscription,
    customer,
    rawPayload: body
  };
}

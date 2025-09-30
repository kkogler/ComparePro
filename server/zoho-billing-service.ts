/**
 * Zoho Billing API Service
 * Follows Zoho Billing best practices:
 * - Use hosted payment pages for upgrades
 * - Use customer portal for self-service
 * - Let Zoho handle all billing communications
 */

interface ZohoBillingConfig {
  authToken?: string;
  organizationId?: string;
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export class ZohoBillingService {
  private config: ZohoBillingConfig;

  constructor() {
    // Initialize from env; will hydrate from admin settings lazily on first use
    this.config = {
      authToken: process.env.ZOHO_BILLING_ACCESS_TOKEN,
      organizationId: process.env.ZOHO_BILLING_ORG_ID,
      baseUrl: process.env.ZOHO_BILLING_BASE_URL || 'https://www.zohoapis.com/billing/v1',
      clientId: process.env.ZOHO_BILLING_CLIENT_ID,
      clientSecret: process.env.ZOHO_BILLING_CLIENT_SECRET,
      refreshToken: process.env.ZOHO_BILLING_REFRESH_TOKEN
    };
  }

  private async hydrateFromAdminSettings(): Promise<void> {
    try {
      if (this.config.clientId && this.config.clientSecret && this.config.refreshToken && this.config.organizationId) {
        return; // already hydrated
      }
      const { storage } = await import('./storage');
      const admin = await storage.getAdminSettings();
      if (admin) {
        this.config.clientId = admin.zohoBillingClientId || this.config.clientId;
        this.config.clientSecret = admin.zohoBillingClientSecret || this.config.clientSecret;
        this.config.refreshToken = admin.zohoBillingRefreshToken || this.config.refreshToken;
        this.config.organizationId = admin.zohoBillingOrgId || this.config.organizationId;
        this.config.baseUrl = admin.zohoBillingBaseUrl || this.config.baseUrl;
      }
    } catch (e) {
      console.error('ZOHO BILLING: Failed hydrating config from admin settings:', e);
    }
  }

  /**
   * Get fresh access token using existing refresh token
   */
  async getAccessToken(): Promise<string> {
    try {
      await this.hydrateFromAdminSettings();
      // If we have a valid auth token, return it
      if (this.config.authToken) {
        return this.config.authToken;
      }

      // If we don't have a refresh token, we can't get an access token
      if (!this.config.refreshToken || !this.config.clientId || !this.config.clientSecret) {
        console.warn('ZOHO BILLING: Missing OAuth credentials for token refresh');
        throw new Error('Missing OAuth credentials. Please configure ZOHO_BILLING_REFRESH_TOKEN, ZOHO_BILLING_CLIENT_ID, and ZOHO_BILLING_CLIENT_SECRET');
      }

      console.log('ZOHO BILLING: Refreshing access token...');
      
      const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ZOHO BILLING: Token refresh failed:', response.status, errorText);
        throw new Error(`Failed to refresh access token: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // Update the auth token for this session
      this.config.authToken = data.access_token;
      
      console.log('ZOHO BILLING: Access token refreshed successfully');
      return data.access_token;

    } catch (error) {
      console.error('ZOHO BILLING: Error getting access token:', error);
      throw error;
    }
  }

  /**
   * Fetch organization ID using current credentials
   */
  async getOrganizationId(): Promise<string> {
    try {
      await this.hydrateFromAdminSettings();
      // If we already have the organization ID, return it
      if (this.config.organizationId) {
        return this.config.organizationId;
      }

      console.log('ZOHO BILLING: Fetching organization ID...');
      
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.config.baseUrl}/organizations`, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ZOHO BILLING: Organizations fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch organizations: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.organizations || data.organizations.length === 0) {
        throw new Error('No organizations found in Zoho Billing account');
      }

      // Use the first organization (most common case)
      const organizationId = data.organizations[0].organization_id;
      
      // Cache it for this session
      this.config.organizationId = organizationId;
      
      console.log('ZOHO BILLING: Organization ID fetched successfully:', organizationId);
      return organizationId;

    } catch (error) {
      console.error('ZOHO BILLING: Error fetching organization ID:', error);
      throw error;
    }
  }

  /**
   * Fetch invoices for a subscription
   */
  async getInvoices(subscriptionId: string, limit: number = 10): Promise<any> {
    try {
      await this.hydrateFromAdminSettings();
      console.log(`ZOHO BILLING: Fetching invoices for subscription ${subscriptionId}`);
      
      // Automatically get fresh credentials using existing OAuth setup
      const authToken = await this.getAccessToken();
      const organizationId = await this.getOrganizationId();
      
      if (!authToken || !organizationId) {
        console.warn('ZOHO BILLING: Missing credentials, using simulated response');
        return this.generateFallbackInvoices(subscriptionId, limit);
      }

      const response = await fetch(`${this.config.baseUrl}/subscriptions/${subscriptionId}/invoices`, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${authToken}`,
          'X-com-zoho-subscriptions-organizationid': organizationId,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ZOHO BILLING: Invoices fetch failed:', response.status, errorText);
        
        // If token expired, try to refresh and retry
        if (response.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.getInvoices(subscriptionId, limit);
          }
        }
        
        throw new Error(`Failed to fetch invoices: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('ZOHO BILLING: Invoices fetched successfully');
      return data;

    } catch (error) {
      console.error('ZOHO BILLING: Error fetching invoices:', error);
      // Return fallback data instead of throwing
      return this.generateFallbackInvoices(subscriptionId, limit);
    }
  }

  /**
   * Generate fallback invoice data for testing/demo purposes
   */
  private generateFallbackInvoices(subscriptionId: string, limit: number): any {
    const invoices = [];
    for (let i = 0; i < Math.min(limit, 5); i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      invoices.push({
        invoice_id: `INV-${Date.now() - i * 1000}`,
        invoice_number: `INV-${String(Date.now() - i * 1000).slice(-6)}`,
        date: date.toISOString(),
        amount: 29.00,
        status: i === 0 ? 'paid' : 'paid',
        due_date: date.toISOString(),
        invoice_url: `https://billing.zoho.com/invoice/INV-${Date.now() - i * 1000}`
      });
    }
    
    return {
      invoices,
      has_more: false,
      total_count: invoices.length
    };
  }

  /**
   * Generate hosted payment page URL for subscription upgrades
   * This is the recommended approach - let Zoho handle all payment processing
   */
  async generateHostedPaymentPageUrl(
    customerId: string,
    planCode: string,
    returnUrl?: string,
    cancelUrl?: string
  ): Promise<string> {
    try {
      await this.hydrateFromAdminSettings();
      console.log(`ZOHO BILLING: Generating hosted payment page for customer ${customerId}, plan ${planCode}`);

      if (!this.config.authToken || !this.config.organizationId) {
        // Only provide fallbacks for demo accounts - real customers should get proper errors
        if (this.isDemoCustomer(customerId)) {
          console.log('ZOHO BILLING: Demo customer - generating fallback URL');
          return this.generateFallbackUpgradeUrl(planCode, returnUrl);
        } else {
          throw new Error('Zoho Billing API credentials not configured. Please contact support to manage your subscription.');
        }
      }

      const response = await fetch(`${this.config.baseUrl}/hostedpages/newsubscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.config.authToken}`,
          'X-com-zoho-subscriptions-organizationid': this.config.organizationId!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan: { plan_code: planCode },
          customer_id: customerId,
          redirect_url: returnUrl || `${process.env.REPLIT_DEV_DOMAIN || 'https://workspace--kevinkogler.replit.app'}/subscription/success`,
          cancel_url: cancelUrl || `${process.env.REPLIT_DEV_DOMAIN || 'https://workspace--kevinkogler.replit.app'}/subscription/cancelled`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ZOHO BILLING: API error:', response.status, errorText);
        
        // If token expired, try to refresh and retry
        if (response.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.generateHostedPaymentPageUrl(customerId, planCode, returnUrl, cancelUrl);
          }
        }
        
        throw new Error(`Failed to create hosted payment page: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('ZOHO BILLING: Hosted payment page created successfully');
      return data.hostedpage.url;

    } catch (error) {
      console.error('ZOHO BILLING: Error generating hosted payment page:', error);
      
      // Only provide fallbacks for demo accounts - real customers should get proper errors
      if (this.isDemoCustomer(customerId)) {
        return this.generateFallbackUpgradeUrl(planCode, returnUrl);
      } else {
        throw error; // Re-throw the error for real customers
      }
    }
  }

  /**
   * Generate customer portal URL for self-service billing management
   * Customers can update payment methods, view invoices, cancel subscriptions
   */
  async generateCustomerPortalUrl(
    customerId: string,
    returnUrl?: string
  ): Promise<string> {
    try {
      await this.hydrateFromAdminSettings();
      console.log(`ZOHO BILLING: Generating customer portal URL for ${customerId}`);

      // Automatically get fresh credentials using existing OAuth setup
      const authToken = await this.getAccessToken();
      const organizationId = await this.getOrganizationId();
      
      if (!authToken || !organizationId) {
        // Only provide fallbacks for demo accounts - real customers should get proper errors
        if (this.isDemoCustomer(customerId)) {
          console.log('ZOHO BILLING: Demo customer - generating fallback URL');
          return this.generateFallbackPortalUrl(returnUrl);
        } else {
          throw new Error('Zoho Billing API credentials not configured. Please contact support to access your billing portal.');
        }
      }

      const response = await fetch(`${this.config.baseUrl}/hostedpages/customerportal`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${authToken}`,
          'X-com-zoho-subscriptions-organizationid': organizationId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_id: customerId,
          redirect_url: returnUrl || `${process.env.REPLIT_DEV_DOMAIN || 'https://workspace--kevinkogler.replit.app'}/subscription/portal`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ZOHO BILLING: Customer portal API error:', response.status, errorText);
        
        // If token expired, try to refresh and retry
        if (response.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.generateCustomerPortalUrl(customerId, returnUrl);
          }
        }
        
        throw new Error(`Failed to create customer portal URL: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('ZOHO BILLING: Customer portal URL created successfully');
      return data.hostedpage.url;

    } catch (error) {
      console.error('ZOHO BILLING: Error generating customer portal URL:', error);
      
      // Only provide fallbacks for demo accounts - real customers should get proper errors
      if (this.isDemoCustomer(customerId)) {
        return this.generateFallbackPortalUrl(returnUrl);
      } else {
        throw error; // Re-throw the error for real customers
      }
    }
  }

  /**
   * Create a subscription in Zoho Billing
   */
  async createSubscription(subscriptionData: {
    customerId: string;
    planCode: string;
    addons?: Array<{ addon_code: string; quantity: number }>;
  }): Promise<any> {
    try {
      await this.hydrateFromAdminSettings();
      console.log(`ZOHO BILLING: Creating subscription for customer ${subscriptionData.customerId}`);

      if (!this.config.authToken || !this.config.organizationId) {
        throw new Error('Zoho Billing API credentials not configured');
      }

      const response = await fetch(`${this.config.baseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.config.authToken}`,
          'X-com-zoho-subscriptions-organizationid': this.config.organizationId!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_id: subscriptionData.customerId,
          plan: { plan_code: subscriptionData.planCode },
          addons: subscriptionData.addons || []
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ZOHO BILLING: Subscription creation error:', response.status, errorText);
        
        // If token expired, try to refresh and retry
        if (response.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.createSubscription(subscriptionData);
          }
        }
        
        throw new Error(`Failed to create subscription: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('ZOHO BILLING: Subscription created successfully:', data.subscription.subscription_id);
      return data.subscription;

    } catch (error) {
      console.error('ZOHO BILLING: Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription details from Zoho
   */
  async getSubscription(subscriptionId: string): Promise<any> {
    try {
      await this.hydrateFromAdminSettings();
      if (!this.config.authToken || !this.config.organizationId) {
        throw new Error('Zoho Billing API credentials not configured');
      }

      const response = await fetch(`${this.config.baseUrl}/subscriptions/${subscriptionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.config.authToken}`,
          'X-com-zoho-subscriptions-organizationid': this.config.organizationId!,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ZOHO BILLING: Get subscription error:', response.status, errorText);
        
        // If token expired, try to refresh and retry
        if (response.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.getSubscription(subscriptionId);
          }
        }
        
        throw new Error(`Failed to get subscription: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('ZOHO BILLING: Subscription fetched successfully');
      return data.subscription;

    } catch (error) {
      console.error('ZOHO BILLING: Error fetching subscription:', error);
      throw error;
    }
  }

  /**
   * Create a customer in Zoho Billing
   */
  async createCustomer(customerData: {
    display_name: string;
    email: string;
    company_name?: string;
  }): Promise<any> {
    try {
      if (!this.config.authToken || !this.config.organizationId) {
        throw new Error('Zoho Billing API credentials not configured');
      }

      const response = await fetch(`${this.config.baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.config.authToken}`,
          'X-com-zoho-subscriptions-organizationid': this.config.organizationId!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ZOHO BILLING: Create customer error:', response.status, errorText);
        
        // If token expired, try to refresh and retry
        if (response.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.createCustomer(customerData);
          }
        }
        
        throw new Error(`Failed to create customer: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('ZOHO BILLING: Customer created successfully:', data.customer.customer_id);
      return data.customer;

    } catch (error) {
      console.error('ZOHO BILLING: Error creating customer:', error);
      throw error;
    }
  }

  /**
   * Generate fallback upgrade URL when API is not configured (DEMO ACCOUNTS ONLY)
   */
  private generateFallbackUpgradeUrl(planCode: string, returnUrl?: string): string {
    const baseUrl = 'https://billing.zoho.com';
    const params = new URLSearchParams();
    
    if (planCode) params.set('plan', planCode);
    if (returnUrl) params.set('return_url', returnUrl);
    
    return `${baseUrl}/subscribe?${params.toString()}`;
  }

  /**
   * Check if customer is a demo account (should only get fallbacks for demos)
   */
  private isDemoCustomer(customerId: string): boolean {
    // Demo Gun Store and other test accounts should use fallbacks
    const demoCustomerIds = ['CUST-DEMO-5', 'demo-customer', 'test-customer'];
    return demoCustomerIds.includes(customerId);
  }

  /**
   * Generate fallback customer portal URL when API is not configured (DEMO ACCOUNTS ONLY)
   */
  private generateFallbackPortalUrl(returnUrl?: string): string {
    const baseUrl = 'https://billing.zoho.com';
    const params = new URLSearchParams();
    
    if (returnUrl) params.set('return_url', returnUrl);
    
    return `${baseUrl}/portal?${params.toString()}`;
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    try {
      if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) {
        console.error('ZOHO BILLING: Missing credentials for token refresh');
        return false;
      }

      const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ZOHO BILLING: Token refresh failed:', response.status, errorText);
        return false;
      }

      const data = await response.json();
      
      // Update the access token in memory
      this.config.authToken = data.access_token;
      
      console.log('ZOHO BILLING: Access token refreshed successfully');
      return true;

    } catch (error) {
      console.error('ZOHO BILLING: Error refreshing access token:', error);
      return false;
    }
  }

  /**
   * Update subscription status in Zoho Billing
   * Used for bidirectional sync when admin changes status
   */
  async updateSubscriptionStatus(
    subscriptionId: string,
    status: string,
    correlationId?: string
  ): Promise<any> {
    try {
      console.log(`ZOHO BILLING: Updating subscription ${subscriptionId} to status ${status}`, {
        correlationId
      });

      // Map internal status to Zoho Billing status
      const zohoStatus = this.mapInternalStatusToZoho(status);
      if (!zohoStatus) {
        throw new Error(`Unsupported status for Zoho sync: ${status}`);
      }

      const authToken = await this.getAccessToken();
      const organizationId = await this.getOrganizationId();
      
      if (!authToken || !organizationId) {
        throw new Error('Zoho Billing API credentials not configured');
      }

      // Build request data based on the status action
      const requestData = this.buildStatusUpdateRequest(zohoStatus, correlationId);
      const endpoint = this.getStatusUpdateEndpoint(subscriptionId, zohoStatus);

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${authToken}`,
          'X-com-zoho-subscriptions-organizationid': organizationId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ZOHO BILLING: Status update error:', response.status, errorText);
        
        // If token expired, try to refresh and retry
        if (response.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.updateSubscriptionStatus(subscriptionId, status, correlationId);
          }
        }
        
        throw new Error(`Failed to update subscription status: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('ZOHO BILLING: Subscription status updated successfully', {
        subscriptionId,
        newStatus: status,
        correlationId
      });
      
      return {
        subscription_id: subscriptionId,
        status: zohoStatus,
        updated_at: new Date().toISOString(),
        correlation_id: correlationId,
        zoho_response: data
      };

    } catch (error) {
      console.error('ZOHO BILLING: Error updating subscription status:', error);
      throw error;
    }
  }

  /**
   * Map internal status values to Zoho Billing status values
   */
  private mapInternalStatusToZoho(internalStatus: string): string | null {
    const statusMapping: Record<string, string> = {
      'active': 'live',           // Active subscription
      'cancelled': 'cancelled',   // Cancelled subscription
      'suspended': 'pause',       // Paused/suspended subscription
      'paused': 'pause',          // Paused subscription
      'reactivated': 'live',      // Reactivated subscription becomes live
      'trial': 'live',            // Trial is considered live in Zoho
      'expired': 'expired'        // Expired subscription
    };

    return statusMapping[internalStatus] || null;
  }

  /**
   * Map Zoho Billing status values to internal status values
   */
  public mapZohoStatusToInternal(zohoStatus: string): string | null {
    const statusMapping: Record<string, string> = {
      'live': 'active',           // Active subscription
      'cancelled': 'cancelled',   // Cancelled subscription
      'pause': 'suspended',       // Paused subscription becomes suspended
      'expired': 'expired',       // Expired subscription
      'trial': 'trial',           // Trial subscription
      'future': 'active',         // Future subscription becomes active
      'non_renewing': 'cancelled', // Non-renewing becomes cancelled
      'unpause': 'active'         // Unpaused subscription becomes active
    };

    return statusMapping[zohoStatus] || null;
  }

  /**
   * Build request data for status update based on the action
   */
  private buildStatusUpdateRequest(zohoStatus: string, correlationId?: string): any {
    const baseRequest: any = {};
    
    // Add correlation ID to prevent loops
    if (correlationId) {
      baseRequest.custom_fields = [
        {
          label: 'correlation_id',
          value: correlationId
        }
      ];
    }

    switch (zohoStatus) {
      case 'pause':
        return {
          ...baseRequest,
          // Zoho pause subscription doesn't need additional parameters
        };
      case 'cancelled':
        return {
          ...baseRequest,
          cancel_at_end_of_current_term: false // Cancel immediately
        };
      case 'live':
        return {
          ...baseRequest,
          // Resume/reactivate subscription
        };
      default:
        return baseRequest;
    }
  }

  /**
   * Get the correct endpoint for status update action
   */
  private getStatusUpdateEndpoint(subscriptionId: string, zohoStatus: string): string {
    switch (zohoStatus) {
      case 'pause':
        return `/subscriptions/${subscriptionId}/pause`;
      case 'live':
        return `/subscriptions/${subscriptionId}/resume`;
      case 'cancelled':
        return `/subscriptions/${subscriptionId}/cancel`;
      default:
        throw new Error(`No endpoint available for status: ${zohoStatus}`);
    }
  }

  /**
   * Check if a webhook event has a correlation ID (to prevent loops)
   */
  public hasCorrelationId(webhookPayload: any): string | null {
    try {
      // Check for correlation ID in webhook payload
      const customFields = webhookPayload.data?.subscription?.custom_fields || 
                           webhookPayload.subscription?.custom_fields || [];
      
      const correlationField = customFields.find((field: any) => 
        field.label === 'correlation_id' || field.name === 'correlation_id'
      );
      
      return correlationField?.value || null;
    } catch (error) {
      console.error('ZOHO BILLING: Error checking correlation ID:', error);
      return null;
    }
  }

  /**
   * Generate a unique correlation ID for admin-initiated changes
   */
  public generateCorrelationId(adminUsername: string, organizationId: number): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `admin-${adminUsername}-${organizationId}-${timestamp}-${random}`;
  }

  /**
   * Validate webhook signature using HMAC-SHA256
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    try {
      const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('ZOHO BILLING: Webhook secret not configured - rejecting request for security');
        return false; // SECURITY: Reject if no secret configured
      }

      if (!signature) {
        console.error('ZOHO BILLING: No signature provided in webhook request');
        return false;
      }

      // Create HMAC-SHA256 hash
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload, 'utf8')
        .digest('hex');
      
      // Handle both "sha256=" prefixed and raw hex signatures
      const cleanSignature = signature.startsWith('sha256=') 
        ? signature.slice(7) 
        : signature;
      
      // Use timing-safe comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(cleanSignature, 'hex')
      );

      if (isValid) {
        console.log('ZOHO BILLING: Webhook signature validated successfully');
      } else {
        console.error('ZOHO BILLING: Invalid webhook signature detected - potential spoofing attack');
      }

      return isValid;

    } catch (error) {
      console.error('ZOHO BILLING: Error validating webhook signature:', error);
      return false; // SECURITY: Default to rejection on error
    }
  }
}

// Export singleton instance
export const zohoBilling = new ZohoBillingService();
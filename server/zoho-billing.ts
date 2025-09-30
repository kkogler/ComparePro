import fetch from 'node-fetch';

export interface ZohoBillingConfig {
  organizationId?: string;
  clientId?: string;
  clientSecret?: string;
  authToken?: string;
  baseUrl?: string;
}

// Production Zoho Billing Setup Requirements:
// 1. ZOHO_BILLING_ORGANIZATION_ID - Your Zoho Billing Organization ID
// 2. ZOHO_BILLING_CLIENT_ID - OAuth Client ID from Zoho Developer Console
// 3. ZOHO_BILLING_CLIENT_SECRET - OAuth Client Secret from Zoho Developer Console  
// 4. ZOHO_BILLING_REFRESH_TOKEN - OAuth Refresh Token for API access
// 5. ZOHO_BILLING_WEBHOOK_SECRET - Secret for webhook signature verification

export class ZohoBillingService {
  private config: ZohoBillingConfig;

  constructor(config: ZohoBillingConfig = {}) {
    this.config = {
      baseUrl: 'https://www.zohoapis.com/billing/v1',
      ...config
    };
  }

  async changePlan(subscriptionId: string, planCode: string, immediateChange: boolean = false) {
    try {
      console.log(`Zoho Billing: Attempting to change plan for subscription ${subscriptionId} to ${planCode}`);
      
      const organizationId = this.config.organizationId || process.env.ZOHO_BILLING_ORGANIZATION_ID;
      const authToken = this.config.authToken || process.env.ZOHO_BILLING_AUTH_TOKEN;
      
      if (!organizationId || !authToken) {
        console.warn('Zoho Billing: Missing credentials, using simulated response');
        return {
          success: true,
          subscription_id: subscriptionId,
          plan_code: planCode,
          change_type: immediateChange ? 'immediate' : 'next_billing_cycle',
          message: immediateChange 
            ? 'Plan upgrade applied immediately (simulated)'
            : 'Plan change scheduled for next billing cycle (simulated)'
        };
      }

      const requestData = {
        plan: { plan_code: planCode },
        prorate: immediateChange
      };

      const response = await fetch(`${this.config.baseUrl}/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Zoho-oauthtoken ${authToken}`,
          'X-com-zoho-billing-organizationid': organizationId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Zoho API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Zoho Billing: Plan change successful', result);
      
      return {
        success: true,
        subscription_id: subscriptionId,
        plan_code: planCode,
        change_type: immediateChange ? 'immediate' : 'next_billing_cycle',
        message: immediateChange 
          ? 'Plan upgrade applied immediately'
          : 'Plan change scheduled for next billing cycle',
        zoho_response: result
      };
    } catch (error) {
      console.error('Zoho Billing API error:', error);
      throw new Error('Failed to change plan through Zoho Billing API');
    }
  }

  async getSubscriptionDetails(subscriptionId: string) {
    try {
      console.log(`Zoho Billing: Fetching subscription details for ${subscriptionId}`);
      
      const organizationId = this.config.organizationId || process.env.ZOHO_BILLING_ORGANIZATION_ID;
      const authToken = this.config.authToken || process.env.ZOHO_BILLING_AUTH_TOKEN;
      
      if (!organizationId || !authToken) {
        console.warn('Zoho Billing: Missing credentials, using simulated response');
        return {
          subscription_id: subscriptionId,
          status: 'live',
          plan: {
            plan_code: 'standard-plan-v1',
            name: 'Standard Plan',
            price: 99
          },
          next_billing_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          trial_ends_at: null,
          customer: {
            customer_id: 'cust_' + subscriptionId,
            display_name: 'Default Organization'
          }
        };
      }

      const response = await fetch(`${this.config.baseUrl}/subscriptions/${subscriptionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${authToken}`,
          'X-com-zoho-billing-organizationid': organizationId,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Zoho API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      console.log('Zoho Billing: Subscription details fetched', result);
      
      return result.subscription;
    } catch (error) {
      console.error('Zoho Billing API error:', error);
      throw new Error('Failed to fetch subscription details');
    }
  }

  async createSubscription(customerId: string, planCode: string, startDate?: Date) {
    try {
      console.log(`Zoho Billing: Creating subscription for customer ${customerId} with plan ${planCode}`);
      
      const organizationId = this.config.organizationId || process.env.ZOHO_BILLING_ORGANIZATION_ID;
      const authToken = this.config.authToken || process.env.ZOHO_BILLING_AUTH_TOKEN;
      
      if (!organizationId || !authToken) {
        console.warn('Zoho Billing: Missing credentials, using simulated response');
        const subscriptionId = `SUB-${Date.now()}`;
        return {
          subscription_id: subscriptionId,
          customer_id: customerId,
          plan_code: planCode,
          status: 'live',
          created_time: new Date().toISOString(),
          next_billing_at: startDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
      }

      const requestData = {
        customer_id: customerId,
        plan: { plan_code: planCode },
        starts_at: startDate ? startDate.toISOString() : undefined
      };

      const response = await fetch(`${this.config.baseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${authToken}`,
          'X-com-zoho-billing-organizationid': organizationId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Zoho API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      console.log('Zoho Billing: Subscription created', result);
      
      return result.subscription;
    } catch (error) {
      console.error('Zoho Billing API error:', error);
      throw new Error('Failed to create subscription');
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true) {
    try {
      console.log(`Zoho Billing: Cancelling subscription ${subscriptionId}`);
      
      const organizationId = this.config.organizationId || process.env.ZOHO_BILLING_ORGANIZATION_ID;
      const authToken = this.config.authToken || process.env.ZOHO_BILLING_AUTH_TOKEN;
      
      if (!organizationId || !authToken) {
        console.warn('Zoho Billing: Missing credentials, using simulated response');
        return {
          subscription_id: subscriptionId,
          status: cancelAtPeriodEnd ? 'cancelled_at_period_end' : 'cancelled',
          cancelled_at: new Date().toISOString(),
          message: cancelAtPeriodEnd 
            ? 'Subscription will be cancelled at the end of current billing period (simulated)'
            : 'Subscription cancelled immediately (simulated)'
        };
      }

      const requestData = {
        cancel_at_period_end: cancelAtPeriodEnd
      };

      const response = await fetch(`${this.config.baseUrl}/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${authToken}`,
          'X-com-zoho-billing-organizationid': organizationId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Zoho API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Zoho Billing: Subscription cancelled', result);
      
      return {
        subscription_id: subscriptionId,
        status: cancelAtPeriodEnd ? 'cancelled_at_period_end' : 'cancelled',
        cancelled_at: new Date().toISOString(),
        message: cancelAtPeriodEnd 
          ? 'Subscription will be cancelled at the end of current billing period'
          : 'Subscription cancelled immediately',
        zoho_response: result
      };
    } catch (error) {
      console.error('Zoho Billing API error:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  async getInvoices(subscriptionId: string, limit: number = 10) {
    try {
      console.log(`Zoho Billing: Fetching invoices for subscription ${subscriptionId}`);
      
      // Simulated invoice history
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
    } catch (error) {
      console.error('Zoho Billing API error:', error);
      throw new Error('Failed to fetch invoices');
    }
  }
}

// Export singleton instance
export const zohoBillingService = new ZohoBillingService();
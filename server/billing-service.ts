import { db } from './db';
import { companies, billingEvents, usageMetrics, users, stores, userStores, vendors, supportedVendors, retailVerticals } from '@shared/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';
import { storage } from './storage';
import { hashPassword } from './auth';
import type { InsertUser, InsertStore, InsertUserStore } from '@shared/schema';
import { zohoBilling } from './zoho-billing-service';
import { generateLoginUrl } from './secure-token-utils';
import { sendInviteEmail } from './email-service';
import { SUBSCRIPTION_STATUSES } from '@shared/subscription-config';
import { randomBytes } from 'crypto';

// Event deduplication cache interface
interface ProcessedEventCache {
  eventId: string;
  timestamp: number;
  provider: 'zoho' | 'recurly';
}

// Concurrency lock for webhook processing
interface WebhookLock {
  customerId: string;
  timestamp: number;
  promise: Promise<void>;
}

export interface BillingWebhookPayload {
  eventType: string;
  eventId: string;
  billingProvider: 'zoho' | 'recurly';
  data: any;
}

export class BillingService {
  // Concurrency locks to prevent race conditions (still needed for customer-level locking)
  private webhookLocks = new Map<string, WebhookLock>();
  
  // Company-level provisioning locks to prevent duplicate provisioning
  private concurrencyLocks = new Set<string>();
  
  // Lock timeout: 30 seconds (prevents indefinite locks)
  private readonly LOCK_TIMEOUT_MS = 30 * 1000;
  
  constructor() {
    // Database-based deduplication - no need for cache cleanup
  }
  
  // Process Zoho Billing webhooks with enhanced error handling and deduplication
  // Now accepts normalized payload from zoho-webhook-normalizer
  async processZohoWebhook(normalized: any): Promise<void> {
    const startTime = Date.now();
    console.log('🔔 BillingService: Processing normalized Zoho webhook', {
      timestamp: new Date().toISOString(),
      eventType: normalized.eventType,
      eventId: normalized.eventId
    });
    
    // Declare variables in scope accessible to both try and catch blocks
    let eventId: string = normalized.eventId;
    let billingEventRecord: any = null;
    const payload = normalized.rawPayload; // Keep for compatibility and error logging
    
    try {
      // Extract already-normalized data
      let eventType = normalized.eventType;
      let subscriptionData = normalized.subscription;
      let customerData = normalized.customer;
      
      // Validate required fields - be more lenient for unknown event types
      if (!eventType && !subscriptionData && !customerData) {
        console.warn('⚠️ Webhook payload missing identifiable data:', {
          eventType,
          hasSubscription: !!subscriptionData,
          hasCustomer: !!customerData
        });
        throw new Error('Missing event_type and data in normalized webhook payload');
      }

      console.log('🎯 Processing event:', {
        type: eventType || 'unknown',
        id: eventId,
        hasSubscriptionData: !!subscriptionData,
        hasCustomerData: !!customerData,
        inferredType: eventType || (subscriptionData ? 'subscription_event' : 'customer_event')
      });

      // Handle cases where eventType is null but we have subscription data
      // This handles Zoho's flattened webhook format
      if (!eventType && subscriptionData) {
        console.log('🔄 INFERRED EVENT: Treating as subscription_created due to subscription data');
        eventType = 'subscription_created';
      } else if (!eventType && customerData) {
        console.log('🔄 INFERRED EVENT: Treating as customer_created due to customer data');
        eventType = 'customer_created';
      }

      // Simplified: Process all valid webhooks without complex loop prevention
      
      // **DURABLE DEDUPLICATION CHECK**: Prevent processing the same event twice using database
      if (eventId) {
        const isAlreadyProcessed = await this.isEventAlreadyProcessedInDB(eventId, 'zoho');
        if (isAlreadyProcessed) {
          console.log('⚠️ BillingService: Event already processed in database, skipping', {
            eventType,
            eventId,
            timestamp: new Date().toISOString()
          });
          return; // Exit early - idempotent behavior
        }
        
        // Create billing event record to claim this event (database-level deduplication)
        // Only create if we can find a valid company to associate with
        const customerIdField = payload.data?.customer?.customer_id || payload.data?.subscription?.customer_id || payload.customer?.customer_id || payload.subscription?.customer_id;

        if (customerIdField) {
          // Ensure a company exists for this customer before creating the billing event record
          const [existingCompany] = await db
            .select({ id: companies.id })
            .from(companies)
            .where(eq(companies.billingCustomerId, customerIdField))
            .limit(1);

          if (existingCompany) {
            billingEventRecord = await this.createBillingEventRecord({
              eventType,
              eventId,
              billingProvider: 'zoho',
              data: payload
            });
          } else {
            console.log('ℹ️ BillingService: Company not found yet for customer, deferring billing event record creation', {
              eventType,
              eventId,
              customerId: customerIdField,
              timestamp: new Date().toISOString()
            });
          }
        } else {
          console.log('⚠️ BillingService: No customer ID found, skipping event record creation but continuing processing', {
            eventType,
            eventId,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Log the event with error handling
      try {
        if (eventId) {
          await this.logBillingEvent({
            eventType,
            eventId,
            billingProvider: 'zoho',
            data: payload
          });
        }
      } catch (logError) {
        console.error('⚠️ Failed to log billing event (continuing processing):', logError);
      }

      // Process event with individual error handling
      switch (eventType) {
        case 'customer_created':
          await this.safelyHandleEvent('customer_created', () => 
            this.handleCustomerCreated(customerData, 'zoho')
          );
          break;
        
        case 'subscription_created':
        case 'subscription_activation':
        case 'subscription_activated':
          // All Zoho subscription events treated the same way
          // Deduplication is handled at database level (see isEventAlreadyProcessedInDB)
          // Zoho may send different event names for the same subscription action
          await this.safelyHandleEvent(eventType, () => 
            this.handleSubscriptionCreated(
              subscriptionData || payload.data?.subscription,
              customerData || payload.data?.subscription?.customer,
              'zoho'
            )
          );
          break;
        case 'subscription_cancelled':
          await this.safelyHandleEvent('subscription_cancelled', () => 
            this.handleSubscriptionCancelled(subscriptionData || payload.data.subscription, 'zoho')
          );
          break;
        case 'subscription_reactivated':
          await this.safelyHandleEvent('subscription_reactivated', () => 
            this.handleSubscriptionReactivated(subscriptionData || payload.data.subscription, 'zoho')
          );
          break;
        case 'invoice_paid':
          await this.safelyHandleEvent('invoice_paid', () => 
            this.handleInvoicePaid(payload.data.invoice, 'zoho')
          );
          break;
        case 'invoice_payment_failed':
          await this.safelyHandleEvent('invoice_payment_failed', () => 
            this.handlePaymentFailed(payload.data.invoice, 'zoho')
          );
          break;
        case 'subscription_suspended':
          await this.safelyHandleEvent('subscription_suspended', () => 
            this.handleSubscriptionSuspended(subscriptionData || payload.data.subscription, 'zoho')
          );
          break;
        case 'subscription_expired':
          await this.safelyHandleEvent('subscription_expired', () => 
            this.handleSubscriptionExpired(subscriptionData || payload.data.subscription, 'zoho')
          );
          break;
        default:
          console.log(`⚠️ Unhandled Zoho event: ${eventType}`, {
            eventId,
            timestamp: new Date().toISOString()
          });
      }

      // **MARK AS PROCESSED**: Ensure billing event record exists and mark as processed
      if (eventId) {
        // If we didn't create the billing event record earlier (because company didn't exist),
        // try to create it now after processing has completed
        if (!billingEventRecord) {
          const customerIdField = payload.data?.customer?.customer_id || payload.data?.subscription?.customer_id || payload.customer?.customer_id || payload.subscription?.customer_id;
          
          if (customerIdField) {
            const [existingCompany] = await db
              .select({ id: companies.id })
              .from(companies)
              .where(eq(companies.billingCustomerId, customerIdField))
              .limit(1);
            
            if (existingCompany) {
              try {
                billingEventRecord = await this.createBillingEventRecord({
                  eventType,
                  eventId,
                  billingProvider: 'zoho',
                  data: payload
                });
                console.log('✅ BillingService: Created billing event record after processing');
              } catch (createError) {
                console.error('⚠️ BillingService: Failed to create billing event record after processing:', createError);
              }
            }
          }
        }
        
        // Now mark as processed if we have a record
        if (billingEventRecord) {
          await this.markEventAsProcessedInDB(billingEventRecord.id);
        } else {
          console.log('⚠️ BillingService: Event processed successfully but no billing event record to mark');
        }
      }
      
      const processingTime = Date.now() - startTime;
      console.log('✅ BillingService: Webhook processed successfully', {
        eventType,
        eventId,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // **ERROR HANDLING**: Mark billing event as failed so it can be retried (if we created a record)
      if (eventId && billingEventRecord) {
        await this.markEventAsFailedInDB(billingEventRecord.id, errorMessage);
      }
      
      console.error('❌ BillingService: Webhook processing failed', {
        error: errorMessage,
        stack: errorStack,
        payload: payload ? JSON.stringify(payload, null, 2) : 'undefined',
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      });
      throw error; // Re-throw for caller to handle (allows Zoho retries)
    }
  }

  // Helper method to safely handle individual events
  private async safelyHandleEvent(eventType: string, handler: () => Promise<void>): Promise<void> {
    try {
      await handler();
      console.log(`✅ Successfully processed ${eventType}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error(`❌ Failed to process ${eventType}:`, {
        error: errorMessage,
        stack: errorStack,
        eventType,
        timestamp: new Date().toISOString()
      });
      throw error; // Re-throw to maintain error propagation
    }
  }

  // Process Recurly webhooks
  async processRecurlyWebhook(payload: any): Promise<void> {
    const eventType = payload.notification_type;
    const eventId = payload.notification_id || payload.uuid;
    
    // Log the event
    await this.logBillingEvent({
      eventType,
      eventId,
      billingProvider: 'recurly',
      data: payload
    });

    switch (eventType) {
      case 'new_account_notification':
        await this.handleCustomerCreated(payload.account, 'recurly');
        break;
      case 'new_subscription_notification':
        await this.handleSubscriptionCreated(payload.subscription, null, 'recurly');
        break;
      case 'canceled_subscription_notification':
        await this.handleSubscriptionCancelled(payload.subscription, 'recurly');
        break;
      case 'reactivated_subscription_notification':
        await this.handleSubscriptionReactivated(payload.subscription, 'recurly');
        break;
      case 'successful_payment_notification':
        await this.handleInvoicePaid(payload.transaction, 'recurly');
        break;
      case 'failed_payment_notification':
        await this.handlePaymentFailed(payload.transaction, 'recurly');
        break;
      case 'expired_subscription_notification':
        await this.handleSubscriptionExpired(payload.subscription, 'recurly');
        break;
      default:
        console.log(`Unhandled Recurly event: ${eventType}`);
    }
  }

  /**
   * Manual subscription sync function to import missing subscriptions from Zoho
   * Fetches subscription details and processes them through the existing webhook system
   */
  async syncSubscriptionFromZoho(subscriptionId: string): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const startTime = Date.now();
    console.log('🔄 BillingService: Starting manual subscription sync', {
      subscriptionId,
      timestamp: new Date().toISOString()
    });

    try {
      // Step 1: Fetch subscription details from Zoho API
      console.log('📡 Fetching subscription details from Zoho API...');
      const subscriptionDetails = await zohoBilling.getSubscription(subscriptionId);
      
      if (!subscriptionDetails) {
        const errorMsg = `Subscription ${subscriptionId} not found in Zoho Billing`;
        console.error('❌ BillingService:', errorMsg);
        return {
          success: false,
          message: errorMsg
        };
      }

      console.log('✅ Subscription fetched successfully:', {
        subscriptionId: subscriptionDetails.subscription_id || subscriptionDetails.subscription_number,
        customerId: subscriptionDetails.customer_id,
        status: subscriptionDetails.status,
        planCode: subscriptionDetails.plan?.plan_code
      });

      // Step 2: Format subscription data as webhook payload
      const webhookPayload = {
        event_type: 'subscription_created',
        event_id: `manual-sync-${subscriptionId}-${Date.now()}`,
        data: {
          subscription: subscriptionDetails,
          customer: subscriptionDetails.customer
        }
      };

      console.log('🎯 Processing subscription through webhook system...');

      // Step 3: Process through existing webhook system for consistency
      await this.processZohoWebhook(webhookPayload);

      const processingTime = Date.now() - startTime;
      const successMsg = `Successfully synced subscription ${subscriptionId} for customer ${subscriptionDetails.customer?.display_name || subscriptionDetails.customer_id}`;
      
      console.log('✅ BillingService: Manual subscription sync completed successfully', {
        subscriptionId,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: successMsg,
        details: {
          subscriptionId: subscriptionDetails.subscription_id || subscriptionDetails.subscription_number,
          customerId: subscriptionDetails.customer_id,
          customerName: subscriptionDetails.customer?.display_name,
          planCode: subscriptionDetails.plan?.plan_code,
          status: subscriptionDetails.status,
          processingTimeMs: processingTime
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('❌ BillingService: Manual subscription sync failed', {
        subscriptionId,
        error: errorMessage,
        stack: errorStack,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        message: `Failed to sync subscription ${subscriptionId}: ${errorMessage}`,
        details: {
          error: errorMessage,
          processingTimeMs: processingTime
        }
      };
    }
  }

  private async logBillingEvent(event: BillingWebhookPayload): Promise<void> {
    // Find organization by billing customer ID
    // Match the same extraction logic as in routes.ts webhook handler (lines 7526-7529)
    const customerIdField = event.billingProvider === 'zoho' ? 
      event.data.customer_id || // Top level
      event.data.data?.customer_id || // One level down
      event.data.customer?.customer_id || // From customer object
      event.data.subscription?.customer_id : // From subscription object
      event.data.account?.account_code || event.data.subscription?.account?.account_code;

    if (!customerIdField) {
      console.error('⚠️ BillingService: No customer ID found in billing event, skipping event logging', {
        eventType: event.eventType,
        eventId: event.eventId,
        billingProvider: event.billingProvider,
        availableKeys: Object.keys(event.data || {})
      });
      return;
    }

    const [org] = await db
      .select()
      .from(companies)
      .where(eq(companies.billingCustomerId, customerIdField))
      .limit(1);

    if (!org) {
      console.error(`Company not found for customer ID: ${customerIdField}`);
      return;
    }

    await db.insert(billingEvents).values({
      companyId: org.id,
      eventType: event.eventType,
      billingProvider: event.billingProvider, // Add missing billingProvider field
      externalId: event.eventId,
      metadata: event.data,
      processed: false
    });
  }

  private async handleCustomerCreated(customer: any, provider: 'zoho' | 'recurly'): Promise<void> {
    // Validate customer data exists
    if (!customer) {
      console.warn('⚠️ handleCustomerCreated: No customer data provided, skipping customer creation');
      return;
    }

    const customerId = provider === 'zoho' ? customer.customer_id : customer.account_code;
    const email = provider === 'zoho' ? customer.email : customer.email;
    const name = provider === 'zoho' ? customer.display_name : customer.company_name || customer.first_name + ' ' + customer.last_name;

    // Validate required fields
    if (!customerId) {
      console.warn('⚠️ handleCustomerCreated: No customer ID found in customer data, skipping customer creation', {
        provider,
        customerKeys: Object.keys(customer || {})
      });
      return;
    }

    if (!email || !name) {
      console.warn('⚠️ handleCustomerCreated: Missing required fields (email or name), skipping customer creation', {
        provider,
        customerId,
        hasEmail: !!email,
        hasName: !!name
      });
      return;
    }

    // Check if company already exists
    const [existingOrg] = await db
      .select()
      .from(companies)
      .where(eq(companies.billingCustomerId, customerId))
      .limit(1);

    if (existingOrg) {
      console.log(`Company already exists for customer: ${customerId}`);
      return;
    }

    // Create new company
    const slug = this.generateSlug(name);
    const [newCompany] = await db.insert(companies).values({
      name,
      slug,
      email, // Store signup email for admin dashboard
      billingProvider: provider,
      billingCustomerId: customerId,
      status: 'active',
      plan: 'free' // Default to free trial
    }).returning();

    console.log(`Created company for ${provider} customer: ${customerId}`);
    
    // Auto-provision admin user and default store for new company
    try {
      await this.provisionCompanyOnboarding(newCompany.id, customer, provider);
    } catch (provisionError) {
      console.error(`⚠️ Failed to provision onboarding for company ${newCompany.id}:`, provisionError);
      // Don't throw - company creation succeeded, provisioning can be retried later
    }
  }

  private async handleSubscriptionCreated(subscription: any, customer: any = null, provider: 'zoho' | 'recurly'): Promise<void> {
    console.log('🎉 BillingService: Processing subscription_created', {
      hasSubscription: !!subscription,
      hasCustomer: !!customer,
      provider
    });
    
    // Track if provisioning was already completed to prevent duplicate calls
    let provisioningCompleted = false;
    
    // Enhanced logging for debugging
    console.log('🔍 SUBSCRIPTION DATA:', JSON.stringify(subscription, null, 2));
    console.log('🔍 CUSTOMER DATA:', JSON.stringify(customer, null, 2));
    
    // ENHANCED customer ID extraction with multiple fallbacks for Zoho payload formats
    let customerId = provider === 'zoho' ? 
      (subscription.customer_id || 
       customer?.customer_id || 
       subscription.customer?.customer_id ||
       subscription.contactpersons?.[0]?.contactperson_id) : 
      subscription.account.account_code;
    
    console.log('🔍 Customer ID extraction:', {
      'subscription.customer_id': subscription.customer_id,
      'customer?.customer_id': customer?.customer_id,
      'subscription.customer?.customer_id': subscription.customer?.customer_id,
      'subscription.contactpersons?.[0]?.contactperson_id': subscription.contactpersons?.[0]?.contactperson_id,
      'final customerId': customerId,
      'customerId valid': !!customerId
    });
    
    let subscriptionId = provider === 'zoho' ? (subscription.subscription_number || subscription.subscription_id) : subscription.uuid;
    const planCode = provider === 'zoho' ? subscription.plan?.plan_code : subscription.plan.plan_code;
    
    console.log('📊 Extracted subscription details:', { 
      customerId, 
      subscriptionId, 
      planCode,
      allValid: !!(customerId && subscriptionId && planCode)
    });
    
    // Enhanced validation with fallback processing instead of early exits
    if (!customerId) {
      console.error('⚠️ BillingService: No customer ID found, generating fallback customer ID');
      // Generate fallback customer ID to continue processing
      const fallbackCustomerId = `fallback-${subscriptionId || Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      console.log(`🔄 BillingService: Using fallback customer ID: ${fallbackCustomerId}`);
      
      // Try to extract customer ID from other locations
      customerId = subscription.customer?.customer_id || 
                   subscription.contactpersons?.[0]?.contactperson_id ||
                   subscription.customer_name?.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
                   fallbackCustomerId;
      
      console.log(`🔄 BillingService: Final customer ID: ${customerId}`);
    }
    
    if (!subscriptionId) {
      console.error('⚠️ BillingService: No subscription ID found, generating fallback subscription ID');
      subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      console.log(`🔄 BillingService: Using fallback subscription ID: ${subscriptionId}`);
    }
    
    // **CONCURRENCY PROTECTION**: Prevent race conditions for the same customer
    if (customerId) {
      await this.acquireWebhookLock(customerId);
    }
    
    try {

    const [org] = await db
      .select()
      .from(companies)
      .where(eq(companies.billingCustomerId, customerId))
      .limit(1);

    // **DUPLICATE SUBSCRIPTION PREVENTION**: Check if customer already has an active subscription
    if (org && org.status === 'active' && org.billingSubscriptionId) {
      console.error('🚨 DUPLICATE SUBSCRIPTION DETECTED', {
        existingCompanyId: org.id,
        existingCompanyName: org.name,
        existingSubscriptionId: org.billingSubscriptionId,
        newSubscriptionId: subscriptionId,
        customerId: customerId,
        customerEmail: customer?.email || subscription?.customer?.email
      });

      // Send alert email to admin
      try {
        const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'kevin.kogler@microbiz.com';
        const subject = '🚨 Duplicate Subscription Attempt Blocked';
        const html = `
          <h2>Duplicate Subscription Attempt Detected</h2>
          <p><strong>A customer tried to create a duplicate subscription. This was blocked by the system.</strong></p>
          
          <h3>Existing Subscription Details:</h3>
          <ul>
            <li><strong>Company:</strong> ${org.name}</li>
            <li><strong>Company ID:</strong> ${org.id}</li>
            <li><strong>Existing Subscription ID:</strong> ${org.billingSubscriptionId}</li>
            <li><strong>Status:</strong> ${org.status}</li>
            <li><strong>Plan:</strong> ${org.plan}</li>
          </ul>

          <h3>New Subscription Attempt Details:</h3>
          <ul>
            <li><strong>Customer ID:</strong> ${customerId}</li>
            <li><strong>New Subscription ID:</strong> ${subscriptionId}</li>
            <li><strong>Email:</strong> ${customer?.email || subscription?.customer?.email || 'N/A'}</li>
            <li><strong>Company Name:</strong> ${customer?.display_name || subscription?.customer?.display_name || 'N/A'}</li>
          </ul>

          <h3>Action Required:</h3>
          <p>Please configure Zoho Billing to prevent duplicate subscriptions per email address.</p>
          <p>Until then, the system will continue to block duplicate attempts and send these alerts.</p>
        `;
        
        const { sendEmail } = await import('./email-service');
        await sendEmail(adminEmail, subject, html);
        console.log('✅ BillingService: Sent duplicate subscription alert email');
      } catch (emailError) {
        console.error('⚠️ BillingService: Failed to send duplicate subscription alert:', emailError);
      }

      // Log the webhook event but don't process it
      await this.logBillingEvent({
        eventType: 'subscription_created',
        eventId: subscriptionId,
        billingProvider: provider,
        data: { subscription, customer, error: 'DUPLICATE_SUBSCRIPTION_BLOCKED' }
      });

      console.log('🛑 BillingService: Duplicate subscription blocked, webhook processing stopped');
      return; // Exit early - don't create duplicate company
    }

    if (!org) {
      console.log('🏗️ BillingService: Company not found, attempting to create new company...');
      
      // ENHANCED: Try to extract customer from multiple sources with extensive fallbacks
      let customerToUse = customer;
      if (!customerToUse) {
        console.log('🔍 BillingService: No customer data provided, trying to extract from subscription...');
        customerToUse = subscription.customer || 
                       subscription.contactpersons?.[0] || 
                       subscription.customer_data;
        
        // If still no customer data, create minimal customer object
        if (!customerToUse) {
          console.log('🔄 BillingService: Creating minimal customer object from available data...');
          customerToUse = {
            customer_id: customerId,
            display_name: subscription.customer_name || 
                         subscription.company_name || 
                         `Customer-${customerId}`,
            email: subscription.customer_email || 
                   subscription.email || 
                   `customer-${customerId}@subscription.local`,
            company_name: subscription.customer_name || subscription.company_name
          };
          console.log('✅ BillingService: Created minimal customer object:', customerToUse);
        }
      }
      
      // CRITICAL FIX: Extract phone from contactpersons if not in customer billing address
      if (customerToUse && provider === 'zoho') {
        const contactPhone = subscription.contactpersons?.[0]?.phone || 
                            subscription.contact_persons_associated?.[0]?.phone;
        
        if (contactPhone && !customerToUse.phone && !customerToUse.billing_address?.phone) {
          console.log(`📞 BillingService: Extracting phone from contactpersons: ${contactPhone}`);
          customerToUse.phone = contactPhone;
        }
        
        // Also ensure retail vertical is extracted from customer object
        if (!customerToUse.cf_retail_vertical && customerToUse.custom_field_hash?.cf_retail_vertical) {
          customerToUse.cf_retail_vertical = customerToUse.custom_field_hash.cf_retail_vertical;
          console.log(`📋 BillingService: Extracted retail vertical from custom_field_hash: ${customerToUse.cf_retail_vertical}`);
        }
      }
      
      // Try to create company with available customer data
      if (customerToUse) {
        try {
          await this.handleCustomerCreated(customerToUse, provider);
          
          // Get the newly created company
          const [newOrg] = await db
            .select()
            .from(companies)
            .where(eq(companies.billingCustomerId, customerId))
            .limit(1);
            
          if (newOrg) {
            console.log(`✅ BillingService: Created company ${newOrg.name} for customer ${customerId}`);
            
            // Auto-provision admin user and default store for newly created company
            try {
              // Extract and map retail vertical from Zoho custom fields
              if (provider === 'zoho' && customerToUse) {
                console.log('🔍 BillingService: Checking for retail vertical in customer data', {
                  'cf_retail_vertical': customerToUse.cf_retail_vertical,
                  'custom_fields': customerToUse.custom_fields,
                  'allKeys': Object.keys(customerToUse)
                });
                
                const retailVerticalField = customerToUse.cf_retail_vertical || 
                                            customerToUse.custom_fields?.retail_vertical ||
                                            customerToUse.custom_fields?.find((f: any) => 
                                              f.label?.toLowerCase().includes('retail') && 
                                              f.label?.toLowerCase().includes('vertical')
                                            )?.value ||
                                            customerToUse.retailVertical ||
                                            customerToUse.retail_vertical;
                
                if (retailVerticalField) {
                  console.log(`📋 BillingService: Extracting retail vertical from Zoho: "${retailVerticalField}"`);
                  const retailVerticalId = await this.mapRetailVerticalToId(retailVerticalField);
                  if (retailVerticalId) {
                    customerToUse.retailVerticalId = retailVerticalId;
                    console.log(`✅ BillingService: Mapped retail vertical "${retailVerticalField}" to ID: ${retailVerticalId}`);
                  } else {
                    console.warn(`⚠️ BillingService: Could not map retail vertical "${retailVerticalField}" to an ID`);
                  }
                } else {
                  console.warn('⚠️ BillingService: No retail vertical found in customer data, using default Firearms vertical');
                  // Default to Firearms (ID: 1) if no retail vertical is specified
                  customerToUse.retailVerticalId = 1;
                }
              }
              
              console.log('🚀 BillingService: Starting provisioning with customer data:', {
                hasRetailVerticalId: !!customerToUse.retailVerticalId,
                retailVerticalId: customerToUse.retailVerticalId,
                hasPhone: !!customerToUse.phone,
                hasEmail: !!customerToUse.email
              });
              
              await this.provisionCompanyOnboarding(newOrg.id, customerToUse, provider);
              provisioningCompleted = true; // Mark as completed to prevent duplicate calls
              console.log('✅ BillingService: Initial provisioning completed successfully');
            } catch (provisionError) {
              console.error(`⚠️ Failed to provision onboarding for company ${newOrg.id}:`, provisionError);
              // Don't throw - company and subscription creation succeeded, provisioning can be retried later
            }
          } else {
            console.error(`⚠️ BillingService: Failed to create company for subscription ${subscriptionId}, but continuing with subscription processing...`);
          }
        } catch (companyCreationError) {
          console.error(`⚠️ BillingService: Company creation failed for subscription ${subscriptionId}:`, companyCreationError);
          console.log('🔄 BillingService: Continuing with subscription processing despite company creation failure...');
        }
      } else {
        console.error(`⚠️ BillingService: No customer data available for subscription ${subscriptionId}, but continuing with subscription processing...`);
      }
    }

    // **UPSERT LOGIC**: Get current company (might be newly created)
    const [currentOrg] = await db
      .select()
      .from(companies)
      .where(eq(companies.billingCustomerId, customerId))
      .limit(1);

    if (!currentOrg) {
      console.error(`⚠️ BillingService: Company lookup failed for customer ${customerId}`);
      
      // SIMPLIFIED: Create minimal company record for subscription processing
      const fallbackCustomerData = customer || subscription.customer || subscription.contactpersons?.[0] || {};
      const companyName = fallbackCustomerData.display_name || 
                         fallbackCustomerData.company_name || 
                         fallbackCustomerData.name ||
                         `Company-${customerId}`;
      
      // Extract email for signup tracking
      const companyEmail = fallbackCustomerData.email || 
                          subscription.customer_email ||
                          subscription.email ||
                          null;
      
      const minimalCompanyData = {
        name: companyName,
        slug: this.generateSlug(companyName), // Generate proper slug from company name
        email: companyEmail, // Store signup email for admin dashboard
        plan: planCode || 'free',
        billingProvider: provider,
        billingCustomerId: customerId,
        billingSubscriptionId: subscriptionId,
        status: 'active'
      };
      
      try {
        const minimalCompany = await storage.createCompany(minimalCompanyData);
        console.log(`✅ BillingService: Created minimal company for subscription processing: ${minimalCompany.name}`);
      } catch (error) {
        console.error(`⚠️ BillingService: Failed to create minimal company:`, error);
        console.log('🔄 BillingService: Continuing anyway - subscription will be logged for manual review');
        // Continue processing - don't fail the entire webhook
      }
    }

    // **ENHANCED**: Get the final company (original or fallback) for processing
    const [finalOrg] = await db
      .select()
      .from(companies)
      .where(eq(companies.billingCustomerId, customerId))
      .limit(1);

    // **IDEMPOTENT UPDATE**: Check if subscription AND plan are already set to prevent duplicates
    const newPlan = this.mapPlanCode(planCode);
    if (finalOrg && finalOrg.billingSubscriptionId === subscriptionId && finalOrg.plan === newPlan) {
      console.log(`✅ BillingService: Subscription ${subscriptionId} with plan ${newPlan} already exists for company ${finalOrg.name}, skipping update`);
      return; // Idempotent - subscription and plan already processed
    }
    
    if (finalOrg && finalOrg.billingSubscriptionId === subscriptionId && finalOrg.plan !== newPlan) {
      console.log(`🔄 BillingService: Plan change detected for ${subscriptionId}: ${finalOrg.plan} → ${newPlan}`);
    }

    // Update company with subscription details (only if we have a company)
    if (finalOrg) {
      await db
        .update(companies)
        .set({
          billingSubscriptionId: subscriptionId,
          billingSubscriptionNumber: subscriptionId,  // Fix: Set subscription number for display
          plan: this.mapPlanCode(planCode),
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(companies.id, finalOrg.id));

      console.log(`✅ BillingService: Updated subscription for company: ${finalOrg.name}`);

      // CRITICAL: Create explicit subscription record in database
      try {
        console.log('📝 BillingService: Creating explicit subscription record...');
        await storage.createSubscription({
          companyId: finalOrg.id,
          externalSubscriptionId: subscriptionId,
          externalCustomerId: customerId,
          externalSubscriptionNumber: subscriptionId,
          planId: planCode || 'free',
          status: 'active',
          billingProvider: provider,
          currentPeriodStart: new Date(),
          currentPeriodEnd: subscription.next_billing_at ? 
            new Date(subscription.next_billing_at) : 
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
          amount: subscription.plan?.price?.toString() || 
                 (planCode === 'enterprise' ? '299' : planCode === 'standard' ? '99' : '0'),
          currency: subscription.currency_code || 'USD'
        });
        console.log(`✅ BillingService: Created subscription record for ${subscriptionId}`);
      } catch (subscriptionError) {
        console.error(`⚠️ BillingService: Failed to create subscription record:`, subscriptionError);
        // Don't fail the webhook - subscription processing continues
      }
    } else {
      console.error(`⚠️ BillingService: No company available to update for subscription ${subscriptionId} - logging for manual review`);
    }

    // **FIX CREATION DATE**: Ensure billing event exists for subscription creation date
    try {
      await this.createBillingEventRecord({
        eventType: 'subscription_created',
        eventId: `subscription-${subscriptionId}-${Date.now()}`,
        billingProvider: 'zoho',
        data: { subscription, customer }
      });
      console.log(`📝 Created billing event record for subscription creation`);
    } catch (eventError) {
      console.error('⚠️ Failed to create billing event record (non-critical):', eventError);
      // Don't fail the webhook - subscription update succeeded
    }

    // **CRITICAL FIX**: Provision admin user and default store for subscription creation
    // Only run if provisioning wasn't already completed (prevents duplicate calls and duplicate emails)
    if (finalOrg && !provisioningCompleted) {
      console.log('🔄 BillingService: Checking if provisioning already completed...');
      
      // **DATABASE CHECK**: See if this company was already provisioned
      // Check for existing admin users and stores as indicators of completed provisioning
      const [existingAdminUsers, existingStores] = await Promise.all([
        db.select({ id: users.id })
          .from(users)
          .where(and(
            eq(users.companyId, finalOrg.id),
            eq(users.role, 'admin')
          ))
          .limit(1),
        db.select({ id: stores.id })
          .from(stores)
          .where(eq(stores.companyId, finalOrg.id))
          .limit(1)
      ]);
      
      if (existingAdminUsers.length > 0 && existingStores.length > 0) {
        console.log('✅ BillingService: Provisioning already completed (admin user and store exist), skipping duplicate provisioning');
        provisioningCompleted = true; // Update flag for consistency
      } else {
        console.log('🔄 BillingService: Running provisioning (company existed or first provisioning failed)');
        try {
          const customerForProvisioning = customer || subscription.customer || subscription.contactpersons?.[0];
          
          // Extract and map retail vertical from Zoho custom fields
          if (provider === 'zoho' && customerForProvisioning) {
            const retailVerticalField = customerForProvisioning.cf_retail_vertical || 
                                        customerForProvisioning.custom_fields?.retail_vertical ||
                                        customerForProvisioning.custom_fields?.find((f: any) => 
                                          f.label?.toLowerCase().includes('retail') && 
                                          f.label?.toLowerCase().includes('vertical')
                                        )?.value;
            
            if (retailVerticalField) {
              console.log(`📋 Extracting retail vertical from Zoho: "${retailVerticalField}"`);
              const retailVerticalId = await this.mapRetailVerticalToId(retailVerticalField);
              if (retailVerticalId) {
                customerForProvisioning.retailVerticalId = retailVerticalId;
              }
            }
          }
          
          await this.provisionCompanyOnboarding(finalOrg.id, customerForProvisioning, provider);
        } catch (provisioningError) {
          console.error('⚠️ BillingService: Failed to provision company onboarding (subscription continues)', {
            companyId: finalOrg.id,
            companyName: finalOrg.name,
            error: provisioningError instanceof Error ? provisioningError.message : String(provisioningError)
          });
          // Don't fail the webhook - subscription processing continues even if provisioning fails
        }
      }
    } else if (provisioningCompleted) {
      console.log('✅ BillingService: Skipping duplicate provisioning - already completed successfully');
    } else {
      console.error(`⚠️ BillingService: No company available for onboarding provisioning for subscription ${subscriptionId}`);
    }
    
    } finally {
      // **RELEASE LOCK**: Always release the concurrency lock
      if (customerId) {
        this.releaseWebhookLock(customerId);
      }
    }
  }

  private async handleSubscriptionCancelled(subscription: any, provider: 'zoho' | 'recurly'): Promise<void> {
    const customerId = provider === 'zoho' ? subscription.customer_id : subscription.account.account_code;

    const [org] = await db
      .select()
      .from(companies)
      .where(eq(companies.billingCustomerId, customerId))
      .limit(1);

    if (!org) {
      console.error(`Company not found for cancelled subscription`);
      return;
    }

    // Cancel company subscription
    await db
      .update(companies)
      .set({
        status: SUBSCRIPTION_STATUSES.CANCELLED,
        updatedAt: new Date()
      })
      .where(eq(companies.id, org.id));

    console.log(`🚫 BillingService: Cancelled subscription for company: ${org.name}`, {
      companyId: org.id,
      companyName: org.name,
      previousStatus: org.status,
      newStatus: SUBSCRIPTION_STATUSES.CANCELLED,
      provider,
      timestamp: new Date().toISOString()
    });
  }

  private async handleSubscriptionReactivated(subscription: any, provider: 'zoho' | 'recurly'): Promise<void> {
    const customerId = provider === 'zoho' ? subscription.customer_id : subscription.account.account_code;

    const [org] = await db
      .select()
      .from(companies)
      .where(eq(companies.billingCustomerId, customerId))
      .limit(1);

    if (!org) {
      console.error(`Company not found for reactivated subscription`);
      return;
    }

    // Reactivate company
    await db
      .update(companies)
      .set({
        status: SUBSCRIPTION_STATUSES.ACTIVE,
        updatedAt: new Date()
      })
      .where(eq(companies.id, org.id));

    console.log(`✅ BillingService: Reactivated subscription for company: ${org.name}`, {
      companyId: org.id,
      companyName: org.name,
      previousStatus: org.status,
      newStatus: SUBSCRIPTION_STATUSES.ACTIVE,
      provider,
      timestamp: new Date().toISOString()
    });
  }

  private async handleInvoicePaid(invoice: any, provider: 'zoho' | 'recurly'): Promise<void> {
    const customerId = provider === 'zoho' ? 
      invoice.customer_id || invoice.subscription?.customer_id :
      invoice.account?.account_code;
    
    console.log(`💰 BillingService: Payment received from ${provider}`, {
      invoiceId: provider === 'zoho' ? invoice.invoice_id : invoice.uuid,
      customerId,
      amount: provider === 'zoho' ? invoice.total : invoice.total_in_cents,
      currency: provider === 'zoho' ? invoice.currency_code : invoice.currency,
      provider,
      timestamp: new Date().toISOString()
    });
    
    // If company was previously suspended due to payment failure, reactivate it
    if (customerId) {
      const [org] = await db
        .select()
        .from(companies)
        .where(eq(companies.billingCustomerId, customerId))
        .limit(1);

      if (org && org.status === SUBSCRIPTION_STATUSES.SUSPENDED) {
        await db
          .update(companies)
          .set({
            status: SUBSCRIPTION_STATUSES.ACTIVE,
            updatedAt: new Date()
          })
          .where(eq(companies.id, org.id));

        console.log(`✅ BillingService: Reactivated company after payment: ${org.name}`, {
          companyId: org.id,
          companyName: org.name,
          previousStatus: SUBSCRIPTION_STATUSES.SUSPENDED,
          newStatus: SUBSCRIPTION_STATUSES.ACTIVE,
          provider,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  private async handlePaymentFailed(invoice: any, provider: 'zoho' | 'recurly'): Promise<void> {
    const customerId = provider === 'zoho' ? 
      invoice.customer_id || invoice.subscription?.customer_id :
      invoice.account?.account_code;
    
    console.log(`❌ BillingService: Payment failed from ${provider}`, {
      invoiceId: provider === 'zoho' ? invoice.invoice_id : invoice.uuid,
      customerId,
      amount: provider === 'zoho' ? invoice.total : invoice.total_in_cents,
      currency: provider === 'zoho' ? invoice.currency_code : invoice.currency,
      provider,
      timestamp: new Date().toISOString()
    });

    if (!customerId) {
      console.error('❌ BillingService: No customer ID found in failed payment invoice');
      return;
    }

    const [org] = await db
      .select()
      .from(companies)
      .where(eq(companies.billingCustomerId, customerId))
      .limit(1);

    if (!org) {
      console.error(`❌ BillingService: Company not found for failed payment, customer ID: ${customerId}`);
      return;
    }

    // Suspend company due to payment failure
    await db
      .update(companies)
      .set({
        status: SUBSCRIPTION_STATUSES.SUSPENDED,
        updatedAt: new Date()
      })
      .where(eq(companies.id, org.id));

    console.log(`⚠️ BillingService: Suspended company due to payment failure: ${org.name}`, {
      companyId: org.id,
      companyName: org.name,
      previousStatus: org.status,
      newStatus: SUBSCRIPTION_STATUSES.SUSPENDED,
      provider,
      invoiceId: provider === 'zoho' ? invoice.invoice_id : invoice.uuid,
      timestamp: new Date().toISOString()
    });
  }

  private async handleSubscriptionSuspended(subscription: any, provider: 'zoho' | 'recurly'): Promise<void> {
    const customerId = provider === 'zoho' ? subscription.customer_id : subscription.account.account_code;

    const [org] = await db
      .select()
      .from(companies)
      .where(eq(companies.billingCustomerId, customerId))
      .limit(1);

    if (!org) {
      console.error(`🚫 BillingService: Company not found for suspended subscription`);
      return;
    }

    // Suspend company
    await db
      .update(companies)
      .set({
        status: SUBSCRIPTION_STATUSES.SUSPENDED,
        updatedAt: new Date()
      })
      .where(eq(companies.id, org.id));

    console.log(`⏸️ BillingService: Suspended subscription for company: ${org.name}`, {
      companyId: org.id,
      companyName: org.name,
      previousStatus: org.status,
      newStatus: SUBSCRIPTION_STATUSES.SUSPENDED,
      provider,
      subscriptionId: provider === 'zoho' ? (subscription.subscription_number || subscription.subscription_id) : subscription.uuid,
      timestamp: new Date().toISOString()
    });
  }

  private async handleSubscriptionExpired(subscription: any, provider: 'zoho' | 'recurly'): Promise<void> {
    const customerId = provider === 'zoho' ? subscription.customer_id : subscription.account.account_code;

    const [org] = await db
      .select()
      .from(companies)
      .where(eq(companies.billingCustomerId, customerId))
      .limit(1);

    if (!org) {
      console.error(`🚫 BillingService: Company not found for expired subscription`);
      return;
    }

    // Set company status to expired
    await db
      .update(companies)
      .set({
        status: SUBSCRIPTION_STATUSES.EXPIRED,
        updatedAt: new Date()
      })
      .where(eq(companies.id, org.id));

    console.log(`⏰ BillingService: Expired subscription for company: ${org.name}`, {
      companyId: org.id,
      companyName: org.name,
      previousStatus: org.status,
      newStatus: SUBSCRIPTION_STATUSES.EXPIRED,
      provider,
      subscriptionId: provider === 'zoho' ? (subscription.subscription_number || subscription.subscription_id) : subscription.uuid,
      timestamp: new Date().toISOString()
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  private mapPlanCode(planCode: string): string {
    // Map external plan codes to internal plan names
    const planMapping: Record<string, string> = {
      // Legacy mappings
      'basic-monthly': 'basic',
      'basic-annual': 'basic',
      'pro-monthly': 'professional', 
      'pro-annual': 'professional',
      'enterprise-monthly': 'enterprise',
      'enterprise-annual': 'enterprise',
      // Zoho plan mappings
      'free-plan-v1': 'free',
      'free': 'free',
      'trial': 'free',
      'standard-plan-v1': 'standard',
      'enterprise-plan-v1': 'enterprise'
    };

    console.log(`🗺️ Plan mapping: "${planCode}" -> "${planMapping[planCode] || 'free'}" (was ${planMapping[planCode] ? 'mapped' : 'default'})`);
    return planMapping[planCode] || 'free'; // Default to free plan instead of basic
  }

  // Helper: Map retail vertical name from Zoho to database ID
  private async mapRetailVerticalToId(retailVerticalName: string): Promise<number | null> {
    if (!retailVerticalName) return null;
    
    try {
      // Normalize the input
      const normalizedName = retailVerticalName.toLowerCase().trim();
      
      // Query retail_verticals table
      const [vertical] = await db
        .select()
        .from(retailVerticals)
        .where(sql`LOWER(name) = ${normalizedName}`)
        .limit(1);
      
      if (vertical) {
        console.log(`✅ Mapped retail vertical "${retailVerticalName}" to ID ${vertical.id}`);
        return vertical.id;
      } else {
        console.log(`⚠️ No retail vertical found for "${retailVerticalName}"`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error mapping retail vertical "${retailVerticalName}":`, error);
      return null;
    }
  }

  // Auto-provision admin user and default store for new company
  // Enhanced to accept full customer data including address, timezone, retail vertical
  async provisionCompanyOnboarding(companyId: number, customerData: any, provider: 'zoho' | 'recurly'): Promise<void> {
    console.log('🚀 BillingService: Starting company onboarding provisioning', {
      companyId,
      provider,
      customerEmail: provider === 'zoho' ? customerData?.email : customerData?.email,
      timezone: customerData?.timezone,
      retailVerticalId: customerData?.retailVerticalId,
      timestamp: new Date().toISOString()
    });

    // **CRITICAL FIX**: Acquire company-level lock to prevent concurrent provisioning
    const lockKey = `provision-company-${companyId}`;
    if (this.concurrencyLocks.has(lockKey)) {
      console.log(`⏳ BillingService: Provisioning already in progress for company ${companyId}, skipping duplicate request`);
      return;
    }
    
    this.concurrencyLocks.add(lockKey);
    console.log(`🔒 BillingService: Acquired provisioning lock for company ${companyId}`);

    try {
      // Start a database transaction to ensure atomicity
      await db.transaction(async (tx) => {
        // **RESUMABLE PROVISIONING**: Check each component independently and create what's missing
        
        // Extract customer information based on provider (moved to proper scope)
        const email = provider === 'zoho' ? customerData?.email : customerData?.email;
        const displayName = provider === 'zoho' ? 
          customerData?.display_name || customerData?.company_name :
          customerData?.company_name || `${customerData?.first_name || ''} ${customerData?.last_name || ''}`.trim();
        
        // Generate username from email (part before @)
        const username = email ? email.split('@')[0] : 'admin';
        
        // 1. Check if user exists GLOBALLY by email (Option 1: Global email uniqueness)
        let existingUserGlobally;
        if (email) {
          const globalUsers = await tx
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          existingUserGlobally = globalUsers[0];
        }

        // 2. Check if this user is already an admin for THIS company
        const existingAdminsInCompany = await tx
          .select({ id: users.id, username: users.username, email: users.email })
          .from(users)
          .where(and(
            eq(users.companyId, companyId),
            eq(users.role, 'admin')
          ))
          .limit(1);
        
        // 2b. Also check if the USERNAME already exists in this company (any role)
        // This prevents constraint violations on users_username_org_unique
        const existingUsernameInCompany = email ? await tx
          .select({ id: users.id, username: users.username, role: users.role })
          .from(users)
          .where(and(
            eq(users.companyId, companyId),
            eq(users.username, email) // username is set to email
          ))
          .limit(1) : [];

        let adminUser;
        let tempPasswordRaw: string | null = null;
        let isNewAdminUser = false;
        let isExistingUserNewCompany = false; // User exists but new to this company
        
        if (existingAdminsInCompany.length > 0) {
          // Admin already exists for THIS company
          console.log('✅ BillingService: Admin user already exists for this company', {
            companyId,
            existingAdminId: existingAdminsInCompany[0].id,
            username: existingAdminsInCompany[0].username
          });
          adminUser = existingAdminsInCompany[0];
        } else if (existingUsernameInCompany.length > 0) {
          // Username exists in this company but user is not an admin - promote to admin
          console.log('🔄 BillingService: Username exists in company (non-admin), promoting to admin', {
            userId: existingUsernameInCompany[0].id,
            currentRole: existingUsernameInCompany[0].role,
            username: existingUsernameInCompany[0].username
          });
          
          // Update existing user to admin role
          const [updatedUser] = await tx
            .update(users)
            .set({ 
              role: 'admin', 
              isAdmin: true, 
              updatedAt: new Date() 
            })
            .where(eq(users.id, existingUsernameInCompany[0].id))
            .returning();
          
          adminUser = updatedUser;
          isNewAdminUser = false; // Not new, just promoted
          tempPasswordRaw = null; // Don't send email for promotion
          
          console.log('✅ BillingService: User promoted to admin successfully', {
            userId: adminUser.id,
            username: adminUser.username
          });
        } else if (existingUserGlobally) {
          // User exists globally but not as admin for THIS company - add them
          console.log('🔄 BillingService: User exists globally, adding to new company', {
            userId: existingUserGlobally.id,
            email: existingUserGlobally.email,
            newCompanyId: companyId,
            originalCompanyId: existingUserGlobally.companyId
          });
          
          // Create a new admin user record for this company
          // Note: This creates a separate user record because our schema has companyId as part of the user
          isExistingUserNewCompany = true;
          isNewAdminUser = true; // Treat as new for this company
          
          // Generate new temporary password for the new company
          tempPasswordRaw = randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
          const hashedTempPassword = await hashPassword(tempPasswordRaw);

          const firstName = provider === 'zoho' ? 
            (customerData.first_name || customerData.contactpersons?.[0]?.first_name || customerData.display_name?.split(' ')[0]) : 
            customerData.first_name;
          const lastName = provider === 'zoho' ? 
            (customerData.last_name || customerData.contactpersons?.[0]?.last_name || customerData.display_name?.split(' ').slice(1).join(' ')) : 
            customerData.last_name;
          
          const generatedDisplayName = (firstName && lastName) ? 
            `${firstName.charAt(0)}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '') : 
            username;

          const adminUserData: InsertUser = {
            companyId,
            username: email ? email : username,
            email: email || `admin@company-${companyId}.local`,
            password: hashedTempPassword,
            role: 'admin',
            firstName: firstName || existingUserGlobally.firstName || 'Admin',
            lastName: lastName || existingUserGlobally.lastName || 'User',
            displayName: generatedDisplayName,
            isAdmin: true,
            status: 'active',
            activationToken: null,
            activationTokenExpires: null,
            isActive: true
          };

          console.log('👤 BillingService: Creating admin user for new company (existing user)', {
            username: adminUserData.username,
            email: adminUserData.email,
            displayName: adminUserData.displayName
          });

          try {
            const [newAdminUser] = await tx.insert(users).values(adminUserData).returning();
            adminUser = newAdminUser;
            
            console.log('✅ BillingService: Admin user created for new company', {
              userId: adminUser.id,
              username: adminUser.username,
              companyId
            });
          } catch (userError: any) {
            console.error('❌ BillingService: Admin user creation failed, attempting recovery:', {
              error: userError.message,
              code: userError.code
            });
            
            // **RECOVERY**: If duplicate key error, query for existing admin
            if (userError.message?.includes('duplicate key') || userError.code === '23505') {
              console.log('🔄 BillingService: Duplicate admin user detected, querying for existing...');
              const existingAdminRetry = await tx
                .select()
                .from(users)
                .where(and(eq(users.companyId, companyId), eq(users.role, 'admin')))
                .limit(1);
              
              if (existingAdminRetry.length > 0) {
                adminUser = existingAdminRetry[0];
                isNewAdminUser = false; // Not new if it already existed
                tempPasswordRaw = null; // Clear temp password - don't send email on recovery
                console.log('✅ BillingService: Recovered by using existing admin user', {
                  userId: adminUser.id
                });
              } else {
                throw userError;
              }
            } else {
              throw userError;
            }
          }
        } else {
          // Brand new user - never seen before
          isNewAdminUser = true;
          
          // Create admin user with temporary password and active status
          // Username is set to the email for simplicity
          tempPasswordRaw = randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
          const hashedTempPassword = await hashPassword(tempPasswordRaw);

        // Extract firstName and lastName from Zoho webhook data
        // Zoho provides first_name and last_name in customer object and contactpersons array
        const firstName = provider === 'zoho' ? 
          (customerData.first_name || customerData.contactpersons?.[0]?.first_name || customerData.display_name?.split(' ')[0]) : 
          customerData.first_name;
        const lastName = provider === 'zoho' ? 
          (customerData.last_name || customerData.contactpersons?.[0]?.last_name || customerData.display_name?.split(' ').slice(1).join(' ')) : 
          customerData.last_name;
        
        // Generate displayName as first initial + last name, lowercase (e.g., "bsmith" for Bob Smith)
        const generatedDisplayName = (firstName && lastName) ? 
          `${firstName.charAt(0)}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '') : 
          username;

        const adminUserData: InsertUser = {
          companyId,
          username: email ? email : username,
          email: email || `admin@company-${companyId}.local`,
          password: hashedTempPassword,
          role: 'admin',
          firstName: firstName || 'Admin',
          lastName: lastName || 'User',
          displayName: generatedDisplayName,
          isAdmin: true,
          status: 'active',
          activationToken: null,
          activationTokenExpires: null,
          isActive: true
        };

        console.log('👤 BillingService: Creating admin user', {
          username: adminUserData.username,
          email: adminUserData.email,
          displayName: adminUserData.displayName
        });

          try {
            const [newAdminUser] = await tx.insert(users).values(adminUserData).returning();
            adminUser = newAdminUser;
            
            console.log('✅ BillingService: Admin user created successfully', {
              userId: adminUser.id,
              username: adminUser.username
            });
          } catch (userError: any) {
            console.error('❌ BillingService: Admin user creation failed, attempting recovery:', {
              error: userError.message,
              code: userError.code
            });
            
            // **RECOVERY**: If duplicate key error, query for existing admin
            if (userError.message?.includes('duplicate key') || userError.code === '23505') {
              console.log('🔄 BillingService: Duplicate admin user detected, querying for existing...');
              const existingAdminRetry = await tx
                .select()
                .from(users)
                .where(and(eq(users.companyId, companyId), eq(users.role, 'admin')))
                .limit(1);
              
              if (existingAdminRetry.length > 0) {
                adminUser = existingAdminRetry[0];
                isNewAdminUser = false; // Not new if it already existed
                tempPasswordRaw = null; // Clear temp password - don't send email on recovery
                console.log('✅ BillingService: Recovered by using existing admin user', {
                  userId: adminUser.id
                });
              } else {
                throw userError;
              }
            } else {
              throw userError;
            }
          }
        }

        // 2. Check and create default user if missing
        // Generate unique default username to avoid collision with admin user
        const defaultUsername = (username === 'default') ? 'default-user' : 'default';
        
        const existingDefaultUsers = await tx
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(and(
            eq(users.companyId, companyId),
            eq(users.role, 'user'),
            eq(users.username, defaultUsername)
          ))
          .limit(1);

        let defaultUser;
        if (existingDefaultUsers.length > 0) {
          console.log('✅ BillingService: Default user already exists, using existing', {
            companyId,
            existingDefaultUserId: existingDefaultUsers[0].id,
            username: existingDefaultUsers[0].username
          });
          defaultUser = existingDefaultUsers[0];
        } else {
          // Create "Default" user for standard operations in pending activation state
          // Create default user with temporary password and active status
          const defaultTempPasswordRaw = randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
          const defaultHashedTempPassword = await hashPassword(defaultTempPasswordRaw);

          // Create default user as inactive to hide it from Users screen
          // This user is for internal system operations only
          const defaultUserData: InsertUser = {
            companyId,
            username: defaultUsername,
            email: email || `default@company-${companyId}.local`,
            password: defaultHashedTempPassword,
            role: 'user',
            firstName: 'Default',
            lastName: 'User',
            displayName: 'Default',
            isAdmin: false,
            status: 'inactive',
            activationToken: null,
            activationTokenExpires: null,
            isActive: false
          };

          console.log('👤 BillingService: Creating default user', {
            username: defaultUserData.username,
            email: defaultUserData.email,
            displayName: defaultUserData.displayName
          });

          try {
            const [newDefaultUser] = await tx.insert(users).values(defaultUserData).returning();
            defaultUser = newDefaultUser;
            
            console.log('✅ BillingService: Default user created successfully', {
              userId: defaultUser.id,
              username: defaultUser.username
            });
          } catch (defaultUserError: any) {
            console.error('❌ BillingService: Default user creation failed, attempting recovery:', {
              error: defaultUserError.message,
              code: defaultUserError.code
            });
            
            // **RECOVERY**: If duplicate key error, query for existing default user
            if (defaultUserError.message?.includes('duplicate key') || defaultUserError.code === '23505') {
              console.log('🔄 BillingService: Duplicate default user detected, querying for existing...');
              const existingDefaultRetry = await tx
                .select()
                .from(users)
                .where(and(
                  eq(users.companyId, companyId),
                  eq(users.role, 'user'),
                  eq(users.username, defaultUsername)
                ))
                .limit(1);
              
              if (existingDefaultRetry.length > 0) {
                defaultUser = existingDefaultRetry[0];
                console.log('✅ BillingService: Recovered by using existing default user', {
                  userId: defaultUser.id
                });
              } else {
                throw defaultUserError;
              }
            } else {
              throw defaultUserError;
            }
          }
        }

        // 3. Check and create default store if missing
        const existingStores = await tx
          .select({ id: stores.id, name: stores.name, slug: stores.slug })
          .from(stores)
          .where(eq(stores.companyId, companyId))
          .limit(1);

        let defaultStore;
        if (existingStores.length > 0) {
          console.log('✅ BillingService: Default store already exists, using existing', {
            companyId,
            existingStoreId: existingStores[0].id,
            storeName: existingStores[0].name
          });
          defaultStore = existingStores[0];
        } else {

        // Get the company from database to use its name for the store
        const [company] = await tx.select().from(companies).where(eq(companies.id, companyId)).limit(1);
        if (!company) {
          throw new Error(`Company not found for ID: ${companyId}`);
        }
        const companyName = company.name;
        
        // Generate slug from company name
        const storeSlug = companyName.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        
        // Create default store using company name and customer data
        // Enhanced phone extraction with extensive fallbacks for Zoho webhook formats
        const extractedPhone = customerData?.phone || 
                               customerData?.billing_address?.phone || 
                               customerData?.cf_phone ||
                               customerData?.contact_phone ||
                               customerData?.contactpersons?.[0]?.phone ||
                               null;
        
        console.log('📞 BillingService: Phone extraction debug', {
          'customerData.phone': customerData?.phone,
          'customerData.billing_address.phone': customerData?.billing_address?.phone,
          'customerData.cf_phone': customerData?.cf_phone,
          'customerData.contact_phone': customerData?.contact_phone,
          'extractedPhone': extractedPhone,
          'allCustomerDataKeys': customerData ? Object.keys(customerData) : []
        });
        
        const defaultStoreData: InsertStore = {
          companyId,
          name: companyName,
          slug: storeSlug || `company-${companyId}-store`,
          shortName: companyName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 8),
          storeNumber: '01', // First store
          status: 'active',
          isActive: true,
          timezone: customerData?.timezone || 'America/New_York',
          currency: 'USD',
          // Enhanced: Add address information from customerData
          address1: customerData?.address1 || customerData?.billing_address?.street || null,
          address2: customerData?.address2 || customerData?.billing_address?.street2 || null,
          city: customerData?.city || customerData?.billing_address?.city || null,
          state: customerData?.state || customerData?.billing_address?.state || null,
          zipCode: customerData?.zipCode || customerData?.zip || customerData?.billing_address?.zip || null,
          country: customerData?.country || customerData?.billing_address?.country || 'US',
          phone: extractedPhone
        };

          console.log('🏪 BillingService: Creating default store', { 
            companyId, 
            storeName: defaultStoreData.name,
            storeSlug: defaultStoreData.slug 
          });
          
          try {
            const [newDefaultStore] = await tx.insert(stores).values(defaultStoreData).returning();
            defaultStore = newDefaultStore;
            
            console.log('✅ BillingService: Default store created successfully', {
              storeId: defaultStore.id,
              storeName: defaultStore.name,
              storeSlug: defaultStore.slug
            });
          } catch (storeError: any) {
            console.error('❌ BillingService: Store creation failed, attempting recovery:', {
              error: storeError.message,
              code: storeError.code,
              detail: storeError.detail,
              constraint: storeError.constraint
            });
            
            // **RECOVERY**: If duplicate key error, the store was created by another process
            // Query again to get the existing store
            if (storeError.message?.includes('duplicate key') || storeError.code === '23505') {
              console.log('🔄 BillingService: Duplicate store detected, querying for existing store...');
              const existingStoreRetry = await tx
                .select()
                .from(stores)
                .where(eq(stores.companyId, companyId))
                .limit(1);
              
              if (existingStoreRetry.length > 0) {
                defaultStore = existingStoreRetry[0];
                console.log('✅ BillingService: Recovered by using existing store', {
                  storeId: defaultStore.id,
                  storeName: defaultStore.name
                });
              } else {
                console.error('❌ BillingService: Could not recover - no existing store found after duplicate error');
                throw storeError;
              }
            } else {
              // Non-duplicate error, can't recover
              throw storeError;
            }
          }
        }

        // 4. Check and create user-store mappings if missing
        const existingAdminMapping = await tx
          .select({ id: userStores.id })
          .from(userStores)
          .where(and(
            eq(userStores.userId, adminUser.id),
            eq(userStores.storeId, defaultStore.id)
          ))
          .limit(1);

        const existingDefaultMapping = await tx
          .select({ id: userStores.id })
          .from(userStores)
          .where(and(
            eq(userStores.userId, defaultUser.id),
            eq(userStores.storeId, defaultStore.id)
          ))
          .limit(1);

        const mappingsToCreate = [];
        if (existingAdminMapping.length === 0) {
          mappingsToCreate.push({
            userId: adminUser.id,
            storeId: defaultStore.id,
            role: 'manager',
            permissions: ['read', 'write', 'delete', 'admin'],
            isActive: true
          });
        }
        if (existingDefaultMapping.length === 0) {
          mappingsToCreate.push({
            userId: defaultUser.id,
            storeId: defaultStore.id,
            role: 'employee',
            permissions: ['read', 'write'],
            isActive: true
          });
        }

        if (mappingsToCreate.length > 0) {
          console.log(`🔗 BillingService: Creating ${mappingsToCreate.length} missing user-store mappings`);
          await tx.insert(userStores).values(mappingsToCreate);
          console.log('✅ BillingService: User-store mappings created successfully');
        } else {
          console.log('✅ BillingService: User-store mappings already exist');
        }

        // 5. Update company with timezone and retail vertical if provided
        if (customerData?.timezone || customerData?.retailVerticalId) {
          const companyUpdates: any = {};
          if (customerData.timezone) {
            companyUpdates.settings = { timezone: customerData.timezone, currency: 'USD' };
          }
          if (customerData.retailVerticalId) {
            companyUpdates.retailVerticalId = customerData.retailVerticalId;
          }
          if (Object.keys(companyUpdates).length > 0) {
            await tx
              .update(companies)
              .set(companyUpdates)
              .where(eq(companies.id, companyId));
            console.log('✅ BillingService: Updated company with timezone/retail vertical');
          }
        }

        // 6. Enable all active supported vendors for the company
        console.log('🔌 BillingService: Enabling all supported vendors for company');
        const supportedVendorsResult = await tx
          .select({ 
            id: supportedVendors.id, 
            name: supportedVendors.name,
            vendorShortCode: supportedVendors.vendorShortCode,
            apiType: supportedVendors.apiType
          })
          .from(supportedVendors)
          .where(eq(supportedVendors.isEnabled, true));
        
        console.log(`🔍 BillingService: Found ${supportedVendorsResult.length} enabled supported vendors:`, 
          supportedVendorsResult.map(v => ({ id: v.id, name: v.name })));
        
        if (supportedVendorsResult.length > 0) {
          // Check which vendors are already enabled
          const existingVendors = await tx
            .select({ supportedVendorId: vendors.supportedVendorId })
            .from(vendors)
            .where(eq(vendors.companyId, companyId));
          
          console.log(`🔍 BillingService: Company already has ${existingVendors.length} vendors enabled`);
          const existingVendorIds = new Set(existingVendors.map(v => v.supportedVendorId));
          
          // Create vendors for any that don't exist
          const vendorsToCreate = supportedVendorsResult
            .filter(sv => !existingVendorIds.has(sv.id))
            .map(sv => {
              const vendorShortCode = sv.vendorShortCode || sv.name;
              
              // ✅ STANDARDIZED: Use vendorShortCode directly as slug
              // Slug doesn't need companyId suffix because queries always filter by companyId
              // This matches the format used by storage.createVendorsFromSupported()
              const slug = vendorShortCode.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
              
              return {
                companyId,
                supportedVendorId: sv.id,
                name: sv.name,
                vendorShortCode,
                slug: slug || `vendor-${sv.id}`, // Fallback only if normalization produces empty string
                integrationType: sv.apiType || 'api',
                status: 'offline',
                enabledForPriceComparison: true,
                createdAt: new Date(),
                updatedAt: new Date()
              };
            });
          
          console.log(`🔍 BillingService: Will create ${vendorsToCreate.length} new vendors:`, 
            vendorsToCreate.map(v => ({ name: v.name, slug: v.slug })));
          
          if (vendorsToCreate.length > 0) {
            await tx.insert(vendors).values(vendorsToCreate);
            console.log(`✅ BillingService: Enabled ${vendorsToCreate.length} vendors for company`);
          } else {
            console.log('✅ BillingService: All supported vendors already enabled');
          }
        } else {
          console.warn('⚠️ BillingService: No enabled supported vendors found in the database!');
        }

        // 7. Update default store for users if not set
        await tx
          .update(users)
          .set({ defaultStoreId: defaultStore.id })
          .where(and(
            eq(users.companyId, companyId),
            isNull(users.defaultStoreId)
          ));

        // 8. Check and create company settings if missing
        const { settings: settingsTable } = await import('@shared/schema');
        const existingSettings = await tx
          .select({ id: settingsTable.id })
          .from(settingsTable)
          .where(eq(settingsTable.companyId, companyId))
          .limit(1);

        if (existingSettings.length === 0) {
          console.log('🔧 BillingService: Creating company settings');
          
          // Get company record to fetch billingSubscriptionId for platformAccountNumber
          const company = await tx
            .select()
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1);

          const settingsData = {
            companyId,
            platformAccountNumber: company[0]?.billingSubscriptionId || `ACCT-${companyId}`,
            storeAddress1: customerData?.address1 || customerData?.billing_address?.street || 'Address not provided',
            storeAddress2: customerData?.address2 || customerData?.billing_address?.street2 || null,
            storeCity: customerData?.city || customerData?.billing_address?.city || 'City not provided',
            storeState: customerData?.state || customerData?.billing_address?.state || 'State not provided',
            storeZipCode: customerData?.zipCode || customerData?.zip || customerData?.billing_address?.zip || 'Zip not provided',
            microbizEnabled: false,
            showVendorCosts: true,
            autoRefreshResults: false,
            includeUnmatchedUpcs: true
          };

          console.log('📝 BillingService: Settings data to insert:', {
            companyId: settingsData.companyId,
            storeAddress1: settingsData.storeAddress1,
            storeCity: settingsData.storeCity,
            storeState: settingsData.storeState,
            storeZipCode: settingsData.storeZipCode
          });

          try {
            await tx.insert(settingsTable).values(settingsData);
            console.log('✅ BillingService: Company settings created with account number:', settingsData.platformAccountNumber);
          } catch (settingsError: any) {
            console.error('❌ BillingService: Failed to insert settings:', {
              error: settingsError.message,
              code: settingsError.code,
              detail: settingsError.detail,
              constraint: settingsError.constraint,
              column: settingsError.column,
              settingsData: settingsData
            });
            throw settingsError;
          }
        } else {
          console.log('✅ BillingService: Company settings already exist');
        }

        // 9. Check and create default pricing configuration if missing
        const { pricingConfigurations, adminSettings: adminSettingsTable } = await import('@shared/schema');
        const existingPricingConfig = await tx
          .select({ id: pricingConfigurations.id })
          .from(pricingConfigurations)
          .where(and(
            eq(pricingConfigurations.companyId, companyId),
            eq(pricingConfigurations.isDefault, true)
          ))
          .limit(1);

        if (existingPricingConfig.length === 0) {
          console.log('💰 BillingService: Creating default pricing configuration from admin settings');
          
          // Fetch admin settings to get default pricing strategy and all related settings
          const [adminSettings] = await tx
            .select()
            .from(adminSettingsTable)
            .limit(1);
          
          // **REQUIRE admin settings to be configured - no hardcoded fallbacks**
          if (!adminSettings) {
            throw new Error('Admin settings not configured. Run migrations/seed-admin-settings.sql to initialize.');
          }
          
          if (!adminSettings.defaultPricingStrategy || !adminSettings.defaultPricingFallbackStrategy) {
            throw new Error('Admin pricing defaults not configured. Please configure in Admin > Settings.');
          }
          
          const pricingConfigData = {
            companyId,
            name: 'Default Pricing Rule',
            description: `Use ${adminSettings.defaultPricingStrategy.toUpperCase()} with ${adminSettings.defaultPricingFallbackStrategy.toUpperCase()} as fallback`,
            strategy: adminSettings.defaultPricingStrategy,
            markupPercentage: adminSettings.defaultPricingMarkupPercentage || null,
            marginPercentage: adminSettings.defaultPricingMarginPercentage || null,
            premiumAmount: adminSettings.defaultPricingPremiumAmount || null,
            discountPercentage: adminSettings.defaultPricingDiscountPercentage || null,
            roundingRule: adminSettings.defaultPricingRoundingRule || 'none',
            fallbackStrategy: adminSettings.defaultPricingFallbackStrategy,
            fallbackMarkupPercentage: adminSettings.defaultPricingFallbackMarkupPercentage || null,
            useCrossVendorFallback: adminSettings.defaultPricingUseCrossVendorFallback || false,
            isDefault: true,
            isActive: true
          };

          await tx.insert(pricingConfigurations).values(pricingConfigData);
          console.log(`✅ BillingService: Default pricing configuration created (${adminSettings.defaultPricingStrategy.toUpperCase()} with ${adminSettings.defaultPricingFallbackStrategy.toUpperCase()} fallback, ${adminSettings.defaultPricingFallbackMarkupPercentage}% markup)`);
        } else {
          console.log('✅ BillingService: Default pricing configuration already exists');
        }

        // 10. Copy category templates for retail vertical
        const retailVerticalIdToCopy = customerData?.retailVerticalId || 1; // Default to Firearms (ID: 1)
        console.log(`📋 BillingService: Copying category templates for retail vertical ${retailVerticalIdToCopy}`, {
          hasRetailVerticalId: !!customerData?.retailVerticalId,
          providedValue: customerData?.retailVerticalId,
          usingDefault: !customerData?.retailVerticalId
        });
        
        try {
          const categoriesCopied = await storage.copyCategoryTemplatesToCompany(companyId, retailVerticalIdToCopy);
          if (categoriesCopied > 0) {
            console.log(`✅ BillingService: Copied ${categoriesCopied} category templates to company`);
          } else {
            console.warn(`⚠️ BillingService: No category templates found for retail vertical ${retailVerticalIdToCopy}`);
            console.log('ℹ️ BillingService: This may be normal if the retail vertical has no pre-configured categories');
          }
        } catch (categoryError) {
          console.error('⚠️ BillingService: Failed to copy category templates (non-critical):', categoryError);
          // Don't fail provisioning if category copying fails
        }

        // Send invite email ONLY to NEW admin users (not on re-provisioning)
        console.log('📧 BillingService: Checking email send conditions:', {
          isNewAdminUser,
          hasAdminUser: !!adminUser,
          adminUserEmail: (adminUser as any)?.email,
          hasTempPassword: !!tempPasswordRaw,
          willSendEmail: isNewAdminUser && adminUser && (adminUser as any).email && tempPasswordRaw
        });
        
        if (isNewAdminUser && adminUser && (adminUser as any).email && tempPasswordRaw) {
          try {
            const company = await tx.select().from(companies).where(eq(companies.id, companyId)).limit(1);
            if (company.length > 0) {
              const loginUrl = generateLoginUrl(company[0].slug);
              // ENHANCED: Robust email extraction with multiple fallbacks
              const adminEmail = (adminUser as any).email || 
                               customerData?.email || 
                               customerData?.customer_email || 
                               customerData?.contact_email ||
                               `admin-${companyId}@subscription.local`;
              const adminUsername = adminEmail; // Username = email per request

              console.log('📧 BillingService: Sending welcome email to NEW admin user', {
                email: adminEmail,
                organizationName: company[0].name,
                loginUrl,
                userId: adminUser.id,
                tempPassword: tempPasswordRaw ? '***HIDDEN***' : 'MISSING'
              });

              const emailSent = await sendInviteEmail(
                adminEmail,
                company[0].name,
                adminUsername,
                tempPasswordRaw,
                loginUrl
              );

              if (emailSent) {
                console.log('✅ BillingService: Welcome email sent successfully to new user');
              } else {
                console.warn('⚠️ BillingService: Welcome email sending failed - check email service configuration');
              }
            }
          } catch (emailError) {
            console.error('⚠️ BillingService: Failed to send welcome email (non-blocking):', emailError);
          }
        } else if (!isNewAdminUser && adminUser) {
          // **SEND EMAIL FOR EXISTING USERS WITH NEW STORE/SUBSCRIPTION**
          // Even if the admin user already exists, we should notify them about the new store/subscription
          console.log('ℹ️ BillingService: Admin user already exists, sending new store notification email', {
            userId: adminUser.id,
            companyId
          });
          
          try {
            // Get company info for email
            const company = await tx
              .select()
              .from(companies)
              .where(eq(companies.id, companyId))
              .limit(1);

            if (company.length > 0) {
              // Generate a new temporary password for the existing user
              const newTempPasswordRaw = randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
              const newHashedTempPassword = await hashPassword(newTempPasswordRaw);

              // Update the user's password with the new temporary password
              await tx
                .update(users)
                .set({ password: newHashedTempPassword })
                .where(eq(users.id, adminUser.id));

              console.log('🔑 BillingService: Generated new temporary password for existing user');

              // Build login URL dynamically from company slug and environment
              const baseUrl = process.env.VITE_APP_URL || 'https://pricecomparehub.com';
              const companySlug = company[0].slug;
              const loginUrl = `${baseUrl}/org/${companySlug}/auth`;
              const adminEmail = adminUser.email || 
                               customerData?.email || 
                               customerData?.customer_email || 
                               customerData?.contact_email ||
                               `admin-${companyId}@subscription.local`;
              const adminUsername = adminUser.username;

              console.log('📧 BillingService: Sending new store notification email to EXISTING admin user', {
                email: adminEmail,
                organizationName: company[0].name,
                loginUrl,
                userId: adminUser.id
              });

              const emailSent = await sendInviteEmail(
                adminEmail,
                company[0].name,
                adminUsername,
                newTempPasswordRaw,
                loginUrl
              );

              if (emailSent) {
                console.log('✅ BillingService: New store notification email sent successfully to existing user');
              } else {
                console.log('⚠️ BillingService: New store notification email sending failed (non-blocking)');
              }
            }
          } catch (emailError) {
            console.error('⚠️ BillingService: Failed to send new store notification email (non-blocking):', emailError);
          }
        }

        // Provisioning completed - all components exist or were created

        console.log('🎉 BillingService: Company onboarding provisioning completed successfully', {
          companyId,
          adminUserId: adminUser.id,
          defaultUserId: defaultUser.id,
          defaultStoreId: defaultStore.id,
          timestamp: new Date().toISOString()
        });
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('❌ BillingService: Failed to provision company onboarding', {
        companyId,
        provider,
        error: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString()
      });
      throw error; // Re-throw to let caller handle
    } finally {
      // **RELEASE LOCK**: Always release the provisioning lock
      this.concurrencyLocks.delete(lockKey);
      console.log(`🔓 BillingService: Released provisioning lock for company ${companyId}`);
    }
  }

  // REMOVED: generateSecurePassword() - replaced with secure activation tokens
  // Users now create their own passwords during secure activation process

  // Usage tracking methods
  async trackUsage(companyId: number, metric: string, value: number = 1): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Track daily usage
    await db
      .insert(usageMetrics)
      .values({
        companyId,
        metric,
        value,
        period: 'daily',
        date: today
      })
      .onConflictDoUpdate({
        target: [usageMetrics.companyId, usageMetrics.metric, usageMetrics.period, usageMetrics.date],
        set: {
          value: value
        }
      });

    // Track monthly usage
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    await db
      .insert(usageMetrics)
      .values({
        companyId,
        metric,
        value,
        period: 'monthly',
        date: monthStart
      })
      .onConflictDoUpdate({
        target: [usageMetrics.companyId, usageMetrics.metric, usageMetrics.period, usageMetrics.date],
        set: {
          value: value
        }
      });
  }

  // Check company limits
  async checkLimits(companyId: number): Promise<{ 
    withinLimits: boolean; 
    violations: string[] 
  }> {
    const [org] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!org) {
      return { withinLimits: false, violations: ['Company not found'] };
    }

    const violations: string[] = [];

    // Check monthly order limit
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [monthlyOrders] = await db
      .select()
      .from(usageMetrics)
      .where(
        eq(usageMetrics.companyId, companyId) &&
        eq(usageMetrics.metric, 'orders_created') &&
        eq(usageMetrics.period, 'monthly') &&
        eq(usageMetrics.date, monthStart)
      )
      .limit(1);

    // Note: Monthly order limits removed - no restrictions on order count
    
    return {
      withinLimits: violations.length === 0,
      violations
    };
  }
  
  // **DURABLE EVENT DEDUPLICATION METHODS**
  
  /**
   * Check if an event has already been processed to prevent duplicates (database-based)
   */
  private async isEventAlreadyProcessedInDB(eventId: string, provider: 'zoho' | 'recurly'): Promise<boolean> {
    try {
      const [existingEvent] = await db
        .select({ id: billingEvents.id, processed: billingEvents.processed })
        .from(billingEvents)
        .where(and(
          eq(billingEvents.externalId, eventId),
          eq(billingEvents.billingProvider, provider) // ✅ Use billingProvider TEXT column, not metadata JSON
        ))
        .limit(1);
      
      if (existingEvent && existingEvent.processed) {
        console.log(`🔍 Event ${eventId} already processed in database`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('⚠️ Error checking event processing status:', error);
      return false; // Fail open - allow processing if check fails
    }
  }
  
  /**
   * Create billing event record to claim event processing (database-level deduplication)
   * Only creates records when we can find a valid company to associate with
   */
  private async createBillingEventRecord(event: BillingWebhookPayload): Promise<any> {
    try {
      // Find organization by billing customer ID for proper foreign key
      const customerIdField = event.billingProvider === 'zoho' ? 
        event.data.data?.customer?.customer_id || event.data.data?.subscription?.customer_id || event.data.customer?.customer_id || event.data.subscription?.customer_id :
        event.data.account?.account_code || event.data.subscription?.account?.account_code;

      let companyId: number | null = null;
      if (customerIdField) {
        const [org] = await db
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.billingCustomerId, customerIdField))
          .limit(1);
        companyId = org?.id || null;
      }

      // Only create billing event record if we have a valid company ID
      if (!companyId) {
        throw new Error(`Cannot create billing event record: No company found for customer ${customerIdField}`);
      }

      // Use UPSERT to handle race conditions with duplicate events  
      const eventRecord = {
        companyId: companyId, // Required non-null company ID
        eventType: event.eventType,
        billingProvider: event.billingProvider, // Set the billing_provider column
        externalId: event.eventId,
        metadata: { provider: event.billingProvider, ...event.data },
        processed: false
      };

      const [insertedEvent] = await db
        .insert(billingEvents)
        .values([eventRecord]) // Pass as array of objects
        .onConflictDoNothing() // Ignore if already exists (race condition protection)
        .returning();

      if (!insertedEvent) {
        // Event already exists, get the existing one
        const [existingEvent] = await db
          .select()
          .from(billingEvents)
          .where(and(
            eq(billingEvents.externalId, event.eventId),
            eq(billingEvents.eventType, event.eventType)
          ))
          .limit(1);
        return existingEvent;
      }

      console.log(`📝 Created billing event record for ${event.eventId}`);
      return insertedEvent;
      
    } catch (error) {
      console.error('⚠️ Error creating billing event record:', error);
      throw error;
    }
  }
  
  /**
   * Mark event as successfully processed in database
   */
  private async markEventAsProcessedInDB(billingEventId: number): Promise<void> {
    try {
      await db
        .update(billingEvents)
        .set({
          processed: true,
          processedAt: new Date(),
          error: null // Clear any previous error
        })
        .where(eq(billingEvents.id, billingEventId));
      
      console.log(`✅ Marked billing event ${billingEventId} as processed in database`);
    } catch (error) {
      console.error('⚠️ Error marking event as processed:', error);
      // Don't throw - this is a tracking issue, not a processing failure
    }
  }
  
  /**
   * Mark event as failed in database (allows retries)
   */
  private async markEventAsFailedInDB(billingEventId: number, errorMessage: string): Promise<void> {
    try {
      await db
        .update(billingEvents)
        .set({
          processed: false, // Keep as false to allow retries
          error: errorMessage
        })
        .where(eq(billingEvents.id, billingEventId));
      
      console.log(`❌ Marked billing event ${billingEventId} as failed (allows retry)`);
    } catch (error) {
      console.error('⚠️ Error marking event as failed:', error);
      // Don't throw - this is a tracking issue
    }
  }
  
  /**
   * Clean up old processed billing events from database (optional maintenance)
   */
  private async cleanupOldBillingEvents(): Promise<void> {
    try {
      // Clean up events older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const result = await db
        .delete(billingEvents)
        .where(and(
          eq(billingEvents.processed, true),
          // Only using timestamp comparison - need to check column name
        ));
      
      console.log(`🧹 Cleaned up old billing events from database`);
    } catch (error) {
      console.error('⚠️ Error cleaning up old billing events:', error);
    }
  }
  
  // **CONCURRENCY PROTECTION METHODS**
  
  /**
   * Acquire a lock for webhook processing to prevent race conditions
   */
  private async acquireWebhookLock(customerId: string): Promise<void> {
    const existingLock = this.webhookLocks.get(customerId);
    
    if (existingLock) {
      // Check if lock is expired
      const isExpired = Date.now() - existingLock.timestamp > this.LOCK_TIMEOUT_MS;
      
      if (isExpired) {
        console.log(`⚠️ Webhook lock expired for customer ${customerId}, removing`);
        this.webhookLocks.delete(customerId);
      } else {
        // Wait for existing lock to complete
        console.log(`⏳ Waiting for existing webhook lock for customer ${customerId}`);
        try {
          await existingLock.promise;
        } catch (error) {
          console.log(`⚠️ Previous webhook processing failed for customer ${customerId}, continuing`);
        }
      }
    }
    
    // Create new lock
    const lockPromise = new Promise<void>((resolve) => {
      // This promise will be resolved when releaseWebhookLock is called
      (this as any)._lockResolvers = (this as any)._lockResolvers || {};
      (this as any)._lockResolvers[customerId] = resolve;
    });
    
    this.webhookLocks.set(customerId, {
      customerId,
      timestamp: Date.now(),
      promise: lockPromise
    });
    
    console.log(`🔒 Acquired webhook lock for customer ${customerId}`);
  }
  
  /**
   * Release the webhook processing lock
   */
  private releaseWebhookLock(customerId: string): void {
    const lock = this.webhookLocks.get(customerId);
    if (lock) {
      this.webhookLocks.delete(customerId);
      
      // Resolve the lock promise if it exists
      const resolver = (this as any)._lockResolvers?.[customerId];
      if (resolver) {
        resolver();
        delete (this as any)._lockResolvers[customerId];
      }
      
      console.log(`🔓 Released webhook lock for customer ${customerId}`);
    }
  }

  /**
   * Generate unique slug for company, handling duplicates
   * Appends numbers if slug already exists (e.g., demo-gun-store-2)
   */
  async generateUniqueSlug(baseName: string): Promise<string> {
    const baseSlug = baseName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    let slug = baseSlug;
    let counter = 1;

    // Check if slug exists
    while (true) {
      const existing = await storage.getCompanyBySlug(slug);
      if (!existing) {
        return slug;
      }
      
      // Slug exists, try with number suffix
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  /**
   * Create a new subscription manually (for dev testing and manual creation)
   * This provides the same functionality as the Zoho webhook but for manual use
   */
  async createManualSubscription(data: {
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    timezone?: string;
    retailVerticalId?: number;
    plan: string;
    customerAccountNumber?: string;
  }): Promise<{ success: boolean; company: any; message: string }> {
    try {
      console.log('🎯 BillingService: Creating manual subscription', {
        companyName: data.companyName,
        plan: data.plan,
        email: data.email
      });

      // Generate unique slug
      const slug = await this.generateUniqueSlug(data.companyName);

      // Map plan limits (no order limits - unlimited orders for all plans)
      const planLimits = {
        free: { maxUsers: 5, maxVendors: 3 },
        standard: { maxUsers: 25, maxVendors: 6 },
        enterprise: { maxUsers: 100, maxVendors: 999 }
      };

      const limits = planLimits[data.plan as keyof typeof planLimits] || planLimits.free;

      // Create company
      const companyData = {
        name: data.companyName,
        slug,
        plan: data.plan,
        status: 'active',
        email: data.email,
        phone: data.phone || null,
        billingProvider: 'manual',
        billingCustomerId: data.customerAccountNumber || `MANUAL-${Date.now()}`,
        billingSubscriptionId: `MANUAL-SUB-${Date.now()}`,
        maxUsers: limits.maxUsers,
        maxVendors: limits.maxVendors,
        features: data.plan === 'enterprise' ? 
          { apiAccess: true, advancedAnalytics: true, orderProcessing: true, asnProcessing: true } : 
          data.plan === 'standard' ?
          { apiAccess: true, advancedAnalytics: true, orderProcessing: false, asnProcessing: false } :
          { apiAccess: false, advancedAnalytics: false, orderProcessing: false, asnProcessing: false },
        settings: { timezone: data.timezone || 'America/New_York', currency: 'USD' },
        retailVerticalId: data.retailVerticalId || null
      };

      const newCompany = await storage.createCompany(companyData);

      // Create subscription record (without Zoho-specific fields like cancelAtPeriodEnd/autoRenew)
      await storage.createSubscription({
        companyId: newCompany.id,
        externalSubscriptionId: `MANUAL-${newCompany.id}-${Date.now()}`,
        externalCustomerId: companyData.billingCustomerId,
        externalSubscriptionNumber: companyData.billingSubscriptionId,
        planId: data.plan,
        status: 'active',
        billingProvider: 'manual',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        amount: data.plan === 'enterprise' ? '299' : data.plan === 'standard' ? '99' : '0',
        currency: 'USD'
      });

      // Provision company with full customer data
      const customerData = {
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        display_name: `${data.firstName} ${data.lastName}`,
        phone: data.phone,
        address1: data.address1,
        address2: data.address2,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        zip: data.zipCode,
        country: data.country || 'US',
        timezone: data.timezone || 'America/New_York',
        retailVerticalId: data.retailVerticalId
      };

      await this.provisionCompanyOnboarding(newCompany.id, customerData, 'zoho');

      // Create billing event for subscription_created so it appears in admin dashboard "Created" column
      await storage.createBillingEvent({
        companyId: newCompany.id,
        eventType: 'subscription_created',
        billingProvider: 'manual', // Required field - indicates this was manually created
        eventData: {
          plan: data.plan,
          source: 'manual',
          customerEmail: data.email
        }
      });

      console.log('✅ BillingService: Manual subscription created successfully', {
        companyId: newCompany.id,
        slug: newCompany.slug,
        plan: newCompany.plan
      });

      return {
        success: true,
        company: newCompany,
        message: `Subscription created successfully for ${data.companyName}`
      };

    } catch (error) {
      console.error('❌ BillingService: Manual subscription creation failed:', error);
      throw error;
    }
  }
}

export const billingService = new BillingService();
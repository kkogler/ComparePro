import * as cron from 'node-cron';
import { storage } from './storage';

/**
 * Background jobs for automatic subscription status management
 */

let trialExpirationJob: cron.ScheduledTask | null = null;
let paymentReminderJob: cron.ScheduledTask | null = null;

/**
 * Start all subscription background jobs
 */
export function startSubscriptionJobs() {
  console.log('🔄 Starting subscription background jobs...');

  // Daily job to check for expired trials (runs at 1:00 AM)
  trialExpirationJob = cron.schedule('0 1 * * *', async () => {
    console.log('⏰ Running daily trial expiration check...');
    await checkExpiredTrials();
  }, {
    timezone: 'America/New_York'
  });

  // Note: Payment reminders and dunning are handled by Zoho Billing
  // We only need to sync status updates from Zoho webhooks

  // Jobs start automatically when created

  console.log('✅ Subscription background jobs started successfully');
}

/**
 * Stop all subscription background jobs
 */
export function stopSubscriptionJobs() {
  console.log('🛑 Stopping subscription background jobs...');

  if (trialExpirationJob) {
    trialExpirationJob.stop();
    trialExpirationJob = null;
  }

  if (paymentReminderJob) {
    paymentReminderJob.stop();
    paymentReminderJob = null;
  }

  console.log('✅ Subscription background jobs stopped');
}

/**
 * Check for expired trials and update their status
 */
async function checkExpiredTrials() {
  try {
    console.log('TRIAL CHECK: Starting expired trial check...');

    // Get all companies with trial status 
    const companies = await storage.getAllCompanies();
    const now = new Date();
    let expiredCount = 0;
    let warningCount = 0;

    for (const company of companies) {
      // Skip if not on trial
      if (company.status !== 'trial') continue;

      const trialEndsAt = company.trialEndsAt;
      if (!trialEndsAt) continue;

      // Check if trial has expired
      if (trialEndsAt < now) {
        console.log(`TRIAL CHECK: Expiring trial for ${company.name} (ended ${trialEndsAt})`);
        
        await storage.updateCompany(company.id, {
          status: 'expired',
          trialStatus: 'expired',
          updatedAt: new Date()
        });
        
        expiredCount++;
        
        // Send trial expired notification
        await sendTrialExpiredNotification(company);
      }
      // Check if trial expires in 3 days (send warning)
      else {
        const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 3 && daysRemaining > 0) {
          console.log(`TRIAL CHECK: Sending warning for ${company.name} (${daysRemaining} days remaining)`);
          
          await sendTrialWarningNotification(company, daysRemaining);
          warningCount++;
        }
      }
    }

    console.log(`TRIAL CHECK: Expired ${expiredCount} trials, sent ${warningCount} warnings`);
    
  } catch (error) {
    console.error('TRIAL CHECK ERROR:', error);
  }
}

/**
 * Note: Payment reminders and dunning are handled by Zoho Billing
 * Zoho automatically sends payment reminders, dunning emails, and manages
 * the entire billing lifecycle. We only sync status updates via webhooks.
 */

/**
 * Send trial expired notification
 */
async function sendTrialExpiredNotification(company: any) {
  try {
    console.log(`EMAIL: Sending trial expired notification to ${company.name}`);
    
    // TODO: Implement email service integration
    // For now, just log the notification
    console.log(`📧 TRIAL EXPIRED: ${company.name} trial has expired`);
    
    // In a real implementation, you would:
    // 1. Get company admin email
    // 2. Send personalized trial expired email
    // 3. Include upgrade links and support contact info
    
  } catch (error) {
    console.error('TRIAL EXPIRED EMAIL ERROR:', error);
  }
}

/**
 * Send trial warning notification (3 days before expiry)
 */
async function sendTrialWarningNotification(company: any, daysRemaining: number) {
  try {
    console.log(`EMAIL: Sending trial warning to ${company.name} (${daysRemaining} days left)`);
    
    // TODO: Implement email service integration
    console.log(`📧 TRIAL WARNING: ${company.name} has ${daysRemaining} days left`);
    
    // In a real implementation, you would:
    // 1. Get company admin email
    // 2. Send personalized warning email with days remaining
    // 3. Include upgrade links and feature highlights
    
  } catch (error) {
    console.error('TRIAL WARNING EMAIL ERROR:', error);
  }
}

/**
 * Zoho Billing handles all payment reminders and dunning automatically.
 * No custom payment reminder logic needed.
 */

/**
 * Manual function to trigger trial expiration check (for testing)
 */
export async function manualTrialCheck() {
  console.log('🔧 MANUAL: Running trial expiration check...');
  await checkExpiredTrials();
}

/**
 * Payment reminders are handled by Zoho Billing - no manual intervention needed
 */

/**
 * Get job status information
 */
export function getJobStatus() {
  return {
    trialExpirationJob: {
      running: trialExpirationJob?.getStatus() === 'scheduled',
      schedule: '0 1 * * * (1:00 AM daily)',
      timezone: 'America/New_York'
    },
    paymentReminders: {
      running: false, 
      schedule: 'Handled by Zoho Billing',
      timezone: 'N/A - Zoho manages all billing communications'
    }
  };
}
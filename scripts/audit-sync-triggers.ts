#!/usr/bin/env tsx
/**
 * SYNC TRIGGER AUDIT
 * 
 * This script audits all possible ways that vendor syncs could be triggered,
 * including orphan code, cron jobs, startup triggers, and scheduled deployments.
 */

import { db } from '../server/db';
import { supportedVendors } from '../shared/schema';

console.log('🔍 SYNC TRIGGER AUDIT\n');
console.log('='  .repeat(80));

// 1. Check database schedule settings
async function checkDatabaseSchedules() {
  console.log('\n📊 DATABASE SCHEDULE SETTINGS:\n');
  
  const vendors = await db.select().from(supportedVendors);
  
  for (const vendor of vendors) {
    if (vendor.name.toLowerCase().includes('chattanooga')) {
      console.log(`Chattanooga:`);
      console.log(`  - Schedule Enabled: ${vendor.chattanoogaScheduleEnabled}`);
      console.log(`  - Schedule Time: ${vendor.chattanoogaScheduleTime}`);
      console.log(`  - Schedule Frequency: ${vendor.chattanoogaScheduleFrequency}`);
      console.log(`  - Last Sync: ${vendor.lastCatalogSync || 'Never'}`);
      console.log(`  - Sync Status: ${vendor.catalogSyncStatus || 'N/A'}`);
    }
    
    if (vendor.name.toLowerCase().includes('sports south')) {
      console.log(`\nSports South:`);
      console.log(`  - Schedule Enabled: ${vendor.sportsSouthScheduleEnabled}`);
      console.log(`  - Schedule Time: ${vendor.sportsSouthScheduleTime}`);
      console.log(`  - Schedule Frequency: ${vendor.sportsSouthScheduleFrequency}`);
      console.log(`  - Last Sync: ${vendor.lastCatalogSync || 'Never'}`);
      console.log(`  - Sync Status: ${vendor.catalogSyncStatus || 'N/A'}`);
    }
    
    if (vendor.name.toLowerCase().includes('bill hicks')) {
      console.log(`\nBill Hicks:`);
      console.log(`  - Master Catalog Sync Enabled: ${vendor.billHicksMasterCatalogSyncEnabled}`);
      console.log(`  - Master Catalog Sync Time: ${vendor.billHicksMasterCatalogSyncTime}`);
      console.log(`  - Inventory Sync Enabled: ${vendor.billHicksInventorySyncEnabled}`);
      console.log(`  - Inventory Sync Time: ${vendor.billHicksInventorySyncTime}`);
      console.log(`  - Last Master Catalog Sync: ${vendor.billHicksMasterCatalogLastSync || 'Never'}`);
      console.log(`  - Last Inventory Sync: ${vendor.billHicksLastInventorySync || 'Never'}`);
    }
  }
}

// 2. Check for active cron jobs
async function checkCronJobs() {
  console.log('\n\n⏰ CRON JOB CHECK:\n');
  
  const { execSync } = await import('child_process');
  
  try {
    const crontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    
    if (crontab.trim()) {
      console.log('❌ FOUND ACTIVE CRON JOBS:');
      console.log(crontab);
      console.log('\n⚠️  These may be triggering syncs!');
    } else {
      console.log('✅ No cron jobs found (crontab is empty)');
    }
  } catch (error: any) {
    if (error.message.includes('no crontab')) {
      console.log('✅ No crontab found for current user');
    } else {
      console.log('❌ Error checking crontab:', error.message);
    }
  }
}

// 3. Check for startup triggers in code
function checkStartupTriggers() {
  console.log('\n\n🚀 STARTUP TRIGGER CHECK:\n');
  
  console.log('Checking server/index.ts for startup recovery...');
  console.log('  ✅ Startup recovery ONLY resets stuck sync statuses (no actual syncs)');
  
  console.log('\nChecking server/chattanooga-scheduler.ts...');
  console.log('  ✅ Constructor auto-initialization is DISABLED (line 40)');
  console.log('  ⚠️  BUT initialize() method contains STARTUP RECOVERY logic:');
  console.log('      - Line 50-128: setTimeout 15 seconds after server start');
  console.log('      - Checks if sync was missed based on schedule');
  console.log('      - Triggers runChattanoogaSync() if:');
  console.log('        a) Sync status is stuck');
  console.log('        b) Missed today\'s scheduled time');
  console.log('        c) >25 hours since last sync');
  console.log('        d) No previous sync found');
  console.log('  ❓ Question: Is initialize() being called anywhere?');
  
  console.log('\nChecking if getChattanoogaScheduler() creates new instances...');
  console.log('  ⚠️  Yes! Line 637-639 in chattanooga-scheduler.ts');
  console.log('      Each call to getChattanoogaScheduler() creates a NEW ChattanoogaScheduler()');
  console.log('      But constructor doesn\'t call initialize(), so should be safe');
}

// 4. Check where schedulers are instantiated
function checkSchedulerInstantiation() {
  console.log('\n\n🏗️  SCHEDULER INSTANTIATION CHECK:\n');
  
  console.log('Checking where getChattanoogaScheduler() is called:');
  console.log('  1. server/chattanooga-schedule-routes.ts:182');
  console.log('     - Called ONLY for manual sync endpoint');
  console.log('     - Creates instance, calls triggerManualSync(), then discards');
  console.log('     ✅ This is correct - no persistent instance');
  
  console.log('\nChecking for singleton instances:');
  console.log('  ✅ Line 634 in chattanooga-scheduler.ts:');
  console.log('     "// export const chattanoogaScheduler = new ChattanoogaScheduler();"');
  console.log('     Singleton export is COMMENTED OUT (disabled)');
}

// 5. Check Replit Scheduled Deployments
function checkScheduledDeployments() {
  console.log('\n\n📅 REPLIT SCHEDULED DEPLOYMENTS:\n');
  
  console.log('⚠️  Cannot detect Scheduled Deployments from code');
  console.log('   These are configured in Replit Dashboard, not in codebase');
  console.log('\n❓ ACTION NEEDED: Check Replit Dashboard > Deployments tab');
  console.log('   Look for:');
  console.log('   - "Chattanooga Daily Sync"');
  console.log('   - "Sports South Sync"');
  console.log('   - Any other scheduled runs of sync scripts');
  console.log('\n   If found, these will call scripts/chattanooga-sync.ts or similar');
  console.log('   which trigger API calls');
}

// 6. Check for file watchers or auto-reload triggers
function checkAutoReloadTriggers() {
  console.log('\n\n🔄 AUTO-RELOAD / FILE WATCHER CHECK:\n');
  
  console.log('Replit Auto-Deploy behavior:');
  console.log('  ⚠️  Every time you save a file in dev, Replit may:');
  console.log('     1. Restart the server (kills and restarts tsx server/index.ts)');
  console.log('     2. This triggers server initialization');
  console.log('     3. If startup recovery logic is active, it may trigger syncs');
  console.log('\n  🔥 THIS IS LIKELY YOUR RATE LIMIT ISSUE!');
  console.log('     - Save file → Server restarts → Startup recovery checks → API calls');
  console.log('     - Multiple saves in quick succession = multiple restarts = rate limit');
}

// 7. Recommendations
function printRecommendations() {
  console.log('\n\n💡 RECOMMENDATIONS:\n');
  console.log('='  .repeat(80));
  
  console.log('\n1. ❌ DISABLE STARTUP RECOVERY in Chattanooga Scheduler');
  console.log('   File: server/chattanooga-scheduler.ts');
  console.log('   Problem: Lines 50-128 trigger syncs on server restart');
  console.log('   Solution: Comment out or remove setTimeout block in initialize()');
  
  console.log('\n2. ✅ Keep startup recovery in server/index.ts');
  console.log('   This only resets stuck statuses, doesn\'t trigger API calls');
  
  console.log('\n3. 🔍 Check Replit Scheduled Deployments');
  console.log('   Dashboard > Deployments > Look for any active schedules');
  console.log('   Disable if you want manual-only syncs');
  
  console.log('\n4. ⏰ Use Scheduled Deployments instead of code-based cron');
  console.log('   - More reliable');
  console.log('   - Doesn\'t depend on dev server restarts');
  console.log('   - Separate from your main app server');
  
  console.log('\n5. 🚨 Rate Limit Strategy:');
  console.log('   - Add rate limit tracking in memory');
  console.log('   - Skip sync if last attempt was <15 minutes ago');
  console.log('   - Log "Rate limit cooldown, skipping sync"');
  
  console.log('\n6. 📊 Add Audit Logging:');
  console.log('   - Log every API call to Chattanooga/Sports South');
  console.log('   - Include stack trace to see what triggered it');
  console.log('   - This will help identify orphan triggers');
}

// Main execution
async function main() {
  try {
    await checkDatabaseSchedules();
    await checkCronJobs();
    checkStartupTriggers();
    checkSchedulerInstantiation();
    checkScheduledDeployments();
    checkAutoReloadTriggers();
    printRecommendations();
    
    console.log('\n\n✅ Audit complete!');
    console.log('='  .repeat(80));
    
  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();


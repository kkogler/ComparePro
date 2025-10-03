# Chattanooga Scheduled Deployment Setup Guide

## Overview
This guide will set up a Replit Scheduled Deployment for Chattanooga Shooting Supplies daily catalog synchronization, replacing the disabled internal cron job system.

## Current Status
- ✅ **Sync Script**: Ready (`scripts/chattanooga-sync.ts`)
- ✅ **Database**: Connected and working
- ✅ **API Credentials**: Configured
- ❌ **Scheduler**: Currently disabled
- ❌ **Scheduled Deployment**: Not configured

## Setup Instructions

### Step 1: Access Replit Deployments

1. **Open your Replit workspace**
2. **Navigate to the "Deployments" tab** in the workspace tools panel (left sidebar)
3. **Click "Create Deployment"**
4. **Select "Scheduled"** as the deployment type

### Step 2: Configure the Scheduled Deployment

#### **Basic Configuration:**
- **Name**: `Chattanooga Daily Sync`
- **Description**: `Daily catalog synchronization for Chattanooga Shooting Supplies products`

#### **Schedule Configuration:**
- **Schedule**: `10 13 * * *` (6:10 AM PDT = 1:10 PM UTC)
- **Timezone**: `America/Los_Angeles` (Pacific Time)
- **Alternative for daylight saving**: `10 14 * * *` (7:10 AM PDT = 2:10 PM UTC)

#### **Command Configuration:**
- **Build Command**: `npm install` (optional, if dependencies need updating)
- **Run Command**: `tsx scripts/chattanooga-sync.ts`
- **Working Directory**: `/home/runner/workspace`

#### **Resource Configuration:**
- **CPU**: 1 vCPU (default)
- **Memory**: 2 GiB (recommended for CSV processing and API calls)
- **Timeout**: 30 minutes (1800 seconds)
- **Concurrency**: 1 (to prevent overlapping syncs)

### Step 3: Environment Variables

Ensure the following environment variables are available to the deployment:

#### **Required Database Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Set to `production`

#### **Required API Variables:**
- All Chattanooga API credentials are stored in the database and accessed automatically

### Step 4: Test the Deployment

#### **Manual Test:**
1. **Go to the Deployments tab**
2. **Find your "Chattanooga Daily Sync" deployment**
3. **Click "Run Now"** to test manually
4. **Check the logs** for successful execution

#### **Expected Output:**
```
🚀 CHATTANOOGA SYNC DEPLOYMENT: Starting...
📅 Started at: [timestamp]
⚙️  Sync type: INCREMENTAL
🔍 Dry run: NO
🔄 Force sync: NO
✅ CHATTANOOGA SYNC: Vendor validated
📥 CHATTANOOGA SYNC: Downloading catalog CSV...
✅ CHATTANOOGA SYNC: Downloaded CSV with [X] products
📊 CHATTANOOGA SYNC DEPLOYMENT: Results Summary
✅ Success: true
⏱️  Duration: [X] seconds
📦 Products processed: [X]
```

### Step 5: Monitor and Troubleshoot

#### **Success Indicators:**
- ✅ **Status**: "Success" in deployment logs
- ✅ **Duration**: 20-60 seconds (normal range)
- ✅ **Products**: 70,000+ products processed
- ✅ **Database**: `lastCatalogSync` updated in `supported_vendors` table

#### **Common Issues:**

**Issue: API Rate Limiting (429 errors)**
- **Solution**: Wait 20 minutes between manual runs
- **Prevention**: Don't run manual syncs during business hours

**Issue: Database Connection Errors**
- **Solution**: Verify `DATABASE_URL` is correct
- **Check**: Database server is accessible

**Issue: Memory Errors**
- **Solution**: Increase deployment memory to 4 GiB
- **Check**: Large CSV processing needs more RAM

**Issue: Timeout Errors**
- **Solution**: Increase timeout to 45-60 minutes
- **Check**: Network connectivity to Chattanooga API

### Step 6: Disable Internal Scheduler (Optional)

After confirming the Scheduled Deployment works correctly:

1. **Keep the internal scheduler disabled** (it already is)
2. **Monitor the Scheduled Deployment** for a few days
3. **Verify sync status** in the admin panel shows recent syncs

## Cost Analysis

### **Estimated Costs:**
- **Execution time**: ~24 seconds per sync
- **Daily cost**: $0.0015
- **Monthly cost**: $0.045
- **Annual cost**: $0.54

### **Included Credits:**
- **Replit Core Plan**: $25/month credits included
- **Your usage**: ~$0.045/month
- **Remaining credits**: ~$24.95/month

## Schedule Recommendations

### **Production Schedule:**
- **Daily**: 6:10 AM Pacific Time (`10 13 * * *` UTC winter, `10 14 * * *` UTC summer)
- **Frequency**: Daily is recommended for active catalogs
- **Weekdays Only**: Use `10 13 * * 1-5` if weekend syncs aren't needed

### **Alternative Schedules:**
- **Early Morning**: `0 13 * * *` (6:00 AM PDT)
- **Late Night**: `0 7 * * *` (11:00 PM PDT previous day)
- **Business Hours**: `30 20 * * *` (1:30 PM PDT)

## Monitoring and Maintenance

### **Daily Checks:**
1. **Deployment Status**: Check for successful runs
2. **Sync Status**: Verify in admin panel
3. **Error Logs**: Review any failures

### **Weekly Checks:**
1. **Product Count**: Ensure consistent product counts
2. **Performance**: Monitor execution times
3. **Costs**: Review deployment usage

### **Monthly Checks:**
1. **Cost Analysis**: Review monthly deployment costs
2. **Performance Trends**: Analyze execution patterns
3. **Update Dependencies**: Keep scripts updated

## Troubleshooting Commands

### **Manual Sync (for testing):**
```bash
# Test the sync script manually
tsx scripts/chattanooga-sync.ts --dry-run

# Run a full sync manually
tsx scripts/chattanooga-sync.ts --full

# Force sync regardless of changes
tsx scripts/chattanooga-sync.ts --force
```

### **Check Sync Status:**
```bash
# Check database status
tsx -e "
import { storage } from './server/storage.js';
const vendors = await storage.getAllSupportedVendors();
const chattanooga = vendors.find(v => v.name.toLowerCase().includes('chattanooga'));
console.log('Last Sync:', chattanooga?.lastCatalogSync);
console.log('Status:', chattanooga?.chattanoogaCsvSyncStatus);
"
```

## Migration Benefits

### **Reliability Improvements:**
1. **Guaranteed Execution**: Replit infrastructure handles scheduling
2. **Automatic Retry**: Built-in failure recovery
3. **Resource Management**: Dedicated resources for sync operations
4. **Monitoring**: Native deployment logs and status tracking

### **Operational Benefits:**
1. **Zero Maintenance**: No server dependencies
2. **Scalable**: Automatic resource allocation
3. **Cost Effective**: Pay only for execution time
4. **Centralized**: All deployments in one place

## Next Steps

1. **Create the Scheduled Deployment** using the configuration above
2. **Test manually** to ensure it works
3. **Monitor for 24-48 hours** to verify reliability
4. **Update admin panel** to show Scheduled Deployment status
5. **Document the setup** for future reference

## Support

If you encounter issues:
1. **Check deployment logs** for specific error messages
2. **Verify environment variables** are correctly set
3. **Test the script manually** to isolate issues
4. **Review this guide** for troubleshooting steps

---

**Created**: September 19, 2025  
**Purpose**: Replace disabled internal cron scheduler with reliable Scheduled Deployment  
**Cost**: ~$0.05/month (negligible)  
**Reliability**: Enterprise-grade with automatic retry and monitoring

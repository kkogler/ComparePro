# Sports South Scheduled Deployment Setup Guide

This guide walks you through setting up a Replit Scheduled Deployment for Sports South daily catalog synchronization, replacing the internal cron job system with Replit's more reliable Scheduled Deployment infrastructure.

## Overview

The Sports South Scheduled Deployment:
- Runs daily at 6:30 AM Pacific Time
- Performs incremental catalog synchronization by default
- Maintains all existing functionality including error handling and database status updates
- Provides improved reliability compared to internal cron jobs
- Includes comprehensive logging and status reporting

## Setup Instructions

### Step 1: Access Replit Deployments

1. Open your Replit workspace
2. Navigate to the **Deployments** tab in the workspace tools panel
3. Click **"Create Deployment"**
4. Select **"Scheduled"** as the deployment type

### Step 2: Configure the Scheduled Deployment

**Basic Configuration:**
- **Name**: `Sports South Daily Sync`
- **Description**: `Daily catalog synchronization for Sports South products`

**Schedule Configuration:**
- **Schedule**: `30 6 * * *` (6:30 AM UTC - adjust for Pacific Time)
- **Timezone**: `America/Los_Angeles` (Pacific Time)
- **Alternative schedule in Pacific Time**: `30 13 * * *` (6:30 AM Pacific = 1:30 PM UTC in winter, 2:30 PM UTC in summer)

**Command Configuration:**
- **Build Command**: `npm install` (optional, if dependencies need updating)
- **Run Command**: `tsx scripts/sports-south-sync.ts`
- **Working Directory**: `/home/runner/workspace` (or your project root)

**Resource Configuration:**
- **CPU**: 1 vCPU (default)
- **Memory**: 2 GiB (default)
- **Timeout**: 30 minutes (or 1800 seconds)
- **Concurrency**: 1 (to prevent overlapping syncs)

### Step 3: Environment Variables and Secrets

Ensure the following environment variables are available to the deployment:

**Required Database Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - Database connection details

**Optional Variables:**
- `NODE_ENV=production` - Set environment mode
- `TZ=America/Los_Angeles` - Timezone for logging

All Sports South credentials are stored in the database `supported_vendors` table and don't require additional environment variables.

### Step 4: Deployment Secrets

If you need to add deployment-specific secrets:

1. In the deployment configuration, click **"Add Secret"**
2. Add any required secrets (though Sports South credentials are stored in the database)

### Step 5: Deploy and Test

1. Click **"Deploy"** to create the scheduled deployment
2. Wait for the initial deployment to complete
3. Test the deployment manually by clicking **"Run Now"** in the deployment interface
4. Monitor the logs to ensure the sync completes successfully

## Script Options

The Sports South sync script supports several command-line options:

```bash
# Default incremental sync
tsx scripts/sports-south-sync.ts

# Full catalog sync (use for initial setup or when recovering from errors)
tsx scripts/sports-south-sync.ts --full

# Dry run to preview changes without making database updates
tsx scripts/sports-south-sync.ts --dry-run

# Full sync dry run
tsx scripts/sports-south-sync.ts --full --dry-run

# Show help
tsx scripts/sports-south-sync.ts --help
```

**For Scheduled Deployment**, use the default command (no options) for reliable daily incremental syncs.

## Monitoring and Troubleshooting

### Log Monitoring

The deployment logs will show:
- Sync start and completion times
- Number of products processed, updated, and created
- Any errors or warnings during the sync
- Final status summary

### Status Checking

The sync updates the `supported_vendors` table with:
- `catalogSyncStatus`: 'success', 'error', or 'in_progress'
- `lastCatalogSync`: Timestamp of last successful sync
- `catalogSyncError`: Error message if sync fails

### Common Issues and Solutions

**Issue: Sync stuck in 'in_progress' status**
- Solution: The script automatically detects and resets stuck syncs on startup

**Issue: Authentication errors**
- Solution: Verify Sports South credentials in the admin panel
- Check that `adminCredentials` contains `userName`, `customerNumber`, and `password`

**Issue: Timeout errors**
- Solution: Increase deployment timeout to 45-60 minutes for large catalogs
- Consider using `--full` sync only when necessary

**Issue: Memory errors**
- Solution: Increase deployment memory to 4 GiB for large sync operations

### Manual Sync Execution

If you need to run a manual sync:

```bash
# Connect to your Replit shell and run:
tsx scripts/sports-south-sync.ts

# Or for a full sync:
tsx scripts/sports-south-sync.ts --full
```

## Migration from Cron Jobs

This Scheduled Deployment replaces the internal Sports South cron job system. The benefits include:

1. **Improved Reliability**: Replit's infrastructure handles scheduling more reliably than internal cron
2. **Better Monitoring**: Native deployment logs and status tracking
3. **Resource Management**: Dedicated resources for sync operations
4. **Timeout Management**: Configurable timeouts prevent hung syncs
5. **Error Recovery**: Automatic detection and recovery from stuck syncs

### Disabling Internal Cron (Optional)

After confirming the Scheduled Deployment works correctly, you can disable the internal cron:

1. Access the Sports South configuration in the admin panel
2. Set "Schedule Enabled" to `false`
3. This prevents conflicts between the internal cron and Scheduled Deployment

## Schedule Recommendations

**Production Schedule:**
- **Daily**: 6:30 AM Pacific Time (`30 13 * * *` UTC in winter, `30 14 * * *` UTC in summer)
- **Frequency**: Daily is recommended for active catalogs
- **Weekdays Only**: Use `30 13 * * 1-5` if weekend syncs aren't needed

**Development/Testing Schedule:**
- **Weekly**: Monday at 6:30 AM Pacific (`30 13 * * 1`)
- **Manual**: Disable automatic scheduling and run manually as needed

## Performance Considerations

- **Incremental Sync**: Typically processes 500-2000 products in 2-5 minutes
- **Full Sync**: Can process 50,000+ products in 30-60 minutes
- **Memory Usage**: Usually under 1 GiB for incremental, may need 2-4 GiB for full sync
- **Network**: Stable connection required for Sports South API calls

## Support and Maintenance

**Regular Maintenance:**
- Monitor deployment logs weekly
- Check sync status in the admin dashboard
- Review error rates and investigate recurring issues

**Escalation Path:**
- Check deployment logs for specific error messages
- Verify database connectivity and Sports South API status
- Use `--dry-run` to test sync logic without making changes
- Contact support if API authentication issues persist

## Cost Considerations

Replit Core members receive $25 in monthly credits for Scheduled Deployments:
- Daily syncs typically use minimal credits (under $5/month)
- Full syncs use more resources but are infrequent
- Monitor usage in the Replit billing dashboard
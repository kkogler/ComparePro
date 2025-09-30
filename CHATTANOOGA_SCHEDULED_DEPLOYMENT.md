# Chattanooga Scheduled Deployment Setup Guide

This guide walks you through setting up a Replit Scheduled Deployment for Chattanooga Shooting Supplies daily catalog synchronization, replacing the internal cron job system with Replit's more reliable Scheduled Deployment infrastructure.

## Overview

The Chattanooga Scheduled Deployment:
- Runs daily at 2:15 PM Pacific Time
- Performs CSV catalog synchronization via API download
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
- **Name**: `Chattanooga Daily Sync`
- **Description**: `Daily catalog synchronization for Chattanooga Shooting Supplies products`

**Schedule Configuration:**
- **Schedule**: `15 21 * * *` (2:15 PM PDT = 9:15 PM UTC in winter, 10:15 PM UTC in summer)
- **Timezone**: `America/Los_Angeles` (Pacific Time)
- **Alternative for summer time**: `15 22 * * *` (10:15 PM UTC for daylight saving time)

**Command Configuration:**
- **Build Command**: `npm install` (optional, if dependencies need updating)
- **Run Command**: `tsx scripts/chattanooga-sync.ts`
- **Working Directory**: `/home/runner/workspace` (or your project root)

**Resource Configuration:**
- **CPU**: 1 vCPU (default)
- **Memory**: 2 GiB (recommended for CSV processing and API calls)
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

All Chattanooga API credentials are stored in the database `supported_vendors` table and don't require additional environment variables.

### Step 4: Deployment Secrets

If you need to add deployment-specific secrets:

1. In the deployment configuration, click **"Add Secret"**
2. Add any required secrets (though Chattanooga credentials are stored in the database)

### Step 5: Deploy and Test

1. Click **"Deploy"** to create the scheduled deployment
2. Wait for the initial deployment to complete
3. Test the deployment manually by clicking **"Run Now"** in the deployment interface
4. Monitor the logs to ensure the sync completes successfully

## Script Options

The Chattanooga sync script supports several command-line options:

```bash
# Default incremental sync
tsx scripts/chattanooga-sync.ts

# Full catalog sync (use for initial setup or when recovering from errors)
tsx scripts/chattanooga-sync.ts --full

# Dry run to preview changes without making database updates
tsx scripts/chattanooga-sync.ts --dry-run

# Full sync dry run
tsx scripts/chattanooga-sync.ts --full --dry-run

# Show help
tsx scripts/chattanooga-sync.ts --help
```

**For Scheduled Deployment**, use the default command (no options) for reliable daily incremental syncs.

## Monitoring and Troubleshooting

### Log Monitoring

The deployment logs will show:
- API authentication and connection status
- CSV download progress and file size
- Product processing statistics (added, updated, skipped, failed)
- Change detection results (sync skipped if no changes)
- Database update progress
- Any errors or warnings during the sync
- Final status summary with timing information

### Status Checking

The sync updates the `supported_vendors` table with:
- `chattanoogaCsvSyncStatus`: 'success', 'error', 'in_progress', or 'never_synced'
- `chattanoogaLastCsvDownload`: Timestamp of last successful CSV download
- `chattanoogaCsvSyncError`: Error message if CSV sync fails
- `chattanoogaTotalRecords`: Total number of records processed
- `chattanoogaRecordsAdded`: Number of new records added
- `chattanoogaRecordsUpdated`: Number of records updated
- `chattanoogaRecordsSkipped`: Number of records skipped
- `chattanoogaRecordsFailed`: Number of records that failed processing

### Common Issues and Solutions

**Issue: Sync stuck in 'in_progress' status**
- Solution: The script automatically detects and resets stuck syncs on startup

**Issue: API authentication errors (401/403)**
- Solution: Verify Chattanooga API credentials in the admin panel
- Check that `adminCredentials` contains `username`, `password`, `accountNumber`, `sid`, and `token`
- Verify API endpoint URLs are correct

**Issue: CSV download errors (404/500)**
- Solution: Check Chattanooga API status and endpoint availability
- Verify API credentials have proper permissions
- The script includes automatic retry with exponential backoff

**Issue: CSV parsing errors**
- Solution: Check for malformed CSV headers or encoding issues
- The script includes basic header repair for common issues
- Enable `--dry-run` to test parsing without database changes

**Issue: Database connection errors**
- Solution: Verify database credentials and connectivity
- Check that `DATABASE_URL` is properly configured
- Ensure database server is accessible from Replit

**Issue: Memory errors during large syncs**
- Solution: Increase deployment memory to 4 GiB for very large catalogs
- Consider using `--incremental` for routine updates

**Issue: Timeout errors**
- Solution: Increase deployment timeout to 45-60 minutes for large catalogs
- Check network connectivity to Chattanooga API

### Manual Sync Execution

If you need to run a manual sync:

```bash
# Connect to your Replit shell and run:
tsx scripts/chattanooga-sync.ts

# Or for a full sync:
tsx scripts/chattanooga-sync.ts --full

# Or for a dry run:
tsx scripts/chattanooga-sync.ts --dry-run
```

## Migration from Cron Jobs

This Scheduled Deployment replaces the internal Chattanooga cron job system. The benefits include:

1. **Improved Reliability**: Replit's infrastructure handles scheduling more reliably than internal cron
2. **Better Resource Management**: Dedicated resources for sync operations
3. **Enhanced Monitoring**: Native deployment logs and status tracking
4. **Timeout Management**: Configurable timeouts prevent hung syncs
5. **Error Recovery**: Automatic detection and recovery from stuck syncs
6. **API Resilience**: Built-in retry logic with exponential backoff for API issues

### Disabling Internal Cron (Optional)

After confirming the Scheduled Deployment works correctly, you can disable the internal cron:

1. Access the Chattanooga configuration in the admin panel
2. Set "Schedule Enabled" to `false`
3. This prevents conflicts between the internal cron and Scheduled Deployment

## Schedule Recommendations

**Production Schedule:**
- **Daily**: 2:15 PM Pacific Time (`15 21 * * *` UTC in winter, `15 22 * * *` UTC in summer)
- **Frequency**: Daily is recommended for active catalogs
- **Weekdays Only**: Use `15 21 * * 1-5` if weekend syncs aren't needed

**Development/Testing Schedule:**
- **Weekly**: Monday at 2:15 PM Pacific (`15 21 * * 1`)
- **Manual**: Disable automatic scheduling and run manually as needed

## Performance Considerations

- **Incremental Sync**: Typically processes 1,000-5,000 products in 3-8 minutes
- **Full Sync**: Can process 20,000+ products in 15-30 minutes
- **API Calls**: Depends on API response times (usually 30 seconds to 2 minutes)
- **Change Detection**: Skips processing if no changes detected (very fast, under 1 minute)
- **Memory Usage**: Usually under 2 GiB for incremental, may need 3-4 GiB for full sync
- **Network**: Stable connection required for Chattanooga API calls

## API Configuration Details

**Authentication:**
- **Method**: API key-based authentication
- **Credentials**: Stored securely in database
- **Retry Logic**: 3 attempts with exponential backoff (2s, 4s, 8s delays)
- **Timeout**: 30 seconds for API calls, 60 seconds for CSV downloads

**Endpoints:**
- **CSV Download**: `/api/catalog/export` (or similar endpoint)
- **Authentication**: `/api/auth/login` (or similar endpoint)

**Security:**
- API credentials stored securely in database
- Connection tracking and progress monitoring
- Automatic credential validation before sync

## Priority System Details

Chattanooga operates with **priority 2** in the vendor priority system:

- **Priority 1**: Sports South (highest priority, overwrites all others)
- **Priority 2**: Chattanooga Shooting (overwrites priority 3+)
- **Priority 3**: Bill Hicks & Co. (overwrites priority 4+)
- **Priority 4**: Lipsey's, GunBroker (lowest priority)

**Update Behavior:**
- Chattanooga will **add new products** that don't exist in the system
- Chattanooga will **update existing products** only if the current source has priority > 2
- Chattanooga will **skip products** that already have sources with priority ≤ 2
- This ensures higher-priority vendor data is preserved

## Support and Maintenance

**Regular Maintenance:**
- Monitor deployment logs weekly
- Check sync status in the admin dashboard
- Review error rates and investigate recurring issues
- Verify API connectivity if syncs fail

**Escalation Path:**
- Check deployment logs for specific error messages
- Verify database connectivity and Chattanooga API status
- Use `--dry-run` to test sync logic without making changes
- Use `--full` to force a complete sync if needed
- Contact support if API authentication issues persist

## Cost Considerations

Replit Core members receive $25 in monthly credits for Scheduled Deployments:
- Daily syncs typically use minimal credits (under $5/month)
- Full syncs use more resources but are infrequent
- Monitor usage in the Replit billing dashboard

## Advanced Usage

**Testing Changes:**
```bash
# Test sync without changes
tsx scripts/chattanooga-sync.ts --dry-run

# Test full sync
tsx scripts/chattanooga-sync.ts --full --dry-run

# Force full sync (bypass change detection)
tsx scripts/chattanooga-sync.ts --full
```

**Debugging Issues:**
1. Enable dry-run mode to test without database changes
2. Check API connectivity manually from shell
3. Review previous sync timestamps and error messages in database
4. Use full sync mode if incremental sync is problematic
5. Monitor memory usage for large catalogs

**Integration with Existing System:**
- Maintains compatibility with existing Chattanooga sync infrastructure
- Updates same database fields and status tracking
- Preserves priority-based update logic
- Compatible with admin dashboard displays

## Timezone Handling

**Important Notes:**
- **Pacific Time**: 2:15 PM PDT (UTC-7) or PST (UTC-8)
- **UTC Conversion**: 
  - Winter (PST): 2:15 PM PST = 10:15 PM UTC (`15 22 * * *`)
  - Summer (PDT): 2:15 PM PDT = 9:15 PM UTC (`15 21 * * *`)
- **Automatic Adjustment**: Replit handles daylight saving time automatically
- **Logging**: All timestamps in Pacific Time for consistency

## Troubleshooting Checklist

**Before Deployment:**
- [ ] Verify Chattanooga API credentials in admin panel
- [ ] Test API connectivity manually
- [ ] Confirm database connection
- [ ] Check script syntax with `--dry-run`

**After Deployment:**
- [ ] Monitor first few runs closely
- [ ] Check deployment logs for errors
- [ ] Verify sync status in admin dashboard
- [ ] Confirm products are being updated correctly

**Ongoing Monitoring:**
- [ ] Weekly log review
- [ ] Monthly sync status verification
- [ ] Quarterly credential validation
- [ ] Annual schedule review and adjustment

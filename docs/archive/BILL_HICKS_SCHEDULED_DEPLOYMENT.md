# Bill Hicks Scheduled Deployment Setup Guide

This guide walks you through setting up a Replit Scheduled Deployment for Bill Hicks daily catalog synchronization, replacing the internal cron job system with Replit's more reliable Scheduled Deployment infrastructure.

## Overview

The Bill Hicks Scheduled Deployment:
- Runs daily at 9:15 AM Pacific Time
- Performs catalog and/or inventory synchronization via FTP from MicroBiz server
- Maintains priority-based product updates (Bill Hicks priority 3 only overwrites lower priority vendors)
- Includes comprehensive error handling, change detection, and database status updates
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
- **Name**: `Bill Hicks Daily Catalog Sync`
- **Description**: `Daily catalog synchronization for Bill Hicks products via FTP`

**Schedule Configuration:**
- **Schedule**: `15 16 * * *` (9:15 AM Pacific = 4:15 PM UTC in winter, 5:15 PM UTC in summer)
- **Timezone**: `America/Los_Angeles` (Pacific Time)
- **Alternative for summer time**: `15 17 * * *` (5:15 PM UTC for daylight saving time)

**Command Configuration:**
- **Build Command**: `npm install` (optional, if dependencies need updating)
- **Run Command**: `curl -X POST http://localhost:3001/api/admin/bill-hicks/manual-inventory-sync` (or use HTTP endpoint)
- **Working Directory**: `/home/runner/workspace` (or your project root)

**Resource Configuration:**
- **CPU**: 1 vCPU (default)
- **Memory**: 2 GiB (recommended for FTP downloads and CSV processing)
- **Timeout**: 45 minutes (or 2700 seconds) - allows time for large FTP downloads
- **Concurrency**: 1 (to prevent overlapping syncs)

### Step 3: Environment Variables and Secrets

Ensure the following environment variables are available to the deployment:

**Required Database Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - Database connection details

**Optional Variables:**
- `NODE_ENV=production` - Set environment mode
- `TZ=America/Los_Angeles` - Timezone for logging

All Bill Hicks FTP credentials are stored in the database `supported_vendors` table and don't require additional environment variables.

### Step 4: Deployment Secrets

If you need to add deployment-specific secrets:

1. In the deployment configuration, click **"Add Secret"**
2. Add any required secrets (though Bill Hicks FTP credentials are stored in the database)

### Step 5: Deploy and Test

1. Click **"Deploy"** to create the scheduled deployment
2. Wait for the initial deployment to complete
3. Test the deployment manually by clicking **"Run Now"** in the deployment interface
4. Monitor the logs to ensure the sync completes successfully

## API Endpoints

The Bill Hicks sync is now handled via HTTP API endpoints:

```bash
# Full catalog sync (via API endpoint)
curl -X POST http://localhost:3001/api/admin/bill-hicks/manual-master-catalog-sync

# Inventory-only sync (via API endpoint)  
curl -X POST http://localhost:3001/api/admin/bill-hicks/manual-inventory-sync
```

**For Scheduled Deployment**, use the inventory sync endpoint for reliable daily syncs.

## Monitoring and Troubleshooting

### Log Monitoring

The deployment logs will show:
- FTP connection and download progress
- CSV parsing and processing status
- Priority-based update decisions (which products were updated vs. skipped)
- Change detection results (sync skipped if no changes)
- Number of products processed, updated, added, and skipped
- Any errors or warnings during the sync
- Final status summary with timing information

### Status Checking

The sync updates the `supported_vendors` table with:
- `billHicksMasterCatalogSyncStatus`: 'success', 'error', or 'in_progress'
- `billHicksMasterCatalogLastSync`: Timestamp of last successful catalog sync
- `billHicksMasterCatalogSyncError`: Error message if catalog sync fails
- `billHicksInventorySyncStatus`: 'success', 'error', or 'in_progress' (for inventory-only syncs)
- `billHicksLastInventorySync`: Timestamp of last successful inventory sync
- `billHicksInventorySyncError`: Error message if inventory sync fails

### Common Issues and Solutions

**Issue: Sync stuck in 'in_progress' status**
- Solution: The script automatically detects and resets stuck syncs on startup

**Issue: FTP authentication errors (530)**
- Solution: Verify Bill Hicks FTP credentials in the admin panel
- Check that `adminCredentials` contains `ftpServer`, `ftpUsername`, and `ftpPassword`
- Verify FTP server URL format (should include protocol if FTPS)

**Issue: FTP file not found errors (550)**
- Solution: Verify FTP file paths are correct
- Catalog path: `/MicroBiz/Feeds/MicroBiz_Daily_Catalog.csv`
- Inventory path: `/MicroBiz/Feeds/MicroBiz_Hourly_Inventory.csv`

**Issue: FTP timeout errors**
- Solution: Increase deployment timeout to 60 minutes for large files
- Check network connectivity to Bill Hicks FTP server
- The script includes automatic retry with exponential backoff

**Issue: CSV parsing errors**
- Solution: Check for malformed CSV headers or encoding issues
- The script includes basic header repair for common issues
- Enable `--dry-run` to test parsing without database changes

**Issue: Priority conflicts (products not updating)**
- Solution: This is expected behavior - Bill Hicks (priority 3) only overwrites vendors with priority > 3
- Check product sources in the database to understand priority conflicts
- Use admin tools to manually override priority if needed

**Issue: Memory errors during large syncs**
- Solution: Increase deployment memory to 4 GiB for very large catalogs
- Consider using `--inventory-only` for routine updates

### Manual Sync Execution

If you need to run a manual sync:

```bash
# Connect to your Replit shell and run:
curl -X POST http://localhost:3001/api/admin/bill-hicks/manual-master-catalog-sync

# Or for inventory only:
curl -X POST http://localhost:3001/api/admin/bill-hicks/manual-inventory-sync
```

## Migration from Cron Jobs

This Scheduled Deployment replaces the internal Bill Hicks cron job system. The benefits include:

1. **Improved Reliability**: Replit's infrastructure handles scheduling more reliably than internal cron
2. **Better Resource Management**: Dedicated resources for sync operations
3. **Enhanced Monitoring**: Native deployment logs and status tracking
4. **Timeout Management**: Configurable timeouts prevent hung syncs
5. **Error Recovery**: Automatic detection and recovery from stuck syncs
6. **FTP Resilience**: Built-in retry logic with exponential backoff for FTP issues

### Disabling Internal Cron (Optional)

After confirming the Scheduled Deployment works correctly, you can disable the internal cron:

1. Access the Bill Hicks configuration in the admin panel
2. Set "Master Catalog Sync Enabled" to `false`
3. Set "Inventory Sync Enabled" to `false` (if using inventory-only scheduled sync)
4. This prevents conflicts between the internal cron and Scheduled Deployment

## Schedule Recommendations

**Production Schedule:**
- **Daily Catalog**: 9:15 AM Pacific Time (`15 16 * * *` UTC in winter, `15 17 * * *` UTC in summer)
- **Frequency**: Daily is recommended for active catalogs
- **Weekdays Only**: Use `15 16 * * 1-5` if weekend syncs aren't needed

**Development/Testing Schedule:**
- **Weekly**: Monday at 9:15 AM Pacific (`15 16 * * 1`)
- **Manual**: Disable automatic scheduling and run manually as needed

## Performance Considerations

- **Catalog Sync**: Typically processes 10,000-25,000+ products in 10-30 minutes
- **Inventory Sync**: Usually faster, processing inventory updates in 2-10 minutes
- **FTP Download**: Depends on file size and network speed (usually 30 seconds to 5 minutes)
- **Change Detection**: Skips processing if no changes detected (very fast, under 1 minute)
- **Memory Usage**: Usually under 2 GiB for catalog, under 1 GiB for inventory
- **Network**: Stable FTP connection required to Bill Hicks MicroBiz server

## Priority System Details

Bill Hicks operates with **priority 3** in the vendor priority system:

- **Priority 1**: Sports South (highest priority, overwrites all others)
- **Priority 2**: Chattanooga Shooting (overwrites priority 3+)
- **Priority 3**: Bill Hicks & Co. (overwrites priority 4+)
- **Priority 4**: Lipsey's, GunBroker (lowest priority)

**Update Behavior:**
- Bill Hicks will **add new products** that don't exist in the system
- Bill Hicks will **update existing products** only if the current source has priority > 3
- Bill Hicks will **skip products** that already have sources with priority ≤ 3
- This ensures higher-priority vendor data is preserved

## FTP Configuration Details

**Server Configuration:**
- **Protocol**: FTP or FTPS (auto-detected from URL)
- **Connection Timeout**: 30 seconds
- **Data Transfer Timeout**: 60 seconds
- **Retry Logic**: 3 attempts with exponential backoff (2s, 4s, 8s delays)

**File Paths:**
- **Catalog**: `/MicroBiz/Feeds/MicroBiz_Daily_Catalog.csv`
- **Inventory**: `/MicroBiz/Feeds/MicroBiz_Hourly_Inventory.csv`

**Security:**
- FTP credentials stored securely in database
- FTPS supported if server URL includes `ftps://` protocol
- Connection tracking and progress monitoring

## Support and Maintenance

**Regular Maintenance:**
- Monitor deployment logs weekly
- Check sync status in the admin dashboard
- Review error rates and investigate recurring issues
- Verify FTP connectivity if syncs fail

**Escalation Path:**
- Check deployment logs for specific error messages
- Verify database connectivity and Bill Hicks FTP server status
- Use `--dry-run` to test sync logic without making changes
- Use `--force` to override change detection if needed
- Contact support if FTP authentication issues persist

## Cost Considerations

Replit Core members receive $25 in monthly credits for Scheduled Deployments:
- Daily syncs typically use minimal credits (under $5/month)
- Large catalog syncs may use more resources but are manageable
- Monitor usage in the Replit billing dashboard
- Consider using `--inventory-only` for routine updates to reduce costs

## Advanced Usage

**Testing Changes:**
```bash
# Test catalog sync
curl -X POST http://localhost:3001/api/admin/bill-hicks/manual-master-catalog-sync

# Test inventory sync
curl -X POST http://localhost:3001/api/admin/bill-hicks/manual-inventory-sync
```

**Debugging Issues:**
1. Enable dry-run mode to test without database changes
2. Check FTP connectivity manually from shell
3. Review previous sync timestamps and error messages in database
4. Use force mode if change detection is problematic
5. Monitor memory usage for large catalogs

**Integration with Existing System:**
- Maintains compatibility with existing Bill Hicks sync infrastructure
- Updates same database fields and status tracking
- Preserves priority-based update logic
- Compatible with admin dashboard displays

## Recent Changes

- Catalog updates now include a no-op skip: after priority checks, if the mapped product fields are identical to the existing product, the update is skipped. This reduces runtime and DB writes when few rows change.
- Admin reset endpoints now resolve the Bill Hicks vendor robustly by normalized short code/name.
# Bill Hicks Hourly Inventory Sync - Scheduled Deployment

## Overview

This document provides step-by-step instructions for creating a Replit Scheduled Deployment for the Bill Hicks hourly inventory synchronization. This deployment will run every hour to provide real-time inventory updates.

## Deployment Configuration

### Step 1: Access Replit Deployments

1. **Open your Replit workspace**
2. **Navigate to the "Deployments" tab** in the left sidebar
3. **Click "Create Deployment"**
4. **Select "Scheduled" as the deployment type**

### Step 2: Configure the Scheduled Deployment

**Basic Configuration:**
- **Name**: `Bill Hicks Hourly Inventory Sync`
- **Description**: `Hourly inventory synchronization for Bill Hicks products via FTP`

**Schedule Configuration:**
- **Schedule**: `0 * * * *` (Every hour on the hour)
- **Timezone**: `America/Los_Angeles` (Pacific Time)

**Command Configuration:**
- **Build Command**: `npm install` (optional, if dependencies need updating)
- **Run Command**: `curl -X POST http://localhost:3001/api/admin/bill-hicks/manual-inventory-sync`
- **Working Directory**: `/home/runner/workspace`

**Resource Configuration:**
- **CPU**: 1 vCPU (default)
- **Memory**: 1 GiB (sufficient for inventory-only updates)
- **Timeout**: 15 minutes (900 seconds) - inventory syncs are faster
- **Concurrency**: 1 (to prevent overlapping syncs)

### Step 3: Environment Variables

Ensure these environment variables are available:
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV=production` (optional)
- `TZ=America/Los_Angeles` (optional, for logging)

### Step 4: Deploy and Test

1. **Click "Deploy"** to create the scheduled deployment
2. **Wait for initial deployment** to complete
3. **Test manually** by clicking "Run Now" in the deployment interface
4. **Monitor logs** to ensure sync completes successfully

## What This Deployment Does

### Hourly Inventory Sync Process:
1. **FTP Connection**: Connects to Bill Hicks MicroBiz FTP server
2. **File Download**: Downloads `/MicroBiz/Feeds/MicroBiz_Hourly_Inventory.csv`
3. **Change Detection**: Checks if inventory has changed since last sync
4. **Inventory Processing**: Updates existing product inventory levels
5. **Database Updates**: Updates `vendor_inventory` table only
6. **Status Tracking**: Updates inventory sync status in `supported_vendors` table

### Key Features:
- ✅ **Lightweight Operation**: Inventory-only updates (no catalog changes)
- ✅ **Change Detection**: Skips sync if no inventory changes detected
- ✅ **Error Handling**: Comprehensive retry logic and error reporting
- ✅ **Status Tracking**: Updates sync status in database
- ✅ **Progress Logging**: Detailed console output for monitoring
- ✅ **Compatibility**: Maintains existing Bill Hicks sync system

## Monitoring and Troubleshooting

### Success Indicators:
- ✅ FTP connection established
- ✅ Inventory CSV downloaded successfully
- ✅ Inventory records updated without errors
- ✅ Sync status updated to "success"
- ✅ Processing completed in under 15 minutes

### Common Issues:
- **FTP Connection Failed**: Check Bill Hicks FTP credentials in admin panel
- **File Not Found**: Verify Bill Hicks is uploading inventory files
- **Database Errors**: Check database connectivity and permissions
- **No Changes**: Normal behavior - sync skipped if no inventory changes

### Log Monitoring:
The deployment logs will show:
- FTP connection and download progress
- CSV parsing and processing status
- Change detection results (sync skipped if no changes)
- Number of inventory records updated/skipped
- Final status summary with timing

## Expected Performance:
- **Processing Time**: 2-10 minutes (usually under 5 minutes)
- **Memory Usage**: Under 1 GiB
- **Network**: Stable FTP connection required
- **Change Detection**: Skips processing if no changes (under 1 minute)
- **Frequency**: Every hour, 24/7

## Prerequisites

### Bill Hicks Vendor Configuration:
Ensure the following are configured in your admin panel:

1. **Go to Admin > Supported Vendors > Bill Hicks**
2. **Verify FTP credentials are set**:
   - FTP Server hostname
   - FTP Username
   - FTP Password
3. **Check connection status** shows "online"
4. **Enable inventory sync** if not already enabled

### Database Requirements:
- Bill Hicks vendor record exists in `supported_vendors` table
- FTP credentials stored in `adminCredentials` field
- Database connection accessible from deployment

## Next Steps:
After setting up the hourly inventory sync, you should also create the daily catalog sync deployment for complete Bill Hicks synchronization.
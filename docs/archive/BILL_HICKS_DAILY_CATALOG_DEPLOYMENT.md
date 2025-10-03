# Bill Hicks Daily Catalog Sync - Scheduled Deployment

## Overview

This document provides step-by-step instructions for creating a Replit Scheduled Deployment for the Bill Hicks daily catalog synchronization. This deployment will run daily at 9:15 AM Pacific Time to sync the complete product catalog from Bill Hicks.

## Deployment Configuration

### Step 1: Access Replit Deployments

1. **Open your Replit workspace**
2. **Navigate to the "Deployments" tab** in the left sidebar
3. **Click "Create Deployment"**
4. **Select "Scheduled" as the deployment type**

### Step 2: Configure the Scheduled Deployment

**Basic Configuration:**
- **Name**: `Bill Hicks Daily Catalog Sync`
- **Description**: `Daily catalog synchronization for Bill Hicks products via FTP`

**Schedule Configuration:**
- **Schedule**: `15 16 * * *` (9:15 AM Pacific = 4:15 PM UTC in winter)
- **Timezone**: `America/Los_Angeles` (Pacific Time)
- **Alternative for summer time**: `15 17 * * *` (5:15 PM UTC for daylight saving time)

**Command Configuration:**
- **Build Command**: `npm install` (optional, if dependencies need updating)
- **Run Command**: `curl -X POST http://localhost:3001/api/admin/bill-hicks/manual-master-catalog-sync`
- **Working Directory**: `/home/runner/workspace`

**Resource Configuration:**
- **CPU**: 1 vCPU (default)
- **Memory**: 2 GiB (recommended for FTP downloads and CSV processing)
- **Timeout**: 45 minutes (2700 seconds) - allows time for large FTP downloads
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

### Daily Catalog Sync Process:
1. **FTP Connection**: Connects to Bill Hicks MicroBiz FTP server
2. **File Download**: Downloads `/MicroBiz/Feeds/MicroBiz_Daily_Catalog.csv`
3. **Change Detection**: Checks if file has changed since last sync
4. **Product Processing**: Processes 10,000-25,000+ products
5. **Priority Updates**: Updates products based on vendor priority system
6. **Database Updates**: Updates `products` table with new/updated product data
7. **Status Tracking**: Updates sync status in `supported_vendors` table

### Priority System:
- **Bill Hicks Priority**: 3 (overwrites priority 4+ vendors)
- **Update Behavior**: Only updates products from lower priority vendors
- **Preserves**: Higher priority vendor data (Sports South, Chattanooga)

## Monitoring and Troubleshooting

### Success Indicators:
- ✅ FTP connection established
- ✅ CSV file downloaded successfully
- ✅ Products processed without errors
- ✅ Database updates completed
- ✅ Sync status updated to "success"

### Common Issues:
- **FTP Connection Failed**: Check Bill Hicks FTP credentials in admin panel
- **File Not Found**: Verify Bill Hicks is uploading files to correct path
- **Database Errors**: Check database connectivity and permissions
- **Timeout**: Increase timeout if processing large files

### Log Monitoring:
The deployment logs will show:
- FTP connection and download progress
- CSV parsing and processing status
- Priority-based update decisions
- Change detection results
- Number of products processed/updated/skipped
- Final status summary with timing

## Expected Performance:
- **Processing Time**: 10-30 minutes for full catalog
- **Memory Usage**: Under 2 GiB
- **Network**: Stable FTP connection required
- **Change Detection**: Skips processing if no changes (under 1 minute)

## Next Steps:
After setting up the daily catalog sync, you'll also want to create the hourly inventory sync deployment for real-time inventory updates.

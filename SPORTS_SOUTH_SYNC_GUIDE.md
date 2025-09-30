# Sports South Catalog Sync Guide

## Overview
- Source: Sports South DailyItemUpdate web service (XML). No CSV download.
- Modes:
  - Incremental: fetches items changed since last successful sync timestamp.
  - Full: uses an early date to fetch the entire catalog.
- Key behavior:
  - High-quality names pulled from SHDESC when available.
  - UPC normalization and padding where needed.
  - Priority system applies when updating master catalog.

## Admin Endpoints
- Full catalog sync:
```bash
POST /api/sports-south/catalog/sync-full
```
- Incremental catalog sync:
```bash
POST /api/sports-south/catalog/sync-incremental
```
- Catalog info (status/last sync):
```bash
GET /api/sports-south/catalog/info
```

## What Incremental Sync Does
- Uses last success timestamp to query `DailyItemUpdate` and process only updates.
- If no updates are returned, logging shows “No updates found since last sync.”
- No CSV is saved; processing occurs in-memory from API XML responses.

## Scheduling (optional)
- Configure a cron or external scheduler to call the incremental endpoint periodically (e.g., hourly or daily).
- Ensure credentials are configured in Admin > Supported Vendors > Sports South.

## Logs to Expect
- Start messages for full or incremental sync
- Timestamps used for incremental
- Counts of parsed/updated/new/skipped products
- Final summary or error message

## Troubleshooting
- No updates found repeatedly:
  - Confirm the last sync timestamp is correct and recent.
  - Run a full sync if needed to refresh the baseline.
- API errors (HTTP status):
  - Verify Sports South credentials (username, customer number, password) in Admin.
  - Check network/firewall for access to Sports South API.
- Parsing issues:
  - Logs show parsed structure keys; confirm `SHDESC` availability.
  - Fallback uses standard description fields when `SHDESC` is missing.

## Performance Notes
- Incremental runs are fast when few changes; processing is bounded by API response size.
- Full sync can take 10–15 minutes depending on catalog size and network.

## Priority System
- Sports South typically has highest priority; it overwrites lower-priority vendor data.
- Conflicts resolved according to configured priorities in supported vendors.





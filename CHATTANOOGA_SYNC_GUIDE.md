# Chattanooga Shooting Supplies Sync Guide

## Overview
- Source: CSV feed download (file-based).
- Modes: manual and scheduled CSV sync.
- Change detection: file-level hash (MD5) of CSV; if unchanged, skip processing.
- Processing: parse CSV and apply updates with vendor priority rules.

## Admin Controls
- Manual CSV Sync (button in Admin UI for Chattanooga).
- Schedule management where configured via scheduler.

## Logs to Expect
- CSV download start/completion
- Parse start/completion and number of rows
- Counts of added/updated/skipped/failed
- Final summary or error

## Troubleshooting
- CSV not found or 404:
  - Verify CSV URL/path and credentials (if required).
- Parsing errors:
  - Check header changes or encoding; adjust mapping as needed.
- No changes detected every run:
  - Confirm file actually updates at the source.
  - Force a run by clearing the previous hash file if needed for testing.

## Performance Notes
- If CSV unchanged, run completes quickly (skips processing).
- If changed, processing time depends on number of rows; consider batching.

## Priority System
- Vendor priority determines whether Chattanooga can overwrite existing product data.
- Verify priorities in Supported Vendors to get expected overwrite behavior.





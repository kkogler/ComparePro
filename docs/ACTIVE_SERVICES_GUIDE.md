# Active Services Quick Reference Guide
**Updated:** October 4, 2025

Use this guide to quickly identify which service files are currently active and in production use.

---

## 🟢 ACTIVE SERVICES (Use These)

### Vendor Sync Services

| Vendor | File | Purpose |
|--------|------|---------|
| **Bill Hicks** | `bill-hicks-simple-sync.ts` | Master catalog sync (FTP download & processing) |
| **Bill Hicks** | `bill-hicks-store-pricing-sync.ts` | Store-specific pricing & inventory sync |
| **Sports South** | `sports-south-simple-sync.ts` | Incremental catalog sync via API |
| **Chattanooga** | `chattanooga-scheduler.ts` | CSV-based catalog sync (contains sync logic) |
| **Lipsey's** | `lipseys-catalog-sync.ts` | Catalog sync via Lipsey's API |
| **GunBroker** | `gunbroker-import.ts` | Marketplace product imports |

### Schedule Management Routes

| Route File | Purpose |
|------------|---------|
| `chattanooga-schedule-routes.ts` | Schedule settings & manual sync triggers |
| `sports-south-schedule-routes.ts` | Schedule settings & manual sync triggers |
| `lipseys-schedule-routes.ts` | Schedule settings & manual sync triggers |

**Note:** These routes manage database settings only. Actual automation uses Scheduled Deployments (external).

### Core Services

| Service | File | Purpose |
|---------|------|---------|
| **Auth** | `auth.ts` | Authentication & authorization |
| **Storage** | `storage.ts` | Database operations |
| **Routes** | `routes.ts` | API endpoint definitions |
| **Billing** | `billing-service.ts` | Subscription & billing management |
| **Email** | `email-service.ts` | Email sending & templating |
| **Image** | `image-service.ts` | Image processing & storage |

---

## ⚠️ LEGACY SERVICES (Consider Removing)

### Sports South Utilities

| File | Status | Notes |
|------|--------|-------|
| `sports-south-bulk-update.ts` | UTILITY | One-time bulk operations |
| `sports-south-chunked-update.ts` | UTILITY | Performance optimization script |
| `sports-south-fulltext-bulk-update.ts` | UTILITY | Search index rebuilding |

**Note:** Legacy catalog sync files have been removed. Single implementation: `sports-south-simple-sync.ts`

**Recommendation:** If utility scripts haven't been used in 6+ months, consider archiving or removing.

---

## 🔧 UTILITY SERVICES (Keep but Rarely Used)

| File | Purpose | When to Use |
|------|---------|-------------|
| `test-email-route.ts` | Email testing endpoint | Debugging email issues |
| `microbiz-import.ts` | MicroBiz POS imports | Legacy customer migrations |
| `csv-export-service.ts` | Export functionality | User data exports |
| `asn-processor.ts` | ASN document processing | Order fulfillment workflows |

---

## 🚫 DISABLED FEATURES

### Cron Schedulers (All Disabled/Removed)
- ~~`bill-hicks-simple-scheduler.ts`~~ (Deleted - sync logic in `bill-hicks-simple-sync.ts`)
- ~~`sports-south-scheduler.ts`~~ (Deleted - sync logic in `sports-south-simple-sync.ts`)
- `chattanooga-scheduler.ts` (Contains sync logic, keep but scheduler disabled)

**Why Disabled:** Reliability issues on the hosting platform  
**Current Solution:** Scheduled Deployments (external automation)  
**Manual Syncs:** Still available via Admin UI

---

## 📋 How to Add a New Vendor Sync

1. **Create sync service file:** `{vendor}-catalog-sync.ts`
2. **Add file header:**
   ```typescript
   /**
    * ✅ CURRENT IMPLEMENTATION - {Vendor} Catalog Sync
    * 
    * Active sync implementation for {Vendor}.
    * Used by: routes.ts (manual sync trigger)
    */
   ```
3. **Create schedule routes:** `{vendor}-schedule-routes.ts`
4. **Register in routes.ts:**
   ```typescript
   const { register{Vendor}ScheduleRoutes } = await import('./{vendor}-schedule-routes');
   register{Vendor}ScheduleRoutes(app);
   ```
5. **Add manual sync endpoint** in schedule routes
6. **Update this guide** with the new service

---

## 🔍 Quick Service Lookup

### "Which file handles X?"

- **Bill Hicks FTP downloads?** → `bill-hicks-simple-sync.ts`
- **Store pricing for Bill Hicks?** → `bill-hicks-store-pricing-sync.ts`
- **Sports South API calls?** → `sports-south-simple-sync.ts`
- **Chattanooga CSV imports?** → `chattanooga-scheduler.ts` (performCsvSync method)
- **Lipsey's product sync?** → `lipseys-catalog-sync.ts`
- **Manual sync trigger?** → Look in corresponding `{vendor}-schedule-routes.ts`
- **Scheduled automation?** → Scheduled Deployments (external, not in code)

---

## 📞 Need Help?

1. **Check file header** - Look for ✅ CURRENT IMPLEMENTATION marker
2. **Search routes.ts** - See what's actually imported and used
3. **Check this guide** - Reference the tables above
4. **Ask team** - If still unclear, ask another developer

---

## 🔄 Maintenance

This guide should be updated when:
- ✅ New vendor sync is added
- ✅ Service implementation changes
- ✅ Legacy service is removed
- ✅ New feature is deployed

Last Updated: October 4, 2025


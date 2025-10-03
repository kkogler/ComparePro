# Legacy Code Cleanup Report 🧹

## Completed Deletions

### 1. ✅ ConnectedVendors.tsx
**Status:** DELETED  
**Reason:** Legacy vendor page completely replaced by `SupportedVendors.tsx`  
- Not imported anywhere in codebase
- No routes pointing to it
- 785 lines of dead code
- Used different API endpoint than current implementation

---

## Candidates for Cleanup

### A. Demo/Test Pages (Low Priority - Keep for Now)

#### MultiSelectDemo.tsx
**Status:** KEEP (for now)  
**Reason:** Useful for testing/documenting MultiSelect component  
**Usage:** Routed at `/org/:slug/multi-select-demo`  
**Action:** Could delete in production build, but harmless to keep

---

### B. Unused Pages to Investigate

#### AdminVendorContracts.tsx
**Status:** ⚠️ CHECK  
**File exists but not imported in App.tsx**  
**Action:** Check if this is planned feature or legacy code

#### Settings.tsx  
**Status:** ⚠️ CHECK
**File exists in pages/ but route unclear**  
**Action:** Verify if this duplicates functionality in AdminSettings, PricingConfiguration, etc.

---

### C. One-Off Scripts (High Priority for Cleanup)

**Root directory has ~100+ one-off debugging/fix scripts:**

#### Check Scripts (for debugging)
- check-company-id.js
- check-current-credentials.js
- check-duplicate-products.ts
- check-lipseys-sync.ts
- check-lipseys-vendor.ts
- check-our-ip.ts
- check-sports-south-admin-creds.ts
- check-sports-south.ts
- check-status.js
- check-vendor-id.js

**Recommendation:** Move to `scripts/archive/` or delete after verification

#### Test Scripts (one-off testing)
- test-admin-credentials.js
- test-admin-settings.cjs
- test-bill-hicks-ftp-paths.ts
- test-bill-hicks-store-sync.ts
- test-bill-hicks-sync.ts
- test-chattanooga-connection.js
- test-chattanooga-credentials.cjs
- test-chattanooga-direct.cjs
- test-chattanooga-save.js
- test-lipseys-api-responses.ts
- test-lipseys-basic-auth.ts
- test-lipseys-exact-doc.ts
- test-lipseys-simple.ts
- test-lipseys-sync-script.ts
- test-lipseys-sync.html
- test-lipseys.html
- test-server-endpoints.ts
- test-sports-south-connection.ts
- test-sports-south-incremental-sync.ts
- test-vendor-config.ts
- test-vendor-priority-direct.mjs
- test-vendor-priority.js

**Recommendation:** Archive or delete - these were one-off debugging

#### Fix Scripts (already applied migrations)
- fix-bill-hicks-credential-fields.ts
- fix-bill-hicks-credentials-proper.ts
- fix-bill-hicks-performance.ts
- fix-bill-hicks-timestamp.ts
- fix-bill-hicks-vendor.ts
- fix-chattanooga-shortcode.ts
- fix-chattanooga-vendor-code.ts
- fix-lipseys-sync.ts
- fix-sports-south-shortcode.ts
- fix-stuck-bill-hicks-inventory.ts
- fix-stuck-bill-hicks-sync.ts

**Recommendation:** Delete if migrations already applied and verified

#### Debug Scripts (temporary investigation)
- debug-bill-hicks-sync.ts
- investigate-bill-hicks-sync-issue.ts
- show-lipseys-creds.ts
- verify-bill-hicks-vendor.ts
- verify-proxy.ts

**Recommendation:** Delete after issues resolved

#### Cleanup Scripts (already run)
- cleanup-duplicate-bill-hicks.ts
- complete-bill-hicks-cleanup.ts
- delete-duplicate-bill-hicks.ts
- final-bill-hicks-cleanup.ts

**Recommendation:** Delete - cleanup already complete

#### Manual Sync Scripts (duplicates scheduled deployments)
- manual-bill-hicks-catalog-sync.ts
- manual-bill-hicks-inventory-sync.ts
- optimize-bill-hicks-inventory-sync.ts
- optimize-bill-hicks-sync.ts

**Recommendation:** Delete - functionality now in admin UI

---

### D. Redundant Documentation (Medium Priority)

**100+ markdown files in root:**
Many session changelogs and implementation guides that could be:
1. Consolidated into a `docs/` folder
2. Archived to `docs/archive/` 
3. Deleted if superseded by newer docs

Examples:
- SESSION_CHANGELOG_20250924_055846.md
- SESSION_CHANGELOG_20250927_SPORTS_SOUTH.md
- CREDENTIAL_CLEANUP_COMPLETE.md
- CREDENTIAL_SYSTEM_CONSOLIDATION_COMPLETE.md
- BILL_HICKS_RELIABILITY_FIXES.md
- etc.

**Recommendation:** Create `docs/` and `docs/archive/` structure

---

### E. Shell Scripts (Check if still used)

**Setup/deployment scripts:**
- setup-bill-hicks-cron.sh
- setup-chattanooga-cron.sh
- setup-chattanooga-deployment.sh
- configure-zoho-webhook.sh
- check-deployments.sh
- kill-all-servers.sh
- proxy-setup.sh
- start-server.sh
- restart-server.sh
- restart-server.js

**Status:** Some are probably still used (start-server.sh), others may be obsolete  
**Action:** Review each for current usage

---

## Recommended Action Plan

### Phase 1: Safe Immediate Cleanup
✅ Delete ConnectedVendors.tsx - DONE  
⬜ Delete all test-*.ts/js files (after confirming tests pass)  
⬜ Delete all check-*.ts/js files (debugging scripts)  
⬜ Delete all fix-*.ts files (migrations already run)  
⬜ Delete cleanup scripts (already executed)

### Phase 2: Investigate & Decide
⬜ AdminVendorContracts.tsx - check if planned or legacy  
⬜ Settings.tsx - check if duplicate functionality  
⬜ Shell scripts - identify which are still needed

### Phase 3: Organize Documentation
⬜ Create `docs/` folder  
⬜ Create `docs/archive/` for old session logs  
⬜ Move markdown files to appropriate locations  
⬜ Update README with doc structure

---

## Files to Keep

### Core Application Code
- All files in `client/src/` (except identified legacy)
- All files in `server/` 
- All files in `shared/`
- All files in `migrations/`

### Configuration
- package.json, package-lock.json
- tsconfig.json, vite.config.ts, drizzle.config.ts
- tailwind.config.ts, postcss.config.js
- ecosystem.config.js (PM2)
- replit.nix (Replit config)

### Essential Scripts
- scripts/ folder contents (organized scripts)
- start-server.sh (server startup)

### Documentation
- README.md
- ARCHITECTURE.md
- Key implementation guides (after review)

---

## Disk Space Potential Savings

Estimated cleanup benefits:
- ~50-70 test/check/fix scripts: ~5-10 MB
- ~100 markdown session logs: ~10-20 MB  
- Legacy page (ConnectedVendors): ~30 KB
- **Total:** ~15-30 MB (plus reduced clutter)

**Primary benefit:** Reduced cognitive load and easier codebase navigation


# Credentials Schema Fix - Root Cause Analysis

## 🐛 Problem Identified

**Issue**: Bill Hicks and Lipsey's credentials failing to save in production with 400 errors.

**Error Message**:
```
Credentials were not saved properly. Empty fields: ftp_server, ftp_username, ftp_password, ...
```

## 🔍 Root Cause

**Schema Mismatch Between Dev and Production**

The `company_vendor_credentials.credentials` column has different data types:

| Environment | Column Type | Impact |
|-------------|-------------|--------|
| **Development** (`shared/schema.ts`) | `jsonb` ✅ | Properly stores JSON objects |
| **Production** (`migrations/schema.ts`) | `text` ❌ | Stores as string, causes parsing issues |

### How This Happened

1. Development schema was updated to use JSONB for flexible credential storage
2. Migration schema was never updated to reflect this change
3. Production database still has TEXT column
4. When credentials are saved:
   - Frontend sends: `{ftpServer: "...", ftpUsername: "...", ...}` (camelCase)
   - Stored as: TEXT string in production vs JSONB object in dev
   - Verification looks for the same field names
   - Mismatch causes false failure

## ✅ The Fix

### 1. Update Migration Schema (Already Done)

**File**: `migrations/schema.ts` line 276

**Before**:
```typescript
credentials: text().default('{}'),
```

**After**:
```typescript
credentials: json("credentials").$type<Record<string, any>>(),
```

### 2. Migrate Production Database

**File**: `scripts/fix-credentials-schema.ts`

This script:
- ✅ Checks current column type
- ✅ Validates all existing data is valid JSON
- ✅ Converts TEXT → JSONB safely
- ✅ Verifies data integrity after migration
- ✅ Provides rollback guidance

### 3. Update Verification Logic (Already Done)

**File**: `server/credential-management-routes.ts` lines 327-359

Added flexible verification that handles field name variations (camelCase vs snake_case) to prevent false failures during the transition period.

## 🚀 Deployment Steps

### Step 1: Backup Production Database

```bash
# Export current production data
export DATABASE_URL="$PRODUCTION_DATABASE_URL"
tsx scripts/export-database.ts
```

### Step 2: Run Schema Fix on Production

```bash
# Set production database URL
export DATABASE_URL="$PRODUCTION_DATABASE_URL"

# Run the schema fix script
tsx scripts/fix-credentials-schema.ts
```

### Step 3: Build and Deploy Application

```bash
# Build with updated code
npm run build

# Deploy to production (method depends on your hosting)
# For Replit deployments:
git add .
git commit -m "fix: credentials schema mismatch between dev and production"
git push origin main
```

### Step 4: Verify Fix

1. Go to https://pricecomparehub.com/org/slither-guns/supported-vendors
2. Try saving Bill Hicks credentials
3. Try saving Lipsey's credentials
4. Both should now save successfully ✅

## 📊 Expected Results

### Before Fix:
```
❌ POST /org/slither-guns/api/vendors/bill-hicks/credentials
400 Bad Request
{
  "success": false,
  "message": "Credentials were not saved properly. Empty fields: ftp_server, ..."
}
```

### After Fix:
```
✅ POST /org/slither-guns/api/vendors/bill-hicks/credentials
200 OK
{
  "success": true,
  "message": "Store credentials saved successfully for bill-hicks"
}
```

## 🔧 Technical Details

### Why JSONB vs TEXT Matters

**TEXT Column**:
- Stores credentials as a JSON string
- Requires manual parsing/stringification
- Field names can get lost in conversion
- Verification compares string fields

**JSONB Column**:
- Stores credentials as native PostgreSQL JSON
- Automatic parsing and indexing
- Preserves field names and structure
- Efficient querying with JSON operators

### The Hybrid Approach

The application uses a "hybrid approach" for backward compatibility:
- **Primary**: `credentials` JSONB column (flexible, vendor-specific)
- **Legacy**: Individual columns like `ftp_server`, `user_name`, etc.

The JSONB column should be the primary storage, with legacy columns as backups.

## 🧪 Testing Checklist

After deployment, test these vendors:

- [ ] Bill Hicks (FTP credentials): `ftpServer`, `ftpUsername`, `ftpPassword`, `ftpBasePath`
- [ ] Lipsey's (API credentials): `email`, `password`
- [ ] Chattanooga (API credentials): `sid`, `token`
- [ ] Sports South (API credentials): `userName`, `password`, `customerNumber`

All should:
1. Save without errors
2. Persist when modal is closed/reopened
3. Work for API calls (test connection button)

## 📝 Prevention

To prevent this in the future:

### 1. Schema Validation Script

Add to CI/CD:
```bash
npm run db:schema-diff
```

This compares `shared/schema.ts` with `migrations/schema.ts` and fails if they differ.

### 2. Migration Checklist

When updating schemas:
1. ✅ Update `shared/schema.ts`
2. ✅ Update `migrations/schema.ts`
3. ✅ Create migration script in `scripts/`
4. ✅ Test locally
5. ✅ Test on staging (Hosted NEON)
6. ✅ Deploy to production

### 3. Monitoring

Add health check endpoint that verifies:
- Database schema matches expected structure
- Critical columns have correct data types
- Sample CRUD operations work

## 🆘 Rollback Plan

If the migration fails:

### Option 1: Restore from Backup
```bash
tsx scripts/import-database.ts production --file backups/production-backup-YYYY-MM-DD.sql
```

### Option 2: Manual Rollback
```sql
-- Convert back to TEXT if needed
ALTER TABLE company_vendor_credentials 
ALTER COLUMN credentials 
TYPE text 
USING credentials::text;
```

## 📚 Related Files

- `shared/schema.ts` - Development schema (source of truth)
- `migrations/schema.ts` - Migration schema (should match development)
- `server/credential-management-routes.ts` - Credential save endpoint
- `server/storage.ts` - Database storage layer
- `server/credential-vault-service.ts` - Credential management service

## ✅ Success Criteria

- [ ] Production `credentials` column is JSONB type
- [ ] All existing credentials are intact
- [ ] Bill Hicks credentials save successfully
- [ ] Lipsey's credentials save successfully
- [ ] No 400 errors in credential save operations
- [ ] Credentials persist when modal is reopened
- [ ] Test connection buttons work for all vendors

---

**Date Fixed**: 2025-10-10
**Issue**: Schema mismatch causing credential save failures
**Solution**: Convert TEXT → JSONB in production database
**Impact**: All vendors with store-level credentials




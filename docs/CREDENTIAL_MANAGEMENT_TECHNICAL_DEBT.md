# Credential Management Technical Debt

**Status:** Active Technical Debt  
**Priority:** Medium  
**Impact:** All Vendors (Lipsey's, Sports South, Chattanooga, Bill Hicks)  
**Created:** 2025-10-11  

---

## Executive Summary

The vendor credential management system has accumulated technical debt through organic growth, with each vendor receiving custom field name aliasing logic as issues arose. While this approach works, it creates maintenance burden and increases the risk of similar issues with future vendors.

**Current State:** Working but brittle  
**Desired State:** Schema-driven normalization  
**Effort:** 2-4 weeks (includes thorough testing)  
**Risk:** Medium-High (touches core credential handling)

---

## Problem Statement

### The Issue

Bill Hicks credentials were not persisting between sessions. Investigation revealed:

1. Frontend sends credentials as **snake_case** (`ftp_server`, `ftp_username`, `ftp_password`)
2. Database stores credentials in JSON column as-is
3. Backend reads credentials but expects **camelCase** (`ftpServer`, `ftpUsername`, `ftpPassword`)
4. Field name mismatch → credentials appear as null → form shows empty

### Root Cause

**Inconsistent use of `processCredentials()` function:**

- ✅ **Admin credentials**: `processCredentials()` is called (works correctly)
- ❌ **Store credentials**: `processCredentials()` is bypassed (causes field name issues)

The `processCredentials()` function (lines 602-653 in `credential-vault-service.ts`) already handles snake_case ↔ camelCase conversion automatically:

```typescript
private processCredentials(credentials: Record<string, string>, schema: CredentialField[]): Record<string, string> {
  // Store in both formats for maximum compatibility
  normalized[snakeCaseName] = foundValue;
  normalized[camelCaseName] = foundValue;
  // ...
}
```

**But it's not being used for store credentials!**

### Current Workaround

Added vendor-specific field aliasing in `applyFieldAliases()` for each vendor:

- **Lipsey's**: `userName ↔ email` mapping
- **Sports South**: `userName ↔ user_name`, `customerNumber ↔ customer_number`
- **Chattanooga**: `password ↔ chattanooga_password`, `accountNumber ↔ account_number`
- **Bill Hicks**: `ftpServer ↔ ftp_server`, `ftpUsername ↔ ftp_username`, etc.

**Total lines of vendor-specific aliasing code:** ~100+ lines

---

## Current Architecture (As-Is)

### Data Flow

```
Frontend (snake_case) → Backend Save (bypass normalize) → Database (JSON) → Backend Read (vendor aliasing) → API Return (camelCase) → Frontend Load
```

### Field Name Transformation Points

1. **`processCredentials()`** - Should normalize when saving (not used for store credentials)
2. **`applyFieldAliases()`** - Vendor-specific conversions when reading (band-aid fix)
3. **Manual mapping in routes.ts** - Additional normalization (e.g., `ftpServer → ftpHost`)
4. **Frontend form field matching** - Flexible field name lookup

### Issues with Current Approach

1. **Maintenance Burden**: Each new vendor requires custom aliasing logic
2. **Inconsistency Risk**: Different vendors use different conventions
3. **Code Duplication**: Similar normalization logic scattered across functions
4. **Testing Complexity**: Must test each vendor's aliasing individually
5. **Fragility**: Missing aliasing for one field breaks entire credential flow

---

## Proposed Solution (To-Be)

### Primary Recommendation: Apply `processCredentials()` to Store Credentials

**Single-line change in `credential-vault-service.ts` (line 388):**

```typescript
// CURRENT (bypasses normalization)
await storage.saveCompanyVendorCredentials(companyId, supportedVendor.id, merged);

// PROPOSED (applies schema-driven normalization)
const processedCredentials = this.processCredentials(merged, schema.storeCredentials);
await storage.saveCompanyVendorCredentials(companyId, supportedVendor.id, processedCredentials);
```

### Benefits

1. ✅ **Eliminates ALL vendor-specific field aliasing** (Lipsey's, Sports South, Chattanooga, Bill Hicks)
2. ✅ **Uses existing, proven code** (`processCredentials()` already works for admin credentials)
3. ✅ **Schema-driven** (field names come from vendor schemas, not hardcoded)
4. ✅ **Future-proof** (new vendors automatically get both formats)
5. ✅ **Reduces complexity** (removes ~100+ lines of aliasing code)

### New Data Flow

```
Frontend (any format) → Backend Save (normalize via schema) → Database (both formats) → Backend Read (no aliasing needed) → API Return (consistent format) → Frontend Load
```

---

## Implementation Plan

### Phase 1: Keep Current Fix (COMPLETED)

**Status:** ✅ Done  
**Timeline:** Completed 2025-10-11  
**Risk:** Low

- [x] Bill Hicks field aliasing added to `applyFieldAliases()`
- [x] Credentials now save and load correctly
- [x] No impact to other vendors
- [x] Technical debt documented

### Phase 2: Test Schema-Driven Normalization (PLANNED)

**Status:** 🔶 Not Started  
**Timeline:** 2-4 weeks  
**Risk:** Medium

**Tasks:**

1. Create test branch for refactor
2. Apply `processCredentials()` to store credentials (1-line change)
3. Create comprehensive test suite:
   - Test Bill Hicks credential save/load
   - Test Lipsey's credential save/load
   - Test Sports South credential save/load
   - Test Chattanooga credential save/load
   - Test with various field name formats (snake_case, camelCase, mixed)
4. Verify no regressions in existing functionality
5. Document any edge cases discovered

### Phase 3: Deploy Schema-Driven Normalization (PLANNED)

**Status:** 🔶 Not Started  
**Timeline:** After Phase 2 testing complete  
**Risk:** Medium-High

**Prerequisites:**
- ✅ All vendors tested and working in test environment
- ✅ Rollback plan prepared
- ✅ Monitoring in place to catch issues quickly

**Tasks:**

1. Deploy to staging environment
2. Test all vendors in staging
3. Deploy to production with feature flag (if possible)
4. Monitor for 48 hours
5. Remove vendor-specific aliasing code (once proven stable)
6. Update documentation

### Phase 4: Remove Legacy Code (PLANNED)

**Status:** 🔶 Not Started  
**Timeline:** After Phase 3 stable for 2+ weeks  
**Risk:** Low

**Tasks:**

1. Remove `applyFieldAliases()` vendor-specific logic:
   - Lipsey's email aliasing
   - Sports South field mappings
   - Chattanooga field mappings
   - Bill Hicks FTP field mappings
2. Remove legacy column population logic in `storage.ts`
3. Consider deprecating legacy columns entirely
4. Update tests to reflect simplified architecture

---

## Risk Assessment

### Risks of Keeping Current Fix

- **Low Risk**: Bill Hicks works, other vendors unaffected
- **Technical Debt**: Code becomes harder to maintain over time
- **Future Issues**: Next vendor will require similar custom aliasing

### Risks of Implementing Proposed Solution

- **Medium-High Risk**: Could break existing vendor functionality
- **Testing Burden**: Must test all vendors thoroughly
- **Hidden Dependencies**: May discover unexpected edge cases
- **Rollback Complexity**: Credential handling is core functionality

### Mitigation Strategies

1. **Thorough Testing**: Test all vendors in isolated environment first
2. **Gradual Rollout**: Use feature flags if possible
3. **Rollback Plan**: Keep vendor aliasing code until proven stable
4. **Monitoring**: Add detailed logging to catch issues early
5. **Backup**: Database backup before deployment

---

## Architectural Principles (For Future)

### 1. Single Source of Truth

**Field names should be defined in vendor schemas, not hardcoded in logic:**

```typescript
const billHicksSchema = {
  storeCredentials: [
    { name: 'ftpServer', label: 'FTP Server Host', aliases: ['ftp_server', 'ftpHost'] },
    { name: 'ftpUsername', label: 'FTP Username', aliases: ['ftp_username'] },
    // Schema drives all normalization
  ]
};
```

### 2. Consistent Normalization

**Apply same normalization logic to ALL credential types:**

- Admin credentials → Use `processCredentials()`
- Store credentials → Use `processCredentials()`
- No vendor-specific special cases

### 3. Bidirectional Compatibility

**Store credentials in ALL formats for maximum compatibility:**

```typescript
{
  "ftpServer": "server.com",     // camelCase
  "ftp_server": "server.com",    // snake_case
  "ftpHost": "server.com"        // alternate name
}
```

### 4. Fail Gracefully

**Handle missing fields with clear error messages:**

```typescript
if (!credentials.ftpServer && !credentials.ftp_server && !credentials.ftpHost) {
  throw new Error('FTP Server is required. Expected fields: ftpServer, ftp_server, or ftpHost');
}
```

---

## Related Documentation

- `VENDOR_PASSWORD_POLICY.md` - Plain text credential storage policy
- `CREDENTIAL_MANAGEMENT_HYBRID_APPROACH.md` - JSON + legacy column storage
- `BILL_HICKS_CREDENTIAL_FIELD_NAME_FIX.md` - Original Bill Hicks fix documentation

---

## Code Locations

### Files Affected by Technical Debt

1. **`server/credential-vault-service.ts`**
   - Line 388: Store credentials save (bypasses `processCredentials()`)
   - Lines 734-833: `applyFieldAliases()` with vendor-specific logic
   - Lines 602-653: `processCredentials()` (exists but not used consistently)

2. **`server/storage.ts`**
   - Lines 2495-2576: `saveCompanyVendorCredentials()` with legacy column mapping
   - Lines 2408-2449: `getCompanyVendorCredentials()` with hybrid read logic
   - Lines 2539-2559: Vendor-specific field mapping for backward compatibility

3. **`server/routes.ts`**
   - Lines 3525-3551: Bill Hicks credential manual mapping (`ftpServer → ftpHost`)

4. **`client/src/components/BillHicksConfig.tsx`**
   - Lines 91-94: Form field loading with fallback field names
   - Lines 107-110: Form reset with fallback field names

---

## Success Criteria

### For Keeping Current Fix

- ✅ Bill Hicks credentials save successfully
- ✅ Bill Hicks credentials load correctly when form reopens
- ✅ No regression for other vendors
- ✅ Technical debt documented

### For Implementing Proposed Solution

- ✅ All vendors (4+) save and load credentials correctly
- ✅ No vendor-specific aliasing code remains
- ✅ New vendors work without custom code
- ✅ Code complexity reduced by ~100+ lines
- ✅ Test coverage for credential normalization
- ✅ System stable in production for 2+ weeks

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-10-11 | Keep Bill Hicks field aliasing fix | Low risk, resolves immediate issue, matches other vendors |
| 2025-10-11 | Document technical debt | Enable informed decision on future refactor |
| TBD | Implement schema-driven normalization | To be decided after business priorities assessed |

---

## Questions for Stakeholders

1. **How often do you add new vendors?**
   - If rarely (1-2 per year) → Current approach is tolerable
   - If frequently (monthly) → Refactor is high priority

2. **What is the business impact of credential issues?**
   - High impact → Invest in robust solution
   - Low impact → Accept some technical debt

3. **When is the next lower-pressure period for refactoring?**
   - Need 2-4 weeks for thorough testing
   - Need rollback capability

4. **Are there plans to add many more vendors?**
   - Yes → Refactor is worth the investment
   - No → Current approach may be sufficient

---

## Contact

For questions about this technical debt:
- Review the analysis in this document
- Check related documentation files
- Examine code comments in affected files

**Last Updated:** 2025-10-11


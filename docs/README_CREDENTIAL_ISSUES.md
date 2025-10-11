# Vendor Credential Management - Quick Reference

**⚠️ Current Status:** Working with technical debt documented  
**📅 Last Updated:** 2025-10-11

---

## Quick Links

- **📋 Full Technical Debt Analysis:** [CREDENTIAL_MANAGEMENT_TECHNICAL_DEBT.md](./CREDENTIAL_MANAGEMENT_TECHNICAL_DEBT.md)
- **🔧 Bill Hicks 400 Error Fix:** [BILL_HICKS_400_ERROR_FIX.md](./BILL_HICKS_400_ERROR_FIX.md)

---

## Current Situation

### What's Working ✅

- Bill Hicks credentials save and load correctly
- Lipsey's credentials work
- Sports South credentials work  
- Chattanooga credentials work

### Known Technical Debt 🔶

The credential system uses **vendor-specific field aliasing** as a workaround for inconsistent field name handling. This works but requires custom code for each vendor.

**Root Cause:** `processCredentials()` function exists and works perfectly for admin credentials, but is bypassed for store credentials.

---

## For Developers

### Adding a New Vendor?

If you encounter credential save/load issues with a new vendor:

1. **Check if credentials are in snake_case or camelCase**
2. **Read:** [CREDENTIAL_MANAGEMENT_TECHNICAL_DEBT.md](./CREDENTIAL_MANAGEMENT_TECHNICAL_DEBT.md) 
3. **Short-term fix:** Add vendor-specific aliasing in `applyFieldAliases()`
4. **Long-term fix:** Apply `processCredentials()` to store credentials (see documentation)

### Investigating Credential Issues?

**Start here:**
1. Check browser console for credential save/load logs
2. Review `CREDENTIAL_MANAGEMENT_TECHNICAL_DEBT.md` for architecture overview
3. Look at `server/credential-vault-service.ts` lines 382-394 (where fix should go)
4. Compare with admin credential handling (lines 270-287)

---

## For Stakeholders

### Should We Refactor?

**Questions to consider:**

1. **How often do you add new vendors?**
   - Rarely (1-2/year) → Current approach acceptable
   - Frequently (monthly) → Refactor recommended

2. **What's the business impact of credential issues?**
   - High → Invest in robust solution
   - Low → Accept technical debt

3. **When's the next low-pressure period?**
   - Need 2-4 weeks for proper testing

See full analysis in [CREDENTIAL_MANAGEMENT_TECHNICAL_DEBT.md](./CREDENTIAL_MANAGEMENT_TECHNICAL_DEBT.md)

---

## Implementation Phases

| Phase | Status | Timeline | Risk |
|-------|--------|----------|------|
| Phase 1: Keep current fix | ✅ Complete | Done | Low |
| Phase 2: Test schema normalization | 🔶 Not started | 2-4 weeks | Medium |
| Phase 3: Deploy normalization | 🔶 Not started | TBD | Medium-High |
| Phase 4: Remove legacy code | 🔶 Not started | TBD | Low |

---

## Related Files

### Documentation
- `CREDENTIAL_MANAGEMENT_TECHNICAL_DEBT.md` - Full analysis
- `BILL_HICKS_400_ERROR_FIX.md` - Bill Hicks specific fix
- `VENDOR_PASSWORD_POLICY.md` - Plain text storage policy

### Code
- `server/credential-vault-service.ts` - Main credential handling
- `server/storage.ts` - Database operations
- `server/routes.ts` - API endpoints
- `client/src/components/BillHicksConfig.tsx` - Bill Hicks form

---

## Contact

For questions about credential management:
- Review the comprehensive documentation
- Check code comments for context
- Examine related files listed above


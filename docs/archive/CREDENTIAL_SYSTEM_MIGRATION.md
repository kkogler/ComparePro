# Credential System Migration Plan

## Overview
This document outlines the migration from the legacy credential system to the new extensible credential management system, addressing the issues identified in the code review.

## Issues Addressed

### ✅ Fixed Critical Issues
1. **TypeScript Error**: Fixed unknown error type in credential-vault-service.ts line 510
2. **Deprecated Crypto**: Replaced `createCipher` with `createCipherGCM` for authenticated encryption
3. **Route Conflicts**: Marked legacy routes as deprecated and renamed to avoid conflicts
4. **Security Setup**: Created script to generate secure encryption keys

### 🔧 Current Architecture

#### Legacy System (Being Phased Out)
- Routes: `/org/:slug/api/vendors/:id/credentials-legacy`
- Storage: Direct database writes to `vendors.credentials` JSON field
- Encryption: None (plain text storage)
- Scope: Limited to existing vendor types

#### New System (Production Ready)
- Routes: `/api/admin/vendors/:vendorId/credentials` (admin), `/org/:slug/api/vendors/:vendorId/credentials` (store)
- Storage: `credential-vault-service.ts` with encrypted storage
- Encryption: AES-256-GCM with authenticated encryption
- Scope: Extensible to unlimited vendors

## Migration Strategy

### Phase 1: Stabilization (Immediate)
- [x] Fix TypeScript errors
- [x] Implement secure encryption (AES-256-GCM)
- [x] Set up environment variable management
- [x] Deprecate conflicting routes
- [ ] Clear Vite cache and fix dependency issues
- [ ] Add comprehensive error handling

### Phase 2: Gradual Migration (Next Sprint)
- [ ] Enable new system with feature flag: `FEATURE_NEW_CREDENTIAL_VAULT=true`
- [ ] Migrate existing credentials to encrypted storage
- [ ] Update frontend to use new API endpoints
- [ ] Add comprehensive testing

### Phase 3: Full Migration (Future Sprint)
- [ ] Remove legacy routes entirely
- [ ] Complete audit logging implementation
- [ ] Add credential rotation capabilities
- [ ] Performance optimization

## Environment Setup

### Required Environment Variables
```bash
# Generate secure keys using: ./setup-credential-security.sh
CREDENTIAL_ENCRYPTION_KEY=your-secure-32-byte-hex-key-here
SESSION_SECRET=your-session-secret-here

# Feature flags for gradual rollout
FEATURE_NEW_CREDENTIAL_VAULT=true
FEATURE_VCM_CHATTANOOGA=true

# Server configuration
PORT=5000
NODE_ENV=production
```

### Security Best Practices
1. **Never commit encryption keys** to version control
2. **Rotate keys regularly** in production
3. **Use different keys** for different environments
4. **Monitor credential access** through audit logs

## API Migration Guide

### Legacy API (Deprecated)
```javascript
// OLD - Being phased out
POST /org/:slug/api/vendors/:id/credentials-legacy
POST /org/:slug/api/vendors/:id/test-credentials-legacy
```

### New API (Recommended)
```javascript
// NEW - Production ready
POST /org/:slug/api/vendors/:vendorId/credentials
POST /org/:slug/api/vendors/:vendorId/test-connection
GET  /org/:slug/api/vendors/:vendorId/credentials
GET  /api/admin/credentials/health
```

## Database Schema Changes

### Legacy Storage
```sql
-- Old: Plain text JSON storage
vendors.credentials -> JSON (unencrypted)
```

### New Storage  
```sql
-- New: Encrypted field-level storage
company_vendor_credentials.* -> Encrypted sensitive fields
supported_vendors.admin_credentials -> Encrypted admin credentials
```

## Testing Strategy

### Unit Tests Needed
- [ ] Encryption/decryption functions
- [ ] Credential validation
- [ ] API endpoint security
- [ ] Error handling

### Integration Tests Needed
- [ ] End-to-end credential flow
- [ ] Vendor handler registration
- [ ] Migration from legacy to new system
- [ ] Performance under load

## Rollback Plan

### If Issues Occur
1. Set `FEATURE_NEW_CREDENTIAL_VAULT=false`
2. Revert to legacy routes by removing `-legacy` suffix
3. Monitor system stability
4. Address issues before re-enabling

### Data Safety
- Legacy credentials remain untouched during migration
- New system operates alongside legacy until proven stable
- Backup encryption keys securely before any changes

## Performance Considerations

### Encryption Overhead
- Estimated 1-2ms per credential operation
- Negligible impact for typical usage (< 100 operations/second)
- Monitor in production for any performance issues

### Memory Usage
- Credentials decrypted on-demand only
- No persistent storage of decrypted data
- Automatic cleanup after use

## Monitoring & Alerts

### Key Metrics
- Credential encryption/decryption success rate
- API response times for credential operations
- Failed authentication attempts
- Audit log completeness

### Alert Conditions
- Encryption failures > 1%
- API response time > 500ms
- Multiple failed authentication attempts
- Missing audit logs

## Support & Documentation

### For Developers
- See `EXTENSIBLE_CREDENTIAL_MANAGEMENT_GUIDE.md` for complete API documentation
- Run `./setup-credential-security.sh` for environment setup
- Use feature flags for safe testing

### For Operations
- Monitor encryption key rotation schedule
- Backup encrypted credentials regularly
- Review audit logs for security compliance
- Test disaster recovery procedures

## Success Criteria

### Phase 1 (Stabilization)
- [x] No TypeScript compilation errors
- [x] Secure encryption implemented
- [x] No route conflicts
- [ ] Vite dependencies resolved
- [ ] Server runs without warnings

### Phase 2 (Migration)
- [ ] All existing vendors work with new system
- [ ] Frontend successfully uses new APIs
- [ ] Performance meets requirements
- [ ] Comprehensive test coverage

### Phase 3 (Completion)
- [ ] Legacy system completely removed
- [ ] Full audit logging operational
- [ ] Credential rotation implemented
- [ ] Documentation complete

## Next Steps

1. **Immediate**: Run `./setup-credential-security.sh` to generate secure keys
2. **This Week**: Enable new system with feature flag and test thoroughly
3. **Next Sprint**: Begin migrating existing vendors to new system
4. **Future**: Complete migration and remove legacy code

This migration ensures a secure, scalable, and maintainable credential management system while minimizing disruption to existing functionality.

# Logging Migration Guide

## Replace Console.log with Structured Logging

### 1. Import the logger
```typescript
import { logger } from './lib/logger';
```

### 2. Replace console.log statements
```typescript
// Old
console.log('Sync started');
console.log('Processing product:', product);

// New
logger.info('Sync started', { syncType: 'full' });
logger.debug('Processing product', { productId: product.id, name: product.name });
```

### 3. Use appropriate log levels
- `logger.debug()` - Detailed debugging information
- `logger.info()` - General information
- `logger.warn()` - Warning messages
- `logger.error()` - Error messages

### 4. Add context to logs
```typescript
// Good
logger.info('User login', { userId: user.id, email: user.email });

// Avoid
logger.info('User login');
```

## Benefits
- ✅ Structured logging with context
- ✅ Log levels for filtering
- ✅ Production-ready logging
- ✅ Better debugging capabilities

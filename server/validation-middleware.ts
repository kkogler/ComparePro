import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
export const rateLimit = (windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    const keysToDelete: string[] = [];
    rateLimitStore.forEach((value, key) => {
      if (value.resetTime < windowStart) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => rateLimitStore.delete(key));
    
    const clientData = rateLimitStore.get(clientId);
    
    if (!clientData) {
      rateLimitStore.set(clientId, { count: 1, resetTime: now });
      return next();
    }
    
    if (clientData.resetTime < windowStart) {
      rateLimitStore.set(clientId, { count: 1, resetTime: now });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: Math.ceil((clientData.resetTime + windowMs - now) / 1000) 
      });
    }
    
    clientData.count++;
    next();
  };
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeString = (str: any): string => {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[sanitizeString(key)] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Common validation schemas
export const commonSchemas = {
  id: z.number().int().positive(),
  slug: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/),
  email: z.string().email().max(255),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9-_]+$/),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255).regex(/^[a-zA-Z0-9\s\-_.,()&]+$/),
  description: z.string().max(1000),
  url: z.string().url().max(500),
  phone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/).optional(),
  date: z.string().datetime().optional(),
  boolean: z.boolean(),
  positiveNumber: z.number().positive(),
  nonNegativeNumber: z.number().min(0),
};

// Generic validation middleware factory
export const validate = (schema: z.ZodSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[target];
      const validated = schema.parse(data);
      req[target] = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      return res.status(500).json({ error: 'Validation error' });
    }
  };
};

// Specific validation schemas for common endpoints
export const userSchemas = {
  create: z.object({
    username: commonSchemas.username,
    email: commonSchemas.email,
    password: commonSchemas.password,
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    displayName: z.string().min(1).max(100).optional(),
  }),
  
  update: z.object({
    username: commonSchemas.username.optional(),
    email: commonSchemas.email.optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    displayName: z.string().min(1).max(100).optional(),
  }),
  
  login: z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(128),
  }),
  
  passwordReset: z.object({
    email: commonSchemas.email,
  }),
  
  changePassword: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: commonSchemas.password,
  }),
};

export const organizationSchemas = {
  create: z.object({
    name: commonSchemas.name,
    slug: commonSchemas.slug,
    description: commonSchemas.description.optional(),
    website: commonSchemas.url.optional(),
    phone: commonSchemas.phone.optional(),
    address: z.string().max(500).optional(),
  }),
  
  update: z.object({
    name: commonSchemas.name.optional(),
    description: commonSchemas.description.optional(),
    website: commonSchemas.url.optional(),
    phone: commonSchemas.phone.optional(),
    address: z.string().max(500).optional(),
  }),
};

export const productSchemas = {
  create: z.object({
    upc: z.string().min(8).max(20).regex(/^[0-9]+$/),
    name: commonSchemas.name,
    partNumber: z.string().min(1).max(100).optional(),
    manufacturerPartNumber: z.string().min(1).max(100).optional(),
    sku: z.string().min(1).max(100).optional(),
    description: commonSchemas.description.optional(),
    retailVerticalId: commonSchemas.id.optional(),
  }),
  
  search: z.object({
    query: z.string().min(1).max(200),
    type: z.enum(['upc', 'name', 'partNumber', 'manufacturerPartNumber', 'sku', 'altId1', 'altId2']),
    page: commonSchemas.nonNegativeNumber.optional().default(1),
    limit: z.number().int().min(1).max(100).optional().default(20),
  }),
};

export const vendorSchemas = {
  create: z.object({
    name: commonSchemas.name,
    description: commonSchemas.description.optional(),
    website: commonSchemas.url.optional(),
    contactEmail: commonSchemas.email.optional(),
    contactPhone: commonSchemas.phone.optional(),
    supportedVendorId: commonSchemas.id,
  }),
  
  update: z.object({
    name: commonSchemas.name.optional(),
    description: commonSchemas.description.optional(),
    website: commonSchemas.url.optional(),
    contactEmail: commonSchemas.email.optional(),
    contactPhone: commonSchemas.phone.optional(),
  }),
};

// Error handling middleware
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', error);
  
  // Don't leak sensitive information in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      message: isDevelopment ? error.message : 'Invalid input data'
    });
  }
  
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  
  if (error.name === 'ForbiddenError') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied'
    });
  }
  
  if (error.name === 'NotFoundError') {
    return res.status(404).json({
      error: 'Not found',
      message: 'Resource not found'
    });
  }
  
  // Generic error response
  return res.status(500).json({
    error: 'Internal server error',
    message: isDevelopment ? error.message : 'An unexpected error occurred'
  });
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent XSS attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Strict Transport Security (HTTPS only)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'none';"
  );
  
  next();
};

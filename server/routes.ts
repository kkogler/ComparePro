// @ts-nocheck
import type { Express } from "express";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import crypto, { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, insertOrderItemSchema, insertVendorSchema, insertSupportedVendorSchema, insertSettingsSchema, insertAdminSettingsSchema, insertSearchHistorySchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { SUBSCRIPTION_STATUSES } from "@shared/subscription-config";
import { LipseyAPI, LipseyCredentials } from "./lipsey-api";
import { ChattanoogaAPI } from './chattanooga-api';
import { importChattanoogaProducts } from './chattanooga-import';

import GunBrokerAPI from './gunbroker-api';
import { GunBrokerImporter } from './gunbroker-import';
import { importService } from './import-service';
import { setupAuth, requireOrganizationAccess, comparePasswords, hashPassword, organizationMiddleware, getOrganizationContext, requireAdminAuth } from "./auth";
import { vendorRegistry } from './vendor-registry';
import { isVendorEnabledForPriceComparison, createVendorErrorResponse, createVendorSuccessResponse } from './vendor-utils';
import { db } from './db';
import { products, supportedVendors, vendorProductMappings } from '@shared/schema';
import { inArray, eq, and, like, sql } from 'drizzle-orm';
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { vendorOrderService } from "./vendor-order-service";
import { WebhookServiceV2 } from "./webhook-service-v2";
// PricingService removed - no calculated values allowed, only actual vendor API data
import { csvExportService } from "./csv-export-service";
import { generateEnhancedFilename, generateFallbackFilename, getEmailSenderName, CSV_EXPORT_CONFIG } from "../shared/csv-export-config";
import { SportsSouthAPI } from "./sports-south-api";
import { performSportsSouthCatalogSync } from './sports-south-simple-sync';
import { companyVendorCredentials, vendorInventory, vendors } from "@shared/schema";
import { runBillHicksSimpleSync } from "./bill-hicks-simple-sync";
import { BILL_HICKS_CONFIG } from "../shared/bill-hicks-config";
import { syncStoreSpecificBillHicksPricing } from "./bill-hicks-store-pricing-sync";
import { invalidateVendorPriorityCache } from "./vendor-priority";
import { registerCredentialManagementRoutes } from './credential-management-routes';
import { healthCheck } from './monitoring';

// Removed converted routes - cleaned up unused experimental code


// **SECURITY FUNCTION**: Verify Zoho webhook HMAC signature using Zoho's documented method
function verifyZohoWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }
  
  try {
    // Zoho Billing uses simple HMAC-SHA256 of the raw payload
    // Generate HMAC-SHA256 hash of the raw body
    const calculatedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    // Handle both "sha256=" prefixed and raw hex signatures
    const cleanSignature = signature.startsWith('sha256=') 
      ? signature.slice(7) 
      : signature;
    
    console.log('🔐 SIMPLE Signature verification debug:', {
      receivedSignature: cleanSignature,
      calculatedSignature,
      payloadLength: payload.length,
      payloadPreview: payload.substring(0, 100) + '...',
      secretLength: secret.length,
      match: calculatedSignature === cleanSignature
    });
    
    return calculatedSignature === cleanSignature;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}


// Helper functions for product data extraction
function extractBrand(title: string): string | null {
  if (!title) return null;
  
  const brands = ['Glock', 'Smith & Wesson', 'Ruger', 'Sig Sauer', 'Springfield', 'Remington', 'Beretta', 'Colt', 'Kimber', 'Wilson Combat'];
  
  for (const brand of brands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  
  // Extract first word as brand if no known brand found
  return title.split(' ')[0] || null;
}

function extractModel(title: string): string | null {
  if (!title) return null;
  
  // Look for common model patterns
  const modelMatch = title.match(/\b(G\d+|M\d+|SR\d+|P\d+|1911|AR-\d+)\b/i);
  if (modelMatch) {
    return modelMatch[1];
  }
  
  // Fallback to second word
  const words = title.split(' ');
  return words.length > 1 ? words[1] : null;
}

function extractCaliber(title: string): string | null {
  if (!title) return null;
  
  const caliberPatterns = [
    /9mm/i, /\.40/i, /40 S&W/i, /\.45/i, /45 ACP/i, 
    /\.380/i, /380 ACP/i, /10mm/i, /\.357/i
  ];
  
  for (const pattern of caliberPatterns) {
    const match = title.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

// Helper function to sanitize pricing configuration data
function sanitizePricingConfigData(data: any) {
  const numericFields = [
    'markupPercentage',
    'marginPercentage', 
    'premiumAmount',
    'discountPercentage',
    'roundingAmount',
    'fallbackMarkupPercentage'
  ];

  const sanitized = { ...data };
  
  numericFields.forEach(field => {
    if (sanitized[field] === '' || sanitized[field] === undefined) {
      sanitized[field] = null;
    }
  });

  return sanitized;
}

// Configure multer for file uploads
const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const orgSlug = req.params.slug;
    cb(null, `${orgSlug}-logo-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Separate multer configuration for CSV imports
const csvUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for CSV files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const getSupportsOrdering = (h: any): boolean => !!(h && h.capabilities && h.capabilities.supportsOrdering);
  // Add request logging for debugging
  app.use((req, res, next) => {
    // console.log(`🔍 ROUTES DEBUG: ${req.method} ${req.url}`); // Disabled - too verbose
    if (req.url.includes('/vendors')) {
      }
    next();
  });


  // Setup authentication
  setupAuth(app);

  // Health check endpoint (must be before other routes)
  console.log('🏥 Registering health check endpoint at /api/health');
  app.get('/api/health', healthCheck);

  // Readiness check endpoint (validates database connectivity)
  console.log('🏥 Registering readiness check endpoint at /api/ready');
  app.get('/api/ready', async (req, res) => {
    try {
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      
      // Simple DB connectivity check
      await db.execute(sql`SELECT 1`);
      
      res.status(200).json({ 
        ready: true,
        database: 'connected',
        timestamp: new Date().toISOString() 
      });
    } catch (error: any) {
      console.error('❌ Readiness check failed:', error);
      res.status(503).json({ 
        ready: false,
        database: 'unreachable',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Test endpoint to debug routing
  console.log('🧪 Registering test endpoint at /api/test-health');
  app.get('/api/test-health', (req, res) => {
    console.log('🧪 Test health endpoint called!');
    res.json({ status: 'test-working', timestamp: new Date().toISOString() });
  });

  // Register credential management routes (new extensible system)
  registerCredentialManagementRoutes(app);

  // MOVED: Health check endpoints (testing different location)
  console.log('🏥 MOVED: Registering health check endpoint at /api/health-moved');
  app.get('/api/health-moved', healthCheck);
  
  console.log('🧪 MOVED: Registering test endpoint at /api/test-health-moved');
  app.get('/api/test-health-moved', (req, res) => {
    console.log('🧪 Test health endpoint called!');
    res.json({ status: 'test-working-moved', timestamp: new Date().toISOString() });
  });

  // Object storage endpoints for serving vendor logos and public assets
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      console.log("OBJECT ACCESS: Requested path:", req.path);
      console.log("OBJECT ACCESS: Object path param:", req.params.objectPath);
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      console.log("OBJECT ACCESS: Object file found, serving...");
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("OBJECT ACCESS ERROR:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Object storage upload endpoints for admin
  app.post("/api/admin/objects/upload", requireAdminAuth, async (req, res) => {
    try {
      console.log("OBJECT UPLOAD: Getting upload URL for admin user:", req.user?.username);
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      console.log("OBJECT UPLOAD: Generated upload URL successfully");
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Vendor logo upload endpoint
  app.put("/api/admin/supported-vendors/:id/logo", requireAdminAuth, async (req, res) => {
    try {
      const vendorId = parseInt(req.params.id);
      const { logoUrl } = req.body;
      
      console.log("VENDOR LOGO UPDATE: Vendor ID:", vendorId, "Raw Logo URL:", logoUrl, "User:", req.user?.username);
      
      if (!logoUrl) {
        return res.status(400).json({ error: "logoUrl is required" });
      }

      // Convert the raw Google Cloud Storage URL to normalized object path
      const objectStorageService = new ObjectStorageService();
      const normalizedLogoUrl = objectStorageService.normalizeObjectEntityPath(logoUrl);
      
      console.log("VENDOR LOGO UPDATE: Normalized Logo URL:", normalizedLogoUrl);

      // Update the vendor with the normalized logo URL
      const result = await storage.updateSupportedVendor(vendorId, { logoUrl: normalizedLogoUrl });
      console.log("VENDOR LOGO UPDATE: Update result:", result ? "success" : "vendor not found");
      
      res.json({ success: true, logoUrl: normalizedLogoUrl });
    } catch (error) {
      console.error("Error updating vendor logo:", error);
      res.status(500).json({ error: "Failed to update vendor logo" });
    }
  });

  // Simple auth middleware for global routes
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    req.userId = req.user.id; // Set userId for convenience
    next();
  };

  // Global user preferences routes (not org-scoped)
  app.get('/api/preferences/:preferenceType', requireAuth, async (req: any, res) => {
    try {
      const { preferenceType } = req.params;
      console.log('*** PREFERENCES: Fetching for user', req.userId, 'type', preferenceType);
      const preferences = await storage.getUserPreference(req.userId, preferenceType);
      console.log('*** PREFERENCES: Retrieved:', preferences);
      res.json({ preferences: preferences || {} });
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  app.post('/api/preferences/:preferenceType', requireAuth, async (req: any, res) => {
    try {
      const { preferenceType } = req.params;
      const { preferences } = req.body;
      await storage.setUserPreference(req.userId, preferenceType, preferences);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving user preferences:", error);
      res.status(500).json({ message: "Failed to save preferences" });
    }
  });

  // Add middleware for organization-scoped routes
  app.use('/org/:slug/*', organizationMiddleware, getOrganizationContext);
  app.use('/org/:slug/', organizationMiddleware, getOrganizationContext);
  app.use('/org/:slug', organizationMiddleware, getOrganizationContext);

  // Frontend route handler for root organization path (with and without trailing slash)
  app.get('/org/:slug/', async (req, res, next) => {
    console.log(`🎯 ROOT ORG HANDLER: Processing /org/${req.params.slug}/`);
    
    // Serve index.html directly for frontend routes
    const isDev = process.env.NODE_ENV !== 'production';
    const htmlPath = isDev 
      ? path.resolve(__dirname, '..', 'client', 'index.html')
      : path.resolve(__dirname, 'public', 'index.html');
    
    try {
      res.sendFile(htmlPath);
    } catch (error) {
      console.error('Error serving index.html:', error);
      next();
    }
  });
  
  app.get('/org/:slug', async (req, res, next) => {
    console.log(`🎯 ROOT ORG HANDLER: Processing /org/${req.params.slug}`);
    
    // Serve index.html directly for frontend routes
    const isDev = process.env.NODE_ENV !== 'production';
    const htmlPath = isDev 
      ? path.resolve(__dirname, '..', 'client', 'index.html')
      : path.resolve(__dirname, 'public', 'index.html');
    
    try {
      res.sendFile(htmlPath);
    } catch (error) {
      console.error('Error serving index.html:', error);
      next();
    }
  });

  // Frontend route handler for organization pages (activate, auth, reset, etc.)
  // Serve index.html directly instead of delegating to Vite (since vite.ts skips /org/ routes)
  app.get('/org/:slug/*', async (req, res, next) => {
    const url = req.originalUrl;
    console.log(`🎯 FRONTEND ROUTE HANDLER: Processing ${url}`);
    console.log(`🎯 FRONTEND ROUTE HANDLER: Slug: ${req.params.slug}`);
    
    // Skip API routes - let them be handled by the existing API routes
    if (url.match(/^\/org\/[^\/]+\/api\//)) {
      console.log(`🎯 FRONTEND ROUTE HANDLER: Skipping API route: ${url}`);
      return next();
    }
    
    console.log(`🎯 FRONTEND ROUTE HANDLER: Serving HTML for: ${url}`);
    
    // Serve index.html directly for frontend routes
    const isDev = process.env.NODE_ENV !== 'production';
    const htmlPath = isDev 
      ? path.resolve(__dirname, '..', 'client', 'index.html')
      : path.resolve(__dirname, 'public', 'index.html');
    
    try {
      res.sendFile(htmlPath);
    } catch (error) {
      console.error('Error serving index.html:', error);
      next();
    }
  });

  // Company-specific routes (tenant-aware)
  // Get company information
  app.get("/org/:slug/api/company", requireOrganizationAccess, async (req, res) => {
    try {
      const companyId = (req as any).organizationId;
      const company = await storage.getCompany(companyId);
      
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }
      
      res.json({
        id: company.id,
        name: company.name,
        retailVerticalId: company.retailVerticalId
      });
    } catch (error: any) {
      console.error('Get company error:', error);
      res.status(500).json({ message: 'Failed to fetch company information' });
    }
  });

  // Get current authenticated user for organization context
  app.get("/org/:slug/api/user", requireOrganizationAccess, async (req, res) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error('Get current user error:', error);
      res.status(500).json({ message: 'Failed to fetch current user' });
    }
  });

  // Get user's assigned stores
  app.get("/org/:slug/api/user/stores", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const userStores = await storage.getUserStores(userId);
      res.json(userStores);
    } catch (error: any) {
      console.error('Get user stores error:', error);
      res.status(500).json({ message: 'Failed to fetch user stores' });
    }
  });

  // Get orders for organization
  app.get("/org/:slug/api/orders", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const { status, vendorId } = req.query;
      
      let orders = await storage.getOrdersWithVendorInfo(organizationId);
      
      // Filter by status if provided
      if (status && typeof status === 'string') {
        orders = orders.filter(order => order.status === status);
      }
      
      // Filter by vendorId if provided
      if (vendorId && typeof vendorId === 'string') {
        const vendorIdNum = parseInt(vendorId);
        orders = orders.filter(order => order.vendorId === vendorIdNum);
      }
      
      // Transform to match frontend expectations (OrderWithVendor type)
      const transformedOrders = orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        vendorId: order.vendorId,
        vendor: order.vendorName,
        vendorShortCode: order.vendorShortCode,
        storeId: order.storeId,
        storeName: order.storeName,
        status: order.status,
        orderDate: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
        totalAmount: order.total,
        itemCount: order.itemCount,
        shippingCost: '0.00'
      }));
      
      res.json(transformedOrders);
    } catch (error: any) {
      console.error('Get orders error:', error);
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  // Get individual order with details (for Order Details modal)
  app.get("/org/:slug/api/orders/:orderId", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const orderId = parseInt(req.params.orderId);
      
      if (isNaN(orderId)) {
        return res.status(400).json({ message: 'Invalid order ID' });
      }
      
      // Get the order
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Verify organization access
      if (order.companyId !== organizationId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Get order items with product details
      const rawOrderItems = await storage.getOrderItemsByOrderId(orderId);
      
      // Transform order items to match frontend expectations
      const orderItems = rawOrderItems.map(item => ({
        ...item,
        product: {
          name: item.productName,
          upc: item.productUpc,
          manufacturerPartNumber: item.productMfgPartNumber,
          brand: item.productBrand,
          model: item.productModel,
          category: item.productCategory,
          subcategory1: item.productSubcategory1,
          subcategory2: item.productSubcategory2,
          subcategory3: item.productSubcategory3,
        }
      }));
      
      // Get vendor info
      const vendor = await storage.getVendor(order.vendorId);
      
      // Build response with all details
      const orderDetails = {
        ...order,
        vendor: vendor?.name || 'Unknown Vendor',
        items: orderItems
      };
      
      res.json(orderDetails);
    } catch (error: any) {
      console.error('Get order details error:', error);
      res.status(500).json({ message: 'Failed to fetch order details' });
    }
  });

  // Add item to order (create new order or add to existing)
  app.post("/org/:slug/api/orders/add-item", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Check subscription limits for order processing (Enterprise-only feature)
      const { canUseOrderProcessing } = await import('./subscription-gates');
      const orderAccess = await canUseOrderProcessing(organizationId);
      if (!orderAccess.allowed) {
        return res.status(403).json({ 
          message: orderAccess.message,
          upgradeRequired: true,
          requiredPlan: 'enterprise'
        });
      }
      
      const { orderId, vendorId, productId, vendorProductId, gunBrokerItemId, quantity, unitCost, storeId, vendorSku, vendorMsrp, vendorMapPrice, priceOnPO, category, model } = req.body;
      
      // Validate required fields
      if (!vendorId || !productId || !quantity || !unitCost || !storeId) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      let targetOrderId = orderId;
      
      // Create new order if needed
      if (!orderId) {
        // Get store information for order creation
        const store = await storage.getStore(parseInt(storeId));
        if (!store || store.companyId !== organizationId) {
          return res.status(404).json({ message: 'Store not found or access denied' });
        }
        
        // Get vendor information
        const vendor = await storage.getVendor(vendorId);
        if (!vendor || vendor.companyId !== organizationId) {
          return res.status(404).json({ message: 'Vendor not found or access denied' });
        }
        
        // Get next PO sequence for this store
        const poSequence = await storage.getNextPoSequence(parseInt(storeId));
        const orderNumber = `${store.shortName}-${poSequence.toString().padStart(4, '0')}`;
        
        // Create new order
        const { DEFAULT_ORDER_STATUS, DEFAULT_ORDER_TYPE } = await import('../shared/order-config.js');
        const newOrder = await storage.createOrder({
          orderNumber,
          vendorId,
          status: DEFAULT_ORDER_STATUS.value,
          orderDate: new Date(),
          totalAmount: '0.00',
          itemCount: 0,
          shippingCost: '0.00',
          companyId: organizationId,
          createdBy: userId,
          storeId: parseInt(storeId),
          dropShipFlag: false,
          insuranceFlag: false,
          adultSignatureFlag: false,
          delayShipping: false,
          overnight: false,
          orderType: DEFAULT_ORDER_TYPE.value
        });
        
        targetOrderId = newOrder.id;
      }
      
      // Add item to order
      const cost = parseFloat(unitCost.replace('$', ''));
      const totalCost = cost * quantity;
      
      // Parse vendor pricing data if available
      const parsedVendorMsrp = vendorMsrp ? parseFloat(vendorMsrp.toString().replace('$', '')) : null;
      const parsedVendorMapPrice = vendorMapPrice ? parseFloat(vendorMapPrice.toString().replace('$', '')) : null;
      
      // Use the calculated retail price from frontend (includes cross-vendor fallback)
      let retailPrice = cost; // Default to wholesale cost if no pricing provided
      const { PRICING_STRATEGY_INDICATORS } = await import('../shared/pricing-config.js');
      let pricingStrategy = PRICING_STRATEGY_INDICATORS.COST_FALLBACK.value;
      
      if (priceOnPO && !isNaN(parseFloat(priceOnPO.toString()))) {
        // Use the price calculated in frontend (includes cross-vendor fallback logic)
        retailPrice = parseFloat(priceOnPO.toString());
        pricingStrategy = PRICING_STRATEGY_INDICATORS.FRONTEND_CALCULATED.value;
      } else {
        // Fallback to backend calculation if no frontend price provided
        try {
          // Get default pricing configuration for this organization
          const pricingConfigs = await storage.getPricingConfigurationsByCompany(organizationId);
          const defaultPricingConfig = pricingConfigs.find(config => config.isDefault && config.isActive);
          
          if (defaultPricingConfig) {
            // Import pricing service
            const { PricingService } = await import('./pricing-service.js');
            
            // Prepare pricing inputs from vendor data
            const pricingInputs = {
              cost: cost,
              msrp: parsedVendorMsrp || undefined,
              mapPrice: parsedVendorMapPrice || undefined
            };
            
            // Calculate retail price using pricing configuration
            const pricingResult = PricingService.calculateRetailPrice(pricingInputs, defaultPricingConfig);
            
            if (pricingResult.finalPrice > 0) {
              retailPrice = pricingResult.finalPrice;
              pricingStrategy = pricingResult.strategy;
            }
          }
        } catch (error) {
          console.warn('Failed to apply pricing configuration:', error);
          // Continue with default cost pricing
        }
      }
      
      const { DEFAULT_ORDER_ITEM_STATUS } = await import('../shared/order-config.js');
      const orderItem = await storage.createOrderItem({
        orderId: targetOrderId,
        productId,
        vendorProductId: vendorProductId || null,
        gunBrokerItemId: gunBrokerItemId || null,
        quantity,
        unitCost: cost.toString(),
        totalCost: totalCost.toString(),
        vendorSku: vendorSku || null, // Store vendor SKU captured at time of order creation
        vendorMsrp: parsedVendorMsrp, // Store MSRP from vendor API
        vendorMapPrice: parsedVendorMapPrice, // Store MAP from vendor API
        retailPrice: retailPrice.toString(), // Store calculated retail price
        pricingStrategy: pricingStrategy, // Store which pricing strategy was used
        category: category || null, // Store manually selected category from Add to Order modal
        model: model || null, // Store user-editable model from Add to Order modal (NOT saved to Master Catalog)
        status: DEFAULT_ORDER_ITEM_STATUS.value
      });
      
      // Update order totals
      const orderItems = await storage.getOrderItemsByOrderId(targetOrderId);
      const newTotalAmount = orderItems.reduce((sum, item) => sum + parseFloat(item.totalCost), 0);
      const newItemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      
      await storage.updateOrder(targetOrderId, {
        totalAmount: newTotalAmount.toFixed(2),
        itemCount: newItemCount
      });
      
      res.json({
        success: true,
        orderId: targetOrderId,
        itemId: orderItem.id,
        message: orderId ? 'Item added to existing order' : 'New order created with item'
      });
      
    } catch (error: any) {
      console.error('Add item to order error:', error);
      res.status(500).json({ message: 'Failed to add item to order', error: error.message });
    }
  });

  // Update order item
  app.patch("/api/order-items/:itemId", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const updates = req.body;

      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      // Get the current item to calculate totalCost if quantity or unitCost changes
      const currentItem = await storage.getOrderItem(itemId);
      if (!currentItem) {
        return res.status(404).json({ message: "Order item not found" });
      }

      // Calculate totalCost if quantity or unitCost is being updated
      if (updates.quantity !== undefined || updates.unitCost !== undefined) {
        const newQuantity = updates.quantity !== undefined ? updates.quantity : currentItem.quantity;
        const newUnitCost = updates.unitCost !== undefined ? parseFloat(updates.unitCost) : parseFloat(currentItem.unitCost);
        updates.totalCost = (newQuantity * newUnitCost).toFixed(2);
        console.log(`ORDER ITEM UPDATE: Recalculating totalCost = ${newQuantity} × ${newUnitCost} = ${updates.totalCost}`);
      }

      // Update the order item
      const updatedItem = await storage.updateOrderItem(itemId, updates);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Order item not found after update" });
      }

      console.log(`ORDER ITEM UPDATE: Successfully updated item ${itemId}`, updates);
      res.json(updatedItem);
    } catch (error: any) {
      console.error('Update order item error:', error);
      res.status(500).json({ message: "Failed to update order item" });
    }
  });

  app.get("/org/:slug/api/dashboard", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
      

      
      let orders = await storage.getOrdersByCompany(organizationId);
      const asns = await storage.getASNsByCompany(organizationId);
      const vendors = await storage.getVendorsByCompany(organizationId);
      

      
      // Filter by store if specified
      if (storeId) {
        orders = orders.filter(o => o.storeId === storeId);

      }
      
      const draftOrders = orders.filter(o => o.status === 'draft').length;
      const openOrders = orders.filter(o => o.status === 'open').length;
      // Only count authentic ship notices with tracking numbers
      const shipNotices = asns.filter(asn => asn.trackingNumber && asn.trackingNumber.length > 0).length;
      const connectedVendors = vendors.filter(v => v.status === 'online' || v.status === 'connected').length;
      

      
      // Get company stores for filter dropdown
      const stores = await storage.getStoresByCompany(organizationId);
      
      const recentOrders = orders
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
        .slice(0, 5)
        .map(order => ({
          id: order.id,
          number: order.orderNumber,
          vendor: vendors.find(v => v.id === order.vendorId)?.name || null,
          amount: order.totalAmount,
          date: order.orderDate.toISOString().split('T')[0],
          status: order.status
        }));

      // Create recent activity from orders and ASNs
      const recentActivity = [];
      
      // Add recent orders to activity
      const recentOrderActivity = orders
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
        .slice(0, 3)
        .map(order => {
          const vendor = vendors.find(v => v.id === order.vendorId);
          const orderItems = order.itemCount || 1;
          return {
            type: 'order',
            title: `Order ${order.orderNumber} ${order.status === 'draft' ? 'created' : 'submitted'}`,
            description: `${orderItems} item${orderItems !== 1 ? 's' : ''} • ${vendor?.name || 'Unknown vendor'}`,
            timestamp: order.orderDate,
            color: order.status === 'draft' ? 'yellow' : order.status === 'open' ? 'blue' : 'green'
          };
        });

      // Only show ASN activities if they have real tracking numbers or are from legitimate shipments
      // Skip placeholder/test ASN data that lacks authentic shipment details
      const authenticASNs = asns.filter(asn => {
        // Only include ASNs that have tracking numbers or other indicators of real shipments
        return asn.trackingNumber && asn.trackingNumber.length > 0;
      });

      const recentASNActivity = authenticASNs
        .sort((a, b) => new Date(b.shipDate || b.createdAt).getTime() - new Date(a.shipDate || a.createdAt).getTime())
        .slice(0, 3)
        .map(asn => {
          const vendor = vendors.find(v => v.id === asn.vendorId);
          return {
            type: 'asn',
            title: `Ship notice received`,
            description: `Tracking: ${asn.trackingNumber} • ${vendor?.name || 'Unknown vendor'}`,
            timestamp: asn.shipDate || asn.createdAt,
            color: 'green'
          };
        });

      // Combine and sort all activities by timestamp
      const allActivities = [...recentOrderActivity, ...recentASNActivity]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 4); // Show top 4 most recent activities

      const responseData = {
        stats: {
          draftOrders,
          openOrders,
          shipNotices,
          connectedVendors
        },
        recentOrders,
        recentActivity: allActivities,
        stores,
        vendors: vendors.map((v) => ({
          id: v.id,
          name: v.name,
          itemCount: 0, // Will be calculated separately if needed
          status: v.status || 'offline',
          lastSyncDate: v.lastSyncDate,
          type: v.integrationType || 'api'
        }))
      };
      

      
      res.json(responseData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Ordered Items Report
  app.get("/org/:slug/api/reports/ordered-items", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const { startDate, endDate, search, reportType } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // Get all orders within the date range and filter by status based on reportType
      const orders = await storage.getOrdersByCompany(organizationId);
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.orderDate);
        const inDateRange = orderDate >= start && orderDate <= end;
        
        // Filter by order status based on reportType
        if (!inDateRange) return false;
        
        if (reportType === 'draft') {
          return order.status === 'draft';
        } else if (reportType === 'open') {
          return order.status === 'open';
        } else if (reportType === 'complete') {
          return order.status === 'complete';
        }
        
        // If no reportType specified, return all orders in date range
        return true;
      });

      // Get all vendors for lookups
      const vendors = await storage.getVendorsByCompany(organizationId);
      const vendorMap = new Map(vendors.map(v => [v.id, v.vendorShortCode || v.name]));

      // Get order items for filtered orders
      const orderedItems: any[] = [];
      
      for (const order of filteredOrders) {
        const orderItems = await storage.getOrderItemsByOrderId(order.id);
        
        for (const item of orderItems) {
          const orderedItem = {
            itemName: (item as any).productName || '-',
            mfgPartNo: (item as any).productMfgPartNumber || '-',
            vendor: vendorMap.get(order.vendorId) || null,
            orderDate: order.orderDate,
            orderNumber: order.orderNumber || order.id.toString(),
            orderId: order.id, // Add order ID for direct order access
            unitCost: parseFloat(item.unitCost) || 0,
            quantityOrdered: item.quantity || 1,
            totalCost: parseFloat(item.totalCost) || 0,
            vendorSku: (item as any).vendorSku && (item as any).vendorSku !== 'null' ? (item as any).vendorSku : '-',
            upc: (item as any).productUpc || '-',
            brand: (item as any).productBrand || '-',
            model: (item as any).productModel || '-',
            category: (item as any).productCategory || '-',
            subcategory1: (item as any).productSubcategory1 || '-',
            subcategory2: (item as any).productSubcategory2 || '-',
            subcategory3: (item as any).productSubcategory3 || '-'
            // MAP and MSRP omitted - not available for historical order data
          };
          
          // Apply search filter if provided
          if (!search || 
              orderedItem.itemName.toLowerCase().includes((search as string).toLowerCase()) ||
              orderedItem.mfgPartNo.toLowerCase().includes((search as string).toLowerCase()) ||
              orderedItem.orderNumber.toLowerCase().includes((search as string).toLowerCase()) ||
              orderedItem.vendorSku.toLowerCase().includes((search as string).toLowerCase()) ||
              orderedItem.brand.toLowerCase().includes((search as string).toLowerCase()) ||
              orderedItem.model.toLowerCase().includes((search as string).toLowerCase()) ||
              orderedItem.upc.toLowerCase().includes((search as string).toLowerCase())) {
            orderedItems.push(orderedItem);
          }
        }
      }

      // Sort by order date (newest first)
      orderedItems.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

      res.json({
        items: orderedItems,
        totalOrders: filteredOrders.length,
        totalValue: orderedItems.reduce((sum, item) => sum + (item.totalCost || 0), 0)
      });
    } catch (error) {
      console.error('Ordered items report error:', error);
      res.status(500).json({ message: "Failed to fetch ordered items report" });
    }
  });

  // CSV Export for vendor orders
  app.get("/org/:slug/api/orders/:orderId/csv-export", requireOrganizationAccess, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const organizationId = (req as any).organizationId;
      
      // Get order with full details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify order belongs to this organization
      if (order.companyId !== organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get order items with product details
      const orderItems = await storage.getOrderItemsByOrderId(orderId);
      
      // Get vendor info
      const vendor = await storage.getVendor(order.vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      console.log('CSV EXPORT DEBUG: Vendor data:', {
        id: vendor.id,
        name: vendor.name,
        vendorShortCode: vendor.vendorShortCode
      });
      
      // Format order data for CSV export
      const { getCategoryDisplayName } = await import('../shared/category-config.js');
      const orderForExport = {
        id: order.id,
        orderNumber: order.orderNumber,
        companyId: order.companyId,
        vendor: {
          name: vendor.name,
          vendorShortCode: vendor.vendorShortCode
        },
        items: orderItems.map(item => ({
          id: item.id,
          quantity: item.quantity,
          unitCost: item.unitCost.toString(),
          totalCost: item.totalCost.toString(),
          vendorSku: item.vendorSku,
          vendorMsrp: item.vendorMsrp?.toString() || null,
          vendorMapPrice: item.vendorMapPrice?.toString() || null,
          retailPrice: item.retailPrice?.toString() || null, // Include configured price from Add to Order modal
          category: item.category ? getCategoryDisplayName(item.category) : null, // Convert slug to display name
          product: {
            name: (item as any).productName || '',
            upc: (item as any).productUpc || null,
            brand: (item as any).productBrand || null,
            model: item.model || (item as any).productModel || null, // Use order item's model (user-editable) if available, fallback to product model
            manufacturerPartNumber: (item as any).productMfgPartNumber || null,
            category: (item as any).productCategory || null,
            subcategory1: (item as any).productSubcategory1 || null,
            subcategory2: (item as any).productSubcategory2 || null,
            subcategory3: (item as any).productSubcategory3 || null,
            description: (item as any).productDescription || null,
            imageUrl: (item as any).productImageUrl || null
          }
        }))
      };
      
      // Generate CSV content using async method with pricing calculations
      console.log(`Generating CSV for order ${order.orderNumber}...`);
      const csvContent = await csvExportService.generateOrderCSV(orderForExport);
      console.log(`CSV generated, length: ${csvContent.length}`);
      
      // Create enhanced filename using centralized configuration
      const orderDate = new Date(order.orderDate);
      const fileName = generateEnhancedFilename(vendor.vendorShortCode, order.orderNumber, orderDate);
      console.log(`Generated filename: "${fileName}"`);
      
      // Set response headers for file download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8').toString());
      
      console.log(`Sending CSV response for ${fileName}...`);
      res.send(csvContent);
      console.log(`CSV response sent successfully for ${fileName}`);
    } catch (error) {
      console.error('CSV export error:', error);
      res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  // Order Quantity Export CSV for vendor orders
  app.get("/org/:slug/api/orders/:orderId/quantity-export", requireOrganizationAccess, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const organizationId = (req as any).organizationId;
      
      // Get order with full details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify order belongs to this organization
      if (order.companyId !== organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get order items with product details
      const orderItems = await storage.getOrderItemsByOrderId(orderId);
      
      // Get vendor info
      const vendor = await storage.getVendor(order.vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      // Format order data for CSV export
      const orderForExport = {
        id: order.id,
        orderNumber: order.orderNumber,
        companyId: order.companyId,
        vendor: {
          name: vendor.name,
          vendorShortCode: vendor.vendorShortCode
        },
        items: orderItems.map(item => ({
          id: item.id,
          quantity: item.quantity,
          unitCost: item.unitCost.toString(),
          totalCost: item.totalCost.toString(),
          vendorSku: item.vendorSku,
          vendorMsrp: item.vendorMsrp?.toString() || null,
          vendorMapPrice: item.vendorMapPrice?.toString() || null,
          retailPrice: item.retailPrice?.toString() || null, // Include configured price from Add to Order modal
          product: {
            name: (item as any).productName || '',
            upc: (item as any).productUpc || null,
            brand: (item as any).productBrand || null,
            model: (item as any).productModel || null,
            manufacturerPartNumber: (item as any).productMfgPartNumber || null,
            category: (item as any).productCategory || null,
            subcategory1: (item as any).productSubcategory1 || null,
            subcategory2: (item as any).productSubcategory2 || null,
            subcategory3: (item as any).productSubcategory3 || null,
            description: (item as any).productDescription || null,
            imageUrl: (item as any).productImageUrl || null
          }
        }))
      };
      
      // Generate Order Quantity Export CSV content
      const csvContent = await csvExportService.generateOrderQuantityCSV(orderForExport);
      
      // Create filename using centralized configuration
      const orderDate = new Date(order.orderDate);
      const filename = CSV_EXPORT_CONFIG.FILENAME_GENERATORS.ORDER_QUANTITY(
        vendor.vendorShortCode || vendor.name,
        order.orderNumber,
        orderDate
      );
      
      // Set appropriate headers for CSV download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8').toString());
      res.send(csvContent);
    } catch (error) {
      console.error('Order Quantity Export error:', error);
      res.status(500).json({ message: "Failed to export Order Quantity CSV" });
    }
  });

  // Swipe Simple CSV Export for vendor orders
  app.get("/org/:slug/api/orders/:orderId/swipe-simple-export", requireOrganizationAccess, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const organizationId = (req as any).organizationId;
      
      // Get order with full details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify order belongs to this organization
      if (order.companyId !== organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get order items with product details
      const orderItems = await storage.getOrderItemsByOrderId(orderId);
      
      // Get vendor info
      const vendor = await storage.getVendor(order.vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      // Get integration settings for Swipe Simple configuration
      let integrationSettings = null;
      try {
        integrationSettings = await storage.getIntegrationSettings(organizationId);
      } catch (error) {
        console.log('Integration settings table may not exist yet, using defaults:', error);
        // Continue with default values if table doesn't exist
      }
      const taxSetting = integrationSettings?.swipeSimpleTax || "TRUE";
      const trackInventorySetting = integrationSettings?.swipeSimpleTrackInventory || "TRUE";
      
      // Helper function to format UPC as text without apostrophe
      // Swipe Simple expects UPC in plain format without quotes or apostrophes
      const formatUPCAsText = (value: string): string => {
        if (!value) return '';
        const cleanValue = String(value).trim();
        // For Swipe Simple: Return unquoted value to prevent Excel/import systems from adding apostrophes
        // Leading zeros are preserved in the import process without needing quotes
        return cleanValue;
      };

      // Generate Swipe Simple CSV content with PriceCompare mapping
      const { getCategoryDisplayName } = await import('../shared/category-config.js');
      const csvRows = [];
      
      // Add header row (no quotes needed for headers)
      csvRows.push(['ID', 'Name', 'SKU', 'Price', 'Tax', 'Status', 'Track_inventory', 'on_hand_count', 'Category']);
      
      // Add data rows for each order item
      for (const item of orderItems) {
        const upcValue = (item as any).productUpc || '';
        
        csvRows.push([
          '', // ID - Leave blank as specified
          (item as any).productName || '', // Name
          upcValue, // SKU - UPC (will be formatted consistently with MicroBiz below)
          item.retailPrice?.toString() || item.unitCost.toString(), // Price - use retail price if available, fallback to unit cost
          taxSetting, // Tax - Based on setting
          'active', // Status - always export with value 'active'
          trackInventorySetting, // Track_inventory - Based on setting
          item.quantity.toString(), // on_hand_count - Order quantity as specified
          item.category ? getCategoryDisplayName(item.category) : '' // Convert slug to display name
        ]);
      }
      
      // Convert to CSV string with proper UPC formatting (same as MicroBiz)
      const csvContent = csvRows.map((row, index) => {
        if (index === 0) {
          // Header row - simple quoting for consistency
          return row.map(cell => `"${cell}"`).join(',');
        } else {
          // Data rows - format UPC (SKU column) the same way as MicroBiz
          return row.map((cell, colIndex) => {
            if (colIndex === 2) { // SKU column (UPC)
              return formatUPCAsText(cell.toString());
            } else {
              return `"${cell.toString().replace(/"/g, '""')}"`;
            }
          }).join(',');
        }
      }).join('\n');
      
      // Create filename
      const orderDate = new Date(order.orderDate);
      const filename = `swipe-simple-${vendor.vendorShortCode || 'vendor'}-${order.orderNumber}-${orderDate.getFullYear()}${String(orderDate.getMonth() + 1).padStart(2, '0')}${String(orderDate.getDate()).padStart(2, '0')}.csv`;
      
      // Set appropriate headers for CSV download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8').toString());
      
      console.log(`Swipe Simple CSV export generated for order ${order.orderNumber}, ${orderItems.length} items`);
      res.send(csvContent);
    } catch (error) {
      console.error('Swipe Simple CSV export error:', error);
      res.status(500).json({ message: "Failed to export Swipe Simple CSV" });
    }
  });

  // Email CSV export for vendor orders
  app.post("/org/:slug/api/orders/:orderId/email-csv", requireOrganizationAccess, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const organizationId = (req as any).organizationId;
      const { recipientEmail } = req.body;
      
      if (!recipientEmail) {
        return res.status(400).json({ message: "Recipient email is required" });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      
      // Get order with full details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify order belongs to this organization
      if (order.companyId !== organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get order items with product details
      const orderItems = await storage.getOrderItemsByOrderId(orderId);
      
      // Get vendor info
      const vendor = await storage.getVendor(order.vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      // Get company info for sender details
      const company = await storage.getCompany(organizationId);
      
      // Format order data for CSV export
      const orderForExport = {
        id: order.id,
        orderNumber: order.orderNumber,
        companyId: order.companyId,
        vendor: {
          name: vendor.name,
          vendorShortCode: vendor.vendorShortCode
        },
        items: orderItems.map(item => ({
          id: item.id,
          quantity: item.quantity,
          unitCost: item.unitCost.toString(),
          totalCost: item.totalCost.toString(),
          vendorSku: item.vendorSku,
          vendorMsrp: item.vendorMsrp?.toString() || null,
          vendorMapPrice: item.vendorMapPrice?.toString() || null,
          retailPrice: item.retailPrice?.toString() || null, // Include configured price from Add to Order modal
          product: {
            name: (item as any).productName || '',
            upc: (item as any).productUpc || null,
            brand: (item as any).productBrand || null,
            model: (item as any).productModel || null,
            manufacturerPartNumber: (item as any).productMfgPartNumber || null,
            category: (item as any).productCategory || null,
            subcategory1: (item as any).productSubcategory1 || null,
            subcategory2: (item as any).productSubcategory2 || null,
            subcategory3: (item as any).productSubcategory3 || null,
            description: (item as any).productDescription || null,
            imageUrl: (item as any).productImageUrl || null
          }
        }))
      };
      
      // Generate both CSV contents
      const csvContent = await csvExportService.generateOrderCSV(orderForExport);
      const quantityExportContent = await csvExportService.generateOrderQuantityCSV(orderForExport);
      
      // Create enhanced filenames using centralized configuration
      const orderDate = new Date(order.orderDate);
      const fileName = generateEnhancedFilename(vendor.vendorShortCode, order.orderNumber, orderDate);
      const quantityFileName = CSV_EXPORT_CONFIG.FILENAME_GENERATORS.ORDER_QUANTITY(
        vendor.vendorShortCode || vendor.name,
        order.orderNumber,
        orderDate
      );
      
      // Get admin settings for email service
      const adminSettings = await storage.getAdminSettings();
      
      // Import email service
      const { sendEmail } = await import('./email-service');
      
      // Create product list table for email
      const productListHtml = `
        <div style="background-color: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #555;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
                <th style="padding: 8px; text-align: left; font-size: 12px;">Product Name</th>
                <th style="padding: 8px; text-align: center; font-size: 12px;">Qty</th>
                <th style="padding: 8px; text-align: left; font-size: 12px;">UPC</th>
                <th style="padding: 8px; text-align: right; font-size: 12px;">Cost</th>
              </tr>
            </thead>
            <tbody>
              ${orderForExport.items.map((item: any, index: number) => `
                <tr style="border-bottom: 1px solid #eee; ${index % 2 === 0 ? 'background-color: #f9f9f9;' : ''}">
                  <td style="padding: 8px; font-size: 12px;">${item.product.name || 'N/A'}</td>
                  <td style="padding: 8px; text-align: center; font-size: 12px; font-weight: bold;">${item.quantity}</td>
                  <td style="padding: 8px; font-size: 11px; color: #666;">${item.product.upc || 'N/A'}</td>
                  <td style="padding: 8px; text-align: right; font-size: 12px;">$${item.unitCost}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      
      // Create email content with CSV attachments
      const emailContent = {
        to: recipientEmail,
        from: adminSettings?.systemEmail || 'noreply@pricecomparehub.com',
        subject: `MicroBiz Import Files - Order ${order.orderNumber}`,
        attachments: [
          {
            filename: fileName,
            content: Buffer.from(csvContent).toString('base64'),
            type: 'text/csv'
          },
          {
            filename: quantityFileName,
            content: Buffer.from(quantityExportContent).toString('base64'),
            type: 'text/csv'
          }
        ],
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">MicroBiz Import Files - Order ${order.orderNumber}</h2>
            
            <p>Please find the MicroBiz product import files for your vendor order below.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #555;">Order Details</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Order Number:</strong> ${order.orderNumber}</li>
                <li><strong>Vendor:</strong> ${vendor.name}</li>
                <li><strong>Total Items:</strong> ${orderForExport.items.length}</li>
              </ul>
            </div>
            
            ${productListHtml}
            
            <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #555;">Files Included</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Product Import File:</strong> Complete product information for MicroBiz</li>
                <li><strong>Order Quantity Export:</strong> Simplified 3-column format (Part #, Quantity, Cost)</li>
              </ul>
            </div>
            
            <h3 style="color: #555;">Instructions:</h3>
            <ol>
              <li>Download the attached CSV files</li>
              <li>Import the Product file into MicroBiz for complete product data</li>
              <li>Use the Order Quantity file for simplified order tracking</li>
              <li>Review and verify all imported products</li>
            </ol>
            
            <p>If you have any questions about these import files, please contact support.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>${adminSettings?.brandName || 'BestPrice Platform'} Team</strong>
            </p>
          </div>
        `
      };
      
      // Send email using your existing email service (SMTP2GO or SendGrid)
      const success = await sendEmail(emailContent, adminSettings);
      
      if (success) {
        console.log(`MicroBiz CSV email sent successfully to ${recipientEmail} for order ${order.orderNumber}`);
        res.json({ message: "CSV export email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send email. Please check your SMTP2GO or SendGrid configuration in Admin Settings." });
      }
    } catch (error) {
      console.error('Email CSV export error:', error);
      res.status(500).json({ message: "Failed to send CSV export email" });
    }
  });

  // Email Swipe Simple CSV export for vendor orders
  app.post("/org/:slug/api/orders/:orderId/email-swipe-simple-csv", requireOrganizationAccess, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const organizationId = (req as any).organizationId;
      const { recipientEmail } = req.body;
      
      if (!recipientEmail) {
        return res.status(400).json({ message: "Recipient email is required" });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      
      // Get order with full details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify order belongs to this organization
      if (order.companyId !== organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get order items with product details
      const orderItems = await storage.getOrderItemsByOrderId(orderId);
      
      // Get vendor info
      const vendor = await storage.getVendor(order.vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      // Get company info for sender details
      const company = await storage.getCompany(organizationId);
      
      // Get integration settings for Swipe Simple
      let integrationSettings;
      try {
        integrationSettings = await storage.getIntegrationSettings(organizationId);
      } catch (error) {
        console.warn('Integration settings table may not exist yet, using default values');
        // Continue with default values if table doesn't exist
      }
      const taxSetting = integrationSettings?.swipeSimpleTax || "TRUE";
      const trackInventorySetting = integrationSettings?.swipeSimpleTrackInventory || "TRUE";
      
      // Helper function to format UPC as text without apostrophe
      const formatUPCAsText = (value: string): string => {
        if (!value) return '';
        const cleanValue = String(value).trim();
        return cleanValue;
      };

      // Generate Swipe Simple CSV content with PriceCompare mapping
      const csvRows = [];
      
      // Add header row
      csvRows.push(['ID', 'Name', 'SKU', 'Price', 'Tax', 'Status', 'Track_inventory', 'on_hand_count', 'Category']);
      
      // Add data rows for each order item
      for (const item of orderItems) {
        const upcValue = (item as any).productUpc || '';
        
        csvRows.push([
          '', // ID - Leave blank
          (item as any).productName || '', // Name
          upcValue, // SKU - UPC
          item.retailPrice?.toString() || item.unitCost.toString(), // Price
          taxSetting, // Tax
          'active', // Status
          trackInventorySetting, // Track_inventory
          item.quantity.toString(), // on_hand_count
          (item as any).productCategory || '' // Category
        ]);
      }
      
      // Convert to CSV string with proper UPC formatting
      const csvContent = csvRows.map((row, index) => {
        if (index === 0) {
          // Header row
          return row.map(cell => `"${cell}"`).join(',');
        } else {
          // Data rows - format UPC (SKU column) without quotes
          return row.map((cell, colIndex) => {
            if (colIndex === 2) { // SKU column (UPC)
              return formatUPCAsText(cell.toString());
            } else {
              return `"${cell.toString().replace(/"/g, '""')}"`;
            }
          }).join(',');
        }
      }).join('\n');
      
      // Create filename
      const orderDate = new Date(order.orderDate);
      const filename = `swipe-simple-${vendor.vendorShortCode || 'vendor'}-${order.orderNumber}-${orderDate.getFullYear()}${String(orderDate.getMonth() + 1).padStart(2, '0')}${String(orderDate.getDate()).padStart(2, '0')}.csv`;
      
      // Get admin settings for email service
      const adminSettings = await storage.getAdminSettings();
      
      // Import email service
      const { sendEmail } = await import('./email-service');
      
      // Create email content with CSV attachment
      const emailContent = {
        to: recipientEmail,
        from: adminSettings?.systemEmail || 'noreply@pricecomparehub.com',
        subject: `Swipe Simple CSV Export - Order ${order.orderNumber}`,
        attachments: [
          {
            filename: filename,
            content: Buffer.from(csvContent).toString('base64'),
            type: 'text/csv'
          }
        ],
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Swipe Simple CSV Export - Order ${order.orderNumber}</h2>
            
            <p>Please find attached the Swipe Simple CSV export for your vendor order.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #555;">Order Details</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Order Number:</strong> ${order.orderNumber}</li>
                <li><strong>Vendor:</strong> ${vendor.name}</li>
                <li><strong>Total Items:</strong> ${orderItems.length}</li>
              </ul>
            </div>
            
            <div style="background-color: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #555;">Order Items</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
                    <th style="padding: 8px; text-align: left; font-size: 12px;">Product Name</th>
                    <th style="padding: 8px; text-align: center; font-size: 12px;">Qty</th>
                    <th style="padding: 8px; text-align: left; font-size: 12px;">UPC</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderItems.map((item: any, index: number) => `
                    <tr style="border-bottom: 1px solid #eee; ${index % 2 === 0 ? 'background-color: #f9f9f9;' : ''}">
                      <td style="padding: 8px; font-size: 12px;">${(item as any).productName || 'N/A'}</td>
                      <td style="padding: 8px; text-align: center; font-size: 12px; font-weight: bold;">${item.quantity}</td>
                      <td style="padding: 8px; font-size: 11px; color: #666;">${(item as any).productUpc || 'N/A'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #555;">File Format</h3>
              <p style="margin: 10px 0;">This CSV file is formatted for Swipe Simple (PriceCompare-compatible) and includes:</p>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Product names and SKU/UPC codes</li>
                <li>Pricing information</li>
                <li>Inventory quantities</li>
                <li>Product categories</li>
              </ul>
            </div>
            
            <h3 style="color: #555;">Instructions:</h3>
            <ol>
              <li>Download the attached CSV file</li>
              <li>Import into Swipe Simple following their import process</li>
              <li>Verify all products imported correctly</li>
            </ol>
            
            <p>If you have any questions about this export file, please contact support.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>${adminSettings?.brandName || 'BestPrice Platform'} Team</strong>
            </p>
          </div>
        `
      };
      
      // Send email using your existing email service (SMTP2GO or SendGrid)
      const success = await sendEmail(emailContent, adminSettings);
      
      if (success) {
        console.log(`Swipe Simple CSV email sent successfully to ${recipientEmail} for order ${order.orderNumber}`);
        res.json({ message: "Swipe Simple CSV email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send email. Please check your SMTP2GO or SendGrid configuration in Admin Settings." });
      }
    } catch (error) {
      console.error('Email Swipe Simple CSV export error:', error);
      res.status(500).json({ message: "Failed to send Swipe Simple CSV email" });
    }
  });

  // Get stores for current company
  app.get("/org/:slug/api/stores", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const stores = await storage.getStoresByCompany(organizationId);
      res.json(stores);
    } catch (error) {
      console.error('Get stores error:', error);
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  // Update store
  app.patch("/org/:slug/api/stores/:storeId", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const storeId = parseInt(req.params.storeId);
      const updates = req.body;

      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid store ID" });
      }

      // Verify the store belongs to this organization
      const store = await storage.getStore(storeId);
      if (!store || store.companyId !== organizationId) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Update the store
      const updatedStore = await storage.updateStore(storeId, updates);
      res.json(updatedStore);
    } catch (error) {
      console.error('Update store error:', error);
      res.status(500).json({ message: "Failed to update store" });
    }
  });

  // Vendor enabled/disabled toggle endpoint
  app.patch("/org/:slug/api/vendors/:vendorSlug/toggle-enabled", requireOrganizationAccess, async (req, res) => {
    try {
      console.log('🔄 VENDOR TOGGLE: Endpoint reached');
      console.log('🔄 VENDOR TOGGLE: req.params:', req.params);
      console.log('🔄 VENDOR TOGGLE: req.body:', req.body);
      
      const companyId = (req as any).organizationId;
      const vendorSlug = req.params.vendorSlug;
      const { enabled } = req.body;
      
      console.log('🔄 VENDOR TOGGLE: companyId:', companyId);
      console.log('🔄 VENDOR TOGGLE: vendorSlug:', vendorSlug);
      console.log('🔄 VENDOR TOGGLE: enabled:', enabled);
      
      if (!vendorSlug || typeof vendorSlug !== 'string') {
        console.log('🔄 VENDOR TOGGLE: Invalid vendor slug');
        return res.status(400).json({ error: 'Invalid vendor slug' });
      }
      
      // Check vendor limits when ENABLING a vendor
      if (enabled) {
        const company = await storage.getCompany(companyId);
        if (!company) {
          return res.status(404).json({ error: 'Organization not found' });
        }
        
        // Get plan limits from plan settings
        const planSettingsRecord = await storage.getPlanSettings(company.plan);
        const maxVendors = planSettingsRecord?.maxVendors;
        
        // Only enforce limit if maxVendors is set (not null/unlimited)
        if (maxVendors !== null && maxVendors !== undefined) {
          // Count currently enabled vendors
          const allVendors = await storage.getVendorsByCompany(companyId);
          const enabledVendorsCount = allVendors.filter(v => v.enabledForPriceComparison).length;
          
          console.log('🔄 VENDOR TOGGLE: Vendor limit check', {
            currentEnabled: enabledVendorsCount,
            maxAllowed: maxVendors,
            plan: company.plan
          });
          
          // Check if enabling would exceed the limit
          if (enabledVendorsCount >= maxVendors) {
            console.log('🔄 VENDOR TOGGLE: Vendor limit exceeded');
            return res.status(402).json({
              error: 'Vendor limit exceeded',
              message: `Your current plan is limited to ${maxVendors} vendors. You currently have ${enabledVendorsCount} enabled. Please disable another vendor or upgrade your plan.`,
              code: 'VENDOR_LIMIT_EXCEEDED',
              currentEnabled: enabledVendorsCount,
              maxAllowed: maxVendors
            });
          }
        } else {
          console.log('🔄 VENDOR TOGGLE: No vendor limit (unlimited)');
        }
      }
      
      // Update the vendor's enabled status for price comparison
      await storage.updateVendorEnabledStatusBySlug(companyId, vendorSlug, enabled);
      
      console.log('🔄 VENDOR TOGGLE: Success - vendor updated');
      
      // Verify the update by fetching the vendor
      const specificVendor = await storage.getVendorBySlug(vendorSlug, companyId);
      
      // Validate that the update was successful
      if (!specificVendor) {
        console.error('🔄 VENDOR TOGGLE: Validation failed - vendor not found after update');
        return res.status(500).json({ 
          success: false,
          error: 'Vendor state validation failed - vendor not found after update' 
        });
      }
      
      if (specificVendor.enabledForPriceComparison !== enabled) {
        console.error('🔄 VENDOR TOGGLE: Validation failed - state mismatch', {
          expected: enabled,
          actual: specificVendor.enabledForPriceComparison
        });
        return res.status(500).json({ 
          success: false,
          error: 'Vendor state validation failed - update did not persist correctly' 
        });
      }
      
      console.log('🔄 VENDOR TOGGLE: Validation passed - vendor state updated correctly');
      
      res.json({ 
        success: true,
        message: `Vendor has been ${enabled ? 'enabled' : 'disabled'} for price comparison searches`
      });
    } catch (error: any) {
      console.error('🔄 VENDOR TOGGLE: Error toggling vendor enabled status:', error);
      res.status(500).json({ error: 'Failed to update vendor status' });
    }
  });

  // Get company info for current company
  app.get("/org/:slug/api/organization", requireOrganizationAccess, async (req, res) => {
    try {
      const companyId = (req as any).organizationId;
      const company = await storage.getCompany(companyId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company data" });
    }
  });

  // Public company info for login screen (no auth required)
  app.get("/org/:slug/api/organization-public", async (req, res) => {
    try {
      const slug = req.params.slug;
      const companies = await storage.getAllCompanies();
      const company = companies.find(comp => comp.slug === slug);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Only return public fields for login screen
      res.json({
        id: company.id,
        name: company.name,
        logoUrl: company.logoUrl
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company data" });
    }
  });

  // Subscription Management Routes
  app.get("/org/:slug/api/subscription", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const organization = await storage.getCompany(organizationId);
      
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Get current usage data
      const users = await storage.getUsersByCompany(organizationId);
      const vendors = await storage.getVendorsByCompany(organizationId);
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      const orders = await storage.getOrdersByCompany(organizationId);
      const monthlyOrders = orders.filter(order => 
        new Date(order.orderDate) >= currentMonth
      );

      // Build subscription response using centralized configuration
      const { getSubscriptionPlan } = await import('../shared/subscription-config');
      const planConfig = getSubscriptionPlan(organization.plan) || getSubscriptionPlan('free');
      
      const subscriptionData = {
        id: organization.billingSubscriptionId || organization.id.toString(),
        plan: {
          name: planConfig.displayName,
          code: planConfig.name,
          price: planConfig.price,
          interval: planConfig.interval
        },
        status: organization.trialStatus || (organization.status === 'active' ? 'active' : 'expired'),
        trialEndsAt: organization.trialEndsAt?.toISOString(),
        nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        usage: {
          users: {
            current: users.length,
            limit: organization.maxUsers
          },
          vendors: {
            current: vendors.length,
            limit: organization.maxVendors
          }
        }
      };
      
      res.json(subscriptionData);
    } catch (error) {
      console.error('Subscription fetch error:', error);
      res.status(500).json({ message: "Failed to fetch subscription data" });
    }
  });

  // Get available plans for upgrade/downgrade
  app.get("/org/:slug/api/subscription/plans", requireOrganizationAccess, async (req, res) => {
    try {
      const availablePlans = [
        {
          code: 'basic',
          name: 'Basic Plan',
          price: 29,
          interval: 'month',
          features: {
            maxUsers: 3,
            maxVendors: 2,
            advancedAnalytics: false,
            apiAccess: false
          }
        },
        {
          code: 'professional',
          name: 'Professional Plan',
          price: 99,
          interval: 'month',
          features: {
            maxUsers: 10,
            maxVendors: 5,
            advancedAnalytics: true,
            apiAccess: false
          }
        },
        {
          code: 'enterprise',
          name: 'Enterprise Plan',
          price: 299,
          interval: 'month',
          features: {
            maxUsers: 50,
            maxVendors: 20,
            advancedAnalytics: true,
            apiAccess: true
          }
        }
      ];
      
      res.json(availablePlans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch available plans" });
    }
  });

  // Change subscription plan
  app.post("/org/:slug/api/subscription/change-plan", requireOrganizationAccess, async (req, res) => {
    try {
      const companyId = (req as any).organizationId;
      const { planCode, changeType } = req.body;
      
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // If company has Zoho billing, integrate with Zoho API
      if (company.billingProvider === 'zoho' && company.billingSubscriptionId) {
        try {
          // Import Zoho billing service
          const { zohoBillingService } = await import('./zoho-billing-service');
          
          // Use Zoho API to change plan
          const result = await zohoBillingService.changePlan(
            company.billingSubscriptionId, 
            planCode,
            changeType === 'upgrade' // immediate for upgrades, next cycle for downgrades
          );
          
          res.json({
            success: true,
            message: changeType === 'upgrade' 
              ? "Plan upgraded successfully. Changes are now active."
              : "Plan downgrade scheduled. Changes will take effect at your next billing cycle.",
            zohoResult: result
          });
        } catch (zohoError) {
          console.error('Zoho plan change error:', zohoError);
          res.status(500).json({ 
            success: false, 
            message: "Failed to change plan with billing provider. Please contact support." 
          });
        }
      } else {
        // For organizations without billing provider, update locally
        const planLimits = {
          basic: { maxUsers: 3, maxVendors: 2 },
          professional: { maxUsers: 10, maxVendors: 5 },
          enterprise: { maxUsers: 50, maxVendors: 20 }
        };
        
        const limits = planLimits[planCode as keyof typeof planLimits] || planLimits.basic;
        
        await storage.updateCompany(companyId, {
          plan: planCode,
          maxUsers: limits.maxUsers,
          maxVendors: limits.maxVendors
        });
        
        res.json({
          success: true,
          message: "Plan updated successfully."
        });
      }
    } catch (error) {
      console.error('Plan change error:', error);
      res.status(500).json({ message: "Failed to change plan" });
    }
  });

  // Extend trial (one-time extension)
  app.post("/org/:slug/api/subscription/extend-trial", requireOrganizationAccess, async (req, res) => {
    try {
      const companyId = (req as any).organizationId;
      const company = await storage.getCompany(companyId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Check if trial extension is allowed
      if ((company.trialExtensions || 0) >= 1) {
        return res.status(400).json({ 
          message: "Trial extension limit reached. Only one extension is allowed per company." 
        });
      }

      if (company.trialStatus !== 'active' && company.trialStatus !== 'expiring') {
        return res.status(400).json({ 
          message: "Trial extension is only available for active trials." 
        });
      }

      // Extend trial by 7 days
      const currentTrialEnd = company.trialEndsAt || new Date();
      const newTrialEnd = new Date(currentTrialEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      await storage.updateCompany(companyId, {
        trialEndsAt: newTrialEnd,
        trialExtensions: (company.trialExtensions || 0) + 1,
        trialStatus: 'active'
      });
      
      res.json({
        success: true,
        message: "Trial extended successfully",
        newTrialEndDate: newTrialEnd.toISOString()
      });
    } catch (error) {
      console.error('Trial extension error:', error);
      res.status(500).json({ message: "Failed to extend trial" });
    }
  });

  // Get retail verticals
  app.get("/org/:slug/api/retail-verticals", requireOrganizationAccess, async (req, res) => {
    try {
      const retailVerticals = await storage.getRetailVerticals();
      res.json(retailVerticals);
    } catch (error) {
      console.error('Error fetching retail verticals:', error);
      res.status(500).json({ message: "Failed to fetch retail verticals" });
    }
  });

  // ===========================================
  // ORGANIZATION USER MANAGEMENT ROUTES
  // ===========================================

  // Get all organization users
  app.get("/org/:slug/api/users", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const currentUser = (req as any).user;
      const isAdminUser = currentUser?.companyId === null;
      
      console.log('GET /org/:slug/api/users:', {
        slug: req.params.slug,
        organizationId,
        currentUserId: currentUser?.id,
        currentUserCompanyId: currentUser?.companyId,
        isAdminUser
      });
      
      // Validate organizationId is set
      if (!organizationId) {
        console.error('GET /org/:slug/api/users: organizationId is not set!');
        return res.status(400).json({ message: "Organization context is required" });
      }
      
      const users = await storage.getUsersByCompany(organizationId);
      
      console.log(`GET /org/:slug/api/users: Found ${users.length} users for organizationId ${organizationId}`);
      
      // Remove password from response - unified users table fields
      const safeUsers = users.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        email: user.email,
        username: user.username,
        role: user.role,
        isAdmin: user.isAdmin,
        isActive: user.isActive,
        defaultStoreId: user.defaultStoreId,
        lastLoginAt: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));
      
      res.json(safeUsers);
    } catch (error) {
      console.error('Failed to fetch organization users:', error);
      res.status(500).json({ message: "Failed to fetch organization users" });
    }
  });

  // Create new organization user
  app.post("/org/:slug/api/users", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username is already taken
      const existingUser = await storage.getUserByUsernameAndCompany(userData.username, organizationId);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash password before storing
      const hashedPassword = await hashPassword(userData.password);
      
      const newUser = await storage.createUser({
        ...userData,
        companyId: organizationId,
        password: hashedPassword
      });
      
      // Remove password from response
      const { password, ...safeUser } = newUser;
      res.status(201).json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid user data", errors: error.errors });
      } else {
        console.error('Failed to create organization user:', error);
        res.status(500).json({ message: "Failed to create organization user" });
      }
    }
  });

  // Update organization user
  app.patch("/org/:slug/api/users/:id", requireOrganizationAccess, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const organizationId = (req as any).organizationId;
      
      // Verify user belongs to organization
      const existingUser = await storage.getUser(userId);
      if (!existingUser || existingUser.companyId !== organizationId) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const updates = req.body;
      
      // Hash password if it's being updated
      if (updates.password) {
        updates.password = await hashPassword(updates.password);
      }
      
      // Check username uniqueness if it's being updated
      if (updates.username && updates.username !== existingUser.username) {
        const existingUsername = await storage.getUserByUsernameAndCompany(updates.username, organizationId);
        if (existingUsername) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }
      
      const updatedUser = await storage.updateUser(userId, updates);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user" });
      }
      
      // Remove password from response
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error('Failed to update organization user:', error);
      res.status(500).json({ message: "Failed to update organization user" });
    }
  });

  // Delete organization user
  app.delete("/org/:slug/api/users/:id", requireOrganizationAccess, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const organizationId = (req as any).organizationId;
      
      // Verify user belongs to organization
      const existingUser = await storage.getUser(userId);
      if (!existingUser || existingUser.companyId !== organizationId) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Prevent deletion of the last admin user
      const orgUsers = await storage.getUsersByCompany(organizationId);
      const adminUsers = orgUsers.filter(u => u.isAdmin && u.id !== userId);
      if (existingUser.isAdmin && adminUsers.length === 0) {
        return res.status(400).json({ message: "Cannot delete the last admin user" });
      }
      
      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete user" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete organization user:', error);
      res.status(500).json({ message: "Failed to delete organization user" });
    }
  });

  // Admin password reset endpoint - allows system admins to reset any user's password
  app.post("/org/:slug/api/users/:id/reset-password", requireOrganizationAccess, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const organizationId = (req as any).organizationId;
      const currentUser = (req as any).user;
      const isSystemAdmin = currentUser?.companyId === null;
      const isOrgAdmin = currentUser?.isAdmin === true;
      
      console.log('Admin password reset request:', {
        userId,
        organizationId,
        currentUserId: currentUser?.id,
        isSystemAdmin,
        isOrgAdmin
      });
      
      // Only system admins or org admins can reset passwords
      if (!isSystemAdmin && !isOrgAdmin) {
        return res.status(403).json({ message: "Only administrators can reset user passwords" });
      }
      
      // Verify user belongs to organization
      const existingUser = await storage.getUser(userId);
      if (!existingUser || existingUser.companyId !== organizationId) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Generate a secure random password
      const newPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!';
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user password
      await storage.updateUser(userId, { password: hashedPassword });
      
      console.log(`Password reset successfully for user ${userId} by admin ${currentUser?.id}`);
      
      // Return the new password so admin can share it with the user
      res.status(200).json({ 
        message: "Password reset successfully",
        newPassword,
        username: existingUser.username
      });
    } catch (error) {
      console.error('Failed to reset user password:', error);
      res.status(500).json({ message: "Failed to reset user password" });
    }
  });

  // Get user's store assignments
  app.get("/org/:slug/api/users/:id/stores", requireOrganizationAccess, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const organizationId = (req as any).organizationId;
      
      // Verify user belongs to organization
      const user = await storage.getUser(userId);
      if (!user || user.companyId !== organizationId) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const userStores = await storage.getUserStores(userId);
      res.json(userStores);
    } catch (error) {
      console.error('Failed to get user stores:', error);
      res.status(500).json({ message: "Failed to get user stores" });
    }
  });

  // Assign user to store
  app.post("/org/:slug/api/stores/:storeId/users", requireOrganizationAccess, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const organizationId = (req as any).organizationId;
      const { userId, role, permissions } = req.body;
      
      // Verify store belongs to organization
      const store = await storage.getStore(storeId);
      if (!store || store.companyId !== organizationId) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Verify user belongs to organization
      const user = await storage.getUser(userId);
      if (!user || user.companyId !== organizationId) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const assignment = await storage.assignUserToStore({
        userId,
        storeId,
        role: role || 'employee',
        permissions: permissions || [],
        isActive: true
      });
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Failed to assign user to store:', error);
      res.status(500).json({ message: "Failed to assign user to store" });
    }
  });

  // Remove user from store
  app.delete("/org/:slug/api/stores/:storeId/users/:userId", requireOrganizationAccess, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const userId = parseInt(req.params.userId);
      const organizationId = (req as any).organizationId;
      
      // Verify store belongs to organization
      const store = await storage.getStore(storeId);
      if (!store || store.companyId !== organizationId) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Verify user belongs to organization
      const user = await storage.getUser(userId);
      if (!user || user.companyId !== organizationId) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const success = await storage.removeUserFromStore(userId, storeId);
      if (!success) {
        return res.status(500).json({ message: "Failed to remove user from store" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Failed to remove user from store:', error);
      res.status(500).json({ message: "Failed to remove user from store" });
    }
  });

  // Pricing Configuration endpoints
  app.get("/org/:slug/api/pricing-configurations", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const configurations = await storage.getPricingConfigurations(organizationId);
      res.json(configurations);
    } catch (error) {
      console.error('Error fetching pricing configurations:', error);
      res.status(500).json({ message: "Failed to fetch pricing configurations" });
    }
  });

  app.post("/org/:slug/api/pricing-configurations", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      
      // Clean up the request body - convert empty strings to null for numeric fields
      const cleanedData = { ...req.body };
      const numericFields = [
        'markupPercentage', 'marginPercentage', 'premiumAmount', 
        'discountPercentage', 'roundingAmount', 'fallbackMarkupPercentage'
      ];
      
      numericFields.forEach(field => {
        if (cleanedData[field] === '' || cleanedData[field] === undefined) {
          cleanedData[field] = null;
        } else if (cleanedData[field] !== null && cleanedData[field] !== undefined) {
          // Convert string numbers to actual numbers
          const numValue = parseFloat(cleanedData[field]);
          cleanedData[field] = isNaN(numValue) ? null : numValue;
        }
      });
      
      const configData = {
        ...cleanedData,
        companyId: organizationId
      };
      
      const configuration = await storage.createPricingConfiguration(configData);
      res.status(201).json(configuration);
    } catch (error) {
      console.error('Error creating pricing configuration:', error);
      res.status(500).json({ message: "Failed to create pricing configuration" });
    }
  });

  app.patch("/org/:slug/api/pricing-configurations/:id", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const configId = parseInt(req.params.id);
      
      // Verify the configuration belongs to this organization
      const existingConfig = await storage.getPricingConfiguration(configId);
      if (!existingConfig || existingConfig.companyId !== organizationId) {
        return res.status(404).json({ message: "Pricing configuration not found" });
      }
      
      // Clean up the request body - convert empty strings to null for numeric fields
      const cleanedData = { ...req.body };
      const numericFields = [
        'markupPercentage', 'marginPercentage', 'premiumAmount', 
        'discountPercentage', 'roundingAmount', 'fallbackMarkupPercentage'
      ];
      
      numericFields.forEach(field => {
        if (cleanedData[field] === '' || cleanedData[field] === undefined) {
          cleanedData[field] = null;
        } else if (cleanedData[field] !== null && cleanedData[field] !== undefined) {
          // Convert string numbers to actual numbers
          const numValue = parseFloat(cleanedData[field]);
          cleanedData[field] = isNaN(numValue) ? null : numValue;
        }
      });
      
      const configuration = await storage.updatePricingConfiguration(configId, cleanedData);
      if (!configuration) {
        return res.status(404).json({ message: "Pricing configuration not found" });
      }
      
      res.json(configuration);
    } catch (error) {
      console.error('Error updating pricing configuration:', error);
      res.status(500).json({ message: "Failed to update pricing configuration" });
    }
  });

  app.delete("/org/:slug/api/pricing-configurations/:id", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const configId = parseInt(req.params.id);
      
      // Verify the configuration belongs to this organization
      const existingConfig = await storage.getPricingConfiguration(configId);
      if (!existingConfig || existingConfig.companyId !== organizationId) {
        return res.status(404).json({ message: "Pricing configuration not found" });
      }
      
      const success = await storage.deletePricingConfiguration(configId);
      if (!success) {
        return res.status(404).json({ message: "Pricing configuration not found" });
      }
      
      res.json({ message: "Pricing configuration deleted successfully" });
    } catch (error) {
      console.error('Error deleting pricing configuration:', error);
      res.status(500).json({ message: "Failed to delete pricing configuration" });
    }
  });

  app.post("/org/:slug/api/pricing-configurations/:id/set-default", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const configId = parseInt(req.params.id);
      
      // Verify the configuration belongs to this organization
      const existingConfig = await storage.getPricingConfiguration(configId);
      if (!existingConfig || existingConfig.companyId !== organizationId) {
        return res.status(404).json({ message: "Pricing configuration not found" });
      }
      
      const success = await storage.setDefaultPricingConfiguration(organizationId, configId);
      if (!success) {
        return res.status(500).json({ message: "Failed to set default pricing configuration" });
      }
      
      res.json({ message: "Default pricing configuration updated successfully" });
    } catch (error) {
      console.error('Error setting default pricing configuration:', error);
      res.status(500).json({ message: "Failed to set default pricing configuration" });
    }
  });

  // Update organization info (organization-aware)
  app.patch('/org/:slug/api/organization', requireOrganizationAccess, async (req, res) => {
    try {
      const { name, email, phone, retailVerticalId, settings } = req.body;
      const organizationId = (req as any).organizationId;
      

      
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID not found' });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (retailVerticalId !== undefined) updateData.retailVerticalId = retailVerticalId;
      if (settings !== undefined) updateData.settings = settings;
      
      const updatedOrg = await storage.updateCompany(organizationId, updateData);

      
      if (!updatedOrg) {
        return res.status(500).json({ error: 'Failed to update organization' });
      }

      res.json(updatedOrg);
    } catch (error) {
      console.error('Error updating organization:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Logo upload endpoint
  app.post('/org/:slug/api/organization/upload-logo', requireOrganizationAccess, upload.single('logo'), async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Get the file URL (relative to public directory)
      const logoUrl = `/uploads/${req.file.filename}`;
      // Update organization with new logo URL
      const updatedOrg = await storage.updateCompany(organizationId, { logoUrl });
      
      if (!updatedOrg) {
        return res.status(500).json({ error: 'Failed to update organization logo' });
      }
      res.json({ 
        logoUrl,
        message: 'Logo uploaded successfully' 
      });
      
    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ error: 'Failed to upload logo' });
    }
  });

  // Logo delete endpoint
  app.delete('/org/:slug/api/organization/logo', requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      
      // Update organization to remove logo URL
      const updatedOrg = await storage.updateCompany(organizationId, { logoUrl: null });
      
      if (!updatedOrg) {
        return res.status(500).json({ error: 'Failed to remove organization logo' });
      }
      
      res.json({ 
        message: 'Logo removed successfully' 
      });
      
    } catch (error) {
      console.error('Error removing logo:', error);
      res.status(500).json({ error: 'Failed to remove logo' });
    }
  });

  // Organization settings endpoints
  app.get('/org/:slug/api/settings', requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const settings = await storage.getSettings(organizationId);
      res.json(settings || {});
    } catch (error) {
      console.error('Error fetching organization settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/org/:slug/api/settings', requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const updatedSettings = await storage.updateSettings(organizationId, req.body);
      res.json(updatedSettings);
    } catch (error) {
      console.error('Error updating organization settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Integration settings endpoints
  app.get('/org/:slug/api/settings/integrations', requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const integrationSettings = await storage.getIntegrationSettings(organizationId);
      res.json(integrationSettings || {
        webhookUrl: '',
        apiKey: '',
        swipeSimpleTax: 'TRUE',
        swipeSimpleTrackInventory: 'TRUE'
      });
    } catch (error) {
      console.error('Error fetching integration settings:', error);
      // Return defaults if table doesn't exist
      res.json({
        webhookUrl: '',
        apiKey: '',
        swipeSimpleTax: 'TRUE',
        swipeSimpleTrackInventory: 'TRUE'
      });
    }
  });

  app.put('/org/:slug/api/settings/integrations', requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const updatedSettings = await storage.updateIntegrationSettings(organizationId, req.body);
      res.json(updatedSettings);
    } catch (error) {
      console.error('Error updating integration settings:', error);
      // If table doesn't exist, return the submitted data as if it was saved
      res.json({
        ...req.body,
        id: 0,
        companyId: organizationId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  });

  // Placeholder image endpoint
  app.get("/api/placeholder/:width/:height", (req, res) => {
    const { width, height } = req.params;
    const svgPlaceholder = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" text-anchor="middle" dy="0.3em" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af">
          ${width}x${height}
        </text>
      </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svgPlaceholder);
  });

  // Organization-aware product search
  // Get filter options for products
  app.get("/org/:slug/api/products/filter-options", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const products = await storage.getAllProducts();
      
      // Extract unique values for filters
      const caliberSet = new Set(products.filter(p => p.caliber).map(p => p.caliber));
      const calibers = Array.from(caliberSet).sort();
      
      // Get categories from company-specific categories table instead of product data
      const companyCategories = await storage.getCategoriesByCompany(organizationId);
      const categories = companyCategories
        .filter(cat => cat.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(cat => cat.displayName);
      
      const brandSet = new Set(products.filter(p => p.brand).map(p => p.brand));
      const brands = Array.from(brandSet).sort();
      
      // Condition filter only applies to marketplace results (GunBroker, etc.)
      // Master products database doesn't store condition - it's item-specific
      const conditions: string[] = [];
      
      res.json({
        calibers,
        categories,
        brands,
        conditions
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch filter options" });
    }
  });

  app.get("/org/:slug/api/products/search", requireOrganizationAccess, async (req, res) => {
    try {
      const { query, type = 'name', caliber, category, condition, brand, page = '1', limit = '100' } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      const organizationId = (req as any).organizationId;
      let searchType = type as 'upc' | 'name' | 'partNumber' | 'manufacturerPartNumber' | 'sku';
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 100;
      
      // Handle frontend sending 'part' instead of 'partNumber'
      if (searchType === 'part' as any) {
        searchType = 'partNumber';
      }
      
      // Get organization's retail vertical for scoped search
      const organization = await storage.getCompany(organizationId);
      const retailVerticalId = organization?.retailVerticalId || undefined;
      
      // Search implementation with count (Phase 1: retail vertical scoping)
      let searchResult;
      
      try {
        searchResult = await storage.searchProductsWithCount(query, searchType, pageNum, limitNum, retailVerticalId);
      } catch (error) {
        console.error('Storage search error:', error);
        // Fallback to direct database query with retail vertical scoping
        const { db } = await import('./db');
        const { products: productsTable } = await import('../shared/schema');
        const { ilike, sql, and, eq, or, isNull } = await import('drizzle-orm');
        
        let baseCondition;
        switch (searchType) {
          case 'name':
            baseCondition = and(
              ilike(productsTable.name, `%${query}%`),
              or(eq(productsTable.status, 'active'), isNull(productsTable.status))
            );
            break;
          case 'upc':
            baseCondition = and(
              ilike(productsTable.upc, `%${query}%`),
              or(eq(productsTable.status, 'active'), isNull(productsTable.status))
            );
            break;
          case 'partNumber':
            baseCondition = and(
              ilike(productsTable.manufacturerPartNumber, `%${query}%`),
              or(eq(productsTable.status, 'active'), isNull(productsTable.status))
            );
            break;
          case 'manufacturerPartNumber':
            baseCondition = and(
              ilike(productsTable.manufacturerPartNumber, `%${query}%`),
              or(eq(productsTable.status, 'active'), isNull(productsTable.status))
            );
            break;
          default:
            baseCondition = and(
              ilike(productsTable.name, `%${query}%`),
              or(eq(productsTable.status, 'active'), isNull(productsTable.status))
            );
        }
        
        // Add retail vertical scoping if specified (Phase 1: vertical-scoped search)
        const finalCondition = retailVerticalId 
          ? and(baseCondition, eq(productsTable.retailVerticalId, retailVerticalId))
          : baseCondition;
        
        // Get count
        const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(finalCondition);
        const totalCount = countResult.count;
        const totalPages = Math.ceil(totalCount / limitNum);
        const offset = (pageNum - 1) * limitNum;
        
        // Get paginated results
        const products = await db.select().from(productsTable).where(finalCondition).limit(limitNum).offset(offset);
        
        searchResult = { products, totalCount, currentPage: pageNum, totalPages };
      }
      
      let { products } = searchResult;

      
      // Apply filters if provided (excluding 'all' values)
      if (caliber && typeof caliber === 'string' && caliber !== 'all') {
        products = products.filter(p => p.caliber?.toLowerCase().includes(caliber.toLowerCase()));
      }
      if (category && typeof category === 'string' && category !== 'all') {
        products = products.filter(p => p.category?.toLowerCase().includes(category.toLowerCase()));
      }
      if (brand && typeof brand === 'string' && brand !== 'all') {
        products = products.filter(p => p.brand?.toLowerCase().includes(brand.toLowerCase()));
      }
      // Note: condition filter applies to marketplace results (GunBroker, etc.)
      // Since we don't store condition in master products database,
      // this filter is informational for frontend but doesn't affect master product results
      
      // Optimize: Get vendors once for all products to avoid N+1 queries
      const vendors = await storage.getVendorsByCompany(organizationId);
      
      // Get all vendor products for these products in bulk
      const productIds = products.map(p => p.id);
      const allVendorProducts = await storage.getVendorProductsByProductIds(productIds);
      
      // Enrich products with vendor SKU information (vendor SKUs used for search but not displayed)
      const enrichedProducts = products.map((product) => {
        const vendorProducts = allVendorProducts.filter(vp => vp.productId === product.id);
        
        // Get vendor SKUs from all vendors for this product (for search functionality)
        const vendorSkus = vendorProducts.map(vp => {
          const vendor = vendors.find(v => v.id === vp.vendorId);
          return {
            vendorName: vendor?.name || null,
            sku: vp.vendorSku
          };
        });
        
        return {
          ...product,
          vendorSkus // Included for search but not displayed in UI
        };
      });
      
      // Save search to history (async, don't wait for completion) - Save ALL searches
      try {
        const firstProduct = products.length > 0 ? products[0] : null;
        await storage.createSearchHistory({
          companyId: organizationId,
          userId: (req as any).user.id,
          searchQuery: query,
          searchType: searchType,
          productName: firstProduct?.name || null,
          productUpc: firstProduct?.upc || null,
          productPartNumber: firstProduct?.manufacturerPartNumber || null
        });
      } catch (historyError) {
        console.error('Failed to save search history:', historyError);
      }
      
      res.json({
        products: enrichedProducts,
        totalCount: searchResult.totalCount,
        currentPage: searchResult.currentPage,
        totalPages: searchResult.totalPages,
        hasNextPage: searchResult.currentPage < searchResult.totalPages,
        hasPrevPage: searchResult.currentPage > 1
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Get recent search history for current user
  app.get("/org/:slug/api/search-history", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const userId = (req as any).user.id;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const searchHistory = await storage.getRecentSearchHistory(organizationId, userId, limit);
      
      res.json(searchHistory);
    } catch (error) {
      console.error('Failed to fetch search history:', error);
      res.status(500).json({ message: "Failed to fetch search history" });
    }
  });

  // Get vendor comparison for a product - now returns list of available vendors
  app.get("/org/:slug/api/products/:id/vendors", requireOrganizationAccess, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
          const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const organizationId = (req as any).organizationId;
      const vendors = await storage.getVendorsByCompany(organizationId);
      
      // Get all supported vendors for logo lookup and handler resolution
      const supportedVendors = await storage.getAllSupportedVendors();

      // Include ALL vendors that are enabled for price comparison, regardless of credentials
      const availableVendors = vendors.filter(vendor => {
        // Check if vendor is enabled for price comparison (null/undefined defaults to true)
        if (!isVendorEnabledForPriceComparison(vendor)) {
          console.log(`PRICE COMPARISON: Filtering out disabled vendor: ${vendor.name}`);
          return false;
        }
        
        // Do NOT block any supported vendor here; presence in the grid is controlled by the toggle only
        return true;
      });

      const vendorList = availableVendors.map(vendor => {
        // ✅ USE SLUG-BASED HANDLER LOOKUP: More reliable than name matching
        const supportedVendor = supportedVendors.find(sv => sv.id === vendor.supportedVendorId);
        const handler = supportedVendor 
          ? vendorRegistry.getHandlerBySlug(supportedVendor.vendorSlug) // Use vendorSlug (immutable) not vendorShortCode (user-editable)
          : vendorRegistry.getHandlerByVendorName(vendor.name); // Fallback
        
        const supportsOrdering = getSupportsOrdering(handler as any);
        return {
          id: vendor.id,
          name: vendor.name,
          vendorSlug: vendor.vendorSlug, // ✅ CRITICAL: Use vendorSlug for routing and handler lookups
          vendorShortCode: vendor.vendorShortCode, // Include short code for display
          logoUrl: supportedVendor?.logoUrl || null,
          electronicOrders: supportsOrdering,
          handlerAvailable: !!handler
        };
      });

      // FIXED: Ensure imageUrl field mapping works correctly
      const productWithImageUrl = {
        ...product,
        // Explicitly ensure imageUrl field is available (Drizzle should map image_url → imageUrl)
        imageUrl: product.imageUrl || product.image_url || null
      };
      

      res.json({
        product: productWithImageUrl,
        vendors: vendorList
      });
    } catch (error: any) {
      console.error('Failed to fetch vendor list:', error);
      res.status(500).json({ message: "Failed to fetch vendor list" });
    }
  });


  // Individual vendor API endpoints
  app.get("/org/:slug/api/products/:id/vendors/:vendorSlug/price", requireOrganizationAccess, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const vendorSlug = req.params.vendorSlug;
      const organizationId = (req as any).organizationId;
      
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const vendor = await storage.getVendorBySlug(vendorSlug, organizationId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }

      // Check if vendor is enabled for price comparison (null/undefined defaults to true)
      if (!isVendorEnabledForPriceComparison(vendor)) {
        console.log(`PRICE COMPARISON: Individual vendor request for disabled vendor: ${vendor.name}`);
        return res.status(403).json({ 
          message: "Vendor is disabled for price comparison searches",
          vendor: { id: vendor.id, name: vendor.name, vendorShortCode: vendor.vendorShortCode }
        });
      }

      // Get supported vendors for handler lookup
      const supportedVendors = await storage.getAllSupportedVendors();

      // ✅ SLUG-BASED HANDLER LOOKUP: Use vendor slug for reliable handler lookup
      const supportedVendor = supportedVendors.find(sv => sv.id === vendor.supportedVendorId);
      const handler = supportedVendor 
        ? vendorRegistry.getHandlerBySlug(supportedVendor.vendorSlug) // Use vendorSlug (immutable) not vendorShortCode (user-editable)
        : vendorRegistry.getHandlerByVendorName(vendor.name); // Fallback
        
      if (!handler) {
        console.log(`❌ HANDLER LOOKUP FAILED: vendor.name="${vendor.name}", supportedVendor.vendorSlug="${supportedVendor?.vendorSlug}"`);
        return res.json({
          vendor: { id: vendor.id, name: vendor.name, vendorShortCode: vendor.vendorShortCode },
          sku: null,
          cost: null,
          stock: 0,
          availability: 'handler_missing',
          apiMessage: 'No API handler available for this vendor'
        });
      }

      // supportedVendor already found above for handler lookup

      console.log('SINGLE VENDOR API: Processing', vendor.name, 'for UPC', product.upc);

      // Get company pricing configuration
      const pricingConfig = await storage.getDefaultPricingConfiguration(organizationId);
      
      if (handler.vendorId === 'chattanooga') {
        const startTime = Date.now();
        
        // Use NEW credential vault system for Chattanooga
        const { credentialVault } = await import('./credential-vault-service');
        const credentials = await credentialVault.getStoreCredentials('chattanooga', organizationId, 0);
        
        if (!credentials || !credentials.sid || !credentials.token) {
          console.log(`VENDOR_TIMING: ${vendor.name} completed in ${Date.now() - startTime}ms - CONFIG_REQUIRED`);
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null,
            cost: null,
            stock: 0,
            availability: 'config_required',
            apiMessage: 'Chattanooga API credentials required (SID and Token)'
          });
        }

        const chattanoogaAPI = new ChattanoogaAPI({ 
          accountNumber: '', 
          username: '', 
          password: '', 
          sid: credentials.sid, 
          token: credentials.token 
        });
        const result = await chattanoogaAPI.searchProduct({ upc: product.upc });

        console.log(`VENDOR_TIMING: ${vendor.name} completed in ${Date.now() - startTime}ms - ${result.success ? 'SUCCESS' : 'NOT_FOUND'}`);

        if (result.success && result.product) {
          const p = result.product;
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: p.sku || null,
            cost: p.price ? p.price.toString() : null,
            stock: p.stock || 0,
            availability: p.inStock ? 'in_stock' : 'out_of_stock',
            msrp: p.msrp ? p.msrp.toString() : null,
            map: p.mapPrice ? p.mapPrice.toString() : null,
            calculatedRetailPrice: null,
            margin: null,
            isRealTime: true,
            apiMessage: result.message
          });
        }

        return res.json({
          vendor: {
            id: vendor.id,
            name: vendor.name,
            vendorShortCode: vendor.vendorShortCode,
            logoUrl: supportedVendor?.logoUrl || null,
            electronicOrders: handler?.capabilities?.supportsOrdering || false
          },
          sku: null,
          cost: null,
          stock: 0,
          availability: 'not_available',
          msrp: null,
          map: null,
          calculatedRetailPrice: null,
          margin: null,
          isRealTime: true,
          apiMessage: 'Product not found'
        });
      } else if (handler.vendorId === 'lipseys') {
        const startTime = Date.now();
        
        const { LipseyAPI } = await import('./lipsey-api.js');
        
        // ✅ FIX: Use credential vault (with field aliases) instead of direct storage access
        const { credentialVault } = await import('./credential-vault-service');
        const credentials = await credentialVault.getStoreCredentials('lipseys', organizationId, 0);
        
        // Store-level credentials required - NO ENVIRONMENT VARIABLE FALLBACK
        if (!credentials || !credentials.email || !credentials.password) {
          console.log(`VENDOR_TIMING: ${vendor.name} completed in ${Date.now() - startTime}ms - CONFIG_REQUIRED`);
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null,
            cost: null,
            stock: 0,
            availability: 'config_required',
            apiMessage: 'Lipsey API credentials required (Email and Password)'
          });
        }
        
        const lipseyAPI = new LipseyAPI(credentials);
        // Optimized search: UPC only (no secondary searches for speed)
        let result = await lipseyAPI.searchProduct({ upc: product.upc });
        
        console.log(`VENDOR_TIMING: ${vendor.name} completed in ${Date.now() - startTime}ms - ${result.success ? 'SUCCESS' : 'NOT_FOUND'}`);
        
        if (result.success && result.product) {
          const lipseyProduct = result.product;
          
          // NO PRICING CALCULATIONS - Raw vendor data only
          
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: lipseyProduct.sku || null,
            cost: lipseyProduct.price ? lipseyProduct.price.toString() : null,
            stock: lipseyProduct.stock || 0,
            availability: lipseyProduct.stock > 0 ? 'in_stock' : 'out_of_stock',
            msrp: lipseyProduct.msrp ? lipseyProduct.msrp.toString() : null,
            map: lipseyProduct.retailMap ? lipseyProduct.retailMap.toString() : null,
            calculatedRetailPrice: null, // NO calculations in vendor comparison
            margin: null, // NO calculations in vendor comparison
            isRealTime: true,
            apiMessage: `${result.message}${lipseyProduct.canDropship ? ' - Drop Ship Available' : ''}`
          });
        } else {
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null,
            cost: null,
            stock: 0,
            availability: 'not_available',
            isRealTime: true,
            apiMessage: result.message || 'Product not found at Lipsey\'s'
          });
        }
      } else if (handler.vendorId === 'gunbroker') {
        const startTime = Date.now();
        
        const { GunBrokerAPI } = await import('./gunbroker-api.js');
        
        // GunBroker is a marketplace - check store toggle first
        if (!isVendorEnabledForPriceComparison(vendor)) {
          console.log(`VENDOR_TIMING: ${vendor.name} completed in ${Date.now() - startTime}ms - DISABLED`);
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null,
            cost: null,
            stock: 0,
            availability: 'disabled',
            apiMessage: 'GunBroker disabled for this store'
          });
        }
        
        // Use admin credentials (not store credentials) - fetch via credential vault
        const { credentialVault } = await import('./credential-vault-service');
        let adminCredentials = await credentialVault.getAdminCredentials('gunbroker', (req as any)?.user?.id || 0);
        // Fallback to stored supportedVendor credentials if vault retrieval fails
        if (!adminCredentials) {
          adminCredentials = supportedVendor?.adminCredentials as any;
        }
        if (!adminCredentials || !adminCredentials.devKey) {
          console.log(`VENDOR_TIMING: ${vendor.name} completed in ${Date.now() - startTime}ms - CONFIG_REQUIRED`);
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null,
            cost: null,
            stock: 0,
            availability: 'config_required',
            apiMessage: 'GunBroker admin credentials not configured. Please configure in Admin > Supported Vendors.'
          });
        }
        
        console.log('🔫 GUNBROKER MARKETPLACE: Using admin credentials for store:', vendor.name);
        const gunBrokerAPI = new GunBrokerAPI(adminCredentials);
        const result = await gunBrokerAPI.searchProduct({ upc: product.upc }, adminCredentials.buyNowOnly !== false);
        
        console.log(`VENDOR_TIMING: ${vendor.name} completed in ${Date.now() - startTime}ms - ${result.success ? 'SUCCESS' : 'NOT_FOUND'}`);
        
        if (result.success && result.product) {
          const bestMatch = result.product;
          
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: bestMatch.id?.toString() || null,
            cost: bestMatch.price ? bestMatch.price.toString() : null,
            stock: bestMatch.quantity || 1,
            availability: bestMatch.quantity > 0 ? 'in_stock' : 'limited',
            msrp: null,  // CRITICAL: GunBroker is marketplace-only, no MSRP data available
            map: null,   // CRITICAL: GunBroker is marketplace-only, no MAP data available
            calculatedRetailPrice: null,
            margin: null,
            isRealTime: true,
            apiMessage: result.message
          });
        } else {
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null,
            cost: null,
            stock: 0,
            availability: 'not_available',
            msrp: null,  // CRITICAL: Explicitly set to null to prevent frontend from showing cached fabricated data
            map: null,   // CRITICAL: Explicitly set to null to prevent frontend from showing cached fabricated data
            calculatedRetailPrice: null,
            margin: null,
            isRealTime: true,
            apiMessage: result.message || 'Product not found on GunBroker'
          });
        }
      } else if (handler.vendorId === 'sports-south') {
        // Use credential vault for Sports South credentials
        const { credentialVault } = await import('./credential-vault-service');
        const credentials = await credentialVault.getStoreCredentials('sports-south', organizationId, 0);
        
        if (!credentials || !credentials.userName || !credentials.password || !credentials.source || !credentials.customerNumber) {
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null,
            cost: null,
            stock: 0,
            availability: 'config_required',
            isRealTime: true,
            apiMessage: 'Sports South credentials required (userName, password, source, customerNumber)'
          });
        }

        const sportsSouthAPI = new SportsSouthAPI({ 
          userName: credentials.userName, 
          password: credentials.password, 
          source: credentials.source, 
          customerNumber: credentials.customerNumber 
        });
        const itemNo = product.upc; // Use UPC directly for lookup
        // Preflight auth probe using the same method as Test Connection
        const preflight = await sportsSouthAPI.testConnection();
        if (!preflight.success) {
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null,
            cost: null,
            stock: 0,
            availability: 'config_required',
            isRealTime: true,
            apiMessage: `Sports South authentication failed: ${preflight.message}`
          });
        }
        try {
          const itemResult = await sportsSouthAPI.getInventoryForItem(itemNo, product.upc);
          if (itemResult && (itemResult as any).QTYOH !== undefined) {
            return res.json({
              vendor: {
                id: vendor.id,
                name: vendor.name,
                vendorShortCode: vendor.vendorShortCode,
                logoUrl: supportedVendor?.logoUrl || null,
                electronicOrders: handler?.capabilities?.supportsOrdering || false
              },
              sku: (itemResult as any).ITEMNO || null,
              cost: (itemResult as any).CPRC ? (itemResult as any).CPRC.toString() : null,
              stock: (itemResult as any).QTYOH || 0,
              availability: (itemResult as any).QTYOH > 0 ? 'in_stock' : 'out_of_stock',
              msrp: null,
              map: (itemResult as any).MFPRC ? (itemResult as any).MFPRC.toString() : null,
              calculatedRetailPrice: null,
              margin: null,
              isRealTime: true,
              apiMessage: `Sports South inventory found: ${(itemResult as any).ITEMNO} - Stock: ${(itemResult as any).QTYOH}`
            });
          }
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null,
            cost: null,
            stock: 0,
            availability: 'not_available',
            isRealTime: true,
            apiMessage: 'Sports South: Item not found or not available'
          });
        } catch (apiError: any) {
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null, // Don't show UPC as SKU when item not found
            cost: null,
            stock: 0,
            availability: 'not_available',
            isRealTime: true,
            apiMessage: `Sports South API error for item ${itemNo}: ${apiError.message}`
          });
        }
      } else if (handler.vendorId === 'bill-hicks') {
        const { BillHicksAPI } = await import('./bill-hicks-api');
        
        const billHicksAPI = new BillHicksAPI();
        const result = await billHicksAPI.getProductPricing(product.upc, organizationId);
        
        if (result) {
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: result.vendorSku || null,
            cost: result.vendorCost ? result.vendorCost.toString() : null,
            stock: result.quantityAvailable || 0,
            availability: result.quantityAvailable > 0 ? 'in_stock' : 'out_of_stock',
            msrp: result.msrpPrice ? result.msrpPrice.toString() : null,
            map: result.mapPrice ? result.mapPrice.toString() : null,
            calculatedRetailPrice: null, // NO CALCULATED VALUES
            margin: null, // NO CALCULATED VALUES - Only actual vendor data allowed
            isRealTime: false, // Uses pre-imported data, updated daily
            apiMessage: `Bill Hicks data from ${result.lastUpdated.toLocaleDateString()} - Updated daily via FTP`
          });
        } else {
          return res.json({
            vendor: {
              id: vendor.id,
              name: vendor.name,
              vendorShortCode: vendor.vendorShortCode,
              logoUrl: supportedVendor?.logoUrl || null,
              electronicOrders: handler?.capabilities?.supportsOrdering || false
            },
            sku: null,
            cost: null,
            stock: 0,
            availability: 'not_available',
            isRealTime: false,
            apiMessage: 'Product not found in Bill Hicks catalog for this organization. Check if Bill Hicks catalog sync is enabled.'
          });
        }
      }

      // Default response for unsupported vendor types
      return res.json({
        vendor: {
          id: vendor.id,
          name: vendor.name,
          logoUrl: supportedVendor?.logoUrl || null,
          electronicOrders: handler?.capabilities?.supportsOrdering || false
        },
        sku: null,
        cost: null,
        stock: 0,
        availability: 'unsupported',
        apiMessage: 'Vendor API not yet implemented'
      });

    } catch (error: any) {
      console.error('Failed to fetch vendor price:', error);
      res.status(500).json({ message: "Failed to fetch vendor price", error: error.message });
    }
  });

  // Get organization-specific vendors (for store settings)
  app.get("/org/:slug/api/supported-vendors", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      
      // Get company to check retail vertical
      const company = await storage.getCompany(organizationId);
      const companyRetailVerticalId = company?.retailVerticalId;
      console.log('SUPPORTED VENDORS: Company retail vertical ID:', companyRetailVerticalId);
      
      // Get organization-specific vendors with their credentials
      let organizationVendors = await storage.getVendorsByCompany(organizationId);
      console.log('SUPPORTED VENDORS: organizationVendors:', organizationVendors.map(v => ({ id: v.id, name: v.name, supportedVendorId: v.supportedVendorId })));
      
      // If no vendors exist for this organization, create them from supported vendors (filtered by retail vertical)
      if (organizationVendors.length === 0) {
        console.log('SUPPORTED VENDORS: No vendors found for organization, creating from supported vendors...');
        await storage.createVendorsFromSupported(organizationId, companyRetailVerticalId || undefined);
        organizationVendors = await storage.getVendorsByCompany(organizationId);
        console.log('SUPPORTED VENDORS: Created vendors:', organizationVendors.map(v => ({ id: v.id, name: v.name, supportedVendorId: v.supportedVendorId })));
      }
      
      // Get admin-level supported vendors for reference (filtered by retail vertical if set)
      const allSupportedVendors = await storage.getAllSupportedVendors();
      const supportedVendors = companyRetailVerticalId 
        ? allSupportedVendors.filter(sv => 
            sv.retailVerticals && sv.retailVerticals.some(rv => rv.id === companyRetailVerticalId)
          )
        : allSupportedVendors;
      
      console.log('SUPPORTED VENDORS: Filtered supported vendors count:', supportedVendors.length);
      if (companyRetailVerticalId) {
        console.log('SUPPORTED VENDORS: Filtering by retail vertical ID:', companyRetailVerticalId);
      }
      
      // Get Bill Hicks vendor IDs (both old and new)
      let billHicksVendorId = 5; // Default to legacy ID
      try {
        billHicksVendorId = await storage.getBillHicksVendorId();
        console.log('SUPPORTED VENDORS: billHicksVendorId (new):', billHicksVendorId);
      } catch (error) {
        console.error('SUPPORTED VENDORS: Error getting Bill Hicks vendor ID:', error);
        console.log('SUPPORTED VENDORS: Using legacy Bill Hicks vendor ID: 5');
        billHicksVendorId = 5;
      }
      const oldBillHicksVendorId = 5; // Legacy Bill Hicks vendor ID
      console.log('SUPPORTED VENDORS: oldBillHicksVendorId:', oldBillHicksVendorId);
      
      // Find Bill Hicks vendor (check both old and new IDs)
      const billHicksVendor = organizationVendors.find(v => 
        v.supportedVendorId === billHicksVendorId || v.supportedVendorId === oldBillHicksVendorId
      );
      console.log('SUPPORTED VENDORS: billHicksVendor found:', !!billHicksVendor);
      let billHicksCredentials = null;
      
      if (billHicksVendor) {
        try {
          console.log('BILL HICKS CREDENTIALS: Fetching for organization', organizationId);
          // Try new vendor ID first, then fallback to old vendor ID
          billHicksCredentials = await storage.getCompanyVendorCredentials(organizationId, billHicksVendorId);
          if (!billHicksCredentials) {
            console.log('BILL HICKS CREDENTIALS: Trying old vendor ID');
            billHicksCredentials = await storage.getCompanyVendorCredentials(organizationId, oldBillHicksVendorId);
          }
          console.log('BILL HICKS CREDENTIALS: Found credentials:', !!billHicksCredentials);
          if (billHicksCredentials) {
            console.log('BILL HICKS CREDENTIALS: Server:', billHicksCredentials.ftpServer);
            console.log('BILL HICKS CREDENTIALS: Username:', billHicksCredentials.ftpUsername);
            console.log('BILL HICKS CREDENTIALS: Full credentials object:', JSON.stringify(billHicksCredentials, null, 2));
          } else {
            console.log('BILL HICKS CREDENTIALS: No credentials found for either vendor ID');
          }
        } catch (error) {
          console.error('Error fetching Bill Hicks credentials:', error);
        }
      } else {
        console.log('SUPPORTED VENDORS: No Bill Hicks vendor found in organizationVendors');
      }

      // Filter organization vendors by retail vertical (only show vendors that match)
      const filteredOrganizationVendors = companyRetailVerticalId
        ? organizationVendors.filter(orgVendor => {
            const supportedVendor = allSupportedVendors.find(sv => sv.id === orgVendor.supportedVendorId);
            return supportedVendor?.retailVerticals && supportedVendor.retailVerticals.some(rv => rv.id === companyRetailVerticalId);
          })
        : organizationVendors;
      
      console.log('SUPPORTED VENDORS: Filtered organization vendors count:', filteredOrganizationVendors.length);
      
      // Create a comprehensive view combining both
      const vendorsWithMetadata = await Promise.all(filteredOrganizationVendors.map(async (orgVendor) => {
        const supportedVendor = supportedVendors.find(sv => sv.id === orgVendor.supportedVendorId);
        
        // Get credentials from company_vendor_credentials table for all vendors
        let vendorCredentials = orgVendor.credentials;
        console.log(`SUPPORTED VENDORS: Processing vendor ${orgVendor.name} (ID: ${orgVendor.id}, supportedVendorId: ${orgVendor.supportedVendorId})`);
        
        // Try to get credentials from company_vendor_credentials table
        try {
          const companyCredentials = await storage.getCompanyVendorCredentials(organizationId, orgVendor.supportedVendorId);
          if (companyCredentials) {
            console.log(`SUPPORTED VENDORS: Found company credentials for ${orgVendor.name}`);
            vendorCredentials = companyCredentials;
          } else {
            console.log(`SUPPORTED VENDORS: No company credentials found for ${orgVendor.name}, using original credentials`);
          }
        } catch (error) {
          console.log(`SUPPORTED VENDORS: Error fetching company credentials for ${orgVendor.name}:`, error.message);
        }
        
        if (orgVendor.supportedVendorId === billHicksVendorId || orgVendor.supportedVendorId === oldBillHicksVendorId) {
          console.log('SUPPORTED VENDORS: This is a Bill Hicks vendor, checking credentials...');
          console.log('SUPPORTED VENDORS: billHicksCredentials exists:', !!billHicksCredentials);
          
          if (billHicksCredentials) {
            console.log('BILL HICKS CREDENTIALS: Creating vendor credentials object');
            console.log('BILL HICKS CREDENTIALS: Raw ftpBasePath from DB:', billHicksCredentials.ftpBasePath, '(type:', typeof billHicksCredentials.ftpBasePath, ')');
            console.log('BILL HICKS CREDENTIALS: Raw ftp_base_path from DB:', billHicksCredentials.ftp_base_path);
            vendorCredentials = {
              ftpHost: billHicksCredentials.ftpServer,
              ftpUsername: billHicksCredentials.ftpUsername,
              ftpPassword: billHicksCredentials.ftpPassword, // Include password for B2B automation
              ftpPort: billHicksCredentials.ftpPort?.toString() || '21',
              ftpBasePath: billHicksCredentials.ftpBasePath !== undefined ? billHicksCredentials.ftpBasePath : (billHicksCredentials.ftp_base_path || ''),
              enablePriceComparison: billHicksCredentials.catalogSyncEnabled || false,
              enableAutomaticSync: billHicksCredentials.inventorySyncEnabled || false,
              lastCatalogSync: billHicksCredentials.lastCatalogSync,
              catalogSyncStatus: billHicksCredentials.catalogSyncStatus,
              catalogSyncSchedule: billHicksCredentials.catalogSyncSchedule,
              // Sync statistics for Last Sync section
              lastCatalogRecordsCreated: billHicksCredentials.lastCatalogRecordsCreated || 0,
              lastCatalogRecordsUpdated: billHicksCredentials.lastCatalogRecordsUpdated || 0,
              lastCatalogRecordsSkipped: billHicksCredentials.lastCatalogRecordsSkipped || 0,
              lastCatalogRecordsFailed: billHicksCredentials.lastCatalogRecordsFailed || 0,
              lastCatalogRecordsProcessed: billHicksCredentials.lastCatalogRecordsProcessed || 0,
              catalogSyncError: billHicksCredentials.catalogSyncError || null,
            };
            console.log('BILL HICKS CREDENTIALS: Final vendor credentials:', JSON.stringify(vendorCredentials, null, 2));
          } else {
            console.log('BILL HICKS CREDENTIALS: No credentials found for Bill Hicks vendor');
            // Keep the existing credentials structure but mark as not configured
            vendorCredentials = {
              configured: false,
              dataSource: "ftp_import"
            };
          }
        } else {
          console.log('SUPPORTED VENDORS: Not a Bill Hicks vendor, using company credentials if available');
          // For non-Bill Hicks vendors, use the company credentials directly
          if (vendorCredentials && Object.keys(vendorCredentials).length > 0) {
            console.log(`SUPPORTED VENDORS: Using company credentials for ${orgVendor.name}`);
          } else {
            console.log(`SUPPORTED VENDORS: No company credentials for ${orgVendor.name}, using original credentials`);
          }
        }
        
        // Add minimal, non-sensitive credential metadata for specific vendors
        try {
          const supportedName = (supportedVendor?.name || '').toLowerCase();
          if (supportedName.includes('gunbroker')) {
            // GunBroker uses admin credentials - check admin level
            const adminCredentials = supportedVendor?.adminCredentials as any;
            if (adminCredentials?.devKey) {
              const fullKey = adminCredentials.devKey as string;
              const devKeyLast4 = fullKey && typeof fullKey === 'string' && fullKey.length >= 4
                ? fullKey.slice(-4)
                : undefined;
              vendorCredentials = { 
                usesAdminCredentials: true,
                devKeyLast4,
                environment: adminCredentials.environment || 'sandbox',
                buyNowOnly: adminCredentials.buyNowOnly !== false
              };
            } else {
              vendorCredentials = { 
                usesAdminCredentials: true,
                configured: false 
              };
            }
          }
        } catch (metaErr) {
          console.warn('SUPPORTED VENDORS: Failed to compute credential metadata:', (metaErr as any)?.message);
        }

        const hasCredentials = !!(vendorCredentials && Object.keys(vendorCredentials).length > 0);
        
        // Debug logging for Sports South
        if (orgVendor.name.toLowerCase().includes('sports south')) {
          console.log('🔍 SPORTS SOUTH DEBUG:');
          console.log('  Vendor name:', orgVendor.name);
          console.log('  vendorCredentials keys:', Object.keys(vendorCredentials || {}));
          console.log('  hasCredentials:', hasCredentials);
          console.log('  vendorCredentials type:', typeof vendorCredentials);
          console.log('  vendorCredentials null check:', vendorCredentials === null);
          console.log('  vendorCredentials undefined check:', vendorCredentials === undefined);
        }
        
        return {
          id: orgVendor.id,
          name: orgVendor.name,
          slug: orgVendor.slug, // Include slug for API routing
          // Always use admin-level short code if available; fallback to org-level
          vendorShortCode: supportedVendor?.vendorShortCode || orgVendor.vendorShortCode,
          status: orgVendor.status,
          credentials: vendorCredentials,
          hasCredentials: hasCredentials,
          logoUrl: orgVendor.logoUrl || supportedVendor?.logoUrl,
          integrationType: orgVendor.integrationType,
          supportedVendorId: orgVendor.supportedVendorId,
          lastSyncDate: orgVendor.lastSyncDate,
          syncStatus: orgVendor.syncStatus,
          // Add credential field configuration from supported vendor
          credentialFields: supportedVendor?.credentialFields || [],
          isEnabled: supportedVendor?.isEnabled !== false,
          enabledForPriceComparison: orgVendor.enabledForPriceComparison !== false // Default to true if not set
        };
      }));
      
      res.json(vendorsWithMetadata);
    } catch (error: any) {
      console.error('Failed to fetch organization vendors:', error);
      res.status(500).json({ message: "Failed to fetch organization vendors" });
    }
  });

  // DEPRECATED: Test credentials without saving them - Use new credential management system instead  
  // REMOVED: Legacy test-credentials endpoint - use unified credential management system instead

  // REMOVED: Legacy credentials-save endpoint - use unified credential management system instead

  // Update vendor (store-level) metadata like vendorShortCode or name
  app.patch("/org/:slug/api/vendors/:id", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const vendorId = parseInt(req.params.id);
      const { vendorShortCode, name } = req.body || {};
      if (isNaN(vendorId)) {
        return res.status(400).json({ success: false, message: 'Invalid vendor ID' });
      }

      const vendor = await storage.getVendor(vendorId);
      if (!vendor) {
        return res.status(404).json({ success: false, message: 'Vendor not found' });
      }
      if (vendor.companyId !== organizationId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const updates: any = {};
      if (typeof vendorShortCode === 'string') updates.vendorShortCode = vendorShortCode;
      if (typeof name === 'string') updates.name = name;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No valid fields to update' });
      }

      const updated = await storage.updateVendor(vendorId, updates);
      return res.json({ success: true, vendor: updated });
    } catch (error: any) {
      console.error('Update vendor error:', error);
      res.status(500).json({ success: false, message: `Failed to update vendor: ${error.message}` });
    }
  });

  // Bill Hicks store-specific pricing sync endpoint
  // This pulls pricing/availability from the store's FTP folder for vendor price comparison
  app.post('/org/:slug/api/vendor-credentials/bill-hicks/sync', requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      console.log(`🔄 BILL HICKS STORE SYNC: Request body:`, req.body);
      const forceFull = req.body?.forceFull === true;
      console.log(`🔄 BILL HICKS STORE SYNC: Starting store-specific pricing sync for organization ${organizationId} (forceFull: ${forceFull}, raw: ${req.body?.forceFull})`);
      
      // ✅ PRE-VALIDATION: Check if credentials are configured before attempting sync
      const billHicksVendorId = await storage.getBillHicksVendorId();
      if (!billHicksVendorId) {
        return res.status(400).json({
          success: false,
          message: 'Bill Hicks vendor not found in system. Please contact support.'
        });
      }
      
      const existingCredentials = await storage.getCompanyVendorCredentials(organizationId, billHicksVendorId);
      if (!existingCredentials || !existingCredentials.ftpServer || !existingCredentials.ftpUsername || !existingCredentials.ftpPassword) {
        return res.status(400).json({
          success: false,
          message: 'Bill Hicks FTP credentials not configured. Please configure credentials before running sync.'
        });
      }
      
      // Trigger store-specific pricing sync (uses store's FTP credentials and folder)
      const { syncStoreSpecificBillHicksPricing } = await import('./bill-hicks-store-pricing-sync');
      const result = await syncStoreSpecificBillHicksPricing(organizationId, forceFull);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message || 'Bill Hicks store pricing sync completed successfully',
          stats: result.stats
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message || result.error || 'Failed to sync store pricing'
        });
      }
      
    } catch (error: any) {
      console.error('Bill Hicks store pricing sync error:', error);
      // Ensure we ALWAYS send a response and don't crash
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: `Failed to sync store pricing: ${error.message || 'Unknown error'}`
        });
      }
    }
  });

  // Webhook testing endpoint
  app.post('/org/:slug/api/webhooks/test', requireOrganizationAccess, async (req, res) => {
    try {
      const { url, secret } = req.body;
      
      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'Webhook URL is required'
        });
      }
      
      const result = await WebhookService.testWebhookEndpoint(url, secret);
      res.json(result);
      
    } catch (error) {
      console.error('Webhook test error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test webhook endpoint'
      });
    }
  });

  // Webhook configuration endpoint
  app.get('/org/:slug/api/webhooks/config', requireOrganizationAccess, async (req, res) => {
    try {
      const webhookUrl = process.env.MICROBIZ_WEBHOOK_URL;
      const hasSecret = !!process.env.MICROBIZ_WEBHOOK_SECRET;
      
      res.json({
        configured: !!webhookUrl,
        url: webhookUrl || null,
        hasSecret,
        events: ['order_submitted']
      });
      
    } catch (error) {
      console.error('Webhook config error:', error);
      res.status(500).json({
        message: 'Failed to get webhook configuration'
      });
    }
  });

  // Consolidate duplicate order items
  app.post("/org/:slug/api/orders/:id/consolidate", requireOrganizationAccess, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const organizationId = (req as any).organizationId;

      const order = await storage.getOrder(orderId);
      if (!order || order.companyId !== organizationId) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Get all order items
      const orderItems = await storage.getOrderItemsByOrderId(orderId);
      if (!orderItems || orderItems.length === 0) {
        return res.status(400).json({ message: "No items to consolidate" });
      }

      // Group items by productId (duplicate detection)
      const itemsByProductId = new Map<number, typeof orderItems>();
      for (const item of orderItems) {
        const productId = item.productId;
        if (!itemsByProductId.has(productId)) {
          itemsByProductId.set(productId, []);
        }
        itemsByProductId.get(productId)!.push(item);
      }

      // Find duplicates and consolidate
      let consolidatedCount = 0;
      for (const [productId, items] of itemsByProductId.entries()) {
        if (items.length > 1) {
          // Keep the first item, combine quantities
          const primaryItem = items[0];
          const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
          
          // Update the primary item with combined quantity
          await storage.updateOrderItem(primaryItem.id, {
            quantity: totalQuantity
          });

          // Delete the duplicate items
          for (let i = 1; i < items.length; i++) {
            await storage.deleteOrderItem(items[i].id);
            consolidatedCount++;
          }
        }
      }

      if (consolidatedCount === 0) {
        return res.json({ 
          success: true, 
          message: "No duplicate items found to consolidate" 
        });
      }

      // Recalculate order totals
      const updatedItems = await storage.getOrderItemsByOrderId(orderId);
      if (updatedItems && updatedItems.length > 0) {
        const newTotalAmount = updatedItems.reduce((sum, item) => {
          const itemCost = parseFloat(item.unitCost.replace('$', ''));
          return sum + (itemCost * item.quantity);
        }, 0);
        
        const newItemCount = updatedItems.reduce((sum, item) => {
          return sum + item.quantity;
        }, 0);
        
        await storage.updateOrder(orderId, {
          totalAmount: newTotalAmount.toFixed(2),
          itemCount: newItemCount
        });
      }

      res.json({ 
        success: true, 
        message: `Consolidated ${consolidatedCount} duplicate item(s)` 
      });

    } catch (error) {
      console.error('Order consolidation error:', error);
      res.status(500).json({ message: "Failed to consolidate order items" });
    }
  });

  // Order submission endpoint - changes status to "open" and generates webhook
  app.post("/org/:slug/api/orders/:id/submit", requireOrganizationAccess, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const organizationId = (req as any).organizationId;

      // Check subscription limits for order processing (Enterprise-only feature)
      const { canUseOrderProcessing } = await import('./subscription-gates');
      const orderAccess = await canUseOrderProcessing(organizationId);
      if (!orderAccess.allowed) {
        return res.status(403).json({ 
          message: orderAccess.message,
          upgradeRequired: true,
          requiredPlan: 'enterprise'
        });
      }
      
      const order = await storage.getOrder(orderId);
      if (!order || order.companyId !== organizationId) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      if (order.status !== 'draft') {
        return res.status(400).json({ message: "Only draft orders can be submitted" });
      }
      
      // Update order status to "open"
      const updatedOrder = await storage.updateOrder(orderId, { status: 'open' });
      
      // Generate webhook for order submission
      try {
        // Get order items and related data for webhook
        const orderItems = await storage.getOrderItemsByOrderId(orderId);
        const vendor = await storage.getVendor(updatedOrder.vendorId);
        const company = await storage.getCompany(updatedOrder.companyId);
        const store = updatedOrder.storeId ? await storage.getStore(updatedOrder.storeId) : undefined;
        
        // Get admin-level supported vendor data for accurate name/shortCode
        const supportedVendor = vendor?.supportedVendorId 
          ? await storage.getSupportedVendor(vendor.supportedVendorId)
          : null;
        
        // Merge store vendor with admin vendor data (prefer admin-level name/shortCode)
        const vendorData = vendor && supportedVendor ? {
          ...vendor,
          name: supportedVendor.name, // Use admin-level full name
          vendorShortCode: supportedVendor.vendorShortCode // Use admin-level short code
        } : vendor;
        
        // Create proper webhook payload using WebhookServiceV2
        const webhookPayload = await WebhookServiceV2.generateOrderWebhook(
          updatedOrder,
          orderItems,
          store,
          company,
          vendorData,
          undefined, // user data not needed for this webhook
          'order.submitted'
        );
        await WebhookServiceV2.sendWebhook(webhookPayload, updatedOrder.companyId);
        console.log(`Webhook sent for order ${orderId} submission`);
      } catch (webhookError) {
        console.error(`Failed to send webhook for order ${orderId}:`, webhookError);
        // Don't fail the order submission if webhook fails
      }
      
      res.json({ 
        success: true, 
        message: "Order submitted successfully",
        order: updatedOrder
      });
      
    } catch (error) {
      console.error('Order submission error:', error);
      res.status(500).json({ message: "Failed to submit order" });
    }
  });

  // Webhook preview endpoint - uses the same comprehensive webhook generation as actual submissions
  app.get("/org/:slug/api/orders/:id/webhook-preview", requireOrganizationAccess, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const organizationId = (req as any).organizationId;
      
      const order = await storage.getOrder(orderId);
      if (!order || order.companyId !== organizationId) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Get all related data for comprehensive webhook - SAME AS ACTUAL SUBMISSION
      const orderItems = await storage.getOrderItemsByOrderId(orderId);
      const vendor = await storage.getVendor(order.vendorId);
      const company = await storage.getCompany(order.companyId);
      const store = order.storeId ? await storage.getStore(order.storeId) : undefined;
      
      // Get admin-level supported vendor data for accurate name/shortCode
      const supportedVendor = vendor?.supportedVendorId 
        ? await storage.getSupportedVendor(vendor.supportedVendorId)
        : null;
      
      // Merge store vendor with admin vendor data (prefer admin-level name/shortCode)
      const vendorData = vendor && supportedVendor ? {
        ...vendor,
        name: supportedVendor.name, // Use admin-level full name
        vendorShortCode: supportedVendor.vendorShortCode // Use admin-level short code
      } : vendor;
      
      // Use the SAME comprehensive webhook generation as actual order submissions
      const webhookPayload = await WebhookServiceV2.generateOrderWebhook(
        order,
        orderItems,
        store,
        company,
        vendorData,
        undefined, // user data not needed for preview
        'order.submitted'
      );
      

      
      res.json({
        success: true,
        payload: webhookPayload, // Return the complete webhook payload
        webhookUrl: process.env.MICROBIZ_WEBHOOK_URL || null,
        configured: !!process.env.MICROBIZ_WEBHOOK_URL
      });
      
    } catch (error) {
      console.error('Webhook preview error:', error);
      res.status(500).json({ message: "Failed to generate webhook preview" });
    }
  });

  // Individual order details with real-time vendor SKU lookup
  app.get("/org/:slug/api/orders/:id", requireOrganizationAccess, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const orderItems = await storage.getOrderItemsByOrderId(orderId);
      const vendor = await storage.getVendor(order.vendorId);
      console.log(`ORDER DETAILS: Order ${orderId} has ${orderItems.length} items, vendor: ${vendor?.name}`);
      
      // Enrich order items with product and vendor product details including real-time SKU lookup
      const enrichedItems = await Promise.all(
        orderItems.map(async (item) => {
          const product = await storage.getProduct(item.productId);
          
          // Use stored vendor SKU from order record (captured at order creation time)
          // This maintains historical accuracy even if vendor systems change
          let vendorSku = '';
          
          console.log(`ORDER DETAILS: Item ${item.id} - Checking stored vendor_sku field`);
          
          // First, try to use the vendor SKU stored in the order record
          if ((item as any).vendorSku && (item as any).vendorSku !== 'null') {
            vendorSku = (item as any).vendorSku;
            console.log(`ORDER DETAILS: Using stored vendor SKU: ${vendorSku}`);
          } else {
            // Fallback: Use UPC if no vendor SKU was stored
            vendorSku = product?.upc || null;
            console.log(`ORDER DETAILS: No stored vendor SKU, using UPC fallback: ${vendorSku}`);
          }
          
          return {
            ...item,
            product: product ? {
              ...product,
              imageUrl: product.imageUrl || null // Ensure imageUrl is included
            } : null,
            vendorSku
          };
        })
      );
      
      res.json({
        ...order,
        vendor: vendor?.name || null,
        items: enrichedItems,
        itemCount: enrichedItems.reduce((sum, item) => sum + item.quantity, 0)
      });
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Update order endpoint - PATCH for updating order fields like status
  app.patch("/org/:slug/api/orders/:id", requireOrganizationAccess, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const organizationId = (req as any).organizationId;
      const updates = req.body;
      
      // Verify the order exists and belongs to the organization
      const existingOrder = await storage.getOrder(orderId);
      if (!existingOrder || existingOrder.companyId !== organizationId) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Update the order
      const updatedOrder = await storage.updateOrder(orderId, updates);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json({
        success: true,
        order: updatedOrder,
        message: "Order updated successfully"
      });
    } catch (error) {
      console.error('Failed to update order:', error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // General order update endpoint (for admin and general use)
  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const updates = req.body;
      
      // Update the order
      const updatedOrder = await storage.updateOrder(orderId, updates);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json({
        success: true,
        order: updatedOrder,
        message: "Order updated successfully"
      });
    } catch (error) {
      console.error('Failed to update order:', error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // Bulk delete draft orders
  app.post("/org/:slug/api/orders/bulk-delete", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const { orderIds } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "Invalid order IDs" });
      }
      
      // Verify all orders belong to organization and are drafts
      let deletedCount = 0;
      for (const orderId of orderIds) {
        const order = await storage.getOrder(orderId);
        if (order && order.companyId === organizationId && order.status === 'draft') {
          await storage.deleteOrder(orderId);
          deletedCount++;
        }
      }
      
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error('Failed to delete draft orders:', error);
      res.status(500).json({ message: "Failed to delete draft orders" });
    }
  });

  // Bulk change order status
  app.post("/org/:slug/api/orders/bulk-status", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const { orderIds, status } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "Invalid order IDs" });
      }
      
      if (!['open', 'complete', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Update all orders
      let updatedCount = 0;
      for (const orderId of orderIds) {
        const order = await storage.getOrder(orderId);
        if (order && order.companyId === organizationId) {
          // Validate status transitions
          if (status === 'open' && order.status !== 'draft') continue;
          if (status === 'complete' && order.status !== 'open') continue;
          if (status === 'cancelled' && order.status !== 'open') continue;
          
          await storage.updateOrder(orderId, { status });
          updatedCount++;
        }
      }
      
      res.json({ success: true, updatedCount });
    } catch (error) {
      console.error('Failed to update order status:', error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Bulk merge draft orders
  app.post("/org/:slug/api/orders/bulk-merge", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const { orderIds } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length < 2) {
        return res.status(400).json({ message: "At least 2 orders required for merging" });
      }
      
      // Get all orders and verify they're draft orders from same organization and same vendor
      const orders = await Promise.all(orderIds.map(id => storage.getOrder(id)));
      const validOrders = orders.filter(order => 
        order && 
        order.companyId === organizationId && 
        order.status === 'draft'
      ) as Order[];
      
      if (validOrders.length < 2) {
        return res.status(400).json({ message: "At least 2 valid draft orders required" });
      }
      
      // Check all orders are from same vendor
      const firstVendor = validOrders[0].vendorId;
      if (!validOrders.every(order => order.vendorId === firstVendor)) {
        return res.status(400).json({ message: "All orders must be from the same vendor" });
      }
      
      // Use first order as the surviving order
      const survivingOrder = validOrders[0];
      const ordersToMerge = validOrders.slice(1);
      
      // Get all order items for orders to merge
      let totalItems = 0;
      let totalCost = 0;
      
      for (const order of ordersToMerge) {
        const orderItems = await storage.getOrderItemsByOrderId(order.id);
        if (orderItems && orderItems.length > 0) {
          // Move all items to surviving order
          for (const item of orderItems) {
            await storage.updateOrderItem(item.id, { orderId: survivingOrder.id });
            totalItems++;
            const itemCost = parseFloat(item.unitCost.replace('$', ''));
            totalCost += itemCost * item.quantity;
          }
        }
        
        // Delete the merged order
        await storage.deleteOrder(order.id);
      }
      
      // Update surviving order's total amount and item count
      const survivingOrderItems = await storage.getOrderItemsByOrderId(survivingOrder.id);
      if (survivingOrderItems && survivingOrderItems.length > 0) {
        const newTotalAmount = survivingOrderItems.reduce((sum, item) => {
          const itemCost = parseFloat(item.unitCost.replace('$', ''));
          return sum + (itemCost * item.quantity);
        }, 0);
        
        const newItemCount = survivingOrderItems.reduce((sum, item) => {
          return sum + item.quantity;
        }, 0);
        
        await storage.updateOrder(survivingOrder.id, {
          totalAmount: newTotalAmount.toFixed(2),
          itemCount: newItemCount
        });
      }
      
      res.json({ 
        success: true, 
        mergedCount: ordersToMerge.length,
        survivingOrderNumber: survivingOrder.orderNumber,
        totalItems,
        totalCost: totalCost.toFixed(2)
      });
    } catch (error) {
      console.error('Failed to merge draft orders:', error);
      res.status(500).json({ message: "Failed to merge draft orders" });
    }
  });

  // Admin versions of bulk operations (without organization context)
  // Bulk delete draft orders (admin)
  app.post("/api/orders/bulk-delete", async (req, res) => {
    try {
      const { orderIds } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "Invalid order IDs" });
      }
      
      let deletedCount = 0;
      for (const orderId of orderIds) {
        const order = await storage.getOrder(orderId);
        if (order && order.status === 'draft') {
          await storage.deleteOrder(orderId);
          deletedCount++;
        }
      }
      
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error('Failed to delete draft orders:', error);
      res.status(500).json({ message: "Failed to delete draft orders" });
    }
  });

  // Bulk change order status (admin)
  app.post("/api/orders/bulk-status", async (req, res) => {
    try {
      const { orderIds, status } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "Invalid order IDs" });
      }
      
      if (!['open', 'complete', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      let updatedCount = 0;
      for (const orderId of orderIds) {
        const order = await storage.getOrder(orderId);
        if (order) {
          // Validate status transitions
          if (status === 'open' && order.status !== 'draft') continue;
          if (status === 'complete' && order.status !== 'open') continue;
          if (status === 'cancelled' && order.status !== 'open') continue;
          
          await storage.updateOrder(orderId, { status });
          updatedCount++;
        }
      }
      
      res.json({ success: true, updatedCount });
    } catch (error) {
      console.error('Failed to update order status:', error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Bulk merge draft orders (admin)
  app.post("/api/orders/bulk-merge", async (req, res) => {
    try {
      const { orderIds } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length < 2) {
        return res.status(400).json({ message: "At least 2 orders required for merging" });
      }
      
      // Get all orders and verify they're draft orders
      const orders = await Promise.all(orderIds.map(id => storage.getOrder(id)));
      const validOrders = orders.filter(order => 
        order && order.status === 'draft'
      ) as Order[];
      
      if (validOrders.length < 2) {
        return res.status(400).json({ message: "At least 2 valid draft orders required" });
      }
      
      // Check all orders are from same vendor
      const firstVendor = validOrders[0].vendorId;
      if (!validOrders.every(order => order.vendorId === firstVendor)) {
        return res.status(400).json({ message: "All orders must be from the same vendor" });
      }
      
      // Use first order as the surviving order
      const survivingOrder = validOrders[0];
      const ordersToMerge = validOrders.slice(1);
      
      // Get all order items for orders to merge
      let totalItems = 0;
      let totalCost = 0;
      
      for (const order of ordersToMerge) {
        const orderItems = await storage.getOrderItemsByOrderId(order.id);
        if (orderItems && orderItems.length > 0) {
          // Move all items to surviving order
          for (const item of orderItems) {
            await storage.updateOrderItem(item.id, { orderId: survivingOrder.id });
            totalItems++;
            const itemCost = parseFloat(item.unitCost.replace('$', ''));
            totalCost += itemCost * item.quantity;
          }
        }
        
        // Delete the merged order
        await storage.deleteOrder(order.id);
      }
      
      // Update surviving order's total amount and item count
      const survivingOrderItems = await storage.getOrderItemsByOrderId(survivingOrder.id);
      if (survivingOrderItems && survivingOrderItems.length > 0) {
        const newTotalAmount = survivingOrderItems.reduce((sum, item) => {
          const itemCost = parseFloat(item.unitCost.replace('$', ''));
          return sum + (itemCost * item.quantity);
        }, 0);
        
        const newItemCount = survivingOrderItems.reduce((sum, item) => {
          return sum + item.quantity;
        }, 0);
        
        await storage.updateOrder(survivingOrder.id, {
          totalAmount: newTotalAmount.toFixed(2),
          itemCount: newItemCount
        });
      }
      
      res.json({ 
        success: true, 
        mergedCount: ordersToMerge.length,
        survivingOrderNumber: survivingOrder.orderNumber,
        totalItems,
        totalCost: totalCost.toFixed(2)
      });
    } catch (error) {
      console.error('Failed to merge draft orders:', error);
      res.status(500).json({ message: "Failed to merge draft orders" });
    }
  });

  // Consolidate duplicate order items (admin)
  app.post("/api/orders/:id/consolidate", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Get all order items
      const orderItems = await storage.getOrderItemsByOrderId(orderId);
      if (!orderItems || orderItems.length === 0) {
        return res.status(400).json({ message: "No items to consolidate" });
      }

      // Group items by productId (duplicate detection)
      const itemsByProductId = new Map<number, typeof orderItems>();
      for (const item of orderItems) {
        const productId = item.productId;
        if (!itemsByProductId.has(productId)) {
          itemsByProductId.set(productId, []);
        }
        itemsByProductId.get(productId)!.push(item);
      }

      // Find duplicates and consolidate
      let consolidatedCount = 0;
      for (const [productId, items] of itemsByProductId.entries()) {
        if (items.length > 1) {
          // Keep the first item, combine quantities
          const primaryItem = items[0];
          const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
          
          // Update the primary item with combined quantity
          await storage.updateOrderItem(primaryItem.id, {
            quantity: totalQuantity
          });

          // Delete the duplicate items
          for (let i = 1; i < items.length; i++) {
            await storage.deleteOrderItem(items[i].id);
            consolidatedCount++;
          }
        }
      }

      if (consolidatedCount === 0) {
        return res.json({ 
          success: true, 
          message: "No duplicate items found to consolidate" 
        });
      }

      // Recalculate order totals
      const updatedItems = await storage.getOrderItemsByOrderId(orderId);
      if (updatedItems && updatedItems.length > 0) {
        const newTotalAmount = updatedItems.reduce((sum, item) => {
          const itemCost = parseFloat(item.unitCost.replace('$', ''));
          return sum + (itemCost * item.quantity);
        }, 0);
        
        const newItemCount = updatedItems.reduce((sum, item) => {
          return sum + item.quantity;
        }, 0);
        
        await storage.updateOrder(orderId, {
          totalAmount: newTotalAmount.toFixed(2),
          itemCount: newItemCount
        });
      }

      res.json({ 
        success: true, 
        message: `Consolidated ${consolidatedCount} duplicate item(s)` 
      });

    } catch (error) {
      console.error('Order consolidation error:', error);
      res.status(500).json({ message: "Failed to consolidate order items" });
    }
  });

  // Admin billing and subscription endpoints
  app.get('/api/admin/billing-events', requireAdminAuth, async (req, res) => {
    try {
      const billingEvents = await storage.getAllBillingEvents();
      res.json(billingEvents);
    } catch (error) {
      console.error('Failed to fetch billing events:', error);
      res.status(500).json({ message: "Failed to fetch billing events" });
    }
  });

  app.get('/api/admin/subscriptions', requireAdminAuth, async (req, res) => {
    try {
      // For subscriptions, we use the companies data with additional statistics
      const organizations = await storage.getAllCompaniesWithStats();
      res.json(organizations);
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // Create manual subscription (for development and manual onboarding)
  app.post('/api/admin/subscriptions/create', requireAdminAuth, async (req, res) => {
    try {
      const {
        companyName,
        firstName,
        lastName,
        email,
        phone,
        address1,
        address2,
        city,
        state,
        zipCode,
        country,
        timezone,
        retailVerticalId,
        plan,
        customerAccountNumber
      } = req.body;

      // Validate required fields
      if (!companyName || !firstName || !lastName || !email || !plan || !retailVerticalId) {
        return res.status(400).json({ 
          message: "Missing required fields: companyName, firstName, lastName, email, plan, and retailVerticalId are required" 
        });
      }

      // Import billing service and create subscription
      const { BillingService } = await import('./billing-service');
      const billingService = new BillingService();

      const result = await billingService.createManualSubscription({
        companyName,
        firstName,
        lastName,
        email,
        phone,
        address1,
        address2,
        city,
        state,
        zipCode,
        country,
        timezone,
        retailVerticalId: retailVerticalId ? parseInt(retailVerticalId) : undefined,
        plan,
        customerAccountNumber
      });

      if (result.success) {
        console.log('✅ ADMIN: Manual subscription created successfully', {
          companyId: result.company.id,
          companyName: result.company.name,
          slug: result.company.slug,
          adminUser: req.user?.username
        });

        res.status(201).json({
          success: true,
          message: result.message,
          company: {
            id: result.company.id,
            name: result.company.name,
            slug: result.company.slug,
            plan: result.company.plan,
            loginUrl: `${req.protocol}://${req.get('host')}/org/${result.company.slug}/auth`
          }
        });
      } else {
        res.status(500).json({ 
          success: false,
          message: "Failed to create subscription" 
        });
      }

    } catch (error: any) {
      console.error('❌ ADMIN: Manual subscription creation error:', error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to create subscription",
        error: error.toString()
      });
    }
  });

  app.get('/api/admin/organizations', requireAdminAuth, async (req, res) => {
    try {
      const organizations = await storage.getAllCompaniesWithStats();
      res.json(organizations);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
    try {
      const organizations = await storage.getAllCompaniesWithStats();
      
      // Calculate aggregate statistics
      const totalOrganizations = organizations.length;
      const activeOrganizations = organizations.filter(org => org.status === 'active').length;
      const trialOrganizations = organizations.filter(org => org.status === 'trial').length;
      const totalRevenue = organizations.reduce((sum, org) => {
        const plan = org.plan;
        // Calculate revenue based on plan
        if (plan === 'basic') return sum + 29;
        if (plan === 'pro') return sum + 99;
        if (plan === 'enterprise') return sum + 299;
        return sum;
      }, 0);
      
      const stats = {
        totalOrganizations,
        activeOrganizations,
        trialOrganizations,
        totalRevenue,
        organizations
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get('/api/admin/dashboard', requireAdminAuth, async (req, res) => {
    try {
      // Get all organizations for admin overview
      const organizations = await storage.getAllCompaniesWithStats();
      
      // Aggregate data across all organizations
      let totalOrders = 0;
      let totalDraftOrders = 0;
      let totalOpenOrders = 0;
      let totalShipNotices = 0;
      let totalConnectedVendors = 0;
      let recentActivity = [];
      
      for (const org of organizations) {
        try {
          const orders = await storage.getOrdersByCompany(org.id);
          const asns = await storage.getASNsByCompany(org.id);
          const vendors = await storage.getVendorsByCompany(org.id);
          
          totalOrders += orders.length;
          totalDraftOrders += orders.filter(o => o.status === 'draft').length;
          totalOpenOrders += orders.filter(o => o.status === 'open').length;
          totalShipNotices += asns.filter(asn => asn.trackingNumber && asn.trackingNumber.length > 0).length;
          totalConnectedVendors += vendors.filter(v => v.status === 'online' || v.status === 'connected').length;
          
          // Add recent orders from this organization to activity
          const orgRecentOrders = orders
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
            .slice(0, 2)
            .map(order => {
              const vendor = vendors.find(v => v.id === order.vendorId);
              const orderItems = order.itemCount || 1;
              return {
                type: 'order',
                title: `${org.name}: Order ${order.orderNumber} ${order.status === 'draft' ? 'created' : 'submitted'}`,
                description: `${orderItems} item${orderItems !== 1 ? 's' : ''} • ${vendor?.name || 'Unknown vendor'}`,
                timestamp: order.orderDate,
                color: order.status === 'draft' ? 'yellow' : order.status === 'open' ? 'blue' : 'green',
                organizationName: org.name
              };
            });
          
          recentActivity.push(...orgRecentOrders);
        } catch (error) {
          console.error(`Error fetching data for organization ${org.id}:`, error);
          // Continue with other organizations
        }
      }
      
      // Sort recent activity by timestamp and limit to 10 most recent
      recentActivity = recentActivity
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      const stats = {
        totalOrganizations: organizations.length,
        activeOrganizations: organizations.filter(org => org.status === 'active').length,
        totalOrders,
        totalDraftOrders,
        totalOpenOrders,
        totalShipNotices,
        totalConnectedVendors,
        recentActivity
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch admin dashboard data:', error);
      res.status(500).json({ message: "Failed to fetch admin dashboard data" });
    }
  });

  // Admin organization status management
  const organizationStatusUpdateSchema = z.object({
    status: z.enum(['active', 'cancelled', 'suspended', 'paused']),
    reason: z.string().optional(),
    syncToZoho: z.boolean().default(false)
  });

  app.patch('/api/admin/organizations/:id/status', requireAdminAuth, async (req, res) => {
    try {
      const organizationId = parseInt(req.params.id);
      if (isNaN(organizationId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      // Validate request body
      const validation = organizationStatusUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validation.error.errors 
        });
      }

      const { status, reason, syncToZoho } = validation.data;
      const adminUser = (req as any).user;

      // Check if organization exists
      const organization = await storage.getCompany(organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Validate status transition
      const validTransitions = {
        active: ['cancelled', 'suspended', 'paused'],
        trial: ['active', 'cancelled', 'suspended'],
        cancelled: ['active'],
        suspended: ['active', 'cancelled'],
        paused: ['active', 'cancelled'],
        expired: ['active', 'cancelled']
      };

      const currentStatus = organization.status || 'active';
      if (!validTransitions[currentStatus as keyof typeof validTransitions]?.includes(status)) {
        return res.status(400).json({ 
          message: `Cannot transition from '${currentStatus}' to '${status}'` 
        });
      }

      // Update organization status
      const updatedOrganization = await storage.updateCompany(organizationId, {
        status,
        updatedAt: new Date()
      });

      if (!updatedOrganization) {
        return res.status(500).json({ message: "Failed to update organization status" });
      }

      // Log status change to database audit trail
      const auditLogData = {
        companyId: organizationId,
        previousStatus: currentStatus,
        newStatus: status,
        reason: reason || 'Manual admin status change',
        changedBy: adminUser?.username || 'admin',
        metadata: {
          syncToZoho,
          adminUserId: adminUser?.id,
          requestIP: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        }
      };

      console.log('📋 ADMIN STATUS CHANGE:', auditLogData);
      
      // Save to database audit trail
      const auditLog = await storage.logOrganizationStatusChange(auditLogData);

      // Optional: Sync to Zoho if requested
      let zohoSyncResult = null;
      if (syncToZoho && organization.billingCustomerId) {
        try {
          console.log('🔄 ADMIN STATUS SYNC: Starting Zoho Billing sync', {
            organizationId,
            customerId: organization.billingCustomerId,
            newStatus: status,
            adminUser: adminUser?.username
          });

          // Import billing service here to avoid circular dependencies
          const { zohoBilling } = await import('./zoho-billing-service');
          
          // Generate correlation ID to prevent webhook loops
          const correlationId = zohoBilling.generateCorrelationId(
            adminUser?.username || 'admin',
            organizationId
          );
          
          // Sync status change to Zoho Billing
          zohoSyncResult = await zohoBilling.updateSubscriptionStatus(
            organization.billingCustomerId,
            status,
            correlationId
          );
          
          console.log('✅ ADMIN STATUS SYNC: Zoho sync successful', {
            organizationId,
            correlationId,
            zohoResponse: zohoSyncResult
          });
          
          // Log successful sync to audit trail
          auditLog.zohoSync = {
            success: true,
            correlationId,
            syncedAt: new Date().toISOString(),
            zohoStatus: zohoSyncResult.status
          };

        } catch (zohoError) {
          const errorMessage = zohoError instanceof Error ? zohoError.message : String(zohoError);
          
          console.error('❌ ADMIN STATUS SYNC: Zoho sync failed', {
            organizationId,
            error: errorMessage,
            customerId: organization.billingCustomerId,
            newStatus: status
          });
          
          // Log failed sync to audit trail but don't fail the admin operation
          auditLog.zohoSync = {
            success: false,
            error: errorMessage,
            attemptedAt: new Date().toISOString()
          };
          
          // Note: We don't throw here - admin changes should succeed even if Zoho sync fails
          console.log('⚠️ ADMIN STATUS SYNC: Continuing with admin status change despite Zoho sync failure');
        }
      }

      res.json({
        message: "Organization status updated successfully",
        organization: {
          id: updatedOrganization.id,
          name: updatedOrganization.name,
          status: updatedOrganization.status,
          previousStatus: currentStatus
        },
        auditLog: {
          id: auditLog.id,
          previousStatus: auditLog.previousStatus,
          newStatus: auditLog.newStatus,
          reason: auditLog.reason,
          changedBy: auditLog.changedBy,
          changedAt: auditLog.changedAt,
          zohoSync: auditLog.metadata?.zohoSync || null
        },
        zohoSync: zohoSyncResult ? {
          success: true,
          correlationId: zohoSyncResult.correlation_id,
          zohoStatus: zohoSyncResult.status,
          syncedAt: zohoSyncResult.updated_at
        } : null
      });
    } catch (error) {
      console.error('Failed to update organization status:', error);
      res.status(500).json({ message: "Failed to update organization status" });
    }
  });

  // Get organization status change audit trail
  app.get('/api/admin/organizations/:id/audit-trail', requireAdminAuth, async (req, res) => {
    try {
      const organizationId = parseInt(req.params.id);
      if (isNaN(organizationId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      // Check if organization exists
      const organization = await storage.getCompany(organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // TODO: Once organizationStatusAuditLog is properly implemented in the database,
      // replace this with actual query to the audit log table
      // For now, return basic organization info and placeholder audit trail
      const auditTrail = [
        {
          id: 1,
          previousStatus: 'trial',
          newStatus: organization.status || 'active',
          reason: 'Current status',
          changedBy: 'system',
          changedAt: organization.updatedAt || organization.createdAt,
          metadata: {}
        }
      ];

      res.json({
        organization: {
          id: organization.id,
          name: organization.name,
          status: organization.status || 'active',
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt
        },
        auditTrail
      });
    } catch (error) {
      console.error('Failed to fetch organization audit trail:', error);
      res.status(500).json({ message: "Failed to fetch audit trail" });
    }
  });

  // Deprecated: Organization deletion (use status management instead)
  app.delete('/api/admin/organizations/:id', requireAdminAuth, async (req, res) => {
    try {
      const organizationId = parseInt(req.params.id);
      if (isNaN(organizationId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      // Check if organization exists
      const organization = await storage.getCompany(organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Instead of deleting, change status to 'cancelled'
      const updatedOrganization = await storage.updateCompany(organizationId, {
        status: 'cancelled',
        updatedAt: new Date()
      });
      
      if (!updatedOrganization) {
        return res.status(404).json({ message: "Organization not found or update failed" });
      }

      const adminUser = (req as any).user;
      const auditLog = {
        organizationId,
        organizationName: organization.name,
        previousStatus: organization.status || 'active',
        newStatus: 'cancelled',
        reason: 'Organization deletion (converted to cancellation)',
        changedBy: adminUser?.username || 'admin',
        changedAt: new Date().toISOString(),
        syncToZoho: false
      };

      console.log('⚠️ ADMIN DELETION CONVERTED TO CANCELLATION:', auditLog);
      
      res.json({ 
        message: "Organization cancelled successfully (deletion converted to cancellation)",
        organization: {
          id: updatedOrganization.id,
          name: updatedOrganization.name,
          status: updatedOrganization.status,
          previousStatus: organization.status || 'active'
        },
        auditLog,
        warning: "Note: Organization was cancelled instead of deleted to preserve data integrity. Use PATCH /api/admin/organizations/:id/status for explicit status management."
      });
    } catch (error) {
      console.error('Failed to process organization deletion:', error);
      res.status(500).json({ message: "Failed to process organization deletion" });
    }
  });

  // Public API endpoints (no authentication required for import dropdown)
  app.get('/api/retail-verticals', async (req, res) => {
    try {
      const retailVerticals = await storage.getAllRetailVerticals();
      res.json(retailVerticals);
    } catch (error) {
      console.error('Failed to fetch retail verticals:', error);
      res.status(500).json({ message: "Failed to fetch retail verticals" });
    }
  });

  app.get('/api/supported-vendors', async (req, res) => {
    try {
      const supportedVendors = await storage.getAllSupportedVendors();
      res.json(supportedVendors);
    } catch (error) {
      console.error('Failed to fetch supported vendors:', error);
      res.status(500).json({ message: "Failed to fetch supported vendors" });
    }
  });

  // Diagnostic endpoint to check database connection and data
  app.get('/api/diagnostic/database', async (req, res) => {
    try {
      const { db } = await import('./db');
      const { supportedVendors: svTable, retailVerticals: rvTable } = await import('@shared/schema');
      
      const vendorCount = await db.select({ count: sql<number>`count(*)` }).from(svTable);
      const verticalCount = await db.select({ count: sql<number>`count(*)` }).from(rvTable);
      const vendors = await db.select().from(svTable).limit(5);
      
      res.json({
        database_connected: true,
        supported_vendors_count: vendorCount[0]?.count || 0,
        retail_verticals_count: verticalCount[0]?.count || 0,
        sample_vendors: vendors.map(v => ({ id: v.id, name: v.name, vendor_short_code: v.vendorShortCode })),
        database_url_prefix: process.env.DATABASE_URL?.substring(0, 50) || 'not_set',
        node_env: process.env.NODE_ENV
      });
    } catch (error) {
      res.status(500).json({ 
        database_connected: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/api/admin/supported-vendors', requireAdminAuth, async (req, res) => {
    try {
      console.log('🔍 DEBUG: Fetching supported vendors...');
      const supportedVendors = await storage.getAllSupportedVendors();
      console.log('🔍 DEBUG: Found supported vendors:', supportedVendors.length);
      if (supportedVendors.length === 0) {
        console.log('⚠️ DEBUG: No supported vendors found in database');
      } else {
        console.log('🔍 DEBUG: First vendor:', supportedVendors[0]?.name);
      }
      res.json(supportedVendors);
    } catch (error) {
      console.error('❌ Failed to fetch supported vendors:', error);
      res.status(500).json({ message: "Failed to fetch supported vendors", error: error.message });
    }
  });

  app.patch('/api/admin/supported-vendors/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      console.log('=== PATCH SUPPORTED VENDOR START ===');
      console.log('Vendor ID:', id);
      console.log('Updates keys:', Object.keys(updates));
      console.log('adminCredentials present:', !!updates.adminCredentials);
      if (updates.adminCredentials) {
        console.log('adminCredentials keys:', Object.keys(updates.adminCredentials));
      }
      
      // Validate strict 1-N priority constraint if productRecordPriority is being updated
      if (updates.productRecordPriority !== undefined) {
        const newPriority = updates.productRecordPriority;
        console.log('VENDOR PRIORITY VALIDATION: Validating priority', newPriority, 'for 1-N enforcement');
        
        // Get all vendors for validation
        const allVendors = await storage.getAllSupportedVendors();
        const totalVendors = allVendors.length;
        
        // Strict validation: Priority must be a positive integer between 1 and N
        if (newPriority === null || newPriority === undefined) {
          console.log('VENDOR PRIORITY VALIDATION: NULL/undefined priority rejected - all vendors must have a priority');
          return res.status(400).json({ 
            error: 'Priority is required. All vendors must have a unique priority between 1 and ' + totalVendors + '.'
          });
        }
        
        if (!Number.isInteger(newPriority) || newPriority < 1 || newPriority > totalVendors) {
          console.log('VENDOR PRIORITY VALIDATION: Invalid priority range', newPriority, 'for', totalVendors, 'vendors');
          return res.status(400).json({ 
            error: `Priority must be a unique integer between 1 and ${totalVendors} (current total vendors).`
          });
        }
        
        // Check for conflicts with other vendors
        const conflictingVendor = allVendors.find(v => 
          v.id !== id && v.productRecordPriority === newPriority
        );
        
        if (conflictingVendor) {
          console.log('VENDOR PRIORITY VALIDATION: Priority', newPriority, 'already assigned to vendor:', conflictingVendor.name);
          return res.status(400).json({ 
            error: `Priority ${newPriority} is already assigned to ${conflictingVendor.name}. Please choose a different priority between 1 and ${totalVendors}.` 
          });
        }
        
        console.log('VENDOR PRIORITY VALIDATION: Priority', newPriority, 'is valid and available');
      }
      
      const vendor = await storage.updateSupportedVendor(id, updates);
      if (!vendor) {
        console.log('ERROR: Vendor not found for ID:', id);
        return res.status(404).json({ error: 'Supported vendor not found' });
      }
      
      // Update schedulers when Bill Hicks settings change
      const billHicksVendorIdForCompare = await storage.getBillHicksVendorId().catch(() => null);
      if (billHicksVendorIdForCompare && id === billHicksVendorIdForCompare && (updates.billHicksMasterCatalogSyncTime || updates.billHicksMasterCatalogSyncEnabled !== undefined)) {
        console.log('BILL HICKS: Scheduler settings updated in database (using Scheduled Deployments for automation)');
      }

      // Invalidate vendor priority cache when productRecordPriority is updated
      if (updates.productRecordPriority !== undefined) {
        console.log('VENDOR PRIORITY: productRecordPriority was updated, invalidating cache for vendor:', vendor.name);
        try {
          invalidateVendorPriorityCache(vendor.name);
          console.log('VENDOR PRIORITY: Successfully invalidated cache for vendor:', vendor.name);
        } catch (error) {
          console.error('VENDOR PRIORITY: Failed to invalidate cache for vendor:', vendor.name, error);
        }
      }
      
      console.log('SUPPORTED VENDOR UPDATE SUCCESS:', vendor.name);
      console.log('=== PATCH SUPPORTED VENDOR END ===');
      res.json(vendor);
    } catch (error) {
      console.error('=== PATCH SUPPORTED VENDOR ERROR ===');
      console.error('Error updating supported vendor:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        vendorId: req.params.id,
        updateKeys: Object.keys(req.body),
        updateValues: req.body
      });
      console.error('=== END ERROR ===');
      res.status(500).json({ 
        error: 'Failed to update supported vendor',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      });
    }
  });

  // Update vendor priority for a specific retail vertical
  app.patch('/api/admin/supported-vendors/:id/priority/:retailVerticalId', requireAdminAuth, async (req, res) => {
    try {
      const vendorId = parseInt(req.params.id);
      const retailVerticalId = parseInt(req.params.retailVerticalId);
      const { priority } = req.body;
      
      console.log('=== UPDATE VENDOR PRIORITY START ===');
      console.log('Vendor ID:', vendorId);
      console.log('Retail Vertical ID:', retailVerticalId);
      console.log('New Priority:', priority);
      
      // Validate priority is in valid range (1-25)
      if (!Number.isInteger(priority) || priority < 1 || priority > 25) {
        return res.status(400).json({ 
          error: 'Priority must be an integer between 1 and 25' 
        });
      }
      
      // Get available priorities for this retail vertical (excluding current vendor)
      const availablePriorities = await storage.getAvailablePriorities(retailVerticalId, vendorId);
      
      // Check if the requested priority is available
      if (!availablePriorities.includes(priority)) {
        // Get the vendor currently using this priority for better error message
        const allVendors = await storage.getAllSupportedVendors();
        const conflictingVendor = allVendors.find(v => 
          v.retailVerticals.some(rv => rv.id === retailVerticalId && rv.priority === priority && v.id !== vendorId)
        );
        
        return res.status(400).json({ 
          error: `Priority ${priority} is already assigned to ${conflictingVendor?.name || 'another vendor'} in this retail vertical. Available priorities: ${availablePriorities.slice(0, 5).join(', ')}${availablePriorities.length > 5 ? '...' : ''}` 
        });
      }
      
      // Update the priority
      const success = await storage.updateVendorPriorityForVertical(vendorId, retailVerticalId, priority);
      
      if (!success) {
        return res.status(500).json({ error: 'Failed to update priority' });
      }
      
      // Invalidate vendor priority cache
      const vendor = await storage.getSupportedVendor(vendorId);
      if (vendor) {
        try {
          invalidateVendorPriorityCache(vendor.name);
          console.log('VENDOR PRIORITY: Successfully invalidated cache for vendor:', vendor.name);
        } catch (error) {
          console.error('VENDOR PRIORITY: Failed to invalidate cache:', error);
        }
      }
      
      console.log('=== UPDATE VENDOR PRIORITY SUCCESS ===');
      res.json({ success: true, message: 'Priority updated successfully' });
    } catch (error) {
      console.error('Error updating vendor priority:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        vendorId: req.params.id,
        retailVerticalId: req.params.retailVerticalId,
        priority: req.body.priority
      });
      res.status(500).json({ 
        error: 'Failed to update vendor priority',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      });
    }
  });

  // Create new supported vendor with automatic priority assignment
  app.post('/api/admin/supported-vendors', requireAdminAuth, async (req, res) => {
    try {
      const vendorData = req.body;
      console.log('=== CREATE SUPPORTED VENDOR START ===');
      console.log('Request data keys:', Object.keys(vendorData));
      
      // SERVER-SIDE AUTO-ASSIGNMENT: Calculate next available priority
      // This cannot be bypassed by clients - server enforces 1-N sequence
      const allVendors = await storage.getAllSupportedVendors();
      const totalVendors = allVendors.length;
      const nextPriority = totalVendors + 1; // Add to end of sequence
      
      console.log('VENDOR PRIORITY AUTO-ASSIGNMENT: Total existing vendors:', totalVendors);
      console.log('VENDOR PRIORITY AUTO-ASSIGNMENT: Auto-assigning priority:', nextPriority);
      
      // Override any client-provided priority with server-computed value
      if (vendorData.productRecordPriority !== undefined) {
        console.log('VENDOR PRIORITY AUTO-ASSIGNMENT: Overriding client priority', vendorData.productRecordPriority, 'with server-computed', nextPriority);
      }
      vendorData.productRecordPriority = nextPriority;
      
      // Create vendor with server-enforced priority
      const newVendor = await storage.createSupportedVendor(vendorData);
      console.log('VENDOR PRIORITY AUTO-ASSIGNMENT: Created vendor', newVendor.name, 'with priority', nextPriority);
      
      // Invalidate vendor priority cache for immediate consistency
      try {
        invalidateVendorPriorityCache(newVendor.name);
        console.log('VENDOR PRIORITY CACHE: Invalidated cache for newly created vendor:', newVendor.name);
      } catch (error) {
        console.error('VENDOR PRIORITY CACHE: Failed to invalidate cache for vendor:', newVendor.name, error);
      }
      
      console.log('CREATE SUPPORTED VENDOR SUCCESS:', newVendor.name, 'Priority:', newVendor.productRecordPriority);
      console.log('=== CREATE SUPPORTED VENDOR END ===');
      res.status(201).json(newVendor);
    } catch (error) {
      console.error('Error creating supported vendor:', error);
      res.status(500).json({ error: 'Failed to create supported vendor' });
    }
  });

  // Delete supported vendor with priority re-sequencing
  app.delete('/api/admin/supported-vendors/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log('=== DELETE SUPPORTED VENDOR START ===');
      console.log('Deleting vendor ID:', id);
      
      // Get vendor before deletion for priority re-sequencing
      const vendorToDelete = await storage.getSupportedVendorById(id);
      if (!vendorToDelete) {
        console.log('ERROR: Vendor not found for deletion, ID:', id);
        return res.status(404).json({ error: 'Supported vendor not found' });
      }
      
      const deletedPriority = vendorToDelete.productRecordPriority;
      console.log('VENDOR PRIORITY RE-SEQUENCING: Deleting vendor', vendorToDelete.name, 'with priority', deletedPriority);
      
      // Delete the vendor
      const deleted = await storage.deleteSupportedVendor(id);
      if (!deleted) {
        console.log('ERROR: Failed to delete vendor ID:', id);
        return res.status(404).json({ error: 'Supported vendor not found' });
      }
      
      console.log('VENDOR PRIORITY RE-SEQUENCING: Vendor deleted, now re-sequencing remaining vendors...');
      
      // RE-SEQUENCE: Fix gaps in 1-N priority sequence
      // All vendors with priority > deletedPriority need to be decremented by 1
      if (deletedPriority && typeof deletedPriority === 'number') {
        const allVendors = await storage.getAllSupportedVendors();
        const vendorsToResequence = allVendors.filter(v => 
          v.productRecordPriority && v.productRecordPriority > deletedPriority
        );
        
        console.log('VENDOR PRIORITY RE-SEQUENCING: Found', vendorsToResequence.length, 'vendors to re-sequence');
        
        // Update priorities in transaction-like manner
        for (const vendor of vendorsToResequence) {
          const newPriority = vendor.productRecordPriority - 1;
          console.log('VENDOR PRIORITY RE-SEQUENCING: Updating', vendor.name, 'from priority', vendor.productRecordPriority, 'to', newPriority);
          
          await storage.updateSupportedVendor(vendor.id, {
            productRecordPriority: newPriority
          });
          
          // Invalidate cache for each updated vendor
          try {
            invalidateVendorPriorityCache(vendor.name);
            console.log('VENDOR PRIORITY CACHE: Invalidated cache for re-sequenced vendor:', vendor.name);
          } catch (error) {
            console.error('VENDOR PRIORITY CACHE: Failed to invalidate cache for vendor:', vendor.name, error);
          }
        }
        
        console.log('VENDOR PRIORITY RE-SEQUENCING: Successfully re-sequenced', vendorsToResequence.length, 'vendors');
      }
      
      // Invalidate cache for deleted vendor
      try {
        invalidateVendorPriorityCache(vendorToDelete.name);
        console.log('VENDOR PRIORITY CACHE: Invalidated cache for deleted vendor:', vendorToDelete.name);
      } catch (error) {
        console.error('VENDOR PRIORITY CACHE: Failed to invalidate cache for deleted vendor:', vendorToDelete.name, error);
      }
      
      console.log('DELETE SUPPORTED VENDOR SUCCESS:', vendorToDelete.name);
      console.log('=== DELETE SUPPORTED VENDOR END ===');
      res.json({ success: true, message: 'Supported vendor deleted and priorities re-sequenced' });
    } catch (error) {
      console.error('Error deleting supported vendor:', error);
      res.status(500).json({ error: 'Failed to delete supported vendor' });
    }
  });


  app.get('/api/admin/retail-verticals', requireAdminAuth, async (req, res) => {
    try {
      const retailVerticals = await storage.getAllRetailVerticals();
      res.json(retailVerticals);
    } catch (error) {
      console.error('Failed to fetch retail verticals:', error);
      res.status(500).json({ message: "Failed to fetch retail verticals" });
    }
  });

  app.put('/api/admin/retail-verticals/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const vertical = await storage.updateRetailVertical(id, updates);
      if (!vertical) {
        return res.status(404).json({
          success: false,
          message: 'Retail vertical not found'
        });
      }

      res.json({
        success: true,
        data: vertical,
        message: 'Retail vertical updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating retail vertical:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update retail vertical'
      });
    }
  });

  // Category Template endpoints
  app.get('/api/admin/retail-verticals/:id/category-templates', requireAdminAuth, async (req, res) => {
    try {
      const retailVerticalId = parseInt(req.params.id);
      const templates = await storage.getCategoryTemplatesByRetailVertical(retailVerticalId);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching category templates:', error);
      res.status(500).json({ message: "Failed to fetch category templates" });
    }
  });

  app.post('/api/admin/category-templates', requireAdminAuth, async (req, res) => {
    try {
      const template = await storage.createCategoryTemplate(req.body);
      res.status(201).json(template);
    } catch (error: any) {
      console.error('Error creating category template:', error);
      if (error.message?.includes('duplicate key')) {
        res.status(400).json({ message: "Category template with this name or slug already exists for this retail vertical" });
      } else {
        res.status(500).json({ message: "Failed to create category template" });
      }
    }
  });

  app.put('/api/admin/category-templates/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.updateCategoryTemplate(id, req.body);
      if (!template) {
        return res.status(404).json({ message: "Category template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error('Error updating category template:', error);
      if (error.message?.includes('duplicate key')) {
        res.status(400).json({ message: "Category template with this name or slug already exists for this retail vertical" });
      } else {
        res.status(500).json({ message: "Failed to update category template" });
      }
    }
  });

  app.delete('/api/admin/category-templates/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCategoryTemplate(id);
      if (!success) {
        return res.status(404).json({ message: "Category template not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting category template:', error);
      res.status(500).json({ message: "Failed to delete category template" });
    }
  });

  app.get('/api/admin/master-catalog', requireAdminAuth, async (req, res) => {
    try {
      console.log(`🔍 MASTER CATALOG: Request received - Database: ${process.env.DATABASE_URL?.includes('localhost') ? 'LOCAL DEV' : 'PRODUCTION'}`);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.pageSize as string) || parseInt(req.query.limit as string) || 50;
      const searchQuery = req.query.search as string || '';
      const searchField = req.query.searchField as string || 'name';
      // Handle retail vertical filter - don't parse special '__all_verticals__' value
      const retailVerticalFilter = req.query.retailVertical as string;
      const retailVerticalId = (retailVerticalFilter && retailVerticalFilter !== '__all_verticals__') 
        ? parseInt(retailVerticalFilter) 
        : undefined;
      
      // Filter parameters
      const brandFilter = req.query.brand as string;
      const categoryFilter = req.query.category as string;
      const caliberFilter = req.query.caliber as string;
      const imageFilter = req.query.image as string;
      const modelFilter = req.query.model as string;
      const imageSourceFilter = req.query.imageSource as string;
      const sourceFilter = req.query.source as string;
      const statusFilter = req.query.status as string;
      
      console.log('MASTER CATALOG QUERY: imageSourceFilter =', imageSourceFilter);
      
      let result;
      if (searchQuery) {
        // For now, apply search without filters since searchProductsWithCount doesn't support filters
        result = await storage.searchProductsWithCount(
          searchQuery,
          searchField as 'upc' | 'name' | 'partNumber' | 'manufacturerPartNumber' | 'sku',
          page,
          limit,
          retailVerticalId
        );
      } else {
        // Get all products
        let allProducts = await storage.getAllProducts();
        
        // Apply filters
        if (brandFilter && brandFilter !== '__all_brands__') {
          allProducts = allProducts.filter(p => p.brand === brandFilter);
        }
        if (categoryFilter && categoryFilter !== '__all_categories__') {
          allProducts = allProducts.filter(p => p.category === categoryFilter);
        }
        if (caliberFilter && caliberFilter !== '__all_calibers__') {
          allProducts = allProducts.filter(p => p.caliber === caliberFilter);
        }
        if (sourceFilter && sourceFilter !== '__all_sources__') {
          allProducts = allProducts.filter(p => p.source === sourceFilter);
        }
        if (statusFilter && statusFilter !== '__all_statuses__') {
          allProducts = allProducts.filter(p => p.status === statusFilter);
        }
        if (imageFilter && imageFilter !== '__all_products__') {
          if (imageFilter === 'yes') {
            allProducts = allProducts.filter(p => p.imageUrl);
          } else if (imageFilter === 'no') {
            allProducts = allProducts.filter(p => !p.imageUrl);
          }
        }
        if (modelFilter && modelFilter !== '__all_products__') {
          if (modelFilter === 'yes') {
            allProducts = allProducts.filter(p => p.model && p.model.trim() !== '');
          } else if (modelFilter === 'no') {
            allProducts = allProducts.filter(p => !p.model || p.model.trim() === '');
          }
        }
        if (imageSourceFilter && imageSourceFilter !== '__all_image_sources__') {
          allProducts = allProducts.filter(p => p.imageSource === imageSourceFilter);
        }
        if (retailVerticalFilter && retailVerticalFilter !== '__all_verticals__') {
          const verticalId = parseInt(retailVerticalFilter);
          allProducts = allProducts.filter(p => p.retailVerticalId === verticalId);
        }
        
        // Apply pagination to filtered results
        const totalCount = allProducts.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProducts = allProducts.slice(startIndex, endIndex);
        
        result = {
          products: paginatedProducts,
          totalCount: totalCount,
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit)
        };
      }

      res.json(result);
    } catch (error) {
      console.error('Failed to fetch master catalog:', error);
      res.status(500).json({ message: "Failed to fetch master catalog" });
    }
  });

  // Export master catalog as CSV with limit for performance
  app.get('/api/admin/master-catalog/export', requireAdminAuth, async (req, res) => {
    try {
      console.log('ADMIN EXPORT: Starting master catalog CSV export');
      const searchQuery = req.query.search as string || '';
      const searchField = req.query.searchField as string || 'name';
      const brandFilter = req.query.brand as string || '';
      const categoryFilter = req.query.category as string || '';
      const subcategory1Filter = req.query.subcategory1 as string || '';
      const subcategory2Filter = req.query.subcategory2 as string || '';
      const subcategory3Filter = req.query.subcategory3 as string || '';
      const caliberFilter = req.query.caliber as string || '';
      const imageFilter = req.query.imageFilter as string || '';
      const modelFilter = req.query.modelFilter as string || '';
      const sourceFilter = req.query.source as string || '';
      const statusFilter = req.query.status as string || '';
      const retailVerticalFilter = req.query.retailVertical as string || '';
      const exportLimit = parseInt(req.query.limit as string) || 10000; // Limit to 10k products by default

      // Get filtered products (same logic as the main catalog endpoint)
      // Handle retail vertical filter - don't parse special '__all_verticals__' value
      const retailVerticalId = (retailVerticalFilter && retailVerticalFilter !== '__all_verticals__') 
        ? parseInt(retailVerticalFilter) 
        : undefined;
      
      let allProducts;
      if (searchQuery && searchQuery.trim()) {
        // Use search method for search queries
        const searchResult = await storage.searchProductsWithCount(
          searchQuery,
          searchField as 'upc' | 'name' | 'partNumber' | 'manufacturerPartNumber' | 'sku',
          1, // page
          exportLimit, // limit to prevent timeouts
          retailVerticalId
        );
        allProducts = searchResult.products;
      } else {
        // Get all products and apply filters, but limit the results
        let tempProducts = await storage.getAllProducts();
        
        // Apply filters
        if (brandFilter && brandFilter !== '__all_brands__') {
          tempProducts = tempProducts.filter(p => p.brand === brandFilter);
        }
        if (categoryFilter && categoryFilter !== '__all_categories__') {
          tempProducts = tempProducts.filter(p => p.category === categoryFilter);
        }
        if (caliberFilter && caliberFilter !== '__all_calibers__') {
          tempProducts = tempProducts.filter(p => p.caliber === caliberFilter);
        }
        if (sourceFilter && sourceFilter !== '__all_sources__') {
          tempProducts = tempProducts.filter(p => p.source === sourceFilter);
        }
        if (statusFilter && statusFilter !== '__all_statuses__') {
          tempProducts = tempProducts.filter(p => p.status === statusFilter);
        }
        if (imageFilter && imageFilter !== '__all_products__') {
          if (imageFilter === 'yes') {
            tempProducts = tempProducts.filter(p => p.imageUrl);
          } else if (imageFilter === 'no') {
            tempProducts = tempProducts.filter(p => !p.imageUrl);
          }
        }
        if (modelFilter && modelFilter !== '__all_products__') {
          if (modelFilter === 'yes') {
            tempProducts = tempProducts.filter(p => p.model && p.model.trim() !== '');
          } else if (modelFilter === 'no') {
            tempProducts = tempProducts.filter(p => !p.model || p.model.trim() === '');
          }
        }
        if (retailVerticalFilter && retailVerticalFilter !== '__all_verticals__') {
          const verticalId = parseInt(retailVerticalFilter);
          tempProducts = tempProducts.filter(p => p.retailVerticalId === verticalId);
        }
        
        // Limit results to prevent timeout
        allProducts = tempProducts.slice(0, exportLimit);
      }

      // Safety check
      if (!allProducts) {
        return res.status(500).json({ error: 'Failed to retrieve products' });
      }
      
      const totalAvailable = allProducts.length;
      const isLimited = req.query.limit || totalAvailable > exportLimit;
      
      console.log(`ADMIN EXPORT: Exporting ${allProducts.length} products${isLimited ? ` (limited from ${totalAvailable} total)` : ''}`);

      // CSV headers
      const csvHeaders = [
        'UPC', 'Product Name', 'Brand', 'Model', 'Manufacturer Part Number',
        'Alt ID 1', 'Alt ID 2', 'Caliber', 'Barrel Length', 'Category',
        'Subcategory 1', 'Subcategory 2', 'Subcategory 3', 'Description',
        'Image URL', 'Image Source', 'Source', 'Retail Vertical',
        'Serialized', 'Drop Ship Available', 'Allocated', 'Status',
        'Created At', 'Updated At'
      ];

      // Convert products to CSV rows in smaller chunks to prevent memory issues
      const csvRows: string[] = [];
      const chunkSize = 1000;
      
      for (let i = 0; i < allProducts.length; i += chunkSize) {
        const chunk = allProducts.slice(i, i + chunkSize);
        const chunkRows = chunk.map(product => [
          product.upc || '',
          (product.name || '').replace(/"/g, '""'), // Escape quotes
          product.brand || '',
          product.model || '',
          product.manufacturerPartNumber || '',
          product.altId1 || '',
          product.altId2 || '',
          product.caliber || '',
          product.barrelLength || '',
          product.category || '',
          product.subcategory1 || '',
          product.subcategory2 || '',
          product.subcategory3 || '',
          (product.description || '').replace(/"/g, '""'), // Escape quotes
          product.imageUrl || '',
          product.imageSource || '',
          product.source || '',
          product.retailVertical || '',
          product.serialized ? 'Yes' : 'No',
          product.dropShipAvailable ? 'Yes' : 'No',
          product.allocated ? 'Yes' : 'No',
          product.status || '',
          product.createdAt || '',
          product.updatedAt || ''
        ].map(cell => `"${cell}"`).join(','));
        
        csvRows.push(...chunkRows);
      }

      // Generate CSV content
      const csvContent = [
        csvHeaders.map(header => `"${header}"`).join(','),
        ...csvRows
      ].join('\n');

      // Generate filename with timestamp and record count
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `master-catalog-export-${allProducts.length}-products-${timestamp}.csv`;

      console.log(`ADMIN EXPORT: Generated CSV with ${allProducts.length} products`);

      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8').toString());

      res.send(csvContent);
    } catch (error: any) {
      console.error('ADMIN EXPORT: Failed to export master catalog:', error);
      res.status(500).json({ 
        error: 'Export failed', 
        message: error.message 
      });
    }
  });

  app.get('/api/admin/master-catalog/filter-options', requireAdminAuth, async (req, res) => {
    try {
      const retailVerticals = await storage.getAllRetailVerticals();
      
      // Get distinct values for filter dropdowns from the products table
      const allProducts = await storage.getAllProducts();

      // Extract unique values for each filter
      const brands = Array.from(new Set(allProducts.map(p => p.brand).filter(Boolean))).sort();
      const categories = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean))).sort();
      const subcategories1 = Array.from(new Set(allProducts.map(p => p.subcategory1).filter(Boolean))).sort();
      const subcategories2 = Array.from(new Set(allProducts.map(p => p.subcategory2).filter(Boolean))).sort();
      const subcategories3 = Array.from(new Set(allProducts.map(p => p.subcategory3).filter(Boolean))).sort();
      const calibers = Array.from(new Set(allProducts.map(p => p.caliber).filter(Boolean))).sort();
      const imageSources = Array.from(new Set(allProducts.map(p => p.imageSource).filter(Boolean))).sort();
      const sources = Array.from(new Set(allProducts.map(p => p.source).filter(Boolean))).sort();
      const statuses = Array.from(new Set(allProducts.map(p => p.status).filter(Boolean))).sort();

      res.json({ 
        retailVerticals,
        brands,
        categories,
        subcategories1,
        subcategories2,
        subcategories3,
        calibers,
        imageSources,
        sources,
        statuses
      });
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
      res.status(500).json({ message: "Failed to fetch filter options" });
    }
  });

  // Import endpoints
  app.post('/api/admin/import/preview', requireAdminAuth, csvUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { ImportService } = await import('./import-service');
      const importService = new ImportService();
      
      // Read file content from buffer
      const csvContent = req.file.buffer.toString('utf-8');
      const preview = await importService.previewCSVData(csvContent);
      
      res.json(preview);
    } catch (error) {
      console.error('Import preview error:', error);
      res.status(500).json({ error: 'Failed to preview file' });
    }
  });

  app.post('/api/admin/import/start', requireAdminAuth, csvUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const settings = JSON.parse(req.body.settings);
      const { ImportService } = await import('./import-service');
      const importService = new ImportService();
      
      // Read file content from buffer
      const csvContent = req.file.buffer.toString('utf-8');
      
      // Get the authenticated admin user ID from session, fallback to default admin
      let adminUserId = (req as any).user?.id;
      if (!adminUserId) {
        const { getDefaultAdminUserId } = await import('@shared/import-config');
        adminUserId = await getDefaultAdminUserId();
      }
      
      const jobId = await importService.startImportFromData(
        csvContent,
        req.file.originalname,
        settings,
        adminUserId
      );
      
      res.json({ jobId });
    } catch (error) {
      console.error('Import start error:', error);
      res.status(500).json({ error: 'Failed to start import' });
    }
  });

  app.get('/api/admin/import/jobs', requireAdminAuth, async (req, res) => {
    try {
      const { ImportService } = await import('./import-service');
      const importService = new ImportService();
      const jobs = await importService.getJobs();
      
      res.json(jobs);
    } catch (error) {
      console.error('Import jobs error:', error);
      res.status(500).json({ error: 'Failed to fetch import jobs' });
    }
  });

  app.get('/api/admin/import/status/:jobId', requireAdminAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { ImportService } = await import('./import-service');
      const importService = new ImportService();
      const job = await importService.getJobStatus(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      res.json(job);
    } catch (error) {
      console.error('Import status error:', error);
      res.status(500).json({ error: 'Failed to fetch job status' });
    }
  });

  // Test Sports South API credentials
  app.post("/api/test-sports-south", async (req, res) => {
    try {
      console.log('TESTING SPORTS SOUTH API CREDENTIALS...');
      
      // Get Sports South admin credentials from supportedVendors table
      const sportsSouthSupportedVendor = await storage.getAllSupportedVendors();
      const sportsSouth = sportsSouthSupportedVendor.find(sv => 
        sv.name.toLowerCase().includes('sports south')
      );
      
      if (!sportsSouth?.adminCredentials) {
        return res.json({
          success: false,
          message: 'Sports South admin credentials not configured. Please configure credentials in Admin Panel > Supported Vendors.'
        });
      }
      
      const testCredentials = sportsSouth.adminCredentials;

      const { SportsSouthAPI } = await import('./sports-south-api.js');
      const sportsSouthAPI = new SportsSouthAPI(testCredentials);
      const testResult = await sportsSouthAPI.testConnection();
      
      console.log('SPORTS SOUTH TEST RESULT:', testResult);
      res.json(testResult);
    } catch (error) {
      console.error('Sports South test error:', error);
      res.status(500).json({ 
        success: false, 
        message: `Sports South API test failed: ${error.message}` 
      });
    }
  });

  // Register Sports South schedule routes
  const { registerSportsSouthScheduleRoutes } = await import('./sports-south-schedule-routes');
  registerSportsSouthScheduleRoutes(app);

  // Register Chattanooga schedule routes  
  const { registerChattanoogaScheduleRoutes } = await import('./chattanooga-schedule-routes');
  registerChattanoogaScheduleRoutes(app);

  // Register Lipsey's schedule routes
  const { registerLipseysScheduleRoutes } = await import('./lipseys-schedule-routes');
  registerLipseysScheduleRoutes(app);

  // Sports South Catalog Sync - Full Sync
  app.post("/api/sports-south/catalog/sync-full", async (req, res) => {
    try {
      console.log('SPORTS SOUTH CATALOG: Starting full catalog sync...');
      
      // Get Sports South admin credentials
      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(
        sv => sv.name.toLowerCase().includes('sports south')
      );
      
      if (!sportsSouth?.adminCredentials) {
        return res.json({
          success: false,
          message: 'Sports South admin credentials not configured. Please configure credentials in Admin Panel > Supported Vendors.',
          mappingsCreated: 0,
          errors: ['Admin credentials not configured']
        });
      }
      
      const result = await performSportsSouthCatalogSync(
        sportsSouth.adminCredentials
      );
      
      console.log('SPORTS SOUTH CATALOG: Full sync completed:', result);
      res.json(result);
    } catch (error) {
      console.error('SPORTS SOUTH CATALOG: Full sync failed:', error);
      res.status(500).json({
        success: false,
        message: `Full catalog sync failed: ${error.message}`,
        mappingsCreated: 0,
        errors: [error.message]
      });
    }
  });
  // Sports South - Live Item Test (UPC/SKU) using saved org-level credentials
  app.post("/org/:slug/api/sports-south/test-item", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const { upc, sku } = req.body || {};
      if (!upc && !sku) {
        return res.status(400).json({ success: false, message: 'Provide upc or sku' });
      }

      // Use credential vault for Sports South credentials
      const { credentialVault } = await import('./credential-vault-service');
      const credentials = await credentialVault.getStoreCredentials('sports-south', organizationId, 0);
      if (!credentials) {
        return res.status(404).json({ success: false, message: 'Sports South vendor not configured for this organization' });
      }

      // Normalize saved creds
      const { normalizeSportsSouthCredentials, validateSportsSouthCredentials } = await import('./credential-utils');
      const normalized = normalizeSportsSouthCredentials(credentials);
      const validation = validateSportsSouthCredentials(normalized);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, message: `Missing fields: ${validation.missing.join(', ')}` });
      }

      // Query live item using LookupItem with SearchString; fail on non-200 or empty results
      const { createSportsSouthAPI } = await import('./sports-south-api');
      const api = createSportsSouthAPI(normalized);

      // Try multiple query variants for SearchString (UPC/SKU normalization)
      const raw = (sku || upc).toString().trim();
      const digitsOnly = raw.replace(/[^0-9A-Za-z]/g, '');
      const upc12 = digitsOnly.match(/^\d+$/) ? digitsOnly.padStart(12, '0').slice(-12) : digitsOnly;
      const ean13 = digitsOnly.match(/^\d+$/) ? digitsOnly.padStart(13, '0').slice(-13) : digitsOnly;
      const candidates = Array.from(new Set([raw, digitsOnly, upc12, ean13]));

      const doLookup = async (search: string) => {
        console.log('SPORTS SOUTH LIVE ITEM TEST: Trying SearchString =', search);
        const url = `${(api as any).baseUrl || 'http://webservices.theshootingwarehouse.com/smart'}/inventory.asmx/LookupItem`;
        const params = new URLSearchParams({
          UserName: normalized.userName,
          CustomerNumber: normalized.customerNumber,
          Password: normalized.password,
          Source: normalized.source,
          SearchString: search
        });
        const response = await (api as any).makeRequest(url, params);
        const xmlText = await response.text();
        console.log('SPORTS SOUTH LIVE ITEM TEST: HTTP status =', response.status);
        console.log('SPORTS SOUTH LIVE ITEM TEST: Response preview =', xmlText.substring(0, 300));
        if (!response.ok) return { ok: false, msg: `HTTP ${response.status}: ${response.statusText}` };
        const lower = xmlText.toLowerCase();
        const looksEmpty = !lower.includes('<table') && !lower.includes('<newdataset') && !lower.includes('<string>') && !lower.includes('<newdataset');
        if (lower.includes('invalid') || lower.includes('error') || lower.includes('failed') || lower.includes('unauthorized') || looksEmpty) {
          return { ok: false, msg: 'No results' };
        }
        return { ok: true };
      };

      for (const candidate of candidates) {
        const result = await doLookup(candidate);
        if (result.ok) {
          return res.json({ success: true, message: 'Live item check succeeded' });
        }
      }

      return res.status(404).json({ success: false, message: 'Item not found for provided UPC/SKU' });
    } catch (error: any) {
      console.error('SPORTS SOUTH LIVE ITEM TEST ERROR:', error);
      return res.status(500).json({ success: false, message: error.message || 'Live item test failed' });
    }
  });

  // Delete Sports South imported records (clean up incorrect field mapping data)
  app.delete("/api/sports-south/cleanup", async (req, res) => {
    try {
      console.log('SPORTS SOUTH CLEANUP: Starting deletion of previously imported Sports South records...');
      
      // Step 1: Find Sports South vendor ID
      const sportsSouthVendors = await db
        .select()
        .from(supportedVendors)
        .where(eq(supportedVendors.vendorShortCode, 'sports-south'));
      
      if (sportsSouthVendors.length === 0) {
        return res.json({
          success: true,
          message: 'No Sports South vendor found in system',
          deletedProducts: 0,
          deletedMappings: 0
        });
      }
      
      const sportsSouthVendorId = sportsSouthVendors[0].id;
      console.log(`SPORTS SOUTH CLEANUP: Found Sports South vendor ID: ${sportsSouthVendorId}`);
      
      // Step 2: Delete vendor product mappings for Sports South
      const deletedMappingsResult = await db
        .delete(vendorProductMappings)
        .where(eq(vendorProductMappings.supportedVendorId, sportsSouthVendorId));
      
      const deletedMappings = deletedMappingsResult.rowCount || 0;
      console.log(`SPORTS SOUTH CLEANUP: Deleted ${deletedMappings} vendor product mappings`);
      
      // Step 3: Delete products imported from Sports South (by source)
      const deletedProductsResult = await db
        .delete(products)
        .where(eq(products.source, 'Sports South'));
      
      const deletedProducts = deletedProductsResult.rowCount || 0;
      console.log(`SPORTS SOUTH CLEANUP: Deleted ${deletedProducts} products with source 'Sports South'`);
      
      // Step 4: Also clean up any products with 'Sports South' in imageSource
      const deletedImageSourceResult = await db
        .delete(products)
        .where(eq(products.imageSource, 'Sports South'));
      
      const deletedImageSource = deletedImageSourceResult.rowCount || 0;
      console.log(`SPORTS SOUTH CLEANUP: Deleted ${deletedImageSource} products with imageSource 'Sports South'`);
      
      const totalDeleted = deletedProducts + deletedImageSource;
      
      res.json({
        success: true,
        message: `Successfully cleaned up Sports South data. Ready for re-import with corrected field mappings.`,
        deletedProducts: totalDeleted,
        deletedMappings: deletedMappings,
        details: {
          sourceBasedDeletion: deletedProducts,
          imageSourceDeletion: deletedImageSource,
          vendorMappingDeletion: deletedMappings
        }
      });
      
    } catch (error: any) {
      console.error('SPORTS SOUTH CLEANUP: Error during cleanup:', error);
      res.status(500).json({
        success: false,
        message: 'Error cleaning up Sports South data',
        error: error.message
      });
    }
  });

  // Sports South Pricing Test
  app.get("/api/sports-south/pricing/test", async (req, res) => {
    try {
      console.log('SPORTS SOUTH PRICING: Testing pricing API...');
      
      // Get Sports South admin credentials
      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(
        sv => sv.name.toLowerCase().includes('sports south')
      );
      
      if (!sportsSouth?.adminCredentials) {
        return res.json({
          success: false,
          message: 'Sports South admin credentials not configured. Please configure credentials in Admin Panel > Supported Vendors.',
          sampleData: null
        });
      }
      
      // Create API instance and test pricing
      const { createSportsSouthAPI } = await import('./sports-south-api');
      const api = createSportsSouthAPI(sportsSouth.adminCredentials);
      
      const testResult = await api.testPricingAPI();
      
      console.log('SPORTS SOUTH PRICING: Test completed:', testResult);
      res.json(testResult);
    } catch (error) {
      console.error('SPORTS SOUTH PRICING: Test error:', error);
      res.status(500).json({ 
        success: false, 
        message: `Sports South pricing test failed: ${error.message}`,
        sampleData: null
      });
    }
  });

  // Sports South Real-time Pricing for specific item
  app.get("/api/sports-south/pricing/:itemno", async (req, res) => {
    try {
      const { itemno } = req.params;
      console.log(`SPORTS SOUTH PRICING: Getting pricing for ITEMNO: ${itemno}`);
      
      // Get Sports South admin credentials
      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(
        sv => sv.name.toLowerCase().includes('sports south')
      );
      
      if (!sportsSouth?.adminCredentials) {
        return res.status(400).json({
          success: false,
          message: 'Sports South admin credentials not configured'
        });
      }
      
      // Create API instance and get pricing
      const { createSportsSouthAPI } = await import('./sports-south-api');
      const api = createSportsSouthAPI(sportsSouth.adminCredentials);
      
      const pricingData = await api.getRealTimePricing(itemno);
      
      if (!pricingData) {
        return res.status(404).json({
          success: false,
          message: `No pricing data found for ITEMNO: ${itemno}`
        });
      }
      
      res.json({
        success: true,
        message: `Pricing data retrieved for ${itemno}`,
        data: {
          itemno: pricingData.ITEMNO,
          name: pricingData.IDESC,     // Item Description (from schema)
          upc: pricingData.ITUPC,      // UPC (ACTUAL field name from schema)
          brand: null,                 // No brand name field in schema (only ITBRDNO - numeric ID)
          pricing: {
            catalogPrice: pricingData.PRC1,   // Catalog Price (VENDOR COST - NOT MSRP)
            customerPrice: pricingData.CPRC,  // Customer Price (wholesale cost)
            mapPrice: pricingData.MFPRC,      // MAP - Minimum Advertised Price
            currentStock: pricingData.QTYOH,  // Quantity on hand (ACTUAL field name)
          },
          // Note: Only minimal attributes needed for pricing context
          // Series, categories, and detailed specs belong in product catalog, not pricing API
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error(`SPORTS SOUTH PRICING: Error getting pricing for ${req.params.itemno}:`, error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to get pricing: ${error.message}`
      });
    }
  });

  // Sports South Catalog Info
  app.get("/api/sports-south/catalog/info", async (req, res) => {
    try {
      const supportedVendors = await storage.getAllSupportedVendors();
      const sportsSouth = supportedVendors.find(sv => 
        sv.name.toLowerCase().includes('sports south')
      );
      
      if (!sportsSouth) {
        return res.status(404).json({ error: 'Sports South vendor not found' });
      }
      
      // Get Sports South product count from Master Product Catalog
      const searchResult = await storage.searchProducts('', 'keyword', 1, 1);
      // Note: This is a basic count - in practice you'd want a more specific query
      // for Sports South synced products using the sports_south_itemno field
      
      res.json({
        vendor: {
          name: sportsSouth.name,
          lastCatalogSync: sportsSouth.lastCatalogSync,
          catalogSyncStatus: sportsSouth.catalogSyncStatus || 'never',
          catalogSyncError: sportsSouth.catalogSyncError || null,
          adminConnectionStatus: sportsSouth.adminConnectionStatus || 'offline',
          lastSyncNewRecords: sportsSouth.lastSyncNewRecords || 0,
          lastSyncRecordsUpdated: sportsSouth.lastSyncRecordsUpdated || 0,
          lastSyncRecordsSkipped: sportsSouth.lastSyncRecordsSkipped || 0,
          lastSyncImagesAdded: sportsSouth.lastSyncImagesAdded || 0,
          lastSyncImagesUpdated: sportsSouth.lastSyncImagesUpdated || 0,
          // Schedule fields for automated sync
          sportsSouthScheduleEnabled: sportsSouth.sportsSouthScheduleEnabled || false,
          sportsSouthScheduleTime: sportsSouth.sportsSouthScheduleTime || '14:00',
          sportsSouthScheduleFrequency: sportsSouth.sportsSouthScheduleFrequency || 'daily'
        },
        catalogInfo: {
          totalProducts: searchResult.total,
          lastSyncDate: sportsSouth.lastCatalogSync,
          syncStatus: sportsSouth.catalogSyncStatus || 'never'
        },
        syncStats: {
          newRecords: sportsSouth.lastSyncNewRecords || 0,
          recordsUpdated: sportsSouth.lastSyncRecordsUpdated || 0,
          recordsSkipped: sportsSouth.lastSyncRecordsSkipped || 0,
          imagesAdded: sportsSouth.lastSyncImagesAdded || 0,
          imagesUpdated: sportsSouth.lastSyncImagesUpdated || 0,
          lastSyncTime: sportsSouth.lastCatalogSync
        }
      });
    } catch (error) {
      console.error('SPORTS SOUTH CATALOG: Info fetch failed:', error);
      res.status(500).json({ error: 'Failed to fetch catalog info' });
    }
  });

  // Vendor test connection endpoint
  app.post("/org/:slug/api/vendors/:vendorSlug/test-connection", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const vendorIdentifier = req.params.vendorSlug;
      
      if (!vendorIdentifier || typeof vendorIdentifier !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid vendor identifier' });
      }
      
      // Check queue status and warn if busy
      const { vendorTestConnectionQueue } = await import('./request-queue');
      const queueStatus = vendorTestConnectionQueue.getStatus();
      if (queueStatus.queueLength > 0) {
        console.log(`⏳ TEST CONNECTION: Request queued (${queueStatus.queueLength} ahead in queue)`);
      }
      
      console.log('🔍 TEST CONNECTION: Vendor identifier:', vendorIdentifier, 'for company:', organizationId);
      
      // ✅ FIX: Frontend sends per-org slug like "lipseys-1", we need vendorSlug like "lipseys"
      // Strip the instance suffix (-1, -2, etc.) to get the vendorSlug
      const vendorSlug = vendorIdentifier.replace(/-\d+$/, '');
      console.log('🔍 TEST CONNECTION: Extracted vendorSlug:', vendorSlug);
      
      // Look up the supported vendor first (by vendorSlug)
      const supportedVendor = await storage.getSupportedVendorBySlug(vendorSlug);
      if (!supportedVendor) {
        console.error('🔍 TEST CONNECTION: Supported vendor not found for vendorSlug:', vendorSlug);
        return res.status(404).json({ 
          success: false, 
          message: `Vendor '${vendorIdentifier}' not found in system` 
        });
      }
      
      console.log('🔍 TEST CONNECTION: Found supported vendor:', supportedVendor.name, 'ID:', supportedVendor.id);
      
      // Find the organization's instance of this vendor
      const allCompanyVendors = await storage.getVendorsByCompany(organizationId);
      const vendor = allCompanyVendors.find(v => v.supportedVendorId === supportedVendor.id);
      
      if (!vendor) {
        console.error('🔍 TEST CONNECTION: Company does not have this vendor configured');
        return res.status(404).json({ 
          success: false, 
          message: `Vendor '${supportedVendor.name}' not configured for this organization` 
        });
      }
      
      console.log('🔍 TEST CONNECTION: Found company vendor instance:', vendor.vendorSlug, 'ID:', vendor.id);
      
      // For vendors using company_vendor_credentials table (Bill Hicks, Lipsey's, etc.)
      let testCredentials = vendor.credentials;
      const companyVendorCreds = await storage.getCompanyVendorCredentials(organizationId, vendor.supportedVendorId);
      
      if (supportedVendor.name.toLowerCase().includes('bill hicks') && companyVendorCreds) {
        testCredentials = {
          ftpHost: companyVendorCreds.ftpServer,
          ftpUsername: companyVendorCreds.ftpUsername,
          ftpPassword: companyVendorCreds.ftpPassword,
          ftpPort: companyVendorCreds.ftpPort || 21
        };
      } else if (supportedVendor.name.toLowerCase().includes('lipsey') && companyVendorCreds) {
        testCredentials = {
          email: companyVendorCreds.userName,  // userName maps to email for Lipsey's
          password: companyVendorCreds.password
        };
      } else if (companyVendorCreds) {
        // For other vendors using company_vendor_credentials
        testCredentials = companyVendorCreds;
      }
      
      // Special case: GunBroker uses admin-level shared credentials for all stores
      let testResult;
      if (supportedVendor.name.toLowerCase().includes('gunbroker')) {
        testResult = await vendorRegistry.testVendorConnection('gunbroker', 'admin', undefined, (req as any).user?.id || 0);
      } else {
        // Check if vendor has credentials (allow vendorRegistry to handle if missing)
        if (!testCredentials && !companyVendorCreds) {
          return res.status(400).json({ 
            success: false, 
            message: 'No credentials configured for this vendor' 
          });
        }
        // Test the connection using the vendor registry with store-level credentials
        // Use vendorSlug (immutable identifier) for handler lookup, NOT vendorShortCode (user-editable display name)
        const vendorSlug = supportedVendor.vendorSlug || supportedVendor.name.toLowerCase().replace(/\s+/g, '-');
        
        console.log('VENDOR TEST CONNECTION: Using vendorSlug:', vendorSlug, 'for vendor:', supportedVendor.name);
        
        testResult = await vendorRegistry.testVendorConnection(
          vendorSlug,
          'store',
          organizationId,
          (req as any).user?.id || 0
        );
      }
      
      console.log('VENDOR TEST CONNECTION: Result for', supportedVendor.name, testResult);
      
      // Update vendor status based on test result
      if (testResult.success) {
        await storage.updateVendor(vendor.id, {
          status: 'online',
          lastUpdate: new Date().toISOString(),
        });
        console.log('VENDOR TEST CONNECTION: Updated', supportedVendor.name, 'status to online');
      } else {
        await storage.updateVendor(vendor.id, {
          status: 'offline',
          lastUpdate: new Date().toISOString(),
        });
        console.log('VENDOR TEST CONNECTION: Updated', supportedVendor.name, 'status to offline');
      }
      
      res.json(testResult);
    } catch (error: any) {
      console.error('Vendor test connection error:', error);
      res.status(500).json({ 
        success: false, 
        message: `Connection test failed: ${error.message}` 
      });
    }
  });

  // Test FTP connection for Bill Hicks (special endpoint for FTP testing)
  app.post("/org/:slug/api/vendors/:vendorId/test-ftp-connection", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const vendorIdentifier = req.params.vendorId;
      const { ftpHost, ftpUsername, ftpPassword, ftpPort } = req.body;
      
      console.log(`BILL HICKS FTP TEST: Testing FTP connection for vendor ${vendorIdentifier}`);
      
      // ✅ FIX: Handle both numeric ID and slug format (e.g., "bill-hicks-1")
      let vendorId: number | undefined;
      if (!isNaN(Number(vendorIdentifier))) {
        vendorId = parseInt(vendorIdentifier);
      } else {
        // Lookup vendor by slug
        const allCompanyVendors = await storage.getVendorsByCompany(organizationId);
        const vendor = allCompanyVendors.find(v => v.slug === vendorIdentifier);
        if (vendor) {
          vendorId = vendor.id;
        }
      }
      
      // Basic validation with detailed logging
      console.log('BILL HICKS FTP TEST: Received data:', { 
        vendorId,
        vendorIdentifier,
        ftpHost: ftpHost ? 'PROVIDED' : 'MISSING', 
        ftpUsername: ftpUsername ? 'PROVIDED' : 'MISSING',
        ftpPassword: ftpPassword ? 'PROVIDED' : 'MISSING',
        ftpPort
      });
      
      if (!ftpHost || !ftpUsername || !ftpPassword) {
        const missingFields = [];
        if (!ftpHost) missingFields.push('ftpHost');
        if (!ftpUsername) missingFields.push('ftpUsername');
        if (!ftpPassword) missingFields.push('ftpPassword');
        
        console.log('BILL HICKS FTP TEST: Missing required fields:', missingFields);
        return res.status(400).json({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        });
      }

      // Implement actual FTP connection test using Bill Hicks FTP function
      try {
        console.log('BILL HICKS FTP TEST: Testing actual FTP connection...');
        
        // Parse hostname to extract server and path components
        let ftpServerHost = ftpHost;
        let ftpPath = '/MicroBiz/Feeds';
        
        // First remove any protocol (https:// or http://)
        let cleanHost = ftpHost.replace(/^https?:\/\//, '');
        
        // If the cleanHost contains a path, extract it
        if (cleanHost.includes('/')) {
          const parts = cleanHost.split('/');
          ftpServerHost = parts[0];
          ftpPath = '/' + parts.slice(1).join('/');
          console.log(`BILL HICKS FTP TEST: Parsed hostname: ${ftpServerHost}, path: ${ftpPath}`);
        } else {
          ftpServerHost = cleanHost;
          console.log(`BILL HICKS FTP TEST: Using hostname: ${ftpServerHost}, default path: ${ftpPath}`);
        }
        
        const credentials = {
          ftpServer: ftpServerHost,
          ftpUsername: ftpUsername,
          ftpPassword: ftpPassword,
          ftpPort: ftpPort || 21,
          ftpBasePath: ftpPath
        };
        
        // Use the same FTP client setup as the actual sync
        const { Client: FTPClient } = await import('basic-ftp');
        const client = new FTPClient();
        
        try {
          // Set reasonable timeouts for testing
          client.ftp.timeout = 30000; // 30 seconds
          client.ftp.dataTimeout = 30000; // 30 seconds
          
          // Parse host to remove protocol if present
          const host = credentials.ftpServer.replace(/^https?:\/\//, '');
          
          await client.access({
            host: host,
            user: credentials.ftpUsername,
            password: credentials.ftpPassword,
            secure: false
          });
          
          console.log('BILL HICKS FTP TEST: Successfully connected to FTP server');
          
          // Test navigation to target directory
          try {
            await client.cd(ftpPath);
            console.log(`BILL HICKS FTP TEST: Successfully navigated to ${ftpPath}`);
            
            // List files to verify access
            const files = await client.list();
            console.log('BILL HICKS FTP TEST: Found files:', files.map(f => f.name));
            
            const testResult = {
              success: true,
              message: `FTP connection successful! Connected to ${ftpServerHost} and found ${files.length} files in ${ftpPath}`,
              ftpHost: ftpServerHost,
              filesFound: files.length,
              availableFiles: files.map(f => f.name).slice(0, 5) // Show first 5 files
            };
            
            await client.close();
            return res.json(testResult);
            
          } catch (dirError) {
            console.log(`BILL HICKS FTP TEST: Could not access ${ftpPath}, testing root access`);
            
            const testResult = {
              success: true,
              message: `FTP connection successful! Connected to ${ftpServerHost}. Note: ${ftpPath} directory not accessible, but basic connection works.`,
              ftpHost: ftpServerHost,
              warning: `Could not access ${ftpPath} directory`
            };
            
            await client.close();
            return res.json(testResult);
          }
          
        } catch (ftpError) {
          await client.close();
          throw ftpError;
        }
        
      } catch (connectionError) {
        console.error('BILL HICKS FTP TEST: Connection failed:', connectionError);
        
        const testResult = {
          success: false,
          error: `FTP connection failed: ${connectionError.message}`,
          ftpHost
        };
        
        return res.json(testResult);
      }
    } catch (error: any) {
      console.error('BILL HICKS FTP TEST: Error testing FTP connection:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "FTP connection test failed" 
      });
    }
  });

  // REMOVED: Legacy alternative credentials endpoint - use unified credential management system instead

  // Bill Hicks manual catalog download endpoint
  app.post("/api/vendors/:vendorId/manual-catalog-download", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationVendorId = parseInt(req.params.vendorId);
      const companyId = (req as any).user?.companyId;
      
      console.log(`MANUAL DOWNLOAD: Starting manual catalog download for vendor ${organizationVendorId}, company ${companyId}`);
      
      // Get Bill Hicks supported vendor ID dynamically
      const billHicksVendorId = await storage.getBillHicksVendorId();
      
      // Verify this organization vendor is Bill Hicks by checking its supported vendor ID
      const orgVendor = await storage.getVendor(organizationVendorId);
      if (!orgVendor || orgVendor.supportedVendorId !== billHicksVendorId) {
        return res.status(400).json({ 
          success: false, 
          error: "Manual download is only available for Bill Hicks & Co." 
        });
      }
      
      // Get credentials
      const credentials = await storage.getCompanyVendorCredentials(companyId, billHicksVendorId);
      if (!credentials) {
        return res.status(400).json({ 
          success: false, 
          error: "Bill Hicks credentials not configured" 
        });
      }
      
      // Update sync status to in_progress
      await db.update(companyVendorCredentials)
        .set({ 
          catalogSyncStatus: 'in_progress',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(companyVendorCredentials.companyId, companyId),
            eq(companyVendorCredentials.supportedVendorId, billHicksVendorId)
          )
        );
      
      // Start the manual download process (run in background)
      setImmediate(async () => {
        try {
          const BillHicksAPI = (await import('./bill-hicks-api')).default;
          const billHicksAPI = new BillHicksAPI();
          await billHicksAPI.syncCatalog(companyId);
          console.log('MANUAL DOWNLOAD: Catalog download completed successfully');
        } catch (error) {
          console.error('MANUAL DOWNLOAD: Catalog download failed:', error);
          // Update status to error
          await db.update(companyVendorCredentials)
            .set({ 
              catalogSyncStatus: 'error',
              catalogSyncError: error instanceof Error ? error.message : 'Unknown error',
              updatedAt: new Date()
            })
            .where(
              and(
                eq(companyVendorCredentials.companyId, companyId),
                eq(companyVendorCredentials.supportedVendorId, billHicksVendorId)
              )
            );
        }
      });
      
      res.json({ 
        success: true, 
        message: "Manual catalog download initiated successfully" 
      });
      
    } catch (error: any) {
      console.error('MANUAL DOWNLOAD: Error starting manual download:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to start manual download" 
      });
    }
  });


  // Bill Hicks vendor management endpoints
  
  // Get Bill Hicks credentials for organization - REMOVED
  // Use unified credential management system instead: GET /org/:slug/api/vendors/:vendorId/credentials

  // Update Bill Hicks credentials for organization - REMOVED
  // Use unified credential management system instead: POST /org/:slug/api/vendors/:vendorId/credentials

  // Trigger Bill Hicks sync for organization - REMOVED
  // Use unified vendor sync system instead

  // Get Bill Hicks sync statistics for organization - REMOVED
  // Use unified vendor statistics system instead

  // ========================================
  // PRODUCT CATEGORIES MANAGEMENT API
  // ========================================

  // Get all categories for organization
  app.get("/org/:slug/api/categories", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const categories = await storage.getCategoriesByCompany(organizationId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Create new category
  app.post("/org/:slug/api/categories", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      
      // Auto-generate 'name' from displayName (remove special chars, keep spaces)
      const name = req.body.displayName
        ? req.body.displayName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
        : req.body.name || '';
      
      const categoryData = {
        ...req.body,
        name,
        companyId: organizationId
      };
      
      const newCategory = await storage.createCategory(categoryData);
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error creating category:", error);
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        res.status(400).json({ error: "Category name or slug already exists" });
      } else {
        res.status(500).json({ error: "Failed to create category" });
      }
    }
  });

  // Update category
  app.put("/org/:slug/api/categories/:id", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const categoryId = parseInt(req.params.id);
      
      if (isNaN(categoryId)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }

      // Verify category belongs to organization
      const existingCategory = await storage.getCategory(categoryId);
      if (!existingCategory || existingCategory.companyId !== organizationId) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      // Auto-generate 'name' from displayName if displayName is provided
      const updateData = { ...req.body };
      if (req.body.displayName && !req.body.name) {
        updateData.name = req.body.displayName
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      const updatedCategory = await storage.updateCategory(categoryId, updateData);
      res.json(updatedCategory);
    } catch (error) {
      console.error("Error updating category:", error);
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        res.status(400).json({ error: "Category name or slug already exists" });
      } else {
        res.status(500).json({ error: "Failed to update category" });
      }
    }
  });

  // Delete category with product reassignment
  app.delete("/org/:slug/api/categories/:id", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const categoryId = parseInt(req.params.id);
      const { reassignToId } = req.body;
      
      if (isNaN(categoryId)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }

      // Verify category belongs to organization
      const existingCategory = await storage.getCategory(categoryId);
      if (!existingCategory || existingCategory.companyId !== organizationId) {
        return res.status(404).json({ error: "Category not found" });
      }

      // If reassignToId provided, verify it belongs to same organization
      if (reassignToId) {
        const reassignCategory = await storage.getCategory(reassignToId);
        if (!reassignCategory || reassignCategory.companyId !== organizationId) {
          return res.status(400).json({ error: "Invalid reassignment category" });
        }
      }
      
      await storage.deleteCategory(categoryId, reassignToId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Bulk reorder categories
  app.patch("/org/:slug/api/categories/reorder", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const { categoryIds } = req.body;
      
      if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        return res.status(400).json({ error: "categoryIds array is required" });
      }
      
      // Verify all categories belong to the organization
      const categories = await storage.getCategoriesByCompany(organizationId);
      const categoryMap = new Map(categories.map(cat => [cat.id, cat]));
      
      const invalidIds = categoryIds.filter(id => !categoryMap.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ 
          error: "Some categories do not belong to your organization",
          invalidIds 
        });
      }
      
      // Update sort orders based on new positions
      const updatePromises = categoryIds.map((categoryId, index) => 
        storage.updateCategorySortOrder(categoryId, index)
      );
      
      await Promise.all(updatePromises);
      
      res.json({ 
        success: true, 
        message: `Successfully reordered ${categoryIds.length} categories` 
      });
    } catch (error) {
      console.error("Failed to reorder categories:", error);
      res.status(500).json({ error: "Failed to reorder categories" });
    }
  });

  // Get products count by category (for deletion validation)
  app.get("/org/:slug/api/categories/:id/products-count", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const categoryId = parseInt(req.params.id);
      
      if (isNaN(categoryId)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }

      // Verify category belongs to organization  
      const existingCategory = await storage.getCategory(categoryId);
      if (!existingCategory || existingCategory.companyId !== organizationId) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      const count = await storage.getProductCountByCategory(existingCategory.slug);
      res.json({ count });
    } catch (error) {
      console.error("Error getting products count:", error);
      res.status(500).json({ error: "Failed to get products count" });
    }
  });

  // Model extraction endpoint - fixes missing model data
  app.post('/org/:slug/api/admin/fix-models', requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      console.log('ADMIN: Starting model extraction for organization', organizationId);
      
      // Get products with missing model data
      const productsNeedingModels = await storage.getProductsWithMissingModels();
      console.log(`ADMIN: Found ${productsNeedingModels.length} products needing model extraction`);
      
      let successCount = 0;
      let errorCount = 0;
      const results: any[] = [];
      
      for (const product of productsNeedingModels) {
        try {
          // Import the ModelExtractor
          const { ModelExtractor } = await import('./model-extraction');
          
          // Extract model from product name
          const extractedModel = ModelExtractor.extractModelFromName(
            product.name,
            product.brand || '',
            product.manufacturerPartNumber || ''
          );
          
          if (extractedModel) {
            // Update the product with the extracted model
            await storage.updateProduct(product.id, { model: extractedModel });
            successCount++;
            
            results.push({
              upc: product.upc,
              name: product.name,
              brand: product.brand,
              extractedModel,
              success: true
            });
            
            if (successCount % 100 === 0) {
              console.log(`ADMIN: Processed ${successCount} products so far...`);
            }
          } else {
            errorCount++;
            results.push({
              upc: product.upc,
              name: product.name,
              brand: product.brand,
              extractedModel: null,
              success: false,
              error: 'Could not extract model from name'
            });
          }
        } catch (error: any) {
          errorCount++;
          console.error(`ADMIN: Error processing product ${product.upc}:`, error);
          results.push({
            upc: product.upc,
            name: product.name,
            error: error.message,
            success: false
          });
        }
      }
      
      console.log(`ADMIN: Model extraction complete. Success: ${successCount}, Errors: ${errorCount}`);
      
      res.json({
        success: true,
        message: `Model extraction completed`,
        summary: {
          totalProcessed: productsNeedingModels.length,
          successful: successCount,
          failed: errorCount
        },
        results: results.slice(0, 50) // Return first 50 results for review
      });
      
    } catch (error: any) {
      console.error('ADMIN: Model extraction error:', error);
      res.status(500).json({ 
        success: false, 
        message: `Model extraction failed: ${error.message}` 
      });
    }
  });

  // Manual Bill Hicks full import endpoint
  app.post('/api/admin/bill-hicks/full-import', requireAdminAuth, async (req, res) => {
    try {
      console.log('='.repeat(60));
      console.log('MANUAL TRIGGER: Starting Bill Hicks FULL import (25K products)');
      console.log('='.repeat(60));
      
      const result = await runBillHicksBatchImport();
      
      res.json({
        success: true,
        message: 'Bill Hicks full import completed successfully',
        result
      });
    } catch (error: any) {
      console.error('MANUAL TRIGGER: Bill Hicks full import failed:', error);
      res.status(500).json({
        success: false,
        message: `Full import failed: ${error.message}`
      });
    }
  });

  // Manual Bill Hicks Inventory Sync (Admin) - Uses inventory-only sync
  app.post('/api/admin/bill-hicks/manual-inventory-sync', requireAdminAuth, async (req, res) => {
    try {
      console.log('='.repeat(60));
      console.log('MANUAL TRIGGER: Starting Bill Hicks inventory sync');
      console.log('='.repeat(60));
      
      // Use the inventory-only sync function
      const { runBillHicksInventorySync } = await import('./bill-hicks-simple-sync');
      const result = await runBillHicksInventorySync();
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message || 'Sync failed',
          recordsUpdated: result.stats.recordsUpdated,
          recordsSkipped: result.stats.recordsSkipped,
          recordsFailed: result.stats.recordsErrors,
          totalRecords: result.stats.totalRecords
        });
      }
      
      res.json({
        success: true,
        message: result.message,
        recordsUpdated: result.stats.recordsUpdated,
        recordsSkipped: result.stats.recordsSkipped,
        recordsFailed: result.stats.recordsErrors,
        totalRecords: result.stats.totalRecords,
        lastSync: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('MANUAL TRIGGER: Bill Hicks sync failed:', error);
      res.status(500).json({
        success: false,
        message: `Manual sync failed: ${error.message}`,
        error: error.message,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: 0,
        totalRecords: 0
      });
    }
  });

  // Bill Hicks - Manual Master Catalog Sync (Admin)
  app.post('/api/admin/bill-hicks/manual-master-catalog-sync', requireAdminAuth, async (req, res) => {
    try {
      const { forceFullSync } = req.body;
      
      console.log('='.repeat(60));
      console.log('MANUAL TRIGGER: Starting Bill Hicks MASTER CATALOG sync');
      if (forceFullSync) {
        console.log('🔄 FORCE FULL SYNC MODE REQUESTED');
      }
      console.log('='.repeat(60));
      
      // The runBillHicksSimpleSync function handles all status and statistics updates internally
      const { runBillHicksSimpleSync } = await import('./bill-hicks-simple-sync');
      const result = await runBillHicksSimpleSync(forceFullSync || false);
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      res.json({
        success: true,
        message: result.message,
        totalRecords: result.stats.totalRecords,
        recordsAdded: result.stats.recordsAdded,
        recordsUpdated: result.stats.recordsUpdated,
        recordsSkipped: result.stats.recordsSkipped,
        recordsFailed: result.stats.recordsErrors,
      });
    } catch (error: any) {
      console.error('MANUAL BILL HICKS MASTER CATALOG SYNC: Error:', error);
      
      // The runBillHicksSimpleSync function handles error status updates internally
      res.status(500).json({
        success: false,
        message: error.message || 'Master catalog sync failed'
      });
    }
  });

  // Bill Hicks - Clear Master Catalog Error (Admin)
  app.post('/api/admin/bill-hicks/clear-master-catalog-error', requireAdminAuth, async (req, res) => {
    try {
      console.log('ADMIN: Clearing Bill Hicks master catalog sync error');
      
      // Resolve Bill Hicks vendor robustly; do not 404 if present but ID lookup fails
      const billHicks = await storage.getBillHicksVendor();
      if (!billHicks) {
        const allVendors = await storage.getAllSupportedVendors();
        return res.status(404).json({
          success: false,
          message: 'Bill Hicks vendor not found',
          debug: {
            totalVendors: allVendors.length,
            vendors: allVendors.map(v => ({ id: v.id, name: v.name, shortCode: v.vendorShortCode }))
          }
        });
      }
      
      // Clear the master catalog error
      await storage.updateSupportedVendor(billHicks.id, {
        billHicksMasterCatalogSyncError: null,
        billHicksMasterCatalogSyncStatus: 'never_synced'
      });
      
      res.json({
        success: true,
        message: 'Bill Hicks master catalog sync error cleared successfully'
      });
    
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Bill Hicks clear master catalog error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to clear master catalog error: ${errorMessage}`
      });
    }
  });

  // Bill Hicks - Clear Inventory Error (Admin)
  app.post('/api/admin/bill-hicks/clear-inventory-error', requireAdminAuth, async (req, res) => {
    try {
      console.log('ADMIN: Clearing Bill Hicks inventory sync error');
      
      // Resolve Bill Hicks vendor robustly
      const billHicks = await storage.getBillHicksVendor();
      if (!billHicks) {
        return res.status(404).json({
          success: false,
          message: 'Bill Hicks vendor not found'
        });
      }
      
      // Clear the inventory error
      await storage.updateSupportedVendor(billHicks.id, {
        billHicksInventorySyncError: null,
        billHicksInventorySyncStatus: 'never_synced'
      });
      
      res.json({
        success: true,
        message: 'Bill Hicks inventory sync error cleared successfully'
      });
    
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Bill Hicks clear inventory error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to clear inventory error: ${errorMessage}`
      });
    }
  });

  // Bill Hicks - Update Master Catalog Schedule (Admin)
  app.post('/api/admin/bill-hicks/update-master-catalog-schedule', requireAdminAuth, async (req, res) => {
    try {
      console.log('ADMIN: Updating Bill Hicks master catalog schedule');
      
      const { enabled, syncTime } = req.body;
      
      // Resolve Bill Hicks vendor ID robustly
      let vendorId: number;
      try {
        vendorId = await storage.getBillHicksVendorId();
      } catch (e) {
        return res.status(404).json({
          success: false,
          message: 'Bill Hicks vendor not found'
        });
      }
      
      // Update the master catalog schedule
      const updates: any = {};
      if (enabled !== undefined) {
        updates.billHicksMasterCatalogSyncEnabled = enabled;
      }
      if (syncTime !== undefined) {
        updates.billHicksMasterCatalogSyncTime = syncTime;
      }
      
      await storage.updateSupportedVendor(vendorId, updates);
      
      res.json({
        success: true,
        message: 'Bill Hicks master catalog schedule updated successfully'
      });
    
    } catch (error: unknown) {
      console.error('Error updating Bill Hicks master catalog schedule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update master catalog schedule',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Bill Hicks - Update Inventory Schedule (Admin)
  app.post('/api/admin/bill-hicks/update-inventory-schedule', requireAdminAuth, async (req, res) => {
    try {
      console.log('ADMIN: Updating Bill Hicks inventory schedule');
      
      const { enabled, syncTime } = req.body;
      
      // Resolve Bill Hicks vendor ID robustly
      let vendorId: number;
      try {
        vendorId = await storage.getBillHicksVendorId();
      } catch (e) {
        return res.status(404).json({
          success: false,
          message: 'Bill Hicks vendor not found'
        });
      }
      
      // Update the inventory schedule
      const updates: any = {};
      if (enabled !== undefined) {
        updates.billHicksInventorySyncEnabled = enabled;
      }
      if (syncTime !== undefined) {
        updates.billHicksInventorySyncTime = syncTime;
      }
      
      await storage.updateSupportedVendor(vendorId, updates);
      
      res.json({
        success: true,
        message: 'Bill Hicks inventory schedule updated successfully'
      });
    
    } catch (error: unknown) {
      console.error('Error updating Bill Hicks inventory schedule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update inventory schedule',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Public admin branding endpoint (no authentication required)
  app.get("/api/admin/branding", async (req, res) => {
    try {
      const adminSettings = await storage.getAdminSettings();
      // Only return public branding information
      res.json({ 
        companyName: adminSettings?.companyName || null,
        logoUrl: adminSettings?.logoUrl || null 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get admin branding" });
    }
  });

  // Admin settings routes
  app.get("/api/admin/settings", requireAdminAuth, async (req, res) => {
    try {
      const adminSettings = await storage.getAdminSettings();
      res.json(adminSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch admin settings" });
    }
  });

  app.patch("/api/admin/settings", requireAdminAuth, async (req, res) => {
    try {
      const updates = req.body;
      const adminSettings = await storage.updateAdminSettings(updates);
      if (!adminSettings) {
        return res.status(404).json({ message: "Admin settings not found" });
      }
      res.json(adminSettings);
    } catch (error) {
      console.error('Admin settings update error:', error);
      res.status(500).json({ message: "Failed to update admin settings" });
    }
  });

  // Some hosting environments or proxies may not pass PATCH through reliably.
  // Provide PUT and POST equivalents for robustness.
  app.put("/api/admin/settings", requireAdminAuth, async (req, res) => {
    try {
      const updates = req.body;
      const adminSettings = await storage.updateAdminSettings(updates);
      if (!adminSettings) {
        return res.status(404).json({ message: "Admin settings not found" });
      }
      res.json(adminSettings);
    } catch (error) {
      console.error('Admin settings update error (PUT):', error);
      res.status(500).json({ message: "Failed to update admin settings" });
    }
  });

  app.post("/api/admin/settings", requireAdminAuth, async (req, res) => {
    try {
      const updates = req.body;
      const adminSettings = await storage.updateAdminSettings(updates);
      if (!adminSettings) {
        return res.status(404).json({ message: "Admin settings not found" });
      }
      res.json(adminSettings);
    } catch (error) {
      console.error('Admin settings update error (POST):', error);
      res.status(500).json({ message: "Failed to update admin settings" });
    }
  });

  // Admin logo upload endpoint
  app.post('/api/admin/upload-logo', requireAdminAuth, upload.single('logo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Get the file URL (relative to public directory)
      const logoUrl = `/uploads/${req.file.filename}`;
      
      // Update admin settings with new logo URL
      const updatedSettings = await storage.updateAdminSettings({ logoUrl });
      
      if (!updatedSettings) {
        return res.status(500).json({ error: 'Failed to update admin logo' });
      }
      
      res.json({ 
        logoUrl,
        message: 'Admin logo uploaded successfully' 
      });
      
    } catch (error) {
      console.error('Error uploading admin logo:', error);
      res.status(500).json({ error: 'Failed to upload admin logo' });
    }
  });

  // Admin logo removal endpoint
  app.delete('/api/admin/logo', requireAdminAuth, async (req, res) => {
    try {
      // Update admin settings to remove logo URL
      const updatedSettings = await storage.updateAdminSettings({ logoUrl: null });
      
      if (!updatedSettings) {
        return res.status(500).json({ error: 'Failed to remove admin logo' });
      }
      
      res.json({ 
        message: 'Admin logo removed successfully' 
      });
      
    } catch (error) {
      console.error('Error removing admin logo:', error);
      res.status(500).json({ error: 'Failed to remove admin logo' });
    }
  });

  // Plan settings routes
  app.get("/api/admin/plan-settings", requireAdminAuth, async (req, res) => {
    try {
      const planSettings = await storage.getAllPlanSettings();
      res.json(planSettings);
    } catch (error) {
      console.error('Plan settings fetch error:', error);
      res.status(500).json({ message: "Failed to fetch plan settings" });
    }
  });

  app.post("/api/admin/plan-settings", requireAdminAuth, async (req, res) => {
    try {
      const planData = req.body;
      const newPlan = await storage.createPlanSettings(planData);
      res.json(newPlan);
    } catch (error) {
      console.error('Plan settings create error:', error);
      res.status(500).json({ message: "Failed to create plan settings" });
    }
  });

  app.put("/api/admin/plan-settings/:planId", requireAdminAuth, async (req, res) => {
    try {
      const { planId } = req.params;
      const updates = req.body;
      const updatedPlan = await storage.updatePlanSettings(planId, updates);
      if (!updatedPlan) {
        return res.status(404).json({ message: "Plan settings not found" });
      }
      res.json(updatedPlan);
    } catch (error) {
      console.error('Plan settings update error:', error);
      res.status(500).json({ message: "Failed to update plan settings" });
    }
  });


  // Billing management endpoints for organizations
  app.get("/org/:slug/api/billing/customer-portal", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const company = await storage.getCompany(organizationId);
      
      if (!company?.billingCustomerId) {
        return res.status(400).json({ message: 'No billing customer found' });
      }

      const returnUrl = `${req.protocol}://${req.get('host')}/org/${company.slug}/settings?tab=subscription`;
      const { zohoBillingService } = await import('./zoho-billing-service');
      const portalUrl = await zohoBillingService.generateCustomerPortalUrl(company.billingCustomerId, returnUrl);
      
      res.redirect(portalUrl);
    } catch (error) {
      console.error('Customer portal error:', error);
      res.status(500).json({ message: 'Failed to access customer portal' });
    }
  });

  app.get("/org/:slug/api/billing/invoices", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const company = await storage.getCompany(organizationId);
      
      if (!company?.billingSubscriptionId) {
        return res.status(400).json({ message: 'No billing subscription found' });
      }

      const { zohoBillingService } = await import('./zoho-billing-service');
      const invoices = await zohoBillingService.getInvoices(company.billingSubscriptionId);
      res.json(invoices);
    } catch (error) {
      console.error('Invoice fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch invoices' });
    }
  });

  app.get("/org/:slug/api/billing/payment-methods", requireOrganizationAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const company = await storage.getCompany(organizationId);
      
      if (!company?.billingCustomerId) {
        return res.status(400).json({ message: 'No billing customer found' });
      }

      const returnUrl = `${req.protocol}://${req.get('host')}/org/${company.slug}/settings?tab=subscription`;
      const { zohoBillingService } = await import('./zoho-billing-service');
      const portalUrl = await zohoBillingService.generateCustomerPortalUrl(company.billingCustomerId, returnUrl);
      
      res.redirect(portalUrl);
    } catch (error) {
      console.error('Payment methods error:', error);
      res.status(500).json({ message: 'Failed to access payment methods' });
    }
  });

  // Test endpoint for Zoho Billing credentials
  app.get("/api/admin/test-zoho-billing", requireAdminAuth, async (req, res) => {
    try {
      const { zohoBillingService } = await import('./zoho-billing-service');
      
      console.log('ZOHO BILLING TEST: Starting credential test...');
      
      // Test getting access token
      const accessToken = await zohoBillingService.getAccessToken();
      console.log('ZOHO BILLING TEST: Access token obtained:', accessToken ? 'SUCCESS' : 'FAILED');
      
      // Test getting organization ID
      const organizationId = await zohoBillingService.getOrganizationId();
      console.log('ZOHO BILLING TEST: Organization ID obtained:', organizationId || 'FAILED');
      
      res.json({
        success: true,
        message: 'Zoho Billing credentials test completed',
        results: {
          accessToken: accessToken ? 'Valid' : 'Missing/Invalid',
          organizationId: organizationId || 'Missing',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('ZOHO BILLING TEST: Error testing credentials:', error);
      res.status(500).json({
        success: false,
        message: 'Zoho Billing credentials test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Zoho Billing webhook endpoints
  app.get('/api/webhooks/zoho', (req, res) => {
    res.json({ status: "Platform Zoho Webhook Endpoint Ready", method: "GET" });
  });

  app.post('/api/webhooks/zoho', async (req, res) => {
    const requestId = randomUUID();  // For correlation across logs

    console.log('🚨 WEBHOOK ROUTE HIT:', {
      requestId,
      url: req.originalUrl,
      method: req.method,
      headers: Object.keys(req.headers),
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : []
    });

    try {
      // **CRITICAL SECURITY**: HMAC signature verification to prevent spoofing attacks
      // Get webhook secret from environment variables
      const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET || process.env.ZOHO_BILLING_WEBHOOK_SECRET;
      
      console.log('🔐 SECRET CHECK', {
        requestId,
        hasSecret: !!webhookSecret,
        secretSource: 'env',
        secretLength: webhookSecret?.length,
        secretPrefix: webhookSecret?.substring(0, 4)
      });
      
      if (!webhookSecret) {
        console.error('❌ WEBHOOK SECURITY: No webhook secret configured - rejecting for security', { requestId });
        return res.status(401).json({
          error: 'Webhook authentication not configured',
          code: 'MISSING_WEBHOOK_SECRET',
          requestId
        });
      }
      
      // Get the signature/authorization from headers (Zoho may use various methods)
      // Get signature headers explicitly, handling undefined values
      const zohoSig = req.headers['x-zoho-webhook-signature'];
      const webhookSig = req.headers['x-webhook-signature'];
      const xSig = req.headers['x-signature'];
      const authHeader = req.headers['authorization'];

      console.log('🔍 HEADER DEBUG:', {
        requestId,
        hasZohoSig: !!zohoSig,
        hasWebhookSig: !!webhookSig,
        hasXSig: !!xSig,
        hasAuthHeader: !!authHeader,
        authHeaderValue: authHeader
      });

      // Find the first non-empty signature or authorization
      let signature: string | null = null;
      let authToken: string | null = null;

      if (zohoSig && typeof zohoSig === 'string' && zohoSig.trim() !== '') {
        signature = zohoSig.trim();
      } else if (webhookSig && typeof webhookSig === 'string' && webhookSig.trim() !== '') {
        signature = webhookSig.trim();
      } else if (xSig && typeof xSig === 'string' && xSig.trim() !== '') {
        signature = xSig.trim();
      } else if (authHeader && typeof authHeader === 'string' && authHeader.trim() !== '') {
        // Handle authorization header: "Bearer <token>" or just "<token>"
        const authValue = authHeader.trim();
        console.log('🔍 AUTH HEADER DEBUG:', {
          requestId,
          authHeader: authHeader,
          authValue: authValue,
          startsWithBearer: authValue.startsWith('Bearer ')
        });

        if (authValue.startsWith('Bearer ')) {
          authToken = authValue.substring(7); // Remove "Bearer " prefix
        } else {
          authToken = authValue;
        }

        console.log('🔍 AUTH TOKEN EXTRACTED:', {
          requestId,
          authToken: authToken,
          authTokenLength: authToken?.length,
          authTokenPrefix: authToken?.substring(0, 4)
        });
      }

      const normalizedSignature = signature;
      const normalizedAuthToken = authToken;

      console.log('🔔 ZOHO WEBHOOK RECEIVED', {
        requestId,
        url: req.originalUrl,
        method: req.method,
        bodyKeys: Object.keys(req.body || {}),
        bodyLength: JSON.stringify(req.body || {}).length,
        headers: {
          authorization: req.headers['authorization'] ? 'present' : 'missing',
          'x-zoho-webhook-signature': req.headers['x-zoho-webhook-signature'] ? 'present' : 'missing',
          'x-webhook-signature': req.headers['x-webhook-signature'] ? 'present' : 'missing',
          'x-signature': req.headers['x-signature'] ? 'present' : 'missing'
        },
        authMethod: signature ? 'signature' : authToken ? 'authorization' : 'url_secrecy',
        rawBodyExists: !!(req as any).rawBody,
        rawBodyLength: (req as any).rawBody?.length || 0
      });

      // **ZOHO AUTHENTICATION**: Support both HMAC signature and authorization token methods
      // Zoho webhooks may use HMAC signature, authorization token, OR rely on URL secrecy

      if (!webhookSecret) {
        console.error('❌ WEBHOOK SECURITY: No webhook secret configured - rejecting for security', { requestId });
        return res.status(401).json({
          error: 'Webhook authentication not configured',
          code: 'MISSING_WEBHOOK_SECRET',
          requestId
        });
      }

      // Verify webhook authentication (signature or token)
      if (normalizedSignature) {
        console.log('🔐 WEBHOOK AUTH: Signature provided', { requestId, signatureLength: normalizedSignature.length });
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);

        console.log('🔍 RAW BODY DEBUG:', {
          requestId,
          rawBodyExists: !!(req as any).rawBody,
          rawBodyLength: rawBody.length,
          rawBodyPreview: rawBody.substring(0, 150),
          parsedBody: req.body
        });

        // Verify HMAC signature
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody, 'utf8')
          .digest('hex');

        const isValidSignature = normalizedSignature === expectedSignature;

        console.log('🔍 SIGNATURE DEBUG:', {
          requestId,
          providedSignature: normalizedSignature,
          expectedSignature: expectedSignature,
          rawBodyLength: rawBody.length,
          rawBodyPreview: rawBody.substring(0, 100),
          isValidSignature
        });

        if (!isValidSignature) {
          console.error('❌ WEBHOOK SECURITY: Invalid HMAC signature detected', {
            requestId,
            providedSignature: normalizedSignature,
            expectedSignature: expectedSignature,
            signatureMatch: normalizedSignature === expectedSignature
          });

          return res.status(401).json({
            error: 'Webhook signature verification failed',
            code: 'INVALID_SIGNATURE',
            requestId
          });
        }

        console.log('✅ WEBHOOK SECURITY: HMAC signature verified successfully', { requestId });
      } else if (normalizedAuthToken) {
        // Verify authorization token (Bearer token or plain token)
        console.log('🔐 WEBHOOK AUTH: Authorization token provided', {
          requestId,
          tokenLength: normalizedAuthToken.length,
          tokenPrefix: normalizedAuthToken.substring(0, 4)
        });

        // For authorization tokens, just check if it matches the secret
        const isValidToken = normalizedAuthToken === webhookSecret;

        if (!isValidToken) {
          console.error('❌ WEBHOOK SECURITY: Invalid authorization token', {
            requestId,
            providedToken: normalizedAuthToken,
            expectedToken: webhookSecret,
            tokenMatch: normalizedAuthToken === webhookSecret
          });

          return res.status(401).json({
            error: 'Webhook authorization failed',
            code: 'INVALID_TOKEN',
            requestId
          });
        }

        console.log('✅ WEBHOOK SECURITY: Authorization token verified successfully', { requestId });
      } else {
        // SECURITY: Reject webhooks without proper authentication
        console.error('❌ WEBHOOK SECURITY: No authentication provided - rejecting for security', {
          requestId,
          hasSignature: !!normalizedSignature,
          hasAuthToken: !!normalizedAuthToken,
          message: 'Webhooks must provide either HMAC signature or authorization token'
        });

        return res.status(401).json({
          error: 'Webhook authentication required',
          code: 'MISSING_AUTHENTICATION',
          message: 'Webhooks must provide either x-zoho-webhook-signature or Authorization header',
          requestId
        });
      }
      
      const payload = req.body;

      const subscriptionData = payload.subscription
        || payload.data?.subscription
        || (payload.subscription_id || payload.subscription_number ? payload : null);

      let customerData = payload.customer
        || payload.data?.customer
        || subscriptionData?.customer
        || null;

      const customerId = payload.customer_id
        || payload.data?.customer_id
        || customerData?.customer_id
        || subscriptionData?.customer_id;

      if (!customerData && (customerId || subscriptionData)) {
        customerData = {
          customer_id: customerId || subscriptionData?.customer_id,
          customer_name: subscriptionData?.customer_name || subscriptionData?.customer?.display_name || payload.customer_name,
          email: subscriptionData?.customer_email || subscriptionData?.customer?.email || payload.email,
          company_name: subscriptionData?.company_name || subscriptionData?.customer?.company_name || payload.company_name
        };
      } else if (customerData) {
        customerData = {
          customer_id: customerId || customerData.customer_id,
          customer_name: customerData.customer_name || subscriptionData?.customer_name,
          email: customerData.email || subscriptionData?.customer_email,
          company_name: customerData.company_name || subscriptionData?.company_name,
          ...customerData
        };
      }

      const eventType = subscriptionData ? 'subscription_created' : 'customer_created';
      const eventId = subscriptionData?.subscription_id
        || subscriptionData?.subscription_number
        || customerId
        || randomUUID();

      const normalized = {
        eventType,
        eventId,
        subscription: subscriptionData,
        customer: customerData,
        rawPayload: payload
      };
      
      console.log('🔍 WEBHOOK NORMALIZED', {
        requestId,
        eventType: normalized.eventType,
        eventId: normalized.eventId,
        hasSubscription: !!normalized.subscription,
        hasCustomer: !!normalized.customer,
        subscriptionId: normalized.subscription?.subscription_id,
        customerId: normalized.customer?.customer_id
      });
      
      // **RESPOND IMMEDIATELY**: Acknowledge webhook receipt to prevent timeout
      // Process the webhook asynchronously in the background
      res.status(200).json({ 
        status: "accepted", 
        message: "Webhook received and will be processed",
        requestId,
        eventId: normalized.eventId
      });
      
      console.log('✅ WEBHOOK ACKNOWLEDGED - Now processing asynchronously', { requestId });
      
      // Process webhook asynchronously (don't await - let it run in background)
      // This prevents Zoho from timing out while we do database operations, send emails, etc.
      (async () => {
        try {
          console.log('📦 IMPORTING BillingService...', { requestId });
          
          // Import and use BillingService for clean architecture
          const { BillingService } = await import('./billing-service');
          
          console.log('✅ BillingService imported, creating instance...', { requestId });
          const billingService = new BillingService();
          
          console.log('✅ BillingService instance created, calling processZohoWebhook...', { requestId });
          
          await billingService.processZohoWebhook(normalized);
          console.log('✅ WEBHOOK PROCESSING COMPLETED', { requestId, eventId: normalized.eventId });
        } catch (processingError) {
          console.error('❌ WEBHOOK PROCESSING FAILED (ASYNC)', {
            requestId,
            eventId: normalized.eventId,
            error: processingError instanceof Error ? processingError.message : String(processingError),
            stack: processingError instanceof Error ? processingError.stack : undefined,
            subscriptionId: normalized.subscription?.subscription_id,
            customerId: normalized.customer?.customer_id
          });
          
          // Log to database for monitoring
          try {
            const { BillingService } = await import('./billing-service');
            const billingService = new BillingService();
            await billingService.logBillingEvent({
              eventType: 'webhook_processing_failed',
              eventId: normalized.eventId || 'unknown',
              billingProvider: 'zoho',
              data: { 
                error: processingError instanceof Error ? processingError.message : String(processingError),
                originalPayload: normalized.rawPayload 
              }
            });
          } catch (loggingError) {
            console.error('❌ Failed to log webhook processing error:', loggingError);
          }
        }
      })();
    } catch (error: any) {
      console.error('🚨 ZOHO WEBHOOK ERROR (OUTER CATCH):', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        fullError: String(error)
      });
      res.status(500).json({ error: error.message });
    }
  });

  // Test email delivery using current admin settings (SendGrid or SMTP2GO)
  app.post('/api/test-email', requireAdminAuth, async (req, res) => {
    try {
      const { email, provider } = req.body || {};
      if (!email) {
        return res.status(400).json({ success: false, message: 'Missing email address' });
      }

      const adminSettings = await storage.getAdminSettings();
      
      // Import email service functions
      const { sendEmailViaSendGrid, sendEmailViaSMTP2GO } = await import('./email-service');

      const testEmailContent = {
        to: email,
        subject: 'Test Email - Admin Settings',
        html: `<p>This is a test email from Admin Settings. Your ${provider || 'email'} configuration is working.</p>`
      };

      let success = false;
      let message = '';

      if (provider === 'sendgrid') {
        if (!adminSettings?.sendgridApiKey) {
          return res.status(400).json({ success: false, message: 'SendGrid API key not configured in Admin Settings' });
        }
        success = await sendEmailViaSendGrid(testEmailContent, adminSettings);
        message = success ? 'Test email sent successfully via SendGrid' : 'SendGrid failed to send test email';
      } else if (provider === 'smtp2go') {
        if (!adminSettings?.smtp2goApiKey) {
          return res.status(400).json({ success: false, message: 'SMTP2GO API key not configured in Admin Settings' });
        }
        success = await sendEmailViaSMTP2GO(testEmailContent, adminSettings);
        message = success ? 'Test email sent successfully via SMTP2GO' : 'SMTP2GO failed to send test email';
      } else {
        return res.status(400).json({ success: false, message: 'Invalid provider. Use "sendgrid" or "smtp2go"' });
      }

      if (success) {
        res.json({ success: true, message });
      } else {
        res.status(500).json({ success: false, message });
      }
    } catch (error: any) {
      console.error('Test email error:', error);
      res.status(500).json({ success: false, message: `Email test error: ${error.message}` });
    }
  });

  // Admin webhook replay endpoint for testing and fixing failed webhooks
  app.post('/api/admin/billing/zoho/replay', requireAdminAuth, async (req, res) => {
    try {
      console.log('🔄 WEBHOOK REPLAY: Admin webhook replay initiated by', req.user?.username);
      
      const { payload, payloads } = req.body;
      
      if (!payload && !payloads) {
        return res.status(400).json({ 
          error: 'Either "payload" object or "payloads" array is required' 
        });
      }
      
      // Normalize to array
      const webhookPayloads = payloads || [payload];
      
      if (!Array.isArray(webhookPayloads)) {
        return res.status(400).json({ 
          error: 'Invalid format: payloads must be an array' 
        });
      }
      
      console.log(`🔄 WEBHOOK REPLAY: Processing ${webhookPayloads.length} payload(s)`);
      
      // Import and use BillingService 
      const { BillingService } = await import('./billing-service');
      const billingService = new BillingService();
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < webhookPayloads.length; i++) {
        const webhookPayload = webhookPayloads[i];
        console.log(`🔄 WEBHOOK REPLAY: Processing payload ${i + 1}/${webhookPayloads.length}`);
        
        try {
          await billingService.processZohoWebhook(webhookPayload);
          results.push({ 
            index: i, 
            status: 'success',
            customerID: webhookPayload.customer_id || webhookPayload.data?.customer?.customer_id || webhookPayload.subscription?.customer_id || 'unknown'
          });
          successCount++;
          console.log(`✅ WEBHOOK REPLAY: Payload ${i + 1} processed successfully`);
        } catch (error: any) {
          results.push({ 
            index: i, 
            status: 'error', 
            error: error.message,
            customerID: webhookPayload.customer_id || webhookPayload.data?.customer?.customer_id || webhookPayload.subscription?.customer_id || 'unknown'
          });
          errorCount++;
          console.error(`❌ WEBHOOK REPLAY: Payload ${i + 1} failed:`, error.message);
        }
      }
      
      console.log(`🔄 WEBHOOK REPLAY: Completed - ${successCount} success, ${errorCount} errors`);
      
      res.status(200).json({ 
        message: `Webhook replay completed`,
        summary: {
          total: webhookPayloads.length,
          successful: successCount,
          failed: errorCount
        },
        results
      });
      
    } catch (error: any) {
      console.error('❌ WEBHOOK REPLAY ERROR:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual subscription sync endpoint for importing missing subscriptions from Zoho
  app.post('/api/admin/sync-subscription/:subscriptionId', requireAdminAuth, async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      
      if (!subscriptionId) {
        return res.status(400).json({ 
          error: 'Subscription ID is required' 
        });
      }

      console.log('🔄 ADMIN SUBSCRIPTION SYNC: Manual sync initiated by', req.user?.username, 'for subscription', subscriptionId);
      
      // Import and use BillingService for subscription sync
      const { BillingService } = await import('./billing-service');
      const billingService = new BillingService();
      
      const result = await billingService.syncSubscriptionFromZoho(subscriptionId);
      
      if (result.success) {
        console.log('✅ ADMIN SUBSCRIPTION SYNC: Completed successfully');
        res.status(200).json({
          success: true,
          message: result.message,
          details: result.details
        });
      } else {
        console.error('❌ ADMIN SUBSCRIPTION SYNC: Failed -', result.message);
        res.status(400).json({
          success: false,
          message: result.message,
          details: result.details
        });
      }
      
    } catch (error: any) {
      console.error('❌ ADMIN SUBSCRIPTION SYNC ERROR:', error);
      res.status(500).json({ 
        success: false,
        message: 'Internal server error during subscription sync',
        error: error.message 
      });
    }
  });

  // OAuth callback endpoint for Zoho authorization
  app.get('/api/zoho/callback', async (req, res) => {
    try {
      const authorizationCode = req.query.code as string;
      
      if (!authorizationCode) {
        return res.status(400).send(`
          <h1>OAuth Error</h1>
          <p>No authorization code received from Zoho.</p>
          <p>Please try the authorization process again.</p>
        `);
      }

      // Display the authorization code for manual exchange
      res.send(`
        <h1>🎉 OAuth Authorization Successful!</h1>
        <p><strong>Your Authorization Code:</strong></p>
        <code style="background: #f0f0f0; padding: 10px; display: block; margin: 10px 0; word-break: break-all; font-family: monospace;">
          ${authorizationCode}
        </code>
        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Copy the authorization code above</li>
          <li>Return to your conversation with the agent</li>
          <li>Provide the authorization code to complete the integration</li>
        </ol>
        <hr>
        <p><small>This page is generated by your Replit app OAuth callback endpoint.</small></p>
      `);

      console.log('ZOHO OAUTH: Received authorization code:', authorizationCode);

    } catch (error) {
      console.error('OAUTH CALLBACK ERROR:', error);
      res.status(500).send(`
        <h1>OAuth Error</h1>
        <p>An error occurred processing the OAuth callback.</p>
        <p>Error: ${error}</p>
      `);
    }
  });

  // Debug endpoint to check webhook processing
  app.get('/api/debug/zoho-subscriptions', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Endpoint not available in production' });
    }
    
    try {
      const companies = await storage.getAllCompanies();
      const zohoCompanies = companies.filter(c => c.billingProvider === 'zoho');
      
      res.json({
        total_companies: companies.length,
        zoho_companies: zohoCompanies.length,
        zoho_subscriptions: zohoCompanies.map(c => ({
          id: c.id,
          name: c.name,
          plan: c.plan,
          status: c.status,
          billingCustomerId: c.billingCustomerId,
          billingSubscriptionId: c.billingSubscriptionId,
          createdAt: c.createdAt
        })),
        all_companies: companies.map(c => ({
          id: c.id,
          name: c.name,
          plan: c.plan,
          status: c.status,
          billingProvider: c.billingProvider,
          billingSubscriptionId: c.billingSubscriptionId
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test manual subscription creation
  app.post('/api/test-subscription-creation', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Endpoint not available in production' });
    }
    
    try {
      console.log('TESTING MANUAL SUBSCRIPTION CREATION');
      
      // Use the actual webhook data from Johnson's Firearms
      const testSubscription = {
        subscription_number: "SUB-00055",
        subscription_id: "SUB-00055",
        customer_id: "4899864000001444265",
        plan: {
          plan_code: "free-plan-v1"
        }
      };
      
      const testCustomer = {
        display_name: "Johnson's Firearms",
        company_name: "Johnson's Firearms",
        customer_id: "4899864000001444265"
      };
      
      console.log('CALLING handleSubscriptionCreated...');
      await handleSubscriptionCreated(testSubscription, testCustomer);
      
      res.json({
        success: true,
        message: 'Manual subscription creation completed',
        subscription: testSubscription,
        customer: testCustomer
      });
      
    } catch (error) {
      console.error('MANUAL SUBSCRIPTION CREATION ERROR:', error);
      res.status(500).json({
        error: 'Manual subscription creation failed',
        message: error.message
      });
    }
  });

  // Test Zoho Billing API integration
  app.post('/api/test-zoho-billing', async (req, res) => {
    // Block in production environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Endpoint not available in production' });
    }
    
    try {
      console.log('TESTING ZOHO BILLING API INTEGRATION');
      const { zohoBilling } = await import('./zoho-billing-service');
      
      const testResults = {
        timestamp: new Date().toISOString(),
        credentials: {
          hasAccessToken: !!process.env.ZOHO_BILLING_ACCESS_TOKEN,
          hasOrgId: !!process.env.ZOHO_BILLING_ORG_ID,
          hasClientId: !!process.env.ZOHO_BILLING_CLIENT_ID,
          hasClientSecret: !!process.env.ZOHO_BILLING_CLIENT_SECRET,
          hasRefreshToken: !!process.env.ZOHO_BILLING_REFRESH_TOKEN
        },
        tests: {}
      };

      // Test 1: Create test customer
      try {
        const testCustomer = await zohoBilling.createCustomer({
          display_name: `Test Customer ${Date.now()}`,
          email: `test-${Date.now()}@example.com`,
          company_name: 'Test Company'
        });
        testResults.tests.createCustomer = {
          success: true,
          customerId: testCustomer.customer_id,
          message: 'Customer created successfully'
        };
      } catch (error) {
        testResults.tests.createCustomer = {
          success: false,
          error: error.message
        };
      }

      // Test 2: Generate hosted payment page (will use fallback if no customer created)
      try {
        const paymentPageUrl = await zohoBilling.generateHostedPaymentPageUrl(
          testResults.tests.createCustomer?.customerId || 'test-customer',
          'standard-plan-v1',
          'https://workspace--kevinkogler.replit.app/subscription/success',
          'https://workspace--kevinkogler.replit.app/subscription/cancelled'
        );
        testResults.tests.hostedPaymentPage = {
          success: true,
          url: paymentPageUrl,
          message: 'Payment page URL generated'
        };
      } catch (error) {
        testResults.tests.hostedPaymentPage = {
          success: false,
          error: error.message
        };
      }

      // Test 3: Generate customer portal URL
      try {
        const portalUrl = await zohoBilling.generateCustomerPortalUrl(
          testResults.tests.createCustomer?.customerId || 'test-customer',
          'https://workspace--kevinkogler.replit.app/subscription/portal'
        );
        testResults.tests.customerPortal = {
          success: true,
          url: portalUrl,
          message: 'Customer portal URL generated'
        };
      } catch (error) {
        testResults.tests.customerPortal = {
          success: false,
          error: error.message
        };
      }

      res.json(testResults);
      
    } catch (error) {
      console.error('ZOHO BILLING TEST ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to test Zoho Billing integration',
        message: error.message 
      });
    }
  });

  // Test subscription limits endpoint
  app.post('/api/test-subscription-limits', async (req, res) => {
    try {
      const { companyId, action } = req.body;
      const { validateSubscriptionLimits } = await import('./subscription-gates');
      
      const result = await validateSubscriptionLimits(companyId, action);
      res.json({
        companyId,
        action,
        allowed: result.allowed,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Test subscription limits error:', error);
      res.status(500).json({ message: 'Failed to test subscription limits' });
    }
  });

  // Webhook diagnostics endpoint - check webhook processing status
  app.get('/api/webhook-diagnostics', async (req, res) => {
    try {
      const { db } = await import('./db');
      const { companies, subscriptions, billingEvents } = await import('../shared/schema');
      const { eq, desc } = await import('drizzle-orm');
      
      // Get recent billing events
      const recentEvents = await db
        .select()
        .from(billingEvents)
        .orderBy(desc(billingEvents.createdAt))
        .limit(10);
      
      // Get all companies with billing info
      const companiesWithBilling = await db
        .select()
        .from(companies)
        .where(eq(companies.billingProvider, 'zoho'))
        .limit(20);
      
      res.json({
        success: true,
        diagnostics: {
          recentBillingEvents: recentEvents.length,
          companiesWithZohoBilling: companiesWithBilling.length,
          recentEvents: recentEvents.map(e => ({
            eventType: e.eventType,
            eventId: e.eventId,
            processed: e.processed,
            createdAt: e.createdAt
          })),
          companies: companiesWithBilling.map(c => ({
            name: c.name,
            billingCustomerId: c.billingCustomerId,
            billingSubscriptionId: c.billingSubscriptionId
          }))
        }
      });
      
    } catch (error: any) {
      console.error('Webhook diagnostics error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint to verify webhook fixes are deployed
  app.get('/api/webhook-fixes-deployed', async (req, res) => {
    try {
      const adminSettings = await storage.getAdminSettings();
      
      res.json({
        success: true,
        deployment_status: "Webhook fixes deployed",
        fixes_included: [
          "Enhanced customer ID extraction with 4 fallback paths",
          "Removed early exits in handleSubscriptionCreated",
          "Fallback company creation logic",
          "Fixed email domains to pricecomparehub.com",
          "Enhanced error handling and logging"
        ],
        config_status: {
          smtp2go_configured: !!adminSettings?.smtp2goApiKey,
          system_email_configured: !!adminSettings?.systemEmail,
          support_email_configured: !!adminSettings?.supportEmail,
          zoho_webhook_secret_configured: !!process.env.ZOHO_WEBHOOK_SECRET
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message,
        deployment_status: "Error checking deployment status"
      });
    }
  });

  // Test Zoho webhook for development
  app.post('/api/test-zoho-webhook', async (req, res) => {
    // Block in production environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Endpoint not available in production' });
    }
    try {
      console.log('TEST ZOHO WEBHOOK TRIGGERED');
      
      // Mock Zoho Billing webhook payload
      const testWebhookData = {
        event_type: 'subscription_created',
        data: {
          subscription: {
            subscription_number: req.body.subscription_number || `SUB-${String(Date.now()).slice(-5)}`,
            subscription_id: req.body.subscription_id || `TEST-${Date.now()}`,
            customer_id: `CUST-${Date.now()}`,
            plan: {
              plan_code: req.body.planCode || 'standard-plan-v1',
              price: req.body.planCode === 'enterprise-plan-v1' ? 299 : req.body.planCode === 'standard-plan-v1' ? 99 : 0
            },
            customer: {
              display_name: req.body.organizationName,
              company_name: req.body.organizationName, 
              email: req.body.email,
              first_name: req.body.firstName,
              last_name: req.body.lastName
            },
            next_billing_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      };
      
      console.log('TEST WEBHOOK DATA:', JSON.stringify(testWebhookData, null, 2));
      
      // Process the webhook exactly like the real handler
      const subscription = testWebhookData.data.subscription;
      const customer = subscription.customer;
      
      const orgName = customer.display_name || customer.company_name || `Customer-${subscription.customer_id}`;
      const orgSlug = orgName.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);

      // Check if organization already exists
      const existingOrg = await storage.getCompanyBySlug?.(orgSlug);
      if (existingOrg) {
        return res.status(200).json({ status: 'organization_exists', organization: existingOrg });
      }

      // Map plan codes to subscription tiers
      const planMapping: Record<string, string> = {
        'free-plan-v1': 'free',
        'standard-plan-v1': 'standard', 
        'enterprise-plan-v1': 'enterprise'
      };
      
      const planCode = subscription.plan?.plan_code || 'free-plan-v1';
      const subscriptionTier = planMapping[planCode] || 'free';

      // Create new organization
      const orgData = {
        name: orgName,
        slug: orgSlug,
        plan: subscriptionTier,
        status: 'active',
        email: customer.email || `admin@${orgSlug}.com`,
        phone: customer.phone || null,
        billingProvider: 'zoho',
        billingCustomerId: subscription.customer_id,
        billingSubscriptionId: subscription.subscription_number || subscription.subscription_id,
        maxUsers: subscriptionTier === 'enterprise' ? 100 : subscriptionTier === 'standard' ? 25 : 5,
        maxVendors: subscriptionTier === 'enterprise' ? 999 : subscriptionTier === 'standard' ? 6 : 3,
        features: subscriptionTier === 'enterprise' ? 
          { apiAccess: true, advancedAnalytics: true, orderProcessing: true, asnProcessing: true } : 
          subscriptionTier === 'standard' ?
          { apiAccess: true, advancedAnalytics: true, orderProcessing: false, asnProcessing: false } :
          { apiAccess: false, advancedAnalytics: false, orderProcessing: false, asnProcessing: false },
        settings: { timezone: "America/New_York", currency: "USD" },
      };

      const newOrg = await storage.createCompany(orgData);
      
      // Create subscription record
      await storage.createSubscription({
        companyId: newOrg.id,
        externalSubscriptionId: subscription.subscription_number || subscription.subscription_id,
        externalCustomerId: subscription.customer_id,
        externalSubscriptionNumber: subscription.subscription_number,
        planId: planCode,
        status: 'active',
        billingProvider: 'zoho',
        currentPeriodStart: new Date(),
        currentPeriodEnd: subscription.next_billing_at ? new Date(subscription.next_billing_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: subscription.plan?.price?.toString() || (subscriptionTier === 'enterprise' ? '299' : subscriptionTier === 'standard' ? '99' : '0'),
        currency: 'USD',
        cancelAtPeriodEnd: false, // Default to false for new subscriptions
        autoRenew: true // Default to true for new subscriptions
      });

      // Create admin user if email provided
      if (customer.email) {
        const tempPassword = Math.random().toString(36).slice(-12);
        
        const adminUser = await storage.createUser({
          username: customer.email.split('@')[0] || 'admin',
          email: customer.email,
          password: Buffer.from(tempPassword).toString('base64'),
          companyId: newOrg.id
        });
        
        console.log('TEST USER CREATED:', adminUser.username);
      }

      res.status(200).json({ 
        status: 'success', 
        organization: newOrg,
        message: `Test organization "${orgName}" created successfully with ${subscriptionTier} plan`
      });
    } catch (error: any) {
      console.error('TEST WEBHOOK ERROR:', error);
      res.status(500).json({ error: error.message });
    }
  });



  // Test FullTextSearch endpoint
  app.post("/api/admin/sports-south/test-fulltext-search", requireAdminAuth, async (req, res) => {
    try {
      console.log('ADMIN: Testing Sports South FullTextSearch endpoint...');
      
      const { SportsSouthAPI } = await import('./sports-south-api');
      const { searchTerm = '*', brandId = 0, categoryId = 0 } = req.body;
      
      // Use the same approach as working bulk update service
      const allVendors = await storage.getAllSupportedVendors();
      console.log('ADMIN: All configured vendors:', allVendors.map(v => ({ id: v.id, name: v.name, hasAdminCredentials: !!v.adminCredentials })));
      
      // Find Sports South vendor (case-insensitive, like working bulk update service)
      const sportsSouth = allVendors.find(sv => 
        sv.name.toLowerCase().includes('sports south')
      );
      
      if (!sportsSouth) {
        return res.status(400).json({
          success: false,
          message: 'Sports South vendor not found. Available vendors: ' + allVendors.map(v => v.name).join(', ')
        });
      }
      
      console.log('ADMIN: Found Sports South vendor:', sportsSouth.name, 'Has admin credentials:', !!sportsSouth.adminCredentials);
      
      // Use adminCredentials like the working bulk update service
      if (!sportsSouth.adminCredentials) {
        return res.status(400).json({
          success: false,
          message: `Sports South admin credentials not configured for vendor "${sportsSouth.name}"`
        });
      }
      
      const api = new SportsSouthAPI(sportsSouth.adminCredentials as any);
      
      // Test the FullTextSearch endpoint
      const results = await api.testFullTextSearch(searchTerm, brandId, categoryId);
      
      console.log('ADMIN: FullTextSearch test completed:', {
        resultCount: results.length,
        searchTerm,
        brandId,
        categoryId,
        sampleResult: results[0] || null
      });
      
      const withSHDESC = results.filter(r => r.SHDESC && r.SHDESC.trim());
      
      res.json({
        success: true,
        message: `FullTextSearch test completed`,
        resultCount: results.length,
        searchTerm,
        brandId,
        categoryId,
        sampleResult: results[0] || null,
        hasSHDESC: withSHDESC.length > 0,
        shdescCount: withSHDESC.length,
        availableFields: results[0]?.availableFields || []
      });
    } catch (error: any) {
      console.error('ADMIN: FullTextSearch test failed:', error);
      res.status(500).json({ 
        success: false,
        message: `FullTextSearch test failed: ${error.message}`
      });
    }
  });




  // Test Sports South DailyItemUpdate for specific UPC/SKU
  app.post("/api/admin/sports-south/test-daily-item-update", requireAdminAuth, async (req, res) => {
    try {
      const { upc, sku } = req.body;
      
      if (!upc && !sku) {
        return res.status(400).json({
          success: false,
          message: 'Either UPC or SKU parameter is required'
        });
      }

      console.log(`ADMIN: Testing Sports South DailyItemUpdate for UPC: ${upc}, SKU: ${sku}`);
      
      const { SportsSouthAPI } = await import('./sports-south-api');
      
      // Get Sports South credentials
      const allVendors = await storage.getAllSupportedVendors();
      const sportsSouth = allVendors.find(sv => 
        sv.name.toLowerCase().includes('sports south')
      );

      if (!sportsSouth || !sportsSouth.adminCredentials) {
        return res.status(500).json({
          success: false,
          message: 'Sports South vendor or credentials not found'
        });
      }

      const api = new SportsSouthAPI(sportsSouth.adminCredentials as any);
      
      // Test connection first
      const testResult = await api.testConnection();
      if (!testResult.success) {
        return res.status(500).json({
          success: false,
          message: `Sports South API connection failed: ${testResult.message}`
        });
      }

      // Get full catalog and find the specific product
      const catalog = await api.getCatalogUpdates(); // Get full catalog
      
      // Find the product by UPC or SKU
      const targetProduct = catalog.find(product => {
        const matchesUpc = upc && product.ITUPC && product.ITUPC === upc;
        const matchesSku = sku && product.ITEMNO && product.ITEMNO === sku;
        return matchesUpc || matchesSku;
      });

      if (!targetProduct) {
        return res.status(404).json({
          success: false,
          message: `Product not found in Sports South catalog`,
          searchCriteria: { upc, sku },
          catalogSize: catalog.length
        });
      }

      console.log(`ADMIN: Found product in catalog:`, {
        ITEMNO: targetProduct.ITEMNO,
        IDESC: targetProduct.IDESC,
        ITUPC: targetProduct.ITUPC,
        TXTREF: targetProduct.TXTREF // This might contain SHDESC in some cases
      });
      
      res.json({
        success: true,
        product: {
          ITEMNO: targetProduct.ITEMNO,
          IDESC: targetProduct.IDESC || 'Not found',
          SHDESC: targetProduct.TXTREF || 'Not found', // SHDESC might be in TXTREF
          ITUPC: targetProduct.ITUPC,
          allFields: targetProduct
        },
        searchCriteria: { upc, sku },
        catalogSize: catalog.length
      });

    } catch (error: any) {
      console.error(`ADMIN: Sports South DailyItemUpdate test failed:`, error);
      res.status(500).json({ 
        success: false,
        message: `DailyItemUpdate test failed: ${error.message}`,
        searchCriteria: { upc: req.body.upc, sku: req.body.sku }
      });
    }
  });




  // ========================================
  // SUBSCRIPTION STATUS MANAGEMENT ROUTES
  // ========================================

  // Get subscription status for current organization
  app.get('/org/:slug/api/subscription/status', requireOrganizationAccess, async (req, res) => {
    try {
      const orgId = req.organizationId!;
      const company = await storage.getCompany(orgId);
      
      if (!company) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const now = new Date();
      const trialDaysRemaining = company.trialEndsAt ? 
        Math.max(0, Math.ceil((company.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

      const subscriptionStatus = {
        status: company.status,
        trialStatus: company.trialStatus,
        plan: company.plan,
        trialEndsAt: company.trialEndsAt,
        trialDaysRemaining,
        features: company.features,
        limits: {
          maxUsers: company.maxUsers,
          maxVendors: company.maxVendors
        },
        billingProvider: company.billingProvider
      };

      res.json(subscriptionStatus);
    } catch (error) {
      console.error('GET SUBSCRIPTION STATUS ERROR:', error);
      res.status(500).json({ error: 'Failed to get subscription status' });
    }
  });

  // User: Request subscription cancellation
  app.post('/org/:slug/api/subscription/cancel', requireOrganizationAccess, async (req, res) => {
    try {
      const orgId = req.organizationId!;
      const company = await storage.getCompany(orgId);
      
      if (!company) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      await storage.updateCompany(orgId, {
        status: 'cancelled',
        updatedAt: new Date()
      });

      console.log(`SUBSCRIPTION: User cancelled subscription for ${company.name}`);
      
      res.json({
        message: 'Subscription cancelled successfully',
        status: 'cancelled',
        effectiveDate: new Date()
      });
    } catch (error) {
      console.error('CANCEL SUBSCRIPTION ERROR:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  });

  // Admin: Update subscription status
  app.patch('/api/admin/organizations/:id/subscription', requireAdminAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { status, trialStatus, trialEndsAt, plan, reason } = req.body;

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const updates: any = { updatedAt: new Date() };
      
      if (status) updates.status = status;
      if (trialStatus) updates.trialStatus = trialStatus;
      if (trialEndsAt) updates.trialEndsAt = new Date(trialEndsAt);
      if (plan) updates.plan = plan;

      await storage.updateCompany(companyId, updates);

      console.log(`ADMIN: Updated subscription for ${company.name} - Status: ${status}, Reason: ${reason}`);
      
      res.json({
        message: 'Subscription updated successfully',
        company: {
          id: companyId,
          name: company.name,
          status: status || company.status,
          trialStatus: trialStatus || company.trialStatus,
          plan: plan || company.plan
        }
      });
    } catch (error) {
      console.error('ADMIN UPDATE SUBSCRIPTION ERROR:', error);
      res.status(500).json({ error: 'Failed to update subscription' });
    }
  });

  // Get Zoho hosted payment page URL for upgrades
  app.post('/org/:slug/api/billing/upgrade-url', requireOrganizationAccess, async (req, res) => {
    try {
      const orgId = req.organizationId!;
      const { planCode } = req.body;

      const company = await storage.getCompany(orgId);
      if (!company) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const { zohoBilling } = await import('./zoho-billing-service');
      const returnUrl = `${req.protocol}://${req.get('host')}/org/${company.slug}/billing/success`;
      const cancelUrl = `${req.protocol}://${req.get('host')}/org/${company.slug}/billing/cancel`;

      const paymentPageUrl = await zohoBilling.generateHostedPaymentPageUrl(
        company.billingCustomerId || '',
        planCode,
        returnUrl,
        cancelUrl
      );

      console.log(`BILLING: Generated upgrade URL for ${company.name} to plan ${planCode}`);

      res.json({
        paymentPageUrl,
        plan: planCode,
        returnUrl,
        cancelUrl
      });

    } catch (error) {
      console.error('BILLING UPGRADE URL ERROR:', error);
      res.status(500).json({ error: 'Failed to generate upgrade URL' });
    }
  });

  // Get Zoho customer portal URL for self-service billing
  app.get('/org/:slug/api/billing/portal-url', requireOrganizationAccess, async (req, res) => {
    try {
      const orgId = req.organizationId!;
      const company = await storage.getCompany(orgId);
      
      if (!company) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const { zohoBilling } = await import('./zoho-billing-service');
      const returnUrl = `${req.protocol}://${req.get('host')}/org/${company.slug}/billing`;

      const portalUrl = await zohoBilling.generateCustomerPortalUrl(
        company.billingCustomerId || '',
        returnUrl
      );

      console.log(`BILLING: Generated customer portal URL for ${company.name}`);

      res.json({
        portalUrl,
        returnUrl
      });

    } catch (error) {
      console.error('BILLING PORTAL URL ERROR:', error);
      res.status(500).json({ error: 'Failed to generate customer portal URL' });
    }
  });

  // Admin: Extend trial period
  app.post('/api/admin/organizations/:id/extend-trial', requireAdminAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { days, reason } = req.body;

      if (!days || days <= 0) {
        return res.status(400).json({ error: 'Invalid extension days' });
      }

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Calculate new trial end date
      const currentTrialEnd = company.trialEndsAt || new Date();
      const newTrialEnd = new Date(currentTrialEnd.getTime() + (days * 24 * 60 * 60 * 1000));
      const extensions = (company.trialExtensions || 0) + 1;

      await storage.updateCompany(companyId, {
        trialEndsAt: newTrialEnd,
        trialExtensions: extensions,
        status: 'trial',
        trialStatus: 'active',
        updatedAt: new Date()
      });

      console.log(`ADMIN: Extended trial for ${company.name} by ${days} days - New end date: ${newTrialEnd}, Reason: ${reason}`);
      
      res.json({
        message: `Trial extended by ${days} days`,
        newTrialEndDate: newTrialEnd,
        totalExtensions: extensions
      });
    } catch (error) {
      console.error('ADMIN EXTEND TRIAL ERROR:', error);
      res.status(500).json({ error: 'Failed to extend trial' });
    }
  });

  // Admin: Vendor field mapping management
  app.get('/api/admin/vendor-field-mappings', requireAdminAuth, async (req, res) => {
    try {
      const mappings = await storage.getAllVendorFieldMappings();
      res.json(mappings);
    } catch (error) {
      console.error('Error fetching vendor field mappings:', error);
      res.status(500).json({ error: 'Failed to fetch vendor field mappings' });
    }
  });

  app.post('/api/admin/vendor-field-mappings', requireAdminAuth, async (req, res) => {
    try {
      const { vendorSource, mappingName, columnMappings } = req.body;
      
      if (!vendorSource || !mappingName || !columnMappings) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const mapping = await storage.createVendorFieldMapping({
        vendorSource,
        mappingName,
        columnMappings,
        status: 'draft',
        lastUsed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`ADMIN: Created vendor field mapping for ${vendorSource} (${mappingName})`);
      res.json(mapping);
    } catch (error) {
      console.error('Error creating vendor field mapping:', error);
      res.status(500).json({ error: 'Failed to create vendor field mapping' });
    }
  });

  app.post('/api/admin/vendor-field-mappings/:id/approve', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid mapping ID' });
      }

      const mapping = await storage.updateVendorFieldMapping(id, {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: req.user?.username || 'admin',
        updatedAt: new Date()
      });

      if (!mapping) {
        return res.status(404).json({ error: 'Vendor field mapping not found' });
      }

      console.log(`ADMIN: Approved vendor field mapping ${id} for ${mapping.vendorSource}`);
      res.json(mapping);
    } catch (error) {
      console.error('Error approving vendor field mapping:', error);
      res.status(500).json({ error: 'Failed to approve vendor field mapping' });
    }
  });

  app.post('/api/admin/vendor-field-mappings/preview', requireAdminAuth, async (req, res) => {
    try {
      const { vendorSource, mappingName, sampleData } = req.body;
      
      if (!vendorSource || !mappingName || !sampleData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get mapping configuration
      const mapping = await storage.getVendorFieldMapping(vendorSource, mappingName);
      
      if (!mapping) {
        return res.status(404).json({ error: 'Vendor field mapping not found' });
      }

      // Transform sample data using the mapping
      const preview = [];
      const errors = [];

      for (let i = 0; i < Math.min(sampleData.length, 10); i++) {
        const row = sampleData[i];
        const mappedRow: Record<string, any> = {};
        
        try {
          // Apply column mappings
          for (const [targetField, sourceColumn] of Object.entries(mapping.columnMappings)) {
            if (row.hasOwnProperty(sourceColumn)) {
              mappedRow[targetField] = row[sourceColumn];
            } else {
              mappedRow[targetField] = null;
              if (!errors.includes(`Column '${sourceColumn}' not found in data`)) {
                errors.push(`Column '${sourceColumn}' not found in data`);
              }
            }
          }

          preview.push({
            row: i + 1,
            original: row,
            mapped: mappedRow
          });
        } catch (error) {
          errors.push(`Error processing row ${i + 1}: ${error.message}`);
        }
      }

      const result = {
        preview,
        errors
      };

      console.log(`ADMIN: Generated preview for ${vendorSource} mapping with ${preview.length} rows`);
      res.json(result);
    } catch (error) {
      console.error('Error generating preview:', error);
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  });

  // Test route for vendor priority system
  app.get('/api/test/vendor-priority', async (req, res) => {
    try {
      const { getVendorRecordPriority, clearVendorPriorityCache, getVendorPriorityCacheStats } = await import('./vendor-priority');
      const { shouldReplaceProduct } = await import('./simple-quality-priority');
      
      console.log('🧪 Starting Vendor Priority System Tests\n');
      
      const results = {
        timestamp: new Date().toISOString(),
        tests: [],
        summary: { passed: 0, failed: 0, total: 0 }
      };

      // Test 1: Direct vendor priority lookup
      console.log('📋 TEST 1: Direct Vendor Priority Lookup');
      
      const testVendors = [
        'Sports South',
        'Chattanooga Shooting Supplies', 
        'Bill Hicks & Co.',
        'GunBroker',
        "Lipsey's",
        'Unknown Vendor',
        '',
        null
      ];

      for (const vendor of testVendors) {
        try {
          const priority = await getVendorRecordPriority(vendor);
          const test = {
            name: `Priority lookup for "${vendor || 'NULL'}"`,
            type: 'priority_lookup',
            vendor: vendor || 'NULL',
            expected: 'number',
            actual: priority,
            passed: typeof priority === 'number' && priority > 0,
            message: `Priority: ${priority}`
          };
          results.tests.push(test);
          console.log(`${test.passed ? '✅' : '❌'} "${vendor || 'NULL'}" -> Priority: ${priority}`);
        } catch (error) {
          const test = {
            name: `Priority lookup for "${vendor || 'NULL'}"`,
            type: 'priority_lookup',
            vendor: vendor || 'NULL',
            expected: 'number',
            actual: 'error',
            passed: false,
            message: `Error: ${error.message}`
          };
          results.tests.push(test);
          console.log(`❌ "${vendor || 'NULL'}" -> Error: ${error.message}`);
        }
      }

      // Test 2: Product replacement priority logic
      console.log('\n📋 TEST 2: Product Replacement Priority Logic');
      
      const testScenarios = [
        {
          name: 'Sports South (P1) replaces Chattanooga (P2)',
          existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel1' },
          new: { source: 'Sports South', model: 'TestModel1' },
          newVendor: 'Sports South',
          options: {},
          expected: true
        },
        {
          name: 'Sports South (P1) replaces Bill Hicks (P3)', 
          existing: { source: 'Bill Hicks & Co.', model: 'TestModel2' },
          new: { source: 'Sports South', model: 'TestModel2' },
          newVendor: 'Sports South',
          options: {},
          expected: true
        },
        {
          name: 'Sports South (P1) replaces GunBroker (P4)',
          existing: { source: 'GunBroker', model: 'TestModel3' },
          new: { source: 'Sports South', model: 'TestModel3' },
          newVendor: 'Sports South',
          options: {},
          expected: true
        },
        {
          name: 'Chattanooga (P2) replaces Bill Hicks (P3)',
          existing: { source: 'Bill Hicks & Co.', model: 'TestModel4' },
          new: { source: 'Chattanooga Shooting Supplies', model: 'TestModel4' },
          newVendor: 'Chattanooga Shooting Supplies',
          options: {},
          expected: true
        },
        {
          name: 'Chattanooga (P2) does NOT replace Sports South (P1)',
          existing: { source: 'Sports South', model: 'TestModel5' },
          new: { source: 'Chattanooga Shooting Supplies', model: 'TestModel5' },
          newVendor: 'Chattanooga Shooting Supplies',
          options: {},
          expected: false
        },
        {
          name: 'Bill Hicks (P3) does NOT replace Sports South (P1)',
          existing: { source: 'Sports South', model: 'TestModel6' },
          new: { source: 'Bill Hicks & Co.', model: 'TestModel6' },
          newVendor: 'Bill Hicks & Co.',
          options: {},
          expected: false
        },
        {
          name: 'Bill Hicks (P3) does NOT replace Chattanooga (P2)',
          existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel7' },
          new: { source: 'Bill Hicks & Co.', model: 'TestModel7' },
          newVendor: 'Bill Hicks & Co.',
          options: {},
          expected: false
        },
        {
          name: 'GunBroker (P4) does NOT replace Bill Hicks (P3)',
          existing: { source: 'Bill Hicks & Co.', model: 'TestModel8' },
          new: { source: 'GunBroker', model: 'TestModel8' },
          newVendor: 'GunBroker',
          options: {},
          expected: false
        },
        {
          name: 'Equal Priority - Lipsey\'s (P4) does NOT replace GunBroker (P4)',
          existing: { source: 'GunBroker', model: 'TestModel9' },
          new: { source: "Lipsey's", model: 'TestModel9' },
          newVendor: "Lipsey's",
          options: {},
          expected: false
        },
        {
          name: 'Same Vendor Update - Sports South updates own product',
          existing: { source: 'Sports South', model: 'TestModel10' },
          new: { source: 'Sports South', model: 'TestModelUpdated' },
          newVendor: 'Sports South',
          options: {},
          expected: true
        },
        {
          name: 'Manual Override - GunBroker (P4) replaces Sports South (P1) with override',
          existing: { source: 'Sports South', model: 'TestModel11' },
          new: { source: 'GunBroker', model: 'TestModel11' },
          newVendor: 'GunBroker',
          options: { isManualOverride: true },
          expected: true
        },
        {
          name: 'Source Locked - Sports South (P1) cannot replace locked Chattanooga (P2)',
          existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel12' },
          new: { source: 'Sports South', model: 'TestModel12' },
          newVendor: 'Sports South',
          options: { sourceLocked: true },
          expected: false
        },
        {
          name: 'Source Locked + Manual Override - Override works despite source lock',
          existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel13' },
          new: { source: 'GunBroker', model: 'TestModel13' },
          newVendor: 'GunBroker',
          options: { sourceLocked: true, isManualOverride: true },
          expected: true
        }
      ];

      for (const scenario of testScenarios) {
        try {
          const result = await shouldReplaceProduct(
            scenario.existing,
            scenario.new,
            scenario.newVendor,
            scenario.options
          );
          
          const test = {
            name: scenario.name,
            type: 'replacement_logic',
            expected: scenario.expected,
            actual: result,
            passed: result === scenario.expected,
            details: {
              existingVendor: scenario.existing.source,
              newVendor: scenario.newVendor,
              options: scenario.options
            }
          };
          
          results.tests.push(test);
          console.log(`${test.passed ? '✅' : '❌'} ${scenario.name}`);
          console.log(`   Expected: ${scenario.expected}, Got: ${result}`);
        } catch (error) {
          const test = {
            name: scenario.name,
            type: 'replacement_logic',
            expected: scenario.expected,
            actual: 'error',
            passed: false,
            message: error.message
          };
          results.tests.push(test);
          console.log(`❌ ERROR: ${scenario.name} - ${error.message}`);
        }
      }

      // Test 3: Edge cases
      console.log('\n📋 TEST 3: Edge Cases and Error Handling');
      
      const edgeCases = [
        {
          name: 'Unknown vendor replacement attempt',
          existing: { source: 'Sports South', model: 'TestModel14' },
          newVendor: 'Unknown Vendor XYZ',
          expected: false // Unknown vendor gets priority 999, shouldn't replace priority 1
        },
        {
          name: 'Empty string vendor source',
          existing: { source: 'Sports South', model: 'TestModel15' },
          newVendor: '',
          expected: false
        },
        {
          name: 'Null existing vendor source',
          existing: { source: null, model: 'TestModel16' },
          newVendor: 'Sports South',
          expected: true // Unknown existing (priority 999) should be replaced by Sports South (priority 1)
        }
      ];

      for (const edgeCase of edgeCases) {
        try {
          const result = await shouldReplaceProduct(
            edgeCase.existing,
            { model: 'TestModel' },
            edgeCase.newVendor,
            {}
          );
          
          const test = {
            name: edgeCase.name,
            type: 'edge_case',
            expected: edgeCase.expected,
            actual: result,
            passed: result === edgeCase.expected
          };
          
          results.tests.push(test);
          console.log(`${test.passed ? '✅' : '❌'} ${edgeCase.name}`);
          console.log(`   Expected: ${edgeCase.expected}, Got: ${result}`);
        } catch (error) {
          const test = {
            name: edgeCase.name,
            type: 'edge_case',
            expected: edgeCase.expected,
            actual: 'error',
            passed: false,
            message: error.message
          };
          results.tests.push(test);
          console.log(`❌ ERROR: ${edgeCase.name} - ${error.message}`);
        }
      }

      // Calculate summary
      results.summary.total = results.tests.length;
      results.summary.passed = results.tests.filter(t => t.passed).length;
      results.summary.failed = results.summary.total - results.summary.passed;
      results.summary.successRate = ((results.summary.passed / results.summary.total) * 100).toFixed(1);

      // Get cache stats
      const cacheStats = getVendorPriorityCacheStats();
      results.cacheStats = cacheStats;

      console.log('\n🏁 TEST SUMMARY');
      console.log('================================================');
      console.log(`Total Tests: ${results.summary.total}`);
      console.log(`✅ Passed: ${results.summary.passed}`);
      console.log(`❌ Failed: ${results.summary.failed}`);
      console.log(`Success Rate: ${results.summary.successRate}%`);

      if (results.summary.failed === 0) {
        console.log('\n🎉 All tests passed! Vendor priority system is working correctly.');
      } else {
        console.log('\n⚠️  Some tests failed. Review the implementation.');
      }

      res.json(results);
    } catch (error) {
      console.error('Error running vendor priority tests:', error);
      res.status(500).json({ error: 'Failed to run tests', message: error.message });
    }
  });

  // Initialize subscription services - DISABLED per user request
  // NO AUTOMATIC CRON JOBS OR SYNCS
  try {
    // const { initializeSubscriptionServices } = await import('./plan-enforcement-service');
    // await initializeSubscriptionServices();
    console.log('ℹ️  Subscription cron jobs DISABLED - all syncs must be manual');
  } catch (error) {
    console.error('Failed to initialize subscription services:', error);
  }

  // STARTUP: Validate vendor priority consistency (delayed to avoid connection pool race conditions)
  setTimeout(async () => {
    try {
      console.log('🔧 STARTUP: Validating vendor priority consistency...');
      const { validateVendorPriorityConsistency } = await import('./vendor-priority');
      const validationResult = await validateVendorPriorityConsistency();
      
      if (validationResult.isValid) {
        console.log('✅ STARTUP: Vendor priority system is consistent -', validationResult.totalVendors, 'vendors in proper 1-N sequence');
      } else {
        console.warn('⚠️  STARTUP: Vendor priority inconsistencies detected!');
        console.warn('Issues found:', validationResult.issues.join('; '));
        console.warn('Recommendations:', validationResult.recommendations.join('; '));
        console.warn('Use /api/admin/vendor-priorities/fix endpoint to auto-repair');
      }
    } catch (error) {
      console.error('❌ STARTUP: Failed to validate vendor priority consistency:', error);
    }
  }, 2000); // 2 second delay to let connection pool stabilize

  // Admin endpoint to check vendor priority consistency
  app.get('/api/admin/vendor-priorities/validate', requireAdminAuth, async (req, res) => {
    try {
      console.log('=== VENDOR PRIORITY VALIDATION REQUEST ===');
      const { validateVendorPriorityConsistency } = await import('./vendor-priority');
      const result = await validateVendorPriorityConsistency();
      
      console.log('VENDOR PRIORITY VALIDATION: Completed for admin request');
      res.json(result);
    } catch (error) {
      console.error('Error validating vendor priorities:', error);
      res.status(500).json({ error: 'Failed to validate vendor priorities' });
    }
  });

  // Admin endpoint to auto-fix vendor priority consistency
  app.post('/api/admin/vendor-priorities/fix', requireAdminAuth, async (req, res) => {
    try {
      console.log('=== VENDOR PRIORITY AUTO-FIX REQUEST ===');
      const { fixVendorPriorityConsistency } = await import('./vendor-priority');
      const result = await fixVendorPriorityConsistency();
      
      console.log('VENDOR PRIORITY AUTO-FIX: Completed for admin request');
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Error auto-fixing vendor priorities:', error);
      res.status(500).json({ error: 'Failed to auto-fix vendor priorities' });
    }
  });

  // Admin endpoint to test outbound IP address (verify proxy is working)
  app.get('/api/admin/test-outbound-ip', requireAdminAuth, async (req, res) => {
    try {
      console.log('=== TESTING OUTBOUND IP ADDRESS ===');
      
      // Check if proxy is configured
      const proxyConfigured = !!(
        process.env.PROXY_HOST && 
        process.env.PROXY_PORT && 
        process.env.PROXY_USERNAME && 
        process.env.PROXY_PASSWORD
      );
      
      console.log('Proxy configured:', proxyConfigured);
      if (proxyConfigured) {
        console.log('Proxy settings:', {
          host: process.env.PROXY_HOST,
          port: process.env.PROXY_PORT,
          username: process.env.PROXY_USERNAME ? '***' : undefined
        });
      }
      
      // Make a request to ipify.org to check our outbound IP
      const https = await import('https');
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      
      let agent = undefined;
      if (proxyConfigured) {
        const proxyUrl = `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
        agent = new HttpsProxyAgent(proxyUrl);
      }
      
      const ipResponse = await new Promise<string>((resolve, reject) => {
        https.get('https://api.ipify.org?format=text', { agent }, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => resolve(data));
        }).on('error', reject);
      });
      
      console.log('Outbound IP detected:', ipResponse);
      
      res.json({
        success: true,
        proxyConfigured,
        proxyHost: proxyConfigured ? process.env.PROXY_HOST : null,
        proxyPort: proxyConfigured ? process.env.PROXY_PORT : null,
        detectedOutboundIP: ipResponse.trim(),
        expectedIP: proxyConfigured ? process.env.PROXY_HOST : 'N/A (no proxy configured)',
        isProxyWorking: proxyConfigured && ipResponse.trim() === process.env.PROXY_HOST,
        message: proxyConfigured && ipResponse.trim() === process.env.PROXY_HOST
          ? '✅ Proxy is working correctly! All API calls route through fixed IP.'
          : proxyConfigured 
            ? '⚠️ Proxy configured but not routing correctly. Check proxy server.'
            : 'ℹ️ No proxy configured. Using Replit\'s dynamic IP.'
      });
    } catch (error: any) {
      console.error('Error testing outbound IP:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to test outbound IP',
        message: error.message 
      });
    }
  });

  // Serve the Lipsey's API test page
  app.get('/test-lipseys', (req, res) => {
    import('path').then(({ default: path }) => {
      const htmlPath = path.join(process.cwd(), 'test-lipseys.html');
      res.sendFile(htmlPath);
    }).catch(err => {
      res.status(500).json({ error: 'Failed to serve test page', details: err.message });
    });
  });

  // Test page for Lipsey's Catalog Sync
  app.get('/test-lipseys-sync', (req, res) => {
    import('path').then(({ default: path }) => {
      const htmlPath = path.join(process.cwd(), 'test-lipseys-sync.html');
      res.sendFile(htmlPath);
    }).catch(err => {
      res.status(500).json({ error: 'Failed to serve test page', details: err.message });
    });
  });

  // Admin endpoint to test Lipsey's API and get sample catalog data
  app.get('/api/admin/test-lipseys-api', requireAdminAuth, async (req, res) => {
    try {
      console.log('=== TESTING LIPSEY\'S API ===');
      
      // Get Lipsey's admin credentials
      const [lipseyVendor] = await db
        .select()
        .from(supportedVendors)
        .where(eq(supportedVendors.vendorSlug, "lipseys")); // Use vendorSlug (immutable) not vendorShortCode (user-editable)

      if (!lipseyVendor || !lipseyVendor.adminCredentials) {
        return res.status(404).json({
          success: false,
          error: 'Lipsey\'s vendor not configured or missing admin credentials'
        });
      }

      const credentials = lipseyVendor.adminCredentials as { email: string; password: string };
      console.log('Using credentials:', credentials.email);
      
      // Initialize Lipsey API client (will automatically use proxy if configured)
      const { LipseyAPI } = await import('./lipsey-api.js');
      const api = new LipseyAPI(credentials);
      
      // Test authentication
      console.log('Testing authentication...');
      const authResult = await api.authenticate();
      
      if (!authResult) {
        return res.status(401).json({
          success: false,
          error: 'Lipsey\'s authentication failed',
          message: 'Check credentials and IP whitelist'
        });
      }
      
      console.log('✅ Authentication successful!');
      
      // Get catalog feed (limited sample)
      console.log('Fetching catalog feed...');
      const catalogItems = await api.getCatalogFeed();
      
      if (!catalogItems || catalogItems.length === 0) {
        return res.json({
          success: true,
          authenticated: true,
          totalItems: 0,
          sampleProducts: [],
          message: 'Authentication successful but no catalog items returned'
        });
      }
      
      console.log(`✅ Retrieved ${catalogItems.length} catalog items`);
      
      // Return first 5 items as samples
      const sampleSize = Math.min(5, catalogItems.length);
      const samples = catalogItems.slice(0, sampleSize).map(item => ({
        // Core fields
        itemNo: item.itemNo,
        description1: item.description1,
        description2: item.description2,
        upc: item.upc,
        manufacturer: item.manufacturer,
        model: item.model,
        manufacturerModelNo: item.manufacturerModelNo,
        type: item.type,
        itemType: item.itemType,
        
        // Pricing
        price: item.price,
        currentPrice: item.currentPrice,
        retailMap: item.retailMap,
        msrp: item.msrp,
        
        // Inventory
        quantity: item.quantity,
        allocated: item.allocated,
        onSale: item.onSale,
        canDropship: item.canDropship,
        
        // Specifications
        caliberGauge: item.caliberGauge,
        action: item.action,
        barrelLength: item.barrelLength,
        capacity: item.capacity,
        finish: item.finish,
        weight: item.weight,
        
        // Image
        imageName: item.imageName,
        
        // Compliance
        fflRequired: item.fflRequired,
        sotRequired: item.sotRequired
      }));
      
      res.json({
        success: true,
        authenticated: true,
        totalItems: catalogItems.length,
        sampleProducts: samples,
        fieldMapping: {
          itemNo: 'Lipsey\'s item number',
          description1: 'Primary description',
          description2: 'Secondary description',
          upc: 'Universal Product Code',
          manufacturer: 'Manufacturer/brand name',
          model: 'Model number',
          manufacturerModelNo: 'Manufacturer\'s model number',
          price: 'Dealer cost',
          retailMap: 'Minimum Advertised Price (MAP)',
          msrp: 'Manufacturer\'s Suggested Retail Price',
          quantity: 'Available quantity',
          imageName: 'Image filename (construct URL: https://www.lipseyscloud.com/images/{imageName})'
        },
        message: `Successfully retrieved ${catalogItems.length} items from Lipsey's catalog`
      });
      
    } catch (error: any) {
      console.error('Error testing Lipsey\'s API:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Direct Lipsey's API test with provided credentials (no admin auth required for testing)
  app.post('/api/test-lipseys-direct', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing credentials',
          message: 'Please provide email and password in request body'
        });
      }
      
      console.log('=== DIRECT LIPSEY\'S API TEST ===');
      console.log('Email:', email);
      
      // Check proxy configuration
      const proxyConfigured = !!(
        process.env.PROXY_HOST && 
        process.env.PROXY_PORT && 
        process.env.PROXY_USERNAME && 
        process.env.PROXY_PASSWORD
      );
      
      console.log('Proxy configured:', proxyConfigured);
      if (proxyConfigured) {
        console.log(`Proxy: ${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`);
      }
      
      // Initialize Lipsey API (will use proxy if configured)
      const { LipseyAPI } = await import('./lipsey-api.js');
      const api = new LipseyAPI({ email, password });
      
      // Test authentication
      console.log('Testing authentication with Lipsey\'s...');
      const authResult = await api.authenticate();
      
      if (!authResult) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          proxyConfigured,
          proxyIP: proxyConfigured ? process.env.PROXY_HOST : null,
          error: 'Authentication failed',
          message: 'Invalid credentials or IP not whitelisted at Lipsey\'s'
        });
      }
      
      console.log('✅ Authentication successful!');
      
       // Get a small sample of catalog with ALL fields
       console.log('Fetching catalog sample...');
       const catalogItems = await api.getCatalogFeed();
       
       // Return 2 complete products with ALL fields (not filtered)
       const sampleSize = Math.min(2, catalogItems.length);
       const samples = catalogItems.slice(0, sampleSize);
      
       res.json({
         success: true,
         authenticated: true,
         proxyConfigured,
         proxyIP: proxyConfigured ? process.env.PROXY_HOST : null,
         totalItems: catalogItems.length,
         sampleProducts: samples,
         note: 'Sample products contain ALL fields from Lipsey\'s API for field mapping verification',
         message: proxyConfigured 
           ? `✅ Successfully authenticated via proxy ${process.env.PROXY_HOST}. Retrieved ${catalogItems.length} items. Showing ${samples.length} complete products with all fields.`
           : `✅ Successfully authenticated (no proxy). Retrieved ${catalogItems.length} items. Showing ${samples.length} complete products with all fields.`
       });
      
    } catch (error: any) {
      console.error('Error in direct Lipsey\'s test:', error);
      res.status(500).json({ 
        success: false,
        error: error.message,
        message: 'Test failed - check server logs for details'
      });
    }
  });

  // Admin endpoint to migrate product sources to slugs
  app.post('/api/admin/migrate-product-sources', requireAdminAuth, async (req, res) => {
    try {
      console.log('=== MIGRATING PRODUCT SOURCES TO SLUGS ===');
      
      // Mapping of old vendor names to new slugs
      const VENDOR_NAME_TO_SLUG_MAP: Record<string, string> = {
        'Sports South': 'sports-south',
        'Bill Hicks & Co.': 'bill-hicks',
        'Chattanooga Shooting Supplies': 'chattanooga',
        "Lipsey's Inc.": 'lipseys',
        'Lipseys': 'lipseys',
        "Lipsey's": 'lipseys',
        'GunBroker.com': 'gunbroker',
        'GunBroker': 'gunbroker'
      };
      
      let totalUpdated = 0;
      
      for (const [oldName, newSlug] of Object.entries(VENDOR_NAME_TO_SLUG_MAP)) {
        if (oldName === newSlug) continue; // Skip if already using slug
        
        const result = await db
          .update(products)
          .set({ source: newSlug, updatedAt: new Date() })
          .where(eq(products.source, oldName));
        
        const affected = result.rowCount || 0;
        totalUpdated += affected;
        
        if (affected > 0) {
          console.log(`✓ Updated ${affected} products: "${oldName}" → "${newSlug}"`);
        }
      }
      
      // Get current distinct sources
      const updatedSources = await db
        .selectDistinct({ source: products.source })
        .from(products)
        .where(sql`${products.source} IS NOT NULL`);
      
      console.log('Migration completed. Current sources:', updatedSources.map(s => s.source));
      
      res.json({
        success: true,
        message: `Successfully migrated ${totalUpdated} products to use vendor slugs`,
        totalUpdated,
        currentSources: updatedSources.map(s => s.source)
      });
      
    } catch (error: any) {
      console.error('Migration failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Admin endpoint to test Lipsey's catalog sync (manual trigger)
  app.post('/api/admin/test-lipseys-sync', requireAdminAuth, async (req, res) => {
    try {
      console.log('=== MANUAL LIPSEY\'S CATALOG SYNC TEST ===');
      
      // Get Lipsey's admin credentials
      const [lipseyVendor] = await db
        .select()
        .from(supportedVendors)
        .where(eq(supportedVendors.vendorSlug, "lipseys")); // Use vendorSlug (immutable) not vendorShortCode (user-editable)

      if (!lipseyVendor || !lipseyVendor.adminCredentials) {
        return res.status(404).json({
          success: false,
          error: 'Lipsey\'s vendor not configured or missing admin credentials'
        });
      }

      const credentials = lipseyVendor.adminCredentials as { email: string; password: string };
      console.log('Using credentials:', credentials.email);
      
      // Determine sync type and limit
      const syncType = req.body.syncType || 'incremental';
      const limit = req.body.limit || null; // Optional limit for testing
      console.log('Sync type:', syncType);
      if (limit) {
        console.log(`Testing with limit: ${limit} products`);
      }
      
      // Set sync status to in_progress at start
      await db.update(supportedVendors)
        .set({ catalogSyncStatus: 'in_progress' })
        .where(eq(supportedVendors.id, lipseyVendor.id));
      
      // Initialize Lipsey's catalog sync service
      const { LipseysCatalogSyncService } = await import('./lipseys-catalog-sync.js');
      const syncService = new LipseysCatalogSyncService(credentials);
      
      // Perform sync
      console.log(`Starting ${syncType} sync...`);
      const result = syncType === 'full' 
        ? await syncService.performFullCatalogSync(limit)
        : await syncService.performIncrementalSync();
      
      console.log('Sync completed:', result);
      
      // Update database with sync status and statistics
      try {
        const updates: any = {
          catalogSyncStatus: result.success ? 'success' : 'error',
          lastCatalogSync: new Date(),
          catalogSyncError: result.success ? null : result.message,
          lastSyncNewRecords: result.newProducts || 0,
          lastSyncRecordsUpdated: result.updatedProducts || 0,
          lastSyncRecordsSkipped: result.skippedProducts || 0
        };
        
        await db.update(supportedVendors)
          .set(updates)
          .where(eq(supportedVendors.id, lipseyVendor.id));
        
        console.log(`LIPSEYS SYNC: Updated database with sync status: ${updates.catalogSyncStatus}`);
      } catch (updateError) {
        console.error('Failed to update Lipsey\'s sync status in database:', updateError);
      }
      
      res.json({
        success: result.success,
        syncType,
        message: result.message,
        statistics: {
          productsProcessed: result.productsProcessed,
          newProducts: result.newProducts,
          updatedProducts: result.updatedProducts,
          skippedProducts: result.skippedProducts,
          errors: result.errors.length,
          warnings: result.warnings.length
        },
        errors: result.errors,
        warnings: result.warnings
      });
      
    } catch (error: any) {
      console.error('Error in Lipsey\'s sync test:', error);
      
      // Update database with error status
      try {
        const [lipseyVendor] = await db
          .select()
          .from(supportedVendors)
          .where(eq(supportedVendors.vendorSlug, "lipseys")); // Use vendorSlug (immutable) not vendorShortCode (user-editable)
        
        if (lipseyVendor) {
          await db.update(supportedVendors)
            .set({
              catalogSyncStatus: 'error',
              catalogSyncError: error.message
            })
            .where(eq(supportedVendors.id, lipseyVendor.id));
        }
      } catch (updateError) {
        console.error('Failed to update error status:', updateError);
      }
      
      res.status(500).json({ 
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Setup test email routes
  try {
    const { setupTestEmailRoute } = await import('./test-email-route');
    setupTestEmailRoute(app);
    console.log('✅ Test email routes setup successfully');
  } catch (error) {
    console.error('❌ Failed to setup test email routes:', error);
  }

  // ONE-TIME SETUP: Create initial admin user if none exists (auto-runs on startup)
  async function ensureAdminUserExists() {
    try {
      const existingAdmins = await storage.getAdminUsers();
      
      if (existingAdmins.length === 0) {
        const hashedPassword = await hashPassword('Admin123!');
        const adminUser = await storage.createUser({
          email: 'admin@pricecomparehub.com',
          username: 'admin',
          password: hashedPassword,
          companyId: null
        });
        console.log('✅ STARTUP: Initial admin user created:', adminUser.email);
        console.log('   Credentials: admin@pricecomparehub.com / admin / Admin123!');
      } else {
        console.log('✅ STARTUP: Admin users already exist, count:', existingAdmins.length);
      }
    } catch (error) {
      console.error('❌ STARTUP: Failed to ensure admin user exists:', error);
    }
  }
  
  // Run admin user check on startup
  await ensureAdminUserExists();

  // ❌ REMOVED: Dangerous schema sync endpoint that was deleting fields
  // This endpoint ran 'db:push --force' which deleted any columns not in schema.ts
  // Schema changes must be done manually with migrations to prevent data loss
  // 
  // OLD CODE (DO NOT RESTORE):
  // app.post('/api/admin/sync-schema', ...) runs db:push --force
  //
  // CORRECT WORKFLOW:
  // 1. Create migration: migrations/XXXX_description.sql
  // 2. Test in dev: psql $DEV_DATABASE_URL -f migrations/XXXX.sql
  // 3. Apply to prod: psql $PROD_DATABASE_URL -f migrations/XXXX.sql
  // 4. Deploy code changes

  // STARTUP: Check and log proxy configuration
  const proxyConfigured = !!(
    process.env.PROXY_HOST && 
    process.env.PROXY_PORT && 
    process.env.PROXY_USERNAME && 
    process.env.PROXY_PASSWORD
  );
  
  if (proxyConfigured) {
    console.log('');
    console.log('🌐 ============================================');
    console.log('🌐 PROXY CONFIGURATION DETECTED');
    console.log('🌐 ============================================');
    console.log(`🌐 Host: ${process.env.PROXY_HOST}`);
    console.log(`🌐 Port: ${process.env.PROXY_PORT}`);
    console.log(`🌐 Username: ${process.env.PROXY_USERNAME}`);
    console.log(`🌐 Password: ${'*'.repeat(8)}`);
    console.log('🌐 ============================================');
    console.log('🌐 All vendor API calls will route through fixed IP');
    console.log('🌐 APIs using proxy: Lipsey\'s, Sports South, Chattanooga');
    console.log('🌐 ============================================');
    console.log('');
  } else {
    console.log('ℹ️  STARTUP: No proxy configured - using Replit\'s dynamic IP');
  }

  const httpServer = createServer(app);
  return httpServer;
}

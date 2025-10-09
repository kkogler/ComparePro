import dotenv from "dotenv";
// Load environment variables from .env file
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { execSync } from "child_process";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Global error handlers to prevent server crashes
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('🚨 UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
  // Don't exit the process - keep server running
});

process.on('uncaughtException', (error: Error) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  // Don't exit the process - keep server running
});

const app = express();
app.use(express.json({
  verify: (req: any, _res, buf) => {
    // Capture raw body for webhook signature verification
    if (req.originalUrl && req.originalUrl.startsWith('/api/webhooks/zoho')) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));
app.use(express.urlencoded({ extended: false }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Ensure vendor handlers are registered before routes
  try {
    const { vendorRegistry } = await import('./vendor-registry');
    await vendorRegistry.initialize();
  } catch (e) {
    console.error('Failed to initialize vendor registry at startup:', e);
  }
  
  // Recover any stuck sync statuses from previous server crash/restart
  try {
    console.log('🔄 STARTUP RECOVERY: Checking for stuck sync statuses...');
    const { storage } = await import('./storage');
    const supportedVendors = await storage.getAllSupportedVendors();
    
    let recoveredCount = 0;
    for (const vendor of supportedVendors) {
      // Check for stuck catalog sync status
      if (vendor.catalogSyncStatus === 'in_progress') {
        console.log(`🚨 STARTUP RECOVERY: ${vendor.name} catalog sync stuck "in_progress" - resetting status`);
        await storage.updateSupportedVendor(vendor.id, {
          catalogSyncStatus: 'error',
          catalogSyncError: 'Sync interrupted by server restart - auto-recovered on startup'
        });
        recoveredCount++;
      }
      
      // Check for stuck Bill Hicks master catalog sync
      if (vendor.name.toLowerCase().includes('bill hicks') && 
          vendor.billHicksMasterCatalogSyncStatus === 'in_progress') {
        console.log(`🚨 STARTUP RECOVERY: Bill Hicks master catalog sync stuck "in_progress" - resetting status`);
        await storage.updateSupportedVendor(vendor.id, {
          billHicksMasterCatalogSyncStatus: 'error',
          billHicksMasterCatalogSyncError: 'Sync interrupted by server restart - auto-recovered on startup'
        });
        recoveredCount++;
      }
      
      // Check for stuck Bill Hicks inventory sync
      if (vendor.name.toLowerCase().includes('bill hicks') && 
          vendor.billHicksInventorySyncStatus === 'in_progress') {
        console.log(`🚨 STARTUP RECOVERY: Bill Hicks inventory sync stuck "in_progress" - resetting status`);
        await storage.updateSupportedVendor(vendor.id, {
          billHicksInventorySyncStatus: 'error',
          billHicksInventorySyncError: 'Sync interrupted by server restart - auto-recovered on startup'
        });
        recoveredCount++;
      }
    }
    
    if (recoveredCount > 0) {
      console.log(`✅ STARTUP RECOVERY: Recovered ${recoveredCount} stuck sync status(es)`);
    } else {
      console.log('✅ STARTUP RECOVERY: No stuck sync statuses found');
    }
  } catch (error) {
    console.error('❌ STARTUP RECOVERY: Failed to check/recover sync statuses:', error);
  }
  
  const server = await registerRoutes(app);

  // Set timezone globally for consistent date/time handling
  process.env.TZ = "America/Los_Angeles";
  console.log('🌍 Global timezone set to:', process.env.TZ);

  // NOTE: Cron-based schedulers were removed in favor of Scheduled Deployments
  // Manual sync functions remain available through Admin UI
  console.log('ℹ️  Using Scheduled Deployments for automated syncs (cron schedulers disabled)');

  console.log('Server initialization complete');

  // Add proper cleanup on server shutdown (single registration)
  const gracefulShutdown = async (signal: 'SIGTERM' | 'SIGINT') => {
    console.log(`🛑 ${signal} received, shutting down gracefully (pid=${process.pid})`);
    try {
      const { stopSubscriptionJobs } = await import('./subscription-jobs');
      stopSubscriptionJobs();
    } catch (error) {
      console.error('Error stopping subscription jobs:', error);
    }
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  };
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
  process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error for debugging
    console.error('🚨 EXPRESS ERROR HANDLER:', {
      status,
      message,
      stack: err.stack,
      url: _req.url,
      method: _req.method
    });

    // Send response and continue (don't throw - this crashes the server!)
    res.status(status).json({ message });
  });

  // ENVIRONMENT DETECTION - Use NODE_ENV consistently throughout codebase
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const isDevelopment = NODE_ENV === 'development';
  const isProduction = NODE_ENV === 'production';

  console.log(`🔧 Server mode: ${NODE_ENV}`);
  console.log(`🔧 Environment detection: development=${isDevelopment}, production=${isProduction}`);

  if (isDevelopment) {
    console.log('🔧 Using Vite development server with hot reloading');
    await setupVite(app, server);
  } else {
    console.log('🔧 Serving built static files from production build');
    serveStatic(app);
  }

  // Function to ensure port 5000 is available
  const ensurePortAvailable = (): void => {
    try {
      // Kill any process using the target port
      execSync(`lsof -ti :${port} | xargs -r kill -9 2>/dev/null || true`, { stdio: 'ignore' });
      console.log(`🔧 Port ${port} cleared for startup`);
    } catch (error) {
      // Continue regardless of cleanup errors
      console.log(`⚠️  Port cleanup completed`);
    }
  };

  // Serve on PORT from environment, defaulting to 3000 (for Preview compatibility)
  const port = Number(process.env.PORT) || 3000;
  
  // Ensure port is available before starting
  ensurePortAvailable();
  
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
    console.log(`🚀 Server is running on http://0.0.0.0:${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🆔 PID: ${process.pid}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
  });

  // Add error handling to keep server running
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use (pid=${process.pid})`);
      console.error('💡 Try killing existing processes or set PORT to a free port');
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });

  // Keep the process alive
  setInterval(() => {
    // This keeps the event loop alive
  }, 1000);

})();

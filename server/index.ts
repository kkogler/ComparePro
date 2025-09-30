import dotenv from "dotenv";
// Load environment variables from .env file
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { execSync } from "child_process";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

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
  const server = await registerRoutes(app);

  // CRITICAL: Set timezone globally before initializing schedulers
  // This works around broken ICU/tzdata support in this environment
  process.env.TZ = "America/Los_Angeles";
  console.log('🌍 Global timezone set to:', process.env.TZ);

  // DISABLED: Cron job schedulers removed due to reliability issues
  // Now using Scheduled Deployments for reliable sync scheduling
  // Manual sync functions remain available through the admin interface
  
  // // Initialize Sports South scheduler
  // try {
  //   const { sportsSouthScheduler } = await import('./sports-south-scheduler');
  //   console.log('Sports South scheduler initialized');
  // } catch (error) {
  //   console.error('Failed to initialize Sports South scheduler:', error);
  // }

  // // Initialize Bill Hicks scheduler
  // try {
  //   const { initializeBillHicksSimpleScheduler } = await import('./bill-hicks-simple-scheduler');
  //   await initializeBillHicksSimpleScheduler();
  //   console.log('Bill Hicks simplified scheduler initialized');
  // } catch (error) {
  //   console.error('Failed to initialize Bill Hicks scheduler:', error);
  // }

  // // Initialize Chattanooga scheduler
  // try {
  //   const { chattanoogaScheduler } = await import('./chattanooga-scheduler');
  //   console.log('Chattanooga scheduler initialized');
  // } catch (error) {
  //   console.error('Failed to initialize Chattanooga scheduler:', error);
  // }

  console.log('Cron job schedulers disabled - using Scheduled Deployments for reliable sync scheduling');

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

    res.status(status).json({ message });
    throw err;
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

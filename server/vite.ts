import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        // Log the error but do not exit the process; keep dev server alive
        viteLogger.error(msg, options);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Use Vite middlewares but exclude API routes
  app.use((req, res, next) => {
    const url = req.originalUrl;
    
    // Skip API routes - let them be handled by the Express API routes
    if (url.startsWith('/api/')) {
      return next();
    }
    
    // For non-API routes, use Vite middlewares
    vite.middlewares(req, res, next);
  });
  
  // Frontend catch-all route for non-API requests
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    
    // console.log('🌟 VITE WILDCARD: Processing URL:', url); // Disabled - too verbose
    
    // Skip API routes - let them be handled by the Express API routes
    if (url.startsWith('/api/') || url.startsWith('/org/')) {
      // console.log('🌟 VITE WILDCARD: Skipping API route:', url); // Disabled - too verbose
      return next();
    }
    
    // console.log('🌟 VITE WILDCARD: Serving frontend for:', url); // Disabled - too verbose

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res, next) => {
    const url = req.originalUrl;
    
    // Skip API routes - let them be handled by the Express API routes
    if (url.startsWith('/api/') || url.startsWith('/org/')) {
      return next();
    }
    
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

#!/usr/bin/env node

/**
 * Background Worker Process
 * Runs subscription jobs and other background tasks separately from web server
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function startWorker() {
  try {
    console.log('🚀 Starting background worker process...');

    // Initialize subscription services (background jobs)
    const { initializeSubscriptionServices } = await import('./server/plan-enforcement-service.ts');
    await initializeSubscriptionServices();

    console.log('✅ Background worker started successfully');
    console.log('📊 Worker will continue running background jobs...');

    // Keep the process alive
    process.stdin.resume();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('🛑 Worker received SIGINT, shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('🛑 Worker received SIGTERM, shutting down...');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();

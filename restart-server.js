#!/usr/bin/env node

/**
 * Reliable server restart script using PM2
 * Usage: node restart-server.js [production|development]
 */

const { execSync } = require('child_process');
const fs = require('fs');

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function restartServer(mode = 'development') {
  try {
    log(`🚀 Starting server restart in ${mode} mode...`);

    // Check if PM2 is installed
    try {
      execSync('pm2 --version', { stdio: 'pipe' });
      log('✅ PM2 is installed');
    } catch (error) {
      log('❌ PM2 not found. Installing globally...');
      execSync('npm install -g pm2', { stdio: 'inherit' });
      log('✅ PM2 installed');
    }

    // Kill any existing processes
    log('🛑 Stopping existing processes...');
    try {
      execSync('pm2 delete all', { stdio: 'pipe' });
    } catch (error) {
      // Ignore if no processes to stop
    }

    // Kill any Node processes on port 5000
    try {
      const processes = execSync('lsof -ti:5000', { encoding: 'utf8', stdio: 'pipe' });
      if (processes.trim()) {
        log('🛑 Killing processes on port 5000...');
        execSync(`kill -9 ${processes.trim()}`, { stdio: 'pipe' });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      // Port might not be in use, that's ok
    }

    // Start the web server
    log(`🚀 Starting web server in ${mode} mode...`);
    execSync(`pm2 start ecosystem.config.js --env ${mode}`, { stdio: 'inherit' });

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if server is running
    log('🔍 Checking server status...');
    execSync('pm2 status', { stdio: 'inherit' });

    log('✅ Server restart completed successfully!');
    log('📊 Use "pm2 logs" to view logs');
    log('📊 Use "pm2 restart bestprice-web" to restart web server');
    log('📊 Use "pm2 restart bestprice-worker" to restart worker (if needed)');

  } catch (error) {
    log(`❌ Server restart failed: ${error.message}`);
    log('💡 Try running: npm install -g pm2');
    log('💡 Then run: pm2 start ecosystem.config.js --env development');
    process.exit(1);
  }
}

// Get mode from command line argument
const mode = process.argv[2] || 'development';
restartServer(mode);













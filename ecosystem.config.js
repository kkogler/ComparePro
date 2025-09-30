// PM2 Configuration - CommonJS format
module.exports = {
  apps: [
    {
      name: 'bestprice-web',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Graceful shutdown
      kill_timeout: 8000,
      // Logging
      out_file: './logs/web-out.log',
      error_file: './logs/web-error.log',
      merge_logs: true,
      time: true,
      // Auto restart on crash
      autorestart: true,
      // Watch files for changes (development only)
      watch: false,
      // Max memory before restart
      max_memory_restart: '1G',
      // Environment variables - PM2 will inherit from system
    },
    {
      name: 'bestprice-worker',
      script: 'worker.js',
      instances: 1,
      exec_mode: 'fork',
      // Only run in production or when explicitly enabled
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      // Graceful shutdown
      kill_timeout: 10000,
      // Logging
      out_file: './logs/worker-out.log',
      error_file: './logs/worker-error.log',
      merge_logs: true,
      time: true,
      // Auto restart on crash
      autorestart: true,
      // Don't watch files
      watch: false,
      // Max memory before restart
      max_memory_restart: '512M'
    }
  ]
};

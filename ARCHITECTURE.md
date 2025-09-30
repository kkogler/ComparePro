# 🚀 BestPrice Application Architecture

## **📋 Overview**
This document describes the stabilized development workflow on Replit (single process, one owner of port 5000) and a production-like option using PM2. It also clarifies environment detection, health endpoints, and restart procedures to prevent port conflicts.

## **🔧 Architecture Changes**

### **Before (Problematic)**
```
Single Process:
├── Web Server (Express) + Background Jobs (Cron) + Static Files
└── Port 5000 conflicts, unclean restarts
```

### **After (Improved)**
Development (Replit):
```
Single Web Process (no PM2):
├── API Routes (Express)
├── Vite middleware (HMR)
├── Health/Ready Endpoints
└── Exactly one process listens on PORT=5000
```

Production-like (Optional, via PM2):
```
Web Process (PM2):
├── API Routes (Express)
├── Static File Serving
├── Health/Ready Endpoints
└── Clean restarts, no port conflicts

Worker Process (PM2):
└── Background Jobs (Subscription services)

External Services:
├── Database (PostgreSQL)
├── File Storage (Google Cloud)
└── Authentication (Session-based)
```

## **🛠️ Components**

### **1. Web Server (`bestprice-web`)**
- **Process**:
  - Development (Replit): launched with `npm run dev` (no PM2)
  - Production-like: managed by PM2 (`node dist/index.js`)
- **Responsibilities**:
  - Serve API endpoints
  - Serve static files (production) or Vite dev server (development)
  - Handle authentication and sessions
  - Provide health and readiness checks
- **Port**: `process.env.PORT || 5000` (Replit uses 5000)
- **Environment**: Controlled by `NODE_ENV`

### **2. Background Worker (`bestprice-worker`)**
- **Process**:
  - Development (Replit): not recommended to run alongside the dev web server
  - Production-like: separate PM2 process
- **Responsibilities**:
  - Run subscription cron jobs
  - Process background tasks
  - Handle scheduled operations
- **Environment**: Runs independently from web server

### **3. Health Endpoints**
- **`/api/health`**: Server health and environment info
- **`/api/ready`**: Server readiness for traffic

## **🚀 Quick Start Commands**

### **Development Mode**
```bash
npm run dev
```

#### Quick Dev Restart (Replit)
```bash
# Ensure no other owners of port 5000
pm2 delete all || true
pkill -f "tsx server/index.ts|node .*dist/index.js|vite|npm run dev" || true

# Start dev cleanly on 5000
PORT=5000 NODE_ENV=development npm run dev
```

### **Production Mode**
```bash
# Build first
npm run build

# Start with PM2
npm run start:pm2

# Or start manually
npm run start
```

### **PM2 Management**
```bash
# View status
npm run pm2:status

# View logs
npm run pm2:logs

# Restart all
npm run pm2:restart

# Stop all
npm run pm2:stop

# Delete all
npm run pm2:delete
```

Note: Do not run PM2 alongside `npm run dev` on Replit. Use one or the other.

### **Scripts Matrix**

| Script | Purpose | Notes |
|---|---|---|
| `npm run dev` | Dev server with Vite middleware | Replit default, single process on PORT=5000 |
| `npm run build` | Build client and server | Produces `dist/` |
| `npm run start` | Start built server | Uses `NODE_ENV=production` |
| `npm run start:pm2` | PM2 start (prod-like) | Do not use in Replit dev |
| `npm run pm2:status` | PM2 status | Prod-like only |
| `npm run pm2:delete` | Remove all PM2 apps | Useful when switching modes |
| `npm run kill` | Kill ad-hoc dev processes | Avoid unless needed |

### **Background Worker**
```bash
# Start worker (if needed separately)
npm run worker:start
```

## **🔍 Environment Detection**

### **Consistent NODE_ENV Usage**
- **Development**: `NODE_ENV=development` (uses Vite hot reloading)
- **Production**: `NODE_ENV=production` (serves built static files)
- **Detection**: `process.env.NODE_ENV` consistently throughout codebase
- **Port**: `process.env.PORT || 5000` (Replit `.replit` sets `PORT=5000`)

### **Server Mode Logging**
The server now clearly logs which mode it's running in:
```
🔧 Server mode: development
🔧 Environment detection: development=true, production=false
🔧 Using Vite development server with hot reloading
```

## **📊 Health Checks**

### **GET /api/health**
Returns server health information:
```json
{
  "status": "healthy",
  "mode": "development",
  "uptime": 45,
  "timestamp": "2025-01-20T12:00:00.000Z",
  "services": {
    "database": "connected",
    "webServer": "running"
  },
  "environment": {
    "nodeVersion": "v20.19.3",
    "platform": "linux",
    "arch": "x64"
  }
}
```

### **GET /api/ready**
Returns server readiness status:
```json
{
  "status": "ready",
  "mode": "development",
  "timestamp": "2025-01-20T12:00:00.000Z",
  "message": "Development server ready"
}
```

## **🔧 Troubleshooting**

### **Port 5000 Conflicts**
In development (Replit), ensure there is exactly one owner of port 5000:
```bash
# If PM2 was used earlier, remove all apps
pm2 delete all || true

# Kill any lingering dev/prod servers
pkill -f "tsx server/index.ts|node .*dist/index.js|vite|npm run dev" || true

# Start dev cleanly on 5000
PORT=5000 NODE_ENV=development npm run dev
```

### **Environment Issues**
Check environment detection:
```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Should show correct mode
```

### **Background Jobs Not Running**
Background jobs are now separate:
```bash
# Start worker process
npm run worker:start

# Or use PM2 (which handles it automatically)
npm run pm2:status
```

## **📈 Next Steps (Phase 2)**

1. **Database Health Checks**: Add actual database connectivity checks
2. **Worker Process Management**: Implement proper worker scaling
3. **Monitoring**: Add structured logging and metrics
4. **Deployment**: Containerize with Docker for production
5. **Security**: Add rate limiting and security headers

## **🎯 Benefits Achieved**

✅ **No More Port Conflicts (Dev)**: Single owner of port 5000 (`npm run dev`)
✅ **Clean Restarts**: Graceful shutdown and restart mechanisms
✅ **Environment Consistency**: Clear development/production detection
✅ **Background Job Separation**: Web server no longer blocked by cron jobs
✅ **Health Monitoring**: Clear visibility into server state
✅ **Process Management (Prod)**: Optionally use PM2 for production-like runs




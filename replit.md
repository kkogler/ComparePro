# BestPrice - Multi-Tenant Retail Inventory Management Platform

## Overview

BestPrice is a multi-tenant retail inventory management platform designed for the firearms retail industry. The system enables retail stores to manage product catalogs, integrate with multiple wholesale vendors, implement dynamic pricing strategies, and synchronize inventory across multiple channels.

The platform operates as a SaaS application with subscription-based billing through Zoho, serving multiple retail companies, each with their own stores, users, and vendor integrations. The core value proposition is automated vendor catalog synchronization, competitive pricing analysis, and streamlined inventory management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Tenant Architecture
The application uses a **single database with company-scoped data** approach rather than database-per-tenant isolation. Every major table includes `companyId` for tenant isolation, with retail vertical scoping (`retailVerticalId`) to support future expansion beyond firearms into other retail categories (appliances, sporting goods, etc.).

**Key Design Decisions:**
- **Single database approach** chosen for operational simplicity and cost efficiency
- **Vertical scoping** added to support multi-industry expansion while maintaining data integrity
- **Company isolation** enforced at application layer with middleware-based organization slug resolution
- Organization slug middleware (`req.organizationSlug`) determines tenant context for all requests

### Authentication & Session Management
- **Session-based authentication** using Express sessions with PostgreSQL session store
- **Password hashing** with bcrypt
- **Role-based access control** (Admin, Store Manager, Staff) enforced at route level
- Sessions stored in database for persistence across server restarts
- Cookie-based session management with secure flags in production

### Frontend Architecture
- **React SPA** with TypeScript
- **Vite** for development (HMR) and production builds
- **TanStack Query** for server state management and caching
- **Shadcn UI** components with Tailwind CSS styling
- **React Hook Form** with Zod validation for form handling
- Client-side routing with protected routes based on user roles

### Backend Architecture
- **Express.js** REST API with TypeScript
- **Single process model** in development (Replit) - no PM2
- **Production-ready PM2 configuration** available for multi-process deployment
- **Health check endpoints** (`/api/health`, `/api/ready`) for monitoring
- **Middleware stack:**
  - Organization slug resolution from URL paths
  - Raw body capture for webhook signature verification
  - Session authentication
  - Role-based authorization

### Database Architecture
- **PostgreSQL** via Neon (serverless)
- **Drizzle ORM** for type-safe database operations
- **Schema design:**
  - Multi-tenant with `companyId` on all major tables
  - Retail vertical scoping with `retailVerticalId` for future expansion
  - Junction tables for many-to-many relationships (vendor-vertical mapping, user-store access)
  - Encrypted credential storage with AES-256-GCM
  - Composite indexes for optimized vertical-scoped queries

### Database Configuration (Development vs Production)

**⚠️ CRITICAL: Separate Databases for Dev and Prod**

The system uses **separate PostgreSQL databases** for development and production:

**Development Database (Workspace):**
- Endpoint: `ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech`
- Connection: `postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`
- Used by: Replit workspace for development and testing
- Set in: **Tools → Secrets → DATABASE_URL**

**Production Database (Deployment):**
- Endpoint: `ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech`
- Connection: `postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`
- Used by: Published/deployed application (live users)
- Set in: **Tools → Publishing → [Your Deployment] → Advanced Settings → Production app secrets → DATABASE_URL**
- Status: **Unsynced from workspace** (yellow link icon indicates independent value)

**How to Verify Configuration:**
1. **Workspace uses Dev:** Tools → Secrets → DATABASE_URL should point to `ep-lingering-hat-adb2bp8d`
2. **Deployment uses Prod:** Tools → Publishing → Advanced Settings → Production app secrets → DATABASE_URL should point to `ep-lingering-sea-adyjzybe` with "Syncing Disabled" status

**Important Notes:**
- The deployment DATABASE_URL must be **unsynced** from workspace to maintain separate dev/prod databases
- Never run vendor syncs from the web server (causes memory crashes) - use manual triggers only
- Schema changes in development require `npm run db:push` to sync to dev database
- Production schema changes happen automatically via deployment migrations

**Key Tables:**
- `companies` - Tenant organizations with timezone and retail vertical
- `users` - User accounts with role and company association
- `stores` - Physical/online store locations per company
- `products` - Central product catalog with vendor mappings
- `supported_vendors` - Available vendor integrations per vertical
- `company_vendor_credentials` - Encrypted API credentials per company
- `pricing_rules` - Dynamic pricing strategy configuration
- `vendor_product_mappings` - Links products to vendor catalogs
- `vendor_inventory` - Real-time vendor stock levels

### Vendor Integration System

**Supported Vendors:**
1. **Bill Hicks & Co** - FTP-based catalog and inventory sync
2. **Sports South** - REST API with incremental updates
3. **Chattanooga Shooting Supplies** - SOAP API integration
4. **Lipsey's** - REST API with fixed IP proxy requirement
5. **GunBroker** - Marketplace product imports

**Integration Architecture:**
- **Vendor Registry Pattern** - Centralized handler registration for all vendors
- **Credential Vault Service** - Secure storage/retrieval with field-level encryption
- **Sync Services** - Vendor-specific import logic in dedicated files
- **Schedule Management** - Database-driven sync settings with external Replit Scheduled Deployments

**Sync Strategy:**
- **Catalog Sync** - Daily full or incremental product catalog updates
- **Inventory Sync** - Hourly stock level updates (Bill Hicks, Sports South)
- **Store-Specific Pricing** - Per-store vendor pricing where available
- **Status Tracking** - Database fields for last sync time, record counts, and status badges

### Pricing Engine
- **Multi-strategy pricing rules** per company with priority ordering
- **Fallback chain:** Vendor Cost → MAP → MSRP → Cost + Markup
- **Store-level overrides** for custom pricing per location
- **MAP enforcement** with configurable thresholds
- **Promotional pricing** with date-based activation
- **Bulk pricing updates** via vendor sync or manual override

### Image Management
- **Google Cloud Storage** integration for product images
- **Automatic image processing** with resizing and optimization
- **CDN delivery** via GCS public URLs
- **Fallback handling** for missing images
- **Vendor image imports** during catalog sync

### Email System
- **SendGrid** integration for transactional emails
- **Template-based emails:**
  - Welcome emails with initial credentials
  - Subscription confirmations
  - Password resets
  - Order notifications (webhook-triggered)
- **Rate limiting** to prevent duplicate sends

### Billing & Subscription Management
- **Zoho Billing** integration via webhooks
- **Webhook event handling:**
  - `subscription_created` / `subscription_activated` - Auto-provision company
  - `subscription_cancelled` - Suspend access
  - `subscription_renewed` - Reactivate access
- **Event deduplication** to prevent duplicate provisioning
- **Signature verification** for webhook security
- **Company provisioning** includes:
  - Admin user creation with random password
  - Default store setup
  - Default pricing rule creation
  - Vendor enablement based on retail vertical

### Background Jobs & Scheduling
**ALL AUTOMATIC SYNCS DISABLED (User Request - October 2025):**
- ❌ **No cron jobs running** - all automatic scheduling disabled
- ❌ **No subscription cron jobs** - trial expiration checks disabled
- ❌ **No vendor auto-syncs** - all syncs must be triggered manually
- ✅ **Manual sync triggers** available via Admin UI API endpoints
- ⚠️ **Vendor syncs crash production** due to memory limits - never run from web server

**Previous Automatic Sync Architecture (DISABLED):**
- Replit Scheduled Deployments for automated vendor syncs (not configured)
- Optional PM2 worker process for background tasks (not used)
- Database-driven schedules stored in `supported_vendors` table (ignored)
- Subscription cron jobs for trial expiration (disabled in code)

### File Storage & Processing
- **Google Cloud Storage** for product images and vendor files
- **FTP client** for Bill Hicks catalog/inventory downloads
- **CSV parsing** for Chattanooga and Bill Hicks imports
- **XML parsing** for Sports South SOAP responses
- **Temporary file handling** with cleanup after processing

## External Dependencies

### Third-Party Services
1. **Zoho Billing** - Subscription management and billing
   - Webhook endpoints for subscription lifecycle events
   - Signature-based authentication
   - Event deduplication to prevent double-provisioning

2. **SendGrid** - Email delivery service
   - API key authentication
   - Template-based transactional emails
   - Rate limiting and duplicate prevention

3. **Google Cloud Storage** - Image and file storage
   - Service account authentication via JSON key
   - Public bucket for CDN delivery
   - Automatic image optimization

4. **Neon Database** - Serverless PostgreSQL
   - WebSocket-based connection pooling
   - Connection string authentication
   - Automatic scaling

### Vendor APIs & Integrations

1. **Bill Hicks & Co**
   - FTP server access for catalog/inventory files
   - CSV format for catalog data
   - Store-specific pricing feeds
   - Hourly inventory updates

2. **Sports South**
   - REST API with authentication token
   - Incremental sync via last-update timestamps
   - JSON response format
   - Real-time inventory lookups

3. **Chattanooga Shooting Supplies**
   - SOAP API with XML responses
   - Customer number + credentials authentication
   - Category and item update endpoints
   - Paged result sets (1000 records per page)

4. **Lipsey's**
   - REST API requiring IP whitelisting
   - **Fixed IP proxy required** (DigitalOcean/Squid setup documented)
   - JSON response format
   - Catalog and inventory endpoints

5. **GunBroker**
   - Marketplace API integration
   - OAuth-based authentication
   - Product import functionality
   - Uses admin-level credentials for all stores

### Infrastructure Dependencies

1. **Replit Deployment Platform**
   - Hosted application runtime
   - Scheduled Deployments for automated tasks
   - Environment variable management via Secrets
   - Single static IP per deployment

2. **Fixed IP Proxy** (for Lipsey's)
   - DigitalOcean droplet with Squid proxy
   - Username/password authentication
   - Pass-through proxy for API requests
   - Documented setup in DEVOPS_QUICKSTART.md

3. **DNS & Domain Management**
   - Custom domain configuration (via Hostinger or similar)
   - SSL/TLS certificate management
   - Multi-tenant subdomain routing via organization slugs

### Required Environment Variables
- `DATABASE_URL` - Neon PostgreSQL connection string
- `SESSION_SECRET` - Express session encryption key
- `CREDENTIAL_ENCRYPTION_KEY` - 64-char hex key for credential vault
- `SENDGRID_API_KEY` - Email service authentication
- `GOOGLE_APPLICATION_CREDENTIALS` - GCS service account JSON
- `GCS_BUCKET_NAME` - Cloud storage bucket name
- `ZOHO_WEBHOOK_SECRET` - Webhook signature verification
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (defaults to 5000)

### Development Dependencies
- **Vite** - Frontend build tool with HMR
- **esbuild** - Backend TypeScript bundling
- **Drizzle Kit** - Database migration management
- **PM2** (optional) - Process management for production
- **TypeScript** - Type safety across stack
- **Tailwind CSS** - Utility-first styling
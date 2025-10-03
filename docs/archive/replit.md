# Overview
This project is a multi-tenant B2B product comparison and vendor management platform for the firearms industry. It aims to streamline procurement and vendor interactions by offering product search, price comparison, purchase order management, and Advanced Ship Notice (ASN) processing. Key features include a comprehensive pricing configuration system, a master product catalog, and a multi-vertical architecture to optimize product searches and vendor interactions, ultimately enhancing efficiency and business potential in the firearms market.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture
## UI/UX Decisions
- **Brand Colors**: Header Background (`#3f4549`), Orange Action Buttons (`#f58e1f`), Blue Action Buttons (`#2f80c2`).
- **Navigation**: Consistent dark gray headers for admin and store, blue accents for logos, grey sidebar with stacked icon/label layout.
- **Usage Guidelines**: Orange buttons for primary actions (Save, Submit), blue for secondary (Cancel, View).

## Frontend Architecture
- **Frameworks**: React 18 with TypeScript and Vite.
- **Components**: Shadcn/ui, Radix UI, Tailwind CSS.
- **State Management**: TanStack Query for server state, React hooks for local state.
- **Routing**: Wouter for client-side routing with company-based routes (`/org/{slug}/`).
- **Forms**: React Hook Form with Zod validation.
- **Authentication**: Context-based provider with session management.

## Backend Architecture
- **Framework**: Express.js with TypeScript on Node.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Passport.js with local strategy (bcrypt/scrypt).
- **File Uploads**: Multer.
- **API Design**: RESTful APIs with company-scoped endpoints (`/org/{slug}/api/`).

## Multi-Tenancy Design
- **Isolation**: Data scoped by `companyId` via URL-based tenant routing.
- **User Management**: Users linked to specific companies.
- **Resource Limits**: Configurable per-company.

## Data Storage Solutions
- **Primary Database**: Neon PostgreSQL.
- **Schema**: `Companies` table for tenant isolation, shared master product catalog, company-specific data (vendor products, pricing, orders, ASNs).
- **File Storage**: Local file system for uploads.
- **Caching**: System-level catalog cache for vendor product data.

## Product Management System
- **Master Catalog**: Centralized for universal identification (UPC, name, part numbers); pricing/availability from real-time vendor APIs.
- **Retail Vertical Scoping**: Products tagged and searched within an organization's assigned vertical.
- **Vendor Products**: Organization-specific pricing and availability.
- **Search**: Multi-field search across UPC, name, part number with vertical filtering.
- **Import**: CSV import with mapping, validation, error reporting.
- **Image Management**: Vendor priority-based sourcing.

## Scheduled Deployment Architecture
Leverages Replit Scheduled Deployments for enterprise-grade background processing, replacing internal cron jobs. This provides reliability, zero infrastructure management, resource efficiency, centralized monitoring, and scalability.
- **Production Deployments**: Includes daily and hourly syncs for vendors like Sports South, Bill Hicks (simplified single-sync architecture), and Chattanooga for catalog, pricing, and inventory updates.

## Order and ASN Processing
- **Order Management**: Drafts, vendor submission, status tracking.
- **Order Submission**: Automated status change with webhook generation.
- **Webhook System**: Comprehensive webhooks for order submissions.
- **ASN Processing**: Creation from vendor order responses.
- **Vendor Integration**: API-based order submission and status polling.

## Pricing Configuration System
Supports multiple strategies (MAP, MSRP, markup, margin, premium, discount) with advanced rounding and automatic default configuration for new companies.

## Critical Architecture Rules
- **Configuration**: No hardcoded references; use centralized configuration files.
- **Test Data**: Temporary and deleted post-testing.
- **Vendor Naming**: Use `vendorRegistry.getHandler()` and `supportedVendors.vendorShortCode`; no hardcoded IDs or names.
- **Master Product Catalog**: Contains only universal ID data; pricing/availability from real-time APIs.
- **Retail Vertical Assignment**: All imported products use centralized vertical configuration.
- **Data Safety**: No dangerous bulk delete operations.
- **Compliance**: Tracks serialized status for firearms.

## Secure User Onboarding & Authentication System
Implements a modern, secure tokenized activation flow for user onboarding.
- **Security**: Tokenized activation, email verification, self-service password setting, time-limited tokens (30 min activation, 15 min reset), zero credential logging, strong password complexity.
- **Zoho Billing Integration**: Automated provisioning via webhooks for new subscriptions. Includes company provisioning, admin user creation (pending activation), default store creation, and secure email delivery (SMTP2GO with SendGrid fallback).
- **Customer Activation**: Secure URL (`/org/{slug}/activate?token={secure-token}`) for password setup and account activation.
- **Technical Details**: HMAC-SHA256 signature validation for webhooks, 32-byte secure token generation, email provider resilience.
- **Status Tracking & Monitoring**: Subscription states (Active, Cancelled, Suspended, Expired), webhook event types (subscription_created, cancelled, reactivated, payment_failed, expired).
- **Error Handling**: Logged failures, correlation IDs, atomic transactions.
- **Admin Management**: Dashboard for subscriptions, troubleshooting tools.
- **Authentication Features**: Organization-scoped login, secure password reset, Express sessions with Passport.js, admin impersonation.

## Authentication & Security
- **Passport.js**: Authentication middleware.
- **bcrypt/scrypt**: Password hashing.
- **Express Session**: Server-side session management.
- **Crypto Tokens**: Secure token generation.

# External Dependencies
## Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL.
- **Drizzle ORM**: Type-safe database toolkit.

## Vendor API Integrations
- **Lipsey's API**: Product catalog and ordering (requires IP whitelisting via proxy).
- **Chattanooga Shooting Supplies**: Product and inventory sync.
- **GunBroker API**: Marketplace integration.
- **MicroBiz Product API**: Product data.
- **Sports South API**: Product catalog, inventory, pricing sync.
- **Bill Hicks & Co.**: Catalog and inventory synchronization.

### Fixed IP Proxy Architecture
**Purpose**: Provides a static IP address for vendor API calls that require IP whitelisting (primarily Lipsey's).

**Implementation**:
- All vendor API clients support optional proxy configuration via environment variables
- Proxy is transparent - when not configured, APIs use direct connections
- Single proxy server handles all vendor traffic for both dev and production environments

**Configuration** (Environment Variables):
- `PROXY_HOST`: Proxy server IP address
- `PROXY_PORT`: Proxy port (default: 3128)
- `PROXY_USERNAME`: Authentication username
- `PROXY_PASSWORD`: Authentication password

**Infrastructure**:
- Squid proxy server on Digital Ocean droplet (or similar VPS)
- Static IP address registered with vendors requiring whitelisting
- HTTP/HTTPS proxy with Basic authentication
- Survives application redeployments (separate infrastructure)

**Vendor APIs with Proxy Support**:
- ✅ Lipsey's API (`server/lipsey-api.ts`)
- ✅ Sports South API (`server/sports-south-api.ts`)
- ✅ Chattanooga API (`server/chattanooga-api.ts`)

**Setup Documentation**: See `PROXY_SETUP_GUIDE.md` for complete DevOps setup instructions.

## Email Services
- **SendGrid**: Transactional email.
- **SMTP2GO**: Primary transactional email.

## Billing & Subscription Management
- **Zoho Billing**: Primary billing provider.

## Development & Build Tools
- **Vite**: Frontend build tool.
- **ESBuild**: Backend bundling.
- **TailwindCSS**: CSS framework.
- **Replit Scheduled Deployments**: Background task scheduling.

## File Processing
- **CSV Parser**: Product catalog import.
- **Multer**: File upload handling.
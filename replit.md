# BestPrice - Multi-Tenant Retail Inventory Management Platform

## Overview

BestPrice is a multi-tenant retail inventory management platform for the firearms retail industry. It offers product catalog management, integration with multiple wholesale vendors, dynamic pricing strategies, and inventory synchronization across channels. The platform is a SaaS application with subscription-based billing, serving multiple retail companies with their own stores, users, and vendor integrations. Its core value is automated vendor catalog synchronization, competitive pricing analysis, and streamlined inventory management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Tenant Architecture
The application uses a single PostgreSQL database with `companyId` for tenant isolation and `retailVerticalId` for future expansion. Tenant context is resolved via an organization slug middleware.

### Authentication & Session Management
Session-based authentication with Express sessions and PostgreSQL store is used. Passwords are hashed with bcrypt, and role-based access control (Admin, Store Manager, Staff) is enforced.

### Frontend Architecture
A React SPA with TypeScript, Vite, TanStack Query for state management, Shadcn UI (Tailwind CSS), and React Hook Form with Zod validation. Client-side routing includes protected routes based on user roles.

### Backend Architecture
An Express.js REST API with TypeScript. It includes health check endpoints and a middleware stack for organization slug resolution, raw body capture (webhooks), session authentication, and role-based authorization. PM2 configuration is available for production.

### Database Architecture
PostgreSQL (Neon serverless) with Drizzle ORM for type-safe operations. The schema is multi-tenant with `companyId` and `retailVerticalId`. Manual SQL migrations are exclusively used for schema changes, with safeguards to prevent automatic migrations. **Separate databases for development and production are critical, and automatic synchronization is disabled to prevent data loss.**

### Vendor Integration System
The system supports multiple vendors (Bill Hicks, Sports South, Chattanooga Shooting Supplies, Lipsey's, GunBroker) via a Vendor Registry Pattern. It uses a Credential Vault Service for secure storage and dedicated sync services. Syncs are primarily manual, with previous automated scheduling disabled due to memory constraints.

### Pricing Engine
Supports multi-strategy pricing rules per company with priority ordering, including fallback chains (Vendor Cost → MAP → MSRP → Cost + Markup) and store-level overrides.

### Image Management
Google Cloud Storage handles product images, including automatic processing, CDN delivery, and vendor image imports during catalog sync.

### Email System
SendGrid is integrated for transactional emails like welcome, subscription, and password resets, using templates and rate limiting.

### Billing & Subscription Management
Zoho Billing integration via webhooks handles subscription lifecycle events (created, cancelled, renewed) for company provisioning and access suspension. Webhooks include signature verification and event deduplication.

### Background Jobs & Scheduling
All automatic syncs and cron jobs are disabled. Vendor syncs and other tasks must be triggered manually via Admin UI API endpoints.

### File Storage & Processing
Google Cloud Storage is used for files. FTP client for downloads, CSV/XML parsing for imports, and temporary file handling are in place.

## External Dependencies

### Third-Party Services
1.  **Zoho Billing**: Subscription management, webhook-based.
2.  **SendGrid**: Email delivery.
3.  **Google Cloud Storage**: Image and file storage.
4.  **Neon Database**: Serverless PostgreSQL.

### Vendor APIs & Integrations
1.  **Bill Hicks & Co**: FTP for catalog/inventory (CSV).
2.  **Sports South**: REST API (JSON).
3.  **Chattanooga Shooting Supplies**: SOAP API (XML).
4.  **Lipsey's**: REST API requiring fixed IP proxy.
5.  **GunBroker**: Marketplace API.

### Infrastructure Dependencies
1.  **Replit Deployment Platform**: Hosting and scheduling.
2.  **Fixed IP Proxy**: DigitalOcean/Squid for Lipsey's.
3.  **DNS & Domain Management**: Custom domain, SSL/TLS, multi-tenant subdomain routing.

### Required Environment Variables
-   `DATABASE_URL`
-   `SESSION_SECRET`
-   `CREDENTIAL_ENCRYPTION_KEY`
-   `SENDGRID_API_KEY`
-   `GOOGLE_APPLICATION_CREDENTIALS`
-   `GCS_BUCKET_NAME`
-   `ZOHO_WEBHOOK_SECRET`
-   `NODE_ENV`
-   `PORT`
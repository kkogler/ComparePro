# Replit Hosting-Only Deployment

This app can run on Replit Deployments without using Replit for development. Build locally (Cursor/VS Code), then deploy from the Replit workspace when ready.

## Web Deployment

- Build command:
  - `npm ci && npm run build`
- Run command:
  - `NODE_ENV=production PORT=$PORT node dist/index.js`
- Health check:
  - Path: `/api/health` (expects 200)

## Required Secrets

- Core: `DATABASE_URL`, `SESSION_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `BASE_URL`
- Email/Billing (if used): `SENDGRID_API_KEY`, `ZOHO_BILLING_ACCESS_TOKEN`, `ZOHO_BILLING_ORG_ID`, `ZOHO_BILLING_CLIENT_ID`, `ZOHO_BILLING_CLIENT_SECRET`, `ZOHO_BILLING_REFRESH_TOKEN`, `ZOHO_WEBHOOK_SECRET` or `ZOHO_BILLING_WEBHOOK_SECRET`
- Optional: `LOG_LEVEL`

Notes:
- The deployment filesystem is ephemeral. Use object storage for uploads; emit logs to stdout/stderr.
- Keep background jobs out of the web process. If needed, create a separate "Worker" deployment with `NODE_ENV=production node worker.js`.

## Verify

```bash
curl -sSf https://<your-domain>/api/health
```



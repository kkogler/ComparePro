/**
 * ⚠️  CRITICAL: This file is intentionally named .disabled.ts
 * 
 * Reason: Replit's deployment platform auto-detects drizzle.config.ts
 * and runs migrations regardless of .drizzle-kit-skip or build commands.
 * 
 * By renaming this file, Replit won't detect it and won't auto-migrate.
 * 
 * Usage: Only for manual introspection operations
 * Example: drizzle-kit introspect --config=drizzle.config.disabled.ts
 * 
 * DO NOT rename this file back to drizzle.config.ts or Replit will
 * start auto-migrating again and truncate production tables!
 */

import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // ⚠️ CRITICAL: File renamed to prevent Replit auto-detection
  // We use manual SQL migrations instead (see /migrations/)
  // Auto-migrations cause schema conflicts and data loss
  schemaFilter: ["public"],
  // Explicitly disable push during deployment
  strict: true,
  verbose: true,
  // Migration mode: manual only
  migrations: {
    schema: 'public',
  }
});

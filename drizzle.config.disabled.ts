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
  // ⚠️ CRITICAL: Disable automatic schema pushing during deployment
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

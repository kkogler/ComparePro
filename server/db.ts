import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech');
const isLocalDatabase = process.env.DATABASE_URL.includes('localhost');

console.log(`🔌 Database driver: ${isNeonDatabase ? 'Neon Cloud' : isLocalDatabase ? 'Local PostgreSQL' : 'Unknown'}`);

let pool: any;
let db: any;

if (isNeonDatabase) {
  // Configure Neon WebSocket constructor
  neonConfig.webSocketConstructor = ws;
  neonConfig.poolQueryViaFetch = true;

  // Configure connection pool with proper settings for Neon
  pool = new NeonPool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    maxUses: 7500,
    allowExitOnIdle: false
  });

  db = drizzle({ client: pool, schema });
} else {
  // Use regular node-postgres for local PostgreSQL
  pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  db = drizzlePg(pool, { schema });
}

export { pool, db };

// Add connection error handling
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Test connection with retry logic
let retryCount = 0;
const maxRetries = 5;
const retryDelay = 2000;

async function testConnection(): Promise<void> {
  try {
    console.log('Testing database connection...');
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('Database connection successful');
  } catch (error) {
    retryCount++;
    console.error(`Database connection attempt ${retryCount} failed:`, error);
    
    if (retryCount < maxRetries) {
      console.log(`Retrying database connection in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      await testConnection();
    } else {
      console.error('Max database connection retries exceeded');
      throw error;
    }
  }
}

// Import sql from drizzle-orm for the test query
import { sql } from 'drizzle-orm';

// Initialize connection test
testConnection().catch(console.error);
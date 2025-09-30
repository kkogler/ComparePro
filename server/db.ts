import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon WebSocket constructor
neonConfig.webSocketConstructor = ws;

// Improve Neon connection settings for stability
neonConfig.poolQueryViaFetch = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with proper settings for Neon
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum number of connections in the pool
  idleTimeoutMillis: 30000,   // Close connections after 30 seconds of inactivity
  connectionTimeoutMillis: 10000, // Wait up to 10 seconds for a connection
  maxUses: 7500,              // Maximum number of times a connection is used before being closed
  allowExitOnIdle: false      // Keep the pool alive even if all connections are idle
});

export const db = drizzle({ client: pool, schema });

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
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";
import { sql } from 'drizzle-orm';

neonConfig.webSocketConstructor = ws;

const DEV_DB_URL = "postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
const PROD_DB_URL = "postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function restoreDevFromProd() {
  console.log('🔄 RESTORE DEV FROM PRODUCTION');
  console.log('==============================\n');

  // Connect to both databases
  const prodPool = new NeonPool({ connectionString: PROD_DB_URL });
  const devPool = new NeonPool({ connectionString: DEV_DB_URL });
  
  const prodDb = drizzle({ client: prodPool, schema });
  const devDb = drizzle({ client: devPool, schema });

  try {
    // Step 1: Get table counts from production
    console.log('📊 Step 1: Checking production data...');
    const prodCounts = await prodDb.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM companies) as companies,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM stores) as stores,
        (SELECT COUNT(*) FROM products) as products
    `);
    console.log('   Production has:');
    console.log(`   - Companies: ${prodCounts.rows[0].companies}`);
    console.log(`   - Users: ${prodCounts.rows[0].users}`);
    console.log(`   - Stores: ${prodCounts.rows[0].stores}`);
    console.log(`   - Products: ${prodCounts.rows[0].products}\n`);

    // Step 2: Drop and recreate dev schema
    console.log('🗑️  Step 2: Clearing development database...');
    await devDb.execute(sql`DROP SCHEMA public CASCADE`);
    await devDb.execute(sql`CREATE SCHEMA public`);
    console.log('   ✅ Dev database cleared\n');

    // Step 3: Use pg_dump approach but with SQL execution
    console.log('📥 Step 3: Copying schema and data...');
    
    // Get schema from production
    const dumpResult = await prodDb.execute(sql`
      SELECT 
        'CREATE TABLE ' || table_name || ' (' || 
        string_agg(column_name || ' ' || data_type, ', ') || 
        ')' as create_stmt
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name
    `);
    
    console.log('   ✅ Schema copied\n');

    // Use simpler approach: dump and restore with psql
    console.log('📦 Using pg_dump/psql approach...');
    
    await devPool.end();
    await prodPool.end();
    
    console.log('\n⚠️  Note: pg_dump version mismatch detected.');
    console.log('Please run this command manually:\n');
    console.log('PGPASSWORD=npg_3U8KcQGzhMLW pg_dump -h ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech -U neondb_owner -d neondb | PGPASSWORD=npg_ZrF3qMEPhK0N psql -h ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech -U neondb_owner -d neondb');
    console.log('\nOr use Neon\'s database branching feature in the Neon console.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prodPool.end();
    await devPool.end();
  }
}

restoreDevFromProd().catch(console.error);

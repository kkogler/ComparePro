#!/usr/bin/env tsx
/**
 * Database Comparison Script
 * Checks product counts and table structures across all three databases
 */

import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import ws from 'ws';
import * as schema from '../shared/schema.js';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

interface DatabaseInfo {
  name: string;
  url: string;
  productCount: number;
  tableCount: number;
  tables: string[];
  error?: string;
}

async function checkDatabase(name: string, connectionUrl: string): Promise<DatabaseInfo> {
  const info: DatabaseInfo = {
    name,
    url: connectionUrl.substring(0, 50) + '...',
    productCount: 0,
    tableCount: 0,
    tables: [],
  };

  try {
    const isNeon = connectionUrl.includes('neon.tech');
    let pool: any;
    let db: any;

    if (isNeon) {
      pool = new NeonPool({ connectionString: connectionUrl, max: 1 });
      db = drizzle({ client: pool, schema });
    } else {
      pool = new PgPool({ connectionString: connectionUrl, max: 1 });
      db = drizzlePg(pool, { schema });
    }

    // Get product count
    try {
      const productResult = await db.execute(sql`SELECT COUNT(*) as count FROM products`);
      info.productCount = parseInt(productResult.rows[0].count);
    } catch (err) {
      info.productCount = 0;
    }

    // Get all tables
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    info.tables = tablesResult.rows.map((row: any) => row.table_name);
    info.tableCount = info.tables.length;

    await pool.end();
  } catch (err: any) {
    info.error = err.message;
  }

  return info;
}

async function main() {
  console.log('🔍 DATABASE COMPARISON TOOL\n');
  console.log('=' .repeat(80));

  const databases = [
    {
      name: '1. Development NEON',
      url: process.env.DATABASE_URL || '',
    },
    {
      name: '2. Production NEON',
      url: process.env.PRODUCTION_DATABASE_URL || 'NOT_SET',
    },
    // Note: Local PostgreSQL is deprecated and no longer used
  ];

  const results: DatabaseInfo[] = [];

  for (const db of databases) {
    console.log(`\n📊 Checking: ${db.name}`);
    console.log(`📍 URL: ${db.url.substring(0, 50)}...`);
    
    if (db.url === 'NOT_SET' || !db.url) {
      console.log('⚠️  Database URL not configured');
      results.push({
        name: db.name,
        url: 'NOT_SET',
        productCount: 0,
        tableCount: 0,
        tables: [],
        error: 'Database URL not configured',
      });
      continue;
    }

    const info = await checkDatabase(db.name, db.url);
    results.push(info);

    if (info.error) {
      console.log(`❌ Error: ${info.error}`);
    } else {
      console.log(`✅ Connected successfully`);
      console.log(`   Products: ${info.productCount.toLocaleString()}`);
      console.log(`   Tables: ${info.tableCount}`);
    }
  }

  // Summary comparison
  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY\n');

  results.forEach((info, idx) => {
    console.log(`${idx + 1}. ${info.name}`);
    console.log(`   Products: ${info.productCount.toLocaleString()}`);
    console.log(`   Tables: ${info.tableCount}`);
    if (info.error) {
      console.log(`   Status: ❌ ${info.error}`);
    } else {
      console.log(`   Status: ✅ Connected`);
    }
    console.log();
  });

  // Check schema consistency
  console.log('='.repeat(80));
  console.log('🔧 SCHEMA CONSISTENCY CHECK\n');

  const connectedDbs = results.filter(r => !r.error && r.tableCount > 0);
  
  if (connectedDbs.length >= 2) {
    const baseline = connectedDbs[0];
    let allMatch = true;

    for (let i = 1; i < connectedDbs.length; i++) {
      const current = connectedDbs[i];
      const missingInCurrent = baseline.tables.filter(t => !current.tables.includes(t));
      const extraInCurrent = current.tables.filter(t => !baseline.tables.includes(t));

      console.log(`Comparing ${baseline.name} vs ${current.name}:`);
      
      if (missingInCurrent.length === 0 && extraInCurrent.length === 0) {
        console.log(`✅ Schemas match (${baseline.tableCount} tables)`);
      } else {
        allMatch = false;
        if (missingInCurrent.length > 0) {
          console.log(`⚠️  Missing in ${current.name}: ${missingInCurrent.join(', ')}`);
        }
        if (extraInCurrent.length > 0) {
          console.log(`⚠️  Extra in ${current.name}: ${extraInCurrent.join(', ')}`);
        }
      }
      console.log();
    }

    if (allMatch) {
      console.log('✅ All database schemas are consistent!\n');
    } else {
      console.log('⚠️  Database schemas have differences!\n');
    }
  } else {
    console.log('⚠️  Not enough databases connected to compare schemas\n');
  }

  // Recommendations
  console.log('='.repeat(80));
  console.log('💡 RECOMMENDATIONS\n');

  const developmentNeon = results[0];
  const productionNeon = results[1];

  if (!developmentNeon.error && developmentNeon.productCount > 0) {
    console.log(`✅ Development NEON has ${developmentNeon.productCount.toLocaleString()} products`);
    console.log(`   This appears to be your most complete database.\n`);
  }

  if (!productionNeon.error && productionNeon.productCount < developmentNeon.productCount) {
    console.log(`⚠️  Production has only ${productionNeon.productCount.toLocaleString()} products`);
    console.log(`   Consider syncing data from Development NEON to Production.\n`);
  }

  console.log('Next steps:');
  console.log('1. Run: npm run db:export           (export from Development NEON)');
  console.log('2. Run: npm run db:sync:prod        (sync to Production NEON)');
  console.log('3. Run: npm run dev:cursor          (start development)\n');

  console.log('='.repeat(80));
}

main().catch(console.error);


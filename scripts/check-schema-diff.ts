#!/usr/bin/env tsx
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function compareSchemas() {
  const hostedUrl = process.env.DATABASE_URL!;
  const prodUrl = process.env.PRODUCTION_DATABASE_URL!;

  const hostedPool = new NeonPool({ connectionString: hostedUrl });
  const prodPool = new NeonPool({ connectionString: prodUrl });

  console.log('🔍 SCHEMA COMPARISON\n');
  console.log('Comparing Hosted NEON vs Production NEON\n');
  console.log('='.repeat(80));

  try {
    // Get all tables
    const tablesResult = await hostedPool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    let hasDifferences = false;

    for (const row of tablesResult.rows) {
      const table = row.table_name;

      // Get columns from both
      const hostedCols = await hostedPool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      const prodCols = await prodPool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      const hostedColNames = hostedCols.rows.map((c: any) => c.column_name);
      const prodColNames = prodCols.rows.map((c: any) => c.column_name);

      const missingInProd = hostedColNames.filter((c: string) => !prodColNames.includes(c));
      const extraInProd = prodColNames.filter((c: string) => !hostedColNames.includes(c));

      if (missingInProd.length > 0 || extraInProd.length > 0) {
        if (!hasDifferences) {
          console.log('\n⚠️  SCHEMA DIFFERENCES FOUND:\n');
          hasDifferences = true;
        }

        console.log(`Table: ${table}`);
        if (missingInProd.length > 0) {
          console.log(`  ❌ Missing in Production: ${missingInProd.join(', ')}`);
        }
        if (extraInProd.length > 0) {
          console.log(`  ➕ Extra in Production: ${extraInProd.join(', ')}`);
        }
        console.log();
      }
    }

    if (!hasDifferences) {
      console.log('\n✅ NO DIFFERENCES FOUND\n');
      console.log('All tables have identical column structures!\n');
    } else {
      console.log('='.repeat(80));
      console.log('\n💡 RECOMMENDATION:\n');
      console.log('Push schema to production: npm run db:push');
      console.log('This will add missing columns to production.\n');
    }

  } finally {
    await hostedPool.end();
    await prodPool.end();
  }
}

compareSchemas().catch(console.error);






















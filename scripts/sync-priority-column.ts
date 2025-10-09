#!/usr/bin/env tsx
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function syncPriorityColumn() {
  const source = new NeonPool({ connectionString: process.env.DATABASE_URL! });
  const target = new NeonPool({ connectionString: process.env.PRODUCTION_DATABASE_URL! });

  try {
    const data = await source.query(
      'SELECT id, supported_vendor_id, retail_vertical_id, priority FROM supported_vendor_retail_verticals ORDER BY id'
    );
    
    console.log(`Syncing priority data for ${data.rows.length} rows...`);

    for (const row of data.rows) {
      await target.query(
        'UPDATE supported_vendor_retail_verticals SET priority = $1 WHERE supported_vendor_id = $2 AND retail_vertical_id = $3',
        [row.priority, row.supported_vendor_id, row.retail_vertical_id]
      );
    }

    console.log('✅ Priority data synced!');
  } finally {
    await source.end();
    await target.end();
  }
}

syncPriorityColumn().catch(console.error);



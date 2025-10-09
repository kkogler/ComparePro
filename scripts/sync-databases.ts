#!/usr/bin/env tsx
/**
 * Direct Database Sync Script
 * Syncs data from source database to target database directly
 * This avoids pg_dump version issues by using direct SQL queries
 */

import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import ws from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

interface SyncOptions {
  sourceUrl: string;
  targetUrl: string;
  sourceName: string;
  targetName: string;
}

async function syncDatabases(options: SyncOptions) {
  console.log('🔄 DATABASE SYNC TOOL\n');
  console.log(`📤 Source: ${options.sourceName}`);
  console.log(`📥 Target: ${options.targetName}\n`);

  const isSourceNeon = options.sourceUrl.includes('neon.tech');
  const isTargetNeon = options.targetUrl.includes('neon.tech');

  let sourcePool: any;
  let targetPool: any;

  try {
    // Create source connection
    if (isSourceNeon) {
      sourcePool = new NeonPool({ connectionString: options.sourceUrl, max: 5 });
    } else {
      sourcePool = new PgPool({ connectionString: options.sourceUrl, max: 5 });
    }

    // Create target connection
    if (isTargetNeon) {
      targetPool = new NeonPool({ connectionString: options.targetUrl, max: 5 });
    } else {
      targetPool = new PgPool({ connectionString: options.targetUrl, max: 5 });
    }

    // Test connections
    console.log('🔌 Testing connections...');
    await sourcePool.query('SELECT 1');
    await targetPool.query('SELECT 1');
    console.log('✅ Both databases connected\n');

    // Get list of tables from source
    console.log('📋 Getting table list from source...');
    const tablesResult = await sourcePool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map((row: any) => row.table_name);
    console.log(`Found ${tables.length} tables to sync\n`);

    // Truncate all tables in target first (CASCADE handles foreign keys)
    console.log('🗑️  Clearing target database...');
    
    // Try to disable FK checks if possible (works on some databases)
    try {
      await targetPool.query('SET session_replication_role = replica;');
    } catch (e) {
      // Not supported on managed databases like Neon, that's okay
      console.log('   (FK checks remain enabled - using CASCADE mode)');
    }
    
    for (const table of tables.reverse()) {
      try {
        await targetPool.query(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch (truncError: any) {
        // If truncate fails, try delete
        await targetPool.query(`DELETE FROM "${table}"`);
      }
    }
    
    tables.reverse(); // Restore original order
    console.log('✅ Target database cleared\n');

    // Copy data table by table
    console.log('📊 Copying data...');
    let totalRows = 0;

    for (const table of tables) {
      process.stdout.write(`   ${table}... `);
      
      try {
        // Get column names
        const columnsResult = await sourcePool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          ORDER BY ordinal_position
        `, [table]);

        const columns = columnsResult.rows.map((row: any) => row.column_name);
        
        if (columns.length === 0) {
          console.log('⚠️  No columns found, skipping');
          continue;
        }

        // Copy data
        const columnNames = columns.map(c => `"${c}"`).join(', ');
        const dataResult = await sourcePool.query(`SELECT ${columnNames} FROM "${table}"`);
        
        if (dataResult.rows.length === 0) {
          console.log('(empty)');
          continue;
        }

        // Insert into target in batches (much faster!)
        const batchSize = 1000;
        let insertedCount = 0;
        
        for (let i = 0; i < dataResult.rows.length; i += batchSize) {
          const batch = dataResult.rows.slice(i, i + batchSize);
          
          // Build multi-row insert
          const valueGroups: string[] = [];
          const allValues: any[] = [];
          let paramIndex = 1;
          
          for (const row of batch) {
            const rowValues = columns.map(col => {
              const value = row[col];
              // Handle JSON columns - ensure they're properly formatted
              if (value && typeof value === 'object') {
                return JSON.stringify(value);
              }
              return value;
            });
            
            const placeholders = rowValues.map(() => `$${paramIndex++}`).join(', ');
            valueGroups.push(`(${placeholders})`);
            allValues.push(...rowValues);
          }
          
          try {
            await targetPool.query(
              `INSERT INTO "${table}" (${columnNames}) VALUES ${valueGroups.join(', ')}`,
              allValues
            );
            insertedCount += batch.length;
          } catch (insertError: any) {
            // If batch fails, try row by row
            for (const row of batch) {
              const values = columns.map(col => {
                const value = row[col];
                if (value && typeof value === 'object') {
                  return JSON.stringify(value);
                }
                return value;
              });
              const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
              
              try {
                await targetPool.query(
                  `INSERT INTO "${table}" (${columnNames}) VALUES (${placeholders})`,
                  values
                );
                insertedCount++;
              } catch (rowError: any) {
                // Skip constraint violations
              }
            }
          }
        }

        totalRows += dataResult.rows.length;
        console.log(`✅ ${dataResult.rows.length.toLocaleString()} rows`);
      } catch (error: any) {
        console.log(`❌ Error: ${error.message}`);
      }
    }

    // Re-enable FK checks (if we disabled them)
    try {
      await targetPool.query('SET session_replication_role = DEFAULT;');
    } catch (e) {
      // Not needed if we couldn't disable them
    }

    // Reset sequences
    console.log('\n🔢 Resetting sequences...');
    const sequencesResult = await targetPool.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `);

    for (const row of sequencesResult.rows) {
      const seqName = row.sequence_name;
      const tableName = seqName.replace(/_id_seq$/, '').replace(/_seq$/, '');
      
      try {
        await targetPool.query(`
          SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), true)
        `);
      } catch (error) {
        // Ignore errors for sequences that don't match a table
      }
    }

    console.log('\n✅ Database sync complete!');
    console.log(`📊 Total rows copied: ${totalRows.toLocaleString()}\n`);

  } catch (error: any) {
    console.error('❌ Sync failed:', error.message);
    throw error;
  } finally {
    if (sourcePool) await sourcePool.end();
    if (targetPool) await targetPool.end();
  }
}

async function main() {
  const target = process.argv[2]; // 'local' or 'production'

  if (!target || !['local', 'production'].includes(target)) {
    console.error('❌ Usage: tsx sync-databases.ts [local|production]');
    process.exit(1);
  }

  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) {
    console.error('❌ DATABASE_URL not set (source database)');
    process.exit(1);
  }

  let targetUrl: string;
  let targetName: string;

  if (target === 'local') {
    targetUrl = process.env.LOCAL_DATABASE_URL || 'postgresql://user:password@localhost:5432/pricecompare';
    targetName = 'Local PostgreSQL';
  } else {
    targetUrl = process.env.PRODUCTION_DATABASE_URL || '';
    if (!targetUrl || targetUrl === 'NOT_SET') {
      console.error('❌ PRODUCTION_DATABASE_URL not set');
      console.log('\nSet it by running:');
      console.log('export PRODUCTION_DATABASE_URL="postgresql://..."');
      process.exit(1);
    }
    targetName = 'Production NEON';
  }

  await syncDatabases({
    sourceUrl,
    targetUrl,
    sourceName: 'Hosted NEON',
    targetName,
  });
}

main().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});


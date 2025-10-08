#!/usr/bin/env tsx
/**
 * Database Export Script
 * Exports data from a PostgreSQL database to SQL dump file
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';

async function exportDatabase(databaseUrl: string, outputFile: string) {
  console.log('🚀 Starting database export...\n');
  console.log(`📍 Source: ${databaseUrl.substring(0, 50)}...`);
  console.log(`📁 Output: ${outputFile}\n`);

  // Ensure backup directory exists
  const backupDir = join(process.cwd(), 'backups');
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const outputPath = join(backupDir, outputFile);

  return new Promise<void>((resolve, reject) => {
    console.log('⏳ Exporting database (this may take a few minutes)...\n');

    const pg_dump = spawn('pg_dump', [
      databaseUrl,
      '--no-owner',
      '--no-acl',
      '--clean',
      '--if-exists',
      '--file', outputPath,
    ]);

    let stderr = '';

    pg_dump.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pg_dump.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Export failed!');
        console.error(stderr);
        reject(new Error(`pg_dump exited with code ${code}`));
      } else {
        console.log('✅ Export completed successfully!');
        console.log(`📁 Saved to: ${outputPath}\n`);
        
        // Show file size
        const stats = statSync(outputPath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`📊 File size: ${fileSizeInMB} MB\n`);
        
        resolve();
      }
    });

    pg_dump.on('error', (err) => {
      console.error('❌ Failed to start pg_dump:', err.message);
      reject(err);
    });
  });
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const outputFile = `hosted-neon-backup-${timestamp}.sql`;

  await exportDatabase(dbUrl, outputFile);
  
  console.log('📋 Next steps:');
  console.log('1. Review the backup file in ./backups/');
  console.log('2. Import to production: npm run db:import-prod');
  console.log('3. Import to local dev: npm run db:import-local\n');
}

main().catch((err) => {
  console.error('❌ Export failed:', err.message);
  process.exit(1);
});


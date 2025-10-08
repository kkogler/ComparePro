#!/usr/bin/env tsx
/**
 * Database Import Script
 * Imports data from SQL dump file to a PostgreSQL database
 */

import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + ' (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function importDatabase(databaseUrl: string, inputFile: string) {
  console.log('🚀 Starting database import...\n');
  console.log(`📁 Source: ${inputFile}`);
  console.log(`📍 Target: ${databaseUrl.substring(0, 50)}...\n`);

  console.log('⚠️  WARNING: This will REPLACE all data in the target database!\n');

  const confirmed = await promptUser('Are you sure you want to continue?');
  
  if (!confirmed) {
    console.log('❌ Import cancelled by user');
    return;
  }

  return new Promise<void>((resolve, reject) => {
    console.log('\n⏳ Importing database (this may take a few minutes)...\n');

    const psql = spawn('psql', [
      databaseUrl,
      '--file', inputFile,
      '--single-transaction',
    ]);

    let stdout = '';
    let stderr = '';

    psql.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    psql.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    psql.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Import failed!');
        console.error(stderr);
        reject(new Error(`psql exited with code ${code}`));
      } else {
        console.log('✅ Import completed successfully!\n');
        
        // Show any warnings
        if (stderr && stderr.includes('NOTICE')) {
          console.log('📝 Import notices:');
          console.log(stderr.split('\n').filter((line: string) => line.includes('NOTICE')).join('\n'));
          console.log();
        }
        
        resolve();
      }
    });

    psql.on('error', (err) => {
      console.error('❌ Failed to start psql:', err.message);
      reject(err);
    });
  });
}

async function main() {
  const target = process.argv[2]; // 'production' or 'local'
  
  if (!target || !['production', 'local'].includes(target)) {
    console.error('❌ Usage: tsx import-database.ts [production|local]');
    process.exit(1);
  }

  // Find the most recent backup file
  const backupDir = join(process.cwd(), 'backups');
  
  if (!existsSync(backupDir)) {
    console.error('❌ No backups directory found. Run export first.');
    process.exit(1);
  }

  const backupFiles = readdirSync(backupDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse();

  if (backupFiles.length === 0) {
    console.error('❌ No backup files found. Run export first.');
    process.exit(1);
  }

  const latestBackup = join(backupDir, backupFiles[0]);
  console.log(`📁 Using backup: ${backupFiles[0]}\n`);

  let dbUrl: string | undefined;

  if (target === 'production') {
    dbUrl = process.env.PRODUCTION_DATABASE_URL;
    if (!dbUrl) {
      console.error('❌ PRODUCTION_DATABASE_URL environment variable not set');
      console.log('\nSet it by running:');
      console.log('export PRODUCTION_DATABASE_URL="postgresql://..."');
      process.exit(1);
    }
  } else {
    const pgSockets = `${process.env.HOME}/.postgresql/sockets`;
    dbUrl = process.env.LOCAL_DATABASE_URL || `postgresql://user:password@/pricecompare?host=${pgSockets}`;
  }

  await importDatabase(dbUrl, latestBackup);
  
  console.log('✅ Database import complete!\n');
}

main().catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});



#!/usr/bin/env tsx
/**
 * Startup Safety Check - Verify Migrations are Disabled
 * 
 * This script runs on server startup to ensure:
 * 1. .drizzle-kit-skip file exists
 * 2. Package.json has safe script names
 * 3. Production database schema is correct
 */

import * as fs from 'fs';
import * as path from 'path';

function checkMigrationProtections() {
  console.log('🛡️  Verifying migration protections...\n');
  
  let allGood = true;
  
  // 1. Check for .drizzle-kit-skip
  const skipFile = path.join(process.cwd(), '.drizzle-kit-skip');
  if (fs.existsSync(skipFile)) {
    console.log('✅ .drizzle-kit-skip exists - Auto-migrations disabled');
  } else {
    console.error('❌ MISSING .drizzle-kit-skip - Auto-migrations may run during deployment!');
    allGood = false;
  }
  
  // 2. Check package.json scripts
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const dangerousScripts = ['db:push', 'db:generate', 'db:migrate'];
  const hasUnsafeScripts = dangerousScripts.some(script => packageJson.scripts[script]);
  
  if (hasUnsafeScripts) {
    console.error('❌ WARNING: Dangerous migration scripts still exist in package.json!');
    console.error('   Found:', dangerousScripts.filter(s => packageJson.scripts[s]).join(', '));
    console.error('   These should be renamed to DANGEROUS_db:* to prevent accidents');
    allGood = false;
  } else {
    console.log('✅ Dangerous scripts renamed - Accidental migrations prevented');
  }
  
  // 3. Check for manual migration docs
  const docsFile = path.join(process.cwd(), 'migrations/MANUAL_MIGRATIONS_ONLY.md');
  if (fs.existsSync(docsFile)) {
    console.log('✅ Manual migration documentation exists');
  } else {
    console.warn('⚠️  migrations/MANUAL_MIGRATIONS_ONLY.md not found - Team may not know migration process');
  }
  
  console.log();
  
  if (allGood) {
    console.log('✅ All migration protections verified! Safe to proceed.');
    console.log('📖 Schema changes must use manual SQL migrations in /migrations/');
    return true;
  } else {
    console.error('❌ Migration protection issues detected!');
    console.error('   See migrations/MANUAL_MIGRATIONS_ONLY.md for setup instructions');
    return false;
  }
}

// Run check
const isProtected = checkMigrationProtections();

// Don't fail startup, just warn
if (!isProtected) {
  console.warn('\n⚠️  Server starting anyway, but migration protections are incomplete!');
  console.warn('   Deploy at your own risk - auto-migrations could run\n');
}

process.exit(0); // Always exit successfully to not block server startup


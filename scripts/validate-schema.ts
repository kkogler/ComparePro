#!/usr/bin/env tsx
/**
 * Schema Validation Script
 * 
 * Validates that critical columns exist before deployment
 * Prevents accidental schema drops from breaking production
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const CRITICAL_COLUMNS = [
  { table: 'company_vendor_credentials', column: 'credentials', type: 'text' },
  { table: 'supported_vendors', column: 'admin_credentials', type: 'jsonb' },
  { table: 'supported_vendors', column: 'credential_fields', type: 'jsonb' }
];

async function validateSchema() {
  console.log('🔍 Validating critical database columns...\n');
  
  let allValid = true;
  
  for (const { table, column, type } of CRITICAL_COLUMNS) {
    try {
      const result = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = ${table} 
        AND column_name = ${column}
      `);
      
      if (result.rows.length === 0) {
        console.error(`❌ MISSING: ${table}.${column}`);
        allValid = false;
      } else {
        console.log(`✅ EXISTS: ${table}.${column} (${result.rows[0].data_type})`);
      }
    } catch (error) {
      console.error(`❌ ERROR checking ${table}.${column}:`, error);
      allValid = false;
    }
  }
  
  console.log();
  
  if (allValid) {
    console.log('✅ All critical columns validated successfully!');
    process.exit(0);
  } else {
    console.error('❌ Schema validation failed! Critical columns are missing.');
    console.error('   DO NOT DEPLOY until schema is fixed.');
    process.exit(1);
  }
}

validateSchema().catch(error => {
  console.error('Fatal error during validation:', error);
  process.exit(1);
});


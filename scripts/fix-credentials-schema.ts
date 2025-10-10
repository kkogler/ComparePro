#!/usr/bin/env tsx
/**
 * Fix credentials column type mismatch
 * Converts company_vendor_credentials.credentials from TEXT to JSONB
 */

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function fixCredentialsSchema() {
  console.log('🔧 Fixing credentials column type mismatch...\n');
  
  try {
    // Step 1: Check current column type
    console.log('📊 Step 1: Checking current column type...');
    const currentType = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'company_vendor_credentials' 
        AND column_name = 'credentials'
    `);
    
    console.log('Current schema:', currentType.rows[0]);
    
    if (currentType.rows[0]?.data_type === 'jsonb') {
      console.log('✅ Column is already JSONB type - no migration needed!');
      process.exit(0);
    }
    
    // Step 2: Check if there's any invalid JSON data that would fail migration
    console.log('\n📊 Step 2: Checking for invalid JSON data...');
    try {
      await db.execute(sql`
        SELECT id, company_id, credentials
        FROM company_vendor_credentials
        WHERE credentials IS NOT NULL
          AND credentials::text != ''
          AND credentials::text != '{}'
        LIMIT 5
      `);
      
      // Try to cast each row to jsonb to ensure valid JSON
      const testCast = await db.execute(sql`
        SELECT 
          id,
          company_id,
          CASE 
            WHEN credentials IS NULL THEN NULL
            WHEN credentials::text = '' THEN '{}'::jsonb
            WHEN credentials::text = '{}' THEN '{}'::jsonb
            ELSE credentials::jsonb
          END as json_test
        FROM company_vendor_credentials
      `);
      
      console.log(`✅ All ${testCast.rows.length} rows have valid JSON data`);
      
    } catch (error: any) {
      console.error('❌ Found invalid JSON data:', error.message);
      console.error('\nPlease fix invalid JSON before running this migration');
      process.exit(1);
    }
    
    // Step 3: Perform the migration
    console.log('\n🔄 Step 3: Converting column from TEXT to JSONB...');
    console.log('This may take a moment for large tables...');
    
    // First, drop the default value
    console.log('  - Dropping default value...');
    await db.execute(sql`
      ALTER TABLE company_vendor_credentials 
      ALTER COLUMN credentials DROP DEFAULT
    `);
    
    // Then convert the type
    console.log('  - Converting TEXT to JSONB...');
    await db.execute(sql`
      ALTER TABLE company_vendor_credentials 
      ALTER COLUMN credentials 
      TYPE jsonb 
      USING CASE 
        WHEN credentials IS NULL THEN NULL
        WHEN credentials::text = '' THEN '{}'::jsonb
        WHEN credentials::text = '{}' THEN '{}'::jsonb
        ELSE credentials::jsonb
      END
    `);
    
    console.log('✅ Column type converted successfully');
    
    // Step 4: Verify the change
    console.log('\n📊 Step 4: Verifying migration...');
    const newType = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'company_vendor_credentials' 
        AND column_name = 'credentials'
    `);
    
    console.log('New schema:', newType.rows[0]);
    
    if (newType.rows[0]?.data_type === 'jsonb') {
      console.log('✅ Migration successful!');
    } else {
      console.error('❌ Migration may have failed - column type is not JSONB');
      process.exit(1);
    }
    
    // Step 5: Show sample data to verify integrity
    console.log('\n📊 Step 5: Checking data integrity...');
    const sampleData = await db.execute(sql`
      SELECT 
        id,
        company_id,
        supported_vendor_id,
        jsonb_typeof(credentials) as type,
        credentials
      FROM company_vendor_credentials
      WHERE credentials IS NOT NULL 
        AND credentials != '{}'::jsonb
      LIMIT 5
    `);
    
    console.log(`\n✅ Sample of ${sampleData.rows.length} credential rows:`);
    sampleData.rows.forEach((row: any) => {
      console.log(`  - ID ${row.id}: Company ${row.company_id}, Type: ${row.type}, Keys: ${Object.keys(row.credentials || {}).join(', ')}`);
    });
    
    console.log('\n✅ Schema fix complete! Credentials column is now JSONB.');
    console.log('\n📝 Next steps:');
    console.log('1. Update migrations/schema.ts to match shared/schema.ts');
    console.log('2. Test credential save/load in production');
    console.log('3. Consider running this on dev database as well for consistency');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixCredentialsSchema();


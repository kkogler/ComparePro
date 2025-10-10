#!/usr/bin/env tsx
import { db } from '../server/db.js';
import { companies, companyVendorCredentials } from '../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

async function checkDatabase() {
  try {
    // Check for slither-guns organization
    const org = await db.select().from(companies).where(eq(companies.slug, 'slither-guns')).limit(1);
    
    if (org.length === 0) {
      console.log('❌ slither-guns organization NOT found');
      console.log('This is NOT the production database');
      process.exit(1);
    }
    
    console.log('✅ slither-guns organization found');
    console.log(`   Company: ${org[0].name} (ID: ${org[0].id})`);
    console.log('   This IS the production database');
    console.log('');
    
    // Check credentials column type
    const columnInfo = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'company_vendor_credentials' 
        AND column_name = 'credentials'
    `);
    
    console.log('📊 Credentials column info:');
    console.log(`   Type: ${columnInfo.rows[0]?.data_type}`);
    console.log(`   Nullable: ${columnInfo.rows[0]?.is_nullable}`);
    console.log('');
    
    if (columnInfo.rows[0]?.data_type === 'text') {
      console.log('⚠️  Column is TEXT - needs to be converted to JSONB');
    } else if (columnInfo.rows[0]?.data_type === 'jsonb') {
      console.log('✅ Column is already JSONB - no migration needed');
    } else {
      console.log(`❓ Unexpected type: ${columnInfo.rows[0]?.data_type}`);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();


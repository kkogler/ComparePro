#!/usr/bin/env node

// Simple migration script to create integration_settings table
const { db } = require('./dist/db.js');

async function runMigration() {
  console.log('🚀 Starting integration_settings table migration...');
  
  try {
    // Create the integration_settings table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS integration_settings (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        webhook_url TEXT,
        api_key TEXT,
        swipe_simple_tax TEXT DEFAULT 'TRUE',
        swipe_simple_track_inventory TEXT DEFAULT 'TRUE',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(company_id)
      )
    `);
    
    // Create index for faster lookups
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_integration_settings_company_id 
      ON integration_settings(company_id)
    `);
    
    console.log('✅ Integration settings table created successfully!');
    console.log('✅ Index created successfully!');
    console.log('🎉 Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();

import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const devDB = neon("postgresql://neondb_owner:npg_ZrF3qMEPhK0N@ep-lingering-hat-adb2bp8d.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require");

async function importTable(tableName, jsonlFile) {
  console.log(`\nImporting ${tableName}...`);
  
  const lines = fs.readFileSync(jsonlFile, 'utf8')
    .split('\n')
    .filter(line => line.trim() && line.trim() !== '');
  
  let imported = 0;
  let skipped = 0;
  
  for (const line of lines) {
    try {
      const row = JSON.parse(line.trim());
      
      // Get column names and values
      const columns = Object.keys(row);
      const values = Object.values(row);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      await devDB(sql, values);
      imported++;
      
      if (imported % 10000 === 0) {
        console.log(`  Progress: ${imported} rows...`);
      }
    } catch (err) {
      skipped++;
      if (skipped <= 5) {
        console.log(`  Warning: ${err.message.split('\n')[0]}`);
      }
    }
  }
  
  console.log(`  ✓ Imported ${imported} rows (${skipped} skipped)`);
}

async function main() {
  try {
    // Import in dependency order
    await importTable('supported_vendors', '/tmp/supported_vendors.jsonl');
    await importTable('supported_vendor_retail_verticals', '/tmp/supported_vendor_retail_verticals.jsonl');
    await importTable('company_vendor_credentials', '/tmp/company_vendor_credentials.jsonl');
    await importTable('vendor_product_mappings', '/tmp/vendor_product_mappings.jsonl');
    await importTable('vendor_inventory', '/tmp/vendor_inventory.jsonl');
    
    console.log('\n=== IMPORT COMPLETE ===');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();

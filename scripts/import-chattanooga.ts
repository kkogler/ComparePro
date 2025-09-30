#!/usr/bin/env tsx

import { ChattanoogaCSVImporter } from '../server/chattanooga-csv-importer';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const csvFilePath = path.join(__dirname, '../catalog-cache/chattanooga-catalog.csv');
  
  // Import for first available company (configurable via env var)
  const companyId = parseInt(process.env.TARGET_COMPANY_ID || '1');
  
  console.log('='.repeat(60));
  console.log('CHATTANOOGA SHOOTING SUPPLIES CSV IMPORT');
  console.log('='.repeat(60));
  console.log(`File: ${csvFilePath}`);
  console.log(`Target Company ID: ${companyId}`);
  console.log('');

  try {
    await ChattanoogaCSVImporter.importFromCSV(csvFilePath);
    console.log('\n✅ Import completed successfully!');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the import if this file is executed directly
main();
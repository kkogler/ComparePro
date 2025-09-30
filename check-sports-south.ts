#!/usr/bin/env tsx

import { storage } from './server/storage.js';

async function checkSportsSouth() {
  console.log('🔍 Checking Sports South vendor configuration...');
  
  try {
    const vendors = await storage.getAllSupportedVendors();
    const sportsSouth = vendors.find(v => v.name.toLowerCase().includes('sports south'));
    
    if (sportsSouth) {
      console.log('📋 Sports South vendor found:');
      console.log(`  - ID: ${sportsSouth.id}`);
      console.log(`  - Name: ${sportsSouth.name}`);
      console.log(`  - ShortCode: ${sportsSouth.vendorShortCode || 'NOT SET'}`);
      console.log(`  - Expected ShortCode: sports-south`);
      
      if (sportsSouth.vendorShortCode !== 'sports-south') {
        console.log('⚠️  Short code mismatch! Need to update vendorShortCode to "sports-south"');
      } else {
        console.log('✅ Short code is correct');
      }
    } else {
      console.log('❌ Sports South vendor not found');
    }
  } catch (error) {
    console.error('❌ Error checking Sports South:', error);
  }
}

checkSportsSouth().then(() => {
  console.log('🏁 Sports South check completed');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

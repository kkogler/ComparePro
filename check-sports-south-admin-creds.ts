import { db } from './server/db';
import { supportedVendors } from './shared/schema';
import { eq } from 'drizzle-orm';

async function checkSportsSouthAdminCreds() {
  try {
    console.log('🔍 Checking Sports South admin credentials...');
    
    // Get Sports South from supported vendors
    const sportsSouth = await db.select().from(supportedVendors)
      .where(eq(supportedVendors.name, 'Sports South'));
    
    if (sportsSouth.length > 0) {
      const vendor = sportsSouth[0];
      console.log('📊 Sports South admin vendor:');
      console.log(`  - ID: ${vendor.id}`);
      console.log(`  - Name: ${vendor.name}`);
      console.log(`  - Is Enabled: ${vendor.isEnabled}`);
      console.log(`  - Has Credentials: ${vendor.credentials ? 'YES' : 'NO'}`);
      if (vendor.credentials) {
        console.log(`  - Credentials Keys: ${Object.keys(vendor.credentials).join(', ')}`);
      }
    } else {
      console.log('❌ Sports South not found in supported vendors');
    }
    
  } catch (error) {
    console.error('❌ Error checking Sports South admin credentials:', error);
  } finally {
    process.exit(0);
  }
}

checkSportsSouthAdminCreds();

import { db } from './server/db.js';
import { supportedVendors } from '@shared/schema';
import { ilike } from 'drizzle-orm';

async function fixChattanoogaShortCode() {
  try {
    console.log('Updating Chattanooga vendorShortCode to capitalize...');
    
    await db.update(supportedVendors)
      .set({ vendorShortCode: 'Chattanooga' })
      .where(ilike(supportedVendors.name, '%Chattanooga%'));
    
    console.log('✅ Chattanooga vendorShortCode updated from "chattanooga" to "Chattanooga"');
    console.log('   Title will now show: "Chattanooga Sync Settings"');
    
    // Verify the change
    const [vendor] = await db.select()
      .from(supportedVendors)
      .where(ilike(supportedVendors.name, '%Chattanooga%'));
    
    if (vendor) {
      console.log('\n✅ Verified:');
      console.log('   Vendor Name:', vendor.name);
      console.log('   Vendor Short Code:', vendor.vendorShortCode);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixChattanoogaShortCode();


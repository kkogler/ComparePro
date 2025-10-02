import { db } from './server/db';
import { supportedVendors } from './shared/schema';
import { like } from 'drizzle-orm';

async function checkLipseysVendor() {
  const vendors = await db
    .select()
    .from(supportedVendors)
    .where(like(supportedVendors.name, '%Lipsey%'));
  
  console.log('Lipsey vendors found:', vendors.length);
  vendors.forEach(v => {
    console.log('\nVendor:');
    console.log('  Name:', v.name);
    console.log('  ID:', v.id);
    console.log('  Slug:', v.vendorShortCode);
    console.log('  Has Admin Creds:', !!v.adminCredentials);
    if (v.adminCredentials) {
      const creds = v.adminCredentials as any;
      console.log('  Credential fields:', Object.keys(creds));
    }
  });
  
  process.exit(0);
}

checkLipseysVendor();


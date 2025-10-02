import { db } from './server/db';
import { supportedVendors } from './shared/schema';
import { eq } from 'drizzle-orm';

async function showLipseysCreds() {
  const [vendor] = await db
    .select()
    .from(supportedVendors)
    .where(eq(supportedVendors.name, "Lipsey's"));
  
  if (!vendor) {
    console.log('Vendor not found');
    process.exit(1);
  }
  
  console.log('Lipsey\'s Admin Credentials:');
  console.log('Email:', (vendor.adminCredentials as any)?.email || 'NOT SET');
  console.log('Password:', (vendor.adminCredentials as any)?.password ? '(SET - length: ' + (vendor.adminCredentials as any).password.length + ' chars)' : 'NOT SET');
  
  process.exit(0);
}

showLipseysCreds();


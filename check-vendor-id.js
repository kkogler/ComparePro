import { storage } from './server/storage.ts';

async function checkVendorId() {
  try {
    console.log('🔍 Checking supported vendor IDs...');
    
    // Get all supported vendors
    const { supportedVendors } = await import('@shared/schema');
    const { db } = await import('./server/db.ts');
    const { eq } = await import('drizzle-orm');
    
    const vendors = await db.select().from(supportedVendors);
    console.log('📋 All supported vendors:', vendors.map(v => ({ id: v.id, name: v.name })));
    
    // Find Chattanooga specifically
    const chattanooga = vendors.find(v => v.name.toLowerCase().includes('chattanooga'));
    console.log('🏪 Chattanooga vendor:', chattanooga);
    
    if (chattanooga) {
      console.log('✅ Chattanooga supported vendor ID:', chattanooga.id);
    }
    
  } catch (error) {
    console.error('❌ Error checking vendor ID:', error);
  }
}

checkVendorId();

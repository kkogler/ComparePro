import { storage } from './server/storage.ts';

async function checkCompanyId() {
  try {
    console.log('🔍 Checking company IDs...');
    
    // Get Demo Gun Store by slug
    const demoGunStore = await storage.getCompanyBySlug('demo-gun-store');
    console.log('🏪 Demo Gun Store:', demoGunStore);
    
    if (demoGunStore) {
      console.log('✅ Demo Gun Store company ID:', demoGunStore.id);
      
      // Check if there are any existing credentials for Chattanooga
      const existingCredentials = await storage.getCompanyVendorCredentials(demoGunStore.id, 13);
      console.log('🔑 Existing Chattanooga credentials:', existingCredentials);
    }
    
  } catch (error) {
    console.error('❌ Error checking company ID:', error);
  }
}

checkCompanyId();

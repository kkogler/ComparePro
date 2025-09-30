import { storage } from './server/storage.ts';

async function checkCurrentCredentials() {
  try {
    console.log('🔍 Checking current Chattanooga credentials after your update...');
    
    // Get Demo Gun Store company
    const company = await storage.getCompanyBySlug('demo-gun-store');
    console.log('🏪 Company ID:', company?.id);
    
    if (company) {
      // Get stored credentials for Chattanooga (vendor ID 1)
      const credentials = await storage.getCompanyVendorCredentials(company.id, 1);
      console.log('🔑 Current stored credentials:');
      
      if (credentials) {
        console.log('  - SID:', credentials.sid ? credentials.sid.substring(0, 8) + '...' : 'MISSING');
        console.log('  - Token:', credentials.token ? credentials.token.substring(0, 8) + '...' : 'MISSING');
        console.log('  - Account Number:', credentials.accountNumber || 'MISSING');
        console.log('  - Username:', credentials.username || 'MISSING');
        console.log('  - Password:', credentials.password ? credentials.password.substring(0, 3) + '...' : 'MISSING');
        
        // Check if these are the admin credentials
        const isAdminSid = credentials.sid === 'A3B1F813FA2469A69FEFA77E98F8A4A0';
        const isAdminToken = credentials.token === 'A3B1F814A833F40CFD2A800E0EE4CA81';
        
        console.log('🔍 Analysis:');
        console.log('  - Using admin SID:', isAdminSid);
        console.log('  - Using admin Token:', isAdminToken);
        console.log('  - Should work:', isAdminSid && isAdminToken);
      } else {
        console.log('❌ No credentials found for Chattanooga');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking current credentials:', error);
  }
}

checkCurrentCredentials();
















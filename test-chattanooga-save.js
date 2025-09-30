import { storage } from './server/storage.ts';

async function testChattanoogaSave() {
  try {
    console.log('🧪 Testing Chattanooga credential saving...');
    
    // Test saving credentials for Demo Gun Store (org ID 5) and Chattanooga (vendor ID 1)
    const testCredentials = {
      sid: 'TEST_SID_12345',
      token: 'TEST_TOKEN_67890',
      accountNumber: 'TEST_ACCOUNT_111',
      username: 'TEST_USER_222',
      password: 'TEST_PASS_333'
    };
    
    console.log('💾 Saving test credentials:', testCredentials);
    
    await storage.saveCompanyVendorCredentials(5, 1, testCredentials);
    
    console.log('✅ Credentials saved successfully');
    
    // Now retrieve them to verify
    const savedCredentials = await storage.getCompanyVendorCredentials(5, 1);
    console.log('📖 Retrieved credentials:', savedCredentials);
    
    // Check if all 5 fields are present
    const hasAllFields = savedCredentials && 
      savedCredentials.sid && 
      savedCredentials.token && 
      savedCredentials.accountNumber && 
      savedCredentials.username && 
      savedCredentials.password;
      
    console.log('🔍 All 5 fields present:', hasAllFields);
    
  } catch (error) {
    console.error('❌ Error testing Chattanooga save:', error);
  }
}

testChattanoogaSave();

import { createChattanoogaAPI } from './server/chattanooga-api.js';

async function testAdminCredentials() {
  try {
    console.log('🧪 Testing with the admin credentials you entered in the form...');
    
    // These are the admin credentials you mentioned
    const adminCredentials = {
      sid: 'A3B1F813FA2469A69FEFA77E98F8A4A0',
      token: 'A3B1F814A833F40CFD2A800E0EE4CA81',
      accountNumber: '9502500000',
      username: 'kevin.kogler@microbiz.com',
      password: 'MicroBiz01'
    };
    
    console.log('🔑 Testing with admin credentials:');
    console.log('  - SID:', adminCredentials.sid.substring(0, 8) + '...');
    console.log('  - Token:', adminCredentials.token.substring(0, 8) + '...');
    console.log('  - Account:', adminCredentials.accountNumber);
    console.log('  - Username:', adminCredentials.username);
    console.log('  - Password:', adminCredentials.password.substring(0, 3) + '...');
    
    const api = createChattanoogaAPI(adminCredentials);
    const result = await api.testConnection();
    
    console.log('📊 Test Result:', result);
    
    if (result.success) {
      console.log('✅ SUCCESS: Admin credentials work! The issue is elsewhere.');
    } else {
      console.log('❌ FAILED: Admin credentials are not working. Error:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing admin credentials:', error);
  }
}

testAdminCredentials();
















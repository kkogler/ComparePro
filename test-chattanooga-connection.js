import { createChattanoogaAPI } from './server/chattanooga-api.js';

async function testChattanoogaConnection() {
  try {
    console.log('🧪 Testing Chattanooga connection with admin credentials...');
    
    // Admin credentials that should work
    const credentials = {
      sid: 'A3B1F813FA2469A69FEFA77E98F8A4A0',
      token: 'A3B1F814A833F40CFD2A800E0EE4CA81',
      accountNumber: '9502500000',
      username: 'kevin.kogler@microbiz.com',
      password: 'MicroBiz01'
    };
    
    console.log('🔑 Using credentials:');
    console.log('  - SID:', credentials.sid.substring(0, 8) + '...');
    console.log('  - Token:', credentials.token.substring(0, 8) + '...');
    console.log('  - Account:', credentials.accountNumber);
    console.log('  - Username:', credentials.username);
    console.log('  - Password:', credentials.password.substring(0, 3) + '...');
    
    const api = createChattanoogaAPI(credentials);
    const result = await api.testConnection();
    
    console.log('📊 Test Result:', result);
    
    if (result.success) {
      console.log('✅ SUCCESS: Connection test passed!');
    } else {
      console.log('❌ FAILED: Connection test failed:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing connection:', error);
  }
}

testChattanoogaConnection();













const { ChattanoogaAPI } = require('./dist/index.js');

async function testChattanoogaConnection() {
  console.log('🧪 Testing Chattanooga connection directly...');
  
  // Use the exact credentials from the database
  const credentials = {
    accountNumber: '9502500000',
    username: '', // Not used by Chattanooga
    password: 'MicroBiz01',
    sid: 'A3B1F814A833F40CFD2A800E0EE4CA81',
    token: 'A3B1F814A833F40CFD2A800E0EE4CA81'
  };
  
  console.log('📋 Using credentials:', {
    accountNumber: credentials.accountNumber,
    password: credentials.password.substring(0, 4) + '...',
    sid: credentials.sid.substring(0, 8) + '...',
    token: credentials.token.substring(0, 8) + '...',
    tokenLength: credentials.token.length,
    sidLength: credentials.sid.length
  });
  
  try {
    const api = new ChattanoogaAPI(credentials);
    console.log('✅ ChattanoogaAPI instance created');
    
    const result = await api.testConnection();
    console.log('🧪 Test connection result:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Error testing connection:', error);
    return { success: false, message: error.message };
  }
}

testChattanoogaConnection().then(result => {
  console.log('🏁 Final result:', result);
  process.exit(result.success ? 0 : 1);
});























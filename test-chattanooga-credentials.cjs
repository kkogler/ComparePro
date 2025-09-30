const { Client } = require('pg');

async function testCredentialRetrieval() {
  console.log('🧪 Testing credential retrieval for Chattanooga...');
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Database connected');
    
    // Get the credentials the same way the API does
    const result = await client.query(`
      SELECT 
        cv.id,
        sv.name as vendor_name,
        cv.token,
        cv.sid,
        cv.password,
        cv.chattanooga_password,
        cv.account_number,
        LENGTH(cv.token) as token_length,
        LENGTH(cv.sid) as sid_length,
        CASE WHEN cv.token LIKE '%:%' THEN 'Encrypted' ELSE 'Plain Text' END as token_status,
        CASE WHEN cv.sid LIKE '%:%' THEN 'Encrypted' ELSE 'Plain Text' END as sid_status
      FROM company_vendor_credentials cv
      JOIN supported_vendors sv ON cv.supported_vendor_id = sv.id
      WHERE sv.name ILIKE '%chattanooga%'
      AND cv.company_id = 5;
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No Chattanooga credentials found');
      return;
    }
    
    const creds = result.rows[0];
    console.log('📋 Raw credentials from database:');
    console.log('  - Token:', creds.token?.substring(0, 8) + '... (length:', creds.token_length, ', status:', creds.token_status, ')');
    console.log('  - SID:', creds.sid?.substring(0, 8) + '... (length:', creds.sid_length, ', status:', creds.sid_status, ')');
    console.log('  - Password:', creds.password);
    console.log('  - Chattanooga Password:', creds.chattanooga_password);
    console.log('  - Account Number:', creds.account_number);
    
    // Test if token is the expected value
    const expectedToken = 'A3B1F814A833F40CFD2A800E0EE4CA81';
    console.log('🔍 Token validation:');
    console.log('  - Expected:', expectedToken);
    console.log('  - Actual:  ', creds.token);
    console.log('  - Match:   ', creds.token === expectedToken ? '✅ YES' : '❌ NO');
    
    // Test token format
    const isValidHex = /^[A-F0-9]+$/i.test(creds.token);
    console.log('  - Valid hex format:', isValidHex ? '✅ YES' : '❌ NO');
    console.log('  - Length is 32:', creds.token?.length === 32 ? '✅ YES' : '❌ NO');
    
    console.log('✅ Credential retrieval test complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testCredentialRetrieval();

/**
 * Test Lipsey's API exactly as documented
 * Following the exact format from https://api.lipseys.com/auth
 */

import { db } from './server/db';
import { supportedVendors } from './shared/schema';
import { eq } from 'drizzle-orm';
import fetch from 'node-fetch';

async function testExactDocFormat() {
  console.log('='.repeat(80));
  console.log('TESTING LIPSEY\'S API - EXACT DOCUMENTATION FORMAT');
  console.log('='.repeat(80));
  console.log();

  // Get credentials from database
  const [vendor] = await db
    .select()
    .from(supportedVendors)
    .where(eq(supportedVendors.name, "Lipsey's"));

  const creds = vendor.adminCredentials as { email: string; password: string };
  
  console.log('📋 Credentials:');
  console.log('  Email:', creds.email);
  console.log('  Password:', '***' + creds.password.slice(-3));
  console.log();

  console.log('🔌 Making request exactly as documented...');
  console.log('  URL: https://api.lipseys.com/api/Integration/Authentication/Login');
  console.log('  Method: POST');
  console.log('  Content-Type: application/json');
  console.log('  Body: { Email: "***", Password: "***" }');
  console.log();

  try {
    const response = await fetch('https://api.lipseys.com/api/Integration/Authentication/Login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Email: creds.email,
        Password: creds.password
      })
    });

    console.log('📥 Response received:');
    console.log('  Status:', response.status, response.statusText);
    console.log('  Headers:');
    response.headers.forEach((value, key) => {
      console.log(`    ${key}: ${value}`);
    });
    console.log();

    const responseText = await response.text();
    console.log('📄 Response body:');
    console.log(responseText);
    console.log();

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ SUCCESS! Parsed response:');
        console.log(JSON.stringify(data, null, 2));
        console.log();
        
        if (data.token) {
          console.log('🎉 Token received:', data.token.substring(0, 20) + '...');
          console.log('👤 Dealer info:');
          if (data.econtact?.data) {
            console.log('  Name:', data.econtact.data.name);
            console.log('  Email:', data.econtact.data.email);
            console.log('  Customer #:', data.econtact.data.cusNo);
            console.log('  Location:', data.econtact.data.locationName);
          }
        }
      } catch (parseError) {
        console.log('⚠️  Could not parse response as JSON');
      }
    } else {
      console.log('❌ Request failed with status', response.status);
      console.log();
      console.log('🔍 Troubleshooting:');
      console.log('  1. Verify IP address is whitelisted with Lipsey\'s');
      console.log('  2. Confirm credentials are for API access (not web login)');
      console.log('  3. Check if account needs activation by Lipsey\'s');
      console.log('  4. Try testing from Lipsey\'s web interface first');
    }

  } catch (error: any) {
    console.error('💥 Error making request:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log();
  console.log('='.repeat(80));
  process.exit(0);
}

testExactDocFormat();


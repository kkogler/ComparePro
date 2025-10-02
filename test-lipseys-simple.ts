import { db } from './server/db';
import { supportedVendors } from './shared/schema';
import { eq } from 'drizzle-orm';
import fetch from 'node-fetch';

async function testLipseysSimple() {
  console.log('='.repeat(80));
  console.log('SIMPLE LIPSEY\'S API TEST');
  console.log('='.repeat(80));
  console.log();

  // Get credentials
  const [vendor] = await db
    .select()
    .from(supportedVendors)
    .where(eq(supportedVendors.name, "Lipsey's"));

  const creds = vendor.adminCredentials as { email: string; password: string };
  
  console.log('Testing with:');
  console.log('  Email:', creds.email);
  console.log('  Password:', creds.password ? '***' + creds.password.slice(-3) : 'EMPTY');
  console.log();

  // Test 1: Direct API call with different payload formats
  console.log('Test 1: Standard format (Email/Password)');
  try {
    const response1 = await fetch('https://api.lipseys.com/api/Integration/Authentication/Login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Email: creds.email,
        Password: creds.password
      })
    });
    console.log('  Status:', response1.status, response1.statusText);
    const text1 = await response1.text();
    console.log('  Response:', text1.substring(0, 500));
  } catch (error: any) {
    console.log('  Error:', error.message);
  }
  console.log();

  // Test 2: Try lowercase keys
  console.log('Test 2: Lowercase format (email/password)');
  try {
    const response2 = await fetch('https://api.lipseys.com/api/Integration/Authentication/Login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: creds.email,
        password: creds.password
      })
    });
    console.log('  Status:', response2.status, response2.statusText);
    const text2 = await response2.text();
    console.log('  Response:', text2.substring(0, 500));
  } catch (error: any) {
    console.log('  Error:', error.message);
  }
  console.log();

  // Test 3: Try username/password
  console.log('Test 3: Username format (username/password)');
  try {
    const response3 = await fetch('https://api.lipseys.com/api/Integration/Authentication/Login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: creds.email,
        password: creds.password
      })
    });
    console.log('  Status:', response3.status, response3.statusText);
    const text3 = await response3.text();
    console.log('  Response:', text3.substring(0, 500));
  } catch (error: any) {
    console.log('  Error:', error.message);
  }
  console.log();

  console.log('='.repeat(80));
  console.log('If all tests show 401, please verify with Lipsey\'s that:');
  console.log('  1. Your IP address is whitelisted');
  console.log('  2. The API credentials are activated');
  console.log('  3. You\'re using the correct API endpoint');
  console.log('='.repeat(80));

  process.exit(0);
}

testLipseysSimple();


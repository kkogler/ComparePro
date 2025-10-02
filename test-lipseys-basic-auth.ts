import { db } from './server/db';
import { supportedVendors } from './shared/schema';
import { eq } from 'drizzle-orm';
import fetch from 'node-fetch';

async function testLipseysBasicAuth() {
  console.log('='.repeat(80));
  console.log('LIPSEY\'S BASIC AUTH TEST');
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
  console.log('  Password:', '***' + creds.password.slice(-3));
  console.log();

  // Test 1: Basic Authentication
  console.log('Test 1: Basic Authentication (Authorization header)');
  try {
    const basicAuth = Buffer.from(`${creds.email}:${creds.password}`).toString('base64');
    const response1 = await fetch('https://api.lipseys.com/api/Integration/Items/CatalogFeed', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      }
    });
    console.log('  Status:', response1.status, response1.statusText);
    const text1 = await response1.text();
    console.log('  Response:', text1.substring(0, 300));
  } catch (error: any) {
    console.log('  Error:', error.message);
  }
  console.log();

  // Test 2: Try the /auth endpoint
  console.log('Test 2: Testing /auth endpoint');
  try {
    const response2 = await fetch('https://api.lipseys.com/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Email: creds.email,
        Password: creds.password
      })
    });
    console.log('  Status:', response2.status, response2.statusText);
    const text2 = await response2.text();
    console.log('  Response:', text2.substring(0, 300));
  } catch (error: any) {
    console.log('  Error:', error.message);
  }
  console.log();

  // Test 3: Try /auth with lowercase
  console.log('Test 3: Testing /auth endpoint with lowercase');
  try {
    const response3 = await fetch('https://api.lipseys.com/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: creds.email,
        password: creds.password
      })
    });
    console.log('  Status:', response3.status, response3.statusText);
    const text3 = await response3.text();
    console.log('  Response:', text3.substring(0, 300));
  } catch (error: any) {
    console.log('  Error:', error.message);
  }
  console.log();

  // Test 4: Try GET on /auth
  console.log('Test 4: Testing GET /auth');
  try {
    const basicAuth = Buffer.from(`${creds.email}:${creds.password}`).toString('base64');
    const response4 = await fetch('https://api.lipseys.com/auth', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
      }
    });
    console.log('  Status:', response4.status, response4.statusText);
    const text4 = await response4.text();
    console.log('  Response:', text4.substring(0, 300));
  } catch (error: any) {
    console.log('  Error:', error.message);
  }
  console.log();

  console.log('='.repeat(80));
  console.log('Please share what you see at https://api.lipseys.com/auth');
  console.log('so we can match the correct authentication method.');
  console.log('='.repeat(80));

  process.exit(0);
}

testLipseysBasicAuth();


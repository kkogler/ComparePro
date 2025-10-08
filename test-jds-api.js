// Quick test script for JDS Industries API
// Usage: node test-jds-api.js

const https = require('https');

const apiToken = 'humkuBuymjChqzxxCDlfpByitetnAce';
const endpoint = 'https://api.jdsapp.com/get-product-details-by-skus';

// Test with a few SKUs from their documentation examples
const testData = JSON.stringify({
  token: apiToken,
  skus: ['LWB101', 'LPB004'] // SKUs from their example response
});

const url = new URL(endpoint);

const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testData.length
  }
};

console.log('🔍 Testing JDS Industries API...');
console.log('📍 Endpoint:', endpoint);
console.log('🔑 Using API token:', apiToken.substring(0, 10) + '...');
console.log('📦 Test SKUs: LWB101, LPB004');
console.log('');

const req = https.request(options, (res) => {
  console.log('📊 Response Status:', res.statusCode);
  console.log('📋 Response Headers:', JSON.stringify(res.headers, null, 2));
  console.log('');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📄 Response Body:');
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
      
      if (Array.isArray(jsonData) && jsonData.length > 0) {
        console.log('');
        console.log('✅ SUCCESS! API is working correctly.');
        console.log(`📦 Retrieved ${jsonData.length} product(s)`);
        console.log('');
        console.log('Sample product data:');
        const firstProduct = jsonData[0];
        console.log(`  - SKU: ${firstProduct.sku}`);
        console.log(`  - Name: ${firstProduct.name}`);
        console.log(`  - Price (Less than case): $${firstProduct.lessThanCasePrice}`);
        console.log(`  - Price (1 case): $${firstProduct.oneCase}`);
        console.log(`  - Available Quantity: ${firstProduct.availableQuantity}`);
      } else {
        console.log('');
        console.log('⚠️  API responded but no products found. This might be normal if the SKUs don\'t exist.');
      }
    } catch (e) {
      console.log(data);
      console.log('');
      console.log('❌ ERROR: Could not parse JSON response');
      console.error(e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ ERROR: Request failed');
  console.error(error);
});

req.write(testData);
req.end();


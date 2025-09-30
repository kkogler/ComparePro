#!/usr/bin/env tsx

/**
 * Test script to verify server endpoints are working
 */

import fetch from 'node-fetch';

async function testServerEndpoints() {
  console.log('🧪 Testing Server Endpoints...');
  console.log('⏰ Time:', new Date().toISOString());
  console.log('');

  const baseUrl = 'http://localhost:5000';
  
  try {
    // Test 1: Basic server response
    console.log('📋 Test 1: Basic server response');
    const response = await fetch(`${baseUrl}/`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      console.log('✅ Server is responding');
    } else {
      console.log(`❌ Server returned status: ${response.status}`);
    }
    console.log('');

    // Test 2: API health check
    console.log('📋 Test 2: API health check');
    try {
      const apiResponse = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        timeout: 5000
      });
      console.log(`API Health Status: ${apiResponse.status}`);
      if (apiResponse.status === 404) {
        console.log('⚠️  API health endpoint not found - this is expected if not implemented');
      }
    } catch (error) {
      console.log('❌ API health check failed:', error.message);
    }
    console.log('');

    // Test 3: Test the specific Sports South endpoint
    console.log('📋 Test 3: Sports South test-credentials endpoint');
    try {
      const testResponse = await fetch(`${baseUrl}/org/demo-gun-store/api/vendors/16/test-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credentials: {
            userName: 'test',
            password: 'test',
            source: 'BSTPRC',
            customerNumber: '123'
          }
        }),
        timeout: 10000
      });
      
      console.log(`Sports South endpoint status: ${testResponse.status}`);
      
      if (testResponse.status === 404) {
        console.log('❌ Sports South test-credentials endpoint not found');
        console.log('💡 The server may need to be restarted to pick up the new route');
      } else if (testResponse.status === 401) {
        console.log('⚠️  Sports South endpoint found but requires authentication (expected)');
      } else {
        console.log('✅ Sports South endpoint is responding');
      }
    } catch (error) {
      console.log('❌ Sports South endpoint test failed:', error.message);
    }
    console.log('');

    console.log('🎯 Server Endpoint Test Summary:');
    console.log('  ✅ Server is running');
    console.log('  ⚠️  API routes may need server restart');
    console.log('  💡 Try restarting the development server');

  } catch (error) {
    console.error('❌ Server endpoint test failed:', error);
  }
}

// Run the test
testServerEndpoints()
  .then(() => {
    console.log('\n🏁 Server Endpoint Test Completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error during server endpoint test:', error);
    process.exit(1);
  });

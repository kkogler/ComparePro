#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 SERVER STATUS CHECK');
console.log('======================');

// Check if server is running
try {
  const response = execSync('curl -s http://localhost:5000/api/health', { encoding: 'utf8' });
  console.log('✅ Server is RUNNING');
  console.log('📊 Status:', response.trim());

  // Check frontend
  const frontendResponse = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/', { encoding: 'utf8' });
  console.log('✅ Frontend is SERVING (HTTP ' + frontendResponse.trim() + ')');

} catch (error) {
  console.log('❌ Server is NOT running');
  console.log('💡 To start: npm run start');
}

// Check processes
console.log('\n🔍 PROCESS CHECK');
console.log('================');
try {
  const processes = execSync("ps aux | grep -E '(node|npm)' | grep -v grep", { encoding: 'utf8' });
  console.log('📋 Running processes:');
  console.log(processes);
} catch (error) {
  console.log('No Node.js processes found');
}










